/**
 * image-reencode.test.ts
 *
 * Downscale math for the client re-encode (INV-M4). The canvas draw→toBlob step
 * that strips EXIF/GPS and outputs WebP is browser-only, but the guarantee that
 * matters for correctness — a large image is downscaled to the cap with aspect
 * ratio preserved, and a small image is never upscaled — lives in this pure
 * function and is asserted here. (The EXIF-strip + WebP-output guarantees are
 * inherent to reencodeImageToWebp: the canvas holds only pixels, and it always
 * calls toBlob('image/webp', 0.8); verified in browser E2E.)
 */

import { describe, it, expect } from 'vitest'
import { computeTargetDimensions, MAX_IMAGE_DIMENSION } from '../image-reencode'

describe('computeTargetDimensions — downscale + aspect preservation (INV-M4)', () => {
  it('downscales a large landscape image so the longest side is the cap', () => {
    const { width, height } = computeTargetDimensions(4000, 3000, 1600)
    expect(width).toBe(1600) // longest side clamped
    expect(height).toBe(1200) // 4:3 preserved (3000 * 1600/4000)
  })

  it('downscales a large portrait image so the longest (height) side is the cap', () => {
    const { width, height } = computeTargetDimensions(3000, 4000, 1600)
    expect(height).toBe(1600)
    expect(width).toBe(1200)
  })

  it('preserves the aspect ratio within a rounding tolerance', () => {
    const srcW = 4032
    const srcH = 3024
    const { width, height } = computeTargetDimensions(srcW, srcH, 1600)
    const srcRatio = srcW / srcH
    const outRatio = width / height
    expect(Math.abs(srcRatio - outRatio)).toBeLessThan(0.01)
  })

  it('never upscales an image already within the cap', () => {
    const { width, height } = computeTargetDimensions(800, 600, 1600)
    expect(width).toBe(800)
    expect(height).toBe(600)
  })

  it('leaves an image exactly at the cap unchanged', () => {
    const { width, height } = computeTargetDimensions(1600, 900, 1600)
    expect(width).toBe(1600)
    expect(height).toBe(900)
  })

  it('uses the 1600px default cap', () => {
    const { width } = computeTargetDimensions(3200, 3200)
    expect(width).toBe(MAX_IMAGE_DIMENSION)
  })

  it('returns 0×0 for invalid dimensions (guards the canvas encode)', () => {
    expect(computeTargetDimensions(0, 100)).toEqual({ width: 0, height: 0 })
    expect(computeTargetDimensions(-5, 100)).toEqual({ width: 0, height: 0 })
    expect(computeTargetDimensions(NaN, 100)).toEqual({ width: 0, height: 0 })
  })
})
