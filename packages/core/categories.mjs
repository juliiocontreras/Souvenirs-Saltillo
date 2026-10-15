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
  {
    name: "Tazas y termos",
    subcategories: ["Tazas", "Termos", "Vasos", "Cilindros", "Tarros"],
  },
  {
    name: "Textiles y gorras",
    subcategories: ["Playeras", "Polos", "Sudaderas", "Gorras", "Sombreros"],
  },
  {
    name: "Hogar y cocina",
    subcategories: [
      "Mandiles",
      "Utensilios",
      "Tablas",
      "Portavasos",
      "Decoración",
    ],
  },
  {
    name: "Ecológicos",
    subcategories: ["Bambú", "Materiales reciclados", "Reutilizables"],
  },
  {
    name: "Herramientas y automotriz",
    subcategories: [
      "Multiherramientas",
      "Flexómetros",
      "Desarmadores",
      "Accesorios para auto",
    ],
  },
  {
    name: "Paraguas e impermeables",
    subcategories: ["Paraguas", "Sombrillas", "Impermeables"],
  },
  {
    name: "Infantiles y juegos",
    subcategories: ["Juguetes", "Peluches", "Juegos", "Escolares"],
  },
  {
    name: "Hieleras y loncheras",
    subcategories: ["Hieleras", "Loncheras", "Portaviandas"],
  },
  {
    name: "Bar y vinos",
    subcategories: ["Sacacorchos", "Destapadores", "Accesorios para vino"],
  },
  {
    name: "Mascotas",
    subcategories: [
      "Collares",
      "Correas",
      "Platos",
      "Accesorios para mascotas",
    ],
  },
  {
    name: "Sets de regalo",
    subcategories: ["Kits de bienvenida", "Sets ejecutivos", "Cajas de regalo"],
  },
  {
    name: "Souvenirs de Saltillo",
    subcategories: ["Imanes", "Postales", "Artesanías", "Recuerdos regionales"],
  },
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
