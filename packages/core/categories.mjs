export const PRODUCT_CATEGORIES = [
  { name: "Oficina", subcategories: ["Plumas", "Agendas", "Libretas"] },
  {
    name: "Equipaje",
    subcategories: ["Mochilas", "Bolsas", "Maletas", "Maletines", "Fundas"],
  },
  {
    name: "Electrónica",
    subcategories: ["Cables", "USB", "Cargadores", "Relojes", "Linternas"],
  },
  { name: "Deportes", subcategories: [] },
  { name: "Cuidado personal", subcategories: [] },
  { name: "Llaveros", subcategories: [] },
];

// Retain existing classifications and occasion links without migrating products.
export const LEGACY_CATEGORIES = [
  "Regalos",
  "Personalizados",
  "Empresas y eventos",
];
export const PRODUCT_CATEGORY_NAMES = PRODUCT_CATEGORIES.map(
  ({ name }) => name,
);
export const ACCEPTED_CATEGORIES = [
  ...PRODUCT_CATEGORY_NAMES,
  ...LEGACY_CATEGORIES,
];

export function subcategoriesFor(category) {
  return (
    PRODUCT_CATEGORIES.find(({ name }) => name === category)?.subcategories ||
    []
  );
}

export function validateClassification({ category, subcategory = "" }) {
  if (!ACCEPTED_CATEGORIES.includes(category)) {
    throw new Error("Selecciona una categoría válida.");
  }
  if (
    typeof subcategory !== "string" ||
    (subcategory !== "" && !subcategoriesFor(category).includes(subcategory))
  ) {
    throw new Error(
      "La subcategoría no pertenece a la categoría seleccionada.",
    );
  }
  return { category, subcategory };
}

export function classificationLabel(product) {
  return [product.category || "Regalos", product.subcategory]
    .filter(Boolean)
    .join(" · ");
}
