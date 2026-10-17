import { PRODUCT_CATEGORY_NAMES, subcategoriesFor, classificationLabel } from "./categories.mjs";

// Only public product information and valid classifications enter a quote draft.
export function quoteSelection(context = {}) {
  const category = PRODUCT_CATEGORY_NAMES.includes(context?.category) ? context.category : "";
  const subcategory = subcategoriesFor(category).includes(context?.subcategory) ? context.subcategory : "";
  const title = typeof context?.productTitle === "string" ? context.productTitle.trim().slice(0, 300) : "";
  return {
    category,
    subcategory,
    description: title ? `Me interesa cotizar: ${title}.` : "",
    label: title || (category ? classificationLabel({ category, subcategory }) : ""),
  };
}

export function applyQuoteSelection(draft, selection) {
  const existing = draft.description || "";
  const description = selection.description && !existing.includes(selection.description)
    ? [selection.description, existing].filter(Boolean).join("\n\n")
    : existing;
  if (description.length > 2000)
    throw new Error("Tu pedido ya tiene muchos detalles. Reduce la descripción antes de añadir este artículo.");
  return {
    ...draft,
    category: selection.category || draft.category,
    subcategory: selection.category ? selection.subcategory : draft.subcategory,
    description,
    consent: false,
  };
}
