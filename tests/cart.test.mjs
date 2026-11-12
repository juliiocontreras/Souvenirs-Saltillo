import test from "node:test";
import assert from "node:assert/strict";
import {
  CART_STORAGE_KEY,
  parseCart,
  serializeCart,
  addToCart,
  setCartQuantity,
  removeFromCart,
  cartItemCount,
  formatMxnCents,
  pesosToCents,
} from "../packages/core/cart.mjs";

test("cart adds lines, merges duplicates and caps quantity at 99", () => {
  assert.deepEqual(addToCart([], "p1"), [{ id: "p1", qty: 1 }]);
  assert.deepEqual(addToCart([{ id: "p1", qty: 2 }], "p1", 3), [
    { id: "p1", qty: 5 },
  ]);
  assert.deepEqual(addToCart([{ id: "p1", qty: 98 }], "p1", 5), [
    { id: "p1", qty: 99 },
  ]);
  assert.deepEqual(addToCart([], "p1", 99), [{ id: "p1", qty: 99 }]);
  assert.throws(() => addToCart([], "p1", 0), /cantidad/);
  assert.throws(() => addToCart([], "p1", 100), /cantidad/);
  assert.throws(() => addToCart([], "p1", 1.5), /cantidad/);
  assert.throws(() => addToCart([], "", 1), /inválido/);
});

test("cart setQuantity updates and removes at zero", () => {
  const cart = [
    { id: "p1", qty: 2 },
    { id: "p2", qty: 1 },
  ];
  assert.deepEqual(setCartQuantity(cart, "p1", 5), [
    { id: "p1", qty: 5 },
    { id: "p2", qty: 1 },
  ]);
  assert.deepEqual(setCartQuantity(cart, "p1", 0), [{ id: "p2", qty: 1 }]);
  assert.throws(() => setCartQuantity(cart, "p1", 100), /cantidad/);
  assert.throws(() => setCartQuantity(cart, "p3", 1), /no está en el carrito/);
});

test("cart removeFromCart drops only the chosen line", () => {
  const cart = [
    { id: "p1", qty: 2 },
    { id: "p2", qty: 1 },
  ];
  assert.deepEqual(removeFromCart(cart, "p1"), [{ id: "p2", qty: 1 }]);
  assert.deepEqual(removeFromCart(cart, "p3"), cart);
});

test("cart counts total units", () => {
  assert.equal(cartItemCount([]), 0);
  assert.equal(
    cartItemCount([
      { id: "p1", qty: 2 },
      { id: "p2", qty: 3 },
    ]),
    5,
  );
});

test("cart parse tolerates corrupt or hostile localStorage", () => {
  assert.deepEqual(parseCart("not json"), []);
  assert.deepEqual(parseCart(null), []);
  assert.deepEqual(parseCart({ id: "p1" }), []);
  assert.deepEqual(
    parseCart(
      JSON.stringify([
        { id: "p1", qty: 2 },
        { id: "p1", qty: 3 },
        { id: "", qty: 1 },
        { id: "p2", qty: 0 },
        { id: "p3", qty: 1.5 },
        { id: "p4", qty: 1 },
      ]),
    ),
    [
      { id: "p1", qty: 2 },
      { id: "p4", qty: 1 },
    ],
  );
  assert.equal(parseCart([]).length, 0);
  assert.equal(CART_STORAGE_KEY, "souvenirs-cart-v1");
});

test("cart serialize round-trips through localStorage", () => {
  const cart = [
    { id: "p1", qty: 2 },
    { id: "p2", qty: 1 },
  ];
  assert.deepEqual(parseCart(serializeCart(cart)), cart);
  assert.equal(serializeCart([{ id: "p1", qty: 2, price: 1 }]), `[{"id":"p1","qty":2}]`);
});

test("pesosToCents converts catalog pesos to Stripe cents", () => {
  assert.equal(pesosToCents(299.5), 29950);
  assert.equal(pesosToCents(150), 15000);
  assert.equal(pesosToCents(0), 0);
  assert.equal(pesosToCents(19.99), 1999);
  assert.throws(() => pesosToCents(-1), /inválido/);
  assert.throws(() => pesosToCents("100"), /inválido/);
  assert.throws(() => pesosToCents(Number.NaN), /inválido/);
});

test("formatMxnCents renders MXN for the storefront", () => {
  assert.equal(formatMxnCents(29950), "$299.50");
  assert.equal(formatMxnCents(15000), "$150.00");
});
