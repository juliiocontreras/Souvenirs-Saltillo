// Orquesta el checkout y el webhook de Stripe. Las dependencias se inyectan
// (repositorio, cliente de Stripe) para probar sin llamar a la API real.
// El navegador nunca fija precios: createCheckoutSession revalida el carrito
// contra el catálogo publicado antes de crear la sesión.
import { ApiError } from "./admin-auth.mjs";
import { catalogRepository } from "./catalog-store.mjs";
import { orderRepository } from "./order-store.mjs";
import { getStripeClient } from "./stripe-client.mjs";
import {
  validateCartRequest,
  resolveCartItems,
  buildCheckoutLineItems,
  buildShippingOptions,
  shippingFlatRateCents,
  buildOrderFromSession,
  snapshotStripeLineItems,
} from "../packages/core/orders.mjs";

export async function createCheckoutSession({
  items,
  origin,
  repository = catalogRepository,
  stripe = null,
} = {}) {
  let requested;
  try {
    requested = validateCartRequest(items);
  } catch (error) {
    throw new ApiError(error.message, 422);
  }
  let lines;
  try {
    lines = resolveCartItems(requested, await repository.listPublicProducts());
  } catch (error) {
    throw new ApiError(error.message, 422);
  }
  const session = await (stripe || getStripeClient()).checkout.sessions.create({
    mode: "payment",
    line_items: buildCheckoutLineItems(lines),
    shipping_options: buildShippingOptions(shippingFlatRateCents()),
    shipping_address_collection: { allowed_countries: ["MX"] },
    success_url: origin + "/checkout/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/checkout/cancel",
    metadata: { source: "souvenirs-saltillo" },
  });
  if (!session?.url)
    throw new ApiError("Stripe no devolvió una página de pago.", 503);
  return { url: session.url, sessionId: session.id };
}

// Idempotencia en dos niveles: el ID de evento de Stripe se registra una
// sola vez (recordStripeEvent), y el pedido se busca por stripeSessionId
// antes de crearse, así que un reintento del webhook actualiza el mismo
// pedido en lugar de duplicarlo. El evento se registra después de procesar:
// si el proceso falla, Stripe reintentará y el evento se procesará entonces.
export async function handleStripeWebhook({
  rawBody,
  signature,
  stripe = null,
  orders = orderRepository,
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
} = {}) {
  if (!webhookSecret)
    throw new ApiError(
      "El webhook de Stripe aún no está configurado en el servidor.",
      503,
    );
  // El cliente se construye después de validar el secreto: sin
  // STRIPE_SECRET_KEY el error debe decir que falta la clave, no que la
  // firma es inválida.
  const client = stripe || getStripeClient();
  let event;
  try {
    event = client.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new ApiError("Firma del webhook inválida.", 400);
  }
  if (await orders.hasStripeEvent(event.id))
    return { eventId: event.id, type: event.type, duplicate: true };
  let order = null;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const lineItems = await client.checkout.sessions.list(session.id, {
      expand: ["data.price.product"],
    });
    const existing = await orders.getOrderBySession(session.id);
    order = await orders.saveOrder(
      buildOrderFromSession(
        session,
        snapshotStripeLineItems(lineItems?.data),
        existing?.id || null,
      ),
    );
  }
  await orders.recordStripeEvent(event.id, event.type);
  return {
    eventId: event.id,
    type: event.type,
    orderId: order?.id || null,
    duplicate: false,
  };
}
