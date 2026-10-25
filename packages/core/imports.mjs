// Small private inbox projection. Full supplier evidence is fetched only on open.
export function importSummary(draft) {
  const option = draft.options?.[draft.selection || 0] || {};
  const missing = [];
  if (!option.images?.length) missing.push("imagen");
  if (option.supplierCost === null || option.supplierCost === undefined) missing.push("costo");
  if (!option.currency) missing.push("moneda");
  if (option.deliveryDays === null || option.deliveryDays === undefined) missing.push("entrega");
  return {
    id: draft.id,
    title: option.title || "Producto sin título",
    createdAt: draft.createdAt,
    optionCount: draft.options?.length || 0,
    missing,
  };
}
