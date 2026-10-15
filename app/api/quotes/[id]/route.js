import { NextResponse } from "next/server";
import {
  requireAdmin,
  jsonBody,
  ApiError,
} from "../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
import { quoteRepository } from "../../../../lib/quote-store.mjs";
import {
  QUOTE_STATUSES,
  validQuoteId,
} from "../../../../packages/core/quotes.mjs";
export async function PATCH(request, { params }) {
  try {
    await requireAdmin(request, { write: true });
    const { id } = await params,
      { status } = await jsonBody(request);
    if (!validQuoteId(id) || !QUOTE_STATUSES.includes(status))
      throw new ApiError("Selecciona un estado válido.", 422);
    const quote = await quoteRepository.setStatus(id, status);
    if (!quote) throw new ApiError("Solicitud no encontrada.", 404);
    return NextResponse.json({ quote });
  } catch (error) {
    return apiError(error);
  }
}
