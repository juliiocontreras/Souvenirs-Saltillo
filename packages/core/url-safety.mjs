import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
export function isPublicAddress(address) {
  try {
    const parsed = ipaddr.parse(address);
    return !parsed.isIPv4MappedAddress?.() && parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export function assertPublicSupplierUrl(value) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\s\u0000-\u001f]/.test(value)
  )
    throw new Error("URL inválida");
  const u = new URL(value),
    host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !["80", "443"].includes(u.port))
  )
    throw new Error(
      "Usa una URL pública HTTP/HTTPS sin credenciales y puerto estándar.",
    );
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    (ipaddr.isValid(host) && !isPublicAddress(host))
  )
    throw new Error(
      "Las redes privadas y locales no son proveedores permitidos.",
    );
  u.hash = "";
  return u;
}
export async function resolvePublicSupplier(value, resolver = lookup) {
  const url = assertPublicSupplierUrl(value),
    hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(hostname)
    ? [
        {
          address: hostname,
          family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6,
        },
      ]
    : await resolver(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((item) => !isPublicAddress(item.address))
  )
    throw new Error("El proveedor resuelve a una red restringida.");
  return { url, addresses };
}
