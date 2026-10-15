import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_CATEGORY_NAMES,
  validateClassification,
} from "../packages/core/categories.mjs";
import {
  readStoreFilters,
  selectStoreProducts,
} from "../packages/core/storefront.mjs";
import { toPublicProduct } from "../packages/core/catalog.mjs";
import { MemoryCatalogRepository } from "../packages/core/repository.mjs";
import { updateProductClassification } from "../lib/catalog-service.mjs";

test("taxonomy accepts requested product families and prevents cross-category subcategories", () => {
  assert.ok(
    [
      "Oficina",
      "Equipaje",
      "Electrónica",
      "Deportes",
      "Cuidado personal",
      "Llaveros",
    ].every((name) => PRODUCT_CATEGORY_NAMES.includes(name)),
  );
  assert.deepEqual(
    validateClassification({ category: "Electrónica", subcategory: "Relojes" }),
    { category: "Electrónica", subcategory: "Relojes" },
  );
  assert.throws(() =>
    validateClassification({ category: "Oficina", subcategory: "Mochilas" }),
  );
  assert.throws(() => validateClassification({ category: "Inventada" }));
  assert.deepEqual(validateClassification({ category: "Llaveros" }), {
    category: "Llaveros",
    subcategory: "",
  });
});

test("subcategory links survive reload while invalid combinations are discarded", () => {
  const valid = readStoreFilters(
    new URLSearchParams("categoria=Equipaje&subcategoria=Mochilas&q=olivo"),
  );
  assert.equal(valid.subcategory, "Mochilas");
  assert.equal(valid.category, "Equipaje");
  assert.equal(
    readStoreFilters({ categoria: "Oficina", subcategoria: "Mochilas" })
      .subcategory,
    "",
  );
  assert.equal(readStoreFilters({ subcategoria: "Mochilas" }).subcategory, "");
});

test("catalog composes category, subtype, accents, search and personalization", () => {
  const products = [
    {
      id: "bag",
      title: "Modelo A",
      category: "Equipaje",
      subcategory: "Mochilas",
      personalizationSupported: true,
    },
    {
      id: "case",
      title: "Modelo B",
      category: "Equipaje",
      subcategory: "Fundas",
    },
    {
      id: "pen",
      title: "Modelo C",
      category: "Oficina",
      subcategory: "Plumas",
      personalizationSupported: true,
    },
  ];
  assert.deepEqual(
    selectStoreProducts(products, {
      category: "Equipaje",
      subcategory: "Mochilas",
    }).map((p) => p.id),
    ["bag"],
  );
  assert.deepEqual(
    selectStoreProducts(products, { query: "mochilas" }).map((p) => p.id),
    ["bag"],
  );
  assert.deepEqual(
    selectStoreProducts(products, { category: "Personalizados" }).map(
      (p) => p.id,
    ),
    ["bag", "pen"],
  );
  const publicProduct = toPublicProduct({
    ...products[0],
    supplierCost: 90,
    supplierUrl: "https://private.example",
  });
  assert.equal(publicProduct.subcategory, "Mochilas");
  assert.equal(publicProduct.supplierCost, undefined);
});

test("direct classification edits preserve commercial data and publication, and invalid edits are atomic", async () => {
  const repository = new MemoryCatalogRepository();
  const previous = await repository.saveProduct({
    id: "bag",
    category: "Regalos",
    status: "published",
    supplierCost: 100,
    publicPrice: 199,
    sourceKey: "stable",
    pricing: { marginPercent: 30 },
  });
  const result = await updateProductClassification(repository, "bag", {
    category: "Equipaje",
    subcategory: "Mochilas",
    status: "draft",
    supplierCost: 0,
  });
  for (const key of [
    "status",
    "supplierCost",
    "publicPrice",
    "sourceKey",
    "pricing",
  ])
    assert.deepEqual(result[key], previous[key]);
  await assert.rejects(
    updateProductClassification(repository, "bag", {
      category: "Oficina",
      subcategory: "Mochilas",
    }),
    { status: 422 },
  );
  assert.equal((await repository.getProduct("bag")).category, "Equipaje");
  await assert.rejects(
    updateProductClassification(repository, "__proto__", {
      category: "Oficina",
    }),
    { status: 404 },
  );
});
