import { PRODUCT_CATEGORY_NAMES, subcategoriesFor } from "./categories.mjs";

export const QUOTE_STATUSES = [
  "Nueva",
  "En seguimiento",
  "Cotizada",
  "Cerrada",
];
export const QUOTE_CONSENT_VERSION = "2026-10-15";
export const LOGO_MAX_BYTES = 1024 * 1024;
export const validQuoteId = (id) =>
  typeof id === "string" &&
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id);
export const mexicoToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export function validateQuote(input, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Solicitud inválida.");
  const text = (key, max, required = false) => {
    const value = input[key] ?? "";
    if (
      typeof value !== "string" ||
      value.trim().length > max ||
      (required && !value.trim())
    )
      throw new Error("Revisa el campo " + key + ".");
    return value.trim();
  };
  const choice = (key, options) => {
    const value = text(key, 80, true);
    if (!options.includes(value))
      throw new Error("Revisa la opción de " + key + ".");
    return value;
  };
  if (!validQuoteId(input.id))
    throw new Error("Identificador de solicitud inválido.");
  if (input.consent !== true)
    throw new Error("Autoriza el uso de tus datos para atender la cotización.");
  const name = text("name", 120, true),
    company = text("company", 160);
  const preferredContact = choice("preferredContact", [
    "WhatsApp",
    "Correo",
    "Teléfono",
  ]);
  const phone = text("phone", 40),
    email = text("email", 180);
  if (
    (phone &&
      (!/^[+\d\s().-]+$/.test(phone) ||
        phone.replace(/\D/g, "").length < 8 ||
        phone.replace(/\D/g, "").length > 15)) ||
    (preferredContact !== "Correo" && !phone)
  )
    throw new Error("Agrega un teléfono válido con lada.");
  if (
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    (preferredContact === "Correo" && !email)
  )
    throw new Error("Agrega un correo válido.");
  const category = text("category", 80),
    subcategory = text("subcategory", 80);
  if (category && !PRODUCT_CATEGORY_NAMES.includes(category))
    throw new Error("Selecciona una categoría válida.");
  if (subcategory && !subcategoriesFor(category).includes(subcategory))
    throw new Error("La subcategoría no pertenece a tu pedido.");
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 100000
  )
    throw new Error("Indica una cantidad entre 1 y 100,000 piezas.");
  const description = text("description", 2000, true);
  const budget = text("budget", 160),
    location = text("location", 180, true);
  const logoStatus = choice("logoStatus", [
    "Tengo un logo",
    "Necesito ayuda con el diseño",
    "Sin logo",
    "Por definir",
  ]);
  const urgency = choice("urgency", ["Normal", "Urgente", "Lo antes posible"]);
  const invoice = choice("invoice", ["Sí", "No", "Por definir"]);
  const deliveryDate = text("deliveryDate", 10);
  const deliveryFlexible = input.deliveryFlexible === true;
  if (!deliveryDate && !deliveryFlexible)
    throw new Error("Indica la fecha de entrega o marca que está por definir.");
  if (
    deliveryDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
      Number.isNaN(Date.parse(deliveryDate)) ||
      new Date(deliveryDate).toISOString().slice(0, 10) !== deliveryDate ||
      deliveryDate < mexicoToday(now))
  )
    throw new Error("Revisa la fecha de entrega; debe ser hoy o posterior.");
  return {
    id: input.id,
    name,
    company,
    preferredContact,
    phone,
    email,
    category,
    subcategory,
    quantity: input.quantity,
    description,
    budget,
    location,
    logoStatus,
    urgency,
    invoice,
    deliveryDate,
    deliveryFlexible: !deliveryDate && deliveryFlexible,
    consent: true,
    consentVersion: QUOTE_CONSENT_VERSION,
  };
}

export function validateLogo(bytes, name = "logo") {
  if (!bytes || bytes.length === 0 || bytes.length > LOGO_MAX_BYTES)
    throw new Error("El logo debe pesar hasta 1 MB.");
  let type;
  const head = Buffer.from(bytes);
  if (
    head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    type = "image/png";
  else if (head[0] === 255 && head[1] === 216 && head[2] === 255)
    type = "image/jpeg";
  else if (
    head.subarray(0, 4).toString() === "RIFF" &&
    head.subarray(8, 12).toString() === "WEBP"
  )
    type = "image/webp";
  else if (head.subarray(0, 5).toString() === "%PDF-") type = "application/pdf";
  else throw new Error("Adjunta un logo PNG, JPG, WebP o PDF.");
  return {
    name:
      String(name)
        .replace(/[\x00-\x1f\x7f/\\]/g, "")
        .slice(0, 120) || "logo",
    type,
    size: head.length,
  };
}

export function quoteReceipt(quote) {
  return {
    id: quote.id,
    reference: quote.reference,
    createdAt: quote.createdAt,
  };
}
