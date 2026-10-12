export function nullableNumber(value) {
  if (
    !["string", "number"].includes(typeof value) ||
    (typeof value === "string" && (!value.trim() || value.length > 64))
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : null;
}
export function normalizeSupplierProduct(raw) {
  const internal = {
    supplierUrl: raw.supplierUrl || "",
    supplierCost: nullableNumber(raw.cost),
  };
  const product = {
    title: String(raw.title || "").trim(),
    description: String(raw.description || "").trim(),
    supplierCost: internal.supplierCost,
    deliveryDays: nullableNumber(raw.deliveryDays),
    images: Array.isArray(raw.images) ? raw.images.filter(Boolean) : [],
  };
  return {
    ...product,
    internal,
    public: {
      title: product.title,
      description: product.description,
      deliveryDays: product.deliveryDays,
      images: product.images,
    },
  };
}
export function identityKey(p) {
  return [
    p.gtin,
    p.sku,
    p.mpn,
    p.variant,
    p.gtin || p.sku || p.mpn ? "" : p.title,
  ]
    .map((x) =>
      String(x || "")
        .trim()
        .toLowerCase(),
    )
    .join("|");
}
export function sameSupplierIdentity(a, b) {
  return identityKey(a) === identityKey(b);
}
export function alternativeIdentity(a, b) {
  const original = a.sourceOriginal || a;
  a = {
    ...original,
    gtin: a.gtin || original.gtin,
    brand: a.brand || original.brand,
    mpn: a.mpn || original.mpn,
    variant: a.variant || original.variant,
  };
  if (a.gtin && b.gtin)
    return a.gtin === b.gtin && (a.variant || "") === (b.variant || "");
  return Boolean(
    a.brand &&
      a.mpn &&
      String(a.brand).toLowerCase() === String(b.brand || "").toLowerCase() &&
      a.mpn === b.mpn &&
      (a.variant || "") === (b.variant || ""),
  );
}
