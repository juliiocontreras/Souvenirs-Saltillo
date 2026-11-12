import { NextResponse } from "next/server";
import { orderRepository } from "../../../lib/order-store.mjs";
import { requireAdmin } from "../../../lib/admin-auth.mjs";
import { apiError } from "../../../lib/api-response.mjs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({
      orders: await orderRepository.listOrders(),
    });
  } catch (error) {
    return apiError(error);
  }
}
