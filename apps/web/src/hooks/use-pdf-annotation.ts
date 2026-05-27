'use client'

import { useState, useCallback, useRef } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'

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
  loadPdf: (url: string) => Promise<void>
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

  const originalUrlRef = useRef<string | null>(null)

  const loadPdf = useCallback(async (url: string) => {
    const start = Date.now()
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    originalUrlRef.current = url

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)

      const pdfDoc = await PDFDocument.load(bytes)
      const numPages = pdfDoc.getPageCount()

      console.info(JSON.stringify({
        action: 'pdf_loaded',
        numPages,
        fileSizeKb: Math.round(bytes.length / 1024),
        durationMs: Date.now() - start,
      }))

      setState(prev => ({
        ...prev,
        pdfBytes: bytes,
        numPages,
        annotations: [],
        error: null,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load PDF'
      console.warn(JSON.stringify({
        action: 'pdf_error',
        phase: 'load',
      }))
      setState(prev => ({
        ...prev,
        error: message,
      }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const addAnnotation = useCallback((annotation: Omit<TextAnnotation, 'id'>) => {
    const newAnnotation: TextAnnotation = { ...annotation, id: generateId() }
    setState(prev => ({
      ...prev,
      annotations: [...prev.annotations, newAnnotation],
    }))
  }, [])

  const updateAnnotation = useCallback((id: string, updates: Partial<TextAnnotation>) => {
    setState(prev => ({
      ...prev,
      annotations: prev.annotations.map(ann =>
        ann.id === id ? { ...ann, ...updates } : ann
      ),
    }))
  }, [])

  const removeAnnotation = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      annotations: prev.annotations.filter(ann => ann.id !== id),
    }))
  }, [])

  const savePdf = useCallback(async (scale: number): Promise<Uint8Array> => {
    const { pdfBytes, annotations } = state

    if (!pdfBytes) {
      throw new Error('No PDF loaded')
    }

    const start = Date.now()
    setState(prev => ({ ...prev, isSaving: true, error: null }))

    let result: Uint8Array | undefined
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes)
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
        // No form fields present — safe to ignore
      }

      const saved = await pdfDoc.save()
      result = new Uint8Array(saved)

      console.info(JSON.stringify({
        action: 'pdf_saved',
        annotationCount: annotations.length,
        durationMs: Date.now() - start,
      }))

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save PDF'
      console.warn(JSON.stringify({
        action: 'pdf_error',
        phase: 'save',
      }))
      setState(prev => ({ ...prev, error: message }))
      throw err
    } finally {
      setState(prev => ({ ...prev, isSaving: false }))
    }
  }, [state])

  return {
    ...state,
    loadPdf,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    savePdf,
  }
}
