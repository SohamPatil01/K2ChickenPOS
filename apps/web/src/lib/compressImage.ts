/** Resize and compress an image file before storing (avoids multi-MB base64 in Postgres). */
export async function compressImageFile(
  file: File,
  maxDimension = 800,
  quality = 0.75
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height, 1));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not prepare image canvas');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(mime, quality);
}
