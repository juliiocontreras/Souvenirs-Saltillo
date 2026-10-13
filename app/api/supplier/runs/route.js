import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-auth.mjs";
import { catalogRepository } from "../../../../lib/catalog-store.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
import { searchSummary } from "../../../../lib/supplier-search.mjs";
export async function GET(request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({
      runs: await catalogRepository.listRuns(),
      searchState: await searchSummary(catalogRepository),
    });
  } catch (error) {
    return apiError(error);
  }
}
