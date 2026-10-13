import { NextResponse } from "next/server";
import { catalogRepository } from "../../../lib/catalog-store.mjs";
import { requireAdmin, jsonBody, ApiError } from "../../../lib/admin-auth.mjs";
import { apiError } from "../../../lib/api-response.mjs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    if (new URL(request.url).searchParams.get("scope") === "admin") {
      await requireAdmin(request);
      return NextResponse.json({
        products: await catalogRepository.listProducts(),
      });
    }
    return NextResponse.json({
      products: await catalogRepository.listPublicProducts(),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request) {
  try {
    await requireAdmin(request, { write: true });
    const body = await jsonBody(request),
      product = await catalogRepository.getProduct(body.id);
    if (!product)
      throw new ApiError(
        "Para crear un producto utiliza la vista previa de importación.",
        400,
      );
    if (body.status !== "draft")
      throw new ApiError(
        "Solo se puede retirar un producto desde esta acción. Reimporta y revisa sus datos para publicarlo.",
      );
    return NextResponse.json({
      product: await catalogRepository.saveProduct({
        id: body.id,
        status: "draft",
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
