'use client'

/**
 * Dynamic (SSR-disabled) wrapper for PdfDocumentViewer.
 *
 * react-pdf references DOMMatrix and other browser-only globals at module
 * evaluation time. This dynamic() wrapper prevents those globals from being
 * evaluated during Next.js static prerender (same pattern as pdf-annotator-dynamic.tsx).
 */

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { PdfDocumentViewerProps } from './pdf-document-viewer'

export type { PdfDocumentViewerProps }

const PdfDocumentViewerInner = dynamic(
  () => import('./pdf-document-viewer').then((mod) => ({ default: mod.PdfDocumentViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    ),
  }
)

export function PdfDocumentViewer(props: PdfDocumentViewerProps) {
  return <PdfDocumentViewerInner {...props} />
}
