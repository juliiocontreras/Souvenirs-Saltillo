import { NextResponse } from "next/server";
import { requireAdmin, ApiError } from "../../../../../lib/admin-auth.mjs";
import { catalogRepository } from "../../../../../lib/catalog-store.mjs";
import { productImageRepository } from "../../../../../lib/product-image-store.mjs";
import {
  parseProductImageUpload,
  uploadProductImages,
} from "../../../../../lib/product-images.mjs";
import { apiError } from "../../../../../lib/api-response.mjs";

export async function POST(request, { params }) {
  try {
    await requireAdmin(request, { write: true });
    const { id } = await params;
    const product = await catalogRepository.getProduct(id);
    if (!product) throw new ApiError("Producto no encontrado.", 404);
    const files = await parseProductImageUpload(request);
    const images = await uploadProductImages(
      productImageRepository,
      id,
      files,
    );
    return NextResponse.json({ images });
  } catch (error) {
    return apiError(error);
  }
}
