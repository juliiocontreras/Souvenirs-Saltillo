import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { migrateStore } from "../ops/database-copy.mjs";

test("PostgreSQL migration preserves quotes/logos/settings, omits transient auth, and rolls back a failed copy", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const suffix = randomUUID().replaceAll("-", "");
  const sourceSchema = "migration_source_" + suffix;
  const targetSchema = "migration_target_" + suffix;
  const source = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  const target = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await Promise.all([source.connect(), target.connect()]);
  try {
    await source.query(`CREATE SCHEMA ${sourceSchema}`);
    await target.query(`CREATE SCHEMA ${targetSchema}`);
    await source.query(`SET search_path TO ${sourceSchema}`);
    await target.query(`SET search_path TO ${targetSchema}`);
    await source.query("CREATE TABLE souvenirs_catalog_records (namespace text, key text, data jsonb, PRIMARY KEY(namespace,key))");
    await source.query("CREATE TABLE souvenirs_quote_requests (id uuid PRIMARY KEY, data jsonb, logo_data bytea)");
    await source.query("CREATE TABLE souvenirs_orders (id uuid PRIMARY KEY, data jsonb)");
    await source.query("CREATE TABLE souvenirs_stripe_events (id text PRIMARY KEY, data jsonb)");
    await source.query("CREATE TABLE souvenirs_product_images (id uuid PRIMARY KEY, product_id uuid, data bytea NOT NULL, content_type text NOT NULL, filename text NOT NULL, created_at timestamptz NOT NULL)");
    const records = [
      ["products", "p1", { id: "p1", title: "Mochila", supplierCost: 90, publicPrice: 150 }],
      ["settings", "publicContact", { whatsappNumber: "12025550123" }],
      ["searchUsage", "tavily:2026-10", { used: 25 }],
      ["checks", "p1", [{ status: "ok" }]],
      ["alternatives", "p1", [{ url: "https://other.example.test/p" }]],
      ["sessions", "old-token-hash", { expiresAt: 9999999999999 }],
      ["attempts", "counter", { count: 5 }],
      ["leases", "supplier-monitor", { owner: "old-server" }],
    ];
    for (const [namespace, key, data] of records)
      await source.query("INSERT INTO souvenirs_catalog_records VALUES($1,$2,$3)", [namespace, key, JSON.stringify(data)]);
    const id = randomUUID();
    const quote = { id, name: "Cliente de prueba", status: "Nueva", reference: "SS-TEST" };
    const logo = Buffer.from([137,80,78,71,13,10,26,10]);
    await source.query("INSERT INTO souvenirs_quote_requests VALUES($1,$2,$3)", [id, JSON.stringify(quote), logo]);
    const orderId = randomUUID();
    await source.query("INSERT INTO souvenirs_orders VALUES($1,$2)", [orderId, JSON.stringify({ id: orderId, stripeSessionId: "cs_test_1", status: "paid", totalCents: 15000 })]);
    await source.query("INSERT INTO souvenirs_stripe_events VALUES($1,$2)", ["evt_test_1", JSON.stringify({ id: "evt_test_1", type: "checkout.session.completed" })]);
    const imageId = randomUUID();
    const image = Buffer.from([137,80,78,71,13,10,26,10]);
    await source.query("INSERT INTO souvenirs_product_images VALUES($1,$2,$3,$4,$5,$6)", [imageId, null, image, "image/png", "foto.png", "2026-11-09T00:00:00Z"]);
    assert.deepEqual(await migrateStore(source, target), { catalogRecords: 5, quoteRequests: 1, logoBytes: 8, orders: 1, stripeEvents: 1, productImages: 1, productImageBytes: 8 });
    const copied = (await target.query("SELECT namespace,key,data FROM souvenirs_catalog_records ORDER BY namespace")).rows;
    assert.equal(copied.length, 5);
    assert.ok(copied.every(row => !["sessions", "attempts", "leases"].includes(row.namespace)));
    assert.equal(copied.find(row => row.namespace === "settings").data.whatsappNumber, "12025550123");
    assert.equal(copied.find(row => row.namespace === "searchUsage").data.used, 25);
    const saved = (await target.query("SELECT id,data,logo_data FROM souvenirs_quote_requests")).rows[0];
    assert.equal(saved.id, id);
    assert.deepEqual(saved.data, quote);
    assert.deepEqual(saved.logo_data, logo);
    const copiedImage = (await target.query("SELECT id,data,content_type,filename FROM souvenirs_product_images")).rows[0];
    assert.equal(copiedImage.id, imageId);
    assert.deepEqual(copiedImage.data, image);
    assert.equal(copiedImage.content_type, "image/png");
    await assert.rejects(migrateStore(source, target), /debe estar vacía/);
    assert.equal((await target.query("SELECT count(*)::int AS count FROM souvenirs_catalog_records")).rows[0].count, 5);
    await target.query("TRUNCATE souvenirs_catalog_records, souvenirs_quote_requests, souvenirs_orders, souvenirs_stripe_events, souvenirs_product_images");
    await target.query("ALTER TABLE souvenirs_quote_requests ADD CONSTRAINT reject_test_copy CHECK(false)");
    await assert.rejects(migrateStore(source, target), { code: "23514" });
    assert.equal((await target.query("SELECT count(*)::int AS count FROM souvenirs_catalog_records")).rows[0].count, 0);
    assert.equal((await target.query("SELECT count(*)::int AS count FROM souvenirs_quote_requests")).rows[0].count, 0);
    assert.equal((await target.query("SELECT count(*)::int AS count FROM souvenirs_orders")).rows[0].count, 0);
    assert.equal((await target.query("SELECT count(*)::int AS count FROM souvenirs_stripe_events")).rows[0].count, 0);
    assert.equal((await target.query("SELECT count(*)::int AS count FROM souvenirs_product_images")).rows[0].count, 0);
    assert.equal((await source.query("SELECT count(*)::int AS count FROM souvenirs_catalog_records")).rows[0].count, 8);
  } finally {
    await source.query(`DROP SCHEMA IF EXISTS ${sourceSchema} CASCADE`);
    await target.query(`DROP SCHEMA IF EXISTS ${targetSchema} CASCADE`);
    await Promise.all([source.end(), target.end()]);
  }
});
