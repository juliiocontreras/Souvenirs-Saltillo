import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth.mjs";
import { catalogRepository } from "../../../../lib/catalog-store.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
export async function GET(request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({
      runs: await catalogRepository.listRuns(),
      searchConfigured:
        process.env.SEARCH_PROVIDER === "brave" &&
        Boolean(process.env.SEARCH_API_KEY),
    });
  } catch (error) {
    return apiError(error);
  }
}
