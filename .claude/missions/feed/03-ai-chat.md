# MISSION 3 — AI Chat   | owner: feed-chat-expert | tier: P0
> One-line: a user sends a message in the chat panel, an authenticated SSE request reaches the Fireworks-only `chat` edge function, tokens stream back into the panel, guided-flow context is injected when active, and navigation-triggered AbortErrors are treated as success rather than surfaced as failures.

## 1. Backend surface
- Edge functions:
  - `chat` — Fireworks-only AI proxy with privacy-first cascade, SSE streaming, ZDR/no-training compliant — browser-invoked via raw `fetch` — `supabase/functions/chat/index.ts` (cascade declared :20-:73; primary model `qwen3p7-plus` :49, fallback `gpt-oss-120b` :72; both under Fireworks no-training/zero-retention policy :30)
- Tables: none — chat is stateless per-session; messages are not persisted server-side

## 2. User-facing surfaces + interaction points
- ChatPanel (`apps/web/src/components/panels/chat-panel.tsx`) — interaction points: message input, send button, streaming message render, scroll-to-bottom, guided-flow selector
- Hook `apps/web/src/hooks/use-chat.ts` — interaction points: SSE stream consumer, AbortController lifecycle, retry logic
- System prompts (`apps/web/src/lib/ai/system-prompts.ts`) — `SYSTEM_PROMPTS` (:4), flow keys (resource finder :55, eligibility :85, form help :118), `buildPersonalizationLine` (:327), `SystemPromptKey` (:292)
- Guided flows (`apps/web/src/lib/ai/guided-flows.ts`)

## 3. Backend→Surface binding map
- Send message → `use-chat.ts` gets session token then `fetch(${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat)` with Bearer + SSE — token at `apps/web/src/hooks/use-chat.ts:158` (`supabase.auth.getSession()`), URL :175, fetch :220, AbortController :172
- Guided flow active → system prompt selected from `system-prompts.ts` + personalization line injected before the request body is built (`buildPersonalizationLine`, `system-prompts.ts:327`)
- AbortError on navigation → classified as NON-transient intentional cancel (`isTransient` returns false for AbortError, `use-chat.ts:41`) and swallowed as success at the stream catch (`:466`, `:508`) — Next.js fetch-abort pattern
- Edge fn provider selection → Fireworks cascade: 400/transient on primary advances to fallback model (`supabase/functions/chat/index.ts:60-62`)

## 4. Dependencies
- upstream (this feature needs): Mission 1 authenticated session (Bearer token from `getSession()`); `FIREWORKS_API_KEY` secret set on the edge function (required; cascade entries with unset keys are skipped at startup); `chat` deployed `--no-verify-jwt` (gateway "Verify JWT" would 401 before code runs — Invalid-JWT pattern); CSP `connect-src` must allow the functions origin
- downstream (depend on this): none — chat is a leaf feature

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "getSession\|functions/v1/chat\|AbortController\|new Headers\|Bearer" apps/web/src/hooks/use-chat.ts` → expected: token via getSession (:158), chat URL (:175), AbortController (:172), Bearer header on fetch (:220)
- [ ] `grep -n "AbortError\|isTransient\|aborted\|signal" apps/web/src/hooks/use-chat.ts` → expected: AbortError returns false from isTransient (:41) AND is swallowed in stream catch (:466, :508) — proves abort-as-success
- [ ] `grep -n "SYSTEM_PROMPTS\|buildPersonalizationLine\|SystemPromptKey" apps/web/src/lib/ai/system-prompts.ts` → expected: prompt dictionary (:4), personalization builder (:327), key type (:292)
- [ ] `grep -n "FIREWORKS_API_KEY\|qwen3p7\|gpt-oss-120b\|text/event-stream\|cascade\|no-training\|zero-retention" supabase/functions/chat/index.ts` → expected: Fireworks-only cascade, SSE content-type, ZDR policy comments (only Fireworks routes present — no non-Fireworks provider)
- [ ] `grep -rn "connect-src" apps/web/src/proxy.ts` (or CSP config) → expected: functions origin allowed for the chat fetch

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Reuse Mission 1 authenticated-session fixture, then `npx playwright test apps/web/e2e/chat-resilience.spec.ts` → expected: message sends, tokens stream into panel, mid-stream navigation does not surface an error toast
- [ ] `npx playwright test apps/web/e2e/chat-pii-egress.spec.ts` → expected: no PII leaks into the outbound chat payload (ZDR guard)
- [ ] Edge-fn auth + cascade smoke (authed): `curl -i -N -X POST ${SUPABASE_URL}/functions/v1/chat -H "Authorization: Bearer <session_jwt>" -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hi"}]}'` → expected: 200 + `text/event-stream` body that streams tokens. (Cost: one Fireworks inference call — keep prompt tiny; no DB write since chat is stateless.)
- [ ] Edge-fn gateway-bypass check: same curl WITHOUT Authorization header → expected: in-code 401 (NOT a gateway "Invalid JWT" before code runs) — confirms `--no-verify-jwt` deploy + in-code auth
- [ ] Edge-fn logs: `get_logs` for the `chat` function during the probe → expected: cascade selected primary model, no "API key unset" warning for FIREWORKS_API_KEY

## 6. PASS criteria + residuals
- PASS when: an authed message streams tokens into ChatPanel; AbortError on navigation is swallowed as success (no false error); guided-flow system prompt + personalization line are injected when a flow is active; `chat` edge fn returns SSE with a valid Bearer and 401s without one; cascade falls through to `gpt-oss-120b` if primary 400s; chat-resilience + chat-pii-egress specs green.
- Known residuals: streaming UX (scroll-to-bottom) is render-layer — verify visually in the Playwright run. Provider keys are deploy-config: a missing `FIREWORKS_API_KEY` skips the cascade entry at startup, so verify the secret is set before reporting PASS.
