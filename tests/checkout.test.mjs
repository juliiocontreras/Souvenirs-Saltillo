import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCatalogRepository } from "../packages/core/repository.mjs";
import {
  validateCartRequest,
  resolveCartItems,
  buildCheckoutLineItems,
  buildShippingOptions,
  shippingFlatRateCents,
  deliveryMethodFromSession,
  buildOrderFromSession,
  DEFAULT_SHIPPING_FLAT_RATE_MXN_CENTS,
  TAX_INCLUDED,
} from "../packages/core/orders.mjs";
import {
  createCheckoutSession,
  handleStripeWebhook,
} from "../lib/checkout-service.mjs";
import { StateOrderRepository } from "../packages/core/order-repository.mjs";
import { ApiError } from "../lib/admin-auth.mjs";

async function catalogWith(products) {
  const repository = new MemoryCatalogRepository();
  for (const product of products) await repository.saveProduct(product);
  return repository;
}

const mug = {
  id: "p-mug",
  title: "Taza Saltillo",
  status: "published",
  publicPrice: 299.5,
  currency: "MXN",
  images: ["https://img.example.test/mug.webp"],
};
const keychain = {
  id: "p-key",
  title: "Llavero",
  status: "published",
  publicPrice: 89,
  currency: "MXN",
  images: [],
};

test("validateCartRequest rejects empty, malformed and duplicated carts", () => {
  assert.deepEqual(validateCartRequest([{ id: "p1", qty: 2 }]), [
    { id: "p1", qty: 2 },
  ]);
  for (const bad of [
    [],
    "p1",
    [{ id: "p1", qty: 0 }],
    [{ id: "p1", qty: 100 }],
    [{ id: "p1", qty: 1.5 }],
    [{ id: "", qty: 1 }],
    [{ qty: 1 }],
    [
      { id: "p1", qty: 1 },
      { id: "p1", qty: 1 },
    ],
  ])
    assert.throws(() => validateCartRequest(bad));
});

test("resolveCartItems reprices from the published catalog, never the browser", () => {
  const lines = resolveCartItems(
    [
      // Un cliente malicioso podría intentar mandar price: 1; el servidor
      // lo ignora porque solo recibe id + qty y el precio sale del catálogo.
      { id: "p-mug", qty: 2, price: 1 },
      { id: "p-key", qty: 1 },
    ],
    [
      { ...mug, publicPrice: 299.5 },
      { ...keychain, publicPrice: 89 },
    ],
  );
  assert.deepEqual(lines, [
    {
      id: "p-mug",
      title: "Taza Saltillo",
      image: "https://img.example.test/mug.webp",
      unitPriceCents: 29950,
      quantity: 2,
      lineTotalCents: 59900,
    },
    {
      id: "p-key",
      title: "Llavero",
      image: null,
      unitPriceCents: 8900,
      quantity: 1,
      lineTotalCents: 8900,
    },
  ]);
});

test("resolveCartItems rejects missing, draft, unpriced and non-MXN products", () => {
  const published = [{ ...mug }];
  assert.throws(
    () => resolveCartItems([{ id: "p-ghost", qty: 1 }], published),
    /no disponible/,
  );
  assert.throws(
    () =>
      resolveCartItems([{ id: "p-mug", qty: 1 }], [
        { ...mug, publicPrice: null },
      ]),
    /no tiene precio/,
  );
  assert.throws(
    () =>
      resolveCartItems([{ id: "p-mug", qty: 1 }], [
        { ...mug, publicPrice: 0 },
      ]),
    /no tiene precio/,
  );
  assert.throws(
    () =>
      resolveCartItems([{ id: "p-mug", qty: 1 }], [
        { ...mug, currency: "USD" },
      ]),
    /no está en MXN/,
  );
});

test("checkout line items use integer cents in MXN", () => {
  assert.deepEqual(
    buildCheckoutLineItems([
      {
        id: "p-mug",
        title: "Taza Saltillo",
        unitPriceCents: 29950,
        quantity: 2,
        lineTotalCents: 59900,
      },
    ]),
    [
      {
        price_data: {
          currency: "mxn",
          unit_amount: 29950,
          product_data: {
            name: "Taza Saltillo",
            metadata: { productId: "p-mug" },
          },
        },
        quantity: 2,
      },
    ],
  );
});

test("shipping options: pickup is free, shipping uses the flat rate", () => {
  assert.equal(DEFAULT_SHIPPING_FLAT_RATE_MXN_CENTS, 15000);
  const options = buildShippingOptions(15000);
  assert.equal(options.length, 2);
  assert.equal(options[0].shipping_rate_data.display_name, "Recoger en Saltillo");
  assert.equal(options[0].shipping_rate_data.fixed_amount.amount, 0);
  assert.equal(options[1].shipping_rate_data.display_name, "Envío a todo México");
  assert.equal(options[1].shipping_rate_data.fixed_amount.amount, 15000);
  assert.equal(
    buildShippingOptions(9900)[1].shipping_rate_data.fixed_amount.amount,
    9900,
  );
});

test("shippingFlatRateCents reads the env var and falls back to $150 MXN", () => {
  assert.equal(shippingFlatRateCents({}), 15000);
  assert.equal(
    shippingFlatRateCents({ SHIPPING_FLAT_RATE_MXN_CENTS: "9900" }),
    9900,
  );
  assert.equal(shippingFlatRateCents({ SHIPPING_FLAT_RATE_MXN_CENTS: "0" }), 0);
  assert.equal(
    shippingFlatRateCents({ SHIPPING_FLAT_RATE_MXN_CENTS: "nope" }),
    15000,
  );
  assert.equal(
    shippingFlatRateCents({ SHIPPING_FLAT_RATE_MXN_CENTS: "-5" }),
    15000,
  );
});

test("catalog prices already include IVA: no separate tax line", () => {
  assert.equal(TAX_INCLUDED, true);
});

test("delivery method comes from the shipping amount Stripe charged", () => {
  assert.equal(
    deliveryMethodFromSession({ shipping_cost: { amount_total: 0 } }),
    "pickup",
  );
  assert.equal(
    deliveryMethodFromSession({ shipping_cost: { amount_total: 15000 } }),
    "shipping",
  );
  assert.equal(deliveryMethodFromSession({}), "pickup");
  assert.equal(deliveryMethodFromSession(null), "pickup");
});

test("buildOrderFromSession snapshots the paid order", () => {
  const order = buildOrderFromSession(
    {
      id: "cs_test_1",
      payment_intent: "pi_test_1",
      amount_total: 74800,
      currency: "mxn",
      customer_details: { name: "Cliente", email: "cliente@example.test" },
      shipping_details: {
        name: "Cliente",
        address: { city: "Saltillo", country: "MX" },
      },
      shipping_cost: { amount_total: 15000 },
    },
    [
      {
        id: "p-mug",
        title: "Taza Saltillo",
        unitPriceCents: 29950,
        quantity: 2,
        lineTotalCents: 59900,
      },
    ],
  );
  assert.equal(order.status, "paid");
  assert.equal(order.stripeSessionId, "cs_test_1");
  assert.equal(order.stripePaymentIntent, "pi_test_1");
  assert.equal(order.totalCents, 74800);
  assert.equal(order.currency, "MXN");
  assert.equal(order.deliveryMethod, "shipping");
  assert.equal(order.customer.email, "cliente@example.test");
  assert.equal(order.items.length, 1);
  assert.ok(order.id);
  assert.ok(order.createdAt);
});

function mockStripe({ sessionUrl = "https://checkout.stripe.com/pay/test" } = {}) {
  const calls = [];
  return {
    calls,
    checkout: {
      sessions: {
        create: async (params) => {
          calls.push(params);
          return { id: "cs_test_123", url: sessionUrl };
        },
        list: async () => ({
          data: [
            {
              description: "Taza Saltillo",
              quantity: 2,
              amount_total: 59900,
              price: {
                unit_amount: 29950,
                product: { id: "prod_test", metadata: { productId: "p-mug" } },
              },
            },
          ],
        }),
      },
    },
    webhooks: {
      constructEvent: (body, signature) => {
        if (signature !== "valid-signature") throw new Error("bad signature");
        return JSON.parse(body);
      },
    },
  };
}

test("createCheckoutSession charges catalog prices through Stripe", async () => {
  const repository = await catalogWith([mug, keychain]),
    stripe = mockStripe();
  const result = await createCheckoutSession({
    items: [{ id: "p-mug", qty: 2 }],
    origin: "https://suvenirssaltillo.shop",
    repository,
    stripe,
  });
  assert.equal(result.url, "https://checkout.stripe.com/pay/test");
  assert.equal(result.sessionId, "cs_test_123");
  assert.equal(stripe.calls.length, 1);
  const params = stripe.calls[0];
  assert.equal(params.mode, "payment");
  assert.equal(params.line_items[0].price_data.unit_amount, 29950);
  assert.equal(params.line_items[0].quantity, 2);
  assert.deepEqual(params.shipping_address_collection, {
    allowed_countries: ["MX"],
  });
  assert.equal(params.shipping_options.length, 2);
  assert.equal(
    params.success_url,
    "https://suvenirssaltillo.shop/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  );
  assert.equal(params.cancel_url, "https://suvenirssaltillo.shop/checkout/cancel");
});

test("createCheckoutSession rejects a cart the catalog cannot price", async () => {
  const repository = await catalogWith([
    { ...mug, status: "draft" },
  ]);
  await assert.rejects(
    createCheckoutSession({
      items: [{ id: "p-mug", qty: 1 }],
      origin: "https://suvenirssaltillo.shop",
      repository,
      stripe: mockStripe(),
    }),
    (error) => error instanceof ApiError && error.status === 422,
  );
  const empty = await catalogWith([]);
  await assert.rejects(
    createCheckoutSession({
      items: [],
      origin: "https://suvenirssaltillo.shop",
      repository: empty,
      stripe: mockStripe(),
    }),
    (error) => error instanceof ApiError && error.status === 422,
  );
});

test("webhook rejects an invalid signature before touching orders", async () => {
  const orders = new StateOrderRepository(new MemoryCatalogRepository()),
    stripe = mockStripe();
  await assert.rejects(
    handleStripeWebhook({
      rawBody: JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } }),
      signature: "wrong",
      stripe,
      orders,
      webhookSecret: "whsec_test",
    }),
    (error) => error instanceof ApiError && error.status === 400,
  );
  assert.equal(await orders.hasStripeEvent("evt_1"), false);
  assert.deepEqual(await orders.listOrders(), []);
});

test("webhook requires its secret configured", async () => {
  const orders = new StateOrderRepository(new MemoryCatalogRepository());
  await assert.rejects(
    handleStripeWebhook({
      rawBody: "{}",
      signature: "valid-signature",
      stripe: mockStripe(),
      orders,
      webhookSecret: "",
    }),
    (error) => error instanceof ApiError && error.status === 503,
  );
});

test("webhook records a paid order and ignores a repeated delivery", async () => {
  const orders = new StateOrderRepository(new MemoryCatalogRepository()),
    stripe = mockStripe();
  const event = {
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        payment_intent: "pi_test_1",
        amount_total: 74900,
        currency: "mxn",
        customer_details: { name: "Cliente", email: "cliente@example.test" },
        shipping_details: null,
        shipping_cost: { amount_total: 15000 },
      },
    },
  };
  const first = await handleStripeWebhook({
    rawBody: JSON.stringify(event),
    signature: "valid-signature",
    stripe,
    orders,
    webhookSecret: "whsec_test",
  });
  assert.equal(first.duplicate, false);
  assert.ok(first.orderId);
  const saved = await orders.listOrders();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].status, "paid");
  assert.equal(saved[0].totalCents, 74900);
  assert.equal(saved[0].deliveryMethod, "shipping");
  assert.equal(saved[0].items[0].title, "Taza Saltillo");
  assert.equal(saved[0].items[0].unitPriceCents, 29950);
  const second = await handleStripeWebhook({
    rawBody: JSON.stringify(event),
    signature: "valid-signature",
    stripe,
    orders,
    webhookSecret: "whsec_test",
  });
  assert.equal(second.duplicate, true);
  assert.equal((await orders.listOrders()).length, 1);
});

test("webhook records other event types without creating an order", async () => {
  const orders = new StateOrderRepository(new MemoryCatalogRepository()),
    stripe = mockStripe();
  const result = await handleStripeWebhook({
    rawBody: JSON.stringify({
      id: "evt_2",
      type: "payment_intent.succeeded",
      data: { object: {} },
    }),
    signature: "valid-signature",
    stripe,
    orders,
    webhookSecret: "whsec_test",
  });
  assert.equal(result.duplicate, false);
  assert.equal(result.orderId, null);
  assert.equal(await orders.hasStripeEvent("evt_2"), true);
  assert.deepEqual(await orders.listOrders(), []);
});

test("webhook retry with a new event id updates the same order", async () => {
  const orders = new StateOrderRepository(new MemoryCatalogRepository()),
    stripe = mockStripe();
  const session = {
    id: "cs_test_9",
    payment_intent: "pi_test_9",
    amount_total: 59900,
    currency: "mxn",
    customer_details: { name: "Cliente", email: "cliente@example.test" },
    shipping_details: null,
    shipping_cost: { amount_total: 0 },
  };
  const first = await handleStripeWebhook({
    rawBody: JSON.stringify({
      id: "evt_a",
      type: "checkout.session.completed",
      data: { object: session },
    }),
    signature: "valid-signature",
    stripe,
    orders,
    webhookSecret: "whsec_test",
  });
  const second = await handleStripeWebhook({
    rawBody: JSON.stringify({
      id: "evt_b",
      type: "checkout.session.completed",
      data: { object: session },
    }),
    signature: "valid-signature",
    stripe,
    orders,
    webhookSecret: "whsec_test",
  });
  assert.equal(first.orderId, second.orderId);
  assert.equal((await orders.listOrders()).length, 1);
});
