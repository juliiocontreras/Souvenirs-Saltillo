export function toPublicProduct(p) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: p.category || "Regalos",
    subcategory: p.subcategory || "",
    publicPrice: p.publicPrice ?? null,
    currency: p.currency ?? null,
    images: p.images || [],
    deliveryDays: p.deliveryDays ?? null,
    deliveryMinDays: p.deliveryMinDays ?? null,
    personalizationSupported: Boolean(p.personalizationSupported),
    stockStatus: p.stockStatus || "unknown",
  };
}
export function findAlternativeQuery(p) {
  return String(
    p.gtin ||
      (p.mpn && [p.brand, p.mpn].filter(Boolean).join(" ")) ||
      p.sku ||
      p.title ||
      "",
  ).trim();
}
