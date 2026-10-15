export const STORE_CATEGORIES = [
  "Todos",
  "Regalos",
  "Personalizados",
  "Empresas y eventos",
];
const sorts = new Set(["recent", "name", "price-low", "price-high"]);
const normalized = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-MX")
    .trim();

export function readStoreFilters(params = {}) {
  const get = (key) => {
    const value =
      typeof params.get === "function" ? params.get(key) : params[key];
    return typeof value === "string" ? value : "";
  };
  return {
    category: STORE_CATEGORIES.includes(get("categoria"))
      ? get("categoria")
      : "Todos",
    query: get("q").slice(0, 240),
    sort: sorts.has(get("orden")) ? get("orden") : "recent",
  };
}
export function categoryHref(category) {
  return (
    "/" +
    (category === "Todos" ? "" : "?categoria=" + encodeURIComponent(category)) +
    "#catalogo"
  );
}
function hasPrice(product) {
  return (
    typeof product.publicPrice === "number" &&
    Number.isFinite(product.publicPrice) &&
    product.publicPrice >= 0 &&
    /^[A-Z]{3}$/.test(product.currency || "")
  );
}
export function canSortByPrice(products) {
  return (
    new Set(products.filter(hasPrice).map((product) => product.currency))
      .size === 1
  );
}
export function selectStoreProducts(
  products,
  { category = "Todos", query = "", sort = "recent" },
) {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  const result = products.filter((product) => {
    const inCategory =
      category === "Todos" ||
      product.category === category ||
      (category === "Personalizados" && product.personalizationSupported);
    const text = normalized(
      [product.title, product.description, product.category].join(" "),
    );
    return inCategory && terms.every((term) => text.includes(term));
  });
  if (sort === "name")
    result.sort((a, b) => a.title.localeCompare(b.title, "es-MX"));
  if (
    (sort === "price-low" || sort === "price-high") &&
    canSortByPrice(result)
  ) {
    result.sort((a, b) => {
      if (!hasPrice(a)) return hasPrice(b) ? 1 : 0;
      if (!hasPrice(b)) return -1;
      return (a.publicPrice - b.publicPrice) * (sort === "price-low" ? 1 : -1);
    });
  }
  return result;
}
export function publicPriceLabel(product) {
  if (!hasPrice(product)) return "Precio por confirmar";
  try {
    return (
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: product.currency,
      }).format(product.publicPrice) +
      " " +
      product.currency
    );
  } catch {
    return "Precio por confirmar";
  }
}
export function deliveryLabel(product) {
  const max = product.deliveryDays,
    min = product.deliveryMinDays;
  if (!Number.isInteger(max) || max < 0) return "Entrega por confirmar";
  if (Number.isInteger(min) && min >= 0 && min < max)
    return `Entrega estimada: ${min}–${max} días`;
  return `Entrega estimada: ${max} ${max === 1 ? "día" : "días"}`;
}
