import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../../../../lib/catalog-store.mjs";
import { removeBatchItem } from "../../../../../../../lib/catalog-service.mjs";
export const dynamic = "force-dynamic";
// Quita un enlace de la cola sin importarlo.
export async function POST(request, { params }) {
  try {
    await requireAdmin(request, { write: true });
    const { id } = await params;
    return NextResponse.json(await removeBatchItem(catalogRepository, id));
  } catch (error) {
    return apiError(error);
  }
}
