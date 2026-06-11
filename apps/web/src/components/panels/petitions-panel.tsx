'use client'

/**
 * PetitionsPanel — Community Petitions
 *
 * Lists approved petitions with title, summary, cause_category badge,
 * signature count / target, progress bar, and one-click verified
 * signature of support.
 *
 * UI copy rule: NEVER "legally binding" / "legal contract".
 * Petitions are First-Amendment community advocacy only.
 */

import React from 'react'
import { ScrollText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePetitions } from '@/hooks/use-petitions'
import type { PetitionWithMeta } from '@/hooks/use-petitions'

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  land_rights: 'Land Rights',
  infrastructure: 'Infrastructure',
  housing: 'Housing',
  food_access: 'Food Access',
  healthcare: 'Healthcare',
  education: 'Education',
  environment: 'Environment',
  civil_rights: 'Civil Rights',
}

function categoryLabel(cat: string | null): string {
  if (!cat) return 'Community'
  return CATEGORY_LABELS[cat] ?? cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function categoryColor(cat: string | null): string {
  const map: Record<string, string> = {
    land_rights:    'bg-lime-100 text-lime-800',
    infrastructure: 'bg-sky-100 text-sky-800',
    housing:        'bg-amber-100 text-amber-800',
    food_access:    'bg-orange-100 text-orange-800',
    healthcare:     'bg-rose-100 text-rose-800',
    education:      'bg-indigo-100 text-indigo-800',
    environment:    'bg-green-100 text-green-800',
    civil_rights:   'bg-purple-100 text-purple-800',
  }
  return map[cat ?? ''] ?? 'bg-stone-100 text-stone-700'
}

function progressPercent(count: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((count / target) * 100))
}

// ─────────────────────────────────────────────────────────
// PetitionCard
// ─────────────────────────────────────────────────────────

interface PetitionCardProps {
  petition: PetitionWithMeta
  signerDisplayName: string | undefined
  onSign: (id: string) => void
  isSigning: boolean
  signError: string | null
}

function PetitionCard({
  petition,
  signerDisplayName,
  onSign,
  isSigning,
  signError,
}: PetitionCardProps) {
  const pct = progressPercent(petition.signatureCount, petition.target_signatures)
  const hasTarget = petition.target_signatures > 0

  return (
    <div className="bg-stone-50/95 border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">

      {/* Header: category badge + title */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-lime-50 border border-lime-100 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-lime-700" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColor(petition.cause_category)}`}
            >
              {categoryLabel(petition.cause_category)}
            </span>
          </div>
          <h3 className="text-base font-semibold text-stone-900 leading-snug">
            {petition.title}
          </h3>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-stone-700 leading-relaxed line-clamp-3">
        {petition.summary}
      </p>

      {/* Signature progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span>
            <span className="font-semibold text-stone-900">{petition.signatureCount.toLocaleString()}</span>
            {hasTarget && (
              <> of {petition.target_signatures.toLocaleString()} signatures</>
            )}
            {!hasTarget && <> verified signatures</>}
          </span>
          {hasTarget && <span className="font-medium">{pct}%</span>}
        </div>

        {hasTarget && (
          <div className="w-full bg-stone-200 rounded-full h-1.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="bg-lime-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Sign CTA */}
      {petition.hasSigned ? (
        <div className="flex items-center gap-2 mt-1">
          <CheckCircle2 className="w-4 h-4 text-lime-700 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-lime-800">Signed</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-1">
          {/* Microcopy: signing-as + retention notice */}
          {signerDisplayName && (
            <p className="text-xs text-stone-500">
              Signing as <span className="font-medium text-stone-700">{signerDisplayName}</span>
            </p>
          )}

          <button
            onClick={() => onSign(petition.id)}
            disabled={isSigning}
            aria-label={`Add your verified signature of support to: ${petition.title}`}
            className="w-full flex items-center justify-center gap-2 bg-lime-700 hover:bg-lime-800 disabled:opacity-60 text-white font-semibold text-sm rounded-xl py-2.5 px-4 transition-colors"
          >
            {isSigning ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ScrollText className="w-4 h-4" aria-hidden="true" />
            )}
            Add your verified signature of support
          </button>

          <p className="text-xs text-stone-600 text-center leading-snug">
            Your name, the date, and a record of this petition version are kept as your verified signature of support.
          </p>

          {signError && (
            <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{signError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// PetitionsPanel
// ─────────────────────────────────────────────────────────

export function PetitionsPanel() {
  const { profile, isAuthenticated } = useAuth()
  const { petitions, loading, error, sign, signingId, signError, refresh } = usePetitions()

  const signerDisplayName = profile?.full_name || undefined

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <Loader2 className="w-7 h-7 text-lime-700 animate-spin" aria-hidden="true" />
        <p className="text-sm text-stone-500">Loading petitions…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 p-6 text-center">
        <AlertCircle className="w-7 h-7 text-red-400" aria-hidden="true" />
        <p className="text-sm text-stone-700">{error}</p>
        <button
          onClick={refresh}
          className="text-sm text-lime-700 underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    )
  }

  if (petitions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 p-6 text-center">
        <ScrollText className="w-8 h-8 text-stone-300" aria-hidden="true" />
        <p className="text-sm text-stone-500 font-medium">No active petitions</p>
        <p className="text-xs text-stone-600">
          Community petitions will appear here when published.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Panel header */}
      <div className="flex items-center gap-2 pb-1">
        <ScrollText className="w-5 h-5 text-lime-700 flex-shrink-0" aria-hidden="true" />
        <h2 className="text-lg font-bold text-stone-900">Community Petitions</h2>
      </div>

      {!isAuthenticated && (
        <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-xl p-3">
          Sign in to add your verified signature of support to any petition.
        </div>
      )}

      {/* Petition cards */}
      <div className="flex flex-col gap-4">
        {petitions.map((petition) => (
          <PetitionCard
            key={petition.id}
            petition={petition}
            signerDisplayName={isAuthenticated ? signerDisplayName : undefined}
            onSign={sign}
            isSigning={signingId === petition.id}
            signError={signingId === petition.id || signError ? signError : null}
          />
        ))}
      </div>
    </div>
  )
}
