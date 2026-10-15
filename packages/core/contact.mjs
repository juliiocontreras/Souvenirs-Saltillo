export function whatsappContactUrl(
  number,
  { category = "Todos", subcategory = "" } = {},
) {
  if (typeof number !== "string" || !/^[+\d\s().-]+$/.test(number)) return null;
  const digits = number.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  const selection = [category === "Todos" ? "souvenirs" : category, subcategory]
    .filter(Boolean)
    .join(" · ");
  const text = `Hola, me gustaría recibir información y opciones de ${selection} en Souvenirs Saltillo.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
