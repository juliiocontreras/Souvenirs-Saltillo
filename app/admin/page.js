import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { tokenSession } from "../../lib/admin-auth.mjs";
import { SESSION_COOKIE } from "../../packages/core/auth.mjs";
import { catalogRepository } from "../../lib/catalog-store.mjs";
import AdminPanel from "../components/AdminPanel";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const jar = await cookies(),
    session = await tokenSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const [products, runs] = await Promise.all([
    catalogRepository.listProducts(),
    catalogRepository.listRuns(),
  ]);
  return (
    <AdminPanel
      initialProducts={products}
      initialRuns={runs}
      defaultMargin={Number(process.env.DEFAULT_MARGIN_PERCENT || 40)}
      monitorConfigured={process.env.MONITOR_SCHEDULER_CONFIGURED === "true"}
      searchConfigured={
        process.env.SEARCH_PROVIDER === "brave" &&
        Boolean(process.env.SEARCH_API_KEY)
      }
    />
  );
}
