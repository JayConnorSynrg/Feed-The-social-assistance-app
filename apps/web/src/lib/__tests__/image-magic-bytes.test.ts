/**
 * image-magic-bytes.test.ts
 *
 * Server-side ingestion gate (INV-M1). Asserts the OUTCOME that governs what may
 * land in the PUBLIC post-images bucket: a genuine JPEG/PNG/WebP is accepted; a
 * forged or non-image payload (SVG/HTML → stored XSS, GIF, PDF, truncated,
 * empty) is rejected — regardless of any declared content-type. The edge
 * function mirrors this exact byte logic in Deno.
 */

import { describe, it, expect } from 'vitest'
import { sniffImageType, extensionForType, contentTypeForType } from '../image-magic-bytes'

/** Build a byte array from a magic-number prefix, padded to `len`. */
function bytes(prefix: number[], len = 16): Uint8Array {
  const out = new Uint8Array(Math.max(len, prefix.length))
  out.set(prefix, 0)
  return out
}

const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
// "RIFF" <size> "WEBP"
const WEBP = bytes([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])

describe('sniffImageType — accepts genuine allowed images', () => {
  it('accepts JPEG (FF D8 FF)', () => {
    expect(sniffImageType(JPEG)).toBe('jpeg')
  })
  it('accepts PNG (89 50 4E 47 …)', () => {
    expect(sniffImageType(PNG)).toBe('png')
  })
  it('accepts WebP (RIFF….WEBP)', () => {
    expect(sniffImageType(WEBP)).toBe('webp')
  })
})

describe('sniffImageType — rejects forged / non-image payloads', () => {
  it('rejects an SVG (<?xml / <svg) even though it is "an image" by extension', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
    expect(sniffImageType(svg)).toBeNull()
  })
  it('rejects raw HTML (stored-XSS vector on a public bucket)', () => {
    const html = new TextEncoder().encode('<!DOCTYPE html><script>alert(1)</script>')
    expect(sniffImageType(html)).toBeNull()
  })
  it('rejects a GIF (not in the allowlist)', () => {
    expect(sniffImageType(bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBeNull()
  })
  it('rejects a PDF', () => {
    expect(sniffImageType(bytes([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBeNull()
  })
  it('rejects RIFF that is not WEBP (e.g. WAV audio)', () => {
    const wav = bytes([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45])
    expect(sniffImageType(wav)).toBeNull()
  })
  it('rejects a too-short buffer (< 12 bytes) even with a JPEG prefix', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
  })
  it('rejects an empty buffer', () => {
    expect(sniffImageType(new Uint8Array(0))).toBeNull()
  })
})

describe('extension / content-type mapping', () => {
  it('maps jpeg → jpg, png → png, webp → webp', () => {
    expect(extensionForType('jpeg')).toBe('jpg')
    expect(extensionForType('png')).toBe('png')
    expect(extensionForType('webp')).toBe('webp')
  })
  it('produces canonical image/* content types', () => {
    expect(contentTypeForType('jpeg')).toBe('image/jpeg')
    expect(contentTypeForType('png')).toBe('image/png')
    expect(contentTypeForType('webp')).toBe('image/webp')
  })
})
