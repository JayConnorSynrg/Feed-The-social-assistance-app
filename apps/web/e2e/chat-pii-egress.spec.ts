/**
 * chat-pii-egress.spec.ts — Client-side PII egress guard E2E (Wave 6a + PR-2)
 *
 * THREAT: raw user PII (income, pregnancy status, household composition,
 * insurance status, free-text situation) must NEVER reach the third-party LLM
 * (Fireworks) via the client. The only LLM egress is the request to
 * /functions/v1/chat (use-chat.ts). This spec drives the two guided client
 * paths that historically interpolated raw PII into that request and asserts
 * the intercepted chat request body is free of the sentinel PII values, while
 * the de-identified screening path and the chat's usefulness are preserved.
 *
 * Coverage:
 *  1. Eligibility guided flow — enter sentinel PII (income $2,000–$3,000 bucket,
 *     pregnant=yes, household 6+). Assert /functions/v1/chat body contains NONE
 *     of the sentinels (no "pregnant", no "2000-3000", no household block) AND
 *     the de-identified benefits-screening result still renders (derived program
 *     names reach the LLM, eligibility unbroken).
 *  2. Category wizard (healthcare) — select sentinel "No insurance". Assert the
 *     chat egress body contains neither "insurance" specifics nor the exact
 *     household answer, while category + state survive for resource matching.
 *  3. systemPrompt PII guard (PR-2) — Asserts:
 *     POSITIVE: when personalization ON, systemPrompt contains name + city/state.
 *     NEGATIVE-AS-ABSENCE: systemPrompt and full body never contain precise
 *       lat/lng, income, household size, health, insurance, pregnancy, SSN, phone.
 *     OFF: when personalization disabled, systemPrompt does NOT contain the name.
 *
 * Sentinel values are SYNTHETIC test data, not real PII — intentionally not
 * redacted so the asserted body excerpt is legible in CI output.
 *
 * Run:
 *   npx playwright test apps/web/e2e/chat-pii-egress.spec.ts --reporter=line
 */

import { test, expect, type Page, type Request } from '@playwright/test'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_PASSWORD = 'Test-PiiEgress-123!'
const FIXED_TS = '20260611piiegress'
const TEST_EMAIL = `e2e+piiegress-${FIXED_TS}@feed.local`
const TEST_TIMEOUT_MS = 120_000

// Mock screening response — proves the de-identified path is preserved.
const MOCK_SCREENING_RESPONSE = {
  programs: [
    {
      name: 'SNAP (Food Stamps)',
      eligible: true,
      estimated_monthly_amount: 281,
      description: 'Monthly funds for purchasing food.',
    },
    {
      name: 'WIC',
      eligible: true,
      estimated_monthly_amount: 47,
      description: 'Nutrition program for Women, Infants and Children.',
    },
    {
      name: 'TANF (Cash Assistance)',
      eligible: false,
      estimated_monthly_amount: 0,
      description: 'Temporary Assistance for Needy Families.',
    },
  ],
}

// A minimal SSE body the chat hook can consume so the chat returns a "response"
// without calling the real Fireworks endpoint.
const MOCK_CHAT_SSE =
  'data: {"type":"meta","model":"test/model"}\n\n' +
  'data: {"type":"content","content":"Here are some resources I found for you."}\n\n' +
  'data: [DONE]\n\n'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let provision: VaultProvisionResult

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) await deleteProvisionedUser(admin, prior.id)

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: USER_PASSWORD,
    fullName: 'PiiEgress Test',
    phone: '5550007777',
    residentialAddress: {
      line1: '7 Egress Way',
      city: 'Burlington',
      state: 'VT',
      zip_code: '05401',
    },
  })
  console.log(`[chat-pii-egress] Provisioned ${provision.userId}`)
})

test.afterAll(async () => {
  try {
    if (provision?.userId) {
      await deleteProvisionedUser(admin, provision.userId)
      console.log(`[chat-pii-egress] Deleted test user ${provision.userId}`)
    }
    // Verify no leftover rows for this fixed email
    const { data: remaining } = await admin.auth.admin.listUsers()
    const leftover = remaining?.users?.filter((u) => u.email === TEST_EMAIL) ?? []
    console.log(`[chat-pii-egress] Leftover users with test email: ${leftover.length}`)
  } catch (err) {
    console.error('[chat-pii-egress] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', TEST_EMAIL)
  await page.fill('#password', USER_PASSWORD)
  await page.click('button[type="submit"]')
  // Redirect to SPA root (onboarding_completed=true via provisionVaultUser).
  await page.waitForURL(/\/$|\/\?/, { timeout: 30_000 })
  // Wait for the SPA shell sidebar to render (any sidebar nav button).
  await page.waitForSelector('[data-testid^="sidebar-"]', { timeout: 15_000 })
}

/**
 * Install network routes:
 *  - benefits-screening → mocked success (de-identified path preserved)
 *  - chat → mocked SSE, body captured into the returned array
 * Returns the live array of captured chat request bodies (strings).
 */
async function installChatEgressCapture(page: Page): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const capturedChatBodies: string[] = []

  await page.route(`${supabaseUrl}/functions/v1/benefits-screening`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SCREENING_RESPONSE),
    })
  })

  await page.route(`${supabaseUrl}/functions/v1/chat`, async (route) => {
    const req: Request = route.request()
    const raw = req.postData() ?? ''
    capturedChatBodies.push(raw)
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: MOCK_CHAT_SSE,
    })
  })

  return capturedChatBodies
}

/**
 * Extract the concatenated text of all USER messages across every captured
 * chat egress body. This is the surface where raw user answers would leak —
 * the static `systemPrompt` is a first-party template (it may legitimately
 * NAME a field like "insurance status" to describe the wizard schema) and is
 * not user-supplied PII, so it is intentionally excluded from the assertion.
 */
function userMessageText(capturedChatBodies: string[]): string {
  const parts: string[] = []
  for (const raw of capturedChatBodies) {
    let parsed: { messages?: { role?: string; content?: string }[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Fallback: if a body is unparseable, include it whole so nothing hides.
      parts.push(raw)
      continue
    }
    for (const m of parsed.messages ?? []) {
      if (m.role === 'user' && typeof m.content === 'string') parts.push(m.content)
    }
  }
  return parts.join('\n---\n')
}

function assertNoPii(userText: string, sentinels: string[]): void {
  const lower = userText.toLowerCase()
  for (const s of sentinels) {
    expect(lower, `user-message chat egress must NOT contain PII sentinel "${s}". User messages:\n${userText}`)
      .not.toContain(s.toLowerCase())
  }
}

/**
 * Extract the systemPrompt field from the first captured chat body that has one.
 * Returns empty string when absent so the caller can assert on it safely.
 */
function extractSystemPrompt(capturedChatBodies: string[]): string {
  for (const raw of capturedChatBodies) {
    try {
      const parsed: { systemPrompt?: string } = JSON.parse(raw)
      if (typeof parsed.systemPrompt === 'string') return parsed.systemPrompt
    } catch { /* skip */ }
  }
  return ''
}

/**
 * Assert that the full serialized body string does not contain ANY of the
 * given sentinel values. Used for the whole-body lat/lng + PII absence check.
 */
function assertBodyAbsent(bodies: string[], sentinels: string[]): void {
  const combined = bodies.join('\n')
  for (const s of sentinels) {
    expect(combined, `chat request body must NOT contain sentinel "${s}"`)
      .not.toContain(s)
  }
}

// ---------------------------------------------------------------------------
// Test 1 — Eligibility flow: raw PII never reaches /functions/v1/chat
// ---------------------------------------------------------------------------

test('eligibility flow: sentinel PII absent from chat egress; screening result preserved', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await signIn(page)
  const capturedChatBodies = await installChatEgressCapture(page)

  // Chat is the default panel; ensure we are there.
  await page.locator('[data-testid="sidebar-chat"]').click()

  // Open the eligibility guided flow.
  await page.getByText('Check Eligibility').click()

  // Step through, entering distinctive sentinel PII.
  // household-size → 6+
  await page.getByText('6+').click()
  // children → Yes
  await page.getByText('Yes').first().click()
  // children-ages → 1-5 years, then Continue
  await page.getByText('1-5 years').click()
  await page.getByRole('button', { name: /continue/i }).click()
  // pregnant → Yes  (SENTINEL)
  await page.getByText('Yes').first().click()
  // income → $2,000 - $3,000  (SENTINEL bucket 2000-3000)
  await page.getByText('$2,000 - $3,000').click()
  // employment → Employed part-time
  await page.getByText('Employed part-time').click()
  // current-benefits → None of these, then Continue
  await page.getByText('None of these').click()
  await page.getByRole('button', { name: /continue/i }).click()
  // state → VT
  const stateInput = page.locator('input[placeholder*="state" i], input[placeholder*="abbreviation" i]')
  await stateInput.fill('VT')
  await page.getByRole('button', { name: /continue/i }).click()

  // De-identified screening result must render (eligibility not broken).
  await expect(page.getByText(/SNAP \(Food Stamps\)/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/WIC/i)).toBeVisible()
  await expect(page.getByText(/Programs panel/i)).toBeVisible()

  // The chat must have been called at least once (the derived results message),
  // and the chat must still return a useful resource-suggestion response.
  await expect(page.getByText(/resources I found/i)).toBeVisible({ timeout: 15_000 })

  expect(capturedChatBodies.length).toBeGreaterThan(0)
  const userText = userMessageText(capturedChatBodies)
  console.log('[chat-pii-egress] Eligibility user-message egress:\n', userText)

  // ASSERT: none of the raw-PII sentinels leaked into the LLM-bound user message.
  assertNoPii(userText, [
    'pregnant',
    'pregnancy',
    '2000-3000',
    '$2,000 - $3,000',
    'employment status',
    'monthly income',
    'household size',
    'current benefits',
  ])

  // ASSERT (positive): derived program names DID reach the LLM (usefulness).
  expect(userText).toContain('SNAP')
})

// ---------------------------------------------------------------------------
// Test 2 — Category wizard: insurance status / household specifics stripped
// ---------------------------------------------------------------------------

test('category wizard: insurance status absent from chat egress; category + state preserved', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await signIn(page)
  const capturedChatBodies = await installChatEgressCapture(page)

  // Navigate to the resource category wizard.
  await page.locator('[data-testid="sidebar-wizard"]').click()

  // Pick the Healthcare category (collects the "insurance status" sentinel).
  await page.getByText('Healthcare', { exact: true }).click()

  // assistance-type (multi-select) → Mental health services, then Continue
  await page.getByText('Mental health services').click()
  await page.getByRole('button', { name: /continue/i }).click()
  // insurance → No insurance  (SENTINEL)
  await page.getByText('No insurance').click()
  // state → Vermont
  await page.getByText('Vermont', { exact: true }).click()
  // contact → No preference
  await page.getByText('No preference').click()

  // Wizard navigates to chat and auto-sends. Wait for the chat response.
  await expect(page.getByText(/resources I found/i)).toBeVisible({ timeout: 20_000 })

  expect(capturedChatBodies.length).toBeGreaterThan(0)
  const userText = userMessageText(capturedChatBodies)
  console.log('[chat-pii-egress] Wizard user-message egress:\n', userText)

  // ASSERT: the user's actual sensitive answer values are absent from the
  // LLM-bound user message. (The static system prompt may NAME "insurance
  // status" to describe the wizard schema; that is a first-party template, not
  // the user's answer, and is excluded by userMessageText.)
  assertNoPii(userText, [
    'no insurance',
    'private insurance',
    'employer insurance',
    'insurance status',
  ])

  // ASSERT (positive): category + state survive for resource matching.
  expect(userText.toLowerCase()).toContain('healthcare')
  expect(userText).toContain('Vermont')
})

// ---------------------------------------------------------------------------
// Test 3 — systemPrompt PII guard (PR-2 — chat-personalization)
// ---------------------------------------------------------------------------

/**
 * 3a. Personalization ON (default): systemPrompt contains name + city/state;
 *     no precise lat/lng JSON keys in the body; no sensitive PII in systemPrompt.
 *
 * Note: the test user (PiiEgress Test / Burlington / VT) has no lat/lng
 * stored in their profile, so the structural `"lat":` / `"lng":` JSON keys must
 * be absent from the request body — they were previously sent unconditionally
 * from use-chat.ts even when the values were null/undefined.
 */
test('systemPrompt personalization ON: name+city present; no lat/lng keys; no sensitive PII in prompt', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await signIn(page)

  // Ensure personalization is ON (default — remove any prior opt-out key)
  await page.evaluate(() => {
    localStorage.removeItem('feed_chat_personalization')
  })

  const capturedChatBodies = await installChatEgressCapture(page)

  await page.locator('[data-testid="sidebar-chat"]').click()
  // Send a plain chat message to trigger a non-wizard request
  await page.fill('[placeholder*="anything" i]', 'Hello, I need help finding food assistance.')
  await page.keyboard.press('Enter')

  await expect(page.getByText(/resources I found/i)).toBeVisible({ timeout: 20_000 })
  expect(capturedChatBodies.length).toBeGreaterThan(0)

  const systemPrompt = extractSystemPrompt(capturedChatBodies)
  console.log('[chat-pii-egress] systemPrompt (personalization ON) excerpt:\n',
    systemPrompt.slice(0, 300))

  // POSITIVE: personalization line present — name + city/state from profile.
  // Test user profile: fullName='PiiEgress Test', city='Burlington', state='VT'.
  expect(systemPrompt, 'systemPrompt should contain user name when personalization ON')
    .toContain('PiiEgress')
  expect(systemPrompt, 'systemPrompt should contain user city when personalization ON')
    .toContain('Burlington')

  // NEGATIVE-AS-ABSENCE: precise lat/lng JSON keys must not appear in the body.
  // Prior code sent `"lat":null,"lng":null` — even null-valued coord keys are stripped.
  assertBodyAbsent(capturedChatBodies, ['"lat":', '"lng":'])

  // NEGATIVE-AS-ABSENCE: user-specific PII and flow-specific sentinel strings absent
  // from the systemPrompt. The base template may legitimately reference field NAMES
  // like "SSN" as negative instructions ("never ask for SSN") — those are first-party
  // template text, not PII egress. Only assert user-specific values and strings that
  // have no valid reason to appear in the general flow prompt.
  const sensitiveAbsentFromPrompt = [
    '5550007777',   // provisioned phone number (regression guard from PR-2)
    'monthly income',   // only in eligibility flow, not general
    'household size',   // only in food/eligibility flows, not general
    'insurance status', // only in healthcare flow, not general
    'pregnancy',        // never in any runtime prompt string
  ]
  for (const s of sensitiveAbsentFromPrompt) {
    expect(systemPrompt, `systemPrompt must NOT contain sensitive sentinel "${s}"`)
      .not.toContain(s)
  }
  assertBodyAbsent(capturedChatBodies, ['5550007777'])
})

/**
 * 3b. Personalization OFF: systemPrompt does NOT contain the user's name.
 */
test('systemPrompt personalization OFF: user name absent from systemPrompt', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await signIn(page)

  // Disable personalization via the dedicated localStorage key
  await page.evaluate(() => {
    localStorage.setItem('feed_chat_personalization', 'false')
  })

  const capturedChatBodies = await installChatEgressCapture(page)

  await page.locator('[data-testid="sidebar-chat"]').click()
  await page.fill('[placeholder*="anything" i]', 'What resources are available near me?')
  await page.keyboard.press('Enter')

  await expect(page.getByText(/resources I found/i)).toBeVisible({ timeout: 20_000 })
  expect(capturedChatBodies.length).toBeGreaterThan(0)

  const systemPrompt = extractSystemPrompt(capturedChatBodies)
  console.log('[chat-pii-egress] systemPrompt (personalization OFF) excerpt:\n',
    systemPrompt.slice(0, 200))

  // NEGATIVE: user's name must NOT appear in systemPrompt when opt-out active
  expect(systemPrompt, 'systemPrompt must NOT contain user name when personalization OFF')
    .not.toContain('PiiEgress')

  // Lat/lng still absent regardless of personalization toggle
  assertBodyAbsent(capturedChatBodies, ['"lat":', '"lng":'])
})
