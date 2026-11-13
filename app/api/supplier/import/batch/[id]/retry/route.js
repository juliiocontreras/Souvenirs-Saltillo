import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../../../../lib/catalog-store.mjs";
import { processBatchItem } from "../../../../../../../lib/catalog-service.mjs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
// Reintenta un enlace de la cola que falló, sin duplicar.
export async function POST(request, { params }) {
  try {
    await requireAdmin(request, { write: true });
    const { id } = await params;
    return NextResponse.json(
      await processBatchItem(catalogRepository, id),
    );
  } catch (error) {
    return apiError(error);
  }
}
