'use client'

import { useState, useCallback, useRef } from 'react'
import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import { withMetric } from '@/lib/logger'

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
  loadPdf: (file: File) => Promise<void>
  addAnnotation: (annotation: Omit<TextAnnotation, 'id'>) => void
  updateAnnotation: (id: string, updates: Partial<TextAnnotation>) => void
  removeAnnotation: (id: string) => void
  savePdf: (scale: number) => Promise<Uint8Array>
}

export type UsePdfAnnotationReturn = PdfAnnotationState & PdfAnnotationActions

function generateId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
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

  const loadPdf = useCallback(async (file: File) => {
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
      annotationsRef.current = []

      setState(prev => ({
        ...prev,
        pdfBytes: bytes.uint8,
        numPages: bytes.numPages,
        annotations: [],
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

  const savePdf = useCallback(async (scale: number): Promise<Uint8Array> => {
    // Read annotations from stable ref — avoids `state` object in dep array which
    // would cause savePdf to be recreated on every render → infinite loop.
    const annotations = annotationsRef.current
    const sourceBytes = originalBytesRef.current

    if (!sourceBytes) {
      throw new Error('No PDF loaded')
    }

    setState(prev => ({ ...prev, isSaving: true, error: null }))

    try {
      const result = await withMetric('pdf.save', { byte_size: sourceBytes.length }, async () => {
        // Always load from a FRESH COPY — never share the buffer react-pdf already owns
        const pdfDoc = await PDFDocument.load(sourceBytes.slice())
        const pages = pdfDoc.getPages()

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
        return new Uint8Array(saved)
      })

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save PDF'
      setState(prev => ({ ...prev, error: message }))
      throw err
    } finally {
      setState(prev => ({ ...prev, isSaving: false }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ...state,
    loadPdf,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    savePdf,
  }
}
