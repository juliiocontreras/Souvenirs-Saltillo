import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth.mjs";
import { productImageRepository } from "../../../lib/product-image-store.mjs";
import {
  parseProductImageUpload,
  uploadProductImages,
} from "../../../lib/product-images.mjs";
import { apiError } from "../../../lib/api-response.mjs";

// Subida sin producto: el formulario de producto nuevo sube las fotos
// antes de crear el producto y adjunta las URLs devueltas al crearlo.
// Las fotos que no se lleguen a usar quedan guardadas sin producto.
export async function POST(request) {
  try {
    await requireAdmin(request, { write: true });
    const files = await parseProductImageUpload(request);
    const images = await uploadProductImages(
      productImageRepository,
      null,
      files,
    );
    return NextResponse.json({ images });
  } catch (error) {
    return apiError(error);
  }
}
