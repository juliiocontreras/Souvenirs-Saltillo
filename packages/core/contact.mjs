export function normalizeWhatsappNumber(number) {
  if (typeof number !== "string" || number.length > 64) return null;
  if (!number.trim()) return "";
  if (!/^\+?[\d\s().-]+$/.test(number.trim())) return null;
  const digits = number.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function validateContactSettings(input) {
  const number = normalizeWhatsappNumber(input?.whatsappNumber);
  if (
    !input ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => key !== "whatsappNumber") ||
    number === null
  ) {
    const error = new Error(
      "Escribe un teléfono válido con código de país (8 a 15 dígitos), o deja el campo vacío para desactivar el enlace.",
    );
    error.status = 422;
    throw error;
  }
  return { whatsappNumber: number };
}

export function resolveContactSettings(saved = null, fallbackNumber = "") {
  return {
    whatsappNumber:
      normalizeWhatsappNumber(saved === null ? fallbackNumber : saved.whatsappNumber) || "",
    updatedAt: saved?.updatedAt || null,
  };
}

export function whatsappContactUrl(
  number,
  { category = "Todos", subcategory = "" } = {},
) {
  const digits = normalizeWhatsappNumber(number);
  if (!digits) return null;
  const selection = [category === "Todos" ? "souvenirs" : category, subcategory]
    .filter(Boolean)
    .join(" · ");
  const text = `Hola, me gustaría recibir información y opciones de ${selection} en Souvenirs Saltillo.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
