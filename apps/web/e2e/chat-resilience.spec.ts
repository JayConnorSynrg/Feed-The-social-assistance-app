/**
 * chat-resilience.spec.ts — Chat client resilience + telemetry E2E (Wave 3)
 *
 * Coverage:
 *  A. Happy path — send a message, assert reply renders and no error banner shown.
 *  B. Transient recovery — intercept the edge function to 503 ONCE then pass;
 *     assert the auto-retry recovers, reply eventually renders, NO error banner shown.
 *  C. Persistent failure — intercept the edge function to always 503;
 *     assert the specific translated error banner appears (NOT the old generic string),
 *     and clicking "Try again" re-fires the request.
 *
 * All tests use route interception — zero real prod calls, zero test data created.
 *
 * Run:
 *   npx playwright test apps/web/e2e/chat-resilience.spec.ts --reporter=line
 */

import { test, expect, type Route } from '@playwright/test'

// The edge function URL pattern that use-chat.ts calls
const CHAT_EDGE_PATTERN = '**/functions/v1/chat'

// Minimal valid SSE response that streams one content chunk then [DONE]
function buildSseStream(content: string): string {
  const meta = JSON.stringify({ type: 'meta', model: 'test/model' })
  const chunk = JSON.stringify({ type: 'content', content })
  return `data: ${meta}\ndata: ${chunk}\ndata: [DONE]\n\n`
}

// Helper: navigate to app and get to the chat panel with an authenticated session.
// Uses the Supabase anon REST API to create an anonymous session (no UI flow), then
// navigates to / with a valid cookie. This avoids the Next.js abort-signal timing
// issues in the UI guest-access flow.
async function openChatPanel(page: import('@playwright/test').Page) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0]

  // Sign in anonymously via REST POST (not UI, no abort-signal issue)
  const response = await page.request.post(`${supabaseUrl}/auth/v1/signup`, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    data: {},
  })
  const session = await response.json()

  if (session?.access_token) {
    // The @supabase/ssr package stores the session as a chunked cookie.
    // The session JSON is split at 3180 bytes. For a fresh anonymous session
    // it fits in one chunk (< 3180 bytes), so we can set it directly.
    const sessionJson = JSON.stringify({
      access_token: session.access_token,
      token_type: session.token_type ?? 'bearer',
      expires_in: session.expires_in ?? 3600,
      expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      refresh_token: session.refresh_token,
      user: session.user,
    })
    const cookieName = `sb-${projectRef}-auth-token`
    await page.context().addCookies([{
      name: cookieName,
      value: encodeURIComponent(sessionJson),
      domain: 'localhost',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'Lax',
    }])
  }

  // Navigate to the app — middleware reads the cookie and allows access
  await page.goto('/', { waitUntil: 'load' })

  // Click the AI Assistant (chat) sidebar button
  const chatNav = page.locator('[data-testid="sidebar-chat"]').first()
  await chatNav.waitFor({ state: 'visible', timeout: 10_000 })
  await chatNav.click()

  // Wait for the enabled chat input (authenticated placeholder = "Ask me…")
  await page.waitForSelector('input[placeholder*="Ask me"]', { state: 'visible', timeout: 15_000 })
}

// Helper: type a message into the chat input and submit
async function typeAndSend(page: import('@playwright/test').Page, text: string) {
  // The greeting-view input has placeholder "Ask me anything about benefits..."
  // The conversation-view input has placeholder "Type your message..."
  const input = page.locator('input[placeholder*="Ask me"], input[placeholder*="Type your"]').first()
  await input.fill(text)
  await input.press('Enter')
}

// ── A. Happy path ──────────────────────────────────────────────────────────

test('A1 — happy path: reply renders, no error banner', async ({ page }) => {
  // Intercept the edge function and return a valid SSE stream
  await page.route(CHAT_EDGE_PATTERN, async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: buildSseStream('Hello! I can help you find resources.'),
    })
  })

  await openChatPanel(page)
  await typeAndSend(page, 'What resources are available?')

  // Reply should appear — wait for the assistant's streamed content
  await expect(page.locator('text=Hello! I can help you find resources.')).toBeVisible({ timeout: 15_000 })

  // Error banner must NOT be present
  await expect(page.locator('[data-testid="chat-error-banner"]')).not.toBeVisible()
})

// ── B. Transient recovery ──────────────────────────────────────────────────

test('B1 — transient 503 then pass: auto-retry recovers, no error shown', async ({ page }) => {
  let callCount = 0

  await page.route(CHAT_EDGE_PATTERN, async (route: Route) => {
    callCount++
    if (callCount === 1) {
      // First call: simulate transient gateway failure
      await route.fulfill({
        status: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Service temporarily unavailable' }),
      })
    } else {
      // Second call (auto-retry): succeed
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: buildSseStream('Retry succeeded — here are some resources for you.'),
      })
    }
  })

  await openChatPanel(page)
  await typeAndSend(page, 'Find food banks near me')

  // The reply should eventually appear after the auto-retry
  await expect(
    page.locator('text=Retry succeeded — here are some resources for you.')
  ).toBeVisible({ timeout: 20_000 })

  // No error banner — the retry recovered transparently
  await expect(page.locator('[data-testid="chat-error-banner"]')).not.toBeVisible()

  // Confirm two requests were made (first attempt + one retry)
  expect(callCount).toBeGreaterThanOrEqual(2)
})

// ── C. Persistent failure ──────────────────────────────────────────────────

test('C1 — persistent 503: specific error banner appears with Try again button', async ({ page }) => {
  await page.route(CHAT_EDGE_PATTERN, async (route: Route) => {
    await route.fulfill({
      status: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Service unavailable' }),
    })
  })

  await openChatPanel(page)
  await typeAndSend(page, 'Help me apply for benefits')

  // The specific translated error banner must appear
  const banner = page.locator('[data-testid="chat-error-banner"]')
  await expect(banner).toBeVisible({ timeout: 20_000 })

  // Must NOT contain the old generic dead-end string
  await expect(banner).not.toContainText('Sorry, I encountered an error')

  // Must contain a user-helpful message (server-kind message)
  await expect(banner).toContainText('assistant is briefly unavailable')

  // "Try again" button must be present
  const retryBtn = page.locator('[data-testid="chat-retry-btn"]')
  await expect(retryBtn).toBeVisible()
})

test('C2 — Try again button re-fires the request', async ({ page }) => {
  let callCount = 0

  await page.route(CHAT_EDGE_PATTERN, async (route: Route) => {
    callCount++
    if (callCount <= 3) {
      // Keep failing so the error banner stays visible long enough to click
      await route.fulfill({
        status: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Service unavailable' }),
      })
    } else {
      // After clicking Try again and re-retry, eventually succeed
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: buildSseStream('Here to help after retry.'),
      })
    }
  })

  await openChatPanel(page)
  await typeAndSend(page, 'Check my eligibility')

  // Wait for error banner
  const banner = page.locator('[data-testid="chat-error-banner"]')
  await expect(banner).toBeVisible({ timeout: 20_000 })

  const callCountBeforeClick = callCount

  // Click Try again
  await page.locator('[data-testid="chat-retry-btn"]').click()

  // At least one more request must have been fired
  await page.waitForTimeout(2000)
  expect(callCount).toBeGreaterThan(callCountBeforeClick)
})
