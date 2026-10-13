import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MemoryCatalogRepository,
  FileCatalogRepository,
} from "../packages/core/repository.mjs";
import { extractSupplierProducts } from "../lib/supplier-scraper.mjs";
import { createImport, applyImport } from "../lib/catalog-service.mjs";
import {
  runSupplierMonitor,
  addAlternative,
  alternativeImport,
} from "../lib/supplier-monitor.mjs";
import { identityKey } from "../packages/core/supplier.mjs";
import {
  sessionToken,
  validSessionToken,
  authConfigured,
} from "../packages/core/auth.mjs";
import {
  resolvePublicSupplier,
  isPublicAddress,
} from "../packages/core/url-safety.mjs";
import { calculatePricing } from "../packages/core/pricing.mjs";
import { nextReviewAt, REVIEW_INTERVAL } from "../packages/core/monitor.mjs";

export function fixtureHtml({
  name = "Taza de prueba",
  price = 100,
  currency = "MXN",
  gtin = "7501234567890",
  delivery = true,
  aggregate = false,
} = {}) {
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: "Taza <b>cerámica</b> 350 ml",
    image: ["https://images.example.com/mug.png"],
    gtin13: gtin,
    sku: "M-350",
    brand: { name: "Marca" },
    mpn: "350",
    color: "blanco",
    offers: {
      "@type": aggregate ? "AggregateOffer" : "Offer",
      price,
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
      ...(delivery
        ? {
            shippingDetails: {
              deliveryTime: {
                handlingTime: { minValue: 1, maxValue: 2, unitCode: "DAY" },
                transitTime: { minValue: 2, maxValue: 4, unitCode: "DAY" },
              },
            },
          }
        : {}),
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(product)}</script>`;
}
const primary = "https://supplier.example.com/product";
const fixtureScrape = async (url, args) => ({
  sourceUrl: url,
  finalUrl: url,
  options: extractSupplierProducts(fixtureHtml(args), url),
});
const noSearch = async () => ({ status: "unconfigured", urls: [] });
const safeResolve = async (url) => ({
  url: new URL(url),
  addresses: [{ address: "93.184.216.34", family: 4 }],
});
async function published(repository, edits = {}) {
  const draft = await createImport(repository, primary, {
    scrape: fixtureScrape,
  });
  return applyImport(
    repository,
    draft.id,
    {
      selection: 0,
      pricing: { marginPercent: 30 },
      conditionsConfirmed: true,
      status: "published",
      ...edits,
    },
    { resolveUrl: safeResolve },
  );
}

test("auth has no unset fallback, expires and rejects changed credentials", () => {
  assert.equal(
    authConfigured({ ADMIN_PASSWORD: "password", AUTH_SECRET: "unset" }),
    false,
  );
  assert.throws(() => sessionToken("unset"));
  const secret = "s".repeat(32),
    expires = Date.now() + 10000,
    token = sessionToken(secret, expires);
  assert.equal(validSessionToken(token, secret), true);
  assert.equal(validSessionToken(token, secret, expires), false);
  assert.equal(validSessionToken(token, "x".repeat(32)), false);
  assert.notEqual(sessionToken(secret, expires), token);
});
test("file repository survives instances and concurrent transactions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saltillo-store-"));
  try {
    const a = new FileCatalogRepository(join(dir, "catalog.json")),
      b = new FileCatalogRepository(join(dir, "catalog.json"));
    await Promise.all(
      Array.from({ length: 15 }, (_, index) =>
        (index % 2 ? a : b).saveProduct({
          id: String(index),
          title: "Producto " + index,
        }),
      ),
    );
    assert.equal(
      (
        await new FileCatalogRepository(
          join(dir, "catalog.json"),
        ).listProducts()
      ).length,
      15,
    );
    assert.equal((await a.listPublicProducts()).length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("JSON-LD extraction keeps missing delivery and aggregate price unknown", () => {
  const full = extractSupplierProducts(fixtureHtml(), primary)[0];
  assert.equal(full.description, "Taza cerámica 350 ml");
  assert.equal(full.deliveryMinDays, 3);
  assert.equal(full.deliveryDays, 6);
  const partial = extractSupplierProducts(
    fixtureHtml({ delivery: false, aggregate: true }),
    primary,
  )[0];
  assert.equal(partial.supplierCost, null);
  assert.equal(partial.deliveryDays, null);
  assert.ok(partial.missing.includes("supplierCost"));
});
test("multiple variants require an explicit selection and stay separate", async () => {
  const products = JSON.parse(fixtureHtml().match(/>(.*)</s)[1]);
  const variants = [products, { ...products, color: "azul", sku: "M-BLUE" }];
  const options = extractSupplierProducts(
    `<script type="application/ld+json">${JSON.stringify(variants)}</script>`,
    primary,
  );
  assert.equal(options.length, 2);
  assert.notEqual(options[0].identityKey, options[1].identityKey);
  const repository = new MemoryCatalogRepository();
  await repository.saveDraft({
    id: "variant-preview",
    sourceUrl: primary,
    options,
  });
  await assert.rejects(
    applyImport(
      repository,
      "variant-preview",
      {
        status: "published",
        conditionsConfirmed: true,
        pricing: { marginPercent: 30 },
      },
      { resolveUrl: safeResolve },
    ),
    /variante/,
  );
});
test("publishing requires complete data and confirmation, repeated imports are idempotent", async () => {
  const repository = new MemoryCatalogRepository(),
    draft = await createImport(repository, primary, { scrape: fixtureScrape });
  await assert.rejects(
    applyImport(
      repository,
      draft.id,
      { status: "published", pricing: { marginPercent: 30 } },
      { resolveUrl: safeResolve },
    ),
    /confirma/,
  );
  const first = await published(repository),
    second = await published(repository);
  assert.equal(first.id, second.id);
  assert.equal((await repository.listProducts()).length, 1);
  const publicProduct = (await repository.listPublicProducts())[0];
  assert.equal(publicProduct.publicPrice, 143);
  assert.equal(publicProduct.supplierUrl, undefined);
  assert.equal(publicProduct.supplierCost, undefined);
  assert.equal(publicProduct.evidence, undefined);
});
test("monitor proposes changed price and preserves approved manual content and public price", async () => {
  const repository = new MemoryCatalogRepository(),
    product = await published(repository, {
      title: "Mi taza",
      publicPrice: 199,
    });
  const run = await runSupplierMonitor(repository, {
    force: true,
    scrape: (url) => fixtureScrape(url, { price: 110 }),
    search: noSearch,
  });
  const updated = await repository.getProduct(product.id);
  assert.equal(run.checked, 1);
  assert.equal(updated.sourceStatus, "changed");
  assert.equal(updated.sourceObservation.supplierCost, 110);
  assert.equal(updated.title, "Mi taza");
  assert.equal(updated.supplierCost, 100);
  assert.equal(updated.publicPrice, 199);
  assert.equal(run.search[0].status, "unconfigured");
});
test("retired and blocked sources remain distinct and retain last approved data", async () => {
  for (const [code, expected] of [
    ["SUPPLIER_REMOVED", "removed"],
    ["SUPPLIER_BLOCKED", "blocked"],
    ["SUPPLIER_RATE_LIMIT", "rate_limited"],
  ]) {
    const repository = new MemoryCatalogRepository(),
      product = await published(repository);
    await runSupplierMonitor(repository, {
      force: true,
      search: noSearch,
      scrape: async () => {
        const error = new Error("HTTP failure");
        error.code = code;
        throw error;
      },
    });
    const updated = await repository.getProduct(product.id);
    assert.equal(updated.sourceStatus, expected);
    assert.equal(updated.supplierCost, 100);
    assert.equal(updated.publicPrice, 143);
  }
});
test("currency and variant changes require review and do not modify the public product", async () => {
  const repository = new MemoryCatalogRepository(),
    product = await published(repository);
  await runSupplierMonitor(repository, {
    force: true,
    scrape: (url) => fixtureScrape(url, { currency: "USD" }),
    search: noSearch,
  });
  assert.equal(
    (await repository.getProduct(product.id)).sourceStatus,
    "currency_review",
  );
  await runSupplierMonitor(repository, {
    force: true,
    scrape: (url) => fixtureScrape(url, { gtin: "0000000000000" }),
    search: noSearch,
  });
  assert.equal(
    (await repository.getProduct(product.id)).sourceStatus,
    "identity_review",
  );
});
test("alternative identity conflicts are candidates; approved switch keeps the original product and old source", async () => {
  const repository = new MemoryCatalogRepository(),
    product = await published(repository);
  const bad = await addAlternative(
    repository,
    product.id,
    "https://other.example.com/wrong",
    { scrape: (url) => fixtureScrape(url, { gtin: "0000000000000" }) },
  );
  assert.equal(bad.matchStatus, "candidate");
  await assert.rejects(
    alternativeImport(repository, product.id, bad.id, {
      scrape: fixtureScrape,
    }),
    /verificada/,
  );
  const good = await addAlternative(
    repository,
    product.id,
    "https://other.example.com/good",
    { scrape: (url) => fixtureScrape(url, { price: 90 }) },
  );
  assert.equal(good.matchStatus, "verified");
  const draft = await alternativeImport(repository, product.id, good.id, {
    scrape: (url) => fixtureScrape(url, { price: 90 }),
  });
  assert.equal((await repository.getProduct(product.id)).supplierUrl, primary);
  const updated = await applyImport(
    repository,
    draft.id,
    {
      selection: draft.selection,
      status: "published",
      conditionsConfirmed: true,
      pricing: { marginPercent: 30 },
    },
    { resolveUrl: safeResolve },
  );
  assert.equal(updated.id, product.id);
  assert.equal(updated.supplierUrl, good.url);
  assert.equal(updated.supplierCost, 90);
  assert.equal(
    (await repository.listAlternatives(product.id)).at(-1).url,
    primary,
  );
  assert.equal(
    (await repository.listSupplierChecks(product.id)).at(-1).kind,
    "switch",
  );
});
test("monitor lease excludes overlapping runs and batches resume pending links", async () => {
  const repository = new MemoryCatalogRepository();
  await published(repository);
  await repository.acquireLease("supplier-monitor", "other");
  assert.equal(
    (await runSupplierMonitor(repository)).status,
    "already_running",
  );
  await repository.releaseLease("supplier-monitor", "other");
  await repository.saveProduct({
    ...(await repository.listProducts())[0],
    id: "another",
    supplierUrl: "https://supplier.example.com/second",
  });
  const first = await runSupplierMonitor(repository, {
    force: true,
    batchSize: 1,
    scrape: fixtureScrape,
    search: noSearch,
  });
  assert.equal(first.remaining, 1);
  const second = await runSupplierMonitor(repository, {
    batchSize: 1,
    scrape: fixtureScrape,
    search: noSearch,
  });
  assert.equal(second.remaining, 0);
  assert.equal(second.checked, 1);
});
test("DNS rejects a mixture of public and private addresses and mapped IPv6", async () => {
  const resolver = async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ];
  await assert.rejects(resolvePublicSupplier(primary, resolver), /restringida/);
  for (const address of [
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "169.254.169.254",
    "100.64.0.1",
  ])
    assert.equal(isPublicAddress(address), false);
});
test("pricing includes landed cost, fees and tax; does not turn missing cost into zero", () => {
  assert.equal(
    calculatePricing({
      cost: 100,
      marginPercent: 30,
      shipping: 10,
      otherCosts: 5,
      fixedFee: 2,
      feePercent: 5,
      taxPercent: 16,
      rounding: 0.5,
    }).suggestedPrice,
    209,
  );
  assert.throws(() => calculatePricing({ cost: null, marginPercent: 30 }));
  assert.throws(() =>
    calculatePricing({ cost: 100, marginPercent: 90, feePercent: 10 }),
  );
});
test("next review follows the actual UTC workflow cadence within four hours", () => {
  const now = Date.parse("2026-10-12T01:00:00Z"),
    next = Date.parse(nextReviewAt(now));
  assert.equal(new Date(next).getUTCMinutes(), 17);
  assert.equal(new Date(next).getUTCHours() % 4, 0);
  assert.ok(next > now && next - now <= REVIEW_INTERVAL);
});

test("reimport preview retains manual branding, price and fee policy but refreshes unedited supplier cost", async () => {
  const repository = new MemoryCatalogRepository();
  await published(repository, {
    title: "Mi taza",
    publicPrice: 199,
    pricing: { marginPercent: 30, shipping: 10 },
  });
  const draft = await createImport(repository, primary, {
    scrape: (url) => fixtureScrape(url, { price: 110 }),
  });
  const approved = draft.approvedByIdentity[draft.options[0].identityKey];
  assert.equal(approved.overrides.title, "Mi taza");
  assert.equal(approved.pricing.shipping, 10);
  assert.equal(approved.publicPrice, 199);
  assert.equal(approved.overrides.supplierCost, undefined);
  assert.equal(draft.options[0].supplierCost, 110);
});

test("a title change on a stable identified product is reviewed without duplicating the catalog item", async () => {
  const repository = new MemoryCatalogRepository(),
    product = await published(repository);
  const changed = (url) =>
    fixtureScrape(url, { name: "Taza de prueba · nueva edición" });
  await runSupplierMonitor(repository, {
    force: true,
    scrape: changed,
    search: noSearch,
  });
  assert.equal(
    (await repository.getProduct(product.id)).sourceStatus,
    "changed",
  );
  const draft = await createImport(repository, primary, { scrape: changed });
  const updated = await applyImport(
    repository,
    draft.id,
    {
      status: "published",
      conditionsConfirmed: true,
      pricing: { marginPercent: 30 },
    },
    { resolveUrl: safeResolve },
  );
  assert.equal(updated.id, product.id);
  assert.equal((await repository.listProducts()).length, 1);
  assert.equal(updated.title, "Taza de prueba · nueva edición");
});

test("a candidate without identifiers needs explicit human identity confirmation and cannot override conflicting GTIN", async () => {
  const repository = new MemoryCatalogRepository(),
    product = await published(repository);
  const withoutIds = async (url) => {
    const result = await fixtureScrape(url, { gtin: "" });
    for (const candidate of result.options) {
      candidate.brand = "";
      candidate.mpn = "";
      candidate.identityKey = identityKey(candidate);
    }
    return result;
  };
  const candidate = await addAlternative(
    repository,
    product.id,
    "https://other.example.com/no-ids",
    { scrape: withoutIds },
  );
  assert.equal(candidate.matchStatus, "candidate");
  await assert.rejects(
    alternativeImport(repository, product.id, candidate.id, {
      scrape: withoutIds,
    }),
    /verificada/,
  );
  const draft = await alternativeImport(repository, product.id, candidate.id, {
    scrape: withoutIds,
    identityConfirmed: true,
  });
  assert.equal(draft.manualIdentityConfirmed, true);
  assert.equal((await repository.getProduct(product.id)).supplierUrl, primary);
  const switched = await applyImport(
    repository,
    draft.id,
    {
      selection: draft.selection,
      status: "published",
      conditionsConfirmed: true,
      pricing: { marginPercent: 30 },
    },
    { resolveUrl: safeResolve },
  );
  assert.equal(switched.gtin, product.gtin);
  const former = (await repository.listAlternatives(product.id)).find(
    (alternative) => alternative.url === primary,
  );
  const restoredPreview = await alternativeImport(
    repository,
    product.id,
    former.id,
    { scrape: fixtureScrape },
  );
  assert.equal(restoredPreview.productId, product.id);
  assert.equal(
    (await repository.getProduct(product.id)).supplierUrl,
    candidate.url,
  );
  const conflict = await addAlternative(
    repository,
    product.id,
    "https://other.example.com/conflict",
    { scrape: (url) => fixtureScrape(url, { gtin: "0000000000000" }) },
  );
  await assert.rejects(
    alternativeImport(repository, product.id, conflict.id, {
      scrape: (url) => fixtureScrape(url, { gtin: "0000000000000" }),
      identityConfirmed: true,
    }),
    /GTIN/,
  );
});
