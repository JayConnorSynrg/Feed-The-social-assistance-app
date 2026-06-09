'use client'

// apps/web/src/components/panels/chat-panel.tsx
// AI Chat interface panel - wired to real Supabase edge function via useChat hook

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Send, Sparkles, Search, Apple, Building2, Heart, FileText, Square, CheckCircle, Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChat, type ChatMessage } from '@/hooks/use-chat'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { GuidedFlowComponent } from '@/components/chat/guided-flow'
import { resourceFinderFlow, eligibilityCheckerFlow, formHelpFlow } from '@/lib/ai/guided-flows'
import type { GuidedFlow } from '@/lib/ai/guided-flows'
import { useSavedResources, type SaveResourceInput } from '@/hooks/use-saved-resources'
import { usePanelContext } from '@/components/layout/feed-shell'
import type { SystemPromptKey } from '@/lib/ai/system-prompts'

// ============================================
// FLOW SELECTION CARD
// ============================================
interface FlowCardProps {
  icon: React.ElementType
  iconBg: string
  title: string
  description: string
  onClick?: () => void
}

function FlowCard({ icon: Icon, iconBg, title, description, onClick }: FlowCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-xl border border-stone-200 bg-[#faf9f6] hover:border-primary/50 hover:bg-[#f5f3ee] transition-all text-left group shadow-sm"
    >
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-xs text-stone-500 leading-relaxed">
        {description}
      </p>
    </button>
  )
}

// ============================================
// QUICK ACTION TAGS
// ============================================
const QUICK_TAGS = [
  { label: 'Find resources', icon: Search },
  { label: 'Program Eligibility', icon: FileText },
  { label: 'Food', icon: Apple },
  { label: 'Social Services', icon: Building2 },
  { label: 'Healthcare', icon: Heart },
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isActive
          ? 'bg-[#4a5d23] text-white'
          : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700'
      }`}
    >
      <Icon className="w-3 h-3" />
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
  }
): React.ReactNode[] {
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
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-base text-stone-900 truncate">{name}</h4>
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
            <div className="flex gap-1 flex-shrink-0">
              {applyUrl && applyUrl !== 'N/A' && applyUrl !== 'null' && applyUrl !== 'undefined' && (
                <a
                  href={applyUrl.startsWith('http') ? applyUrl : `https://${applyUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs rounded-lg bg-[#c2410c] text-white hover:bg-[#9a3412] transition-colors font-medium"
                >
                  Apply
                </a>
              )}
              {website && website !== 'N/A' && website !== 'null' && (
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 text-xs rounded-lg bg-[#4a5d23] text-white hover:bg-[#3d4e1c] transition-colors"
                >
                  Visit
                </a>
              )}
              {address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 text-xs rounded-lg bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors"
                >
                  Directions
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
                      <span className="flex items-center gap-1"><BookmarkCheck className="w-3 h-3" /> Saved</span>
                    ) : isSaving ? (
                      <span className="flex items-center gap-1"><Bookmark className="w-3 h-3 animate-pulse" /> Saving…</span>
                    ) : (
                      <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" /> Save</span>
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

/** Map guided-flow answers to the benefits-screening edge function request shape. */
function buildScreeningRequest(answers: Record<string, string>) {
  // household-size: '1' | '2' | '3' | '4' | '5' | '6+'
  const householdSize = answers['household-size'] === '6+' ? 6 : parseInt(answers['household-size'] ?? '1', 10)

  // income: bucket string → midpoint annual income
  const incomeMap: Record<string, number> = {
    '0': 0,
    'under-1000': 6000,
    '1000-2000': 18000,
    '2000-3000': 30000,
    '3000-4000': 42000,
    '4000-5000': 54000,
    'over-5000': 72000,
  }
  const annualIncome = incomeMap[answers['income'] ?? '0'] ?? 0

  // state: text field — normalize to 2-letter abbreviation
  const stateRaw = (answers['state'] ?? '').trim().toUpperCase()
  // If already 2 chars, use as-is; otherwise try to match name → abbr via common map
  const STATE_ABBR: Record<string, string> = {
    VERMONT: 'VT', 'NEW YORK': 'NY', CALIFORNIA: 'CA', TEXAS: 'TX',
    FLORIDA: 'FL', ILLINOIS: 'IL', PENNSYLVANIA: 'PA', OHIO: 'OH',
    GEORGIA: 'GA', 'NORTH CAROLINA': 'NC', MICHIGAN: 'MI', 'NEW JERSEY': 'NJ',
    VIRGINIA: 'VA', WASHINGTON: 'WA', ARIZONA: 'AZ', MASSACHUSETTS: 'MA',
    TENNESSEE: 'TN', INDIANA: 'IN', MISSOURI: 'MO', MARYLAND: 'MD',
    WISCONSIN: 'WI', COLORADO: 'CO', MINNESOTA: 'MN', 'SOUTH CAROLINA': 'SC',
    ALABAMA: 'AL', LOUISIANA: 'LA', KENTUCKY: 'KY', OREGON: 'OR',
    OKLAHOMA: 'OK', CONNECTICUT: 'CT', UTAH: 'UT', NEVADA: 'NV',
    IOWA: 'IA', ARKANSAS: 'AR', MISSISSIPPI: 'MS', KANSAS: 'KS',
    'NEW MEXICO': 'NM', NEBRASKA: 'NE', 'WEST VIRGINIA': 'WV', IDAHO: 'ID',
    HAWAII: 'HI', 'NEW HAMPSHIRE': 'NH', MAINE: 'ME', MONTANA: 'MT',
    'RHODE ISLAND': 'RI', DELAWARE: 'DE', 'SOUTH DAKOTA': 'SD',
    'NORTH DAKOTA': 'ND', ALASKA: 'AK', 'DISTRICT OF COLUMBIA': 'DC',
    DC: 'DC', WYOMING: 'WY',
  }
  const state = stateRaw.length === 2 ? stateRaw : (STATE_ABBR[stateRaw] ?? 'VT')

  const hasChildren = answers['children'] === 'yes'
  const isDisabled = (answers['employment'] ?? '') === 'disability'

  // Default age to 35 — the flow doesn't collect age directly
  return {
    household_size: isNaN(householdSize) || householdSize < 1 ? 1 : householdSize,
    annual_income: annualIncome,
    state,
    age: 35,
    has_children: hasChildren,
    is_disabled: isDisabled,
  }
}


function postProcessResourceMarkers(
  content: string,
  injectedResources?: string[]
): string {
  if (!injectedResources || injectedResources.length === 0) return content
  if (content.includes('[[RESOURCE:') || content.includes('[[WEBRESULT:')) return content
  return content
}

// ============================================
// CHAT MESSAGE COMPONENT
// ============================================
const QUICK_REPLIES = ['Find more resources', 'Get directions', 'Check my eligibility', 'Talk to someone']

interface ChatMessageViewProps {
  message: ChatMessage
  onQuickReply?: (text: string) => void
  onSaveResource?: (input: SaveResourceInput) => Promise<boolean>
  isResourceSaved?: (name: string) => boolean
}

function ChatMessageView({ message, onQuickReply, onSaveResource, isResourceSaved }: ChatMessageViewProps) {
  const isUser = message.role === 'user'
  const [savingNames, setSavingNames] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = useCallback(async (input: SaveResourceInput): Promise<boolean> => {
    setSavingNames(prev => new Set(prev).add(input.resource_name))
    setSaveError(null)
    try {
      const ok = await onSaveResource!(input)
      if (!ok) {
        setSaveError(`Could not save "${input.resource_name}". Please try again.`)
        setSavingNames(prev => { const next = new Set(prev); next.delete(input.resource_name); return next })
        return false
      }
      // Remove from saving set — isSaved will become true via hook re-render
      setSavingNames(prev => { const next = new Set(prev); next.delete(input.resource_name); return next })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setSaveError(msg)
      setSavingNames(prev => { const next = new Set(prev); next.delete(input.resource_name); return next })
      return false
    }
  }, [onSaveResource])

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted rounded-bl-md'
        }`}
      >
        <div className="text-base">
          {message.content
            ? parseMessageContent(message.content, {
                onSave: onSaveResource ? handleSave : undefined,
                isSaved: isResourceSaved,
                savingNames,
                saveError,
              })
            : message.isStreaming
            ? null
            : null}
          {saveError && (
            <p className="text-xs text-red-600 mt-1">{saveError}</p>
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
            <p className={`text-[10px] ${isUser ? 'text-primary-foreground/70' : 'text-stone-500'}`}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {message.model && !isUser && (
            <p className="text-[10px] text-stone-500">
              via {message.model.split('/').pop()}
            </p>
          )}
        </div>
        {message.role === 'assistant' && !message.isStreaming && onQuickReply && (
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_REPLIES.map((option) => (
              <button
                key={option}
                onClick={() => onQuickReply(option)}
                className="px-3 py-1.5 text-sm rounded-full border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 hover:border-[#4a5d23] hover:text-[#4a5d23] transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// SIGN IN PROMPT
// ============================================
function SignInPrompt() {
  return (
    <div className="flex items-center justify-center p-4 bg-amber-50 rounded-lg border border-amber-200">
      <p className="text-sm text-amber-700">
        Please <Link href="/login" className="font-medium underline">sign in</Link> to chat with FEED Assistant.
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

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stopStreaming,
  } = useChat({
    flow: (panelParams?.flow as SystemPromptKey) || 'general',
    onError: (err) => console.error('Chat error:', err),
  })

  // Guided flow state
  const [selectedFlow, setSelectedFlow] = useState<GuidedFlow | null>(null)
  const wizardSentRef = useRef(false)

  const handleFlowSelect = (flow: GuidedFlow) => setSelectedFlow(flow)

  const handleFlowComplete = useCallback(async (answers: Record<string, string>, aiResponse: string) => {
    setSelectedFlow(null)

    // Eligibility-checker flow: invoke the benefits-screening edge function
    if (answers['household-size'] !== undefined && answers['state'] !== undefined) {
      const reqBody = buildScreeningRequest(answers)

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
      } catch (err: unknown) {
        clearTimeout(timeoutId)
        // Handle Next.js fetch abort as success-like (operation may have completed server-side)
        if (
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && (err.message.includes('signal') || err.message.includes('aborted')))
        ) {
          // Timed out — fall through to AI response
        } else {
          // Service unavailable — show friendly message then fall through to AI response
          await sendMessage(
            'The eligibility screening service is temporarily unavailable. Based on your answers, I recommend checking the Programs panel to find benefits in your area.'
          )
          return
        }
      }
    }

    // Default: send the AI-generated response from the guided flow
    if (aiResponse) {
      await sendMessage(aiResponse)
    }
  }, [sendMessage, setActivePanel])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleFlowCancel = () => setSelectedFlow(null)

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

    let parsed: { category?: string; answers?: Record<string, string | string[]> } = {}
    try {
      parsed = JSON.parse(rawContext)
    } catch {
      return
    }

    const { category, answers } = parsed
    if (!category || !answers) return

    wizardSentRef.current = true

    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1)
    const lines: string[] = [`I need help with ${categoryLabel} resources. Here's my situation:`]

    const labelMap: Record<string, string> = {
      'assistance-type': 'Looking for',
      'household-size': 'Household size',
      'situation': 'Current situation',
      'experience': 'Work experience',
      'frequency': 'Transportation frequency needed',
      'urgency': 'Urgency',
      'insurance': 'Insurance status',
      'state': 'State',
      'contact': 'Preferred contact method',
    }

    for (const [key, value] of Object.entries(answers)) {
      const label = labelMap[key] ?? key
      const display = Array.isArray(value) ? value.join(', ') : value
      lines.push(`- ${label}: ${display}`)
    }

    const prompt = lines.join('\n')

    setPanelParams({ ...panelParams, wizardContext: undefined })
    sendMessage(prompt).finally(() => {
      wizardSentRef.current = false
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelParams?.wizardContext, isLoading])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return
    const message = inputValue
    setInputValue('')
    await sendMessage(message)
  }

  const handleTagClick = (tag: string) => {
    setActiveTag(tag)
    setInputValue(tag)
  }

  const handleFeatureClick = (feature: string) => {
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

  // Render guided flow if one is selected
  if (selectedFlow) {
    return (
      <div className="h-full flex flex-col">
        <GuidedFlowComponent
          flow={selectedFlow}
          onComplete={handleFlowComplete}
          onCancel={handleFlowCancel}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {showGreeting ? (
        // ============================================
        // GREETING VIEW (Initial State)
        // ============================================
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
          {/* Greeting Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Hi, This is Feed.
            </h1>
            <p className="text-lg text-stone-500">
              What can we help you gather today?
            </p>
          </div>

          {/* Guided Flow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
            <FlowCard
              icon={Sparkles}
              iconBg="bg-yellow-100 text-yellow-600"
              title="Find Resources"
              description="Discover local food banks, housing assistance, healthcare, and more near you."
              onClick={() => handleFeatureClick('resources')}
            />
            <FlowCard
              icon={CheckCircle}
              iconBg="bg-blue-100 text-blue-600"
              title="Check Eligibility"
              description="See what benefits programs you may qualify for based on your situation."
              onClick={() => handleFeatureClick('eligibility')}
            />
            <FlowCard
              icon={FileText}
              iconBg="bg-green-100 text-green-600"
              title="Get Help with Forms"
              description="Get guided help understanding and completing benefit applications."
              onClick={() => handleFeatureClick('forms')}
            />
          </div>

          {!isAuthenticated && <SignInPrompt />}

          {/* Chat Input */}
          <div className="w-full space-y-3 mt-4">
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error.message}
              </div>
            )}
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isAuthenticated ? 'Ask me anything about benefits, resources, or assistance...' : 'Sign in to start chatting...'}
                className="pr-12 py-6 rounded-xl bg-[#f8f6f1] border-stone-200"
                disabled={!isAuthenticated}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading || !isAuthenticated}
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Tags */}
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_TAGS.map((tag) => (
                <QuickTag
                  key={tag.label}
                  {...tag}
                  isActive={activeTag === tag.label}
                  onClick={() => handleTagClick(tag.label)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ============================================
        // CONVERSATION VIEW (After first message)
        // ============================================
        <>
          {/* Chat Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto py-4">
            {messages.map((msg) => (
              <ChatMessageView
                key={msg.id}
                message={msg}
                onQuickReply={sendMessage}
                onSaveResource={saveResource}
                isResourceSaved={isResourceSavedByName}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Error display */}
          {error && (
            <div className="px-4 pb-2">
              <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error.message}
              </div>
            </div>
          )}

          {/* Chat Input (Sticky at bottom) */}
          <div className="border-t pt-4 space-y-3">
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="pr-12 py-4 rounded-xl"
              />
              {isLoading ? (
                <Button
                  onClick={stopStreaming}
                  size="icon"
                  variant="outline"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
                >
                  <Square className="w-3 h-3" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Quick Tags */}
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.slice(0, 4).map((tag) => (
                <QuickTag
                  key={tag.label}
                  {...tag}
                  isActive={activeTag === tag.label}
                  onClick={() => handleTagClick(tag.label)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
