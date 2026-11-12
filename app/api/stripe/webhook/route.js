import { NextResponse } from "next/server";
import { handleStripeWebhook } from "../../../../lib/checkout-service.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
export const dynamic = "force-dynamic";
// El cuerpo debe leerse crudo (request.text()): Stripe verifica la firma
// sobre los bytes exactos que envió. No usar jsonBody aquí.
export async function POST(request) {
  try {
    const rawBody = await request.text(),
      signature = request.headers.get("stripe-signature") || "";
    const result = await handleStripeWebhook({ rawBody, signature });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
