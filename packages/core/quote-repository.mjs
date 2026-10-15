import { quoteReceipt } from "./quotes.mjs";

// Separate storage keeps customer data and attachments out of catalog reads.
export class StateQuoteRepository {
  constructor(stateRepository) {
    this.storage = stateRepository;
  }
  async save(quote, logoData = null) {
    return this.storage.mutate((state) => {
      state.quotes ||= {};
      state.quotes[quote.id] ||= {
        ...quote,
        logoData: logoData ? Buffer.from(logoData).toString("base64") : null,
      };
      return quoteReceipt(state.quotes[quote.id]);
    });
  }
  async list() {
    return Object.values((await this.storage.read()).quotes || {})
      .map(({ logoData, ...quote }) => quote)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getLogo(id) {
    const quote = (await this.storage.read()).quotes?.[id];
    return quote?.logoData
      ? {
          data: Buffer.from(quote.logoData, "base64"),
          meta: quote.logo,
          reference: quote.reference,
        }
      : null;
  }
  async setStatus(id, status) {
    return this.storage.mutate((state) => {
      const quote = Object.hasOwn(state.quotes || {}, id)
        ? state.quotes[id]
        : null;
      if (!quote) return null;
      quote.status = status;
      quote.updatedAt = new Date().toISOString();
      return { id, status };
    });
  }
}

export class PostgresQuoteRepository {
  constructor(pool) {
    this.pool = pool;
    this.ready = null;
  }
  async initialize() {
    this.ready ||= this.pool
      .query(
        "CREATE TABLE IF NOT EXISTS souvenirs_quote_requests (id uuid PRIMARY KEY, data jsonb NOT NULL, logo_data bytea)",
      )
      .catch((error) => {
        this.ready = null;
        throw error;
      });
    await this.ready;
  }
  async save(quote, logoData = null) {
    await this.initialize();
    const { rows } = await this.pool.query(
      "INSERT INTO souvenirs_quote_requests(id,data,logo_data) VALUES($1,$2::jsonb,$3) ON CONFLICT(id) DO UPDATE SET id=excluded.id RETURNING data->>'id' AS id, data->>'reference' AS reference, data->>'createdAt' AS \"createdAt\"",
      [quote.id, JSON.stringify(quote), logoData],
    );
    return rows[0];
  }
  async list() {
    await this.initialize();
    return (
      await this.pool.query(
        "SELECT data FROM souvenirs_quote_requests ORDER BY data->>'createdAt' DESC LIMIT 200",
      )
    ).rows.map(({ data }) => data);
  }
  async getLogo(id) {
    await this.initialize();
    const { rows } = await this.pool.query(
      "SELECT logo_data AS data, data->'logo' AS meta, data->>'reference' AS reference FROM souvenirs_quote_requests WHERE id=$1 AND logo_data IS NOT NULL",
      [id],
    );
    return rows[0] || null;
  }
  async setStatus(id, status) {
    await this.initialize();
    const { rowCount } = await this.pool.query(
      "UPDATE souvenirs_quote_requests SET data=data || $2::jsonb WHERE id=$1",
      [id, JSON.stringify({ status, updatedAt: new Date().toISOString() })],
    );
    return rowCount ? { id, status } : null;
  }
}
