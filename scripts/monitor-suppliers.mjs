import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const { catalogRepository } = await import("../lib/catalog-store.mjs");
const { runSupplierMonitor } = await import("../lib/supplier-monitor.mjs");
const { monitorRunSummary } = await import("../packages/core/monitor.mjs");
try {
  let result;
  for (let batch = 0; batch < 100; batch++) {
    result = await runSupplierMonitor(catalogRepository, {
      force: batch === 0 && process.argv.includes("--force"),
    });
    // CI logs contain counts only, never supplier identifiers or evidence.
    console.log(JSON.stringify(monitorRunSummary(result)));
    if (result.status !== "completed" || !result.remaining) break;
  }
  process.exitCode = result.status === "failed" || result.remaining > 0 ? 1 : 0;
} catch {
  console.error("No se pudo completar el monitor. Revisa su configuración privada.");
  process.exitCode = 1;
} finally {
  await catalogRepository.close?.();
}
