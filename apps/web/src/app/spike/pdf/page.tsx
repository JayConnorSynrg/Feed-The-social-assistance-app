'use client'

/**
 * DEV SPIKE — NOT FOR PRODUCTION
 *
 * PDF engine de-risk spike for P3 migration (@cantoo/pdf-lib evaluation).
 *
 * Tests:
 *   A. AcroForm fill + flatten fidelity on a real fillable PDF
 *   B. Free-position text overlay with documented screen→PDF coordinate transform
 *   C. Photo embed via embedJpg/embedPng → drawImage
 *
 * Access: npm run dev, then navigate to /spike/pdf
 * Direct URL (LAN / Capacitor): http://<LAN-IP>:3000/spike/pdf
 *
 * Coordinate transform formula (B):
 *   scale    = canvasCSSWidth / pdfPageWidth     (pdfjs render scale)
 *   dpr      = window.devicePixelRatio           (device pixel ratio)
 *   rawClick = getBoundingClientRect() offset    (CSS pixels, DPR-independent)
 *   pdfX     = rawClick.x / scale
 *   pdfY     = pdfPageHeight - (rawClick.y / scale)
 *
 * Note: getBoundingClientRect() returns CSS px which are already DPR-abstracted by
 * the browser. DPR affects canvas resolution (canvas.width = cssWidth * dpr) but
 * does NOT affect the CSS→PDF coordinate mapping. The formula above is correct for
 * all DPR values.
 */

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with browser-only APIs (canvas, crypto, IndexedDB)
const SpikePdfInner = dynamic(() => import('./spike-pdf-inner'), { ssr: false })

export default function SpikePdfPage() {
  return <SpikePdfInner />
}
