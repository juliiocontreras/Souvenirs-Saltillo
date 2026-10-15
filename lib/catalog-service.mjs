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
