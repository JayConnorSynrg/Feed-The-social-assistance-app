'use client'

// apps/web/src/components/panels/resource-wizard.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One Get Help wizard, step by step, in the member's language. Each step:
//   - its question is the heading; focus moves to it when the wizard opens and after each answer
//     or Back, and it names the group of options, whose visible hint describes the group;
//   - its options are rendered by a StepOptions keyed by the step id, so nothing typed (the
//     filter) carries over to another step; each option answers with its VALUE, never its label;
//   - a multi-select step's Continue is aria-disabled until something is chosen; pressing it
//     then says so in the wizard's one always-mounted alert;
//   - the filter (long lists) has a visible label, and its result is spoken in the always-mounted
//     status line (announce(): one new node per announcement).
// Back on the first step and Cancel leave the wizard (the panel returns focus to the card).

import React, { useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/i18n'
import type { CategoryWizardConfig, WizardStepConfig } from '@/lib/ai/resource-wizard-config'
import { assistantT } from '@/lib/i18n-assistant'
import { filterMatches, getHelpT, wizardLabelText } from '@/lib/i18n-get-help'
import { formatMessage } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'
import { announce, AnnouncementText, clearAnnouncement, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

type Answers = Record<string, string | string[]>

interface ResourceWizardProps {
  category: CategoryWizardConfig
  locale: Locale
  onComplete: (answers: Answers) => void
  onCancel: () => void
}

const CHROME_BUTTON =
  'inline-flex min-h-6 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5d23]'

export function ResourceWizard({ category, locale, onComplete, onCancel }: ResourceWizardProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const [alert, setAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  const questionId = useId()
  const hintId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const totalSteps = category.steps.length
  const currentStep = category.steps[stepIndex]

  // Opening the wizard, each answer and Back: the member starts the step at its question.
  useEffect(() => {
    headingRef.current?.focus()
  }, [stepIndex])

  function clearRegions() {
    clearAnnouncement(setStatus)
    clearAnnouncement(setAlert)
  }

  function advance(current: Answers) {
    clearRegions()
    if (stepIndex + 1 >= totalSteps) {
      onComplete(current)
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  function handleSingleSelect(value: string) {
    const next = { ...answers, [currentStep.id]: value }
    setAnswers(next)
    advance(next)
  }

  function handleMultiToggle(value: string) {
    clearAnnouncement(setAlert)
    const existing = (answers[currentStep.id] as string[]) ?? []
    const updated = existing.includes(value) ? existing.filter((v) => v !== value) : [...existing, value]
    setAnswers((prev) => ({ ...prev, [currentStep.id]: updated }))
  }

  function handleMultiSubmit() {
    const selected = (answers[currentStep.id] as string[]) ?? []
    if (selected.length === 0) {
      announce(setAlert, getHelpT(locale, 'chooseAtLeastOne'))
      return
    }
    advance(answers)
  }

  function handleBack() {
    if (stepIndex === 0) {
      onCancel()
    } else {
      clearRegions()
      setStepIndex((i) => i - 1)
    }
  }

  return (
    <div className="max-w-lg mx-auto w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleBack} className={CHROME_BUTTON}>
          <ChevronLeft aria-hidden="true" className="w-4 h-4 rtl:-scale-x-100" />
          {assistantT(locale, 'flowBack')}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-stone-600 font-medium">
            {formatMessage(assistantT(locale, 'flowStep'), {
              current: formatCount(stepIndex + 1, locale),
              total: formatCount(totalSteps, locale),
            })}
          </p>
          <div aria-hidden="true" className="mt-1.5 h-1.5 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4a5d23] rounded-full transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>
        <button type="button" onClick={onCancel} className={CHROME_BUTTON}>
          {assistantT(locale, 'flowCancel')}
        </button>
      </div>

      {/* Question */}
      <h2 ref={headingRef} id={questionId} tabIndex={-1} className="text-lg font-semibold text-stone-800 outline-none break-words">
        {getHelpT(locale, currentStep.question)}
      </h2>

      {/* Options */}
      <StepOptions
        key={currentStep.id}
        step={currentStep}
        locale={locale}
        questionId={questionId}
        hintId={hintId}
        selected={(answers[currentStep.id] as string[] | undefined) ?? []}
        onSingleSelect={handleSingleSelect}
        onMultiToggle={handleMultiToggle}
        onMultiSubmit={handleMultiSubmit}
        onFilterResult={(text) => (text ? announce(setStatus, text) : clearAnnouncement(setStatus))}
      />

      {/* One status line and one alert, always mounted. */}
      <p role="status" className="sr-only">
        <AnnouncementText announcement={status} />
      </p>
      <p role="alert" className="text-sm font-medium text-red-700">
        <AnnouncementText announcement={alert} />
      </p>
    </div>
  )
}

interface StepOptionsProps {
  step: WizardStepConfig
  locale: Locale
  questionId: string
  hintId: string
  selected: string[]
  onSingleSelect: (value: string) => void
  onMultiToggle: (value: string) => void
  onMultiSubmit: () => void
  onFilterResult: (text: string) => void
}

interface LabelledOption {
  value: string
  text: string
  lang?: 'en'
}

/** The options a filter query leaves: matched on the words the member reads, or on the English value. */
export function filterOptions(options: LabelledOption[], query: string): LabelledOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter((o) => o.text.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
}

/** How long typing must pause before the filter's result is spoken. */
export const FILTER_ANNOUNCE_DELAY_MS = 500

function OptionText({ option }: { option: LabelledOption }) {
  // A US program name written the same in every language is marked English.
  return option.lang ? <span lang={option.lang}>{option.text}</span> : <>{option.text}</>
}

const OPTION_BUTTON =
  'w-full min-h-6 text-start px-4 py-3 rounded-xl border transition-all text-sm font-medium break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5d23]'

export function StepOptions({
  step,
  locale,
  questionId,
  hintId,
  selected,
  onSingleSelect,
  onMultiToggle,
  onMultiSubmit,
  onFilterResult,
}: StepOptionsProps) {
  const filterId = useId()
  const [filterQuery, setFilterQuery] = useState('')
  const labelled: LabelledOption[] = step.options.map((o) => ({
    value: o.value,
    text: wizardLabelText(o.label, locale),
    lang: o.label.kind === 'assistant' ? o.label.lang : undefined,
  }))
  const isManyOptions = labelled.length > 10
  const visible = isManyOptions ? filterOptions(labelled, filterQuery) : labelled

  // The result is spoken once, when typing pauses, and counted then from the latest query and
  // options — never a count left over from an earlier keystroke.
  const latest = useRef({ query: '', labelled, locale, onFilterResult })
  useEffect(() => {
    latest.current = { query: filterQuery, labelled, locale, onFilterResult }
  })
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (announceTimer.current) clearTimeout(announceTimer.current)
  }, [])

  function handleFilter(value: string) {
    setFilterQuery(value)
    latest.current = { ...latest.current, query: value }
    if (announceTimer.current) clearTimeout(announceTimer.current)
    announceTimer.current = null
    if (!value.trim()) return onFilterResult('')
    announceTimer.current = setTimeout(() => {
      announceTimer.current = null
      const now = latest.current
      if (!now.query.trim()) return
      const n = filterOptions(now.labelled, now.query).length
      now.onFilterResult(n === 0 ? getHelpT(now.locale, 'filterNone') : filterMatches(n, now.locale))
    }, FILTER_ANNOUNCE_DELAY_MS)
  }

  if (step.type === 'single-select') {
    return (
      <div className="flex flex-col gap-2">
        <p id={hintId} className="text-sm text-stone-600">
          {getHelpT(locale, 'hintChooseOne')}
        </p>
        {isManyOptions && (
          <div className="flex flex-col gap-1 mb-1">
            <label htmlFor={filterId} className="text-sm font-medium text-stone-700">
              {getHelpT(locale, 'filterLabel')}
            </label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
              <Input
                id={filterId}
                value={filterQuery}
                onChange={(e) => handleFilter(e.target.value)}
                dir="auto"
                autoComplete="off"
                className="ps-9 py-2 rounded-xl bg-[#faf9f6] border-stone-500 text-stone-900"
              />
            </div>
          </div>
        )}
        {visible.length === 0 ? (
          <p className="text-sm text-stone-700">{getHelpT(locale, 'filterNone')}</p>
        ) : null}
        <div
          role="group"
          aria-labelledby={questionId}
          aria-describedby={hintId}
          className={isManyOptions ? 'max-h-72 overflow-y-auto flex flex-col gap-2 pe-1' : 'flex flex-col gap-2'}
        >
          {visible.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => onSingleSelect(opt.value)}
              className={cn(OPTION_BUTTON, 'border-stone-500 bg-[#faf9f6] hover:border-[#4a5d23] hover:bg-[#f5f3ee] text-stone-800')}
            >
              <OptionText option={opt} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  const nothingChosen = selected.length === 0
  return (
    <div className="flex flex-col gap-3">
      <p id={hintId} className="text-sm text-stone-600">
        {getHelpT(locale, 'hintChooseAll')}
      </p>
      <div role="group" aria-labelledby={questionId} aria-describedby={hintId} className="flex flex-col gap-2">
        {labelled.map((opt) => {
          const isChecked = selected.includes(opt.value)
          return (
            <button
              type="button"
              key={opt.value}
              aria-pressed={isChecked}
              onClick={() => onMultiToggle(opt.value)}
              className={cn(
                OPTION_BUTTON,
                'flex items-center gap-3',
                isChecked ? 'border-[#4a5d23] bg-[#4a5d23]/5 text-[#3d4e1c]' : 'border-stone-500 bg-[#faf9f6] hover:border-[#4a5d23] text-stone-800',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors',
                  isChecked ? 'border-[#4a5d23] bg-[#4a5d23]' : 'border-stone-500 bg-white',
                )}
              >
                {isChecked && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <OptionText option={opt} />
              </span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        aria-disabled={nothingChosen}
        onClick={onMultiSubmit}
        className={cn(
          'w-full min-h-6 rounded-xl py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5d23] focus-visible:ring-offset-2',
          nothingChosen ? 'bg-stone-200 text-stone-700' : 'bg-[#4a5d23] hover:bg-[#3d4e1c] text-white',
        )}
      >
        {assistantT(locale, 'flowContinue')}
      </button>
    </div>
  )
}
