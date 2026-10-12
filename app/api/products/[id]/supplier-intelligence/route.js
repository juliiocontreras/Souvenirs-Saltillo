import { NextResponse } from "next/server";
import { catalogRepository } from "../../../../../lib/catalog-store.mjs";
import { requireAdmin } from "../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../lib/api-response.mjs";
export async function GET(request, { params }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json({
      checks: await catalogRepository.listSupplierChecks(id),
      alternatives: await catalogRepository.listAlternatives(id),
    });
  } catch (error) {
    return apiError(error);
  }
}
