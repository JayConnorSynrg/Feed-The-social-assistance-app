# MISSION 20 — Federation (FEED-to-FEED ActivityPub-style)   | owner: feed-federation-expert | tier: P2
> One-line: a peered FEED instance's resource changes propagate into this instance's `federated_resources` (and vice-versa) over HMAC/cavage-signed webhooks, while the health probe keeps each peer's trust score current — with the current expected prod state being **zero peers** (service_role→edge migration deferred until `federation_peers > 0`).

## 1. Backend surface
- RPCs (all in `supabase/migrations/20260214000000_federation_webhooks.sql` family):
  - `calculate_trust_score(instance_id)` — derive 0..1 trust from health history — SECDEF — migration `20260214000000_federation_webhooks.sql`
  - `trust_score_to_level(score)` — map score → `untrusted|pending|trusted|verified|core` — SECDEF
  - `notify_federation_webhook(instance_id, payload)` — enqueue outbound notify — SECDEF
  - `get_webhook_stats / get_recent_webhook_failures / get_stale_federated_resources / cleanup_old_webhook_logs / get_instance_uptime` — admin/ops read + maintenance helpers
  - NOTE: `20260610200000_federation_webhook_null_guard.sql` hardens a null-guard in the webhook path — verify it is applied.
- Edge functions (Deno; all `verify_jwt = false` per `supabase/config.toml:63-76` — auth is HMAC/cavage in-code, not the gateway):
  - `federation-health-check` — cron (every 5 min) — polls each peer `${instance_url}/.well-known/feed-instance`, records `federation_health_checks`, adjusts `federation_peers.trust_score`, logs `federation_trust_events` — `supabase/functions/federation-health-check/index.ts:78` (handler), `:220` (`performHealthCheck`), `:285` (`calculateTrustAdjustment`)
  - `federation-webhook` — service/cron-triggered OUTBOUND delivery — signs payload `X-Federation-Signature: sha256=<hex>` (HMAC key = `FEDERATION_PRIVATE_KEY[:64]`), delivers to each peer `metadata.webhook_url` with retry/backoff — `supabase/functions/federation-webhook/index.ts:114` (`generateSignature`), `:147` (`deliverWebhook`), `:339` (peer fetch), `:358` (zero-peer early return)
  - `federation-inbox` — webhook INBOUND (target of the Next proxy) — HMAC-verifies raw body (constant-time, `:38`), validates payload (UUID + 5-min freshness, `:96`), then cavage-signed GET back to partner to fetch the resource and `upsert federated_resources` — `supabase/functions/federation-inbox/index.ts:146` (handler), `:65` (`verifyHmac`), `:269` (upsert), `:303` (delete)
  - `federation-sync` — cron + manual — pulls remote `/api/federation/resources` with a cavage-signed GET, upserts `federated_resources` — `supabase/functions/federation-sync/index.ts:1-80`
  - `federation-resources` — browser-invoked federated search across `federated_resources` — `supabase/functions/federation-resources/index.ts`
- Shared signer: `supabase/functions/_shared/http-signatures.ts:89` (`signRequest`, RSASSA-PKCS1-v1_5/SHA-256 draft-cavage, byte-identical to the Next verifier); HMAC scheme is separate (header doc `:21-25`). `_shared/federation-db.ts` provides `serviceClient`, `withCors`, `corsPreflightResponse`.
- Tables: `federated_instances` (peers + `is_local=true` self row, holds `public_key`, `status`), `federation_peers` (trust_score/level, `federation_enabled`, `auto_sync_enabled`, `metadata.webhook_url`), `federated_resources` (mirrored remote rows, unique `(source_instance_id, source_resource_id)`), `federation_health_checks`, `federation_sync_log`, `federation_trust_events` (RLS; `created_by` written as `'system'`).

## 2. User-facing surfaces + interaction points
- Admin `(admin)/federation/page.tsx` — interaction points: add/list peer instances, toggle `federation_enabled`/`auto_sync_enabled`, manual "Sync" + "Refresh" (RefreshCw icon), trust-level badge display
- Admin sub-pages: `(admin)/federation/dashboard`, `/sync`, `/sync-config`, `/conflicts`, `/discover`, `/search-analytics`
- Public `federation/directory/page.tsx` — browse this instance's federated resources
- Next.js API routes (server-side bridges): `app/api/federation/webhook/route.ts` (thin proxy → `federation-inbox`, no service_role; forwards `X-Federation-Signature`/`X-Federation-Event`, `:43`), `app/api/federation/resources/route.ts` + `[id]/route.ts`, `app/api/federation/instance/route.ts`
- Inbound verification lib (Next runtime): `apps/web/src/lib/federation/verify-federation.ts:60` (`verifyFederationRequest`, cavage verify), `:216` (`withFederationAuth` HOC)

## 3. Backend→Surface binding map
- Admin federation page mount → `supabase.from('federated_instances').select(...)` + `federation_peers` ((admin)/federation/page.tsx)
- Admin "Sync" button → `functions.invoke('federation-sync', { body: { instance_id } })`
- Public federated search → `functions.invoke('federation-resources', { body: { query } })`
- Inbound peer webhook → POST `app/api/federation/webhook/route.ts:43` → fetch `EDGE_FN_URL` (federation-inbox) → HMAC verify (`federation-inbox/index.ts:183`) → `federated_resources` upsert (`:269`) / delete (`:303`) → `federation_sync_log` insert (`:342`)
- Outbound change notify → `federation-webhook/index.ts:339` selects `federation_peers WHERE federation_enabled` → `deliverWebhook` to each `metadata.webhook_url`
- Cron health (every 5 min) → `federation-health-check/index.ts:230` GET `${instance_url}/.well-known/feed-instance` → upsert `federation_health_checks` (`:143`) → update `federation_peers.trust_score` (`:159`) → `federation_trust_events` (`:166`)
- Trust score → `rpc('calculate_trust_score', { instance_id })` → `rpc('trust_score_to_level', { score })`

## 4. Dependencies
- upstream (this feature needs): secrets `FEDERATION_PRIVATE_KEY`, `FEDERATION_INSTANCE_ID`, `FEDERATION_INSTANCE_URL`, `APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`; `federated_instances` row with `is_local=true`; a peer row in `federated_instances` + `federation_peers` with a valid `public_key`; pg_cron schedule pointing at `federation-health-check`; `FEDERATION_INBOX_EDGE_URL` (proxy target)
- downstream (depend on this): Resource Map / federated directory (Mission 4 surfaces federated resources), admin federation dashboards, trust-gated inbound resource visibility

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "verify_jwt" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/config.toml"` → expected: `federation-inbox/-sync/-webhook/-health-check/-resources` all `verify_jwt = false` (config.toml:63-76)
- [ ] `grep -n "constantTimeEqual\|verifyHmac\|substring(0, 64)" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/federation-inbox/index.ts"` → expected: constant-time HMAC compare (`:38`), HMAC key = `privateKey.substring(0,64)` (`:182`)
- [ ] `grep -n "MAX_TIMESTAMP_AGE_MS\|UUID_PATTERN\|instance.status !== 'active'\|instance_url !== payload.instance_url" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/federation-inbox/index.ts"` → expected: 5-min replay window (`:83`), UUID validation (`:84`), active-status gate (`:201`), URL-match gate (`:205`)
- [ ] `grep -n "RSASSA-PKCS1-v1_5\|(request-target)\|(expires)" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/_shared/http-signatures.ts"` → expected: cavage signing string built with `(request-target)/host/date/(created)/(expires)` (`:102-108`, `:138`)
- [ ] `grep -n "SUPABASE_SERVICE_ROLE_KEY\|service_role" "/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/src/app/api/federation/webhook/route.ts"` → expected: NONE — proxy holds no service_role (privileged logic only in the edge fn; deferral note in `verify-federation.ts:64-72`)
- [ ] `grep -n "federation_enabled\|metadata?.webhook_url\|peers.length === 0" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/federation-webhook/index.ts"` → expected: peers filtered on `federation_enabled` (`:352`) + `metadata.webhook_url` (`:380`); zero-peer path returns `deliveries.total:0` (`:358`)
- [ ] `grep -n "feed-instance\|DEGRADED_THRESHOLD_MS\|calculateTrustAdjustment" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/federation-health-check/index.ts"` → expected: probes `/.well-known/feed-instance` (`:222`), degraded > 3000ms (`:69`), trust deltas (`:73-76`)

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Prod SQL (read-only): `SELECT count(*) FROM federation_peers;` and `SELECT count(*) FROM federated_resources;` and `SELECT count(*) FROM federation_sync_log;` → expected (current state): all `0` — confirms federation is dormant; **0 peers is PASS for the current decision-state** (no live cross-instance flow to assert)
- [ ] Prod SQL: `SELECT id, instance_url, is_local, status FROM federated_instances WHERE is_local = true;` → expected: exactly one local row (or zero if self-registration deferred — note which)
- [ ] Prod SQL: `SELECT jobname, schedule, command FROM cron.job WHERE command ILIKE '%federation-health-check%';` → expected: a `*/5 * * * *` schedule present, OR explicitly absent (health check not yet scheduled while peers=0 — record the finding either way)
- [ ] Safe inbox signature probe (no prod write): POST to `federation-inbox` with a structurally-valid payload and a deliberately WRONG `X-Federation-Signature` → expected: `401 Invalid signature` (HMAC gate rejects before any DB write; safe because rejection is pre-write). Then POST with a stale `timestamp` (>5 min) + any signature → expected: `400 Timestamp too old`. Neither path touches `federated_resources`.
- [ ] Edge logs: `get_logs` for `federation-health-check` → expected: either recent 5-min ticks with `total_checked:0` (peers=0, healthy run) OR no invocations if unscheduled — confirm no recurring 500s
- [ ] (Deferred until peers>0) Full E2E: register a test peer, fire `resource.created` webhook, assert a row appears in `federated_resources` — DO NOT run while peers=0 (no partner to fetch from; the inbox's cavage GET back to partner would fail). Mark as deferred-by-design.

## 6. PASS criteria + residuals
- PASS when: (5a) all static gates hold — `verify_jwt=false` on every federation fn, in-code HMAC + cavage verification present, replay/UUID/status/URL gates present in `federation-inbox`, proxy carries no service_role; AND (5b) `federated_instances` local row consistent, peer/resource/sync counts reflect the dormant state without recurring edge-fn 500s, AND the wrong-signature + stale-timestamp probes return `401`/`400` without writing.
- Known residuals:
  - **Federation is dormant by decision: `federation_peers = 0`** (service_role→edge migration deferred per `verify-federation.ts:64-72`; trigger = first real partner onboarding). Cross-instance resource-flow E2E is deferred-by-design, not a failure.
  - **HMAC key-reuse smell**: outbound/inbound HMAC key is `FEDERATION_PRIVATE_KEY[:64]` (first 64 chars of the RSA private key), documented as a known limitation to address when federation goes live (`_shared/http-signatures.ts:21-25`).
  - `verify-federation.ts` still uses the service_role key inside the Next.js runtime; to be relocated into the edge functions when peers>0.
