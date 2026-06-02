'use client'

import { useState, useCallback, useRef } from 'react'
import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import { logger, withMetric } from '@/lib/logger'

export interface TextAnnotation {
  id: string
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  text: string
  fontSize: number
}

interface PdfAnnotationState {
  pdfBytes: Uint8Array | null
  numPages: number
  annotations: TextAnnotation[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
}

export interface PdfAnnotationActions {
  loadPdf: (file: File, initialAnnotations?: TextAnnotation[]) => Promise<void>
  addAnnotation: (annotation: Omit<TextAnnotation, 'id'>) => void
  updateAnnotation: (id: string, updates: Partial<TextAnnotation>) => void
  removeAnnotation: (id: string) => void
  savePdf: (scale: number) => Promise<{ sourceBytes: Uint8Array; annotations: TextAnnotation[] }>
}

export type UsePdfAnnotationReturn = PdfAnnotationState & PdfAnnotationActions

function generateId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Flatten source PDF bytes with annotations drawn — used for view/download.
 * Exported so callers (documents-panel) can produce a printable copy without
 * re-uploading the source.
 */
export async function exportFlattened(
  sourceBytes: Uint8Array,
  annotations: TextAnnotation[],
  scale: number
): Promise<Uint8Array> {
  return withMetric(
    'pdf.export_flattened',
    { annotation_count: annotations.length, source_bytes: sourceBytes.length },
    async () => {
      // Always work from a fresh copy so the caller's buffer is never transferred
      const pdfDoc = await PDFDocument.load(sourceBytes.slice())
      const pages = pdfDoc.getPages()
      const page_count = pages.length

      for (const annotation of annotations) {
        const page = pages[annotation.pageIndex]
        if (!page) continue

        const { height: pageHeight } = page.getSize()

        const pdfX = annotation.x / scale
        const pdfY = pageHeight - (annotation.y / scale) - (annotation.height / scale)

        page.drawText(annotation.text, {
          x: pdfX,
          y: pdfY,
          size: annotation.fontSize / scale,
          color: rgb(0, 0, 0),
        })
      }

      try {
        pdfDoc.getForm().flatten()
      } catch {
        // No AcroForm fields present — safe to ignore
      }

      const saved = await pdfDoc.save()
      const result = new Uint8Array(saved)
      // Log page_count as an additional dimension not available at withMetric call-site
      logger.info('pdf.export_flattened.pages', { page_count, output_bytes: result.length })
      return result
    }
  ).catch((err) => {
    logger.error('pdf.export_flattened.error', err, {
      annotation_count: annotations.length,
      source_bytes: sourceBytes.length,
    })
    throw err
  })
}

export function usePdfAnnotation(): UsePdfAnnotationReturn {
  const [state, setState] = useState<PdfAnnotationState>({
    pdfBytes: null,
    numPages: 0,
    annotations: [],
    isLoading: false,
    isSaving: false,
    error: null,
  })

  // We store a ref to the original bytes so savePdf always has a fresh copy
  // independent of what React-PDF / pdfjs may have done to the ArrayBuffer.
  const originalBytesRef = useRef<Uint8Array | null>(null)

  // Stable ref to current annotations — lets savePdf read the latest annotations
  // without including `state` (an object) in its dependency array, which would
  // recreate savePdf on every render and trigger an infinite re-render loop via
  // handleSave → onSave → setProgress → re-render → new savePdf → repeat.
  const annotationsRef = useRef<TextAnnotation[]>([])

  const loadPdf = useCallback(async (file: File, initialAnnotations?: TextAnnotation[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const bytes = await withMetric('pdf.load', { byte_size: file.size }, async () => {
        const buf = await file.arrayBuffer()
        const uint8 = new Uint8Array(buf)

        // Validate: @cantoo/pdf-lib load to get page count (parse validation)
        const pdfDoc = await PDFDocument.load(uint8.slice())
        const numPages = pdfDoc.getPageCount()

        return { uint8, numPages }
      })

      originalBytesRef.current = bytes.uint8

      // Seed annotations from initialAnnotations if provided (re-edit flow)
      const seedAnnotations = initialAnnotations ?? []
      annotationsRef.current = seedAnnotations

      setState(prev => ({
        ...prev,
        pdfBytes: bytes.uint8,
        numPages: bytes.numPages,
        annotations: seedAnnotations,
        error: null,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load PDF'
      setState(prev => ({ ...prev, error: message }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const addAnnotation = useCallback((annotation: Omit<TextAnnotation, 'id'>) => {
    const newAnnotation: TextAnnotation = { ...annotation, id: generateId() }
    setState(prev => {
      const next = [...prev.annotations, newAnnotation]
      annotationsRef.current = next
      return { ...prev, annotations: next }
    })
  }, [])

  const updateAnnotation = useCallback((id: string, updates: Partial<TextAnnotation>) => {
    setState(prev => {
      const next = prev.annotations.map(ann =>
        ann.id === id ? { ...ann, ...updates } : ann
      )
      annotationsRef.current = next
      return { ...prev, annotations: next }
    })
  }, [])

  const removeAnnotation = useCallback((id: string) => {
    setState(prev => {
      const next = prev.annotations.filter(ann => ann.id !== id)
      annotationsRef.current = next
      return { ...prev, annotations: next }
    })
  }, [])

  /**
   * savePdf returns the ORIGINAL (unflattened) source bytes plus the current
   * annotations so the caller can store them separately as a sidecar.
   * Flattening for view/download is handled by exportFlattened().
   */
  const savePdf = useCallback(
    async (_scale: number): Promise<{ sourceBytes: Uint8Array; annotations: TextAnnotation[] }> => {
      // Read annotations from stable ref — avoids `state` object in dep array which
      // would cause savePdf to be recreated on every render → infinite loop.
      const annotations = annotationsRef.current
      const sourceBytes = originalBytesRef.current

      if (!sourceBytes) {
        throw new Error('No PDF loaded')
      }

      setState(prev => ({ ...prev, isSaving: true, error: null }))

      try {
        // Return the unflattened source + current annotations for sidecar storage.
        // We record the metric so observability still captures save events.
        await withMetric('pdf.save', { byte_size: sourceBytes.length, annotation_count: annotations.length }, async () => {
          // No-op body: metric wraps the intent, actual data is returned below
        })

        return { sourceBytes: sourceBytes.slice(), annotations }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save PDF'
        setState(prev => ({ ...prev, error: message }))
        throw err
      } finally {
        setState(prev => ({ ...prev, isSaving: false }))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return {
    ...state,
    loadPdf,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    savePdf,
  }
}
