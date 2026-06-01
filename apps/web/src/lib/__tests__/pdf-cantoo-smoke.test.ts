/**
 * pdf-cantoo-smoke.test.ts
 *
 * Validates that @cantoo/pdf-lib (the maintained fork of pdf-lib) is
 * functionally sound for the operations FEED requires:
 *   1. Load a minimal valid PDF from a Uint8Array
 *   2. Draw text (free-position annotation)
 *   3. Flatten AcroForm fields
 *   4. Save — output is valid PDF bytes (starts with %PDF magic)
 *   5. The saved output re-loads without throwing
 *   6. .slice() isolation — loading from a slice does not mutate the source
 *
 * This test exists to catch any API drift between pdf-lib and @cantoo/pdf-lib
 * and to prove the fork swap is functionally sound after the CSP fix.
 *
 * Regression guard: replaces the blob/fetch load path that triggered
 * CSP connect-src violations (no blob: in next.config.ts connect-src).
 */

import { describe, it, expect } from 'vitest'
import { PDFDocument, rgb } from '@cantoo/pdf-lib'

// ---------------------------------------------------------------------------
// Helper: generate a minimal 1-page AcroForm-capable PDF in memory
// ---------------------------------------------------------------------------

async function buildMinimalPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792]) // US Letter

  // Add a text field to the AcroForm so flatten() has something to process
  const form = doc.getForm()
  const field = form.createTextField('test.field')
  field.setText('Hello FEED')
  field.addToPage(page, { x: 50, y: 700, width: 200, height: 24 })

  // Draw some free text as well
  page.drawText('Minimal fixture', {
    x: 50,
    y: 650,
    size: 12,
    color: rgb(0, 0, 0),
  })

  const saved = await doc.save()
  return new Uint8Array(saved)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@cantoo/pdf-lib smoke', () => {
  it('creates, annotates, flattens, and saves a PDF with valid magic bytes', async () => {
    const originalBytes = await buildMinimalPdf()

    // Validate magic bytes of the source PDF
    expect(originalBytes[0]).toBe(0x25) // %
    expect(originalBytes[1]).toBe(0x50) // P
    expect(originalBytes[2]).toBe(0x44) // D
    expect(originalBytes[3]).toBe(0x46) // F

    // Load from a FRESH SLICE (mirrors the production code path)
    const pdfDoc = await PDFDocument.load(originalBytes.slice())
    expect(pdfDoc.getPageCount()).toBe(1)

    const pages = pdfDoc.getPages()
    const [page] = pages

    // Draw a free-position annotation (the FEED annotation path)
    page.drawText('Test annotation', {
      x: 100,
      y: 500,
      size: 14,
      color: rgb(0, 0, 0),
    })

    // Flatten AcroForm (should not throw even when fields exist)
    expect(() => pdfDoc.getForm().flatten()).not.toThrow()

    const savedBytes = new Uint8Array(await pdfDoc.save())

    // Must be valid PDF bytes
    expect(savedBytes[0]).toBe(0x25) // %
    expect(savedBytes[1]).toBe(0x50) // P
    expect(savedBytes[2]).toBe(0x44) // D
    expect(savedBytes[3]).toBe(0x46) // F
    expect(savedBytes.length).toBeGreaterThan(100)
  })

  it('re-loads the saved output without throwing', async () => {
    const originalBytes = await buildMinimalPdf()
    const pdfDoc = await PDFDocument.load(originalBytes.slice())
    pdfDoc.getForm().flatten()
    const savedBytes = new Uint8Array(await pdfDoc.save())

    // Re-loading the output must not throw (proves round-trip integrity)
    const reloaded = await PDFDocument.load(savedBytes.slice())
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('slice isolation — loading a slice does not mutate the source buffer', async () => {
    const originalBytes = await buildMinimalPdf()
    const sourceSnapshot = originalBytes.slice()

    // Load via slice (production code pattern)
    const pdfDoc = await PDFDocument.load(originalBytes.slice())
    pdfDoc.getForm().flatten()
    await pdfDoc.save()

    // Source bytes must be unchanged
    expect(originalBytes).toEqual(sourceSnapshot)
  })

  it('flatten is a no-op on a PDF with no AcroForm fields', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage()
    page.drawText('No form fields', { x: 50, y: 700, size: 12, color: rgb(0, 0, 0) })
    const bytes = new Uint8Array(await doc.save())

    const reloaded = await PDFDocument.load(bytes.slice())
    // Should not throw even when there are no AcroForm fields
    expect(() => reloaded.getForm().flatten()).not.toThrow()

    const saved = new Uint8Array(await reloaded.save())
    expect(saved[0]).toBe(0x25)
  })
})
