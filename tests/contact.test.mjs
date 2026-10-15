import test from "node:test";
import assert from "node:assert/strict";
import { whatsappContactUrl } from "../packages/core/contact.mjs";

test("WhatsApp contact links use the configured business number and preserve category context", () => {
  const url = new URL(
    whatsappContactUrl("+1 (202) 555-0123", {
      category: "Hogar y cocina",
      subcategory: "Decoración",
    }),
  );
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/12025550123");
  assert.match(url.searchParams.get("text"), /Hogar y cocina · Decoración/);
  assert.match(url.searchParams.get("text"), /Souvenirs Saltillo/);
});

test("missing or invalid contact configuration never creates a fake WhatsApp destination", () => {
  for (const number of [
    undefined,
    "",
    "123",
    "javascript:12025550123",
    "0".repeat(12),
    "1".repeat(16),
  ])
    assert.equal(whatsappContactUrl(number), null);
});
