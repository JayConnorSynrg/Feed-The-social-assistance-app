// apps/web/src/lib/ai/guided-flows.ts
// Structured guided flows for FEED AI Assistant.
//
// The words a member reads (a flow's name and description, each question, option and hint) are
// keys of lib/i18n-assistant.ts, shown with flowText(locale, …) in the member's language. What a
// flow SENDS does not change with the language: an option answers with its `value`, and aiPrompt
// (filled from those values and the member's own typed words) stays as written here.

import type { AssistantKey, FlowText } from '@/lib/i18n-assistant'

export interface FlowOption {
  /** What the answer is: the same in every language (prompts and screening read it). */
  value: string
  label: FlowText
  /** A decorative emoji shown before the label (hidden from screen readers). */
  icon?: string
}

export interface FlowStep {
  id: string
  question: AssistantKey
  type: 'text' | 'select' | 'multiselect' | 'location' | 'number'
  options?: FlowOption[]
  placeholder?: AssistantKey
  validation?: {
    required?: boolean
    min?: number
    max?: number
    pattern?: string
  }
  next?: string | ((answer: string) => string)
  aiPrompt?: string // Prompt to send to AI with collected data
}

export interface GuidedFlow {
  id: string
  name: AssistantKey
  description: AssistantKey
  icon: string
  steps: FlowStep[]
  /**
   * When true, the guided-flow component collects answers and hands them to
   * onComplete WITHOUT building an aiPrompt or sending anything to the LLM.
   * Use this for flows whose raw answers are sensitive PII (income, pregnancy,
   * household composition): those answers must flow ONLY to the de-identified
   * benefits-screening edge function, never into a message that reaches the
   * third-party LLM. The owning panel rebuilds a derived, PII-free LLM message
   * from the screening output.
   */
  skipDirectSend?: boolean
}

// Resource Finder Flow (P4-T5)
export const resourceFinderFlow: GuidedFlow = {
  id: 'resource-finder',
  name: 'rfName',
  description: 'rfDescription',
  icon: '📍',
  steps: [
    {
      id: 'category',
      question: 'rfCategoryQ',
      type: 'select',
      options: [
        { icon: '🍎', label: 'rfFood', value: 'food' },
        { icon: '🏠', label: 'rfHousing', value: 'housing' },
        { icon: '🏥', label: 'rfHealthcare', value: 'healthcare' },
        { icon: '💡', label: 'rfUtilities', value: 'utilities' },
        { icon: '👔', label: 'rfEmployment', value: 'employment' },
        { icon: '👶', label: 'rfFamily', value: 'family' },
        { icon: '⚖️', label: 'rfLegal', value: 'legal' },
        { icon: '🧠', label: 'rfMentalHealth', value: 'mental-health' },
        { icon: '📚', label: 'rfOther', value: 'other' },
      ],
      validation: { required: true },
      next: 'urgency',
    },
    {
      id: 'urgency',
      question: 'rfUrgencyQ',
      type: 'select',
      options: [
        { icon: '🚨', label: 'rfImmediate', value: 'immediate' },
        { icon: '📅', label: 'rfThisWeek', value: 'this-week' },
        { icon: '🗓️', label: 'rfMonth', value: 'month' },
        { icon: '🔍', label: 'rfExploring', value: 'exploring' },
      ],
      validation: { required: true },
      next: 'location',
    },
    {
      id: 'location',
      question: 'rfLocationQ',
      type: 'location',
      placeholder: 'rfLocationPh',
      validation: { required: true },
      next: 'additional',
    },
    {
      id: 'additional',
      question: 'rfAdditionalQ',
      type: 'text',
      placeholder: 'rfAdditionalPh',
      validation: { required: false },
      aiPrompt: `Based on the following information, find relevant resources:
- Category: {{category}}
- Urgency: {{urgency}}
- Location: {{location}}
- Additional info: {{additional}}

Please provide 2-3 specific resources with names, addresses, contact info, and any eligibility requirements.`,
    },
  ],
}

// Eligibility Checker Flow (P4-T6)
export const eligibilityCheckerFlow: GuidedFlow = {
  id: 'eligibility-checker',
  name: 'ecName',
  description: 'ecDescription',
  icon: '✓',
  // Raw answers (income, pregnancy, household, employment, benefits) are PII.
  // They flow ONLY to the de-identified benefits-screening edge function; the
  // chat panel rebuilds a derived, PII-free LLM message from the screening
  // result. The guided-flow component must NOT send these answers to the LLM.
  skipDirectSend: true,
  steps: [
    {
      id: 'household-size',
      question: 'ecHouseholdQ',
      type: 'select',
      options: [
        { label: 'ecJustMe', value: '1' },
        { label: { literal: '2' }, value: '2' },
        { label: { literal: '3' }, value: '3' },
        { label: { literal: '4' }, value: '4' },
        { label: { literal: '5' }, value: '5' },
        { label: { literal: '6+' }, value: '6+' },
      ],
      validation: { required: true },
      next: 'children',
    },
    {
      id: 'children',
      question: 'ecChildrenQ',
      type: 'select',
      options: [
        { label: 'optYes', value: 'yes' },
        { label: 'optNo', value: 'no' },
      ],
      validation: { required: true },
      next: (answer) => (answer === 'yes' ? 'children-ages' : 'income'),
    },
    {
      id: 'children-ages',
      question: 'ecAgesQ',
      type: 'multiselect',
      options: [
        { label: 'ecAgeInfant', value: 'infant' },
        { label: 'ecAgeToddler', value: 'toddler' },
        { label: 'ecAgeChild', value: 'child' },
        { label: 'ecAgeTeen', value: 'teen' },
      ],
      validation: { required: true },
      next: 'pregnant',
    },
    {
      id: 'pregnant',
      question: 'ecPregnantQ',
      type: 'select',
      options: [
        { label: 'optYes', value: 'yes' },
        { label: 'optNo', value: 'no' },
      ],
      validation: { required: true },
      next: 'income',
    },
    {
      id: 'income',
      question: 'ecIncomeQ',
      type: 'select',
      options: [
        { label: 'ecIncomeNone', value: '0' },
        { label: { key: 'ecIncomeUnder', usd: { amount: 1000 } }, value: 'under-1000' },
        { label: { key: 'ecIncomeRange', usd: { from: 1000, to: 2000 } }, value: '1000-2000' },
        { label: { key: 'ecIncomeRange', usd: { from: 2000, to: 3000 } }, value: '2000-3000' },
        { label: { key: 'ecIncomeRange', usd: { from: 3000, to: 4000 } }, value: '3000-4000' },
        { label: { key: 'ecIncomeRange', usd: { from: 4000, to: 5000 } }, value: '4000-5000' },
        { label: { key: 'ecIncomeOver', usd: { amount: 5000 } }, value: 'over-5000' },
      ],
      validation: { required: true },
      next: 'employment',
    },
    {
      id: 'employment',
      question: 'ecEmploymentQ',
      type: 'select',
      options: [
        { label: 'ecFullTime', value: 'full-time' },
        { label: 'ecPartTime', value: 'part-time' },
        { label: 'ecSelfEmployed', value: 'self-employed' },
        { label: 'ecUnemployedLooking', value: 'unemployed-looking' },
        { label: 'ecUnemployedNotLooking', value: 'unemployed-not-looking' },
        { label: 'ecDisability', value: 'disability' },
        { label: 'ecRetired', value: 'retired' },
        { label: 'ecStudent', value: 'student' },
      ],
      validation: { required: true },
      next: 'current-benefits',
    },
    {
      id: 'current-benefits',
      question: 'ecBenefitsQ',
      type: 'multiselect',
      options: [
        { label: 'ecSnap', value: 'snap' },
        { label: 'ecMedicaid', value: 'medicaid' },
        { label: 'ecMedicare', value: 'medicare' },
        { label: 'ecSsi', value: 'ssi-ssdi' },
        { label: 'ecTanf', value: 'tanf' },
        { label: 'ecWic', value: 'wic' },
        { label: 'ecHousingAssistance', value: 'housing' },
        { label: 'ecNone', value: 'none' },
      ],
      validation: { required: true },
      next: 'state',
    },
    {
      id: 'state',
      question: 'ecStateQ',
      type: 'text',
      placeholder: 'ecStatePh',
      validation: { required: true },
      // No aiPrompt: this flow is skipDirectSend. Raw household answers never
      // reach the LLM. Eligibility is computed by the benefits-screening edge
      // function from a de-identified payload, and the chat panel sends only the
      // DERIVED result (qualifying program names + state) onward to the LLM.
    },
  ],
}

// Form Help Flow (P4-T7)
export const formHelpFlow: GuidedFlow = {
  id: 'form-help',
  name: 'fhName',
  description: 'fhDescription',
  icon: '📝',
  steps: [
    {
      id: 'form-type',
      question: 'fhFormQ',
      type: 'select',
      options: [
        { label: 'fhSnap', value: 'snap' },
        { label: 'fhMedicaid', value: 'medicaid' },
        { label: 'fhTanf', value: 'tanf' },
        { label: 'fhHousing', value: 'housing' },
        { label: 'fhUnemployment', value: 'unemployment' },
        { label: 'fhSsi', value: 'ssi-ssdi' },
        { label: 'fhOther', value: 'other' },
      ],
      validation: { required: true },
      next: 'help-type',
    },
    {
      id: 'help-type',
      question: 'fhHelpQ',
      type: 'select',
      options: [
        { label: 'fhDocuments', value: 'documents' },
        { label: 'fhExplain', value: 'explain' },
        { label: 'fhSection', value: 'section' },
        { label: 'fhReview', value: 'review' },
        { label: 'fhGeneral', value: 'general' },
      ],
      validation: { required: true },
      next: (answer) => {
        if (answer === 'section') return 'section-name'
        if (answer === 'explain') return 'question-text'
        return 'status'
      },
    },
    {
      id: 'section-name',
      question: 'fhSectionQ',
      type: 'text',
      placeholder: 'fhSectionPh',
      validation: { required: true },
      next: 'specific-question',
    },
    {
      id: 'question-text',
      question: 'fhQuestionQ',
      type: 'text',
      placeholder: 'fhQuestionPh',
      validation: { required: true },
      next: 'status',
    },
    {
      id: 'specific-question',
      question: 'fhSpecificQ',
      type: 'text',
      placeholder: 'fhSpecificPh',
      validation: { required: true },
      next: 'status',
    },
    {
      id: 'status',
      question: 'fhStatusQ',
      type: 'select',
      options: [
        { label: 'fhNotStarted', value: 'not-started' },
        { label: 'fhInProgress', value: 'in-progress' },
        { label: 'fhAlmostDone', value: 'almost-done' },
      ],
      validation: { required: true },
      aiPrompt: `Help the user with their benefits application:

Form Details:
- Form type: {{form-type}}
- Help needed: {{help-type}}
- Section (if applicable): {{section-name}}
- Question text (if applicable): {{question-text}}
- Specific question (if applicable): {{specific-question}}
- Application status: {{status}}

Please provide:
1. Clear, simple explanation based on what they need help with
2. If they need documents, list what they typically need
3. Tips for avoiding common mistakes
4. Reassurance that they can ask follow-up questions`,
    },
  ],
}

// All flows
export const GUIDED_FLOWS: Record<string, GuidedFlow> = {
  'resource-finder': resourceFinderFlow,
  'eligibility-checker': eligibilityCheckerFlow,
  'form-help': formHelpFlow,
}

// Helper to get the next step
export function getNextStep(flow: GuidedFlow, currentStepId: string, answer: string): string | null {
  const currentStep = flow.steps.find(s => s.id === currentStepId)
  if (!currentStep || !currentStep.next) return null

  if (typeof currentStep.next === 'function') {
    return currentStep.next(answer)
  }

  return currentStep.next
}

// Helper to build AI prompt with collected answers
export function buildAIPrompt(flow: GuidedFlow, answers: Record<string, string>): string | null {
  const lastStep = flow.steps[flow.steps.length - 1]
  if (!lastStep.aiPrompt) return null

  let prompt = lastStep.aiPrompt
  for (const [key, value] of Object.entries(answers)) {
    prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value || 'Not provided')
  }

  return prompt
}
