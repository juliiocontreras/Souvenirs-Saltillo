import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../../../lib/catalog-store.mjs";
import { processNextBatchItem } from "../../../../../../lib/catalog-service.mjs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
// Procesa el enlace encolado más antiguo sin error, uno a la vez. Sin
// procesos en segundo plano: el panel llama a esta ruta en sucesión.
export async function POST(request) {
  try {
    await requireAdmin(request, { write: true });
    return NextResponse.json(
      await processNextBatchItem(catalogRepository),
    );
  } catch (error) {
    return apiError(error);
  }
}
