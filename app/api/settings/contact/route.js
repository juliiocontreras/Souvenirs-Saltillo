import { NextResponse } from "next/server";
import { catalogRepository } from "../../../../lib/catalog-store.mjs";
import { contactSettings } from "../../../../lib/contact-settings.mjs";
import { requireAdmin, jsonBody, ApiError } from "../../../../lib/admin-auth.mjs";
import { apiError } from "../../../../lib/api-response.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ settings: await contactSettings() });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request) {
  try {
    await requireAdmin(request, { write: true });
    const body = await jsonBody(request);
    let settings;
    try {
      settings = await catalogRepository.saveContactSettings(body);
    } catch (error) {
      if (error.status === 422) throw new ApiError(error.message, 422);
      throw error;
    }
    return NextResponse.json({ settings });
  } catch (error) {
    return apiError(error);
  }
}
