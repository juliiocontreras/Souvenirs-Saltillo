import { randomUUID } from "node:crypto";
import { ApiError } from "./admin-auth.mjs";
import { calculatePricing } from "../packages/core/pricing.mjs";
import {
  resolvePublicSupplier,
  assertPublicSupplierUrl,
} from "../packages/core/url-safety.mjs";
import {
  alternativeIdentity,
  nullableNumber,
} from "../packages/core/supplier.mjs";
import { scrapeSupplierOptions } from "./supplier-scraper.mjs";
import { nextReviewAt } from "../packages/core/monitor.mjs";
import { validateClassification } from "../packages/core/categories.mjs";
import {
  validateManualProduct,
  buildManualProduct,
  MANUAL_PRODUCT_SOURCE,
} from "../packages/core/manual-products.mjs";

function classification(input) {
  try {
    return validateClassification(input);
  } catch (error) {
    throw new ApiError(error.message, 422);
  }
}

export async function updateProductClassification(repository, id, input) {
  const fields = classification(input);
  return repository.mutate((state) => {
    const previous = Object.hasOwn(state.products, id)
      ? state.products[id]
      : null;
    if (!previous) throw new ApiError("Producto no encontrado.", 404);
    const product = {
      ...previous,
      ...fields,
      updatedAt: new Date().toISOString(),
    };
    state.products[id] = product;
    return product;
  });
}

function manualValidation(error) {
  return new ApiError(error.message, error.status || 422);
}

// Producto manual: sin proveedor, precio fijo en MXN y origen "manual".
// El monitor lo ignora (no tiene supplierUrl) y la reimportación no aplica.
export async function createManualProduct(
  repository,
  input,
  { resolveUrl = resolvePublicSupplier } = {},
) {
  let fields;
  try {
    fields = await validateManualProduct(input, { resolveUrl });
  } catch (error) {
    throw manualValidation(error);
  }
  return repository.saveProduct(buildManualProduct(fields));
}

// Solo los productos manuales se editan aquí; los importados conservan su
// flujo de revisión desde la ficha del proveedor. Acepta cambios parciales
// (incluido publicar o retirar con { status }).
export async function updateManualProduct(
  repository,
  id,
  input,
  { resolveUrl = resolvePublicSupplier } = {},
) {
  const previous = await repository.getProduct(id);
  if (!previous) throw new ApiError("Producto no encontrado.", 404);
  if (previous.source !== MANUAL_PRODUCT_SOURCE)
    throw new ApiError(
      "Solo los productos manuales se editan aquí. Los importados se revisan desde su ficha de proveedor.",
      422,
    );
  const merged = {
    title: previous.title,
    description: previous.description,
    category: previous.category,
    subcategory: previous.subcategory || "",
    currency: previous.currency,
    publicPrice: previous.publicPrice,
    deliveryDays: previous.deliveryDays,
    deliveryMinDays: previous.deliveryMinDays,
    images: previous.images || [],
    personalizationSupported: previous.personalizationSupported,
    stockStatus: previous.stockStatus || "unknown",
    status: previous.status,
    ...Object.fromEntries(
      Object.entries(input || {}).filter(([, value]) => value !== undefined),
    ),
  };
  let fields;
  try {
    fields = await validateManualProduct(merged, { resolveUrl });
  } catch (error) {
    throw manualValidation(error);
  }
  return repository.saveProduct({
    ...previous,
    ...fields,
    updatedAt: new Date().toISOString(),
  });
}

export async function createImport(
  repository,
  url,
  { scrape = scrapeSupplierOptions } = {},
) {
  try {
    assertPublicSupplierUrl(url);
  } catch {
    throw new ApiError("Usa un enlace público HTTP/HTTPS de un producto.", 422);
  }
  const result = await scrape(url),
    id = randomUUID(),
    products = await repository.listProducts(),
    approvedByIdentity = {};
  for (const option of result.options) {
    const previous = products.find(
      (product) =>
        product.sourceKey === result.sourceUrl + "|" + option.identityKey,
    );
    if (previous)
      approvedByIdentity[option.identityKey] = {
        overrides: previous.overrides,
        pricing: previous.pricing,
        publicPrice: previous.manualPublicPrice ? previous.publicPrice : null,
        category: previous.category,
        subcategory: previous.subcategory || "",
        personalizationSupported: previous.personalizationSupported,
      };
  }
  return repository.saveDraft({
    id,
    ...result,
    approvedByIdentity,
    status: "preview",
    createdAt: new Date().toISOString(),
  });
}

// Importación por lotes: la cola vive en los borradores (status "queued",
// solo la URL) para reutilizar el almacenamiento existente; el procesado
// usa el mismo createImport y el mismo lease que la importación individual,
// una a la vez. Sin procesos en segundo plano: el panel dispara el procesado.
export const MAX_BATCH_URLS = 20;

function queueSummary(item) {
  return {
    id: item.id,
    sourceUrl: item.sourceUrl,
    status: "queued",
    attempts: item.attempts || 0,
    lastError: item.lastError || null,
    failedAt: item.failedAt || null,
    createdAt: item.createdAt,
  };
}

// Encola enlaces para importar. Omite duplicados (en el lote, en la cola,
// con ficha pendiente o ya importados) e inválidos, e indica el motivo por
// enlace. Las líneas vacías se ignoran.
export async function enqueueBatchImports(repository, urls) {
  const lines = Array.isArray(urls)
    ? urls.filter((value) => typeof value === "string" && value.trim())
    : [];
  if (!Array.isArray(urls) || lines.length === 0)
    throw new ApiError("Pega al menos un enlace.", 422);
  if (lines.length > MAX_BATCH_URLS)
    throw new ApiError(
      `El lote admite hasta ${MAX_BATCH_URLS} enlaces por vez.`,
      422,
    );
  const [drafts, products] = await Promise.all([
    repository.listDrafts(),
    repository.listProducts(),
  ]);
  const seen = new Set(),
    invalid = [],
    duplicates = [],
    hrefs = [];
  for (const raw of lines) {
    const value = raw.trim();
    let href;
    try {
      href = assertPublicSupplierUrl(value).href;
    } catch {
      invalid.push({
        url: value,
        reason: "Usa un enlace público HTTP/HTTPS de un producto.",
      });
      continue;
    }
    if (seen.has(href)) {
      duplicates.push({ url: href, reason: "Enlace duplicado en el lote." });
      continue;
    }
    seen.add(href);
    const pending = drafts.find(
      (draft) =>
        (draft.status === "preview" || draft.status === "queued") &&
        draft.sourceUrl === href,
    );
    if (pending) {
      duplicates.push({
        url: href,
        reason:
          pending.status === "queued"
            ? "Ya está en la cola de importación."
            : "Ya tiene una ficha pendiente de revisión.",
      });
      continue;
    }
    if (products.some((product) => product.supplierUrl === href)) {
      duplicates.push({
        url: href,
        reason: "Ya está importado en el catálogo.",
      });
      continue;
    }
    hrefs.push(href);
  }
  const now = new Date().toISOString(),
    items = [];
  for (const href of hrefs)
    items.push(
      await repository.saveDraft({
        id: randomUUID(),
        sourceUrl: href,
        status: "queued",
        attempts: 0,
        lastError: null,
        failedAt: null,
        createdAt: now,
      }),
    );
  return {
    queued: items.map(queueSummary),
    duplicates,
    invalid,
    queuedCount: items.length,
    duplicateCount: duplicates.length,
    invalidCount: invalid.length,
  };
}

// Procesa un enlace de la cola con el mismo createImport de siempre. Si el
// scrape falla, el enlace queda en la cola con el error y se puede reintentar
// sin duplicar; si tiene éxito, el borrador pasa a "Importaciones pendientes"
// y el elemento de la cola se borra.
export async function processBatchItem(
  repository,
  id,
  { scrape = scrapeSupplierOptions } = {},
) {
  const item = await repository.getDraft(id);
  if (!item || item.status !== "queued")
    throw new ApiError("Enlace no encontrado en la cola.", 404);
  const owner = randomUUID(),
    locked = await repository.acquireLease("supplier-import", owner, 120000);
  if (!locked)
    throw new ApiError(
      "Hay otra importación en curso. Espera a que termine.",
      409,
    );
  try {
    const draft = await createImport(repository, item.sourceUrl, { scrape });
    await repository.deleteDraft(item.id);
    return {
      status: "done",
      item: queueSummary(item),
      draft: { id: draft.id, sourceUrl: draft.sourceUrl },
    };
  } catch (error) {
    const message = error?.message || "No se pudo importar el enlace.",
      failed = await repository.saveDraft({
        ...item,
        attempts: (item.attempts || 0) + 1,
        lastError: message,
        failedAt: new Date().toISOString(),
      });
    return { status: "error", item: queueSummary(failed), error: message };
  } finally {
    await repository.releaseLease("supplier-import", owner);
  }
}

// Toma el enlace encolado más antiguo sin error. Los enlaces con error no
// se procesan solos: se reintentan explícitamente para no bloquear la cola
// con un enlace que falla siempre.
export async function processNextBatchItem(
  repository,
  { scrape = scrapeSupplierOptions } = {},
) {
  const queue = await repository.listQueuedImports(),
    next = queue.find((item) => !item.lastError);
  if (!next) return { status: "empty", remaining: queue.length };
  return processBatchItem(repository, next.id, { scrape });
}

export async function removeBatchItem(repository, id) {
  const item = await repository.getDraft(id);
  if (!item || item.status !== "queued")
    throw new ApiError("Enlace no encontrado en la cola.", 404);
  await repository.deleteDraft(id);
  return { removed: id };
}
export function pricingPolicy(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ApiError("Política de precio inválida.");
  return Object.fromEntries(
    [
      "marginPercent",
      "shipping",
      "otherCosts",
      "feePercent",
      "fixedFee",
      "taxPercent",
      "rounding",
    ]
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, input[key]]),
  );
}
export async function applyImport(
  repository,
  draftId,
  input,
  { resolveUrl = resolvePublicSupplier } = {},
) {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new ApiError("Importación no encontrada.", 404);
  if (draft.options.length > 1 && input.selection === undefined)
    throw new ApiError(
      "Selecciona explícitamente la ficha o variante antes de aplicar la importación.",
    );
  const index = Number(input.selection ?? 0),
    original = draft.options[index];
  if (!Number.isInteger(index) || index < 0 || !original)
    throw new ApiError("Selecciona una ficha válida.");
  const fields = { ...original };
  for (const key of [
    "title",
    "description",
    "supplierCost",
    "currency",
    "images",
    "deliveryDays",
    "deliveryMinDays",
    "category",
    "subcategory",
    "personalizationSupported",
  ])
    if (input[key] !== undefined) fields[key] = input[key];
  if (
    typeof fields.title !== "string" ||
    !fields.title.trim() ||
    fields.title.length > 240
  )
    throw new ApiError("Agrega un título de hasta 240 caracteres.");
  if (
    typeof fields.description !== "string" ||
    fields.description.length > 10000
  )
    throw new ApiError("Descripción inválida.");
  if (fields.currency !== null && !/^[A-Z]{3}$/.test(fields.currency || ""))
    throw new ApiError(
      "Confirma la moneda del proveedor con su código de tres letras.",
    );
  if (
    fields.supplierCost !== null &&
    (fields.supplierCost === "" || nullableNumber(fields.supplierCost) === null)
  )
    throw new ApiError("Costo de proveedor inválido.");
  fields.supplierCost = nullableNumber(fields.supplierCost);
  for (const key of ["deliveryDays", "deliveryMinDays"])
    if (
      fields[key] !== null &&
      fields[key] !== undefined &&
      (!Number.isInteger(Number(fields[key])) ||
        Number(fields[key]) < 0 ||
        Number(fields[key]) > 365)
    )
      throw new ApiError("La entrega debe indicar días entre 0 y 365.");
  fields.deliveryDays = nullableNumber(fields.deliveryDays);
  fields.deliveryMinDays = nullableNumber(fields.deliveryMinDays);
  if (
    fields.deliveryMinDays !== null &&
    fields.deliveryDays !== null &&
    fields.deliveryMinDays > fields.deliveryDays
  )
    throw new ApiError("La entrega mínima supera la máxima.");
  if (
    !Array.isArray(fields.images) ||
    fields.images.length > 12 ||
    fields.images.some((image) => typeof image !== "string")
  )
    throw new ApiError("Agrega hasta 12 URLs de imagen.");
  for (const image of fields.images) await resolveUrl(image);
  const policy = pricingPolicy(input.pricing),
    manual =
      input.publicPrice !== null &&
      input.publicPrice !== undefined &&
      input.publicPrice !== "";
  let suggestedPrice = null;
  try {
    if (policy.marginPercent !== undefined) {
      calculatePricing({ cost: 0, ...policy });
      if (fields.supplierCost !== null && fields.currency)
        suggestedPrice = calculatePricing({
          cost: fields.supplierCost,
          ...policy,
        }).suggestedPrice;
    }
  } catch (error) {
    throw new ApiError(error.message);
  }
  const publicPrice = manual
    ? nullableNumber(input.publicPrice)
    : suggestedPrice;
  if (manual && publicPrice === null)
    throw new ApiError("Precio de venta inválido.");
  const sourceUrl = assertPublicSupplierUrl(draft.sourceUrl).href,
    sourceKey = sourceUrl + "|" + original.identityKey;
  const complete = Boolean(
    fields.description.trim() &&
      fields.images.length &&
      fields.currency &&
      publicPrice !== null &&
      fields.deliveryDays !== null,
  );
  if (
    input.status === "published" &&
    (!complete || input.conditionsConfirmed !== true)
  )
    throw new ApiError(
      "Completa los campos y confirma las condiciones para publicar. También puedes guardar como borrador.",
    );
  const now = new Date().toISOString();
  return repository.mutate((state) => {
    const previous =
      state.products[draft.productId] ||
      Object.values(state.products).find((p) => p.sourceKey === sourceKey);
    if (
      draft.alternativeId &&
      previous?.gtin &&
      original.gtin &&
      previous.gtin !== original.gtin
    )
      throw new ApiError(
        "Los GTIN de la variante elegida no coinciden; no se cambió el proveedor.",
      );
    const id = previous?.id || randomUUID(),
      overrides = {};
    const chosenCategory = fields.category ?? previous?.category ?? "Regalos";
    const chosenClassification = classification({
      category: chosenCategory,
      subcategory:
        fields.subcategory ??
        (chosenCategory === previous?.category ? previous?.subcategory : "") ??
        "",
    });
    for (const key of [
      "title",
      "description",
      "images",
      "supplierCost",
      "currency",
      "deliveryDays",
      "deliveryMinDays",
    ])
      if (
        input[key] !== undefined &&
        JSON.stringify(fields[key]) !== JSON.stringify(original[key] ?? null)
      )
        overrides[key] = fields[key];
    const product = {
      ...previous,
      id,
      slug:
        previous?.slug ||
        fields.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-") +
          "-" +
          id.slice(0, 6),
      title: fields.title.trim(),
      description: fields.description.trim(),
      images: fields.images,
      currency: fields.currency,
      ...chosenClassification,
      personalizationSupported: fields.personalizationSupported === true,
      supplierCost: fields.supplierCost,
      supplierUrl: sourceUrl,
      sourceKey,
      sourceIdentity: original.identityKey,
      sourceOriginal: original,
      gtin: original.gtin || previous?.gtin || "",
      sku: original.sku || "",
      mpn: original.mpn || previous?.mpn || "",
      brand: original.brand || previous?.brand || "",
      variant: original.variant || "",
      deliveryDays: fields.deliveryDays,
      deliveryMinDays: fields.deliveryMinDays,
      stockStatus: original.stockStatus,
      pricing: policy,
      suggestedPrice,
      publicPrice,
      manualPublicPrice: manual,
      overrides,
      evidence: {
        ...original.evidence,
        ...Object.fromEntries(
          Object.keys(overrides).map((key) => [
            key,
            { method: "manual", value: fields[key], approvedAt: now },
          ]),
        ),
      },
      conditionsConfirmed: input.conditionsConfirmed === true,
      status: input.status === "published" ? "published" : "draft",
      sourceStatus: "ok",
      lastCheckedAt: original.checkedAt,
      nextCheckAt: nextReviewAt(),
      updatedAt: now,
      createdAt: previous?.createdAt || now,
    };
    if (previous?.supplierUrl && previous.supplierUrl !== sourceUrl) {
      const alternatives = (state.alternatives[id] ||= []);
      const old = {
        id: randomUUID(),
        url: previous.supplierUrl,
        identityKey: previous.sourceIdentity,
        observed: previous.sourceOriginal,
        matchStatus: alternativeIdentity(
          product,
          previous.sourceOriginal || previous,
        )
          ? "verified"
          : "candidate",
        sourceStatus: previous.sourceStatus,
        checkedAt: previous.lastCheckedAt,
        nextCheckAt: nextReviewAt(),
        comparison:
          "Proveedor principal anterior. Revisa sus condiciones antes de volver a utilizarlo.",
      };
      state.alternatives[id] = [
        ...alternatives.filter((a) => a.url !== sourceUrl && a.url !== old.url),
        old,
      ].slice(-20);
      const checks = (state.checks[id] ||= []);
      checks.push({
        id: randomUUID(),
        kind: "switch",
        url: sourceUrl,
        previousUrl: previous.supplierUrl,
        status: "approved_switch",
        checkedAt: now,
      });
      state.checks[id] = checks.slice(-200);
    }
    state.products[id] = product;
    state.drafts[draftId] = {
      ...draft,
      status: "applied",
      productId: id,
      appliedAt: now,
    };
    return product;
  });
}
