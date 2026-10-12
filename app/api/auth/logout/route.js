import { NextResponse } from "next/server";
import { requireAdmin, cookieOptions } from "../../../../lib/admin-auth.mjs";
import { catalogRepository } from "../../../../lib/catalog-store.mjs";
import { SESSION_COOKIE } from "../../../../packages/core/auth.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
export async function POST(request) {
  try {
    const session = await requireAdmin(request, { write: true });
    await catalogRepository.deleteSession(session.hash);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
