// Almacén de pedidos. Sigue el patrón de lib/quote-store.mjs: en producción
// (DATABASE_URL) usa las tablas souvenirs_orders y souvenirs_stripe_events
// en Neon; en desarrollo guarda el estado en .data/orders.json junto al
// catálogo; sin base persistente en producción, falla antes de vender.
import { dirname, join } from "node:path";
import { catalogRepository } from "./catalog-store.mjs";
import { FileCatalogRepository } from "../packages/core/repository.mjs";
import {
  PostgresOrderRepository,
  StateOrderRepository,
} from "../packages/core/order-repository.mjs";

const key = Symbol.for("souvenirs.orders.repository");
if (!globalThis[key]) {
  if (process.env.DATABASE_URL)
    globalThis[key] = new PostgresOrderRepository(catalogRepository.pool);
  else if (
    process.env.NODE_ENV !== "production" ||
    process.env.CATALOG_DATA_FILE
  ) {
    const file = process.env.CATALOG_DATA_FILE
      ? join(dirname(process.env.CATALOG_DATA_FILE), "orders.json")
      : ".data/orders.json";
    globalThis[key] = new StateOrderRepository(new FileCatalogRepository(file));
  } else {
    const fail = async () => {
      throw new Error("Persistent order storage required");
    };
    globalThis[key] = new Proxy({}, { get: () => fail });
  }
}
export const orderRepository = globalThis[key];
