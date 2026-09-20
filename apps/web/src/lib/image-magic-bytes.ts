// apps/web/src/lib/image-magic-bytes.ts
//
// Pure, dependency-free image magic-number sniffer (INV-M1).
//
// Client-side declared-MIME checks (File.type / extension) are bypassable — an
// attacker can call the storage/edge API directly with a spoofed content-type.
// The authoritative gate is byte inspection: the first bytes of a file identify
// its true format regardless of the declared type. This module is the single
// source of truth for that check on the app side; the `post-image-upload` edge
// function mirrors the exact same byte patterns in the Deno runtime (kept in
// sync — the patterns are fixed format constants).
//
// Recognised (allowed) types only. Anything else (SVG, HTML, GIF, PDF, empty,
// truncated) returns null and MUST be rejected by the caller.

export type SniffedImageType = 'jpeg' | 'png' | 'webp'

/**
 * Identify an image by its magic bytes. Returns the detected allowed type, or
 * null when the bytes are not a JPEG, PNG, or WebP.
 *
 *   JPEG : FF D8 FF
 *   PNG  : 89 50 4E 47 0D 0A 1A 0A
 *   WebP : "RIFF" ....  "WEBP"  (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
 */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (!bytes || bytes.length < 12) return null

  // JPEG — FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }

  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }

  // WebP — "RIFF"<4-byte size>"WEBP"
  if (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'webp'
  }

  return null
}

/** The file extension for a sniffed image type. */
export function extensionForType(type: SniffedImageType): string {
  switch (type) {
    case 'jpeg':
      return 'jpg'
    case 'png':
      return 'png'
    case 'webp':
      return 'webp'
  }
}

/** The canonical content-type for a sniffed image type. */
export function contentTypeForType(type: SniffedImageType): string {
  return `image/${type}`
}
