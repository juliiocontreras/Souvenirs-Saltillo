import { dirname, join } from "node:path";
import { catalogRepository } from "./catalog-store.mjs";
import { FileCatalogRepository } from "../packages/core/repository.mjs";
import {
  PostgresQuoteRepository,
  StateQuoteRepository,
} from "../packages/core/quote-repository.mjs";

const key = Symbol.for("souvenirs.quotes.repository");
if (!globalThis[key]) {
  if (process.env.DATABASE_URL)
    globalThis[key] = new PostgresQuoteRepository(catalogRepository.pool);
  else if (
    process.env.NODE_ENV !== "production" ||
    process.env.CATALOG_DATA_FILE
  ) {
    const file = process.env.CATALOG_DATA_FILE
      ? join(dirname(process.env.CATALOG_DATA_FILE), "quote-requests.json")
      : ".data/quote-requests.json";
    globalThis[key] = new StateQuoteRepository(new FileCatalogRepository(file));
  } else {
    const fail = async () => {
      throw new Error("Persistent quote storage required");
    };
    globalThis[key] = new Proxy({}, { get: () => fail });
  }
}
export const quoteRepository = globalThis[key];
