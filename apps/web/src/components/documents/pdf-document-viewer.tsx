'use client'

/**
 * PdfDocumentViewer
 *
 * In-app document viewer rendered inside a shadcn Dialog.
 * - PDF files: rendered via react-pdf (canvas; governed by script/worker/img-src —
 *   NOT frame-src/object-src, so it works under the existing CSP with zero changes).
 * - Image files: rendered via <img> (img-src allows blob:/data:).
 * - Other files: download link fallback.
 *
 * Worker setup reuses the same pdfjs.GlobalWorkerOptions.workerSrc path as
 * pdf-annotator.tsx to avoid duplicate worker registrations.
 *
 * Data flow: caller passes decrypted File → arrayBuffer() → memoized {data: bytes.slice()}
 * (slice prevents pdfjs ArrayBuffer-detachment from affecting the caller's File).
 *
 * P6 W9: the dialog's words are in the member's language (lang/dir on the portalled content);
 * the document's own name (the title) is the member's text, lang="" dir="auto". A failure shows a
 * translated line, never pdf.js's or the browser's message; a failed read writes one code-only
 * error_surface.shown row (a render failure is pdf.viewer.error, already written below).
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { logger } from '@/lib/logger'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir } from '@/lib/i18n'
import { documentsT, type DocumentsKey } from '@/lib/i18n-documents'
import { formatMessage } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'
import { failureCode } from '@/lib/failure-code'

// Version-matched worker — reuse same path as pdf-annotator.tsx
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfDocumentViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Decrypted File object returned by downloadFile() */
  file: File | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfDocumentViewer({ open, onOpenChange, file }: PdfDocumentViewerProps) {
  const locale = useProfileLocale()
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  // The failure line's key (never the text pdf.js or the browser wrote).
  const [loadError, setLoadError] = useState<DocumentsKey | null>(null)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [isLoadingBytes, setIsLoadingBytes] = useState(false)
  // Track when react-pdf Document starts rendering so we can emit load duration
  const pdfRenderStartRef = useRef<number>(0)

  const isPdf = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf')
  const isImage = file?.type?.startsWith('image/')

  // Convert File → ArrayBuffer once when file changes
  useEffect(() => {
    if (!file || !open) {
      setPdfBytes(null)
      setNumPages(0)
      setCurrentPage(1)
      setLoadError(null)
      return
    }

    if (!isPdf) {
      // Image and other types don't need byte conversion here
      return
    }

    setIsLoadingBytes(true)
    setLoadError(null)

    file.arrayBuffer()
      .then((buf) => {
        setPdfBytes(new Uint8Array(buf))
      })
      .catch((err: unknown) => {
        logger.warn('error_surface.shown', { surface: 'document-viewer', kind: failureCode(err), locale })
        setLoadError('readFailed')
      })
      .finally(() => {
        setIsLoadingBytes(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, open, isPdf])

  // Memoize document data — slice() prevents pdfjs from detaching the buffer
  // (same pattern as pdf-annotator.tsx docData memo)
  const docData = useMemo(() => {
    if (!pdfBytes) return null
    // Record when we hand bytes to react-pdf so onLoadSuccess can emit duration
    pdfRenderStartRef.current = performance.now()
    return { data: pdfBytes.slice() }
  }, [pdfBytes])

  // Image object URL — created once per file, revoked on close
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file || !isImage || !open) {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
        setImageUrl(null)
      }
      return
    }
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, isImage, open])

  const handleDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n)
    setCurrentPage(1)
    setLoadError(null)
    const duration_ms = pdfRenderStartRef.current > 0
      ? Math.round(performance.now() - pdfRenderStartRef.current)
      : undefined
    logger.info('pdf.viewer.load', {
      page_count: n,
      byte_size: pdfBytes?.length ?? 0,
      ...(duration_ms !== undefined ? { duration_ms } : {}),
    })
  }, [pdfBytes])

  const handleDocumentLoadError = useCallback((err: Error) => {
    setLoadError('renderFailed')
    logger.error('pdf.viewer.error', err, { byte_size: pdfBytes?.length ?? 0 })
  }, [pdfBytes])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const title = file?.name ?? t('documentFallback')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="document-viewer"
        className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0"
        lang={locale}
        dir={dir(locale)}
        hideDefaultClose
        aria-describedby={undefined}
      >
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-stone-900 truncate max-w-xs">
              {file?.name ? <span lang="" dir="auto">{file.name}</span> : title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-stone-700 hover:text-stone-900 flex-shrink-0"
              aria-label={t('close')}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-stone-100 min-h-0">
          {isLoadingBytes ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-stone-600" aria-hidden="true" />
              <span className="sr-only">{t('loadingDocument')}</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <p className="text-sm text-red-700 mb-4" role="alert">{t(loadError)}</p>
              {file && (
                <a
                  href={URL.createObjectURL(file)}
                  download={file.name}
                  className="text-sm text-[#4a5d23] underline"
                >
                  {t('downloadInstead')}
                </a>
              )}
            </div>
          ) : isPdf && docData ? (
            <div className="flex flex-col items-center py-4">
              <Document
                file={docData}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-stone-600" aria-hidden="true" />
                    <span className="sr-only">{t('loadingDocument')}</span>
                  </div>
                }
              >
                {Array.from({ length: numPages }, (_, i) => (
                  <div key={i + 1} className="mb-4 shadow-md">
                    <Page
                      pageNumber={i + 1}
                      width={Math.min(
                        typeof window !== 'undefined' ? window.innerWidth * 0.75 : 700,
                        800
                      )}
                      renderAnnotationLayer
                      renderTextLayer
                    />
                  </div>
                ))}
              </Document>
            </div>
          ) : isImage && imageUrl ? (
            <div className="flex items-center justify-center p-4 min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={file?.name ?? t('documentFallback')}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          ) : file && !isPdf && !isImage ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <p className="text-sm text-stone-700 mb-4">
                {t('noPreview')}
              </p>
              <a
                href={URL.createObjectURL(file)}
                download={file.name}
                className="px-4 py-2 rounded-lg bg-[#4a5d23] text-white text-sm font-medium hover:bg-[#3d4e1c] transition-colors"
              >
                {t('downloadFile')}
              </a>
            </div>
          ) : null}
        </div>

        {/* Pagination footer — only shown for multi-page PDFs */}
        {isPdf && numPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-stone-200 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-disabled={currentPage <= 1}
              className="h-8 w-8 aria-disabled:text-stone-500 aria-disabled:cursor-not-allowed"
              aria-label={t('previousPage')}
            >
              <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
            <span className="text-sm text-stone-700">
              {formatMessage(t('pageOf'), { page: formatCount(currentPage, locale), total: formatCount(numPages, locale) })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              aria-disabled={currentPage >= numPages}
              className="h-8 w-8 aria-disabled:text-stone-500 aria-disabled:cursor-not-allowed"
              aria-label={t('nextPage')}
            >
              <ChevronRight className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
