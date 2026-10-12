import { NextResponse } from "next/server";
import {
  requireAdmin,
  jsonBody,
  ApiError,
} from "../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
import { catalogRepository } from "../../../../lib/catalog-store.mjs";
import { createImport } from "../../../../lib/catalog-service.mjs";
export const maxDuration = 120;
export async function POST(request) {
  let locked = false;
  const owner = crypto.randomUUID();
  try {
    await requireAdmin(request, { write: true });
    const { url } = await jsonBody(request);
    locked = await catalogRepository.acquireLease(
      "supplier-import",
      owner,
      120000,
    );
    if (!locked)
      throw new ApiError(
        "Hay otra importación en curso. Espera a que termine.",
        409,
      );
    return NextResponse.json({
      draft: await createImport(catalogRepository, url),
    });
  } catch (error) {
    return apiError(error);
  } finally {
    if (locked) await catalogRepository.releaseLease("supplier-import", owner);
  }
}
