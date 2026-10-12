import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const { catalogRepository } = await import("../lib/catalog-store.mjs");
const { runSupplierMonitor } = await import("../lib/supplier-monitor.mjs");
let result;
for (let batch = 0; batch < 100; batch++) {
  result = await runSupplierMonitor(catalogRepository, {
    force: batch === 0 && process.argv.includes("--force"),
  });
  console.log(JSON.stringify(result));
  if (result.status !== "completed" || !result.remaining) break;
}
process.exitCode = result.status === "failed" || result.remaining > 0 ? 1 : 0;
await catalogRepository.close?.();
