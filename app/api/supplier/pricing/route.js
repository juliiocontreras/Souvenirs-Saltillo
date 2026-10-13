import { NextResponse } from "next/server";
import {
  requireAdmin,
  jsonBody,
  ApiError,
} from "../../../../lib/admin-auth.mjs";
import { pricingPolicy } from "../../../../lib/catalog-service.mjs";
import { calculatePricing } from "../../../../packages/core/pricing.mjs";
import { apiError } from "../../../../lib/api-response.mjs";
export async function POST(request) {
  try {
    await requireAdmin(request, { write: true });
    const { cost, pricing } = await jsonBody(request);
    try {
      return NextResponse.json(
        calculatePricing({ cost, ...pricingPolicy(pricing) }),
      );
    } catch (error) {
      throw new ApiError(error.message);
    }
  } catch (error) {
    return apiError(error);
  }
}
