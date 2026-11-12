// Dominio del checkout con Stripe: validación del carrito contra el catálogo
// publicado, construcción de la sesión de Checkout y del pedido que registra
// el webhook. Sin dependencias de Next.js ni de la red: todo es testeable con
// node --test y con un cliente de Stripe inyectado (ver lib/checkout-service.mjs).
import { randomUUID } from "node:crypto";
import { formatMxnCents, pesosToCents } from "./cart.mjs";

export { formatMxnCents, pesosToCents };
export const CURRENCY = "MXN";

// SUPUESTO — IVA INCLUIDO: los precios del catálogo (publicPrice) ya incluyen
// IVA; el checkout no agrega ninguna línea de impuesto. Si Julio decide
// desglosar el IVA, aquí es donde cambia: poner TAX_INCLUDED en false y
// agregar la línea correspondiente en buildCheckoutLineItems / Stripe Tax.
// Ver docs/checkout.md.
export const TAX_INCLUDED = true;

// SUPUESTO — ENVÍO POR CONFIRMAR: tarifa plana de envío a todo México.
// Valor por defecto $150 MXN (15000 centavos). Julio aún no confirma la
// tarifa; se puede cambiar sin tocar código con la variable de entorno
// SHIPPING_FLAT_RATE_MXN_CENTS (centavos). Ver docs/checkout.md.
export const DEFAULT_SHIPPING_FLAT_RATE_MXN_CENTS = 15000;

export const DELIVERY_METHODS = {
  pickup: {
    id: "pickup",
    label: "Recoger en Saltillo",
    description: "Recoges tu pedido en Saltillo, sin costo de envío.",
  },
  shipping: {
    id: "shipping",
    label: "Envío a todo México",
    description: "Envío a domicilio a cualquier parte de México.",
  },
};

export const ORDER_STATUSES = ["paid"];
export const ORDER_STATUS_LABELS = { paid: "Pagado" };

export function shippingFlatRateCents(env = process.env) {
  const raw = env?.SHIPPING_FLAT_RATE_MXN_CENTS;
  if (raw === undefined || raw === null || String(raw).trim() === "")
    return DEFAULT_SHIPPING_FLAT_RATE_MXN_CENTS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 10000000)
    return DEFAULT_SHIPPING_FLAT_RATE_MXN_CENTS;
  return value;
}

function validRequestedLine(line) {
  return (
    line &&
    typeof line === "object" &&
    !Array.isArray(line) &&
    typeof line.id === "string" &&
    line.id.trim().length > 0 &&
    line.id.length <= 128 &&
    Number.isInteger(line.qty) &&
    line.qty >= 1 &&
    line.qty <= 99
  );
}

// El navegador envía solo identificadores y cantidades. Cualquier precio,
// descuento o total que venga del cliente se ignora por diseño.
export function validateCartRequest(items) {
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("El carrito está vacío.");
  if (items.length > 50)
    throw new Error("El carrito admite hasta 50 artículos distintos.");
  if (!items.every(validRequestedLine))
    throw new Error("El carrito contiene artículos inválidos.");
  const seen = new Set();
  for (const { id } of items) {
    if (seen.has(id)) throw new Error("El carrito tiene artículos repetidos.");
    seen.add(id);
  }
  return items.map(({ id, qty }) => ({ id, qty }));
}

// Revalida el carrito contra el catálogo PUBLICADO: solo productos con
// status "published", precio numérico mayor que cero y moneda MXN. Un precio
// manipulado en el navegador nunca llega a Stripe porque aquí se recalcula
// todo desde publicPrice.
export function resolveCartItems(requested, publicProducts) {
  const byId = new Map(
    (publicProducts || []).map((product) => [product.id, product]),
  );
  const problems = [],
    lines = [];
  for (const { id, qty } of requested) {
    const product = byId.get(id);
    if (!product) {
      problems.push("Producto no disponible.");
      continue;
    }
    if (
      typeof product.publicPrice !== "number" ||
      !Number.isFinite(product.publicPrice) ||
      product.publicPrice <= 0
    ) {
      problems.push(`“${product.title}” aún no tiene precio de venta.`);
      continue;
    }
    if (product.currency !== CURRENCY) {
      problems.push(`“${product.title}” no está en MXN.`);
      continue;
    }
    const unitPriceCents = pesosToCents(product.publicPrice);
    lines.push({
      id: product.id,
      title: product.title,
      image: product.images?.[0] || null,
      unitPriceCents,
      quantity: qty,
      lineTotalCents: unitPriceCents * qty,
    });
  }
  if (problems.length)
    throw new Error(
      "No se pudo completar la compra: " + [...new Set(problems)].join(" "),
    );
  return lines;
}

export function cartSubtotalCents(lines) {
  return lines.reduce((total, line) => total + line.lineTotalCents, 0);
}

export function buildCheckoutLineItems(lines) {
  return lines.map((line) => ({
    price_data: {
      currency: CURRENCY.toLowerCase(),
      unit_amount: line.unitPriceCents,
      product_data: {
        name: line.title,
        metadata: { productId: line.id },
      },
    },
    quantity: line.quantity,
  }));
}

// Dos opciones de entrega en la misma sesión de Checkout. Stripe cobra la
// dirección solo cuando el cliente elige envío: el panel de Checkout pide
// la dirección únicamente para la opción con costo, y
// shipping_address_collection limita el destino a México.
export function buildShippingOptions(flatRateCents) {
  return [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: 0, currency: CURRENCY.toLowerCase() },
        display_name: DELIVERY_METHODS.pickup.label,
        delivery_estimate: {
          minimum: { unit: "business_day", value: 1 },
          maximum: { unit: "business_day", value: 3 },
        },
      },
    },
    {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: {
          amount: flatRateCents,
          currency: CURRENCY.toLowerCase(),
        },
        display_name: DELIVERY_METHODS.shipping.label,
        delivery_estimate: {
          minimum: { unit: "business_day", value: 2 },
          maximum: { unit: "business_day", value: 7 },
        },
      },
    },
  ];
}

export function deliveryMethodFromSession(session) {
  const shippingTotal = session?.shipping_cost?.amount_total;
  return typeof shippingTotal === "number" && shippingTotal > 0
    ? "shipping"
    : "pickup";
}

function stripeLineItemSnapshot(item) {
  const product =
    item?.price?.product && typeof item.price.product === "object"
      ? item.price.product
      : null;
  const unitPriceCents =
    typeof item?.price?.unit_amount === "number"
      ? item.price.unit_amount
      : typeof item?.amount_total === "number" && item?.quantity
        ? Math.round(item.amount_total / item.quantity)
        : 0;
  return {
    id: product?.metadata?.productId || product?.id || item?.description || "",
    title: item?.description || product?.name || "Artículo",
    unitPriceCents,
    quantity: item?.quantity || 0,
    lineTotalCents:
      typeof item?.amount_total === "number"
        ? item.amount_total
        : unitPriceCents * (item?.quantity || 0),
  };
}

export function snapshotStripeLineItems(stripeLineItems) {
  return (stripeLineItems || []).map(stripeLineItemSnapshot);
}

// Construye el pedido a partir de la sesión completada de Stripe. El total
// es el que cobró Stripe (amount_total, en centavos); el snapshot de
// artículos viene de checkout.sessions.list. existingId permite que un
// reintento del webhook actualice el mismo pedido en lugar de duplicarlo.
export function buildOrderFromSession(session, lineItems, existingId = null) {
  const now = new Date().toISOString();
  return {
    id: existingId || randomUUID(),
    stripeSessionId: session?.id || "",
    stripePaymentIntent:
      typeof session?.payment_intent === "string"
        ? session.payment_intent
        : session?.payment_intent?.id || null,
    status: "paid",
    totalCents:
      typeof session?.amount_total === "number" ? session.amount_total : 0,
    currency: (session?.currency || CURRENCY).toUpperCase(),
    items: lineItems || [],
    customer: {
      name: session?.customer_details?.name || null,
      email: session?.customer_details?.email || null,
    },
    shipping: session?.shipping_details
      ? {
          name: session.shipping_details.name || null,
          address: session.shipping_details.address || null,
        }
      : null,
    deliveryMethod: deliveryMethodFromSession(session),
    createdAt: now,
    updatedAt: now,
  };
}

export function orderReceipt(order) {
  return { ...order };
}
