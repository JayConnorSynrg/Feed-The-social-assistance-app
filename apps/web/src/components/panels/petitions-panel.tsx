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
 *
 * Every string is read from lib/i18n-feed-petitions.ts in the member's language
 * (useProfileLocale); the panel root carries that language and its direction. A
 * petition's title and summary and the member's own name are shown as written
 * (dir="auto", no page language).
 */

import React, { useState, useCallback } from 'react'
import { ScrollText, CheckCircle2, Loader2, AlertCircle, X, ChevronDown, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePetitions } from '@/hooks/use-petitions'
import type { PetitionWithMeta } from '@/hooks/use-petitions'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { logEvent } from '@/lib/logger'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, isolate, splitMessage } from '@/lib/format-message'
import { formatCount, formatPercent } from '@/lib/i18n-intl'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { petitionCategoryLabel, petitionErrorText, petitionsT, signatureCountMessage } from '@/lib/i18n-feed-petitions'
import { nextTabIndex } from '@/components/feed/feed-chrome'

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

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
  onWithdraw: (id: string) => void
  isSigning: boolean
  /** A failure code from usePetitions (never a sentence). */
  signError: string | null
  locale: Locale
}

/** A card button's accessible name: its visible text first, then the petition it acts on. */
export function petitionActionName(locale: Locale, action: 'sign' | 'withdraw', title: string): string {
  return formatMessage(petitionsT(locale, 'actionForPetitionAria'), { action: petitionsT(locale, action), title: isolate(title) })
}

function PetitionCard({
  petition,
  signerDisplayName,
  onSign,
  onWithdraw,
  isSigning,
  signError,
  locale,
}: PetitionCardProps) {
  const pct = progressPercent(petition.signatureCount, petition.target_signatures)
  const hasTarget = petition.target_signatures > 0
  // "12 of 100 signatures" in the member's plural form; the count keeps its own bold element.
  const [beforeCount, afterCount] = splitMessage(
    formatMessage(signatureCountMessage(petition.signatureCount, petition.target_signatures, locale), {
      target: formatCount(petition.target_signatures, locale),
    }),
    'count'
  )
  const [beforeName, afterName] = splitMessage(petitionsT(locale, 'signingAs'), 'name')

  return (
    <div
      data-testid={`petition-card-${petition.id}`}
      className="bg-stone-50/95 border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3"
    >

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
              {petitionCategoryLabel(petition.cause_category, locale)}
            </span>
          </div>
          <h3 className="text-base font-semibold text-stone-900 leading-snug" lang="" dir="auto">
            {petition.title}
          </h3>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-stone-700 leading-relaxed line-clamp-3" lang="" dir="auto">
        {petition.summary}
      </p>

      {/* Signature progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span>
            {beforeCount}
            <span className="font-semibold text-stone-900">{formatCount(petition.signatureCount, locale)}</span>
            {afterCount}
          </span>
          {hasTarget && <span className="font-medium">{formatPercent(pct, locale)}</span>}
        </div>

        {hasTarget && (
          <div className="w-full bg-stone-200 rounded-full h-1.5" role="progressbar" aria-label={petitionsT(locale, 'progressLabel')} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="bg-lime-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Sign CTA */}
      {petition.hasSigned ? (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-lime-700 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium text-lime-800">{petitionsT(locale, 'signed')}</span>
          </div>

          {petition.isLocked ? (
            <p className="flex items-center gap-1.5 text-xs text-stone-500">
              <Lock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              {petitionsT(locale, 'signaturesFinal')}
            </p>
          ) : (
            <button
              onClick={() => onWithdraw(petition.id)}
              disabled={isSigning}
              aria-label={petitionActionName(locale, 'withdraw', petition.title)}
              data-testid={`withdraw-${petition.id}`}
              className="self-start flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-red-700 disabled:opacity-60 transition-colors"
            >
              {isSigning ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                <X className="w-3 h-3" aria-hidden="true" />
              )}
              {petitionsT(locale, 'withdraw')}
            </button>
          )}

          {signError && (
            <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{petitionErrorText(signError, locale)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-1">
          {/* Microcopy: signing-as + retention notice */}
          {signerDisplayName && (
            <p className="text-xs text-stone-500">
              {beforeName}
              <span lang="" dir="auto" className="font-medium text-stone-700">{signerDisplayName}</span>
              {afterName}
            </p>
          )}

          <button
            onClick={() => onSign(petition.id)}
            disabled={isSigning}
            aria-label={petitionActionName(locale, 'sign', petition.title)}
            data-testid={`sign-${petition.id}`}
            className="w-full flex items-center justify-center gap-2 bg-lime-700 hover:bg-lime-800 disabled:opacity-60 text-white font-semibold text-sm rounded-xl py-2.5 px-4 transition-colors"
          >
            {isSigning ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ScrollText className="w-4 h-4" aria-hidden="true" />
            )}
            {petitionsT(locale, 'sign')}
          </button>

          <p className="text-xs text-stone-600 text-center leading-snug">
            {petitionsT(locale, 'retentionNotice')}
          </p>

          {signError && (
            <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{petitionErrorText(signError, locale)}</span>
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
  const { profile, isAuthenticated, isAnonymous } = useAuth()
  const locale = useProfileLocale()
  const { petitions, loading, error, sign, withdraw, signingId, signError, refresh } = usePetitions()
  const [faqOpen, setFaqOpen] = useState(false)
  const [activeSubtab, setActiveSubtab] = useState<'all' | 'signed'>('all')

  const signerDisplayName = profile?.full_name || undefined

  const handleSubtabSwitch = useCallback((subtab: 'all' | 'signed') => {
    setActiveSubtab(subtab)
    logEvent('nav.subtab.switch', { panel: 'petitions', subtab })
  }, [])

  // ARIA roving tabindex keyboard handler for petitions subtab list
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
      const tabs: Array<'all' | 'signed'> = ['all', 'signed']
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSubtabSwitch(tabs[currentIdx]); return }
      // ArrowRight / ArrowLeft follow the reading direction (Arabic: ArrowLeft is forward); Home / End jump.
      const next = nextTabIndex(e.key, currentIdx, tabs.length, locale)
      if (next === null) return
      e.preventDefault()
      const tabEls = (e.currentTarget.closest('[role="tablist"]') as HTMLElement | null)?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      tabEls?.[next]?.focus()
      handleSubtabSwitch(tabs[next])
    },
    [handleSubtabSwitch, locale]
  )

  if (loading) {
    return (
      <div lang={locale} dir={dir(locale)} className="flex flex-col items-center justify-center h-48 gap-3">
        <Loader2 className="w-7 h-7 text-lime-700 animate-spin" aria-hidden="true" />
        <p className="text-sm text-stone-500">{petitionsT(locale, 'loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div lang={locale} dir={dir(locale)} className="flex flex-col items-center justify-center h-48 gap-3 p-6 text-center">
        <AlertCircle className="w-7 h-7 text-red-400" aria-hidden="true" />
        <p className="text-sm text-stone-700">{petitionErrorText(error, locale)}</p>
        <button
          onClick={refresh}
          className="text-sm text-lime-700 underline underline-offset-2"
        >
          {petitionsT(locale, 'tryAgain')}
        </button>
      </div>
    )
  }

  if (petitions.length === 0) {
    return (
      <div lang={locale} dir={dir(locale)} className="flex flex-col items-center justify-center h-48 gap-3 p-6 text-center">
        <ScrollText className="w-8 h-8 text-stone-300" aria-hidden="true" />
        <p className="text-sm text-stone-500 font-medium">{petitionsT(locale, 'emptyTitle')}</p>
        <p className="text-xs text-stone-600">
          {petitionsT(locale, 'emptyBody')}
        </p>
      </div>
    )
  }

  const signedPetitions = petitions.filter((p) => p.hasSigned)

  return (
    <div lang={locale} dir={dir(locale)} className="flex flex-col gap-4">
      {/* Panel header */}
      <div className="flex items-center gap-2 pb-1">
        <ScrollText className="w-5 h-5 text-lime-700 flex-shrink-0" aria-hidden="true" />
        <h2 className="text-lg font-bold text-stone-900">{petitionsT(locale, 'title')}</h2>
      </div>

      {/* Subtab list — ARIA tablist (W3C APG Tabs) */}
      <div
        role="tablist"
        aria-label={petitionsT(locale, 'tabsLabel')}
        className="flex gap-2 border-b border-stone-200 pb-3"
      >
        <button
          role="tab"
          id="petitions-tab-all"
          data-testid="petitions-tab-all"
          aria-selected={activeSubtab === 'all'}
          aria-controls="petitions-panel-all"
          tabIndex={activeSubtab === 'all' ? 0 : -1}
          onClick={() => handleSubtabSwitch('all')}
          onKeyDown={(e) => handleTabKeyDown(e, 0)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeSubtab === 'all'
              ? 'bg-lime-100 text-lime-800'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {petitionsT(locale, 'tabAll')}
        </button>
        <button
          role="tab"
          id="petitions-tab-signed"
          data-testid="petitions-tab-signed"
          aria-selected={activeSubtab === 'signed'}
          aria-controls="petitions-panel-signed"
          tabIndex={activeSubtab === 'signed' ? 0 : -1}
          onClick={() => handleSubtabSwitch('signed')}
          onKeyDown={(e) => handleTabKeyDown(e, 1)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeSubtab === 'signed'
              ? 'bg-lime-100 text-lime-800'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {petitionsT(locale, 'tabSigned')}
        </button>
      </div>

      {/* FAQ disclosure */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl">
        <button
          onClick={() => setFaqOpen((v) => !v)}
          aria-expanded={faqOpen}
          data-testid="petition-faq-toggle"
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-stone-700"
        >
          {petitionsT(locale, 'faqToggle')}
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform ${faqOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {faqOpen && (
          <div
            data-testid="petition-faq-content"
            className="px-3 pb-3 text-xs text-stone-600 leading-relaxed space-y-2"
          >
            <p>{petitionsT(locale, 'faqPrivacy')}</p>
            <p>{petitionsT(locale, 'faqWithdraw')}</p>
            <p>{petitionsT(locale, 'faqVerified')}</p>
          </div>
        )}
      </div>

      {(!isAuthenticated || isAnonymous) && (
        <div className="mb-1">
          {isAnonymous ? (
            <CreateAccountPrompt message={petitionsT(locale, 'guestPrompt')} linkLabel={feedChromeT(locale, 'createAccount')} />
          ) : (
            <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-xl p-3">
              {petitionsT(locale, 'signInPrompt')}
            </div>
          )}
        </div>
      )}

      {/* Tabpanel: All petitions */}
      <div
        id="petitions-panel-all"
        role="tabpanel"
        aria-labelledby="petitions-tab-all"
        hidden={activeSubtab !== 'all'}
        className="flex flex-col gap-4"
      >
        {petitions.map((petition) => (
          <PetitionCard
            key={petition.id}
            petition={petition}
            signerDisplayName={isAuthenticated ? signerDisplayName : undefined}
            onSign={sign}
            onWithdraw={withdraw}
            isSigning={signingId === petition.id}
            signError={signingId === petition.id ? signError : null}
            locale={locale}
          />
        ))}
      </div>

      {/* Tabpanel: Signed petitions */}
      <div
        id="petitions-panel-signed"
        role="tabpanel"
        aria-labelledby="petitions-tab-signed"
        hidden={activeSubtab !== 'signed'}
        className="flex flex-col gap-4"
      >
        {signedPetitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3 p-6 text-center">
            <CheckCircle2 className="w-7 h-7 text-stone-300" aria-hidden="true" />
            <p className="text-sm text-stone-500 font-medium">{petitionsT(locale, 'signedEmptyTitle')}</p>
            <p className="text-xs text-stone-600">
              {petitionsT(locale, 'signedEmptyBody')}
            </p>
          </div>
        ) : (
          signedPetitions.map((petition) => (
            <PetitionCard
              key={petition.id}
              petition={petition}
              signerDisplayName={isAuthenticated ? signerDisplayName : undefined}
              onSign={sign}
              onWithdraw={withdraw}
              isSigning={signingId === petition.id}
              signError={signingId === petition.id ? signError : null}
              locale={locale}
            />
          ))
        )}
      </div>
    </div>
  )
}
