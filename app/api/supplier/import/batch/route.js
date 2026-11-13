import { NextResponse } from "next/server";
import { requireAdmin, jsonBody } from "../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../../lib/catalog-store.mjs";
import { enqueueBatchImports } from "../../../../../lib/catalog-service.mjs";
export const dynamic = "force-dynamic";
// GET: cola de importación por lotes. POST: encola hasta 20 enlaces.
export async function GET(request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(
      { queue: await catalogRepository.listQueuedImports() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request) {
  try {
    await requireAdmin(request, { write: true });
    const body = await jsonBody(request);
    return NextResponse.json(
      await enqueueBatchImports(catalogRepository, body.urls),
    );
  } catch (error) {
    return apiError(error);
  }
}
