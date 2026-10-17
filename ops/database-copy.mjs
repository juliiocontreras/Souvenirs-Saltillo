const catalogTable = `CREATE TABLE IF NOT EXISTS souvenirs_catalog_records (
  namespace text NOT NULL, key text NOT NULL, data jsonb NOT NULL,
  PRIMARY KEY(namespace,key))`;
const quoteTable = `CREATE TABLE IF NOT EXISTS souvenirs_quote_requests (
  id uuid PRIMARY KEY, data jsonb NOT NULL, logo_data bytea)`;

// Source and target are connected pg clients. The target must be empty.
// Freeze writes at the old deployment before calling, and keep them frozen
// until DNS cutover; a snapshot cannot capture writes made after it began.
export async function migrateStore(source, target) {
  let sourceStarted = false;
  let targetStarted = false;
  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceStarted = true;
    const { rows: tables } = await source.query(
      "SELECT to_regclass('souvenirs_catalog_records') AS catalog, to_regclass('souvenirs_quote_requests') AS quotes",
    );
    if (!tables[0].catalog) throw new Error("La base de origen no contiene el catálogo.");
    await target.query("BEGIN");
    targetStarted = true;
    await target.query("SELECT pg_advisory_xact_lock(672215490)");
    await target.query(catalogTable);
    await target.query(quoteTable);
    await target.query("LOCK TABLE souvenirs_catalog_records, souvenirs_quote_requests IN SHARE ROW EXCLUSIVE MODE");
    const { rows: existing } = await target.query(
      "SELECT EXISTS(SELECT 1 FROM souvenirs_catalog_records) OR EXISTS(SELECT 1 FROM souvenirs_quote_requests) AS occupied",
    );
    if (existing[0].occupied) throw new Error("La base de destino debe estar vacía; no se sobrescribieron datos.");
    const counts = { catalogRecords: 0, quoteRequests: 0, logoBytes: 0 };
    for (let offset = 0; ; offset += 50) {
      const { rows } = await source.query(
        "SELECT namespace,key,data FROM souvenirs_catalog_records WHERE namespace <> ALL($1::text[]) ORDER BY namespace,key LIMIT 50 OFFSET $2",
        [["sessions", "attempts", "leases"], offset],
      );
      if (!rows.length) break;
      await target.query(
        `INSERT INTO souvenirs_catalog_records(namespace,key,data)
         SELECT namespace,key,data FROM jsonb_to_recordset($1::jsonb)
         AS record(namespace text,key text,data jsonb)`,
        [JSON.stringify(rows)],
      );
      counts.catalogRecords += rows.length;
    }
    if (tables[0].quotes) {
      for (let offset = 0; ; offset += 20) {
        const { rows } = await source.query(
          "SELECT id,data,logo_data FROM souvenirs_quote_requests ORDER BY id LIMIT 20 OFFSET $1",
          [offset],
        );
        if (!rows.length) break;
        for (const row of rows) {
          await target.query(
            "INSERT INTO souvenirs_quote_requests(id,data,logo_data) VALUES($1,$2::jsonb,$3)",
            [row.id, JSON.stringify(row.data), row.logo_data],
          );
          counts.quoteRequests++;
          counts.logoBytes += row.logo_data?.length || 0;
        }
      }
    }
    await target.query("COMMIT");
    targetStarted = false;
    return counts;
  } catch (error) {
    if (targetStarted) await target.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    if (sourceStarted) await source.query("ROLLBACK");
  }
}
