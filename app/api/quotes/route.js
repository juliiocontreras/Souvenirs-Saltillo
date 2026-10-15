import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth.mjs";
import { apiError } from "../../../lib/api-response.mjs";
import { catalogRepository } from "../../../lib/catalog-store.mjs";
import { quoteRepository } from "../../../lib/quote-store.mjs";
import { receiveQuote } from "../../../lib/quote-service.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request) {
  try {
    return NextResponse.json(
      {
        receipt: await receiveQuote(
          request,
          quoteRepository,
          catalogRepository,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function GET(request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ quotes: await quoteRepository.list() });
  } catch (error) {
    return apiError(error);
  }
}
