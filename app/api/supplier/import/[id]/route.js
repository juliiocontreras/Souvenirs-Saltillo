import { NextResponse } from "next/server";
import { requireAdmin, ApiError } from "../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../../lib/catalog-store.mjs";

export async function GET(request, { params }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const draft = await catalogRepository.getDraft(id);
    if (!draft) throw new ApiError("Importación no encontrada.", 404);
    if (draft.status !== "preview")
      throw new ApiError("Esta importación ya fue aplicada. Revisa el producto en el catálogo.", 409);
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
