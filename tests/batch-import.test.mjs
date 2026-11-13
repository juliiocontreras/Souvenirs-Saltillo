import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCatalogRepository } from "../packages/core/repository.mjs";
import { extractSupplierProducts } from "../lib/supplier-scraper.mjs";
import {
  MAX_BATCH_URLS,
  enqueueBatchImports,
  processBatchItem,
  processNextBatchItem,
  removeBatchItem,
} from "../lib/catalog-service.mjs";

function fixtureHtml({ name = "Taza de prueba", price = 100 } = {}) {
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: "Taza cerámica 350 ml",
    image: ["https://images.example.com/mug.png"],
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "MXN",
      availability: "https://schema.org/InStock",
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(product)}</script>`;
}
const fixtureScrape = async (url) => ({
  sourceUrl: url,
  finalUrl: url,
  options: extractSupplierProducts(fixtureHtml(), url),
});
const failingScrape = async () => {
  throw new Error("Proveedor no responde.");
};
const first = "https://supplier.example.com/product-1";
const second = "https://supplier.example.com/product-2";

async function enqueue(repository, urls) {
  return enqueueBatchImports(repository, urls);
}

test("enqueue rechaza lotes vacíos, no-listas y mayores de 20", async () => {
  const repository = new MemoryCatalogRepository();
  for (const bad of [[], ["", "   "], "no-es-una-lista", null]) {
    await assert.rejects(enqueue(repository, bad), (error) => {
      assert.equal(error.status, 422);
      assert.match(error.message, /al menos un enlace/);
      return true;
    });
  }
  const tooMany = Array.from(
    { length: MAX_BATCH_URLS + 1 },
    (_, index) => `https://supplier.example.com/p-${index}`,
  );
  await assert.rejects(enqueue(repository, tooMany), (error) => {
    assert.equal(error.status, 422);
    assert.match(error.message, /20/);
    return true;
  });
  assert.deepEqual(await repository.listQueuedImports(), []);
});

test("enqueue ignora líneas vacías y marca inválidos con su motivo", async () => {
  const repository = new MemoryCatalogRepository();
  const result = await enqueue(repository, [
    "",
    "   ",
    first,
    "nota-url",
    "http://localhost/x",
    "ftp://supplier.example.com/x",
  ]);
  assert.equal(result.queuedCount, 1);
  assert.equal(result.invalidCount, 3);
  assert.deepEqual(
    result.invalid.map((entry) => entry.url),
    ["nota-url", "http://localhost/x", "ftp://supplier.example.com/x"],
  );
  assert.ok(result.invalid.every((entry) => entry.reason));
  assert.deepEqual(await repository.listQueuedImports(), result.queued);
});

test("enqueue omite duplicados dentro del lote aunque cambie la capitalización", async () => {
  const repository = new MemoryCatalogRepository();
  const result = await enqueue(repository, [
    first,
    "HTTPS://SUPPLIER.EXAMPLE.COM/product-1",
    first,
    second,
  ]);
  assert.equal(result.queuedCount, 2);
  assert.equal(result.duplicateCount, 2);
  assert.ok(
    result.duplicates.every((entry) => entry.reason.includes("duplicado")),
  );
});

test("enqueue omite enlaces ya en cola, con ficha pendiente o ya importados", async () => {
  const repository = new MemoryCatalogRepository();
  await repository.saveProduct({
    id: "imported",
    supplierUrl: first,
    status: "published",
  });
  await repository.saveDraft({
    id: "preview",
    sourceUrl: second,
    status: "preview",
    createdAt: "2026-11-12T00:00:00Z",
    options: [],
  });
  const third = "https://supplier.example.com/product-3";
  const result = await enqueue(repository, [first, second, third]);
  assert.equal(result.queuedCount, 1);
  assert.equal(result.queued[0].sourceUrl, third);
  assert.equal(result.duplicateCount, 2);
  assert.deepEqual(
    result.duplicates.map((entry) => entry.reason).sort(),
    ["Ya está importado en el catálogo.", "Ya tiene una ficha pendiente de revisión."],
  );
  const again = await enqueue(repository, [third]);
  assert.equal(again.queuedCount, 0);
  assert.equal(again.duplicateCount, 1);
  assert.equal(again.duplicates[0].reason, "Ya está en la cola de importación.");
});

test("listQueuedImports ordena del más antiguo y excluye fichas preview", async () => {
  const repository = new MemoryCatalogRepository();
  await repository.saveDraft({
    id: "preview",
    sourceUrl: second,
    status: "preview",
    createdAt: "2026-11-12T00:00:00Z",
    options: [],
  });
  await enqueue(repository, [second, first]);
  const queue = await repository.listQueuedImports();
  // "second" ya tenía ficha preview, así que solo "first" quedó en cola.
  assert.deepEqual(
    queue.map((item) => item.sourceUrl),
    [first],
  );
  assert.equal(queue[0].status, "queued");
  assert.equal(queue[0].attempts, 0);
  assert.equal(queue[0].lastError, null);
});

test("processNext crea la ficha preview y borra el elemento de la cola", async () => {
  const repository = new MemoryCatalogRepository();
  const enqueued = await enqueue(repository, [first, second]);
  const result = await processNextBatchItem(repository, {
    scrape: fixtureScrape,
  });
  assert.equal(result.status, "done");
  assert.equal(result.draft.sourceUrl, first);
  const queue = await repository.listQueuedImports();
  assert.deepEqual(
    queue.map((item) => item.sourceUrl),
    [second],
  );
  const inbox = await repository.listPendingImports();
  assert.deepEqual(
    inbox.map((item) => item.id),
    [result.draft.id],
  );
  assert.equal(inbox[0].title, "Taza de prueba");
  assert.equal(enqueued.queued[0].id, result.item.id);
});

test("processNext vacío no hace nada", async () => {
  const repository = new MemoryCatalogRepository();
  assert.deepEqual(await processNextBatchItem(repository, {
    scrape: fixtureScrape,
  }), { status: "empty", remaining: 0 });
});

test("un fallo marca error, no bloquea la cola y el reintento funciona", async () => {
  const repository = new MemoryCatalogRepository();
  await enqueue(repository, [first, second]);
  const failed = await processNextBatchItem(repository, {
    scrape: failingScrape,
  });
  assert.equal(failed.status, "error");
  assert.equal(failed.error, "Proveedor no responde.");
  assert.equal(failed.item.attempts, 1);
  assert.equal(failed.item.lastError, "Proveedor no responde.");
  // El enlace con error sigue en cola, pero el siguiente procesa el otro.
  const next = await processNextBatchItem(repository, {
    scrape: fixtureScrape,
  });
  assert.equal(next.status, "done");
  assert.equal(next.draft.sourceUrl, second);
  // Solo queda el enlace con error; processNext ya no lo toma solo.
  assert.deepEqual(await processNextBatchItem(repository, {
    scrape: fixtureScrape,
  }), { status: "empty", remaining: 1 });
  // El reintento explícito sí lo procesa, sin duplicar.
  const [failedItem] = await repository.listQueuedImports();
  const retried = await processBatchItem(repository, failedItem.id, {
    scrape: fixtureScrape,
  });
  assert.equal(retried.status, "done");
  assert.equal(retried.draft.sourceUrl, first);
  assert.deepEqual(await repository.listQueuedImports(), []);
  assert.equal((await repository.listPendingImports()).length, 2);
});

test("processBatchItem respeta el lease de una importación en curso", async () => {
  const repository = new MemoryCatalogRepository();
  const { queued } = await enqueue(repository, [first]);
  assert.equal(
    await repository.acquireLease("supplier-import", "other-owner", 120000),
    true,
  );
  await assert.rejects(
    processBatchItem(repository, queued[0].id, { scrape: fixtureScrape }),
    (error) => {
      assert.equal(error.status, 409);
      assert.match(error.message, /otra importación en curso/);
      return true;
    },
  );
  assert.equal((await repository.listQueuedImports()).length, 1);
});

test("removeBatchItem quita el enlace y rechaza lo que no está en cola", async () => {
  const repository = new MemoryCatalogRepository();
  const { queued } = await enqueue(repository, [first]);
  await repository.saveDraft({
    id: "preview",
    sourceUrl: second,
    status: "preview",
    createdAt: "2026-11-12T00:00:00Z",
    options: [],
  });
  assert.deepEqual(await removeBatchItem(repository, queued[0].id), {
    removed: queued[0].id,
  });
  assert.deepEqual(await repository.listQueuedImports(), []);
  await assert.rejects(removeBatchItem(repository, queued[0].id), (error) => {
    assert.equal(error.status, 404);
    return true;
  });
  await assert.rejects(removeBatchItem(repository, "preview"), (error) => {
    assert.equal(error.status, 404);
    return true;
  });
  await assert.rejects(processBatchItem(repository, "missing", {
    scrape: fixtureScrape,
  }), (error) => {
    assert.equal(error.status, 404);
    return true;
  });
});
