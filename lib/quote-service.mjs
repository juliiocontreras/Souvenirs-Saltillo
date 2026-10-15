import { createHmac } from "node:crypto";
import { ApiError, assertOrigin } from "./admin-auth.mjs";
import {
  validateQuote,
  validateLogo,
  quoteReceipt,
} from "../packages/core/quotes.mjs";

export async function parseQuoteRequest(request) {
  assertOrigin(request);
  const max = 1200 * 1024;
  if (Number(request.headers.get("content-length")) > max)
    throw new ApiError(
      "La solicitud supera el límite de 1 MB para el logo.",
      413,
    );
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new ApiError("Formato de solicitud inválido.", 422);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Faltan los datos de la solicitud.", 422);
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new ApiError("El logo debe pesar hasta 1 MB.", 413);
    }
    chunks.push(value);
  }
  try {
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type") },
    }).formData();
    if (form.get("website"))
      throw new Error("No se pudo recibir esta solicitud.");
    const fields = validateQuote(JSON.parse(form.get("details")));
    const file = form.get("logo");
    let logoData = null,
      logo = null;
    if (file && typeof file.arrayBuffer === "function" && file.size) {
      logoData = Buffer.from(await file.arrayBuffer());
      logo = validateLogo(logoData, file.name);
      if (fields.logoStatus !== "Tengo un logo")
        throw new Error("Confirma que tienes un logo antes de adjuntarlo.");
    }
    return { fields, logoData, logo };
  } catch (error) {
    throw new ApiError(
      error instanceof SyntaxError || error instanceof TypeError
        ? "Revisa los datos de tu solicitud."
        : error.message,
      422,
    );
  }
}

export async function receiveQuote(request, repository, catalog) {
  const { fields, logoData, logo } = await parseQuoteRequest(request);
  const address = (request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 100);
  const key = createHmac(
    "sha256",
    process.env.AUTH_SECRET || "local-quote-limit",
  )
    .update(address)
    .digest("hex");
  if (!(await catalog.loginAttempt("quote-" + key)))
    throw new ApiError(
      "Recibimos varias solicitudes. Inténtalo de nuevo en 15 minutos.",
      429,
    );
  const now = new Date().toISOString();
  const quote = {
    ...fields,
    logo,
    status: "Nueva",
    reference:
      "SS-" +
      now.slice(0, 10).replaceAll("-", "") +
      "-" +
      fields.id.slice(0, 8).toUpperCase(),
    createdAt: now,
    updatedAt: now,
  };
  return quoteReceipt(await repository.save(quote, logoData));
}
