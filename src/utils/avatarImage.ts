export type AvatarImageOptions = {
  maxSize?: number; // px (square bounding box)
  quality?: number; // 0..1 (jpeg)
};

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = src;
  });

/**
 * Convert an uploaded file into a reasonably-sized avatar data URL.
 * Uses canvas downscale + JPEG encoding for broad compatibility.
 */
export async function fileToAvatarDataUrl(file: File, options: AvatarImageOptions = {}) {
  const maxSize = options.maxSize ?? 512;
  const quality = options.quality ?? 0.85;

  // Read file as data URL then downscale.
  const src = await readAsDataUrl(file);
  const img = await loadImage(src);

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src; // fallback

  // Slightly improve downscale quality
  (ctx as any).imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, outW, outH);

  // JPEG keeps size low; fine for avatars.
  return canvas.toDataURL('image/jpeg', quality);
}

