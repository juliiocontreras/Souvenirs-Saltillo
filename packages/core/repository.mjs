import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  open,
  unlink,
  stat,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { toPublicProduct } from "./catalog.mjs";

const empty = () => ({
  products: {},
  checks: {},
  alternatives: {},
  drafts: {},
  sessions: {},
  attempts: {},
  runs: {},
  leases: {},
});
const copy = (value) => structuredClone(value);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class CatalogRepository {
  async saveProduct(product) {
    if (
      typeof product.id !== "string" ||
      !product.id ||
      product.id === "__proto__"
    )
      throw new Error("Valid product id required");
    return this.mutate((state) => {
      const old = state.products[product.id];
      state.products[product.id] = {
        ...old,
        ...product,
        status: product.status || old?.status || "draft",
        updatedAt: new Date().toISOString(),
      };
      return state.products[product.id];
    });
  }
  async getProduct(id) {
    const products = (await this.read()).products;
    return typeof id === "string" && Object.hasOwn(products, id)
      ? products[id]
      : null;
  }
  async listProducts() {
    return Object.values((await this.read()).products).sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || ""),
    );
  }
  async listPublicProducts() {
    return (await this.listProducts())
      .filter((p) => p.status === "published")
      .map(toPublicProduct);
  }
  async recordSupplierCheck(id, check) {
    return this.mutate((state) => {
      const list = (state.checks[id] ||= []);
      list.push({ id: randomUUID(), ...check });
      state.checks[id] = list.slice(-200);
      return check;
    });
  }
  async listSupplierChecks(id) {
    return (await this.read()).checks[id] || [];
  }
  async saveAlternative(id, candidate) {
    return this.mutate((state) => {
      const list = (state.alternatives[id] ||= []);
      const existing = list.findIndex(
        (a) =>
          a.url === candidate.url && a.identityKey === candidate.identityKey,
      );
      const value = {
        id: existing >= 0 ? list[existing].id : randomUUID(),
        ...candidate,
      };
      if (existing >= 0) list[existing] = value;
      else list.push(value);
      state.alternatives[id] = list.slice(-20);
      return value;
    });
  }
  async listAlternatives(id) {
    return (await this.read()).alternatives[id] || [];
  }
  async saveDraft(draft) {
    return this.mutate((state) => {
      state.drafts[draft.id] = draft;
      const ids = Object.keys(state.drafts).sort((a, b) =>
        (state.drafts[b].createdAt || "").localeCompare(
          state.drafts[a].createdAt || "",
        ),
      );
      for (const id of ids.slice(100)) delete state.drafts[id];
      return draft;
    });
  }
  async getDraft(id) {
    return (await this.read()).drafts[id] || null;
  }
  async getSession(hash) {
    return (await this.read()).sessions[hash] || null;
  }
  async saveSession(hash, session) {
    return this.mutate((state) => {
      for (const [id, value] of Object.entries(state.sessions))
        if (value.expiresAt <= Date.now()) delete state.sessions[id];
      state.sessions[hash] = session;
      return session;
    });
  }
  async deleteSession(hash) {
    return this.mutate((state) => {
      delete state.sessions[hash];
    });
  }
  async loginAttempt(key, now = Date.now()) {
    return this.mutate((state) => {
      for (const [id, value] of Object.entries(state.attempts))
        if (value.until <= now) delete state.attempts[id];
      const value = (state.attempts[key] ||= {
        count: 0,
        until: now + 15 * 60 * 1000,
      });
      if (value.count >= 10) return false;
      value.count++;
      return true;
    });
  }
  async acquireLease(name, owner, ttl = 120000) {
    return this.mutate((state) => {
      if (state.leases[name]?.expiresAt > Date.now()) return false;
      state.leases[name] = { owner, expiresAt: Date.now() + ttl };
      return true;
    });
  }
  async renewLease(name, owner) {
    return this.mutate((state) => {
      if (state.leases[name]?.owner === owner)
        state.leases[name].expiresAt = Date.now() + 120000;
    });
  }
  async releaseLease(name, owner) {
    return this.mutate((state) => {
      if (state.leases[name]?.owner === owner) delete state.leases[name];
    });
  }
  async saveRun(run) {
    return this.mutate((state) => {
      state.runs[run.id] = run;
      const keys = Object.keys(state.runs).sort((a, b) =>
        state.runs[b].startedAt.localeCompare(state.runs[a].startedAt),
      );
      for (const key of keys.slice(50)) delete state.runs[key];
      return run;
    });
  }
  async listRuns() {
    return Object.values((await this.read()).runs).sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    );
  }
}

export class MemoryCatalogRepository extends CatalogRepository {
  constructor() {
    super();
    this.state = empty();
  }
  async read() {
    return copy(this.state);
  }
  async mutate(change) {
    const result = change(this.state);
    return copy(result);
  }
}

export class FileCatalogRepository extends CatalogRepository {
  constructor(file) {
    super();
    this.file = resolve(file);
  }
  async read() {
    try {
      return { ...empty(), ...JSON.parse(await readFile(this.file, "utf8")) };
    } catch (error) {
      if (error.code === "ENOENT") return empty();
      throw error;
    }
  }
  async mutate(change) {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const lockPath = this.file + ".lock",
      end = Date.now() + 10000;
    let lock;
    while (!lock) {
      try {
        lock = await open(lockPath, "wx", 0o600);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const info = await stat(lockPath).catch(() => null);
        if (info && Date.now() - info.mtimeMs > 60000)
          await unlink(lockPath).catch(() => {});
        if (Date.now() >= end)
          throw new Error("Catalog storage is busy; retry shortly");
        await wait(25);
      }
    }
    const temp = this.file + "." + randomUUID() + ".tmp";
    try {
      const state = await this.read(),
        result = change(state);
      await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
      await rename(temp, this.file);
      return copy(result);
    } finally {
      await unlink(temp).catch(() => {});
      await lock.close();
      await unlink(lockPath).catch(() => {});
    }
  }
}

export class PostgresCatalogRepository extends CatalogRepository {
  constructor(pool) {
    super();
    this.pool = pool;
    this.ready = null;
  }
  async close() {
    await this.pool.end();
  }
  async initialize() {
    this.ready ||= (async () => {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(672215490)");
        await client.query(
          "CREATE TABLE IF NOT EXISTS souvenirs_catalog_records (namespace text NOT NULL, key text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(namespace,key))",
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        this.ready = null;
        throw error;
      } finally {
        client.release();
      }
    })();
    await this.ready;
  }
  async read() {
    await this.initialize();
    const { rows } = await this.pool.query(
      "SELECT namespace,key,data FROM souvenirs_catalog_records",
    );
    const state = empty();
    for (const row of rows)
      if (state[row.namespace]) state[row.namespace][row.key] = row.data;
    return state;
  }
  async mutate(change) {
    await this.initialize();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(672215490)");
      const { rows } = await client.query(
        "SELECT namespace,key,data FROM souvenirs_catalog_records",
      );
      const state = empty(),
        before = new Map();
      for (const row of rows)
        if (state[row.namespace]) {
          state[row.namespace][row.key] = row.data;
          before.set(row.namespace + ":" + row.key, JSON.stringify(row.data));
        }
      const result = change(state),
        after = new Set();
      for (const [namespace, records] of Object.entries(state))
        for (const [key, value] of Object.entries(records)) {
          const identity = namespace + ":" + key,
            data = JSON.stringify(value);
          after.add(identity);
          if (before.get(identity) !== data)
            await client.query(
              "INSERT INTO souvenirs_catalog_records(namespace,key,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(namespace,key) DO UPDATE SET data=excluded.data",
              [namespace, key, data],
            );
        }
      for (const row of rows)
        if (state[row.namespace] && !after.has(row.namespace + ":" + row.key))
          await client.query(
            "DELETE FROM souvenirs_catalog_records WHERE namespace=$1 AND key=$2",
            [row.namespace, row.key],
          );
      await client.query("COMMIT");
      return copy(result);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
