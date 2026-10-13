import { NextResponse } from "next/server";
import { requireAdmin, jsonBody } from "../../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../../../lib/catalog-store.mjs";
import { applyImport } from "../../../../../../lib/catalog-service.mjs";
export async function POST(request, { params }) {
  try {
    await requireAdmin(request, { write: true });
    const { id } = await params;
    return NextResponse.json({
      product: await applyImport(
        catalogRepository,
        id,
        await jsonBody(request),
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
