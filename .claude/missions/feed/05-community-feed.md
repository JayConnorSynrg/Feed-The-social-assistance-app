# MISSION 5 — Community Feed   | owner: feed-realtime-monitor | tier: P0
> One-line: a member sees community posts appear live, can create a post, opt in / withdraw on a resource post, and report abusive content — all without a page refresh.

## 1. Backend surface
- RPCs:
  - `posts_init_slots_remaining()` — backfills `slots_remaining` from capacity on existing posts — SECDEF — `supabase/migrations/20260604140000_resource_opt_ins_and_capacity.sql:24`
  - `opt_in_to_post(p_post_id uuid)` — atomic seeker opt-in (SELECT FOR UPDATE on capacity, decrements slot) — SECDEF — canonical body `supabase/migrations/20260604140000_resource_opt_ins_and_capacity.sql:136`; re-declared under guest gating `supabase/migrations/20260611173053_guest_access_anonymous_gating.sql:247`
  - `withdraw_opt_in(p_post_id uuid)` — releases the seeker's slot back to the pool — SECDEF — `supabase/migrations/20260604140000_resource_opt_ins_and_capacity.sql:203`; re-declared `supabase/migrations/20260611173053_guest_access_anonymous_gating.sql:314`
  - `submit_content_report(target_id, reason)` — files an abuse report against a post — SECDEF — see Mission 17 migration set
  - `seekers_within_radius(lat, lng, radius_m)` — finds nearby users for new-resource notification — SECDEF
  - `notify_seekers_near_resource(resource_id)` — inserts `notifications` rows for nearby seekers — SECDEF
- Edge functions: none (feed reads/writes go through PostgREST + RPC; no Deno function in this path).
- Tables:
  - `posts` — feed content rows (post_type, content, capacity, slots_remaining) — RLS yes; realtime YES (publication entry `supabase/migrations/20260619000100_posts_realtime_publication.sql:14`)
  - `resource_opt_ins` — seeker↔post opt-in join, status enum — RLS yes — `supabase/migrations/20260604140000_resource_opt_ins_and_capacity.sql`
  - `post_likes` — per-post like rows — realtime via per-post channel `likes-{postId}`
  - `post_comments` — per-post comments — realtime via per-post channel `comments-{postId}`
  - `polls` / `poll_votes` — poll post sub-data
  - `post_wizard_types` — post-type catalog driving the wizard

## 2. User-facing surfaces + interaction points
- `FeedPanel` (`apps/web/src/components/panels/feed-panel.tsx`) — interaction points: create-post entry, Like, Comment, Opt-in button, Withdraw button, Report action, per-type pagination.
- `PostTypeWizard` (`apps/web/src/components/panels/post-type-wizard.tsx`) — interaction points: select post type → fill fields → submit (resource / poll / generic post inserts).
- `WizardPanel` (`apps/web/src/components/panels/wizard-panel.tsx`) — wraps the post-creation wizard flow.

## 3. Backend→Surface binding map
- Feed mount → realtime subscribe → `supabase.channel('posts-realtime').on('postgres_changes', ...).subscribe()` (`apps/web/src/hooks/use-realtime-feed.ts:72-92`)
- Per-post like live updates → `supabase.channel('likes-${postId}')` (`apps/web/src/hooks/use-realtime-feed.ts:152-166`)
- Per-post comment live updates → `supabase.channel('comments-${postId}')` (`apps/web/src/hooks/use-realtime-feed.ts:207-221`)
- Create generic/resource post → `supabase.from('posts').insert({...})` (`apps/web/src/components/panels/post-type-wizard.tsx:227`, `:297`, `:581`); also direct insert in feed (`apps/web/src/components/panels/feed-panel.tsx:1623-1624`)
- Create poll post → `supabase.from('posts').insert({ post_type: 'poll' })` (`apps/web/src/components/panels/post-type-wizard.tsx:465-466`)
- New resource post → notify nearby → `rpc('seekers_within_radius', ...)` (`feed-panel.tsx:314`) → `rpc('notify_seekers_near_resource', ...)` (`feed-panel.tsx:369`)
- Opt-in button → `supabase.rpc('opt_in_to_post', { p_post_id })` (`apps/web/src/hooks/use-opt-ins.ts:89`)
- Withdraw button → `supabase.rpc('withdraw_opt_in', { p_post_id })` (`apps/web/src/hooks/use-opt-ins.ts:109`)
- Report post → `supabase.rpc('submit_content_report', {...})` (`feed-panel.tsx:1781`)
- Like toggle → `supabase.from('post_likes').insert({ post_id, user_id })` (`feed-panel.tsx:1762`)

## 4. Dependencies
- upstream (this feature needs): Mission 1 Auth (authenticated/anonymous session for RLS `auth.uid()`); Supabase Realtime enabled on project; `supabase_realtime` publication containing `posts`; Supabase singleton browser client (stuck-spinner pattern).
- downstream (depend on this): Mission 16 Notifications (`notify_seekers_near_resource` fan-out), Mission 17 Content Moderation (consumes `submit_content_report` rows), Mission 18 Dashboard (`community_people_fed` counts opt-in completions).

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "channel\('posts-realtime'\)|removeChannel" apps/web/src/hooks/use-realtime-feed.ts` → expected: subscribe at :72-92 AND removeChannel cleanup at :96/:104 (no leaked subscription)
- [ ] `grep -nE "rpc\('opt_in_to_post'|rpc\('withdraw_opt_in'" apps/web/src/hooks/use-opt-ins.ts` → expected: both RPC names present (:89, :109)
- [ ] `grep -nE "ALTER PUBLICATION supabase_realtime ADD TABLE public.posts" supabase/migrations/20260619000100_posts_realtime_publication.sql` → expected: line 14 present (posts in realtime publication)
- [ ] `grep -nE "SELECT FOR UPDATE|SECURITY DEFINER" supabase/migrations/20260604140000_resource_opt_ins_and_capacity.sql` → expected: SECDEF on opt_in_to_post (:139) + FOR UPDATE lock in body (atomic slot decrement)
- [ ] `grep -n "from('posts').insert" apps/web/src/components/panels/post-type-wizard.tsx` → expected: ≥3 insert sites (resource/poll/generic) wired to wizard submit

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Realtime publication membership (prod SQL, read-only): `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename in ('posts','post_likes','post_comments');` → expected: `posts` row returned (live updates can fire). No write side-effect.
- [ ] Live-update probe (two-client): client A subscribed via FeedPanel; client B inserts a post → expected: client A's feed gains the row with no refresh (realtime INSERT delivered). Cleanup: delete the test post by id (prod write — use a clearly-marked test post, e.g. content `__verify_realtime__`, then `delete from posts where content='__verify_realtime__'`).
- [ ] Opt-in atomicity (prod SQL): pick a capacity post; `select slots_remaining from posts where id=$1;` → call `select opt_in_to_post('$1');` → re-select → expected: slots_remaining decremented by exactly 1; second opt-in by same user is idempotent/blocked. Cleanup: `select withdraw_opt_in('$1');` restores the slot (prod write, self-reversing).
- [ ] Playwright per-type pagination: `npx playwright test apps/web/e2e/feed-per-type-pagination.spec.ts` → expected: pass (each post_type paginates independently).
- [ ] Playwright spinner timeout: `npx playwright test apps/web/e2e/feed-spinner-timeout.spec.ts` → expected: pass (feed resolves, no infinite spinner from non-singleton client regression).

## 6. PASS criteria + residuals
- PASS when: `posts` is in `supabase_realtime`; FeedPanel subscribes AND tears down the channel; a B-client insert appears on the A-client with no refresh; `opt_in_to_post` decrements slots atomically and `withdraw_opt_in` restores them; `submit_content_report` files a row; both feed E2E specs pass.
- Known residuals: opt-in/withdraw RPCs are declared in two migrations (20260604 base + 20260611 guest-gating re-declare) — the later definition wins; verify the LIVE function body via MCP/SQL after any redeploy, since file order is not load order. No dedicated E2E covers the realtime two-client path (covered by manual/SQL probe above).
