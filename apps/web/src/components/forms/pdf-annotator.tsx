'use client'

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Save, Type, Wand2, X } from 'lucide-react'
import { usePdfAnnotation } from '@/hooks/use-pdf-annotation'
import type { TextAnnotation } from '@/hooks/use-pdf-annotation'
import { useVault } from '@/contexts/vault-context'
import { logger } from '@/lib/logger'
import { PDFDocument } from '@cantoo/pdf-lib'
import type { AutofillValues } from '@/lib/form-field-mapper'

// Version-matched 5.4.296 worker — do NOT change without updating react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const FONT_SIZES = [12, 14, 16, 18, 24] as const

// ============================================
// AcroForm field-name → AutofillValues key alias table
// Normalise: lowercase, strip non-alphanumeric chars, then match.
// Only TextFields are filled (checkboxes/radios skipped silently).
// ============================================

/** Normalise a PDF field name for matching: lowercase + strip non-alphanumerics */
function normaliseFieldName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Alias table: normalised AcroForm field name → AutofillValues key.
 *
 * Fields shipped with P9-T7:
 *   firstname / fname / givenname / first → first_name
 *   lastname / lname / familyname / surname / last → last_name
 *   fullname / name / yourname → full display name (first + last joined)
 *   emailaddress / email / emailid / mail → email
 *   phonenumber / phone / tel / mobile / cellphone / cell → phone
 *   streetaddress / address1 / addressline1 / street / line1 → address.line1
 *   addressline2 / apt / suite / unit / line2 → address.line2
 *   city / town / municipality → address.city
 *   state / stateprovince / province / region → address.state
 *   zip / zipcode / postalcode / postal → address.zip
 */
type AcroFillTarget =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'address_line1'
  | 'address_line2'
  | 'address_city'
  | 'address_state'
  | 'address_zip'

const FIELD_ALIAS_MAP: Record<string, AcroFillTarget> = {
  // first name
  firstname: 'first_name',
  fname: 'first_name',
  givenname: 'first_name',
  first: 'first_name',
  // last name
  lastname: 'last_name',
  lname: 'last_name',
  familyname: 'last_name',
  surname: 'last_name',
  last: 'last_name',
  // full name (join first + last)
  fullname: 'full_name',
  name: 'full_name',
  yourname: 'full_name',
  // email
  emailaddress: 'email',
  email: 'email',
  emailid: 'email',
  mail: 'email',
  // phone
  phonenumber: 'phone',
  phone: 'phone',
  tel: 'phone',
  mobile: 'phone',
  cellphone: 'phone',
  cell: 'phone',
  // address line 1
  streetaddress: 'address_line1',
  address1: 'address_line1',
  addressline1: 'address_line1',
  street: 'address_line1',
  line1: 'address_line1',
  // address line 2
  addressline2: 'address_line2',
  apt: 'address_line2',
  suite: 'address_line2',
  unit: 'address_line2',
  line2: 'address_line2',
  // city
  city: 'address_city',
  town: 'address_city',
  municipality: 'address_city',
  // state
  state: 'address_state',
  stateprovince: 'address_state',
  province: 'address_state',
  region: 'address_state',
  // zip
  zip: 'address_zip',
  zipcode: 'address_zip',
  postalcode: 'address_zip',
  postal: 'address_zip',
}

/**
 * Resolve a value string for an AcroFillTarget from the autofill bag.
 * Returns undefined when the value is not available.
 */
function resolveValue(target: AcroFillTarget, autofill: AutofillValues): string | undefined {
  switch (target) {
    case 'first_name': return autofill.first_name
    case 'last_name': return autofill.last_name
    case 'full_name': {
      const parts = [autofill.first_name, autofill.last_name].filter(Boolean)
      return parts.length > 0 ? parts.join(' ') : undefined
    }
    case 'email': return autofill.email
    case 'phone': return autofill.phone
    case 'address_line1': return autofill.address?.line1
    case 'address_line2': return autofill.address?.line2
    case 'address_city': return autofill.address?.city
    case 'address_state': return autofill.address?.state
    case 'address_zip': return autofill.address?.zip
    default: return undefined
  }
}

/**
 * Fill AcroForm TextFields from an AutofillValues bag.
 * Returns { filled, total } counts for the toast message.
 * Only TextFields are processed — checkboxes/radios skipped silently.
 */
export async function fillAcroFormFields(
  pdfBytes: Uint8Array,
  autofill: AutofillValues
): Promise<{ filledBytes: Uint8Array; filled: number; total: number }> {
  const pdfDoc = await PDFDocument.load(pdfBytes.slice())
  const form = pdfDoc.getForm()
  const fields = form.getFields()

  let filled = 0
  let total = 0

  for (const field of fields) {
    // Only handle TextField (the only safe TextContent type for autofill)
    const fieldType = field.constructor.name
    if (fieldType !== 'PDFTextField') continue

    total++
    const rawName = field.getName()
    const normName = normaliseFieldName(rawName)
    const target = FIELD_ALIAS_MAP[normName]

    if (!target) continue

    const value = resolveValue(target, autofill)
    if (!value) continue

    try {
      // @cantoo/pdf-lib exposes setText on PDFTextField
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(field as any).setText(value)
      filled++
      logger.info('pdf.autofill.field', { field: rawName, target })
    } catch (err) {
      logger.warn('pdf.autofill.field.skip', { field: rawName, reason: err instanceof Error ? err.message : 'unknown' })
    }
  }

  const savedBytes = await pdfDoc.save()
  return { filledBytes: new Uint8Array(savedBytes), filled, total }
}

export interface PdfAnnotatorProps {
  file: File
  initialAnnotations?: TextAnnotation[]
  onSave: (data: { sourceBytes: Uint8Array; annotations: TextAnnotation[] }) => Promise<void>
  onCancel: () => void
  /**
   * Persist current work WITHOUT navigating away — invoked just before the
   * vault auto-locks (15-min idle) or is manually locked mid-edit, while the
   * encryption key is still available. VaultGuard unmounts this annotator on
   * lock, so this is what prevents in-progress annotations from being lost.
   * Unlike onSave, it must NOT change the panel's view state. When omitted, the
   * annotator does not register a pre-lock flush.
   */
  onFlushDraft?: (data: { sourceBytes: Uint8Array; annotations: TextAnnotation[] }) => Promise<void>
  /**
   * When provided, enables the "Fill from profile" toolbar button.
   * The caller passes a resolved AutofillValues bag from mapProfileToAutofill.
   * The annotator calls this to apply the values to AcroForm TextFields and
   * re-loads the modified PDF bytes, then notifies the caller via onFillComplete.
   */
  autofillValues?: AutofillValues
  /** Fired after successful autofill with { filled, total } counts. */
  onFillComplete?: (result: { filled: number; total: number }) => void
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

export function PdfAnnotator({ file, initialAnnotations, onSave, onCancel, onFlushDraft, autofillValues, onFillComplete }: PdfAnnotatorProps) {
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

  const { registerPreLockFlush } = useVault()

  const [isPlacementMode, setIsPlacementMode] = useState(false)
  const [fontSize, setFontSize] = useState<number>(14)
  const [scale, setScale] = useState(1)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isFilling, setIsFilling] = useState(false)
  const [fillResult, setFillResult] = useState<{ filled: number; total: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Guard: react-pdf fires onLoadSuccess on every re-render (including scale changes).
  // Without this guard, setScale triggers a render → Page re-fires onLoadSuccess →
  // setScale again → infinite "Maximum update depth exceeded" loop.
  // Reset to false in the loadPdf effect so a new document recalculates scale once.
  const scaleSetRef = useRef(false)

  useEffect(() => {
    scaleSetRef.current = false
    loadPdf(file, initialAnnotations)
  // initialAnnotations is intentionally excluded from deps: it is provided once
  // on mount and must not trigger a reload if the parent re-renders with the same
  // array reference or a new one. File identity is the correct reload signal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, loadPdf])

  // Memoize the document data so react-pdf does not reload on every render.
  // We must pass a SEPARATE .slice() copy — pdfjs may transfer/detach the
  // ArrayBuffer in its worker, and that buffer must never be the same one that
  // pdf-lib uses during savePdf. Memoized on pdfBytes identity.
  const docData = useMemo(() => {
    if (!pdfBytes) return null
    return { data: pdfBytes.slice() }
  }, [pdfBytes])

  const handlePageLoadSuccess = useCallback(({ width }: { width: number }) => {
    // Only compute scale once per document load — onLoadSuccess fires on every
    // Page re-render (e.g. when scale prop changes), which would loop forever.
    if (scaleSetRef.current) return
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32
      const computedScale = Math.min(containerWidth / width, 1.5)
      scaleSetRef.current = true
      setScale(computedScale)
    }
  }, [])

  const handleDocumentLoadError = useCallback((err: Error) => {
    logger.error('pdf.render.error', err, { byte_size: pdfBytes?.length ?? 0 })
    setSaveError(err.message || 'Failed to render PDF')
  }, [pdfBytes?.length])

  const handlePageLoadError = useCallback((err: Error) => {
    logger.error('pdf.render.error', err, { byte_size: pdfBytes?.length ?? 0 })
    setSaveError(err.message || 'Failed to render PDF page')
  }, [pdfBytes?.length])

  const handleSave = useCallback(async () => {
    setSaveError(null)
    logger.info('forms.pdf.save_initiated', { annotation_count: annotations.length })

    try {
      const result = await savePdf(scale)
      await onSave(result)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    }
  }, [annotations.length, savePdf, scale, onSave])

  // Pre-lock flush: persist current annotations (encrypted sidecar) just before
  // the vault auto-locks (15-min idle) or is manually locked mid-edit, while the
  // DEK is still available. VaultGuard unmounts this annotator on lock, so this
  // is what prevents in-progress annotations from being lost. Reuses savePdf
  // (existing) to capture source bytes + annotations, then hands them to the
  // parent's non-navigating persist (onFlushDraft → uploadFile). Refs keep the
  // registered callback stable (registered once) while reading the latest scale,
  // annotation count, and handler. Skips entirely when there is nothing to save.
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const onFlushDraftRef = useRef(onFlushDraft)
  onFlushDraftRef.current = onFlushDraft
  const annotationCountRef = useRef(annotations.length)
  annotationCountRef.current = annotations.length
  useEffect(() => {
    if (!onFlushDraft) return
    const unregister = registerPreLockFlush(async () => {
      const flush = onFlushDraftRef.current
      if (!flush || annotationCountRef.current === 0) return
      const result = await savePdf(scaleRef.current)
      await flush(result)
    })
    return unregister
    // savePdf is stable (empty deps); onFlushDraft presence gates registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerPreLockFlush, savePdf, !!onFlushDraft])

  /**
   * Fill AcroForm TextFields from the caller-supplied autofill bag.
   * On success: reloads the modified PDF bytes into the annotator and fires
   * onFillComplete with { filled, total } so the parent can show a toast.
   * Unmatched fields are left untouched; ssn/dob/income are excluded by
   * the alias table (not in FIELD_ALIAS_MAP).
   */
  const handleFillFromProfile = useCallback(async () => {
    if (!autofillValues || !pdfBytes) return

    setIsFilling(true)
    setSaveError(null)

    try {
      logger.info('pdf.autofill.start', { has_address: !!autofillValues.address })
      const { filledBytes, filled, total } = await fillAcroFormFields(pdfBytes, autofillValues)
      logger.info('pdf.autofill.complete', { filled, total })

      // Reload the annotator with the filled bytes; preserve existing annotations
      const filledFile = new File([filledBytes.buffer as ArrayBuffer], file.name, { type: 'application/pdf' })
      await loadPdf(filledFile, annotations)

      const result = { filled, total }
      setFillResult(result)
      // Auto-clear the banner after 4 s
      setTimeout(() => setFillResult(null), 4000)
      onFillComplete?.(result)
    } catch (err) {
      logger.error('pdf.autofill.error', err)
      setSaveError(err instanceof Error ? err.message : 'Fill from profile failed')
    } finally {
      setIsFilling(false)
    }
  }, [autofillValues, pdfBytes, annotations, file.name, loadPdf, onFillComplete])

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
    <div data-testid="pdf-annotator" className="h-full flex flex-col bg-stone-50">
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

        {/* Fill from profile — only shown when the caller provides autofillValues */}
        {autofillValues && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleFillFromProfile}
            disabled={isFilling || isLoading}
            data-testid="pdf-fill-from-profile-btn"
            className="text-lime-700 border-lime-300 hover:bg-lime-50"
            title="Fill AcroForm fields from your saved profile"
          >
            {isFilling ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Fill from Profile
          </Button>
        )}

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

        {fillResult && (
          <span
            className="text-xs text-lime-700 font-medium"
            data-testid="pdf-fill-result-banner"
          >
            Filled {fillResult.filled} of {fillResult.total} field{fillResult.total !== 1 ? 's' : ''}
          </span>
        )}

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
        {docData && (
          <Document
            file={docData}
            onLoadError={handleDocumentLoadError}
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
                  onLoadError={handlePageLoadError}
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
