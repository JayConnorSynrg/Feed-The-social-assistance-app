// apps/web/src/lib/ai/guided-flows.ts
// Structured guided flows for FEED AI Assistant

export interface FlowStep {
  id: string
  question: string
  type: 'text' | 'select' | 'multiselect' | 'location' | 'number'
  options?: { label: string; value: string }[]
  placeholder?: string
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
  name: string
  description: string
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
  name: 'Find Resources',
  description: 'Find food, housing, healthcare, and other resources near you',
  icon: '📍',
  steps: [
    {
      id: 'category',
      question: 'What type of help are you looking for?',
      type: 'select',
      options: [
        { label: '🍎 Food Assistance', value: 'food' },
        { label: '🏠 Housing & Shelter', value: 'housing' },
        { label: '🏥 Healthcare', value: 'healthcare' },
        { label: '💡 Utilities (Electric, Gas, Water)', value: 'utilities' },
        { label: '👔 Employment & Job Training', value: 'employment' },
        { label: '👶 Childcare & Family Services', value: 'family' },
        { label: '⚖️ Legal Aid', value: 'legal' },
        { label: '🧠 Mental Health', value: 'mental-health' },
        { label: '📚 Other', value: 'other' },
      ],
      validation: { required: true },
      next: 'urgency',
    },
    {
      id: 'urgency',
      question: 'How urgent is your need?',
      type: 'select',
      options: [
        { label: '🚨 Immediate (today)', value: 'immediate' },
        { label: '📅 This week', value: 'this-week' },
        { label: '🗓️ Within a month', value: 'month' },
        { label: '🔍 Just exploring options', value: 'exploring' },
      ],
      validation: { required: true },
      next: 'location',
    },
    {
      id: 'location',
      question: 'What is your zip code or city?',
      type: 'location',
      placeholder: 'Enter zip code or city name',
      validation: { required: true },
      next: 'additional',
    },
    {
      id: 'additional',
      question: 'Anything else we should know? (optional)',
      type: 'text',
      placeholder: 'E.g., family size, specific requirements, accessibility needs',
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
  name: 'Check Eligibility',
  description: 'See what benefits programs you may qualify for',
  icon: '✓',
  // Raw answers (income, pregnancy, household, employment, benefits) are PII.
  // They flow ONLY to the de-identified benefits-screening edge function; the
  // chat panel rebuilds a derived, PII-free LLM message from the screening
  // result. The guided-flow component must NOT send these answers to the LLM.
  skipDirectSend: true,
  steps: [
    {
      id: 'household-size',
      question: 'How many people live in your household (including yourself)?',
      type: 'select',
      options: [
        { label: '1 (just me)', value: '1' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '4', value: '4' },
        { label: '5', value: '5' },
        { label: '6+', value: '6+' },
      ],
      validation: { required: true },
      next: 'children',
    },
    {
      id: 'children',
      question: 'Are there any children under 18 in your household?',
      type: 'select',
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
      validation: { required: true },
      next: (answer) => (answer === 'yes' ? 'children-ages' : 'income'),
    },
    {
      id: 'children-ages',
      question: 'What are the ages of the children?',
      type: 'multiselect',
      options: [
        { label: 'Under 1 year', value: 'infant' },
        { label: '1-5 years', value: 'toddler' },
        { label: '6-12 years', value: 'child' },
        { label: '13-17 years', value: 'teen' },
      ],
      validation: { required: true },
      next: 'pregnant',
    },
    {
      id: 'pregnant',
      question: 'Is anyone in the household currently pregnant?',
      type: 'select',
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
      validation: { required: true },
      next: 'income',
    },
    {
      id: 'income',
      question: 'What is your approximate monthly household income (before taxes)?',
      type: 'select',
      options: [
        { label: 'No income', value: '0' },
        { label: 'Under $1,000', value: 'under-1000' },
        { label: '$1,000 - $2,000', value: '1000-2000' },
        { label: '$2,000 - $3,000', value: '2000-3000' },
        { label: '$3,000 - $4,000', value: '3000-4000' },
        { label: '$4,000 - $5,000', value: '4000-5000' },
        { label: 'Over $5,000', value: 'over-5000' },
      ],
      validation: { required: true },
      next: 'employment',
    },
    {
      id: 'employment',
      question: 'What is your current employment status?',
      type: 'select',
      options: [
        { label: 'Employed full-time', value: 'full-time' },
        { label: 'Employed part-time', value: 'part-time' },
        { label: 'Self-employed', value: 'self-employed' },
        { label: 'Unemployed - looking for work', value: 'unemployed-looking' },
        { label: 'Unemployed - not looking', value: 'unemployed-not-looking' },
        { label: 'Unable to work (disability)', value: 'disability' },
        { label: 'Retired', value: 'retired' },
        { label: 'Student', value: 'student' },
      ],
      validation: { required: true },
      next: 'current-benefits',
    },
    {
      id: 'current-benefits',
      question: 'Are you currently receiving any benefits? (select all that apply)',
      type: 'multiselect',
      options: [
        { label: 'SNAP (Food Stamps)', value: 'snap' },
        { label: 'Medicaid', value: 'medicaid' },
        { label: 'Medicare', value: 'medicare' },
        { label: 'SSI/SSDI', value: 'ssi-ssdi' },
        { label: 'TANF', value: 'tanf' },
        { label: 'WIC', value: 'wic' },
        { label: 'Housing assistance', value: 'housing' },
        { label: 'None of these', value: 'none' },
      ],
      validation: { required: true },
      next: 'state',
    },
    {
      id: 'state',
      question: 'What state do you live in?',
      type: 'text',
      placeholder: 'Enter state name or abbreviation',
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
  name: 'Form Help',
  description: 'Get help understanding and completing benefit applications',
  icon: '📝',
  steps: [
    {
      id: 'form-type',
      question: 'Which form or application do you need help with?',
      type: 'select',
      options: [
        { label: 'SNAP (Food Stamps) Application', value: 'snap' },
        { label: 'Medicaid Application', value: 'medicaid' },
        { label: 'TANF Application', value: 'tanf' },
        { label: 'Housing Assistance Application', value: 'housing' },
        { label: 'Unemployment Application', value: 'unemployment' },
        { label: 'SSI/SSDI Application', value: 'ssi-ssdi' },
        { label: 'Other form', value: 'other' },
      ],
      validation: { required: true },
      next: 'help-type',
    },
    {
      id: 'help-type',
      question: 'What kind of help do you need?',
      type: 'select',
      options: [
        { label: 'Understand what documents I need', value: 'documents' },
        { label: 'Explain what questions mean', value: 'explain' },
        { label: 'Help with a specific section', value: 'section' },
        { label: 'Review before I submit', value: 'review' },
        { label: 'General guidance through the form', value: 'general' },
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
      question: 'Which section are you working on?',
      type: 'text',
      placeholder: 'E.g., "Income", "Household Members", "Assets"',
      validation: { required: true },
      next: 'specific-question',
    },
    {
      id: 'question-text',
      question: 'What is the question you need help understanding?',
      type: 'text',
      placeholder: 'Type or paste the question from the form',
      validation: { required: true },
      next: 'status',
    },
    {
      id: 'specific-question',
      question: 'What specific question do you have about this section?',
      type: 'text',
      placeholder: "Describe what you're confused about",
      validation: { required: true },
      next: 'status',
    },
    {
      id: 'status',
      question: 'Have you already started the application?',
      type: 'select',
      options: [
        { label: "No, haven't started yet", value: 'not-started' },
        { label: 'Yes, partway through', value: 'in-progress' },
        { label: 'Yes, almost done', value: 'almost-done' },
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
