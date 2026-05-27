'use client'

// apps/web/src/components/panels/resource-wizard.tsx
// Step-by-step wizard for a given resource category

import React, { useState, useMemo } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CategoryWizardConfig, WizardStepConfig } from '@/lib/ai/resource-wizard-config'

interface ResourceWizardProps {
  category: CategoryWizardConfig
  onComplete: (answers: Record<string, string | string[]>) => void
  onBack: () => void
}

export function ResourceWizard({ category, onComplete, onBack }: ResourceWizardProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [textValue, setTextValue] = useState('')

  const totalSteps = category.steps.length
  const currentStep = category.steps[stepIndex]

  function handleSingleSelect(value: string) {
    const next = { ...answers, [currentStep.id]: value }
    setAnswers(next)
    advance(next)
  }

  function handleMultiToggle(value: string) {
    const existing = (answers[currentStep.id] as string[]) ?? []
    const updated = existing.includes(value)
      ? existing.filter((v) => v !== value)
      : [...existing, value]
    setAnswers((prev) => ({ ...prev, [currentStep.id]: updated }))
  }

  function handleTextSubmit() {
    if (!textValue.trim()) return
    const next = { ...answers, [currentStep.id]: textValue.trim() }
    setTextValue('')
    setAnswers(next)
    advance(next)
  }

  function handleMultiSubmit() {
    const selected = (answers[currentStep.id] as string[]) ?? []
    if (selected.length === 0) return
    advance(answers)
  }

  function advance(current: Record<string, string | string[]>) {
    if (stepIndex + 1 >= totalSteps) {
      onComplete(current)
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  function handleBack() {
    if (stepIndex === 0) {
      onBack()
    } else {
      setStepIndex((i) => i - 1)
    }
  }

  return (
    <div className="max-w-lg mx-auto w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-stone-100 transition-colors text-stone-500"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
            Step {stepIndex + 1} of {totalSteps}
          </p>
          <div className="mt-1.5 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4a5d23] rounded-full transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <h2 className="text-lg font-semibold text-stone-800">{currentStep.question}</h2>

      {/* Options */}
      <StepOptions
        step={currentStep}
        answers={answers}
        textValue={textValue}
        onTextChange={setTextValue}
        onSingleSelect={handleSingleSelect}
        onMultiToggle={handleMultiToggle}
        onTextSubmit={handleTextSubmit}
        onMultiSubmit={handleMultiSubmit}
      />
    </div>
  )
}

interface StepOptionsProps {
  step: WizardStepConfig
  answers: Record<string, string | string[]>
  textValue: string
  onTextChange: (v: string) => void
  onSingleSelect: (v: string) => void
  onMultiToggle: (v: string) => void
  onTextSubmit: () => void
  onMultiSubmit: () => void
}

function StepOptions({
  step,
  answers,
  textValue,
  onTextChange,
  onSingleSelect,
  onMultiToggle,
  onTextSubmit,
  onMultiSubmit,
}: StepOptionsProps) {
  const selected = (answers[step.id] as string[]) ?? []
  const [filterQuery, setFilterQuery] = useState('')

  const isManyOptions = (step.options?.length ?? 0) > 10

  const filteredOptions = useMemo(() => {
    if (!isManyOptions || !filterQuery.trim()) return step.options ?? []
    const q = filterQuery.toLowerCase()
    return (step.options ?? []).filter((opt) => opt.label.toLowerCase().includes(q))
  }, [step.options, filterQuery, isManyOptions])

  if (step.type === 'single-select') {
    return (
      <div className="flex flex-col gap-2">
        {isManyOptions && (
          <div className="relative mb-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter..."
              className="pl-9 py-2 rounded-xl bg-[#faf9f6] border-stone-200 text-stone-900 placeholder:text-stone-400"
              autoFocus
            />
          </div>
        )}
        <div className={isManyOptions ? 'max-h-72 overflow-y-auto flex flex-col gap-2 pr-1' : 'flex flex-col gap-2'}>
          {filteredOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSingleSelect(opt.value)}
              className="w-full text-left px-4 py-3 rounded-xl border border-stone-200 bg-[#faf9f6] hover:border-[#4a5d23]/50 hover:bg-[#f5f3ee] transition-all text-sm text-stone-700 font-medium"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (step.type === 'multi-select') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {step.options?.map((opt) => {
            const isChecked = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => onMultiToggle(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium flex items-center gap-3 ${
                  isChecked
                    ? 'border-[#4a5d23] bg-[#4a5d23]/5 text-[#4a5d23]'
                    : 'border-stone-200 bg-[#faf9f6] hover:border-stone-300 text-stone-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                    isChecked ? 'border-[#4a5d23] bg-[#4a5d23]' : 'border-stone-300 bg-white'
                  }`}
                >
                  {isChecked && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            )
          })}
        </div>
        <Button
          onClick={onMultiSubmit}
          disabled={selected.length === 0}
          className="w-full bg-[#4a5d23] hover:bg-[#3d4e1c] text-white rounded-xl py-3"
        >
          Continue
        </Button>
      </div>
    )
  }

  if (step.type === 'text') {
    return (
      <div className="flex flex-col gap-3">
        <Input
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onTextSubmit()}
          placeholder={step.placeholder ?? 'Type your answer...'}
          className="py-3 rounded-xl bg-[#faf9f6] border-stone-200 text-stone-900 placeholder:text-stone-400"
          autoFocus
        />
        <Button
          onClick={onTextSubmit}
          disabled={!textValue.trim()}
          className="w-full bg-[#4a5d23] hover:bg-[#3d4e1c] text-white rounded-xl py-3"
        >
          Continue
        </Button>
      </div>
    )
  }

  return null
}
