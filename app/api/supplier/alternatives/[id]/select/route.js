import { NextResponse } from "next/server";
import { requireAdmin, jsonBody } from "../../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../../../lib/catalog-store.mjs";
import { alternativeImport } from "../../../../../../lib/supplier-monitor.mjs";
export const maxDuration = 120;
export async function POST(request, { params }) {
  try {
    await requireAdmin(request, { write: true });
    const { productId, identityConfirmed } = await jsonBody(request),
      { id } = await params;
    return NextResponse.json({
      draft: await alternativeImport(catalogRepository, productId, id, {
        identityConfirmed: identityConfirmed === true,
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
