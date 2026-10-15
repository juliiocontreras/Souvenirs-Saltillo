import { NextResponse } from "next/server";
import { requireAdmin, jsonBody } from "../../../../../lib/admin-auth.mjs";
import { catalogRepository } from "../../../../../lib/catalog-store.mjs";
import { updateProductClassification } from "../../../../../lib/catalog-service.mjs";
import { apiError } from "../../../../../lib/api-response.mjs";

export async function PATCH(request, { params }) {
  try {
    await requireAdmin(request, { write: true });
    const { id } = await params;
    const product = await updateProductClassification(
      catalogRepository,
      id,
      await jsonBody(request),
    );
    return NextResponse.json({ product });
  } catch (error) {
    return apiError(error);
  }
}
