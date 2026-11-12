import { dirname, join } from "node:path";
import { catalogRepository } from "./catalog-store.mjs";
import { FileCatalogRepository } from "../packages/core/repository.mjs";
import {
  PostgresProductImageRepository,
  StateProductImageRepository,
} from "../packages/core/product-images.mjs";

const key = Symbol.for("souvenirs.product-images.repository");
if (!globalThis[key]) {
  if (process.env.DATABASE_URL)
    globalThis[key] = new PostgresProductImageRepository(
      catalogRepository.pool,
    );
  else if (
    process.env.NODE_ENV !== "production" ||
    process.env.CATALOG_DATA_FILE
  ) {
    const file = process.env.CATALOG_DATA_FILE
      ? join(dirname(process.env.CATALOG_DATA_FILE), "product-images.json")
      : ".data/product-images.json";
    globalThis[key] = new StateProductImageRepository(
      new FileCatalogRepository(file),
    );
  } else {
    const fail = async () => {
      throw new Error("Persistent product image storage required");
    };
    globalThis[key] = new Proxy({}, { get: () => fail });
  }
}
export const productImageRepository = globalThis[key];
