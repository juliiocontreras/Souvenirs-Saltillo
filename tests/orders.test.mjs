import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { MemoryCatalogRepository } from "../packages/core/repository.mjs";
import {
  StateOrderRepository,
  PostgresOrderRepository,
} from "../packages/core/order-repository.mjs";
import { buildOrderFromSession } from "../packages/core/orders.mjs";

function paidOrder(sessionId = "cs_test_1") {
  return buildOrderFromSession(
    {
      id: sessionId,
      payment_intent: "pi_test_1",
      amount_total: 29950,
      currency: "mxn",
      customer_details: { name: "Cliente", email: "cliente@example.test" },
      shipping_details: null,
      shipping_cost: { amount_total: 0 },
    },
    [
      {
        id: "p-mug",
        title: "Taza Saltillo",
        unitPriceCents: 29950,
        quantity: 1,
        lineTotalCents: 29950,
      },
    ],
  );
}

test("StateOrderRepository saves, finds by session and lists newest first", async () => {
  const orders = new StateOrderRepository(new MemoryCatalogRepository());
  const first = await orders.saveOrder(paidOrder("cs_test_1")),
    second = await orders.saveOrder(paidOrder("cs_test_2"));
  assert.equal((await orders.listOrders()).length, 2);
  assert.equal(
    (await orders.getOrderBySession("cs_test_1")).id,
    first.id,
  );
  assert.equal(await orders.getOrder("missing"), null);
  assert.equal(await orders.getOrderBySession("cs_missing"), null);
  assert.equal((await orders.getOrder(second.id)).totalCents, 29950);
});

test("StateOrderRepository upsert keeps the original order id", async () => {
  const orders = new StateOrderRepository(new MemoryCatalogRepository());
  const order = paidOrder("cs_test_1");
  await orders.saveOrder(order);
  const again = await orders.saveOrder({ ...order, totalCents: 39950 });
  assert.equal(again.id, order.id);
  assert.equal((await orders.listOrders()).length, 1);
  assert.equal((await orders.getOrder(order.id)).totalCents, 39950);
});

test("StateOrderRepository records each Stripe event only once", async () => {
  const orders = new StateOrderRepository(new MemoryCatalogRepository());
  assert.equal(await orders.hasStripeEvent("evt_1"), false);
  assert.equal(await orders.recordStripeEvent("evt_1", "checkout.session.completed"), true);
  assert.equal(await orders.hasStripeEvent("evt_1"), true);
  assert.equal(await orders.recordStripeEvent("evt_1", "checkout.session.completed"), false);
  assert.equal(
    await orders.recordStripeEvent("evt_2", "payment_intent.succeeded"),
    true,
  );
});

test(
  "PostgresOrderRepository persists orders and dedupes Stripe events",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        max: 2,
      }),
      orders = new PostgresOrderRepository(pool);
    try {
      await orders.initialize();
      const saved = await orders.saveOrder(paidOrder("cs_pg_1"));
      assert.equal(saved.status, "paid");
      assert.equal(
        (await orders.getOrderBySession("cs_pg_1")).id,
        saved.id,
      );
      assert.equal((await orders.listOrders()).length, 1);
      assert.equal(await orders.hasStripeEvent("evt_pg_1"), false);
      assert.equal(
        await orders.recordStripeEvent("evt_pg_1", "checkout.session.completed"),
        true,
      );
      assert.equal(await orders.hasStripeEvent("evt_pg_1"), true);
      assert.equal(
        await orders.recordStripeEvent("evt_pg_1", "checkout.session.completed"),
        false,
      );
      await pool.query("DELETE FROM souvenirs_orders WHERE data->>'stripeSessionId' LIKE 'cs_pg_%'");
      await pool.query("DELETE FROM souvenirs_stripe_events WHERE id LIKE 'evt_pg_%'");
    } finally {
      await pool.end();
    }
  },
);
