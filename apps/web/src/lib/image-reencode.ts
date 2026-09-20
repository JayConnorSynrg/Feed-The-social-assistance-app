// apps/web/src/lib/image-reencode.ts
//
// Client-side image re-encode (INV-M4).
//
// Drawing a decoded image onto a <canvas> and reading it back with toBlob()
// produces raw pixels re-encoded into a fresh container — the original file's
// metadata (EXIF, GPS, ICC, XMP, thumbnails) is NOT carried across, because the
// canvas holds only the pixel buffer. So a canvas re-encode inherently strips
// EXIF/GPS. We also downscale to a max dimension (aspect preserved) and encode
// to WebP@0.8, which shrinks upload size and normalises the output format.
//
// The dimension math is factored into a pure function so the downscale +
// aspect-preservation guarantee is unit-testable without a DOM/canvas.

export const MAX_IMAGE_DIMENSION = 1600
export const WEBP_QUALITY = 0.8

/**
 * Compute the target draw dimensions for a source image, downscaling so the
 * longest side is at most `max` while preserving aspect ratio. Images already
 * within the cap are returned unchanged (never upscaled). Pure + integer-valued.
 */
export function computeTargetDimensions(
  width: number,
  height: number,
  max: number = MAX_IMAGE_DIMENSION
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 0, height: 0 }
  }
  const longest = Math.max(width, height)
  if (longest <= max) {
    return { width: Math.round(width), height: Math.round(height) }
  }
  const scale = max / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Re-encode a user-selected image File into a downscaled, metadata-stripped
 * WebP Blob. Browser-only (uses Image/createImageBitmap + canvas). Rejects if
 * the file cannot be decoded as an image or the canvas encode fails.
 */
export async function reencodeImageToWebp(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<Blob> {
  const maxDimension = opts.maxDimension ?? MAX_IMAGE_DIMENSION
  const quality = opts.quality ?? WEBP_QUALITY

  const bitmap = await loadBitmap(file)
  try {
    const { width, height } = computeTargetDimensions(
      bitmap.width,
      bitmap.height,
      maxDimension
    )
    if (width === 0 || height === 0) {
      throw new Error('Image has invalid dimensions.')
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context.')
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, 'image/webp', quality)
    if (!blob || blob.size === 0) {
      throw new Error('Image re-encode produced no output.')
    }
    return blob
  } finally {
    // Release the decoded bitmap where supported.
    if ('close' in bitmap && typeof bitmap.close === 'function') {
      bitmap.close()
    }
  }
}

// ---------------------------------------------------------------------------
// Browser plumbing (not unit-tested; the pure math above is)
// ---------------------------------------------------------------------------

type DrawableBitmap = ImageBitmap | HTMLImageElement

async function loadBitmap(file: File): Promise<DrawableBitmap> {
  // Prefer createImageBitmap (decodes off the main thread where supported).
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Fall through to the <img> path (e.g. some formats/quirks).
    }
  }
  return await loadViaImageElement(file)
}

function loadViaImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode the selected image.'))
    }
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}
