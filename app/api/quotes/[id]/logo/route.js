import { requireAdmin, ApiError } from "../../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../../lib/api-response.mjs";
import { quoteRepository } from "../../../../../lib/quote-store.mjs";
import { validQuoteId } from "../../../../../packages/core/quotes.mjs";
export async function GET(request, { params }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    if (!validQuoteId(id)) throw new ApiError("Solicitud no encontrada.", 404);
    const logo = await quoteRepository.getLogo(id);
    if (!logo)
      throw new ApiError("Esta solicitud no tiene un logo adjunto.", 404);
    const ext = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "application/pdf": "pdf",
    }[logo.meta.type];
    return new Response(logo.data, {
      headers: {
        "Content-Type": logo.meta.type,
        "Content-Disposition": `attachment; filename="logo-${logo.reference}.${ext}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
