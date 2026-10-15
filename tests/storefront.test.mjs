import test from "node:test";
import assert from "node:assert/strict";
import {
  readStoreFilters,
  selectStoreProducts,
  canSortByPrice,
  publicPriceLabel,
  deliveryLabel,
} from "../packages/core/storefront.mjs";

const products = [
  {
    id: "mug",
    title: "Taza de cerámica",
    description: "Con tu nombre",
    category: "Regalos",
    personalizationSupported: true,
    publicPrice: 299,
    currency: "MXN",
  },
  {
    id: "box",
    title: "Caja de regalo",
    description: "Detalles para tu equipo",
    category: "Empresas y eventos",
    publicPrice: 450,
    currency: "MXN",
  },
  {
    id: "candle",
    title: "Vela de algodón",
    description: "Aroma suave",
    category: "Regalos",
    publicPrice: null,
    currency: "MXN",
  },
];
test("search matches Spanish accents and multiple terms across title and description", () => {
  assert.deepEqual(
    selectStoreProducts(products, { query: "CERAMICA nombre" }).map(
      (p) => p.id,
    ),
    ["mug"],
  );
  assert.deepEqual(
    selectStoreProducts(products, { query: "equipo" }).map((p) => p.id),
    ["box"],
  );
});
test("personalizable gifts appear in the personalized collection without changing their stored category", () => {
  assert.deepEqual(
    selectStoreProducts(products, { category: "Personalizados" }).map(
      (p) => p.id,
    ),
    ["mug"],
  );
  assert.deepEqual(
    selectStoreProducts(products, {
      category: "Empresas y eventos",
      query: "taza",
    }),
    [],
  );
  assert.equal(products[0].category, "Regalos");
});
test("price sorting places missing prices last and never compares different currencies", () => {
  assert.deepEqual(
    selectStoreProducts(products, { sort: "price-high" }).map((p) => p.id),
    ["box", "mug", "candle"],
  );
  const mixed = [
    ...products,
    { id: "foreign", title: "Otro detalle", publicPrice: 20, currency: "USD" },
  ];
  assert.equal(canSortByPrice(mixed), false);
  assert.deepEqual(selectStoreProducts(mixed, { sort: "price-low" }), mixed);
  assert.equal(products[0].id, "mug");
});
test("shared URL filters reject unknown values and preserve Spanish category and query", () => {
  assert.deepEqual(
    readStoreFilters(
      new URLSearchParams(
        "categoria=Personalizados&q=cer%C3%A1mica&orden=name",
      ),
    ),
    {
      category: "Personalizados",
      subcategory: "",
      query: "cerámica",
      sort: "name",
    },
  );
  assert.deepEqual(
    readStoreFilters({
      categoria: "unknown",
      q: ["unexpected"],
      orden: "supplierCost",
    }),
    { category: "Todos", subcategory: "", query: "", sort: "recent" },
  );
});
test("public labels keep missing amounts and delivery unknown instead of inventing zero prices or dates", () => {
  assert.equal(
    publicPriceLabel({ publicPrice: null, currency: "MXN" }),
    "Precio por confirmar",
  );
  assert.equal(
    publicPriceLabel({ publicPrice: Infinity, currency: "MXN" }),
    "Precio por confirmar",
  );
  assert.match(
    publicPriceLabel({ publicPrice: 299, currency: "MXN" }),
    /299.*MXN/,
  );
  assert.equal(deliveryLabel({ deliveryDays: null }), "Entrega por confirmar");
  assert.equal(
    deliveryLabel({ deliveryMinDays: 3, deliveryDays: 5 }),
    "Entrega estimada: 3–5 días",
  );
  assert.equal(
    deliveryLabel({ deliveryMinDays: 1, deliveryDays: 1 }),
    "Entrega estimada: 1 día",
  );
});
