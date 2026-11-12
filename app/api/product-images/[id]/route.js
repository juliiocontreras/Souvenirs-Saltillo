import { serveProductImage } from "../../../../lib/product-images.mjs";
import { productImageRepository } from "../../../../lib/product-image-store.mjs";
import { apiError } from "../../../../lib/api-response.mjs";

// Pública: las fotos del catálogo se ven en la tienda sin iniciar sesión.
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const image = await serveProductImage(productImageRepository, id);
    return new Response(image.data, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
