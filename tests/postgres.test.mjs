import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { PostgresCatalogRepository } from "../packages/core/repository.mjs";
test(
  "Postgres persists across instances and serializes concurrent updates",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        max: 4,
      }),
      first = new PostgresCatalogRepository(pool),
      second = new PostgresCatalogRepository(pool);
    try {
      await Promise.all([first.initialize(), second.initialize()]);
      await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          (index % 2 ? first : second).saveProduct({
            id: "postgres-test-" + index,
            title: "Prueba " + index,
            status: index === 0 ? "published" : "draft",
            supplierCost: 100,
            publicPrice: 200,
          }),
        ),
      );
      const products = await new PostgresCatalogRepository(pool).listProducts();
      assert.equal(
        products.filter((p) => p.id.startsWith("postgres-test-")).length,
        12,
      );
      const visible = await first.listPublicProducts();
      assert.equal(visible.length, 1);
      assert.equal(visible[0].supplierCost, undefined);
      await first.saveSession("session-test", { expiresAt: Date.now() + 1000 });
      assert.ok(await second.getSession("session-test"));
      await second.deleteSession("session-test");
      assert.equal(await first.getSession("session-test"), null);
      assert.equal(await first.acquireLease("test", "first"), true);
      assert.equal(await second.acquireLease("test", "second"), false);
      await first.releaseLease("test", "first");
      await first.mutate(state => { delete state.searchUsage['tavily:2026-10']; });
      const results = await Promise.all(Array.from({length:8}, (_value, index) =>
        (index % 2 ? first : second).reserveSearch('tavily', 3, Date.parse('2026-10-13T00:00:00Z'))));
      assert.equal(results.filter(Boolean).length,3);
      assert.equal((await new PostgresCatalogRepository(pool).searchUsage('tavily',Date.parse('2026-10-13T12:00:00Z'))).used,3);
      await first.saveContactSettings({ whatsappNumber: "+1 (202) 555-0123" });
      assert.equal((await new PostgresCatalogRepository(pool).getContactSettings()).whatsappNumber, "12025550123");
      await second.saveContactSettings({ whatsappNumber: "" });
      assert.equal((await first.getContactSettings()).whatsappNumber, "");
    } finally {
      await pool.end();
    }
  },
);
