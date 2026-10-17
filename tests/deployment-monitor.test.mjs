import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webMonitorOptions } from "../packages/core/monitor.mjs";
import { MemoryCatalogRepository } from "../packages/core/repository.mjs";
import { runSupplierMonitor } from "../lib/supplier-monitor.mjs";

test("light web monitoring checks one supplier and leaves full searches to the scheduled worker", async () => {
  const repository = new MemoryCatalogRepository();
  for (const id of ["first", "second"]) {
    await repository.saveProduct({ id, supplierUrl: "https://supplier.example.test/" + id });
  }
  let checked = 0;
  const run = await runSupplierMonitor(repository, {
    ...webMonitorOptions({ MONITOR_WEB_MODE: "light" }),
    scrape: async () => {
      checked++;
      throw new Error("Synthetic unavailable supplier");
    },
  });
  assert.equal(run.status, "completed");
  assert.equal(checked, 1);
  assert.equal(run.remaining, 1);
  assert.equal(run.search[0].status, "scheduled");
  assert.deepEqual(await repository.searchUsage("tavily"), {
    provider: "tavily", month: new Date().toISOString().slice(0, 7), used: 0,
  });
  assert.deepEqual(webMonitorOptions({}), {});
});

test("CLI monitoring persists private details but its output contains only counts", async () => {
  const folder = await mkdtemp(join(tmpdir(), "saltillo-cli-"));
  try {
    const file = join(folder, "catalog.json");
    const privateId = "PRIVATE-PRODUCT-CANARY";
    await writeFile(file, JSON.stringify({ products: {
      [privateId]: { id: privateId, title: "Private supplier", supplierUrl: "http://127.0.0.1/secret" },
    }}));
    const { stdout } = await promisify(execFile)(process.execPath, ["scripts/monitor-suppliers.mjs"], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "", CATALOG_DATA_FILE: file,
        SEARCH_PROVIDER: "", SEARCH_API_KEY: "" },
      timeout: 15000,
    });
    const summary = JSON.parse(stdout.trim());
    assert.deepEqual(summary, { status: "completed", checked: 1, remaining: 0, added: 0, issues: 1, searches: 1 });
    assert.ok(!stdout.includes(privateId));
    assert.ok(!stdout.includes("127.0.0.1"));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
