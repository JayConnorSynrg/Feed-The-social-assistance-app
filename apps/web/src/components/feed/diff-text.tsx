// apps/web/src/components/feed/diff-text.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Renders a word diff (lib/text-diff.ts) so a change is never shown by colour alone: removed words are
// <del> with a visible "−" and screen-reader text "removed", added words <ins> with "+" and "added".
// Colours meet AA (red-900 on red-50, green-900 on green-50). The member's text keeps dir="auto".

import React from 'react'
import type { DiffPart } from '@/lib/text-diff'

export function DiffText({ parts, addedLabel, removedLabel }: { parts: readonly DiffPart[]; addedLabel: string; removedLabel: string }) {
  return (
    <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800">
      {parts.map((p, i) => {
        if (p.kind === 'same') return <React.Fragment key={i}>{p.text}</React.Fragment>
        if (p.kind === 'removed') {
          return (
            <del key={i} className="rounded-sm bg-red-50 px-0.5 text-red-900 line-through decoration-red-900">
              <span aria-hidden="true" className="font-semibold no-underline">−</span>
              <span className="sr-only">{removedLabel}: </span>
              {p.text}
            </del>
          )
        }
        return (
          <ins key={i} className="rounded-sm bg-green-50 px-0.5 text-green-900 no-underline">
            <span aria-hidden="true" className="font-semibold">+</span>
            <span className="sr-only">{addedLabel}: </span>
            {p.text}
          </ins>
        )
      })}
    </p>
  )
}
