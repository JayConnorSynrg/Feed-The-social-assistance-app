# MISSION 16 — Notifications   | owner: feed-realtime-monitor | tier: P2
> One-line: a user receives system-generated notifications live (realtime INSERT pushes them into the bell), can mark-read / mark-all-read / delete, manages reminders — and NO client can forge a notification into another user's feed.

## 1. Backend surface
- RPCs:
  - `notify_seekers_near_resource(resource_id)` — SECDEF; finds nearby seekers and INSERTs `notifications` rows (bypasses RLS as owner) — `supabase/migrations/20260605130000_geo_outreach_rpcs.sql:120`.
  - `seekers_within_radius(lat,lng,radius_m)` — SECDEF candidate finder — same migration.
- Edge functions: none direct (notification inserts happen via SECDEF RPCs / triggers / service_role).
- Tables:
  - `notifications` — per-user rows; RLS yes — `notifications_select_own`, `notifications_update_own`, `notifications_delete_own` (`supabase/migrations/20260525100000_add_notifications_tables.sql:39-51`). **INSERT-forge fix:** the original `notifications_insert_system` policy was `WITH CHECK (true) TO PUBLIC` (forgeable) — DROPPED with no replacement, so anon/authenticated INSERT is blocked; only SECDEF triggers + service_role insert (`supabase/migrations/20260601090000_security_advisor_remediation.sql:41-51`). Realtime: subscribed via channel (see §3) — **publication membership is a runtime probe (no `ALTER PUBLICATION … notifications` migration found)**.
  - `reminders` — per-user reminders; RLS row-scoped — same base migration.
  - `device_tokens` — push token registry (per inventory).

## 2. User-facing surfaces + interaction points
- Notification bell in `FeedShell` header — interaction points: bell open, unread badge count, mark-read (per item), mark-all-read, delete item.
- Reminders surface — create reminder, complete reminder, delete reminder.

## 3. Backend→Surface binding map
- Bell mount → `useNotifications` → `refreshNotifications` → `supabase.from('notifications').select('*').eq('user_id',user.id).order(created_at desc).limit(50).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))` (`apps/web/src/hooks/use-notifications.ts:94-100`).
- Realtime push → `supabase.channel('notifications').on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications' }, cb).subscribe()` → prepends `payload.new` (`use-notifications.ts:245-254`); cleanup `removeChannel` on unmount (:256-258).
- unreadCount → derived `notifications.filter(n => !n.is_read).length` (`use-notifications.ts:78`).
- Mark read → `supabase.from('notifications').update({ is_read:true }).eq('id',id)` (`use-notifications.ts:129-132`).
- Mark all read → `.update({ is_read:true }).eq('user_id',user.id).eq('is_read',false)` (`use-notifications.ts:149-153`).
- Delete → `.delete().eq('id',id)` (`use-notifications.ts:165-168`).
- System insert (server) → `notify_seekers_near_resource` SECDEF → `INSERT INTO public.notifications (...)` (`geo_outreach_rpcs.sql:120`) → realtime INSERT fires bell.
- Reminders → insert/update/delete on `reminders` (`use-notifications.ts:185-233`).

### INSERT-forge risk (critical)
A client must NOT insert a notification into another user's feed. Closed by DROPping the always-true public INSERT policy and adding NO replacement — RLS-enabled table with no INSERT policy denies all client inserts; SECDEF/service_role bypass RLS for legitimate system inserts (`security_advisor_remediation.sql:45-49`).

### Realtime channel risk
The channel filters client-side by `event:'INSERT'` only (no server-side `user_id=eq.{uid}` filter in the subscribe). RLS on the realtime stream restricts rows to the caller's own (`notifications_select_own`), but if `notifications` is absent from `supabase_realtime` the bell will only update on manual refresh — verify publication membership at runtime.

## 4. Dependencies
- upstream: authenticated user; `notifications` in `supabase_realtime` publication (probe); SECDEF inserters (`notify_seekers_near_resource`, triggers) deployed; `QUERY_TIMEOUT_MS` from `@/lib/vault`.
- downstream: Mission 4/13 (new nearby resource triggers notifications), Mission 10 Applications (status_update/approval/denial notification types).

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "channel\('notifications'\)|postgres_changes|removeChannel" apps/web/src/hooks/use-notifications.ts` → expected: subscribe at :245-254, cleanup at :257 (no leaked subscription).
- [ ] `grep -nE "notifications_insert_system|WITH CHECK \(true\)" supabase/migrations/20260601090000_security_advisor_remediation.sql` → expected: DROP of the forgeable policy, no replacement INSERT policy (:45).
- [ ] `grep -nE "FOR INSERT|FOR SELECT|FOR UPDATE|FOR DELETE" supabase/migrations/20260525100000_add_notifications_tables.sql` → expected: select/update/delete own; INSERT only the now-dropped system policy.
- [ ] `grep -n "AbortSignal.timeout" apps/web/src/hooks/use-notifications.ts` → expected: both notifications + reminders fetches timeout-guarded (:100, :110).
- [ ] `grep -n "from('notifications').insert" apps/web/src/hooks/use-notifications.ts` → expected: ZERO matches (client never self-inserts notifications — confirms system-only design).

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Prod SQL — **realtime publication membership**: `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications';` → expected: one row (else live bell update fails; only manual refresh works — flag as residual if missing).
- [ ] Prod SQL — **forge proof**: `select cmd, polname, with_check from pg_policies where tablename='notifications';` → expected: NO `cmd='INSERT'` row → client INSERT denied by RLS.
- [ ] Prod SQL — INSERT denied for authenticated grant path: `select has_table_privilege('authenticated','public.notifications','INSERT');` may be true at GRANT level, but RLS with no INSERT policy blocks it — confirm by an attempted insert under an authenticated test JWT returns 42501/0 rows (read-only-safe alternative: rely on the pg_policies result above).
- [ ] Realtime probe: in a Playwright session, open the bell, then via admin/service_role insert a notification for the test user and assert it appears WITHOUT refresh → expected: row prepends live. PROD-WRITE: inserts one notifications row; CLEANUP: delete it by id post-assert.
- [ ] E2E: no dedicated notifications spec ships today — author `apps/web/e2e/notifications.spec.ts` covering live-receive + mark-read + forge-denied (attempt cross-user insert under authenticated client → expect failure).

## 6. PASS criteria + residuals
- PASS when: bell loads the caller's own notifications (RLS-scoped); a system/service_role insert pushes a new row into the bell live via the `notifications` channel; mark-read / mark-all-read / delete mutate only the caller's rows; a client cannot insert a notification (no INSERT policy on the RLS-enabled table, proven via `pg_policies`); `notifications` is a member of `supabase_realtime`.
- Known residuals: no `notifications.spec.ts` E2E yet (author to reach 100%); no migration adding `notifications` to `supabase_realtime` was found in-tree — publication membership MUST be confirmed at runtime, and if absent the live bell silently degrades to refresh-only (close by adding an idempotent `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` migration, mirroring the posts/petitions pattern).
