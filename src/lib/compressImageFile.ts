/**
 * Client-side image downscale + re-encode, run before uploading.
 *
 * Product photos are usually taken on a phone (3–12 MB JPEGs). Shrinking them
 * in the browser first means the request that reaches the server is a few
 * hundred KB — well under Vercel's ~4.5 MB serverless body limit — and the
 * upload is fast on mobile data. The server still re-compresses with sharp;
 * this just stops the oversized original from ever going over the wire.
 */

export interface CompressImageOptions {
  /** Longest edge of the output, in px. Default 1600. */
  maxDimension?: number;
  /** Encoder quality, 0–1. Default 0.8. */
  quality?: number;
}

/**
 * Returns a smaller File (WebP, or JPEG where WebP encoding isn't supported).
 * Falls back to the original file for SVG/GIF, non-images, decode failures, or
 * when the re-encode wouldn't actually be smaller.
 */
export async function compressImageFile(
  file: File,
  { maxDimension = 1600, quality = 0.8 }: CompressImageOptions = {},
): Promise<File> {
  if (typeof document === 'undefined') return file; // SSR guard
  if (!file.type.startsWith('image/')) return file;
  // Don't rasterise vectors or drop GIF animation.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await loadImage(file);
  } catch {
    return file;
  }

  const srcW = 'width' in source ? source.width : (source as HTMLImageElement).naturalWidth;
  const srcH = 'height' in source ? source.height : (source as HTMLImageElement).naturalHeight;
  if (!srcW || !srcH) {
    closeBitmap(source);
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    closeBitmap(source);
    return file;
  }
  ctx.drawImage(source, 0, 0, w, h);
  closeBitmap(source);

  const type = supportsWebpEncode(canvas) ? 'image/webp' : 'image/jpeg';
  const ext = type === 'image/webp' ? 'webp' : 'jpg';

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
  // No blob, or the re-encode isn't actually smaller — keep the original.
  if (!blob || blob.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() });
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `imageOrientation` bakes in EXIF rotation so portrait phone photos
      // don't come out sideways. Not in every lib.dom version — hence the cast.
      return await createImageBitmap(file, {
        imageOrientation: 'from-image',
      } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function closeBitmap(source: ImageBitmap | HTMLImageElement) {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    source.close();
  }
}

let webpEncodeSupport: boolean | null = null;
function supportsWebpEncode(canvas: HTMLCanvasElement): boolean {
  if (webpEncodeSupport === null) {
    webpEncodeSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpEncodeSupport;
}
