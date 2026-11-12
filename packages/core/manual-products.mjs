// Productos manuales: creados desde el panel de administración con datos y
// fotos propias, sin enlace de proveedor. La validación sigue las mismas
// reglas que la importación (título, descripción, entrega, imágenes), con
// dos diferencias: la categoría debe ser una de las 18 familias del
// catálogo y el precio de venta siempre es en MXN.
//
// Sin imports de Node: el formulario del panel (cliente) importa las
// etiquetas de disponibilidad desde aquí.
import {
  PRODUCT_CATEGORY_NAMES,
  subcategoriesFor,
} from "./categories.mjs";

export const MANUAL_PRODUCT_SOURCE = "manual";
export const MAX_MANUAL_IMAGES = 12;

// Disponibilidad que el panel puede asignar a un producto manual. El
// escaparate no la muestra hoy; queda registrada para el panel.
export const STOCK_STATUSES = [
  "unknown",
  "in_stock",
  "out_of_stock",
  "made_to_order",
];
export const STOCK_STATUS_LABELS = {
  unknown: "Por confirmar",
  in_stock: "En stock",
  out_of_stock: "Agotado",
  made_to_order: "Bajo pedido",
};

// URL interna de una foto subida desde el dispositivo y guardada en la base
// de datos (ver packages/core/product-images.mjs). No pasa por la
// verificación de proveedor porque no es una URL externa.
export const INTERNAL_IMAGE_URL =
  /^\/api\/product-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message) {
  const error = new Error(message);
  error.status = 422;
  throw error;
}

function priceNumber(value) {
  if (
    typeof value === "string"
      ? !value.trim() || value.length > 64
      : typeof value !== "number"
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1e12 ? n : null;
}

function deliveryNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 365 ? n : null;
}

// Mismo mecanismo de slug que la importación: título normalizado +
// primeros 6 caracteres del id.
export function slugFor(title, id) {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-") +
    "-" +
    id.slice(0, 6)
  );
}

export async function validateManualProduct(input, { resolveUrl } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Datos del producto inválidos.");
  const title =
    typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 240)
    fail("Agrega un título de hasta 240 caracteres.");
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > 10000) fail("Descripción inválida.");
  if (!PRODUCT_CATEGORY_NAMES.includes(input.category))
    fail("Selecciona una de las 18 categorías del catálogo.");
  const category = input.category;
  const subcategory =
    typeof input.subcategory === "string" ? input.subcategory : "";
  if (
    subcategory !== "" &&
    !subcategoriesFor(category).includes(subcategory)
  )
    fail("La subcategoría no pertenece a la categoría seleccionada.");
  if (
    input.currency !== undefined &&
    input.currency !== null &&
    input.currency !== "MXN"
  )
    fail("El precio de venta de un producto manual siempre es en MXN.");
  const publicPrice = priceNumber(input.publicPrice);
  if (publicPrice === null)
    fail("Agrega un precio de venta en MXN mayor que cero.");
  const deliveryDays = deliveryNumber(input.deliveryDays),
    deliveryMinDays = deliveryNumber(input.deliveryMinDays);
  if (
    (input.deliveryDays !== undefined &&
      input.deliveryDays !== null &&
      input.deliveryDays !== "" &&
      deliveryDays === null) ||
    (input.deliveryMinDays !== undefined &&
      input.deliveryMinDays !== null &&
      input.deliveryMinDays !== "" &&
      deliveryMinDays === null)
  )
    fail("La entrega debe indicar días entre 0 y 365.");
  if (
    deliveryMinDays !== null &&
    deliveryDays !== null &&
    deliveryMinDays > deliveryDays
  )
    fail("La entrega mínima supera la máxima.");
  const images = Array.isArray(input.images) ? input.images : [];
  if (images.length > MAX_MANUAL_IMAGES)
    fail(`Agrega hasta ${MAX_MANUAL_IMAGES} fotos por producto.`);
  for (const image of images) {
    if (typeof image !== "string" || image.length > 2048)
      fail("Revisa las URLs de las fotos.");
    if (INTERNAL_IMAGE_URL.test(image)) continue;
    let url;
    try {
      url = new URL(image);
    } catch {
      fail("Las fotos deben ser URLs https válidas.");
    }
    if (url.protocol !== "https:")
      fail("Las fotos deben ser URLs https (no http).");
    if (typeof resolveUrl === "function") {
      try {
        await resolveUrl(image);
      } catch {
        fail(
          "No se pudo verificar la foto " +
            image +
            ". Usa una URL pública https.",
        );
      }
    }
  }
  const personalizationSupported = input.personalizationSupported === true;
  const stockStatus = input.stockStatus ?? "unknown";
  if (!STOCK_STATUSES.includes(stockStatus))
    fail("Selecciona una disponibilidad válida.");
  const status = input.status ?? "draft";
  if (!["draft", "published"].includes(status))
    fail("Estado del producto inválido.");
  if (status === "published" && images.length === 0)
    fail(
      "Agrega al menos una foto para publicar el producto. También puedes guardarlo como borrador.",
    );
  return {
    title,
    description,
    category,
    subcategory,
    currency: "MXN",
    publicPrice,
    deliveryDays,
    deliveryMinDays,
    images: [...images],
    personalizationSupported,
    stockStatus,
    status,
  };
}

export function buildManualProduct(fields, now = new Date().toISOString()) {
  const id = crypto.randomUUID();
  return {
    id,
    slug: slugFor(fields.title, id),
    title: fields.title,
    description: fields.description,
    images: fields.images,
    currency: "MXN",
    category: fields.category,
    subcategory: fields.subcategory,
    personalizationSupported: fields.personalizationSupported,
    supplierCost: null,
    supplierUrl: null,
    source: MANUAL_PRODUCT_SOURCE,
    sourceKey: null,
    sourceIdentity: null,
    sourceOriginal: null,
    gtin: "",
    sku: "",
    mpn: "",
    brand: "",
    variant: "",
    deliveryDays: fields.deliveryDays,
    deliveryMinDays: fields.deliveryMinDays,
    stockStatus: fields.stockStatus,
    pricing: {},
    suggestedPrice: null,
    publicPrice: fields.publicPrice,
    manualPublicPrice: true,
    overrides: {},
    evidence: {},
    conditionsConfirmed: true,
    status: fields.status,
    sourceStatus: "manual",
    sourceObservation: null,
    lastCheckedAt: null,
    nextCheckAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
