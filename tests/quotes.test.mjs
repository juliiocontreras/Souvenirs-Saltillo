import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import {
  validateQuote,
  validateLogo,
  LOGO_MAX_BYTES,
} from "../packages/core/quotes.mjs";
import {
  StateQuoteRepository,
  PostgresQuoteRepository,
} from "../packages/core/quote-repository.mjs";
import {
  MemoryCatalogRepository,
  FileCatalogRepository,
} from "../packages/core/repository.mjs";
import { parseQuoteRequest, receiveQuote } from "../lib/quote-service.mjs";

const valid = () => ({
  id: randomUUID(),
  name: "Cliente de prueba",
  company: "Empresa de prueba",
  preferredContact: "Correo",
  phone: "",
  email: "cliente@example.test",
  category: "Equipaje",
  subcategory: "Mochilas",
  quantity: 50,
  description: "Mochilas beige con logo bordado",
  budget: "300 MXN por pieza",
  location: "Saltillo, Coahuila",
  logoStatus: "Tengo un logo",
  deliveryDate: "",
  deliveryFlexible: true,
  urgency: "Urgente",
  invoice: "Sí",
  consent: true,
});
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
function request(
  value,
  { origin = "https://store.example.test", logo = png, website = "" } = {},
) {
  const form = new FormData();
  form.set("details", JSON.stringify(value));
  form.set("website", website);
  if (logo)
    form.set("logo", new Blob([logo], { type: "image/png" }), "logo.png");
  return new Request("https://store.example.test/api/quotes", {
    method: "POST",
    headers: { origin },
    body: form,
  });
}

test("quote validation requires contact, quantity, delivery decision and consent", () => {
  assert.equal(validateQuote(valid()).quantity, 50);
  for (const change of [
    { consent: false },
    { email: "invalid" },
    { preferredContact: "WhatsApp" },
    { quantity: 0 },
    { quantity: 1.5 },
    { deliveryFlexible: false },
    { deliveryDate: "2020-01-01" },
    { deliveryDate: "2099-02-31" },
    { invoice: "unknown" },
    { category: "Oficina", subcategory: "Mochilas" },
  ])
    assert.throws(() => validateQuote({ ...valid(), ...change }));
  assert.equal(
    validateQuote({ ...valid(), logoStatus: "Necesito ayuda con el diseño" })
      .logoStatus,
    "Necesito ayuda con el diseño",
  );
});

test("logos validate actual signature and size rather than a claimed MIME or extension", () => {
  assert.equal(validateLogo(png, "logo.png").type, "image/png");
  assert.throws(() =>
    validateLogo(Buffer.from('<svg onload="alert(1)"></svg>'), "logo.png"),
  );
  assert.throws(() =>
    validateLogo(Buffer.alloc(LOGO_MAX_BYTES + 1), "logo.png"),
  );
  assert.equal(
    validateLogo(Buffer.from("%PDF-1.7 test"), "file\r\n.pdf").name,
    "file.pdf",
  );
});

test("quote submission checks origin, honeypot, logo and streamed body limits", async () => {
  await assert.rejects(
    parseQuoteRequest(
      request(valid(), { origin: "https://other.example.test" }),
    ),
    { status: 403 },
  );
  await assert.rejects(
    parseQuoteRequest(request(valid(), { website: "spam" })),
    { status: 422 },
  );
  await assert.rejects(
    parseQuoteRequest(request({ ...valid(), logoStatus: "Sin logo" })),
    { status: 422 },
  );
  const oversized = request(valid(), { logo: Buffer.alloc(1300 * 1024) });
  // Exercise the inbound HTTP bytes; cancelling Node's outgoing FormData
  // encoder mid-Blob triggers an unrelated undici stream error.
  await assert.rejects(
    parseQuoteRequest(
      new Request(oversized.url, {
        method: "POST",
        headers: oversized.headers,
        body: await oversized.arrayBuffer(),
      }),
    ),
    { status: 413 },
  );
});

test("receipt contains no customer data, retries are idempotent, and logos are omitted from inbox metadata", async () => {
  const repository = new StateQuoteRepository(new MemoryCatalogRepository()),
    catalog = new MemoryCatalogRepository(),
    fields = valid();
  const first = await receiveQuote(request(fields), repository, catalog);
  const second = await receiveQuote(
    request({ ...fields, name: "Changed" }),
    repository,
    catalog,
  );
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ["createdAt", "id", "reference"]);
  const quotes = await repository.list();
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].name, fields.name);
  assert.equal(quotes[0].status, "Nueva");
  assert.equal(quotes[0].logoData, undefined);
  assert.deepEqual((await repository.getLogo(fields.id)).data, png);
  assert.deepEqual(await catalog.listPublicProducts(), []);
  await repository.setStatus(fields.id, "En seguimiento");
  assert.equal((await repository.list())[0].status, "En seguimiento");
});

test("quote requests and attached logos survive file repository instances with private permissions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saltillo-quotes-"));
  try {
    const file = join(dir, "requests.json"),
      repository = new StateQuoteRepository(new FileCatalogRepository(file)),
      fields = valid();
    await receiveQuote(
      request(fields),
      repository,
      new MemoryCatalogRepository(),
    );
    const reopened = new StateQuoteRepository(new FileCatalogRepository(file));
    assert.equal((await reopened.list())[0].id, fields.id);
    assert.deepEqual((await reopened.getLogo(fields.id)).data, png);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("submission rate limit rejects excess requests without adding another quote", async () => {
  const catalog = new MemoryCatalogRepository(),
    repository = new StateQuoteRepository(new MemoryCatalogRepository());
  for (let i = 0; i < 10; i++)
    await receiveQuote(request(valid(), { logo: null }), repository, catalog);
  await assert.rejects(
    receiveQuote(request(valid(), { logo: null }), repository, catalog),
    { status: 429 },
  );
  assert.equal((await repository.list()).length, 10);
});

test(
  "Postgres quote metadata, status and attachment persist independently of catalog records",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        max: 2,
      }),
      repository = new PostgresQuoteRepository(pool),
      fields = valid();
    try {
      const receipt = await receiveQuote(
        request(fields),
        repository,
        new MemoryCatalogRepository(),
      );
      const reopened = new PostgresQuoteRepository(pool);
      assert.equal(
        (await reopened.list()).find((q) => q.id === fields.id).reference,
        receipt.reference,
      );
      assert.deepEqual((await reopened.getLogo(fields.id)).data, png);
      assert.deepEqual(
        await receiveQuote(
          request(fields),
          reopened,
          new MemoryCatalogRepository(),
        ),
        receipt,
      );
      await reopened.setStatus(fields.id, "Cotizada");
      assert.equal(
        (await repository.list()).find((q) => q.id === fields.id).status,
        "Cotizada",
      );
    } finally {
      await pool.query("DELETE FROM souvenirs_quote_requests WHERE id=$1", [
        fields.id,
      ]);
      await pool.end();
    }
  },
);
