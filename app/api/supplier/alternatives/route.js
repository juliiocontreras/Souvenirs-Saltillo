import { NextResponse } from "next/server";
import { requireAdmin, jsonBody } from "../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../lib/catalog-store.mjs";
import { addAlternative } from "../../../../lib/supplier-monitor.mjs";
export const maxDuration = 120;
export async function POST(request) {
  try {
    await requireAdmin(request, { write: true });
    const { productId, url } = await jsonBody(request);
    return NextResponse.json({
      alternative: await addAlternative(catalogRepository, productId, url),
    });
  } catch (error) {
    return apiError(error);
  }
}
