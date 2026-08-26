export interface DownscaledImage {
  imageBase64: string;
  mimeType: string;
}

const MAX_DIMENSION = 1800; // ample resolution for OCR; phone photos are often 3-4x this
const JPEG_QUALITY = 0.82;

/**
 * Re-encodes an image file to a size-capped JPEG in the browser before upload.
 * A phone photo can be several MB at native resolution — multiplied across up
 * to 30 pages in one request, that's what actually blows the upload payload
 * up (not the field count), so every page gets normalized down here.
 */
export async function downscaleImageFile(file: File): Promise<DownscaledImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { imageBase64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" };
}
