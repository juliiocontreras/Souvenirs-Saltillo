import pg from "pg";
import { migrateStore } from "./database-copy.mjs";

if (!process.argv.includes("--source-writes-stopped")) {
  console.error("Detén las escrituras y el scheduler del origen; luego usa --source-writes-stopped.");
  process.exitCode = 1;
} else if (!process.env.SOURCE_DATABASE_URL || !process.env.TARGET_DATABASE_URL) {
  console.error("Configura SOURCE_DATABASE_URL y TARGET_DATABASE_URL en un entorno privado.");
  process.exitCode = 1;
} else if (process.env.SOURCE_DATABASE_URL === process.env.TARGET_DATABASE_URL) {
  console.error("Origen y destino deben ser bases diferentes.");
  process.exitCode = 1;
} else {
  const source = new pg.Client({ connectionString: process.env.SOURCE_DATABASE_URL, connectionTimeoutMillis: 10000 });
  const target = new pg.Client({ connectionString: process.env.TARGET_DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await source.connect();
    await target.connect();
    const counts = await migrateStore(source, target);
    console.log(JSON.stringify({ status: "copied", ...counts }));
  } catch {
    console.error("No se completó la copia. El destino se conserva sin una copia parcial. Revisa conexiones y que esté vacío.");
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}
