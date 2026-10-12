import { Agent, ProxyAgent, fetch } from "undici";
import {
  resolvePublicSupplier,
  assertPublicSupplierUrl,
} from "../packages/core/url-safety.mjs";
import { readFile } from "node:fs/promises";
import robotsParser from "robots-parser";

export const BOT = "SouvenirsSaltilloSupplierAgent/2.0";
export class SupplierError extends Error {
  constructor(message, code = "SUPPLIER_EXTRACTION") {
    super(message);
    this.code = code;
  }
}
const robotsCache = new Map();
export async function publicFetch(
  value,
  {
    maxBytes = 2000000,
    timeout = 12000,
    headers = {},
    redirects = 4,
    checkRedirect = null,
  } = {},
) {
  let current = value;
  const deadline = Date.now() + timeout;
  for (let index = 0; index <= redirects; index++) {
    let resolved;
    try {
      resolved = await resolvePublicSupplier(current);
    } catch {
      throw new SupplierError(
        "La URL o el destino del proveedor no es seguro.",
        "SUPPLIER_UNSAFE_URL",
      );
    }
    const { url, addresses } = resolved,
      address = addresses[0];
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const ca = process.env.NODE_EXTRA_CA_CERTS
      ? await readFile(process.env.NODE_EXTRA_CA_CERTS)
      : undefined;
    // A configured trusted proxy retains its own egress policy and resolves the target.
    // Direct hosting pins the validated address for the connection, preserving TLS SNI.
    const dispatcher = proxy
      ? new ProxyAgent({ uri: proxy, requestTls: { ca }, proxyTls: { ca } })
      : new Agent({
          connect: {
            ca,
            lookup: (_host, options, callback) =>
              options.all
                ? callback(null, [address])
                : callback(null, address.address, address.family),
          },
        });
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new SupplierError(
          "El proveedor tardó demasiado.",
          "SUPPLIER_TIMEOUT",
        );
      const response = await fetch(url, {
        dispatcher,
        redirect: "manual",
        signal: AbortSignal.timeout(remaining),
        headers: {
          "user-agent": BOT,
          "accept-encoding": "identity",
          ...headers,
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || index === redirects)
          throw new SupplierError(
            "Redirecciones del proveedor no válidas.",
            "SUPPLIER_REDIRECT",
          );
        const next = new URL(location, url);
        assertPublicSupplierUrl(next.href);
        if (url.protocol === "https:" && next.protocol !== "https:")
          throw new SupplierError(
            "Redirección insegura.",
            "SUPPLIER_UNSAFE_URL",
          );
        if (checkRedirect) await checkRedirect(next.href);
        current = next.href;
        continue;
      }
      const encoding = response.headers.get("content-encoding");
      if (encoding && encoding !== "identity") {
        await response.body?.cancel();
        throw new SupplierError(
          "El proveedor necesita un adaptador de transferencia.",
          "SUPPLIER_FORMAT",
        );
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of response.body || []) {
        size += chunk.length;
        if (size > maxBytes) {
          await response.body.cancel().catch(() => {});
          throw new SupplierError(
            "La ficha excede el tamaño permitido.",
            "SUPPLIER_TOO_LARGE",
          );
        }
        chunks.push(Buffer.from(chunk));
      }
      return {
        url: url.href,
        status: response.status,
        headers: response.headers,
        text: Buffer.concat(chunks).toString("utf8"),
      };
    } catch (error) {
      if (error instanceof SupplierError) throw error;
      throw new SupplierError(
        "No se pudo consultar al proveedor; intenta más tarde.",
        "SUPPLIER_TRANSIENT",
      );
    } finally {
      await dispatcher.close();
    }
  }
}
export async function checkRobots(value) {
  const url = assertPublicSupplierUrl(value),
    robotsUrl = new URL("/robots.txt", url).href;
  let cached = robotsCache.get(url.origin);
  if (!cached || cached.expires < Date.now()) {
    const result = await publicFetch(robotsUrl, { maxBytes: 100000 });
    if (![200, 404, 410].includes(result.status))
      throw new SupplierError(
        "No fue posible verificar las reglas de rastreo del proveedor.",
        "SUPPLIER_ROBOTS_UNAVAILABLE",
      );
    cached = {
      parser: robotsParser(robotsUrl, result.status === 200 ? result.text : ""),
      expires: Date.now() + 3600000,
    };
    if (robotsCache.size >= 100)
      robotsCache.delete(robotsCache.keys().next().value);
    robotsCache.set(url.origin, cached);
  }
  if (cached.parser.isAllowed(value, BOT) === false)
    throw new SupplierError(
      "El proveedor no permite consultar esta ficha de forma automatizada.",
      "SUPPLIER_ROBOTS_DENIED",
    );
  const delay = cached.parser.getCrawlDelay(BOT);
  if (delay > 3)
    throw new SupplierError(
      "El proveedor exige un ritmo específico; necesita un adaptador dedicado.",
      "SUPPLIER_CRAWL_DELAY",
    );
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay * 1000));
}
export async function fetchSupplierPage(value) {
  await checkRobots(value);
  let result;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      result = await publicFetch(value, { checkRedirect: checkRobots });
    } catch (error) {
      if (error.code !== "SUPPLIER_TRANSIENT" || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (result.status >= 500 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    break;
  }
  if (result.status !== 200) {
    const code = [404, 410].includes(result.status)
      ? "SUPPLIER_REMOVED"
      : [401, 403].includes(result.status)
        ? "SUPPLIER_BLOCKED"
        : result.status === 429
          ? "SUPPLIER_RATE_LIMIT"
          : "SUPPLIER_TRANSIENT";
    throw new SupplierError(
      `El proveedor respondió HTTP ${result.status}.`,
      code,
    );
  }
  if (
    !/text\/html|application\/(ld\+json|json|xhtml\+xml)/i.test(
      result.headers.get("content-type") || "",
    )
  )
    throw new SupplierError(
      "La URL no contiene una ficha HTML o JSON.",
      "SUPPLIER_FORMAT",
    );
  return result;
}
