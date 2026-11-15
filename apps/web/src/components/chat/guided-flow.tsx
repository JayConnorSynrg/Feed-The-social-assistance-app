'use client'

// apps/web/src/components/chat/guided-flow.tsx
// Interactive guided flow component for structured conversations.
// Every word is in the viewer's language (lib/i18n-assistant.ts) and the card is marked with it; an
// option answers with its `value`, so what is sent never depends on the language.

import React, { useState, useCallback, useEffect, useId, useRef } from 'react'
import {
  type GuidedFlow,
  type FlowStep,
  getNextStep,
  buildAIPrompt,
} from '@/lib/ai/guided-flows'
import { useChat } from '@/hooks/use-chat'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { assistantT, flowText } from '@/lib/i18n-assistant'
import { formatMessage } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'

interface GuidedFlowComponentProps {
  flow: GuidedFlow
  onComplete?: (answers: Record<string, string>, aiResponse: string) => void
  onCancel?: () => void
}

interface StepComponentProps {
  step: FlowStep
  onAnswer: (answer: string) => void
  isLoading?: boolean
  locale: Locale
  /** The id of the step's question heading: the options' group and the input are named by it. */
  questionId: string
}

/** An option's words: its decorative emoji (hidden from screen readers) and its label. */
function OptionText({ option, locale }: { option: NonNullable<FlowStep['options']>[number]; locale: Locale }) {
  return (
    <>
      {option.icon && <span aria-hidden="true" className="me-2">{option.icon}</span>}
      {flowText(locale, option.label)}
    </>
  )
}

// Mounted once per step (keyed by step id in GuidedFlowComponent), so what was typed or picked on
// one step never carries into the next.
export function StepComponent({ step, onAnswer, isLoading, locale, questionId }: StepComponentProps) {
  const hintId = useId()
  const [textValue, setTextValue] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()

      if (step.type === 'text' || step.type === 'location' || step.type === 'number') {
        if (step.validation?.required && !textValue.trim()) return
        onAnswer(textValue.trim())
      } else if (step.type === 'multiselect') {
        if (step.validation?.required && selectedOptions.length === 0) return
        onAnswer(selectedOptions.join(', '))
      }
    },
    [step, textValue, selectedOptions, onAnswer]
  )

  if (step.type === 'select') {
    return (
      <div role="group" aria-labelledby={questionId} className="space-y-2">
        {step.options?.map(option => (
          <button
            key={option.value}
            onClick={() => onAnswer(option.value)}
            disabled={isLoading}
            className="w-full p-3 text-start rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <OptionText option={option} locale={locale} />
          </button>
        ))}
      </div>
    )
  }

  if (step.type === 'multiselect') {
    return (
      <div role="group" aria-labelledby={questionId} className="space-y-2">
        {step.options?.map(option => {
          const isSelected = selectedOptions.includes(option.value)
          return (
            <button
              key={option.value}
              onClick={() => {
                setSelectedOptions(prev =>
                  isSelected
                    ? prev.filter(v => v !== option.value)
                    : [...prev, option.value]
                )
              }}
              disabled={isLoading}
              aria-pressed={isSelected}
              className={`w-full p-3 text-start rounded-lg border transition-colors disabled:opacity-50 ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <span aria-hidden="true" className="me-2">{isSelected ? '☑' : '☐'}</span>
              <OptionText option={option} locale={locale} />
            </button>
          )
        })}
        {selectedOptions.length > 0 && (
          <Button onClick={() => handleSubmit()} disabled={isLoading} className="w-full mt-4">
            {assistantT(locale, 'flowContinue')}
          </Button>
        )}
      </div>
    )
  }

  // Text, location, number inputs. The hint is text on screen (not only a placeholder that vanishes
  // as the member types) and describes the input.
  const hint = step.placeholder ? assistantT(locale, step.placeholder) : null
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hint && (
        <p id={hintId} className="text-sm text-stone-600">
          {hint}
        </p>
      )}
      <Input
        type={step.type === 'number' ? 'number' : 'text'}
        value={textValue}
        onChange={e => setTextValue(e.target.value)}
        placeholder={hint ?? undefined}
        aria-labelledby={questionId}
        aria-describedby={hint ? hintId : undefined}
        dir="auto"
        disabled={isLoading}
        min={step.validation?.min}
        max={step.validation?.max}
        pattern={step.validation?.pattern}
        required={step.validation?.required}
        className="w-full"
      />
      <Button
        type="submit"
        disabled={isLoading || (step.validation?.required && !textValue.trim())}
        className="w-full"
      >
        {assistantT(locale, isLoading ? 'flowProcessing' : 'flowContinue')}
      </Button>
    </form>
  )
}

export function GuidedFlowComponent({
  flow,
  onComplete,
  onCancel,
}: GuidedFlowComponentProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [aiResponse, setAIResponse] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const { sendMessage, messages, isLoading } = useChat({ flow: 'general' })
  const locale = useProfileLocale()

  const currentStep = flow.steps[currentStepIndex]
  const questionId = useId()
  // Focus moves to the question whenever the step changes (opening the flow, an answer, Back), so a
  // keyboard or screen-reader user starts each step at its question.
  const questionRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    questionRef.current?.focus()
  }, [currentStepIndex])
  const isLastStep = currentStepIndex === flow.steps.length - 1

  const handleAnswer = useCallback(
    async (answer: string) => {
      const newAnswers = { ...answers, [currentStep.id]: answer }
      setAnswers(newAnswers)

      if (isLastStep) {
        setIsProcessing(true)

        // PII-sensitive flows (skipDirectSend) collect answers and hand them to
        // the owning panel WITHOUT sending anything to the LLM. The raw answers
        // must flow only to the de-identified screening path; the panel rebuilds
        // a derived, PII-free message before any LLM call.
        if (flow.skipDirectSend) {
          onComplete?.(newAnswers, '')
          setIsProcessing(false)
          return
        }

        // Non-sensitive flows (resource-finder, form-help): build and send the
        // AI prompt directly. These prompts contain only category/topic/location
        // context, never income/pregnancy/household-composition PII.
        const prompt = buildAIPrompt(flow, newAnswers)
        if (prompt) {
          await sendMessage(prompt)
          // Get the assistant's response (last message)
          const lastMessage = messages[messages.length - 1]
          if (lastMessage?.role === 'assistant') {
            setAIResponse(lastMessage.content)
            onComplete?.(newAnswers, lastMessage.content)
          }
        }
        setIsProcessing(false)
      } else {
        // Find next step
        const nextStepId = getNextStep(flow, currentStep.id, answer)
        if (nextStepId) {
          const nextIndex = flow.steps.findIndex(s => s.id === nextStepId)
          if (nextIndex !== -1) {
            setCurrentStepIndex(nextIndex)
          }
        } else {
          // No explicit next, just go to next in array
          setCurrentStepIndex(prev => prev + 1)
        }
      }
    },
    [answers, currentStep, flow, isLastStep, messages, sendMessage, onComplete]
  )

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }, [currentStepIndex])

  // Progress indicator
  const progress = ((currentStepIndex + 1) / flow.steps.length) * 100

  return (
    <Card lang={locale} dir={dir(locale)} className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="flex items-center gap-2">
            <span aria-hidden="true">{flow.icon}</span>
            <span>{assistantT(locale, flow.name)}</span>
          </CardTitle>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {assistantT(locale, 'flowCancel')}
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessage(assistantT(locale, 'flowStep'), {
            current: formatCount(currentStepIndex + 1, locale),
            total: formatCount(flow.steps.length, locale),
          })}
        </p>
      </CardHeader>

      <CardContent>
        {aiResponse ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p lang="" dir="auto" className="whitespace-pre-wrap text-sm">{aiResponse}</p>
            </div>
            <Button onClick={() => onComplete?.(answers, aiResponse)} className="w-full">
              {assistantT(locale, 'flowDone')}
            </Button>
          </div>
        ) : (
          <>
            <h3 ref={questionRef} id={questionId} tabIndex={-1} className="font-medium mb-4 outline-none">
              {assistantT(locale, currentStep.question)}
            </h3>

            <StepComponent
              key={currentStep.id}
              questionId={questionId}
              step={currentStep}
              onAnswer={handleAnswer}
              isLoading={isLoading || isProcessing}
              locale={locale}
            />

            {currentStepIndex > 0 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={isLoading || isProcessing}
                className="mt-4"
              >
                <span aria-hidden="true" className="inline-block rtl:-scale-x-100">←</span>
                {assistantT(locale, 'flowBack')}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Flow selector component
interface FlowSelectorProps {
  flows: GuidedFlow[]
  onSelect: (flow: GuidedFlow) => void
}

export function FlowSelector({ flows, onSelect }: FlowSelectorProps) {
  const locale = useProfileLocale()
  return (
    <div lang={locale} dir={dir(locale)} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {flows.map(flow => (
        <button
          key={flow.id}
          onClick={() => onSelect(flow)}
          className="p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors text-start"
        >
          <span aria-hidden="true" className="text-3xl mb-3 block">{flow.icon}</span>
          <h3 className="font-semibold mb-1">{assistantT(locale, flow.name)}</h3>
          <p className="text-sm text-muted-foreground">{assistantT(locale, flow.description)}</p>
        </button>
      ))}
    </div>
  )
}
