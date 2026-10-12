import pg from "pg";
import {
  FileCatalogRepository,
  PostgresCatalogRepository,
} from "../packages/core/repository.mjs";
const key = Symbol.for("souvenirs.catalog.repository");
if (!globalThis[key]) {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
    });
    globalThis[key] = new PostgresCatalogRepository(pool);
  } else if (
    process.env.NODE_ENV !== "production" ||
    process.env.CATALOG_DATA_FILE
  ) {
    globalThis[key] = new FileCatalogRepository(
      process.env.CATALOG_DATA_FILE || ".data/catalog.json",
    );
  } else {
    const fail = async () => {
      throw new Error(
        "Configura DATABASE_URL o CATALOG_DATA_FILE en un volumen persistente antes de operar el catálogo.",
      );
    };
    globalThis[key] = new Proxy({}, { get: () => fail });
  }
}
export const catalogRepository = globalThis[key];
