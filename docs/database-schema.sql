-- Runtime PostgreSQL schema. Server-side only; never grant public/anonymous access.
-- Each entity is a separate record. Repository mutations serialize with a
-- transaction-level advisory lock and write only changed records.
create table if not exists souvenirs_catalog_records (
  namespace text not null,
  key text not null,
  data jsonb not null,
  primary key (namespace, key)
);

-- Namespaces: products, checks, alternatives, drafts, sessions, attempts, runs, leases, searchUsage, settings.
-- products: full private product; API projects only approved public fields.
-- checks: up to 200 observations per product, approved values remain separate.
-- alternatives: up to 20 candidates per product with identity and health status.
-- drafts: latest 100 import previews; older imports can be fetched again.
-- sessions: hashed signed token, expiry and credential version; deletion revokes token.
-- attempts: admin login counter with expiry; no stored passwords.
-- runs: latest 50 batches, status, counts, search results and pending sources.
-- leases: monitor/import owner and expiry for concurrency control.
-- searchUsage: provider + UTC month, conservative reserved calls; no API keys.
-- settings/publicContact: public business WhatsApp number and update timestamp.
-- An explicit empty WhatsApp number disables the link, including any environment fallback.

-- Private customer quote requests and attachments, separate from catalog reads.
create table if not exists souvenirs_quote_requests (
  id uuid primary key,
  data jsonb not null,
  logo_data bytea
);

-- Paid orders from Stripe Checkout. One row per paid checkout session; the
-- order snapshot (items, totals, customer, delivery method) lives in data
-- as jsonb. The webhook upserts by id and looks orders up by
-- data->>'stripeSessionId', so a retried webhook never duplicates an order.
-- The table is created on first use by PostgresOrderRepository.initialize()
-- and copied by ops/database-copy.mjs.
create table if not exists souvenirs_orders (
  id uuid primary key,
  data jsonb not null
);

-- Processed Stripe webhook events, for idempotency. The id is the Stripe
-- event id (evt_...); data holds the event type and processing timestamp.
-- A repeated delivery of the same event is ignored.
create table if not exists souvenirs_stripe_events (
  id text primary key,
  data jsonb not null
);

-- Fotos de producto subidas desde el panel (PNG, JPG o WebP, hasta 2 MB).
-- Una fila por foto; product_id es null cuando la foto se subió antes de
-- crear el producto y quedó sin usar. La tabla se crea al primer uso con
-- PostgresProductImageRepository.initialize() y se copia con
-- ops/database-copy.mjs. Las fotos se sirven en /api/product-images/[id].
create table if not exists souvenirs_product_images (
  id uuid primary key,
  product_id uuid,
  data bytea not null,
  content_type text not null,
  filename text not null,
  created_at timestamptz not null
);

-- This does not migrate any historical products/supplier_checks tables.
-- If a previous deployment used a different schema, review an explicit migration.
