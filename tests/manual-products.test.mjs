import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCatalogRepository } from "../packages/core/repository.mjs";
import {
  validateManualProduct,
  buildManualProduct,
} from "../packages/core/manual-products.mjs";
import {
  validateProductImage,
  StateProductImageRepository,
  productImageUrl,
} from "../packages/core/product-images.mjs";
import {
  createManualProduct,
  updateManualProduct,
} from "../lib/catalog-service.mjs";
import {
  parseProductImageUpload,
  uploadProductImages,
  serveProductImage,
} from "../lib/product-images.mjs";

const safeResolve = async (url) => ({
  url: new URL(url),
  addresses: [{ address: "93.184.216.34", family: 4 }],
});
const rejectingResolve = async () => {
  throw new Error("restricted");
};
const valid = (overrides = {}) => ({
  title: "Taza de Saltillo",
  description: "Cerámica de 350 ml.",
  category: "Tazas y termos",
  subcategory: "Tazas",
  publicPrice: 299,
  deliveryDays: 5,
  deliveryMinDays: 2,
  images: ["https://images.example.test/taza.webp"],
  personalizationSupported: true,
  stockStatus: "in_stock",
  ...overrides,
});
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const jpeg = Buffer.from([255, 216, 255, 224, 0, 0, 0, 0]);
const webp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP"),
]);

test("createManualProduct creates a draft with server-generated id/slug in MXN", async () => {
  const repository = new MemoryCatalogRepository();
  const product = await createManualProduct(repository, valid(), {
    resolveUrl: safeResolve,
  });
  assert.equal(product.status, "draft");
  assert.equal(product.currency, "MXN");
  assert.equal(product.publicPrice, 299);
  assert.equal(product.source, "manual");
  assert.equal(product.sourceStatus, "manual");
  assert.equal(product.supplierUrl, null);
  assert.equal(product.supplierCost, null);
  assert.equal(product.manualPublicPrice, true);
  assert.match(product.slug, /^taza-de-saltillo-[0-9a-f]{6}$/);
  assert.ok(product.createdAt <= product.updatedAt);
  assert.equal((await repository.listPublicProducts()).length, 0);
});

test("createManualProduct publishes when it has a photo and appears public", async () => {
  const repository = new MemoryCatalogRepository();
  const product = await createManualProduct(
    repository,
    valid({ status: "published" }),
    { resolveUrl: safeResolve },
  );
  assert.equal(product.status, "published");
  const [listed] = await repository.listPublicProducts();
  assert.equal(listed.id, product.id);
  assert.equal(listed.publicPrice, 299);
  assert.equal(listed.supplierUrl, undefined);
});

test("manual validation rejects missing title, legacy and unknown categories, and bad prices", async () => {
  const repository = new MemoryCatalogRepository();
  for (const [label, input] of [
    ["sin título", valid({ title: "   " })],
    ["título largo", valid({ title: "T".repeat(241) })],
    ["categoría anterior", valid({ category: "Regalos" })],
    ["categoría inexistente", valid({ category: "No existe" })],
    ["subcategoría ajena", valid({ subcategory: "Maletas" })],
    ["precio cero", valid({ publicPrice: 0 })],
    ["precio negativo", valid({ publicPrice: -5 })],
    ["precio no numérico", valid({ publicPrice: "abc" })],
    ["sin precio", valid({ publicPrice: undefined })],
    ["moneda distinta", valid({ currency: "USD" })],
    ["entrega mínima mayor", valid({ deliveryMinDays: 9 })],
    ["entrega fuera de rango", valid({ deliveryDays: 366 })],
    ["más de 12 fotos", valid({ images: Array(13).fill("https://images.example.test/a.webp") })],
  ])
    await assert.rejects(
      createManualProduct(repository, input, { resolveUrl: safeResolve }),
      (error) => {
        assert.equal(error.status, 422);
        return true;
      },
      label,
    );
});

test("manual validation rejects non-https and unverifiable image URLs", async () => {
  const repository = new MemoryCatalogRepository();
  await assert.rejects(
    createManualProduct(
      repository,
      valid({ images: ["http://images.example.test/taza.webp"] }),
      { resolveUrl: safeResolve },
    ),
    { status: 422 },
  );
  await assert.rejects(
    createManualProduct(repository, valid(), {
      resolveUrl: rejectingResolve,
    }),
    { status: 422 },
  );
});

test("manual products cannot publish without a photo, but save as draft", async () => {
  const repository = new MemoryCatalogRepository();
  await assert.rejects(
    createManualProduct(
      repository,
      valid({ images: [], status: "published" }),
      { resolveUrl: safeResolve },
    ),
    { status: 422 },
  );
  const draft = await createManualProduct(
    repository,
    valid({ images: [] }),
    { resolveUrl: safeResolve },
  );
  assert.equal(draft.status, "draft");
});

test("updateManualProduct edits fields, publishes and unpublishes a manual product", async () => {
  const repository = new MemoryCatalogRepository();
  const product = await createManualProduct(repository, valid(), {
    resolveUrl: safeResolve,
  });
  const edited = await updateManualProduct(
    repository,
    product.id,
    { title: "Taza de Saltillo · Edición", publicPrice: 349 },
    { resolveUrl: safeResolve },
  );
  assert.equal(edited.title, "Taza de Saltillo · Edición");
  assert.equal(edited.publicPrice, 349);
  assert.equal(edited.slug, product.slug);
  assert.equal(edited.id, product.id);
  const published = await updateManualProduct(
    repository,
    product.id,
    { status: "published" },
    { resolveUrl: safeResolve },
  );
  assert.equal(published.status, "published");
  assert.equal((await repository.listPublicProducts()).length, 1);
  const retired = await updateManualProduct(
    repository,
    product.id,
    { status: "draft" },
    { resolveUrl: safeResolve },
  );
  assert.equal(retired.status, "draft");
  assert.equal((await repository.listPublicProducts()).length, 0);
});

test("updateManualProduct refuses imported products and unknown ids", async () => {
  const repository = new MemoryCatalogRepository();
  const imported = await repository.saveProduct({
    id: "imported-1",
    title: "Termo importado",
    status: "published",
    supplierUrl: "https://supplier.example.test/termo",
  });
  await assert.rejects(
    updateManualProduct(repository, imported.id, { publicPrice: 10 }),
    { status: 422 },
  );
  await assert.rejects(
    updateManualProduct(repository, "missing", { publicPrice: 10 }),
    { status: 404 },
  );
});

test("validateProductImage accepts PNG/JPG/WebP and rejects other files and oversize", () => {
  assert.equal(validateProductImage(png, "foto.png").type, "image/png");
  assert.equal(validateProductImage(jpeg, "foto.jpg").type, "image/jpeg");
  assert.equal(validateProductImage(webp, "foto.webp").type, "image/webp");
  assert.throws(
    () => validateProductImage(Buffer.from("%PDF-1.4"), "doc.pdf"),
    /PNG, JPG o WebP/,
  );
  assert.throws(
    () => validateProductImage(Buffer.from("hola"), "foto.txt"),
    /PNG, JPG o WebP/,
  );
  assert.throws(
    () => validateProductImage(Buffer.alloc(2 * 1024 * 1024 + 1), "foto.png"),
    /2 MB/,
  );
  assert.throws(() => validateProductImage(Buffer.alloc(0), "foto.png"), /2 MB/);
});

test("product images round-trip through the state repository and the service", async () => {
  const images = new StateProductImageRepository(new MemoryCatalogRepository());
  const saved = await uploadProductImages(images, null, [
    { data: png, type: "image/png", name: "foto.png", size: png.length },
  ]);
  assert.equal(saved.length, 1);
  assert.match(saved[0].url, /^\/api\/product-images\/[0-9a-f-]{36}$/);
  assert.equal(saved[0].url, productImageUrl(saved[0].id));
  const served = await serveProductImage(images, saved[0].id);
  assert.deepEqual(served.data, png);
  assert.equal(served.contentType, "image/png");
  await assert.rejects(serveProductImage(images, "missing"), { status: 404 });
  await assert.rejects(serveProductImage(images, "not-a-uuid"), {
    status: 404,
  });
});

test("parseProductImageUpload reads a multipart upload and rejects non-images", async () => {
  const form = new FormData();
  form.append("images", new File([png], "foto.png", { type: "image/png" }));
  const request = new Request("http://localhost/api/product-images", {
    method: "POST",
    body: form,
  });
  const files = await parseProductImageUpload(request);
  assert.equal(files.length, 1);
  assert.equal(files[0].type, "image/png");
  const bad = new FormData();
  bad.append("images", new File(["hola"], "foto.txt", { type: "text/plain" }));
  await assert.rejects(
    parseProductImageUpload(
      new Request("http://localhost/api/product-images", {
        method: "POST",
        body: bad,
      }),
    ),
    /PNG, JPG o WebP/,
  );
});

test("validateManualProduct builds a manual record with the import slug rule", () => {
  const product = buildManualProduct({
    title: "Imán Saltillo",
    description: "",
    category: "Souvenirs de Saltillo",
    subcategory: "Imanes",
    currency: "MXN",
    publicPrice: 59,
    deliveryDays: null,
    deliveryMinDays: null,
    images: [],
    personalizationSupported: false,
    stockStatus: "unknown",
    status: "draft",
  });
  assert.equal(product.source, "manual");
  assert.match(product.slug, /^iman-saltillo-[0-9a-f]{6}$/);
});

// next/server no se puede importar bajo node --test, así que la puerta de
// admin se prueba en requireAdmin (lo que las rutas llaman antes de tocar
// datos): sin sesión, la creación manual se rechaza con 401.
test("creating a product without an admin session is rejected", async () => {
  process.env.ADMIN_PASSWORD = "manual-test-password";
  process.env.AUTH_SECRET = "s".repeat(32);
  const { requireAdmin } = await import("../lib/admin-auth.mjs");
  const request = {
    cookies: { get: () => undefined },
    headers: { get: () => null },
    url: "http://localhost/api/products",
  };
  await assert.rejects(requireAdmin(request, { write: true }), {
    status: 401,
  });
});
