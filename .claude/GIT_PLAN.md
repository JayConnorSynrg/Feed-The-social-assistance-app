# GIT_PLAN.md
## Purpose
Tracks all git operations to ensure GATE 8 compliance. All git ops must be pre-registered here before execution by the SYNRG orchestrator.

## Entry Format
Each entry is a YAML block:
```yaml
id: <kebab-case-action-id>
status: pending | in_progress | complete | superseded
type: commit | branch | merge | push | tag
description: <what this does>
branch: <branch name>
files: [<list of files>]
created_at: <ISO timestamp>
completed_at: <ISO timestamp or null>
```

## Next Action
next_action_id: deploy-develop-launch-hardening

## Log

```yaml
id: deploy-develop-launch-hardening
status: in_progress
type: push
description: "push develop -> origin (27 commits: launch-hardening + federation edge migration + P7-T11) to trigger Vercel production deploy"
branch: develop
remote: origin
created_at: 2026-05-31T00:00:00.000Z
completed_at: null
```

```yaml
id: p7t11-auth-e2e-onboarding-setup-fix
status: complete
type: commit
description: "test(e2e): set onboarded precondition for login/reset auth flows (P7-T11). Flow 2 + Flow 3 beforeAll: after admin.auth.admin.createUser(), capture the returned user.id and UPDATE profiles SET onboarding_completed=true WHERE id=<userId>. Fixes proxy redirect to /onboarding that caused both flows to fail the / assertion. App/auth code is unchanged — test-setup only."
branch: develop
files:
  - apps/web/e2e/auth.spec.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-31T00:00:00.000Z
completed_at: null
```

```yaml
id: wave4b-syncstatus-fix
status: complete
type: commit
description: "fix(federation): sync_log status must be 'success' not 'completed' (DB constraint). Constraint on federation_sync_log.sync_status CHECK IN ('success','partial','failed'). Three invalid values fixed: (1) federation-inbox/index.ts:344 'completed'→'success'; (2) federation-sync/index.ts:177 'in_progress'→'partial' (initial insert sentinel); (3) federation-sync/index.ts:289 'error'→'failed'. Admin UI corrected to match: federation/sync/page.tsx:119 'in_progress'→'partial', :120 'error'→'failed'. deno check federation-inbox: clean. federation-inbox redeployed to ndtpovonpadugthmcntl (version 2, ACTIVE). tsc 0 errors (4/4 packages)."
branch: feature/launch-hardening
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-harden
files:
  - supabase/functions/federation-inbox/index.ts
  - supabase/functions/federation-sync/index.ts
  - apps/web/src/app/(admin)/federation/sync/page.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T03:47:00.000Z
completed_at: 2026-05-30T03:47:00.000Z
```

```yaml
id: wave3-edge-migration
status: complete
type: commit
description: "feat(federation): Wave 3 — inbound edge fns (resources/inbox) + thin Next proxies, service_role off Next runtime. FED3: supabase/functions/federation-resources/index.ts (cavage verify via x-original-host+x-original-target, trust-level gate, paged+single-resource collection, last_seen_at update); supabase/functions/federation-inbox/index.ts (HMAC-SHA256 verify, timestamp replay window, upsert/delete federated_resources, federation_sync_log insert); supabase/functions/_shared/federation-db.ts (serviceClient + CORS helpers). FED4: apps/web/src/app/api/federation/resources/route.ts + [id]/route.ts + webhook/route.ts → thin proxies (no SERVICE_ROLE, forward Signature/HMAC headers + x-original-host + x-original-target, 30s timeout). FED5: supabase/config.toml (verify_jwt=false for 5 federation fns). FED6: Tier-0 rate-limit note in edge fns + docs/federation.md (Upstash Redis upgrade path). Gate: tsc 0, build PASS, npm test 52 vitest + node:test green, deno check both edge fns clean, grep SERVICE_ROLE in proxy routes = 0 runtime refs."
branch: feature/launch-hardening
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-harden
files:
  - supabase/functions/_shared/federation-db.ts
  - supabase/functions/federation-resources/index.ts
  - supabase/functions/federation-inbox/index.ts
  - apps/web/src/app/api/federation/resources/route.ts
  - apps/web/src/app/api/federation/resources/[id]/route.ts
  - apps/web/src/app/api/federation/webhook/route.ts
  - supabase/config.toml
  - docs/federation.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T00:00:00.000Z
completed_at: 2026-05-30T00:00:00.000Z
```

```yaml
id: wave2-federation-foundation
status: complete
type: commit
description: "Wave 2 — align edge signer to cavage Signature scheme + single-resource route. FED1: (1) fix false RFC 9421 label in packages/shared/lib/http-signatures.ts (was cavage all along); (2) create supabase/functions/_shared/http-signatures.ts — Deno/WebCrypto signer byte-identical to Next verifier (same draft-cavage signing string, RSASSA-PKCS1-v1_5/SHA-256, base64 Signature header); (3) fix federation-sync/index.ts: replace X-Federation-Signature:<ts>:<hex> bespoke scheme with cavage Signature+Host+Date headers via _shared signer; (4) parity test apps/web/src/lib/__tests__/federation-signature-parity.test.mjs — 5 tests all pass (GET round-trip, POST+body round-trip, tampered sig rejected, wrong key rejected, signing-string reconstruction). FED2: create apps/web/src/app/api/federation/resources/[id]/route.ts — single-resource GET gated by withFederationAuth+requireTrustLevel 'pending', 404-safe, mirrors collection route auth/service_role/CORS. Gate: tsc 0, build PASS (route visible in build output), npm test 35/35 node:test + 52 vitest all green."
branch: feature/launch-hardening
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-harden
files:
  - packages/shared/lib/http-signatures.ts
  - supabase/functions/_shared/http-signatures.ts
  - supabase/functions/federation-sync/index.ts
  - apps/web/src/app/api/federation/resources/[id]/route.ts
  - apps/web/src/lib/__tests__/federation-signature-parity.test.mjs
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T00:00:00.000Z
completed_at: 2026-05-30T00:00:00.000Z
```

```yaml
>>>>>>> feature/launch-hardening
id: wave1-present-gaps
status: complete
type: branch
description: "Wave 1 launch-hardening — 6 present-gap fixes: F1 smoke-tests repoint middleware→proxy assertions, F5 eslint no-restricted-syntax glob extends to *.ts/proxy.ts/middleware/**/*.ts, F7 observability.md metric catalog full sync, F4 schema_migrations repair for two untracked prod migrations (20260529000003+20260529000004), F6 proxy.ts lightweight auth-path logging (logger, additive), F8 route raw console.logs through logger / drop debug ones. Gate: tsc 0, build PASS, npm test green, lint no new violations."
branch: feature/launch-hardening
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-harden
files:
  - apps/web/src/__tests__/smoke-tests.ts
  - apps/web/eslint.config.mjs
  - docs/observability.md
  - apps/web/src/proxy.ts
  - apps/web/src/components/panels/programs-panel.tsx
  - apps/web/src/components/forms/form-wizard.tsx
  - apps/web/src/components/forms/pdf-annotator.tsx
  - apps/web/src/contexts/vault-context.tsx
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/app/(admin)/federation/sync/page.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T00:00:00.000Z
completed_at: 2026-05-30T21:36:00.000Z
```

```yaml
id: fix-vitest-build
status: complete
type: commit
description: "Fix build regression: vitest.config.ts pulled into Next.js TypeScript checker via **/*.ts glob in tsconfig include — production build fails when vitest not installed. Root cause: BOTH stale node_modules (npm install not run after Phase D added vitest) AND vitest.config.ts not excluded from tsconfig. Fix: (1) npm install to bring vitest in, (2) add vitest.config.ts + **/*.test.ts + **/*.test.tsx to tsconfig exclude list so production build never depends on test tooling. Forced build PASS, tsc 0, npm test 38/14-todo vitest + 30 node:test all green."
branch: develop
remote: origin
files:
  - apps/web/tsconfig.json
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T20:10:00.000Z
completed_at: 2026-05-29T20:10:00.000Z
```


```yaml
id: proxy-rename
status: complete
type: branch
description: "Mechanical Next.js 16 convention rename: middleware.ts→proxy.ts, exported function middleware→proxy. Single-line diff (function signature only). Build PASS (no deprecation warning, output shows 'ƒ Proxy (Middleware)'), tsc 0 errors, vault-form-flow 9/9."
branch: feature/proxy-rename
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-proxy
files:
  - apps/web/src/proxy.ts
  - apps/web/src/middleware.ts (RENAMED → proxy.ts)
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T00:00:00.000Z
completed_at: 2026-05-29T00:00:00.000Z
```

```yaml
id: phaseG-truthup
status: complete
type: commit
description: "Phase G — correct drifted spec/state docs to reflect session reality. .phase-state.json: lastUpdated→2026-05-29T23:59:00Z; Phase 7 notes expanded with all 2026-05-29 session repairs (Phase 3 encryption/vault-crypto/doc-encryption/Phase 5-6 doc-upload); session-010 entry added. ralph-loop-checklist.md: last_updated frontmatter→2026-05-29; Overall Progress 86/98 88%→96/98 98%; P3-T16/P4-T11/P5-T12 NOT_STARTED→DEFERRED; P6-T8 IN_PROGRESS→SUPERSEDED; Phase 3 exit criteria checked + repair note added; Phase 5 exit criteria checked + repair note added. Memory vault (non-git): 3 new pattern/feedback files written + MEMORY.md pointers."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - specs/001-feed-platform/.phase-state.json
  - specs/001-feed-platform/ralph-loop-checklist.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T23:59:00.000Z
completed_at: 2026-05-29T23:59:00.000Z
```

```yaml
id: profile-location-reactivity
status: complete
type: branch
description: "Fix Map/Programs profile-reactivity race. Map: replace shared hasAutocentered (pre-empted by browser-geo before profile loads) with userHasMovedMap (set only on onDragStart/onZoomStart via new MapView.onUserInteraction prop) + separate hasGeocentered. Profile Priority 1a (lat/lng) and 1b (geocode city/state) now fire reactively on profile arrival and override browser-geo for initial center. Manual pans permanently respected. Programs: seed effect already reactive — no change. tsc 0, build pass, merged PR #19 into develop."
branch: feature/profile-location-reactivity
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-nav-nest
files:
  - apps/web/src/components/panels/map-panel.tsx
  - apps/web/src/components/map/map-view.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T00:00:00.000Z
completed_at: 2026-05-30T00:00:00.000Z
```

```yaml
id: phaseB-auth-e2e-harness
status: complete
type: commit
description: "Phase B — P7-T11 auth E2E test harness: playwright.config.ts (baseURL :3000, webServer npm run dev, chromium), apps/web/e2e/auth.spec.ts covering email-signup→onboarding, email/password login + wrong-pw error, password-reset via token_hash, Google OAuth redirect assertion. Admin client for setup/teardown (SERVICE_ROLE_KEY). Wire test:e2e in apps/web/package.json. 3 of 4 flows fully automated; Google consent-screen click is the 1 documented manual step."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - playwright.config.ts
  - apps/web/e2e/auth.spec.ts
  - apps/web/package.json
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T23:45:00.000Z
completed_at: 2026-05-29T23:59:00.000Z
```

```yaml
id: phaseF2-build-determinism-indexes
status: complete
type: commit
description: "Phase F2 — make build network-deterministic (drop Geist fonts dead code from layout.tsx; build no longer fetches fonts.gstatic.com) + drop redundant DB indexes (duplicate created_at/user_id on posts, duplicate username index on profiles keeping UNIQUE constraint, low-value status index on resources). Migration supabase/migrations/<timestamp>_drop_redundant_indexes.sql. tsc 0, build PASS (deterministic), npm test green, vault-form-flow 9/9."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/src/app/layout.tsx
  - supabase/migrations/20260529000004_drop_redundant_indexes.sql
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T23:00:00.000Z
completed_at: 2026-05-29T23:30:00.000Z
```

```yaml
id: phaseF1-observability
status: complete
type: commit
description: "Phase F1 — weave withMetric into 6 live hot paths (vault.unlock, documents.upload, programs.query, feed.load, messages.send, forms.draft, forms.submit). Remove redundant manual Date.now() timing + duplicate logger.info from programs.query. Create docs/observability.md metric catalog. Additive only: zero control-flow change, zero regression. tsc 0, node:test 30/30 pass, vitest 38/14-todo pass, vault-form-flow smoke 9/9."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/src/contexts/vault-context.tsx
  - apps/web/src/hooks/use-documents.ts
  - apps/web/src/hooks/use-program-browser.ts
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/hooks/use-conversations.ts
  - apps/web/src/hooks/use-vault-form-submission.ts
  - docs/observability.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T19:00:00.000Z
completed_at: null
```

```yaml
id: phaseD-test-infra
status: complete
type: commit
description: "Phase D — Wire npm test: vitest for 3 security .ts tests (mfa.test.ts, vault.test.ts, document-encryption.test.ts) + node:test for .mjs tests, unify turbo test task, drop build dependency. Install vitest + vitest.config.ts in apps/web. Fix any test drift vs current source. npm test → all camps, all green, non-zero count. Real bugs flagged: (1) wrapDEK('raw', non-extractable-dek) broken (crypto.ts:359); (2) decryptFileChunked reads CHUNK_SIZE-aligned slices but encrypted chunks are CHUNK_SIZE+16 (document-encryption.ts:282). Before: 0 tests. After: 61 active (30 .mjs + 31 .ts), 7 skipped (real-bug flags), 14 todo."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/package.json
  - apps/web/vitest.config.ts
  - apps/web/src/lib/__tests__/mfa.test.ts
  - apps/web/src/lib/__tests__/vault.test.ts
  - apps/web/src/lib/__tests__/document-encryption.test.ts
  - turbo.json
  - package-lock.json
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T22:00:00.000Z
completed_at: 2026-05-29T22:30:00.000Z
```


```yaml
id: phaseC-types-casts-lintguard
status: complete
type: commit
description: "Phase C — (1) Regenerate Supabase types from live project (37→41 tables; adds saved_resources, saved_resource_tasks, saved_resource_events, saved_resource_documents). (2) Remove all 51 (supabase as any) casts: 49 removed cleanly, 2 documented dynamic-table casts remain in query-utils.ts with eslint-disable comments. Real bugs exposed and fixed: use-documents.ts queried uploaded_at (nonexistent, fixed to created_at), file_type (nonexistent, fixed to document_type), application_id (nonexistent, fixed to submission_id); use-form-templates.ts queried nonexistent category/agency columns (fixed to form_type/agency_name). (3) Add no-restricted-syntax lint guard in eslint.config.mjs targeting (supabase as any) pattern in hooks/components/lib/app dirs. tsc 0 errors, build pass, smoke 9/9."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - packages/database/types.ts
  - apps/web/src/hooks/use-resource-detail.ts
  - apps/web/src/hooks/use-conversations.ts
  - apps/web/src/hooks/use-notifications.ts
  - apps/web/src/hooks/use-form-templates.ts
  - apps/web/src/hooks/use-volunteer-resource.ts
  - apps/web/src/hooks/use-documents.ts
  - apps/web/src/hooks/use-viewport-resources.ts
  - apps/web/src/lib/query-utils.ts
  - apps/web/src/components/panels/forms-panel.tsx
  - apps/web/src/app/(admin)/moderation/moderation-queue.tsx
  - apps/web/src/components/documents/document-viewer.tsx
  - apps/web/src/components/documents/resource-detail-dialog.tsx
  - apps/web/eslint.config.mjs
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T21:00:00.000Z
completed_at: 2026-05-29T21:45:00.000Z
```


```yaml
id: phaseA-vault-migration
status: complete
type: branch
description: "Phase A — vault encryption migration launch blockers: (1) DB migration form_data nullable (zero-knowledge encrypted path), (2) add useUserSubmissions to use-vault-form-submission.ts with decrypt path, (3) swap useFormSubmission→useVaultFormSubmission + useSecureProfile→useVaultSecureProfile in form-wizard.tsx, (4) relax VaultGuard to show setup/unlock modal for !isUnlocked (not only isSetup&&!isUnlocked), (5) swap imports in forms-panel.tsx + wrap FormWizard in VaultGuard. tsc 0, build pass, node:test smoke pass."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - supabase/migrations/<timestamp>_form_data_nullable.sql
  - apps/web/src/hooks/use-vault-form-submission.ts
  - apps/web/src/components/forms/form-wizard.tsx
  - apps/web/src/components/vault/vault-guard.tsx
  - apps/web/src/components/panels/forms-panel.tsx
  - apps/web/src/components/forms/__tests__/vault-form-flow.test.mjs
created_at: 2026-05-29T18:00:00.000Z
completed_at: 2026-05-29T18:30:00.000Z
```



```yaml
id: phase5-logging-extension
status: in_progress
type: branch
description: "Phase 5 — extend withMetric optimization-logging to remaining hot paths (vault unlock, documents upload, programs query, feed load, messages send) + docs/observability.md. Additive only (preserve all control flow), tsc+build gated. ISOLATED WORKTREE (FEED-obs) to avoid conflict with kiosk-session docs in main tree + nav-nest worktree. Orchestrator owns GIT_PLAN; agent never touches it."
branch: feature/phase5-logging-extension
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-obs
created_at: 2026-05-29T15:15:00.000Z
completed_at: null
```

```yaml
id: apply-resources-browse-index
status: complete
type: db-apply
description: "Apply 20260529000002 to prod (ndtpovonpadugthmcntl). BLOCKED on user DB password. Apply via `SUPABASE_DB_PASSWORD=<pw> npx supabase db push --linked --yes` OR Supabase SQL editor + `supabase migration repair --status applied 20260529000002 --linked`. Capture EXPLAIN ANALYZE before/after to confirm Seq Scan → Index Scan."
branch: develop
remote: origin
created_at: 2026-05-29T11:50:00.000Z
completed_at: null
```

```yaml
id: phase4-resources-browse-index
status: complete
type: commit
description: "Phase 4 — author migration for idx_resources_browse partial composite index (state,category,name) WHERE status=approved AND source=admin_added AND is_volunteer_resource=false. Fixes confirmed Seq Scan on programs browse path (19057 rows → ~99-row partial). CONCURRENTLY, zero-downtime. Empirically-audited: the ONLY justified index gap."
branch: develop
remote: origin
created_at: 2026-05-29T11:40:00.000Z
completed_at: null
```

```yaml
id: merge-push-phase3
status: complete
type: merge
description: "Merge feature/phase3-observability-resilience to develop + push. withMetric seed, map/chat metrics, vault safety-valve, Programs stale-closure fix (completes objective #2), programs telemetry hygiene. tsc 0, build pass, node:test 3/3."
branch: develop
remote: origin
created_at: 2026-05-29T11:20:00.000Z
completed_at: 2026-05-29T11:20:00.000Z
```

```yaml
id: item2-federation-defer
status: complete
type: commit
description: "Record deferral of federation service-role→edge migration. Federation is dormant: 0 real peers, 0 federated_resources, 0 sync_log entries. service_role key is server-only (not client-exposed). Logic already duplicated in supabase/functions/federation-*. Change: comment-only sharpening at 4 sites (resources/route.ts L153, webhook/route.ts L234+L357, verify-federation.ts L68). Trigger to action: federation_peers > 0. Zero logic/behavior change; tsc 0, build pass confirmed."
branch: develop
remote: origin
files:
  - apps/web/src/app/api/federation/resources/route.ts
  - apps/web/src/app/api/federation/webhook/route.ts
  - apps/web/src/lib/federation/verify-federation.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T00:00:00.000Z
completed_at: 2026-05-29T00:00:00.000Z
```

```yaml
id: phase3-observability-resilience
status: complete
type: branch
description: "Phase 3 — withMetric optimization-logging seed (logger+track, normalize duration_ms) + instrument map RPC & chat TTFB (close prod-blind) + vault-context safety-valve + Programs default-state select desync fix + programs error/console cleanup. node:test smokes; tsc+build gated."
branch: feature/phase3-observability-resilience
base: develop
remote: origin
created_at: 2026-05-29T11:00:00.000Z
completed_at: null
```

```yaml
id: merge-push-phase2
status: complete
type: merge
description: "Merge feature/phase2-programs-tiles-fab to develop (--no-ff) + push — ships 2A state normalization, 2B tile address+distance, 2C map-only FAB. Validated: tsc 0, build pass, node:test 13/13."
branch: develop
remote: origin
created_at: 2026-05-29T10:30:00.000Z
completed_at: 2026-05-29T10:30:00.000Z
```

```yaml
id: phase2-programs-tiles-fab
status: complete
type: branch
description: "Phase 2 — 2A state normalization (us-states.ts util + dedup 3x US_STATES + normalize read/write paths, fixes empty Programs + state default), 2B resource-tile address+distance, 2C volunteer FAB map-only bottom-right. node:test smokes; tsc+build gated."
branch: feature/phase2-programs-tiles-fab
base: develop
remote: origin
created_at: 2026-05-29T10:05:00.000Z
completed_at: null
```

```yaml
id: merge-push-phase1
status: complete
type: merge
description: "Merge feature/map-fix-observability-phase1 to develop (--no-ff) and push to origin — ships Phase 1 live via Vercel auto-deploy"
branch: develop
remote: origin
created_at: 2026-05-29T09:10:00.000Z
completed_at: 2026-05-29T09:10:00.000Z
```

```yaml
id: phase1-map-fix-observability
status: complete
type: branch
description: "Phase 1 feature branch — resources abortSignal+finally-guard fix, observability (Vercel RUM + logger wiring + global-error), MapPanel next/dynamic (-548KB), safe dead-code deletion (dashboard/, test-data/, supabase/index.ts). Demo routes EXCLUDED per user."
branch: feature/map-fix-observability-phase1
base: develop
remote: origin
files:
  - apps/web/src/hooks/use-viewport-resources.ts
  - apps/web/src/hooks/use-realtime-feed.ts
  - apps/web/src/hooks/use-documents.ts
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/global-error.tsx
  - apps/web/src/app/page.tsx
  - apps/web/package.json
  - apps/web/src/components/dashboard/ (DELETE)
  - apps/web/src/lib/test-data/ (DELETE)
  - apps/web/src/lib/supabase/index.ts (DELETE)
created_at: 2026-05-29T09:00:00.000Z
completed_at: null
```

```yaml
id: push-develop-map-singleton-fix
status: complete
type: push
description: Push develop to origin — ships a5f662f (Supabase singleton fix) to trigger Vercel redeploy
branch: develop
remote: origin
created_at: 2026-05-29T08:35:00.000Z
completed_at: 2026-05-29T08:35:00.000Z
```

```yaml
id: commit-map-singleton-fix
status: complete
type: commit
description: Singleton browser Supabase client — stops infinite refetch loop that left map "Loading resources..." spinner stuck on
branch: develop
files:
  - apps/web/src/lib/supabase/client.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T08:30:00.000Z
completed_at: 2026-05-29T08:30:00.000Z
```

```yaml
id: push-develop-001
status: superseded
type: push
description: Push develop to origin after vercel.json fix — all session work (fleet agents, structured logging, vercel build fix)
branch: develop
remote: origin
scope: "All session work: fleet agents, structured logging, vercel.json fix"
created_at: 2026-05-28T00:00:00.000Z
completed_at: null
```

```yaml
id: fleet-agents-and-fixes
status: in_progress
type: commit
description: Add 10 fleet agents, fix panels/index.tsx exports, reconcile checklist Phase 1/2 marks, add Phase 8 stub
branch: feature/fleet-agents-and-fixes
files:
  - apps/web/src/components/panels/index.tsx
  - specs/001-feed-platform/ralph-loop-checklist.md
  - .claude/agents/feed-api-debugger.md
  - .claude/agents/feed-auth-debugger.md
  - .claude/agents/feed-data-flow-analyzer.md
  - .claude/agents/feed-documents-expert.md
  - .claude/agents/feed-forms-expert.md
  - .claude/agents/feed-map-debugger.md
  - .claude/agents/feed-realtime-monitor.md
  - .claude/agents/feed-smoke-runner.md
  - .claude/agents/feed-supabase-validator.md
  - .claude/agents/feed-vault-expert.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-28T00:00:00.000Z
completed_at: null
```

```yaml
id: phaseE-deadcode-deletion
status: complete
type: commit
description: "Phase E — delete dead/orphaned code in dependency order (4 batches). Batch 1: secure-profile-form.tsx, profile-form.tsx, resource-form.tsx, dynamic-form-renderer.tsx, autofill-banner.tsx, signature-canvas.tsx, use-form-signature.tsx, test-key-store.ts, key-store-diagnostics.ts, database.types.ts. Batch 2: use-form-submission.ts, use-secure-profile.ts. Batch 3: form-field-mapper.ts, secure-profile.ts. Batch 4: deriveKeyFromPassword RETAINED (internal callers at L253/L291 in crypto.ts). tsc 0 errors after each batch. Build failure pre-existing (Supabase env vars, digest 2417864637, same on base commit)."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/src/components/forms/secure-profile-form.tsx (DELETED)
  - apps/web/src/components/profile/profile-form.tsx (DELETED)
  - apps/web/src/components/resources/resource-form.tsx (DELETED)
  - apps/web/src/components/forms/dynamic-form-renderer.tsx (DELETED)
  - apps/web/src/components/forms/autofill-banner.tsx (DELETED)
  - apps/web/src/components/forms/signature-canvas.tsx (DELETED)
  - apps/web/src/hooks/use-form-signature.tsx (DELETED)
  - apps/web/src/lib/utils/test-key-store.ts (DELETED)
  - apps/web/src/lib/utils/key-store-diagnostics.ts (DELETED)
  - apps/web/src/lib/database.types.ts (DELETED)
  - apps/web/src/hooks/use-form-submission.ts (DELETED)
  - apps/web/src/hooks/use-secure-profile.ts (DELETED)
  - apps/web/src/lib/form-field-mapper.ts (DELETED)
  - apps/web/src/lib/secure-profile.ts (DELETED)
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T20:00:00.000Z
completed_at: 2026-05-29T20:30:00.000Z
```

```yaml
id: phaseA2-vault-crypto-fix
status: complete
type: commit
description: "Phase A2 — fix two real crypto bugs exposed by newly-wired security tests. BUG 1 (CRITICAL): generateDEK() returned non-extractable CryptoKey; wrapDEK called wrapKey('raw') which requires extractable:true — always threw InvalidAccessException, making vault setup/unlock/rotateKEK non-functional. Fix: envelope pattern — generateDEK now returns { key: CryptoKey (non-extractable); rawBytes: Uint8Array }; wrapDEK takes raw bytes, AES-GCM-encrypts them with KEK; unwrapDEK AES-GCM-decrypts then importKey(non-extractable); rotateKEK decrypts envelope, re-encrypts with new KEK. deriveKEK usages changed from wrapKey/unwrapKey to encrypt/decrypt. In-use DEK stays non-extractable (XSS protection preserved). BUG 2 (HIGH): decryptFileChunked stepped by CHUNK_SIZE (1MB) through encrypted buffer but each encrypted chunk is CHUNK_SIZE+16 bytes; fix steps by ENCRYPTED_CHUNK_SIZE=CHUNK_SIZE+GCM_TAG_BYTES. All 7 previously-skipped tests now pass; full suite green (30 node:test + 52 vitest); vault-form-flow 9/9; type-check 0 errors; build PASS."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/src/lib/crypto.ts
  - apps/web/src/lib/vault.ts
  - apps/web/src/lib/document-encryption.ts
  - apps/web/src/lib/__tests__/vault.test.ts
  - apps/web/src/lib/__tests__/document-encryption.test.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T18:45:00.000Z
completed_at: 2026-05-29T18:55:00.000Z
```
