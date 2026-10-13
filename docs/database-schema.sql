-- Runtime PostgreSQL schema. Server-side only; never grant public/anonymous access.
-- Each entity is a separate record. Repository mutations serialize with a
-- transaction-level advisory lock and write only changed records.
create table if not exists souvenirs_catalog_records (
  namespace text not null,
  key text not null,
  data jsonb not null,
  primary key (namespace, key)
);

-- Namespaces: products, checks, alternatives, drafts, sessions, attempts, runs, leases, searchUsage.
-- products: full private product; API projects only approved public fields.
-- checks: up to 200 observations per product, approved values remain separate.
-- alternatives: up to 20 candidates per product with identity and health status.
-- drafts: latest 100 import previews; older imports can be fetched again.
-- sessions: hashed signed token, expiry and credential version; deletion revokes token.
-- attempts: admin login counter with expiry; no stored passwords.
-- runs: latest 50 batches, status, counts, search results and pending sources.
-- leases: monitor/import owner and expiry for concurrency control.
-- searchUsage: provider + UTC month, conservative reserved calls; no API keys.

-- This does not migrate any historical products/supplier_checks tables.
-- If a previous deployment used a different schema, review an explicit migration.
