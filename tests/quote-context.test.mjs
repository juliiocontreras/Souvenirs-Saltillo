import test from "node:test";
import assert from "node:assert/strict";
import { quoteSelection, applyQuoteSelection } from "../packages/core/quote-context.mjs";

test("quote context accepts public title and valid classification without supplier details", () => {
  const selection = quoteSelection({
    category: "Equipaje", subcategory: "Mochilas", productTitle: " Mochila de prueba ",
    supplierCost: 10, supplierUrl: "https://supplier.example.test/private",
  });
  assert.deepEqual(selection, {
    category: "Equipaje", subcategory: "Mochilas",
    description: "Me interesa cotizar: Mochila de prueba.", label: "Mochila de prueba",
  });
  assert.equal(quoteSelection({ category: "Oficina", subcategory: "Mochilas" }).subcategory, "");
  assert.equal(quoteSelection({ category: "Personalizados" }).category, "");
  assert.equal(quoteSelection(null).label, "");
});

test("changing selection preserves contact, order requirements and id while requiring renewed consent", () => {
  const draft = {
    id: "same-draft", name: "Cliente", email: "cliente@example.test",
    category: "Oficina", subcategory: "Plumas", description: "Color beige y bordado dorado",
    quantity: 50, deliveryDate: "2099-12-01", invoice: "Sí", consent: true,
  };
  const selection = quoteSelection({ category: "Equipaje", subcategory: "Mochilas", productTitle: "Mochila de prueba" });
  const merged = applyQuoteSelection(draft, selection);
  assert.deepEqual(merged, {
    ...draft, category: "Equipaje", subcategory: "Mochilas", consent: false,
    description: "Me interesa cotizar: Mochila de prueba.\n\nColor beige y bordado dorado",
  });
  assert.deepEqual(applyQuoteSelection(merged, selection), merged);
  assert.equal(draft.consent, true);
  assert.equal(applyQuoteSelection(draft, quoteSelection()).category, "Oficina");
});

test("an additional product never truncates a customer's existing requirements", () => {
  const draft = { description: "a".repeat(2000), category: "Oficina", subcategory: "Libretas" };
  assert.throws(() => applyQuoteSelection(draft, quoteSelection({ productTitle: "Mochila" })), /Reduce la descripción/);
  assert.equal(draft.description.length, 2000);
});
