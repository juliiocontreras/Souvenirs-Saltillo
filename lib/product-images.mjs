// Subida y servicio de fotos de producto. El parseo multipart sigue el
// patrón de lib/quote-service.mjs (límite total, lectura por chunks, error
// 413 al excederlo). Las fotos quedan en Postgres (bytea) o en el archivo
// local de imágenes; nunca en el disco efímero del despliegue.
import { ApiError } from "./admin-auth.mjs";
import {
  validateProductImage,
  productImageUrl,
  newProductImageId,
} from "../packages/core/product-images.mjs";

export const PRODUCT_IMAGE_UPLOAD_LIMIT = 6;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function parseProductImageUpload(request) {
  if (Number(request.headers.get("content-length")) > MAX_TOTAL_BYTES)
    throw new ApiError("Las fotos superan el límite de 8 MB por carga.", 413);
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data;")
  )
    throw new ApiError("Formato de solicitud inválido.", 422);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Faltan los datos de la solicitud.", 422);
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_TOTAL_BYTES) {
      await reader.cancel();
      throw new ApiError("Las fotos superan el límite de 8 MB por carga.", 413);
    }
    chunks.push(value);
  }
  try {
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type") },
    }).formData();
    const files = form
      .getAll("images")
      .filter(
        (file) =>
          typeof file?.arrayBuffer === "function" && file.size,
      );
    if (!files.length)
      throw new ApiError("Selecciona al menos una foto.", 422);
    if (files.length > PRODUCT_IMAGE_UPLOAD_LIMIT)
      throw new ApiError("Sube hasta 6 fotos a la vez.", 422);
    const images = [];
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const meta = validateProductImage(bytes, file.name);
      images.push({ data: bytes, ...meta });
    }
    return images;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message || "Revisa las fotos seleccionadas.", 422);
  }
}

export async function uploadProductImages(imageRepository, productId, files) {
  const now = new Date().toISOString();
  const saved = [];
  for (const file of files) {
    const record = await imageRepository.save({
      id: newProductImageId(),
      productId: productId || null,
      data: file.data,
      contentType: file.type,
      filename: file.name,
      createdAt: now,
    });
    saved.push({ id: record.id, url: productImageUrl(record.id) });
  }
  return saved;
}

export async function serveProductImage(imageRepository, id) {
  if (typeof id !== "string" || !IMAGE_ID.test(id))
    throw new ApiError("Foto no encontrada.", 404);
  const image = await imageRepository.get(id);
  if (!image) throw new ApiError("Foto no encontrada.", 404);
  return image;
}
