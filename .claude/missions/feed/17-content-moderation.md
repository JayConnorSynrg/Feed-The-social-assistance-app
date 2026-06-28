# MISSION 17 — Content Moderation   | owner: feed-supabase-validator | tier: P1
> One-line: an admin can triage user-reported posts in the Reports queue and remove / hold / authorize them, and every action is gated by `is_current_user_admin()` at the Postgres layer.

## 1. Backend surface
- RPCs:
  - `submit_content_report(p_content_type text, p_content_id uuid, p_reason public.report_reason, p_details text)` — user files a report; dedups one open report per (reporter, content) — SECDEF, `set search_path` — `supabase/migrations/20260609000000_content_reports.sql:125` (REVOKE public/anon + GRANT authenticated at `:199-201`).
  - `admin_remove_post(p_post_id uuid)` — sets `is_hidden=true`, `hidden_reason='admin_removal'`, upholds open reports — SECDEF — `supabase/migrations/20260619000000_moderation_admin_post_actions.sql:24,58`.
  - `admin_hold_post(p_post_id uuid)` — sets `is_hidden=true`, `hidden_reason='hold_for_review'` — SECDEF — `…20260619000000…:92,124`.
  - `admin_authorize_post(p_post_id uuid)` — clears `is_hidden=false`, dismisses open reports — SECDEF — `…20260619000000…:151,183`.
  - `admin_resolve_report(p_report_id uuid, p_action text)` — closes a report `open → upheld|dismissed` — SECDEF — latest def `supabase/migrations/20260611173053_guest_access_anonymous_gating.sql:836` (GRANT authenticated `:918`).
  - `is_current_user_admin()` — admin gate consumed by every RPC body + the route layout.
- Edge functions: none (moderation is pure RPC + table reads).
- Tables:
  - `content_reports` — report rows, `status text CHECK (open|dismissed|upheld)` default `'open'`, index on `status` — RLS yes — `supabase/migrations/20260609000000_content_reports.sql:57,67`.
  - `posts` — carries `is_hidden / hidden_at / hidden_reason` (added in `…content_reports.sql`); realtime publication `supabase_realtime` — `supabase/migrations/20260619000100_posts_realtime_publication.sql`.
  - `audit_log` — admin actions stamped by the RPC bodies.

## 2. User-facing surfaces + interaction points
- `AdminShell` (`apps/web/src/app/(admin)/moderation/admin-shell.tsx`) — Radix `Tabs`; "Moderation" tab at `value="moderation"` renders `<ModerationTab>`.
- `ModerationTab` (`apps/web/src/app/(admin)/moderation/moderation-tab.tsx`) — two subtabs: `reports` (default) and `safety` (Mission 12). Interaction points: subtab buttons.
- `ReportsQueue` (`apps/web/src/app/(admin)/moderation/reports-queue.tsx`) — interaction points: per-group Remove / Hold / Authorize buttons, Resolve (dismiss/uphold) action.

## 3. Backend→Surface binding map
- Reports queue load → `supabase.from('content_reports').select(...)` filtered to open → `reports-queue.tsx:62`; post bodies hydrated via `.from('posts')` at `:88` and `:106`.
- Remove post button → `supabase.rpc('admin_remove_post', { p_post_id })` → `reports-queue.tsx:166`.
- Hold post button → `supabase.rpc('admin_hold_post', { p_post_id })` → `reports-queue.tsx:186`.
- Authorize post button → `supabase.rpc('admin_authorize_post', { p_post_id })` → `reports-queue.tsx:206`.
- Resolve report → `supabase.rpc('admin_resolve_report', { p_report_id, p_action })` → `reports-queue.tsx:136`.
- Route admittance → `supabase.rpc('is_current_user_admin')` in `apps/web/src/app/(admin)/layout.tsx:18` (redirect `/` if false).

## 4. Dependencies
- upstream (this feature needs): admin route guard (`is_current_user_admin` SECDEF), `content_reports` + `posts.is_hidden` columns, `submit_content_report` populating the queue (Mission 5 report-post path), `report_reason` enum.
- downstream (depend on this): Community Feed visibility filter (client must hide `is_hidden=true` posts — Mission 5); realtime publication of `posts` propagates hides live.

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "admin_remove_post\|admin_hold_post\|admin_authorize_post\|admin_resolve_report" "apps/web/src/app/(admin)/moderation/reports-queue.tsx"` → expected: 4 distinct `supabase.rpc(...)` call sites (lines 136/166/186/206).
- [ ] `grep -n "security definer" supabase/migrations/20260619000000_moderation_admin_post_actions.sql` → expected: present on all three post-action RPCs.
- [ ] `grep -n "is_hidden\s*=\s*true" supabase/migrations/20260619000000_moderation_admin_post_actions.sql` → expected: remove + hold set `true`; authorize sets `false` (line 183) — confirms removal is a soft hide, not a delete.
- [ ] `grep -n "rpc('is_current_user_admin')" "apps/web/src/app/(admin)/layout.tsx"` → expected: server-side guard before children render.
- [ ] `grep -rn "is_hidden" "apps/web/src/components/panels/feed-panel.tsx" "apps/web/src/hooks/use-realtime-feed.ts"` → expected: client feed filters out `is_hidden` rows (visibility contract).

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] prod SQL — RPC hardening: `select proname, prosecdef, proconfig from pg_proc where proname in ('admin_remove_post','admin_hold_post','admin_authorize_post','admin_resolve_report')` → expected: each `prosecdef=true` and `proconfig` contains `search_path=public`.
- [ ] prod SQL — anon cannot execute: `select has_function_privilege('anon','admin_remove_post(uuid)','execute')` → expected: `false`; same query with `'authenticated'` → `true`.
- [ ] Playwright E2E — `apps/web/e2e/moderation-remove-hold.spec.ts` → expected: remove/hold flow flips the post out of the visible feed and into the moderated state.
- [ ] Playwright E2E — `apps/web/e2e/rls-is-admin-no-42501.spec.ts` → expected: admin gate path never throws `42501` for a real admin.
- [ ] prod SQL (read-only, no write) — queue shape: `select status, count(*) from content_reports group by status` → expected: only `open|dismissed|upheld`; `open` count matches what the queue renders.

## 6. PASS criteria + residuals
- PASS when: all four moderation RPCs are SECDEF + `search_path=public` + anon-exec=false / auth-exec=true; reports-queue binds each button to the correct RPC (5a lines confirmed); `admin_remove_post` sets `is_hidden=true` (soft hide) and the client feed filters hidden posts; the admin route layout redirects non-admins; `moderation-remove-hold.spec.ts` passes.
- Known residuals: ban-user path depends on the external Supabase admin API via `/api/admin/users/[id]/ban` (out of RPC scope — verified under Mission for user-management); `community-tab.tsx` has no direct RPC/`from` calls (renders from props) so its data path is verified via OverviewTab (Mission 18).
