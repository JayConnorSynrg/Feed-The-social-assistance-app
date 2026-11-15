'use client'

// apps/web/src/components/panels/chat-panel.tsx
// AI Chat interface panel - wired to real Supabase edge function via useChat hook.
// The landing panel after sign-in. Every word FEED writes here is in the viewer's language
// (lib/i18n-assistant.ts) and the panel is marked with it; messages (the member's and the
// assistant's) keep their own direction and take no page language. The prompts this panel builds
// for the assistant (screening results, wizard context) are unchanged by the language.

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Send, Sparkles, Search, Apple, Building2, Heart, FileText, Square, CheckCircle, Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChat, type ChatMessage, type ChatErrorKind } from '@/hooks/use-chat'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { GuidedFlowComponent } from '@/components/chat/guided-flow'
import { resourceFinderFlow, eligibilityCheckerFlow, formHelpFlow } from '@/lib/ai/guided-flows'
import type { GuidedFlow } from '@/lib/ai/guided-flows'
import { useSavedResources, type SaveResourceInput } from '@/hooks/use-saved-resources'
import { usePanelContext } from '@/components/layout/feed-shell'
import type { SystemPromptKey } from '@/lib/ai/system-prompts'
import { buildExplainRequest, type SafeErrorContext } from '@/lib/ai/error-explainer'
import { buildWizardPrompt, parseWizardContext } from '@/lib/ai/wizard-prompt'
import { t, dir, type Locale } from '@/lib/i18n'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { assistantT, type AssistantKey } from '@/lib/i18n-assistant'
import { formatMessage, isolate, splitMessage } from '@/lib/format-message'
import { formatClock } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { buildScreeningRequest } from '@/lib/eligibility-screening'
import { logger } from '@/lib/logger'

// ============================================
// FLOW SELECTION CARD
// ============================================
interface FlowCardProps {
  icon: React.ElementType
  iconBg: string
  title: string
  description: string
  onClick?: () => void
  /** The card's button, so focus can come back to it when its guided flow is cancelled. */
  buttonRef?: (el: HTMLButtonElement | null) => void
}

function FlowCard({ icon: Icon, iconBg, title, description, onClick, buttonRef }: FlowCardProps) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-xl border border-stone-200 bg-[#faf9f6] hover:border-primary/50 hover:bg-[#f5f3ee] transition-all text-start group shadow-sm"
    >
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
        <Icon aria-hidden="true" className="w-5 h-5" />
      </div>
      <h3 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-stone-700 leading-relaxed">
        {description}
      </p>
    </button>
  )
}

// ============================================
// QUICK ACTION TAGS
// ============================================
const QUICK_TAGS: ReadonlyArray<{ id: string; key: AssistantKey; icon: React.ElementType }> = [
  { id: 'resources', key: 'tagFindResources', icon: Search },
  { id: 'eligibility', key: 'tagEligibility', icon: FileText },
  { id: 'food', key: 'tagFood', icon: Apple },
  { id: 'social', key: 'tagSocialServices', icon: Building2 },
  { id: 'health', key: 'tagHealthcare', icon: Heart },
]

interface QuickTagProps {
  label: string
  icon: React.ElementType
  onClick: () => void
  isActive?: boolean
}

function QuickTag({ label, icon: Icon, onClick, isActive }: QuickTagProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive ?? false}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isActive
          ? 'bg-[#4a5d23] text-white'
          : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700'
      }`}
    >
      <Icon aria-hidden="true" className="w-4 h-4" />
      {label}
    </button>
  )
}

// ============================================
// URL LINKIFIER
// ============================================
function linkifyText(text: string, keyPrefix: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s\])>,]+)/g
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let match

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<span key={`${keyPrefix}-t-${lastIdx}`}>{text.slice(lastIdx, match.index)}</span>)
    }
    const url = match[1]
    const display = url.replace(/^https?:\/\//, '').slice(0, 40)
    const truncated = url.length > 48
    parts.push(
      <a
        key={`${keyPrefix}-u-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#4a5d23] underline hover:text-[#3d4e1c] break-all"
      >
        {display}{truncated ? '...' : ''}
      </a>
    )
    lastIdx = match.index + match[0].length
  }

  if (lastIdx < text.length) {
    parts.push(<span key={`${keyPrefix}-t-${lastIdx}`}>{text.slice(lastIdx)}</span>)
  }

  return parts.length > 0 ? parts : [<span key={`${keyPrefix}-plain`}>{text}</span>]
}

// ============================================
// MESSAGE CONTENT PARSER
// ============================================
function parseMessageContent(
  content: string,
  opts?: {
    onSave?: (input: SaveResourceInput) => Promise<boolean>
    isSaved?: (name: string) => boolean
    savingNames?: Set<string>
    saveError?: string | null
    /** The viewer's language: the buttons FEED adds to a suggested resource are marked with it. */
    locale?: Locale
  }
): React.ReactNode[] {
  const locale = opts?.locale ?? 'en'
  if (!content) return []

  const parts: React.ReactNode[] = []
  const regex = /\[\[(?:(RESOURCE|WEBRESULT):)?([^\]]*\|[^\]]*)\]\]/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textSegment = content.slice(lastIndex, match.index)
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {linkifyText(textSegment, `seg-${lastIndex}`)}
        </span>
      )
    }

    const type = match[1] || 'RESOURCE'  // Default to RESOURCE if no prefix
    const data = match[2].split('|').map((s) => s.trim())

    if (type === 'RESOURCE') {
      const [name, address, phone, website, applyUrl] = data
      parts.push(
        <div
          key={`resource-${match.index}`}
          className="my-2 p-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors"
        >
          {/* Wraps: on a narrow screen or with long button words the actions move under the name,
              which stays whole (no sideways scroll). */}
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex-1 min-w-[10rem]">
              <h4 className="font-semibold text-base text-stone-900 break-words">{name}</h4>
              {address && <p className="text-sm text-stone-600 mt-0.5">{address}</p>}
              {phone && phone !== 'N/A' && phone !== 'null' && (
                <a
                  href={`tel:${phone}`}
                  className="text-xs text-[#4a5d23] hover:underline mt-0.5 block"
                >
                  {phone}
                </a>
              )}
            </div>
            <div lang={locale} dir={dir(locale)} className="flex flex-wrap gap-1">
              {applyUrl && applyUrl !== 'N/A' && applyUrl !== 'null' && applyUrl !== 'undefined' && (
                <a
                  href={applyUrl.startsWith('http') ? applyUrl : `https://${applyUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs rounded-lg bg-[#c2410c] text-white hover:bg-[#9a3412] transition-colors font-medium"
                >
                  {assistantT(locale, 'resourceApply')}
                </a>
              )}
              {website && website !== 'N/A' && website !== 'null' && (
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 text-xs rounded-lg bg-[#4a5d23] text-white hover:bg-[#3d4e1c] transition-colors"
                >
                  {assistantT(locale, 'resourceVisit')}
                </a>
              )}
              {address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 text-xs rounded-lg bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors"
                >
                  {assistantT(locale, 'resourceDirections')}
                </a>
              )}
              {opts?.onSave && (() => {
                const isSaved = opts.isSaved?.(name) ?? false
                const isSaving = opts.savingNames?.has(name) ?? false
                const isDisabled = isSaved || isSaving
                return (
                  <button
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return
                      opts.onSave!({
                        resource_name: name,
                        resource_address: address || null,
                        resource_phone: phone || null,
                        resource_website: website || applyUrl || null,
                      })
                    }}
                    className={`px-2 py-1 text-xs rounded-lg transition-colors disabled:cursor-not-allowed ${
                      isSaved
                        ? 'bg-amber-100 text-amber-700'
                        : isSaving
                        ? 'bg-stone-100 text-stone-400'
                        : 'bg-lime-100 text-lime-800 hover:bg-lime-200'
                    }`}
                  >
                    {isSaved ? (
                      <span className="flex items-center gap-1"><BookmarkCheck className="w-3 h-3" /> {assistantT(locale, 'resourceSaved')}</span>
                    ) : isSaving ? (
                      <span className="flex items-center gap-1"><Bookmark className="w-3 h-3 animate-pulse" /> {assistantT(locale, 'resourceSaving')}</span>
                    ) : (
                      <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" /> {assistantT(locale, 'resourceSave')}</span>
                    )}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )
    } else if (type === 'WEBRESULT') {
      const [title, url] = data
      parts.push(
        <a
          key={`web-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="my-1.5 p-2.5 rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-2 group block"
        >
          <div className="w-5 h-5 rounded bg-blue-200 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-3 h-3 text-blue-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-blue-900 group-hover:underline truncate block">
              {title}
            </span>
            <span className="text-xs text-blue-600 truncate block">{url}</span>
          </div>
        </a>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const trailingSegment = content.slice(lastIndex)
    parts.push(
      <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
        {linkifyText(trailingSegment, `seg-${lastIndex}`)}
      </span>
    )
  }

  if (parts.length === 0) {
    return [
      <span key="plain" className="whitespace-pre-wrap">
        {content}
      </span>,
    ]
  }

  return parts
}

// ============================================
// ELIGIBILITY SCREENING HELPERS
// ============================================

interface EligibilityProgram {
  name: string
  eligible: boolean
  estimated_monthly_amount: number
  description: string
}

// ============================================
// CHAT MESSAGE COMPONENT
// ============================================
// A quick reply is sent as the member's own message, in the words the member reads on it.
const QUICK_REPLIES: readonly AssistantKey[] = ['replyFindMore', 'replyDirections', 'replyEligibility', 'replyTalk']

interface ChatMessageViewProps {
  message: ChatMessage
  onQuickReply?: (text: string) => void
  onSaveResource?: (input: SaveResourceInput) => Promise<boolean>
  isResourceSaved?: (name: string) => boolean
  locale: Locale
}

function ChatMessageView({ message, onQuickReply, onSaveResource, isResourceSaved, locale }: ChatMessageViewProps) {
  const isUser = message.role === 'user'
  const [savingNames, setSavingNames] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = useCallback(async (input: SaveResourceInput): Promise<boolean> => {
    setSavingNames(prev => new Set(prev).add(input.resource_name))
    setSaveError(null)
    try {
      const ok = await onSaveResource!(input)
      const failed = formatMessage(assistantT(locale, 'saveFailed'), { name: isolate(input.resource_name) })
      if (!ok) {
        setSaveError(failed)
        setSavingNames(prev => { const next = new Set(prev); next.delete(input.resource_name); return next })
        return false
      }
      // Remove from saving set — isSaved will become true via hook re-render
      setSavingNames(prev => { const next = new Set(prev); next.delete(input.resource_name); return next })
      return true
    } catch {
      setSaveError(formatMessage(assistantT(locale, 'saveFailed'), { name: isolate(input.resource_name) }))
      setSavingNames(prev => { const next = new Set(prev); next.delete(input.resource_name); return next })
      return false
    }
  }, [onSaveResource, locale])

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {/* While a reply streams the WHOLE bubble is inert — its words, time, model line and buttons can
          neither be read aloud nor take focus. On completion the list re-keys it (one announcement
          of the whole reply), and since nothing inside could hold focus, none is dropped. */}
      <div
        inert={message.isStreaming || undefined}
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-brand text-white rounded-ee-md'
            : 'bg-muted rounded-es-md'
        }`}
      >
        {/* The member's or the assistant's own words: their own direction, no page language. */}
        <div lang="" dir="auto" className="text-base">
          {message.content
            ? parseMessageContent(message.content, {
                onSave: onSaveResource ? handleSave : undefined,
                isSaved: isResourceSaved,
                savingNames,
                saveError,
                locale,
              })
            : message.isStreaming
            ? null
            : null}
          {saveError && (
            <p role="alert" lang={locale} dir={dir(locale)} className="text-xs text-red-600 mt-1">{saveError}</p>
          )}
        </div>
        {message.isStreaming && !message.content && (
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:100ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:200ms]" />
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          {message.timestamp && (
            <p className={`text-[10px] ${isUser ? 'text-white/80' : 'text-stone-600'}`}>
              {formatClock(message.timestamp.toISOString(), locale, browserTimeZone())}
            </p>
          )}
          {message.model && !isUser && (
            <p className="text-[10px] text-stone-600">
              {formatMessage(assistantT(locale, 'viaModel'), { model: isolate(message.model.split('/').pop() ?? '') })}
            </p>
          )}
        </div>
        {message.role === 'assistant' && !message.isStreaming && onQuickReply && (
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_REPLIES.map((key) => (
              <button
                key={key}
                onClick={() => onQuickReply(assistantT(locale, key))}
                className="px-3 py-1.5 text-sm rounded-full border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 hover:border-[#4a5d23] hover:text-[#4a5d23] transition-colors"
              >
                {assistantT(locale, key)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// CHAT ERROR BANNER — translated, actionable
// ============================================

interface ChatErrorBannerProps {
  kind: ChatErrorKind | null
  onRetry: () => void
  isRetrying: boolean
}

export function ChatErrorBanner({ kind, onRetry, isRetrying }: ChatErrorBannerProps) {
  // The viewer's locale, the one every surface reads.
  const locale = useProfileLocale()
  if (!kind) return null

  const messageKey = kind === 'network'
    ? 'chatErrorOffline'
    : kind === 'server'
    ? 'chatErrorTimeout'
    : 'chatErrorGeneric'

  const message = t(locale, messageKey)

  // Emit optimization log
  try {
    logger.info('error_surface.shown', { surface: 'chat-error', kind, locale })
  } catch {
    // guard
  }

  return (
    <div
      role="alert"
      lang={locale}
      dir={dir(locale)}
      data-testid="chat-error-banner"
      className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        data-testid="chat-retry-btn"
        className="flex-shrink-0 px-3 py-1 rounded-md bg-red-700 text-white text-xs font-medium hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isRetrying ? assistantT(locale, 'retrying') : t(locale, 'tryAgain')}
      </button>
    </div>
  )
}

// ============================================
// UNKNOWN STATE — the eligibility check did not run
// ============================================
/** Shown when Check Eligibility ends on a state FEED cannot read: nothing was screened or sent. */
function UnknownStateNotice({ state, locale }: { state: string; locale: Locale }) {
  const [before, after] = splitMessage(assistantT(locale, 'stateNotRecognised'), 'state')
  return (
    <p role="alert" data-testid="unknown-state-notice" className="w-full p-3 rounded-md border border-amber-300 bg-amber-50 text-sm text-amber-900">
      {before}
      <bdi lang="" dir="auto">{state}</bdi>
      {after}
    </p>
  )
}

// ============================================
// SIGN IN PROMPT
// ============================================
function SignInPrompt({ locale }: { locale: Locale }) {
  // The link stays an element in JSX; only the words around it come from the dictionary.
  const [before, after] = splitMessage(assistantT(locale, 'signInPrompt'), 'link')
  return (
    <div className="flex items-center justify-center p-4 bg-amber-50 rounded-lg border border-amber-200">
      <p className="text-sm text-amber-700">
        {before}<Link href="/login" className="font-medium underline">{assistantT(locale, 'signInLink')}</Link>{after}
      </p>
    </div>
  )
}

// ============================================
// MAIN CHAT PANEL
// ============================================
interface ChatPanelProps {
  onNavigateToMap?: () => void
}

export function ChatPanel({ onNavigateToMap }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated } = useAuth()
  const { saveResource, isResourceSavedByName } = useSavedResources()
  const { panelParams, setPanelParams, setActivePanel } = usePanelContext()
  const supabaseRef = useRef(createClient())
  // The viewer's language, the one every surface reads (cookie, profile and device agree).
  const locale = useProfileLocale()

  const {
    messages,
    isLoading,
    isRetrying,
    error,
    errorKind,
    sendMessage,
    retrySend,
    stopStreaming,
  } = useChat({
    flow: (panelParams?.flow as SystemPromptKey) || 'general',
  })

  // Guided flow state
  const [selectedFlow, setSelectedFlow] = useState<GuidedFlow | null>(null)
  const wizardSentRef = useRef(false)
  // Guard flag for errorContext — prevents double-send on re-render
  const errorExplainSentRef = useRef(false)

  const handleFlowSelect = (flow: GuidedFlow) => {
    setUnknownState(null)
    setSelectedFlow(flow)
  }
  // The state the member typed when it was not one FEED can read (the notice under the cards).
  const [unknownState, setUnknownState] = useState<string | null>(null)

  // When a flow completes, focus goes to the message box (or, when it is disabled for a guest, to
  // the card that opened the flow) — never left on the page body.
  const composerRef = useRef<HTMLInputElement>(null)
  const focusAfterFlowRef = useRef(false)
  const refocusComposerRef = useRef(false)

  const handleFlowComplete = useCallback(async (answers: Record<string, string>, aiResponse: string) => {
    focusAfterFlowRef.current = true
    setSelectedFlow(null)
    setUnknownState(null)

    // Eligibility-checker flow: invoke the benefits-screening edge function
    if (answers['household-size'] !== undefined && answers['state'] !== undefined) {
      const built = buildScreeningRequest(answers)
      // Not a state FEED can read: nothing is screened and nothing is sent; the member is told, in
      // their language, to enter the 2-letter code (never a guessed state in its place).
      if (!built.ok) {
        setUnknownState(answers['state'].trim())
        return
      }
      const reqBody = built.request

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30_000)

      try {
        const { data, error: fnError } = await supabaseRef.current.functions.invoke(
          'benefits-screening',
          { body: reqBody }
        )
        clearTimeout(timeoutId)

        if (fnError) throw new Error(fnError.message)

        const programs: EligibilityProgram[] = data?.programs ?? []

        // Inject eligibility results as a synthetic assistant message via sendMessage
        // We render results as JSX via a special marker in the message.
        // Instead: inject a pre-built results message directly by sending a formatted text.
        const eligible = programs.filter((p) => p.eligible)
        const lines: string[] = []

        if (eligible.length > 0) {
          lines.push(`Based on your household information, you may qualify for ${eligible.length} program${eligible.length > 1 ? 's' : ''}:\n`)
          for (const p of eligible) {
            const amt = p.estimated_monthly_amount > 0 ? ` (~$${Math.round(p.estimated_monthly_amount)}/mo)` : ''
            lines.push(`**${p.name}**${amt}\n${p.description}`)
          }
          const ineligibleNames = programs.filter((p) => !p.eligible).map((p) => p.name)
          if (ineligibleNames.length > 0) {
            lines.push(`\n_${ineligibleNames.join(', ')} did not meet estimated thresholds._`)
          }
        } else {
          lines.push('Based on the information you shared, we were unable to identify programs you currently qualify for. Eligibility rules vary — apply directly to get an official determination.')
        }

        lines.push('\n_This is a general estimate only. Actual eligibility is determined by your state agency._')
        lines.push('\nOpen the **Programs panel** to search and apply for programs near you.')

        await sendMessage(lines.join('\n'))
        return
      } catch {
        clearTimeout(timeoutId)
        // Screening timed out (Next.js fetch abort) or the service errored.
        // Either way the recovery message uses ONLY the de-identified state
        // abbreviation from the screening request — never the raw
        // household/income/pregnancy answers. The raw aiResponse path below is
        // intentionally bypassed for this flow (skipDirectSend ⇒ aiResponse is
        // empty), so no PII can reach the LLM.
        const { state } = reqBody
        await sendMessage(
          `I'm checking benefits in ${state}, but the eligibility screening service is temporarily unavailable. ` +
          `Please suggest common assistance programs in ${state} (SNAP, Medicaid, WIC, TANF, LIHEAP) and how to apply, ` +
          `and recommend opening the Programs panel to search and apply.`
        )
        return
      }
    }

    // Default: send the AI-generated response from a NON-sensitive guided flow
    // (resource-finder / form-help). PII-sensitive flows are skipDirectSend and
    // pass an empty aiResponse, so this never forwards raw answers to the LLM.
    if (aiResponse) {
      await sendMessage(aiResponse)
    }
  }, [sendMessage, setActivePanel])  // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel returns focus to the card that opened the flow (it is mounted again with the greeting).
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const launcherRef = useRef<string | null>(null)
  const returnFocusRef = useRef<string | null>(null)
  const handleFlowCancel = () => {
    returnFocusRef.current = launcherRef.current
    setSelectedFlow(null)
  }
  useEffect(() => {
    if (selectedFlow) return
    if (returnFocusRef.current) {
      cardRefs.current[returnFocusRef.current]?.focus()
      returnFocusRef.current = null
    } else if (focusAfterFlowRef.current) {
      focusAfterFlowRef.current = false
      const composer = composerRef.current
      if (composer && !composer.disabled) {
        composer.focus()
        // The reply the flow sends switches the greeting to the conversation, which mounts the
        // other message box: focus follows to it (below) instead of dropping to the body.
        refocusComposerRef.current = true
      } else if (launcherRef.current) cardRefs.current[launcherRef.current]?.focus()
    }
  }, [selectedFlow])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages])

  // Auto-send wizard context when arriving from a category wizard
  useEffect(() => {
    const rawContext = panelParams?.wizardContext
    if (typeof rawContext !== 'string' || !rawContext) return
    if (isLoading) return
    if (wizardSentRef.current) return

    const parsed = parseWizardContext(rawContext)
    if (!parsed) return

    wizardSentRef.current = true

    // The message is built from the category id and the option values only (never the labels the
    // member read), so it is the same in every language.
    const prompt = buildWizardPrompt(parsed.category, parsed.answers)

    setPanelParams({ ...panelParams, wizardContext: undefined })
    sendMessage(prompt).finally(() => {
      wizardSentRef.current = false
    })
    // The wizard has closed (its panel unmounted), so focus is on <body>: it goes to the message box
    // when that box is enabled, and in every case to the conversation's box once the sent message
    // replaces the greeting (the effect on showGreeting below) — also for a visitor with no session,
    // whose greeting box is disabled but whose conversation box is not.
    const composer = composerRef.current
    if (composer && !composer.disabled) composer.focus()
    refocusComposerRef.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelParams?.wizardContext, isLoading])

  // Auto-send error explain-request when arriving from a non-chat error surface.
  // Mirrors the wizardContext handler exactly: guard ref prevents double-send.
  useEffect(() => {
    const rawCtx = panelParams?.errorContext
    if (!rawCtx || typeof rawCtx !== 'object') return
    if (isLoading) return
    if (errorExplainSentRef.current) return

    const ctx = rawCtx as SafeErrorContext
    // Validate that safeSummary is present (type guard) and non-empty.
    if (typeof ctx.safeSummary !== 'string' || !ctx.safeSummary) return

    errorExplainSentRef.current = true
    // Clear the errorContext from panelParams so it doesn't re-fire.
    setPanelParams({ ...panelParams, errorContext: undefined })
    // Build the explain-request from the SAFE summary — never from raw error.
    const prompt = buildExplainRequest(ctx)
    sendMessage(prompt).finally(() => {
      errorExplainSentRef.current = false
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelParams?.errorContext, isLoading])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return
    const message = inputValue
    setInputValue('')
    await sendMessage(message)
  }

  const handleTagClick = (tag: { id: string; key: AssistantKey }) => {
    setActiveTag(tag.id)
    setInputValue(assistantT(locale, tag.key))
  }

  const handleFeatureClick = (feature: string) => {
    launcherRef.current = feature
    if (feature === 'resources' && onNavigateToMap) {
      onNavigateToMap()
    } else if (feature === 'resources') {
      handleFlowSelect(resourceFinderFlow)
    } else if (feature === 'eligibility') {
      handleFlowSelect(eligibilityCheckerFlow)
    } else if (feature === 'forms') {
      handleFlowSelect(formHelpFlow)
    } else if (isAuthenticated) {
      sendMessage(`Help me with ${feature}`)
    } else {
      setInputValue(`Help me with ${feature}`)
    }
  }

  // Show greeting or chat thread
  const showGreeting = messages.length === 0

  // After a flow, the greeting's message box held focus; when the conversation replaces it, focus
  // moves to the conversation's message box (only if it would otherwise be lost). It acts on a
  // CHANGE of view only: on mount (arriving from the wizard, whose effect above has just asked for
  // the refocus) the greeting is still showing, and the request waits for the conversation.
  const shownGreetingRef = useRef(showGreeting)
  useEffect(() => {
    if (shownGreetingRef.current === showGreeting) return
    shownGreetingRef.current = showGreeting
    if (!refocusComposerRef.current) return
    refocusComposerRef.current = false
    const active = typeof document === 'undefined' ? null : document.activeElement
    if (active === null || active === document.body) composerRef.current?.focus()
  }, [showGreeting])

  // Render guided flow if one is selected
  if (selectedFlow) {
    return (
      <div lang={locale} dir={dir(locale)} className="h-full flex flex-col">
        <GuidedFlowComponent
          flow={selectedFlow}
          onComplete={handleFlowComplete}
          onCancel={handleFlowCancel}
        />
      </div>
    )
  }

  const sendLabel = assistantT(locale, 'sendMessage')
  const streaming = messages.some((m) => m.isStreaming)
  const quickTag = (tag: (typeof QUICK_TAGS)[number]) => (
    <QuickTag
      key={tag.id}
      label={assistantT(locale, tag.key)}
      icon={tag.icon}
      isActive={activeTag === tag.id}
      onClick={() => handleTagClick(tag)}
    />
  )

  return (
    <div lang={locale} dir={dir(locale)} className="h-full flex flex-col">
      {showGreeting ? (
        // ============================================
        // GREETING VIEW (Initial State)
        // ============================================
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
          {/* Greeting Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {assistantT(locale, 'greetingTitle')}
            </h1>
            <p className="text-lg text-stone-500">
              {assistantT(locale, 'greetingSubtitle')}
            </p>
          </div>

          {/* Guided Flow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
            <FlowCard
              icon={Sparkles}
              iconBg="bg-yellow-100 text-yellow-600"
              title={assistantT(locale, 'cardResourcesTitle')}
              description={assistantT(locale, 'cardResourcesBody')}
              onClick={() => handleFeatureClick('resources')}
              buttonRef={(el) => { cardRefs.current['resources'] = el }}
            />
            <FlowCard
              icon={CheckCircle}
              iconBg="bg-blue-100 text-blue-600"
              title={assistantT(locale, 'cardEligibilityTitle')}
              description={assistantT(locale, 'cardEligibilityBody')}
              onClick={() => handleFeatureClick('eligibility')}
              buttonRef={(el) => { cardRefs.current['eligibility'] = el }}
            />
            <FlowCard
              icon={FileText}
              iconBg="bg-green-100 text-green-600"
              title={assistantT(locale, 'cardFormsTitle')}
              description={assistantT(locale, 'cardFormsBody')}
              onClick={() => handleFeatureClick('forms')}
              buttonRef={(el) => { cardRefs.current['forms'] = el }}
            />
          </div>

          {unknownState !== null && <UnknownStateNotice state={unknownState} locale={locale} />}

          {!isAuthenticated && <SignInPrompt locale={locale} />}

          {/* Chat Input */}
          <div className="w-full space-y-3 mt-4">
            {isRetrying && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
                {assistantT(locale, 'reconnecting')}
              </div>
            )}
            {error && !isRetrying && (
              <ChatErrorBanner kind={errorKind} onRetry={retrySend} isRetrying={isRetrying} />
            )}
            <div className="relative">
              <Input
                ref={composerRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                placeholder={assistantT(locale, isAuthenticated ? 'inputPlaceholder' : 'inputPlaceholderGuest')}
                aria-label={assistantT(locale, isAuthenticated ? 'inputPlaceholder' : 'inputPlaceholderGuest')}
                dir="auto"
                className="pe-12 py-6 rounded-xl bg-[#f8f6f1] border-stone-200 placeholder:text-stone-600"
                disabled={!isAuthenticated}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading || !isAuthenticated}
                size="icon"
                aria-label={sendLabel}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg"
              >
                <Send aria-hidden="true" className="w-4 h-4 rtl:-scale-x-100" />
              </Button>
            </div>

            {/* Quick Tags */}
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_TAGS.map(quickTag)}
            </div>
          </div>
        </div>
      ) : (
        // ============================================
        // CONVERSATION VIEW (After first message)
        // ============================================
        <>
          {/* Chat Messages */}
          {/* A log: a new message is announced politely. A streaming reply is announced once, when it
              completes — its bubble is hidden from assistive technology while streaming (aria-busy
              on the log as well) and is re-keyed on completion, so the finished reply is one
              addition. Word-by-word announcements of a streamed reply are unusable with a screen
              reader; one complete reply is what a sighted reader acts on too. */}
          <div
            ref={messagesContainerRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={streaming}
            aria-label={assistantT(locale, 'conversation')}
            className="flex-1 overflow-y-auto py-4"
          >
            {/* A reply that ended empty (the request failed) is not shown: it has no words, and the
                error banner below says what happened — so no empty bubble or quick replies are
                announced beside it. A retry streams into the same message again. */}
            {messages.filter((m) => m.role !== 'assistant' || m.isStreaming || m.content).map((msg) => (
              <ChatMessageView
                key={`${msg.id}${msg.isStreaming ? ':streaming' : ''}`}
                message={msg}
                onQuickReply={sendMessage}
                onSaveResource={saveResource}
                isResourceSaved={isResourceSavedByName}
                locale={locale}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {unknownState !== null && (
            <div className="px-4 pb-2">
              <UnknownStateNotice state={unknownState} locale={locale} />
            </div>
          )}

          {/* Reconnecting indicator */}
          {isRetrying && (
            <div className="px-4 pb-1">
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
                {assistantT(locale, 'reconnecting')}
              </div>
            </div>
          )}

          {/* Error display — translated message + Try again */}
          {error && !isRetrying && (
            <div className="px-4 pb-2">
              <ChatErrorBanner kind={errorKind} onRetry={retrySend} isRetrying={isRetrying} />
            </div>
          )}

          {/* Chat Input (Sticky at bottom) */}
          <div className="border-t pt-4 space-y-3">
            <div className="relative">
              <Input
                ref={composerRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                placeholder={assistantT(locale, 'replyPlaceholder')}
                aria-label={assistantT(locale, 'replyPlaceholder')}
                dir="auto"
                className="pe-12 py-4 rounded-xl placeholder:text-stone-600"
              />
              {isLoading ? (
                <Button
                  onClick={stopStreaming}
                  size="icon"
                  variant="outline"
                  aria-label={assistantT(locale, 'stopResponse')}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg"
                >
                  <Square aria-hidden="true" className="w-3 h-3" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  size="icon"
                  aria-label={sendLabel}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg"
                >
                  <Send aria-hidden="true" className="w-4 h-4 rtl:-scale-x-100" />
                </Button>
              )}
            </div>

            {/* Quick Tags */}
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.slice(0, 4).map(quickTag)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
