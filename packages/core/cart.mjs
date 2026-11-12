// Carrito del storefront: lógica pura, sin DOM ni React, para poder probarla
// con node --test y reutilizarla en el navegador. El carrito guarda solo
// identificadores y cantidades; los precios siempre se resuelven en el
// servidor contra el catálogo publicado (ver packages/core/orders.mjs).
export const CART_STORAGE_KEY = "souvenirs-cart-v1";
export const MAX_CART_LINES = 50;
export const MAX_QUANTITY = 99;

export function formatMxnCents(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
}

// Pesos decimales del catálogo (publicPrice) a centavos enteros para Stripe.
export function pesosToCents(pesos) {
  if (typeof pesos !== "number" || !Number.isFinite(pesos) || pesos < 0)
    throw new Error("Precio inválido.");
  const cents = Math.round(pesos * 100);
  if (!Number.isSafeInteger(cents) || cents > 100000000)
    throw new Error("Precio fuera del rango admitido.");
  return cents;
}

function validLine(line) {
  return (
    line &&
    typeof line === "object" &&
    !Array.isArray(line) &&
    typeof line.id === "string" &&
    line.id.trim().length > 0 &&
    line.id.length <= 128 &&
    Number.isInteger(line.qty) &&
    line.qty >= 1 &&
    line.qty <= MAX_QUANTITY
  );
}

export function emptyCart() {
  return [];
}

export function parseCart(value) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set(),
    cart = [];
  for (const line of parsed) {
    if (!validLine(line) || seen.has(line.id)) continue;
    seen.add(line.id);
    cart.push({ id: line.id, qty: line.qty });
    if (cart.length >= MAX_CART_LINES) break;
  }
  return cart;
}

export function serializeCart(cart) {
  return JSON.stringify(parseCart(cart));
}

export function cartItemCount(cart) {
  return parseCart(cart).reduce((total, line) => total + line.qty, 0);
}

export function addToCart(cart, id, qty = 1) {
  const lines = parseCart(cart);
  if (typeof id !== "string" || !id.trim() || id.length > 128)
    throw new Error("Producto inválido.");
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY)
    throw new Error("La cantidad debe ser entre 1 y 99.");
  const existing = lines.find((line) => line.id === id);
  if (existing) {
    existing.qty = Math.min(MAX_QUANTITY, existing.qty + qty);
    return lines;
  }
  if (lines.length >= MAX_CART_LINES)
    throw new Error("El carrito admite hasta 50 artículos distintos.");
  return [...lines, { id, qty }];
}

export function setCartQuantity(cart, id, qty) {
  const lines = parseCart(cart);
  if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QUANTITY)
    throw new Error("La cantidad debe ser entre 0 y 99.");
  if (qty === 0) return lines.filter((line) => line.id !== id);
  const existing = lines.find((line) => line.id === id);
  if (!existing) throw new Error("Ese artículo no está en el carrito.");
  existing.qty = qty;
  return lines;
}

export function removeFromCart(cart, id) {
  return parseCart(cart).filter((line) => line.id !== id);
}
