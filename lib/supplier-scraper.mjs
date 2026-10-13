import { load } from "cheerio";
import {
  normalizeSupplierProduct,
  nullableNumber,
  identityKey,
} from "../packages/core/supplier.mjs";
import { assertPublicSupplierUrl } from "../packages/core/url-safety.mjs";
import { fetchSupplierPage, SupplierError } from "./public-fetch.mjs";

const clean = (value, max = 10000) =>
  typeof value === "string" || typeof value === "number"
    ? load(String(value), null, false)
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";
const type = (node, wanted) =>
  [node?.["@type"]]
    .flat()
    .some((value) => String(value).split("/").at(-1) === wanted);
function nodes(value, depth = 0) {
  if (depth > 30) return [];
  if (Array.isArray(value))
    return value.flatMap((item) => nodes(item, depth + 1));
  if (!value || typeof value !== "object") return [];
  return [
    value,
    ...Object.values(value).flatMap((item) => nodes(item, depth + 1)),
  ];
}
function imageUrls(value, source) {
  const images = [];
  for (const item of [value].flat().filter(Boolean)) {
    const text = typeof item === "string" ? item : item.contentUrl || item.url;
    if (typeof text !== "string") continue;
    try {
      const url = assertPublicSupplierUrl(new URL(text, source).href).href;
      if (!images.includes(url)) images.push(url);
    } catch {}
  }
  return images.slice(0, 12);
}
function deliveryInfo(offer) {
  const details = [offer.shippingDetails].flat().filter(Boolean);
  if (details.length !== 1) return {};
  const handling = details[0].deliveryTime?.handlingTime,
    transit = details[0].deliveryTime?.transitTime;
  if (
    !handling ||
    !transit ||
    [handling, transit].some(
      (x) => !["DAY", "D"].includes(String(x.unitCode).toUpperCase()),
    )
  )
    return {};
  const low = nullableNumber(handling.minValue),
    high = nullableNumber(handling.maxValue),
    tlow = nullableNumber(transit.minValue),
    thigh = nullableNumber(transit.maxValue);
  if (
    [low, high, tlow, thigh].includes(null) ||
    high < low ||
    thigh < tlow ||
    high + thigh > 365
  )
    return {};
  return {
    deliveryMinDays: low + tlow,
    deliveryDays: high + thigh,
    deliveryDestination: details[0].shippingDestination || null,
  };
}
export function extractSupplierProducts(html, source) {
  const $ = load(html),
    structured = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      structured.push(JSON.parse($(element).text()));
    } catch {}
  });
  if (!structured.length)
    try {
      structured.push(JSON.parse(html));
    } catch {}
  const products = structured
      .flatMap((root) => nodes(root))
      .filter((node) => type(node, "Product")),
    options = [];
  for (const item of products) {
    const offers = [item.offers || {}].flat();
    for (const offer of offers.length ? offers : [{}]) {
      if (!offer || typeof offer !== "object") continue;
      const info = deliveryInfo(offer),
        brand = typeof item.brand === "object" ? item.brand?.name : item.brand;
      const rawCost = type(offer, "AggregateOffer")
        ? null
        : nullableNumber(offer.price);
      const currency = /^[A-Z]{3}$/.test(offer.priceCurrency || "")
        ? offer.priceCurrency
        : null;
      const fields = {
        ...normalizeSupplierProduct({
          title: clean(item.name, 240),
          description: clean(item.description),
          images: imageUrls(item.image, source),
          cost: rawCost,
          deliveryDays: info.deliveryDays,
          supplierUrl: source,
        }),
        ...info,
        currency,
        sku: clean(offer.sku || item.sku, 120),
        mpn: clean(item.mpn || item.model, 120),
        gtin: clean(
          item.gtin || item.gtin13 || item.gtin14 || item.gtin12 || item.gtin8,
          32,
        ),
        brand: clean(brand, 120),
        variant: clean(
          offer.name || [item.color, item.size].filter(Boolean).join(" / "),
          120,
        ),
        stockStatus:
          clean(offer.availability, 120).split("/").at(-1) || "unknown",
        sourceUrl: source,
        method: "json_ld",
        checkedAt: new Date().toISOString(),
      };
      fields.identityKey = identityKey(fields);
      fields.evidence = Object.fromEntries(
        [
          "title",
          "description",
          "images",
          "supplierCost",
          "currency",
          "deliveryDays",
          "deliveryMinDays",
          "gtin",
          "sku",
          "mpn",
          "variant",
        ]
          .filter(
            (key) =>
              fields[key] !== null &&
              fields[key] !== undefined &&
              fields[key] !== "",
          )
          .map((key) => [
            key,
            { value: fields[key], url: source, method: "json_ld" },
          ]),
      );
      fields.missing = [
        "title",
        "description",
        "images",
        "supplierCost",
        "currency",
        "deliveryDays",
      ].filter(
        (key) =>
          fields[key] === null ||
          fields[key] === undefined ||
          fields[key] === "" ||
          (Array.isArray(fields[key]) && !fields[key].length),
      );
      fields.warnings = type(offer, "AggregateOffer")
        ? ["El proveedor publica un rango: confirma variante y costo unitario."]
        : [
            "Confirma unidad, cantidad mínima, impuestos, destino y permiso de uso de imágenes.",
          ];
      options.push(fields);
    }
  }
  if (!options.length) {
    const meta = (key) =>
      $(`meta[property="${key}"],meta[name="${key}"]`).first().attr("content");
    if (
      meta("og:type") !== "product" &&
      meta("product:price:amount") === undefined
    )
      return [];
    const fields = {
      ...normalizeSupplierProduct({
        title: clean(meta("og:title"), 240),
        description: clean(meta("og:description") || meta("description")),
        images: imageUrls(meta("og:image"), source),
        cost: nullableNumber(meta("product:price:amount")),
        supplierUrl: source,
      }),
      currency: /^[A-Z]{3}$/.test(meta("product:price:currency") || "")
        ? meta("product:price:currency")
        : null,
      sourceUrl: source,
      method: "open_graph",
      checkedAt: new Date().toISOString(),
      stockStatus: "unknown",
      warnings: [
        "Metadatos parciales: confirma la identidad y condiciones del producto.",
      ],
    };
    fields.identityKey = identityKey(fields);
    fields.evidence = Object.fromEntries(
      ["title", "description", "images", "supplierCost", "currency"].map(
        (key) => [
          key,
          { value: fields[key], url: source, method: "open_graph" },
        ],
      ),
    );
    fields.missing = [
      "title",
      "description",
      "images",
      "supplierCost",
      "currency",
      "deliveryDays",
    ].filter(
      (key) =>
        fields[key] == null ||
        fields[key] === "" ||
        (Array.isArray(fields[key]) && !fields[key].length),
    );
    options.push(fields);
  }
  const seen = new Set();
  return options
    .filter((option) => {
      const key =
        option.identityKey + "|" + option.supplierCost + "|" + option.currency;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}
export async function scrapeSupplierOptions(
  value,
  { fetchPage = fetchSupplierPage } = {},
) {
  const url = assertPublicSupplierUrl(value),
    result = await fetchPage(url.href);
  const options = extractSupplierProducts(result.text, result.url);
  if (!options.length)
    throw new SupplierError(
      "No se encontró una ficha extraíble. Este proveedor puede necesitar una API o un adaptador para JavaScript.",
    );
  return { sourceUrl: url.href, finalUrl: result.url, options };
}
export async function scrapeSupplierUrl(value, options) {
  const result = await scrapeSupplierOptions(value, options);
  if (result.options.length !== 1)
    throw new SupplierError(
      "El enlace contiene varias fichas o variantes; selecciona una explícitamente.",
      "SUPPLIER_VARIANT",
    );
  return result.options[0];
}
