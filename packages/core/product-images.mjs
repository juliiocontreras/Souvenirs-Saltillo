// Fotos de producto subidas desde el dispositivo. Almacenamiento duradero
// en Postgres (bytea), con el mismo patrón que los logos de cotización
// (packages/core/quote-repository.mjs): una tabla propia, fuera de las
// lecturas del catálogo, y una ruta pública que sirve los bytes. En local
// sin base de datos se guardan en un archivo propio (product-images.json),
// nunca en el disco efímero del despliegue.
import { randomUUID } from "node:crypto";

export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PRODUCT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function productImageUrl(id) {
  return "/api/product-images/" + id;
}

export function validateProductImage(bytes, name = "foto") {
  if (!bytes || bytes.length === 0 || bytes.length > PRODUCT_IMAGE_MAX_BYTES)
    throw new Error("Cada foto debe pesar hasta 2 MB.");
  const head = Buffer.from(bytes);
  let type;
  if (
    head
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    type = "image/png";
  else if (head[0] === 255 && head[1] === 216 && head[2] === 255)
    type = "image/jpeg";
  else if (
    head.subarray(0, 4).toString() === "RIFF" &&
    head.subarray(8, 12).toString() === "WEBP"
  )
    type = "image/webp";
  else throw new Error("Sube fotos PNG, JPG o WebP.");
  return {
    name:
      String(name)
        .replace(/[\x00-\x1f\x7f/\\]/g, "")
        .slice(0, 120) || "foto",
    type,
    size: head.length,
  };
}

export class StateProductImageRepository {
  constructor(stateRepository) {
    this.storage = stateRepository;
  }
  async save(image) {
    return this.storage.mutate((state) => {
      state.productImages ||= {};
      state.productImages[image.id] = {
        ...image,
        data: Buffer.from(image.data).toString("base64"),
      };
      const { data, ...receipt } = state.productImages[image.id];
      return receipt;
    });
  }
  async get(id) {
    const record = (await this.storage.read()).productImages?.[id];
    return record
      ? { ...record, data: Buffer.from(record.data, "base64") }
      : null;
  }
}

export class PostgresProductImageRepository {
  constructor(pool) {
    this.pool = pool;
    this.ready = null;
  }
  async initialize() {
    this.ready ||= this.pool
      .query(
        "CREATE TABLE IF NOT EXISTS souvenirs_product_images (id uuid PRIMARY KEY, product_id uuid, data bytea NOT NULL, content_type text NOT NULL, filename text NOT NULL, created_at timestamptz NOT NULL)",
      )
      .catch((error) => {
        this.ready = null;
        throw error;
      });
    await this.ready;
  }
  async save(image) {
    await this.initialize();
    await this.pool.query(
      "INSERT INTO souvenirs_product_images(id,product_id,data,content_type,filename,created_at) VALUES($1,$2,$3,$4,$5,$6)",
      [
        image.id,
        image.productId || null,
        image.data,
        image.contentType,
        image.filename,
        image.createdAt,
      ],
    );
    return {
      id: image.id,
      productId: image.productId,
      contentType: image.contentType,
      filename: image.filename,
      createdAt: image.createdAt,
    };
  }
  async get(id) {
    await this.initialize();
    const { rows } = await this.pool.query(
      "SELECT id,product_id AS \"productId\",data,content_type AS \"contentType\",filename,created_at AS \"createdAt\" FROM souvenirs_product_images WHERE id=$1",
      [id],
    );
    return rows[0] || null;
  }
}

export function newProductImageId() {
  return randomUUID();
}
