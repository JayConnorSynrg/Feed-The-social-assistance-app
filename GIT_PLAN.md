# GIT PLAN — feature/nav-nest-tabs

## Entry: nav-nest-tabs

**ID:** nav-nest-tabs
**Status:** complete
**Branch:** feature/nav-nest-tabs (worktree at /Users/jelalconnor/CODING/CURSOR/FEED-nav-nest)
**Base:** 67bb9ec (Merge Phase 3)

### Objective

Move the "Forms" sidebar tab inside the Documents panel, and the "Messages" sidebar tab inside the Community Feed panel — as nested sub-tabs. Forms/Messages stop being top-level sidebar entries; they become sub-views of their parent panel, reachable via in-panel tabs AND via preserved deep-link hashes #forms / #messages.

### Files Changed

- `apps/web/src/components/layout/feed-shell.tsx` — alias routing engine, SIDEBAR_ICONS refactor, label rename
- `apps/web/src/components/panels/documents-panel.tsx` — three-tab toggle (My Documents | My Resources | Forms), FormsPanel mount, ARIA tablist, hash mirror
- `apps/web/src/components/panels/feed-panel.tsx` — top tablist (Feed | Messages), MessagesPanel mount, ARIA tablist, hash mirror
- `apps/web/src/app/page.tsx` — remove dead case 'forms' / case 'messages' from PanelRenderer

### Files NOT Changed

- `apps/web/src/components/panels/forms-panel.tsx` — untouched; rendered as child
- `apps/web/src/components/panels/messages-panel.tsx` — untouched; rendered as child
- All caller files (programs-panel.tsx, map-panel.tsx, overview-panel.tsx, chat-panel.tsx) — untouched; alias layer in setActivePanel handles routing transparently

### Key Design Decisions

1. **PANEL_ALIASES map** in feed-shell.tsx routes 'forms' → documents+subtab='forms', 'messages' → feed+subtab='messages'. All callers work zero-edit.
2. **Functional setPanelParams update** preserves existing params (e.g. openConversationId) when alias resolves — uses `(prev) => ({ ...prev, subtab })`.
3. **panelParams.subtab** is the single source of truth for which sub-tab is active; panels read it on mount and sync via useEffect.
4. **history.replaceState** for sub-tab switches inside documents (resources tab); history.pushState for top-level alias resolution — no back-button spam for tab clicks.
5. **Conditional mount** for MessagesPanel in FeedPanel — only mounts when subtab='messages', hooks clean up on unmount.
6. **ARIA APG Tabs** implemented on both tablist components with roving tabindex + ArrowLeft/Right/Home/End keyboard nav.
7. **Logging**: `logger.info('nav.alias.resolve', ...)` on every alias resolution; `logger.info('nav.subtab.switch', ...)` + `track('nav_subtab', ...)` on every in-panel tab click.

### Validation Results

- `npm run type-check` exit 0 (0 errors)
- `npm run build` fails at baseline (pre-existing Turbopack symlink panic in worktree — node_modules symlinks to main repo, Turbopack cannot traverse; confirmed failing before any changes via git stash test)
- grep: no `case 'forms'` / `case 'messages'` in page.tsx
- grep: SIDEBAR_ICONS contains no forms/messages entries
- grep: PANEL_ALIASES defined at line 115 of feed-shell.tsx
- grep: FormsPanel imported in documents-panel.tsx
- grep: MessagesPanel imported in feed-panel.tsx
- git diff: forms-panel.tsx and messages-panel.tsx not listed (unmodified)

---

## Entry: feed-perf-batch1

**ID:** feed-perf-batch1
**Status:** complete
**Branch:** feature/feed-perf-fixes (worktree at /Users/jelalconnor/CODING/CURSOR/FEED-nav-nest)
**Base:** develop

### Objective
Performance + cleanup batch: Vercel RUM gating, memoization, auth-gated realtime, a11y tablists, demo route removal, perf e2e spec.

### Changes
- middleware.ts: add _vercel/ to matcher negative-lookahead; remove /demo from publicRoutes
- demo/page.tsx + demo/social/page.tsx: deleted (git rm)
- applications-panel.tsx: module-level Intl.DateTimeFormat; counts/filteredApplications wrapped in useMemo; as any cast removed; FilterTabs → ARIA tablist with roving tabindex
- feed-shell.tsx: ShellContext Provider value wrapped in useMemo<ShellContextType>
- use-realtime-feed.ts: gated on session !== null via useAuth
- forms-panel.tsx: TabButton ARIA tablist pattern (role=tab/tablist/tabpanel, roving tabindex, arrow keys)
- map-panel.tsx: Map/List toggle → ARIA tablist
- e2e/perf-walkthrough.spec.ts: new authenticated perf spec (excluded from tsconfig)
- tsconfig.json: exclude e2e/** from type-check

### Validation
- type-check: exit 0
- build: exit 0

---

## Entry: onboarding-resilience

**ID:** onboarding-resilience
**Status:** complete
**Branch:** feature/onboarding-resilience (worktree at /Users/jelalconnor/CODING/CURSOR/FEED-nav-nest)
**PR:** #16 — merged into develop @ d2ac0c3
**Commit:** 3ced432

### Objective
Fix the onboarding "stuck at Saving..." bug: upsert hung with no timeout, no error surface, and no escape path. Add client-side log sink so onboarding errors reach app_logs.

### Changes
- `apps/web/src/app/(auth)/onboarding/page.tsx`:
  - Replaced `loading`/`authLoading` button gate with local `submitting` flag; `userIdRef` captures auth once resolved; pending submits fire via effect
  - Wrapped `profiles.upsert` in 10s `AbortController` timeout via `.abortSignal()`; abort/timeout navigates forward; explicit DB errors surface with "Continue anyway" escape hatch
  - Extracted `handleSkip`: separate function with 10s timeout; navigates to `/` unconditionally regardless of write outcome
  - Added structured logging: `onboarding.complete.start`, `.ok`, `.failed`, `.upsert_aborted`, `onboarding.skip.start/.ok`
- `apps/web/src/app/api/client-log/route.ts` (new): POST route; 4KB size cap; level/event validation; context sanitization; service-role insert into app_logs
- `apps/web/src/lib/logger.ts`: `sinkToSupabase` browser path now fires `fetch('/api/client-log', { keepalive: true })` so client warn/error events survive navigation

### Validation
- type-check: exit 0
- build: exit 0 (`/api/client-log` listed in route table)
- Merged PR #16; origin/develop HEAD = d2ac0c3

---

## Entry: geo-outreach-d2b

**ID:** geo-outreach-d2b
**Status:** open
**Branch:** feature/geo-outreach
**PR:** #54 — open, awaiting human merge into develop
**Commit:** 0213405
**Base:** 58e2b9c (develop tip at branch time)

### Objective
Phase D2b: geo-outreach layer on top of the D2a geo foundation. Two SECDEF RPCs (seekers_within_radius, notify_seekers_near_resource) + live composer UI + e2e suite.

### Changes
- `supabase/migrations/20260605130000_geo_outreach_rpcs.sql` — two SECURITY DEFINER functions, anon EXECUTE revoked, authenticated+service_role granted, SET search_path=public. Applied to prod (verified prosecdef=true, anon_can_exec=false, auth_can_exec=true).
- `packages/database/types.ts` — hand-added seekers_within_radius + notify_seekers_near_resource to Database['public']['Functions'].
- `apps/web/src/components/panels/feed-panel.tsx` — CreatePostCard gains geo-outreach toggle/radius/count/result controls; handleCreatePost returns new post id.
- `apps/web/e2e/geo-outreach.spec.ts` — 4 tests (radius math, privacy, notify+dedup, UI). 4/4 green on two independent runs.

### Validation
- type-check: 0 errors
- lint: 0 new errors
- e2e geo-outreach: 4/4 pass (run 1 + run 2)
- CI: all checks pass (Analyze, Build, Lint, Test, Type Check, Security Audit, Deploy Preview, Vercel)

---

## Entry: chore/social-cleanup

**ID:** social-cleanup
**Status:** open
**Branch:** chore/social-cleanup
**Commit:** 5d6d4b6
**Base:** 3a1d381 (develop tip)

### Objective
Social system cleanup: delete dead feed components, fix uuid type mismatch in federation trust events, embed security header parity, revoke unused column INSERT privilege, surface follow errors to users.

### Changes
- `apps/web/src/components/feed/feed-list.tsx` — DELETED (zero imports; was sole N+1 like-count site)
- `apps/web/src/components/feed/post-composer.tsx` — DELETED (zero imports)
- `apps/web/src/app/(admin)/federation/dashboard/page.tsx` — replace `created_by: 'admin'` string literal with real uuid from auth.getUser() in adjustTrustScore + updateInstanceStatus
- `apps/web/next.config.ts` — add Permissions-Policy + X-DNS-Prefetch-Control to /s/embed/:id header block (parity with global block; frame-ancestors * intact)
- `supabase/migrations/20260605140000_revoke_profiles_location_insert.sql` — REMOVED (was a no-op: REVOKE INSERT(location) is superseded by a table-level INSERT grant; column-level REVOKE under a table-level grant is a no-op in PostgreSQL). Migration file deleted from tree; not applied to prod. Effective column-scope lockdown was shipped instead via PR #56 (20260606_profiles_write_lockdown.sql).
- `apps/web/src/components/panels/feed-panel.tsx` — destructure error from useFollows; add visible alert banner for follow/unfollow errors
- `apps/web/e2e/follows-graph.spec.ts` — fix inaccurate docstring (page.route mocks claimed but not used)

### Validation
- type-check: 0 errors
- lint: 0 new errors (109 pre-existing warnings unchanged)
- build: passes
- e2e: 44 pass / 5 fail (all 5 are pre-existing known failures: auth email signup, documents-view T1/T3/T4, forms-flow) / 1 skipped
