// apps/web/src/lib/ai/wizard-prompt.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The message the Assistant sends when a member finishes the Get Help wizard (wizard-panel.tsx hands
// over panelParams.wizardContext = JSON {category, answers}; chat-panel.tsx sends this message).
// Moved out of chat-panel.tsx unchanged. It is built from the category id and the option VALUES
// only, so it is the same, byte for byte, whatever language the member reads the wizard in
// (wizard-prompt.test.ts).

/** The wizard's hand-over, or null when it is not the JSON the wizard writes. */
export function parseWizardContext(rawContext: string): { category: string; answers: Record<string, string | string[]> } | null {
  let parsed: { category?: string; answers?: Record<string, string | string[]> } = {}
  try {
    parsed = JSON.parse(rawContext)
  } catch {
    return null
  }
  const { category, answers } = parsed
  if (!category || !answers) return null
  return { category, answers }
}

// PII MINIMIZATION: only generalized, resource-matching context reaches the
// third-party LLM. The allowlist carries the WHAT (assistance need) and the
// WHERE (state) — never sensitive personal specifics. Excluded by omission:
// insurance status, exact household size, income range, tax filing status,
// dependent counts, pregnancy stage, free-text situation, work experience,
// contact preference. Those answers stay out of the LLM message entirely;
// any eligibility math belongs to the de-identified screening path.
const LLM_SAFE_KEYS: Record<string, string> = {
  'assistance-type': 'Type of help',
  'care-type': 'Type of help',
  'waste-type': 'Type of help',
  'camping-type': 'Type of help',
  'goods-type': 'Type of help',
  'legal-issue': 'Type of help',
  'urgency': 'Urgency',
  'state': 'State',
}

/** The first message to the Assistant for a finished wizard. */
export function buildWizardPrompt(category: string, answers: Record<string, string | string[]>): string {
  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1)
  const lines: string[] = [`I need help finding ${categoryLabel} resources.`]

  for (const [key, value] of Object.entries(answers)) {
    const label = LLM_SAFE_KEYS[key]
    if (!label) continue // drop everything not on the allowlist
    const display = Array.isArray(value) ? value.join(', ') : value
    if (!display) continue
    lines.push(`- ${label}: ${display}`)
  }

  lines.push('Please suggest relevant local programs and resources for this need.')

  return lines.join('\n')
}
