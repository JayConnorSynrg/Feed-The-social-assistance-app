'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { PdfAnnotatorProps } from './pdf-annotator'

export type { PdfAnnotatorProps }

const PdfAnnotatorInner = dynamic(
  () => import('./pdf-annotator').then(mod => ({ default: mod.PdfAnnotator })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#4a5d23]" />
        <p className="text-sm text-stone-600">Loading PDF editor...</p>
      </div>
    ),
  }
)

export function PdfAnnotator(props: PdfAnnotatorProps) {
  return <PdfAnnotatorInner {...props} />
}
