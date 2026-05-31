'use client'

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Save, X, Type } from 'lucide-react'
import { usePdfAnnotation } from '@/hooks/use-pdf-annotation'
import type { TextAnnotation } from '@/hooks/use-pdf-annotation'
import { logger } from '@/lib/logger'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const FONT_SIZES = [12, 14, 16, 18, 24] as const

export interface PdfAnnotatorProps {
  pdfUrl: string
  onSave: (pdfBytes: Uint8Array) => Promise<void>
  onCancel: () => void
}

interface DragState {
  annotationId: string
  startMouseX: number
  startMouseY: number
  startAnnotationX: number
  startAnnotationY: number
}

interface ResizeState {
  annotationId: string
  startMouseX: number
  startMouseY: number
  startWidth: number
  startHeight: number
}

function TextBox({
  annotation,
  onUpdate,
  onRemove,
}: {
  annotation: TextAnnotation
  onUpdate: (id: string, updates: Partial<TextAnnotation>) => void
  onRemove: (id: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  const handleMouseDownDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    dragRef.current = {
      annotationId: annotation.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startAnnotationX: annotation.x,
      startAnnotationY: annotation.y,
    }

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startMouseX
      const dy = ev.clientY - dragRef.current.startMouseY
      onUpdate(annotation.id, {
        x: Math.max(0, dragRef.current.startAnnotationX + dx),
        y: Math.max(0, dragRef.current.startAnnotationY + dy),
      })
    }

    const onMouseUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [annotation.id, annotation.x, annotation.y, onUpdate])

  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    resizeRef.current = {
      annotationId: annotation.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: annotation.width,
      startHeight: annotation.height,
    }

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startMouseX
      const dy = ev.clientY - resizeRef.current.startMouseY
      onUpdate(annotation.id, {
        width: Math.max(80, resizeRef.current.startWidth + dx),
        height: Math.max(24, resizeRef.current.startHeight + dy),
      })
    }

    const onMouseUp = () => {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [annotation.id, annotation.width, annotation.height, onUpdate])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    if (contentRef.current) {
      onUpdate(annotation.id, { text: contentRef.current.innerText })
    }
  }, [annotation.id, onUpdate])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setTimeout(() => contentRef.current?.focus(), 0)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        left: annotation.x,
        top: annotation.y,
        width: annotation.width,
        height: annotation.height,
        border: '2px dashed #3b82f6',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        boxSizing: 'border-box',
        userSelect: isEditing ? 'text' : 'none',
        cursor: isEditing ? 'text' : 'move',
      }}
      onDoubleClick={handleDoubleClick}
    >
      <div
        style={{
          position: 'absolute',
          top: -20,
          left: 0,
          right: 0,
          height: 20,
          backgroundColor: '#3b82f6',
          cursor: 'move',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 4,
        }}
        onMouseDown={handleMouseDownDrag}
      >
        <Type style={{ width: 10, height: 10, color: 'white' }} />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(annotation.id) }}
        style={{
          position: 'absolute',
          top: -20,
          right: 0,
          width: 20,
          height: 20,
          backgroundColor: '#ef4444',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          zIndex: 10,
        }}
        aria-label="Remove text box"
      >
        <X style={{ width: 10, height: 10, color: 'white' }} />
      </button>

      <div
        ref={contentRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={handleBlur}
        style={{
          width: '100%',
          height: '100%',
          padding: '2px 4px',
          fontSize: annotation.fontSize,
          fontFamily: 'Helvetica, Arial, sans-serif',
          color: '#000',
          outline: 'none',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxSizing: 'border-box',
        }}
      >
        {annotation.text}
      </div>

      <div
        onMouseDown={handleMouseDownResize}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 12,
          height: 12,
          backgroundColor: '#3b82f6',
          cursor: 'se-resize',
        }}
      />
    </div>
  )
}

interface PageOverlayProps {
  pageIndex: number
  annotations: TextAnnotation[]
  isPlacementMode: boolean
  fontSize: number
  onAnnotationAdd: (annotation: Omit<TextAnnotation, 'id'>) => void
  onAnnotationUpdate: (id: string, updates: Partial<TextAnnotation>) => void
  onAnnotationRemove: (id: string) => void
}

function PageOverlay({
  pageIndex,
  annotations,
  isPlacementMode,
  fontSize,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationRemove,
}: PageOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isPlacementMode) return
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    logger.info('forms.pdf.textbox_added', { pageIndex, x: Math.round(x), y: Math.round(y) })

    onAnnotationAdd({
      pageIndex,
      x,
      y,
      width: 200,
      height: Math.ceil(fontSize * 1.5) + 8,
      text: '',
      fontSize,
    })
  }, [isPlacementMode, pageIndex, fontSize, onAnnotationAdd])

  return (
    <div
      ref={overlayRef}
      onClick={handleClick}
      style={{
        position: 'absolute',
        inset: 0,
        cursor: isPlacementMode ? 'crosshair' : 'default',
        zIndex: 5,
      }}
    >
      {annotations.map(ann => (
        <TextBox
          key={ann.id}
          annotation={ann}
          onUpdate={onAnnotationUpdate}
          onRemove={onAnnotationRemove}
        />
      ))}
    </div>
  )
}

export function PdfAnnotator({ pdfUrl, onSave, onCancel }: PdfAnnotatorProps) {
  const {
    pdfBytes,
    numPages,
    annotations,
    isLoading,
    isSaving,
    error,
    loadPdf,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    savePdf,
  } = usePdfAnnotation()

  const [isPlacementMode, setIsPlacementMode] = useState(false)
  const [fontSize, setFontSize] = useState<number>(14)
  const [scale, setScale] = useState(1)
  const [saveError, setSaveError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPdf(pdfUrl)
  }, [pdfUrl, loadPdf])

  const handlePageLoadSuccess = useCallback(({ width }: { width: number }) => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32
      const computedScale = Math.min(containerWidth / width, 1.5)
      setScale(computedScale)
    }
  }, [])

  const handleSave = useCallback(async () => {
    setSaveError(null)
    logger.info('forms.pdf.save_initiated', { annotation_count: annotations.length })

    try {
      const bytes = await savePdf(scale)
      await onSave(bytes)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    }
  }, [annotations.length, savePdf, scale, onSave])

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#4a5d23]" />
        <p className="text-sm text-stone-600">Loading PDF...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-red-600 font-medium">Failed to load PDF</p>
        <p className="text-xs text-stone-500">{error}</p>
        <Button variant="outline" size="sm" onClick={onCancel}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-stone-50">
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-100 border-b border-stone-200 flex-wrap">
        <Button
          size="sm"
          variant={isPlacementMode ? 'default' : 'outline'}
          onClick={() => setIsPlacementMode(prev => !prev)}
          className={isPlacementMode ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {isPlacementMode ? 'Click Page to Place' : 'Add Text Box'}
        </Button>

        <div className="flex items-center gap-1">
          <span className="text-xs text-stone-500 mr-1">Size:</span>
          {FONT_SIZES.map(size => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                fontSize === size
                  ? 'bg-[#4a5d23] text-white'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {saveError && (
          <span className="text-xs text-red-600">{saveError}</span>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#4a5d23] hover:bg-[#3d4d1d] text-white"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1.5" />
          )}
          Save PDF
        </Button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto flex flex-col items-center gap-4 py-6 px-4"
      >
        {pdfBytes && (
          <Document
            file={pdfBytes.buffer as ArrayBuffer}
            loading={
              <div className="flex items-center gap-2 text-stone-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                Rendering pages...
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={i}
                style={{ position: 'relative', marginBottom: 16, display: 'inline-block' }}
              >
                <Page
                  pageIndex={i}
                  scale={scale}
                  onLoadSuccess={i === 0 ? handlePageLoadSuccess : undefined}
                  renderAnnotationLayer
                  renderTextLayer
                />
                <PageOverlay
                  pageIndex={i}
                  annotations={annotations.filter(a => a.pageIndex === i)}
                  isPlacementMode={isPlacementMode}
                  fontSize={fontSize}
                  onAnnotationAdd={addAnnotation}
                  onAnnotationUpdate={updateAnnotation}
                  onAnnotationRemove={removeAnnotation}
                />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  )
}
