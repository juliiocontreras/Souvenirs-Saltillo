import { NextResponse } from "next/server";
import { createCheckoutSession } from "../../../lib/checkout-service.mjs";
import { jsonBody, ApiError } from "../../../lib/admin-auth.mjs";
import { apiError } from "../../../lib/api-response.mjs";
export const dynamic = "force-dynamic";
// Público: crea una sesión de Stripe Checkout. El cuerpo lleva solo
// identificadores y cantidades; los precios se revalidan en el servidor
// contra el catálogo publicado.
export async function POST(request) {
  try {
    const body = await jsonBody(request),
      origin = process.env.APP_ORIGIN || new URL(request.url).origin;
    if (!/^https?:\/\//.test(origin))
      throw new ApiError("Origen público inválido.", 503);
    return NextResponse.json(
      await createCheckoutSession({ items: body.items, origin }),
    );
  } catch (error) {
    return apiError(error);
  }
}
