// Pedidos y eventos de Stripe. Sigue el patrón de
// packages/core/quote-repository.mjs: los datos de clientes viven en tablas
// propias (souvenirs_orders, souvenirs_stripe_events), fuera de las lecturas
// del catálogo, con los datos en jsonb. La variante State usa el mismo
// almacenamiento de estado que el catálogo en desarrollo y pruebas.
import { orderReceipt } from "./orders.mjs";

const copy = (value) => structuredClone(value);

export class StateOrderRepository {
  constructor(storage) {
    this.storage = storage;
  }
  async saveOrder(order) {
    return this.storage.mutate((state) => {
      state.orders ||= {};
      const previous = state.orders[order.id];
      state.orders[order.id] = {
        ...order,
        createdAt: previous?.createdAt || order.createdAt,
        updatedAt: new Date().toISOString(),
      };
      return orderReceipt(state.orders[order.id]);
    });
  }
  async getOrder(id) {
    const order = (await this.storage.read()).orders?.[id];
    return order ? copy(order) : null;
  }
  async getOrderBySession(sessionId) {
    const orders = Object.values((await this.storage.read()).orders || {});
    return (
      orders.find((order) => order.stripeSessionId === sessionId) || null
    );
  }
  async listOrders() {
    return Object.values((await this.storage.read()).orders || {})
      .map(orderReceipt)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 200);
  }
  async hasStripeEvent(eventId) {
    return Boolean((await this.storage.read()).stripeEvents?.[eventId]);
  }
  async recordStripeEvent(eventId, type) {
    return this.storage.mutate((state) => {
      state.stripeEvents ||= {};
      if (state.stripeEvents[eventId]) return false;
      state.stripeEvents[eventId] = {
        id: eventId,
        type,
        processedAt: new Date().toISOString(),
      };
      return true;
    });
  }
}

export class PostgresOrderRepository {
  constructor(pool) {
    this.pool = pool;
    this.ready = null;
  }
  async initialize() {
    this.ready ||= Promise.all([
      this.pool.query(
        "CREATE TABLE IF NOT EXISTS souvenirs_orders (id uuid PRIMARY KEY, data jsonb NOT NULL)",
      ),
      this.pool.query(
        "CREATE TABLE IF NOT EXISTS souvenirs_stripe_events (id text PRIMARY KEY, data jsonb NOT NULL)",
      ),
    ]).catch((error) => {
      this.ready = null;
      throw error;
    });
    await this.ready;
  }
  async saveOrder(order) {
    await this.initialize();
    const { rows } = await this.pool.query(
      "INSERT INTO souvenirs_orders(id,data) VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data = excluded.data || jsonb_build_object('createdAt', souvenirs_orders.data->>'createdAt', 'updatedAt', $3) RETURNING data",
      [order.id, JSON.stringify(order), new Date().toISOString()],
    );
    return rows[0].data;
  }
  async getOrder(id) {
    await this.initialize();
    const { rows } = await this.pool.query(
      "SELECT data FROM souvenirs_orders WHERE id=$1",
      [id],
    );
    return rows[0]?.data || null;
  }
  async getOrderBySession(sessionId) {
    await this.initialize();
    const { rows } = await this.pool.query(
      "SELECT data FROM souvenirs_orders WHERE data->>'stripeSessionId'=$1",
      [sessionId],
    );
    return rows[0]?.data || null;
  }
  async listOrders() {
    await this.initialize();
    return (
      await this.pool.query(
        "SELECT data FROM souvenirs_orders ORDER BY data->>'createdAt' DESC LIMIT 200",
      )
    ).rows.map(({ data }) => data);
  }
  async hasStripeEvent(eventId) {
    await this.initialize();
    const { rows } = await this.pool.query(
      "SELECT 1 FROM souvenirs_stripe_events WHERE id=$1",
      [eventId],
    );
    return rows.length > 0;
  }
  async recordStripeEvent(eventId, type) {
    await this.initialize();
    const { rows } = await this.pool.query(
      "INSERT INTO souvenirs_stripe_events(id,data) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id",
      [
        eventId,
        JSON.stringify({
          id: eventId,
          type,
          processedAt: new Date().toISOString(),
        }),
      ],
    );
    return rows.length > 0;
  }
}
