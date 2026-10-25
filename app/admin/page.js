import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { tokenSession } from "../../lib/admin-auth.mjs";
import { SESSION_COOKIE } from "../../packages/core/auth.mjs";
import { catalogRepository } from "../../lib/catalog-store.mjs";
import AdminPanel from "../components/AdminPanel";
import { searchSummary } from "../../lib/supplier-search.mjs";
import { contactSettings } from "../../lib/contact-settings.mjs";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const jar = await cookies(),
    session = await tokenSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const [products, runs, searchState, contact, imports] = await Promise.all([
    catalogRepository.listProducts(),
    catalogRepository.listRuns(),
    searchSummary(catalogRepository),
    contactSettings(),
    catalogRepository.listPendingImports(),
  ]);
  return (
    <AdminPanel
      initialProducts={products}
      initialRuns={runs}
      defaultMargin={Number(process.env.DEFAULT_MARGIN_PERCENT || 40)}
      monitorConfigured={process.env.MONITOR_SCHEDULER_CONFIGURED === "true"}
      initialSearchState={searchState}
      initialContactSettings={contact}
      initialImports={imports}
    />
  );
}
