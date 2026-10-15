import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  whatsappContactUrl,
  resolveContactSettings,
} from "../packages/core/contact.mjs";
import { FileCatalogRepository } from "../packages/core/repository.mjs";

test("WhatsApp contact links use the configured business number and preserve category context", () => {
  const url = new URL(
    whatsappContactUrl("+1 (202) 555-0123", {
      category: "Hogar y cocina",
      subcategory: "Decoración",
    }),
  );
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/12025550123");
  assert.match(url.searchParams.get("text"), /Hogar y cocina · Decoración/);
  assert.match(url.searchParams.get("text"), /Souvenirs Saltillo/);
});

test("missing or invalid contact configuration never creates a fake WhatsApp destination", () => {
  for (const number of [
    undefined,
    "",
    "123",
    "javascript:12025550123",
    "0".repeat(12),
    "1".repeat(16),
    "++12025550123",
  ])
    assert.equal(whatsappContactUrl(number), null);
});

test("business contact survives a restart of an existing file store and disabling overrides server defaults", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saltillo-contact-"));
  const file = join(dir, "catalog.json");
  try {
    // Old data has no settings namespace; saving contact must preserve catalog data.
    await writeFile(file, JSON.stringify({ products: { old: { id: "old", status: "draft" } } }));
    const repository = new FileCatalogRepository(file);
    assert.equal(await repository.getContactSettings(), null);
    assert.equal(resolveContactSettings(null, "+1 (202) 555-0123").whatsappNumber, "12025550123");
    await repository.saveContactSettings({ whatsappNumber: "+1 (202) 555-0123" });
    const restarted = new FileCatalogRepository(file);
    assert.equal((await restarted.getContactSettings()).whatsappNumber, "12025550123");
    assert.ok((await restarted.getContactSettings()).updatedAt);
    assert.equal((await restarted.getProduct("old")).status, "draft");
    await restarted.saveContactSettings({ whatsappNumber: "  " });
    const disabled = await new FileCatalogRepository(file).getContactSettings();
    assert.equal(resolveContactSettings(disabled, "12025550123").whatsappNumber, "");
    assert.equal(resolveContactSettings(null, "invalid").whatsappNumber, "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("invalid or unexpected settings cannot overwrite a saved contact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saltillo-contact-"));
  const repository = new FileCatalogRepository(join(dir, "catalog.json"));
  try {
    const original = await repository.saveContactSettings({ whatsappNumber: "12025550123" });
    for (const input of [
      null, [], {}, { whatsappNumber: 12025550123 },
      { whatsappNumber: "javascript:12025550123" },
      { whatsappNumber: "123" },
      { whatsappNumber: "12025550123", AUTH_SECRET: "forbidden" },
    ]) {
      await assert.rejects(repository.saveContactSettings(input), { status: 422 });
      assert.deepEqual(await repository.getContactSettings(), original);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
