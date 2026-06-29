# FEED Backend→Surface Inventory

Source of truth for per-mission authoring. Organized by the 21 verification missions.
Backend counts: 51 RPCs, 18 edge functions, 46+ tables.

---

## 1. Auth & Session

**Backend**
- RPCs: `get_my_profile()` — fetch own profile row — SECDEF — `supabase/functions/` | `handle_new_user` trigger — creates profile on signup
- Edge functions: `auth-guard` (browser-invoked) — validates Bearer JWT before protected routes; `validate-password` (browser-invoked) — HIBP + complexity check
- Tables: `profiles` (RLS); `auth_login_attempts`; `account_lockouts`; `mfa_backup_codes`; `password_history`

**Surfaces**
- Auth pages: `apps/web/src/app/(auth)/` — sign-in, sign-up, callback, reset-password
- Middleware: `apps/web/src/middleware.ts` — session refresh + route guard
- `SettingsPanel` (`apps/web/src/components/panels/settings-panel.tsx`) — sign-out, delete account

**Binding map**
- Sign-in form submit → `supabase.auth.signInWithPassword()` (auth page)
- Google OAuth button → `supabase.auth.signInWithOAuth({ provider: 'google' })` (auth page)
- Middleware on every request → `supabase.auth.getSession()` → session cookie refresh
- Delete account → `functions.invoke('delete-account')` (settings panel)
- New signup → `handle_new_user` DB trigger fires → inserts `profiles` row

---

## 2. Profiles & Settings

**Backend**
- RPCs: `get_my_profile()` — public profile fields; `get_my_private_profile()` — email/phone/PII; `get_my_coordinates()` — lat/lng; `sync_is_staff()` — sync staff flag; `is_current_user_admin()` — admin gate check
- Tables: `profiles` (RLS, realtime off)

**Surfaces**
- `SettingsPanel` (`apps/web/src/components/panels/settings-panel.tsx`) — edit name, avatar, location, notification prefs
- Admin: `apps/web/src/app/(admin)/` layout — uses `is_current_user_admin` gate

**Binding map**
- Settings load → `supabase.from('profiles').select(...)` via `get_my_private_profile()` RPC
- Save profile → `supabase.from('profiles').update(...)` with `.eq('id', user.id)`
- Coordinate display → `get_my_coordinates()` RPC

---

## 3. AI Chat

**Backend**
- Edge functions: `chat` (browser-invoked) — Fireworks/OpenRouter proxy, SSE streaming, ZDR-compliant
- Tables: none (chat is stateless per-session; messages not persisted server-side)

**Surfaces**
- `ChatPanel` (`apps/web/src/components/panels/chat-panel.tsx`)
- Hook: `apps/web/src/hooks/use-chat.ts` — SSE stream consumer, AbortController, retry logic
- System prompts: `apps/web/src/lib/ai/system-prompts.ts`

**Binding map**
- User sends message → `use-chat.ts` → `functions.invoke('chat', { body: { messages, context } })` → SSE stream
- Guided flow active → system prompt injected from `system-prompts.ts` before invoke
- AbortError on navigation → treated as success (Next.js fetch-abort pattern)

---

## 4. Resource Map & Geo

**Backend**
- RPCs: `resources_in_bounds(xmin, ymin, xmax, ymax)` — PostGIS viewport query — SECDEF; `nearby_resources(lat, lng, radius_m)` — radius query; `set_resource_location(resource_id, lat, lng)` — volunteer sets own resource location; `set_resource_location_by_id` — admin override
- Tables: `resources` (status enum, `location geography(Point,4326)`, `discovery_metadata` JSONB, RLS); `zip_centroids` (lookup); `snap_retailers` (SNAP locations)

**Surfaces**
- `MapPanel` (`apps/web/src/components/panels/map-panel.tsx`) — Mapbox GL, supercluster, marker layers
- Hook: `apps/web/src/hooks/use-viewport-resources.ts` — debounced viewport → RPC call
- Hook: `apps/web/src/hooks/use-safety-alerts.ts` → RPC `safety_alerts_in_view` (shares map layer)

**Binding map**
- Map viewport change (debounced) → `use-viewport-resources` → `rpc('resources_in_bounds', { xmin, ymin, xmax, ymax })`
- Volunteer FAB "Place Here" → `set_resource_location(resource_id, map.getCenter())`
- Map renders → ResizeObserver → `map.resize()` (container-resize fix, PR#134)

---

## 5. Community Feed

**Backend**
- RPCs: `posts_init_slots_remaining(post_id)` — slot count; `opt_in_to_post(post_id)` — atomic opt-in (SECDEF, SELECT FOR UPDATE); `withdraw_opt_in(post_id)` — withdraw; `resource_opt_ins_set_completed_at(opt_in_id)` — mark done; `submit_content_report(target_id, reason)` — report post; `seekers_within_radius(lat, lng, radius_m)` — find nearby users; `notify_seekers_near_resource(resource_id)` — push notify nearby
- Tables: `posts` (realtime enabled, publication `supabase_realtime`); `post_comments`; `post_likes`; `polls`; `poll_votes`; `post_wizard_types`; `resource_opt_ins`

**Surfaces**
- `FeedPanel` (`apps/web/src/components/panels/feed-panel.tsx`)
- Hook: `apps/web/src/hooks/use-realtime-feed.ts` — Supabase Realtime channel on `posts`
- Hook: `apps/web/src/hooks/use-opt-ins.ts` — opt-in/withdraw mutations
- `WizardPanel` / `PostTypeWizard` — post creation flow

**Binding map**
- Feed mounts → `use-realtime-feed` → `supabase.channel('posts').on('postgres_changes', ...)` subscribe
- New post from wizard → `supabase.from('posts').insert(...)` (client-side)
- Opt-in button → `use-opt-ins` → `rpc('opt_in_to_post', { post_id })`
- Withdraw → `rpc('withdraw_opt_in', { post_id })`
- Report post → `rpc('submit_content_report', { target_id, reason })`

---

## 6. Messages

**Backend**
- RPCs: `get_conversation_counterparty(conversation_id)` — get other participant; `get_my_conversation_counterparties()` — list all conversations; `get_my_conversation_review(conversation_id)` — fetch review for this conversation
- Tables: `conversations` (partial unique index: one pending request per pair, RLS); `messages` (RLS); `conversation_reviews`

**Surfaces**
- `MessagesPanel` (subtab of FeedPanel via PANEL_ALIASES `messages→feed#messages`)
- Hook: `apps/web/src/hooks/use-conversations.ts` — list conversations, send message, isSending state

**Binding map**
- Panel mounts → `use-conversations` → `rpc('get_my_conversation_counterparties')`
- Send message → `supabase.from('messages').insert(...)` + `isSending` reset in `finally`
- New message arrives → Realtime channel on `messages` table
- Request resource → `supabase.from('conversations').insert(...)` (guarded by partial unique index)

---

## 7. Events & Check-ins

**Backend**
- RPCs: `is_org_admin(org_id)` — gate; `is_org_member(org_id)` — gate; `projected_turnout(event_id)` — estimate attendance
- Tables: `organizations`; `organization_members`; `assistance_events`; `event_occurrences`; `event_checkins` (RLS)

**Surfaces**
- `EventsPanel` (subtab of FeedPanel via PANEL_ALIASES `events→feed#events`)
- `CheckinSheet` component — modal check-in flow
- Admin `EventScheduler` tab in AdminShell

**Binding map**
- Events list → `supabase.from('event_occurrences').select('*, assistance_events(*)')` 
- Check-in button → `supabase.from('event_checkins').insert({ event_id, user_id })`
- Admin EventScheduler → `supabase.from('assistance_events').select(...)` + insert/update
- Turnout estimate → `rpc('projected_turnout', { event_id })`

---

## 8. Petitions

**Backend**
- RPCs: `get_petition_signature_count(petition_id)`; `get_petition_signatures(petition_id)`; `has_signed_petition(petition_id)`; `withdraw_petition_signature(petition_id)`; `export_petition_signatures(petition_id)`
- Tables: `petitions` (RLS); `petition_signatures` (realtime enabled)
- API route: `/api/petitions/sign` (Next.js route — server-stamped ESIGN with timestamp)

**Surfaces**
- `PetitionsPanel` (subtab of FeedPanel via PANEL_ALIASES `petitions→feed#petitions`)
- Hook: `apps/web/src/hooks/use-petitions.ts`

**Binding map**
- Petition detail load → `rpc('get_petition_signature_count', { petition_id })` + `rpc('has_signed_petition', { petition_id })`
- Sign button → `POST /api/petitions/sign` (server-stamps ESIGN) → realtime `petition_signatures` update fires
- Withdraw → `rpc('withdraw_petition_signature', { petition_id })`
- Realtime counter → Supabase channel on `petition_signatures`

---

## 9. Documents & Vault

**Backend**
- RPCs: `geocode_profile_location()` — geocodes profile address to lat/lng
- Tables: `user_documents` (RLS, Supabase Storage backed); `user_secure_profiles` (vault encrypted JSON); `user_document_annotations` (encrypted sidecar annotations)
- Storage bucket: `user-documents` (private, signed URLs)

**Surfaces**
- `DocumentsPanel` (`apps/web/src/components/panels/documents-panel.tsx`)
- Hook: `apps/web/src/hooks/use-documents.ts` — list, upload, delete
- Hook: `apps/web/src/hooks/use-encrypted-upload.ts` — AES-GCM-256 encrypt before Storage PUT
- Hook: `apps/web/src/hooks/use-vault-form-submission.ts` — encrypted form submission flow
- `VaultProvider` / `VaultGuard` — PBKDF2 unlock, IndexedDB DEK, master password

**Binding map**
- Document upload → `use-encrypted-upload` → `SubtleCrypto.encrypt(AES-GCM)` → `supabase.storage.from('user-documents').upload(path, ciphertext)`  → `supabase.from('user_documents').insert({ file_path, encryption_iv, ... })`
- Document view → `supabase.storage.from('user-documents').createSignedUrl(path, 300)` → iframe
- Vault unlock → `VaultProvider.unlock(password)` → PBKDF2 → `unwrapDEK()` → IndexedDB store
- Annotations save → `supabase.from('user_document_annotations').upsert({ encrypted_annotations, annotations_iv })`

---

## 10. Forms & Applications

**Backend**
- Edge functions: `benefits-screening` (browser-invoked, `--no-verify-jwt`) — AI eligibility evaluation via Fireworks qwen3-8b
- Tables: `form_templates` (`is_active`, `discovery_metadata`, `moderated_by/at`, RLS); `form_submissions` (RLS); `form_signatures`

**Surfaces**
- `ApplicationsPanel` (formerly FormsPanel, merged; subtab of DocumentsPanel via PANEL_ALIASES `forms→documents#applications` + `applications→documents#applications`)
- Hook: `apps/web/src/hooks/use-form-submission.ts`
- Hook: `apps/web/src/hooks/use-vault-form-submission.ts` — encrypted path
- PDF annotator: `@cantoo/pdf-lib` integration
- `WizardPanel` — multi-step application wizard

**Binding map**
- Form list load → `supabase.from('form_templates').select('*').eq('is_active', true)`
- Form submit (plain) → `supabase.from('form_submissions').insert({ form_template_id, data })`
- Form submit (encrypted) → vault unlock gate → `use-vault-form-submission` → AES-GCM encrypt → insert with `encrypted_data`
- Benefits screening → `functions.invoke('benefits-screening', { body: { profile, household } })`
- E-signature capture → `supabase.from('form_signatures').insert({ submission_id, signature_data })`

---

## 11. Programs

**Backend**
- Edge functions: `benefits-screening` (shared with Forms)
- Tables: `resources` filtered by `resource_source` enum (programs category); discovery tables populated by `program-discovery.ts`
- Scripts: `scripts/program-discovery.ts` — Fireworks qwen3-8b powered discovery; `scripts/federal-forms.ts`; `scripts/state-portals.ts`

**Surfaces**
- `ProgramsPanel` (`apps/web/src/components/panels/programs-panel.tsx`)
- Hook: `apps/web/src/hooks/use-program-browser.ts` — filter, search, paginate
- `WizardPanel` / `resource-wizard.tsx` — guided eligibility flow
- Lib: `apps/web/src/lib/category-form-map.ts` — category → form template mapping

**Binding map**
- Programs list → `use-program-browser` → `supabase.from('resources').select('*').eq('category', 'program').eq('status', 'active')`
- Category filter → `.in('resource_source', selectedSources)`
- Eligibility wizard → step completion → `functions.invoke('benefits-screening', { body: { ... } })`
- Form link → `category-form-map.ts` lookup → navigate to Forms panel with template pre-selected

---

## 12. Safety Alerts

**Backend**
- RPCs: `place_safety_alert(lat, lng, type, description)` — create; `update_safety_alert(alert_id, ...)` — edit own; `delete_safety_alert(alert_id)` — delete own; `vote_safety_alert(alert_id, vote)` — upvote/downvote; `safety_alerts_in_view(xmin, ymin, xmax, ymax)` — viewport fetch; `admin_verify_safety_alert(alert_id)` — SECDEF admin verify/endorse; `admin_remove_safety_alert(alert_id)` — SECDEF admin remove
- Tables: `safety_alerts` (`location geography(Point,4326)`, RLS, `created_by` column-scoped — not exposed to anon); `safety_alert_votes`

**Surfaces**
- `MapPanel` — alert markers overlaid on resource map
- Hook: `apps/web/src/hooks/use-safety-alerts.ts`
- Admin `ModerationTab` → `SafetyAlertsReview` component

**Binding map**
- Map viewport change → `use-safety-alerts` → `rpc('safety_alerts_in_view', { xmin, ymin, xmax, ymax })`
- Place alert FAB → `rpc('place_safety_alert', { lat, lng, type, description })`
- Vote → `rpc('vote_safety_alert', { alert_id, vote })`
- Admin verify → `rpc('admin_verify_safety_alert', { alert_id })`
- Admin remove → `rpc('admin_remove_safety_alert', { alert_id })`

---

## 13. Volunteer Resources

**Backend**
- RPCs: `set_resource_location(resource_id, lat, lng)` — volunteer places own offer on map
- Tables: `resources` filtered by `resource_source = 'volunteer'` (RLS, role-gated)

**Surfaces**
- `MapPanel` — amber volunteer markers (distinct from blue org markers)
- FAB speed-dial: 6-category volunteer resource creation
- Hook: `apps/web/src/hooks/use-volunteer-resource.ts` — create, withdraw, `withdrawResource` (known: missing `finally` block on `isWithdrawing`)

**Binding map**
- Role gate check → profile `role IN ('providing', 'facilitator', 'both')` from auth context
- FAB category select → `supabase.from('resources').insert({ resource_source: 'volunteer', category, ... })`
- Withdraw → `use-volunteer-resource.withdrawResource()` → `supabase.from('resources').update({ status: 'inactive' })`
- Map layer → `use-viewport-resources` returns volunteer rows → rendered as amber markers

---

## 14. Saved Resources

**Backend**
- Tables: `saved_resources` (encrypted, RLS); `saved_resource_tasks`; `saved_resource_events`; `saved_resource_documents`

**Surfaces**
- SavedResourcesPanel or drawer within MapPanel / ResourcePanel
- Hook: `apps/web/src/hooks/use-saved-resources.ts`

**Binding map**
- Save button → `supabase.from('saved_resources').insert({ user_id: auth.uid(), resource_id, encrypted_notes })`
- Saved list load → `supabase.from('saved_resources').select('*, resources(*)').eq('user_id', auth.uid())`
- Delete saved → `supabase.from('saved_resources').delete().eq('id', saved_id)`

---

## 15. Reviews & Harmony

**Backend**
- RPCs: `submit_review(resource_id, rating, text)` — submit; `recompute_harmony(resource_id)` — recalculate harmony score
- Tables: `reviews` (RLS)

**Surfaces**
- MessagesPanel → conversation end → review prompt
- Hook: `apps/web/src/hooks/use-reviews.ts`

**Binding map**
- Post-conversation review → `rpc('submit_review', { resource_id, rating, text })`
- Harmony recompute (server-triggered after review) → `rpc('recompute_harmony', { resource_id })`
- Harmony score display → `resources.harmony_score` field on resource card

---

## 16. Notifications

**Backend**
- RPCs: `notify_seekers_near_resource(resource_id)` — push to nearby users; `seekers_within_radius(lat, lng, radius_m)` — find candidates
- Tables: `notifications` (RLS, realtime enabled); `reminders`; `device_tokens`

**Surfaces**
- Notification bell in `FeedShell` header
- Hook: `apps/web/src/hooks/use-notifications.ts` — Realtime subscription + mark-read

**Binding map**
- Shell mount → `use-notifications` → `supabase.channel('notifications').on('postgres_changes', { filter: 'user_id=eq.{uid}' })` subscribe
- New resource nearby → `notify_seekers_near_resource` (called from FeedPanel on new resource post) → inserts `notifications` rows → Realtime fires
- Mark read → `supabase.from('notifications').update({ read: true }).eq('id', notif_id)`
- Push token register → `supabase.from('device_tokens').upsert({ user_id, token, platform })`

---

## 17. Content Moderation

**Backend**
- RPCs: `submit_content_report(target_id, reason)` — user reports; `admin_remove_post(post_id)` — SECDEF sets `is_hidden=true`; `admin_hold_post(post_id)` — SECDEF hold; `admin_authorize_post(post_id)` — SECDEF release; `admin_resolve_report(report_id, action)` — SECDEF close report; `admin_list_users(cursor, limit)` — paginated user list; `admin_add_user_note(user_id, note)` — admin note; `admin_delete_user_note(note_id)`; `admin_get_user_notes(user_id)`
- Tables: `content_reports` (RLS); `admin_user_notes`; `audit_log`
- Admin route guard: `rpc('is_current_user_admin')` in `apps/web/src/app/(admin)/layout.tsx`

**Surfaces**
- `AdminShell` → `ModerationTab` → `ReportsQueue` component
- `AdminShell` → `ModerationTab` → `SafetyAlertsReview` component (see Mission 12)
- `AdminShell` → `CommunityTab` → `CommunitySummarySection`

**Binding map**
- Reports queue load → `supabase.from('content_reports').select('*').eq('status', 'open')`
- Remove post → `rpc('admin_remove_post', { post_id })`
- Hold post → `rpc('admin_hold_post', { post_id })`
- Authorize post → `rpc('admin_authorize_post', { post_id })`
- Resolve report → `rpc('admin_resolve_report', { report_id, action })`
- Ban user → `admin_list_users` → `admin_add_user_note` + external Supabase admin API

---

## 18. Dashboard/Analytics

**Backend**
- RPCs: `dashboard_adoption_stats()` — user growth + retention; `dashboard_resource_stats()` — resource counts by category; `dashboard_petition_momentum()` — recent signature velocity; `dashboard_event_stats()` — event attendance; `community_people_fed()` — total opt-in completions; `dashboard_completed_profiles()` — profile completion rate; `projected_turnout(event_id)`

**Surfaces**
- `AdminShell` → `OverviewTab` — all 6 stat RPCs rendered as metric cards
- `AdminShell` → `EventScheduler` tab — `projected_turnout` per event

**Binding map**
- Overview tab mount → parallel `rpc('dashboard_adoption_stats')`, `rpc('dashboard_resource_stats')`, `rpc('dashboard_petition_momentum')`, `rpc('dashboard_event_stats')`, `rpc('community_people_fed')`, `rpc('dashboard_completed_profiles')`
- AI summary (non-blocking) → OpenRouter call in separate `useEffect` (PR#143 admin perf fix)

---

## 19. Admin Resource Discovery

**Backend**
- Edge functions: `resource-discover` (webhook-invoked) — AI-powered discovery pipeline
- RPCs: `admin_list_pending_resources(cursor, limit)` — paginated pending queue; `approve_resource(resource_id)` — set status=active; `reject_resource(resource_id, reason)` — set status=rejected; `approve_form_template(template_id)` — activate form template
- Tables: `resources` filtered by `status='pending'` (RLS); `form_templates` filtered by `moderated_by IS NULL`

**Surfaces**
- `AdminShell` → `ResourcesTab` — discovery trigger + pending queue

**Binding map**
- Trigger discovery → `functions.invoke('resource-discover', { body: { source, query } })`
- Pending queue load → `rpc('admin_list_pending_resources', { cursor: null, limit: 20 })`
- Approve resource → `rpc('approve_resource', { resource_id })`
- Reject resource → `rpc('reject_resource', { resource_id, reason })`
- Approve form template → `rpc('approve_form_template', { template_id })`

---

## 20. Federation

**Backend**
- RPCs: `get_instance_uptime(instance_id)`; `notify_federation_webhook(instance_id, payload)`; `get_webhook_stats(instance_id)`; `get_recent_webhook_failures(instance_id, limit)`; `get_stale_federated_resources(age_hours)`; `cleanup_old_webhook_logs(older_than_days)`; `calculate_trust_score(instance_id)`; `trust_score_to_level(score)`
- Edge functions: `federation-health-check` (cron) — polls peers; `federation-sync` (cron + webhook) — syncs resources from peers; `federation-inbox` (webhook) — receives inbound ActivityPub-style payloads; `federation-webhook` (webhook) — outbound delivery + signature; `federation-resources` (browser-invoked) — federated search
- Tables: `federated_instances`; `federation_peers`; `federated_resources`; `federation_webhook_log`; `federation_sync_log`; `federation_health_checks`; `federation_trust_events` (RLS)
- API routes: `/api/federation/webhook`; `/api/federation/resources`; `/api/federation/instance`

**Surfaces**
- `apps/web/src/app/(admin)/federation/` — federation admin pages
- Lib: `apps/web/src/lib/federation/` — client library

**Binding map**
- Federation admin page → `supabase.from('federated_instances').select('*, federation_health_checks(*)')`
- Sync trigger → `functions.invoke('federation-sync', { body: { instance_id } })`
- Federated search → `functions.invoke('federation-resources', { body: { query } })`
- Inbound webhook → POST `/api/federation/webhook` → HMAC verify → `supabase.from('federated_resources').upsert(...)`
- Trust score → `rpc('calculate_trust_score', { instance_id })` → `rpc('trust_score_to_level', { score })`
- Health check (cron, 5min) → `federation-health-check` edge fn → polls each peer `/api/federation/instance` → upserts `federation_health_checks`

---

## 21. External Sync 211/HUD/IMLS/SNAP

**Backend**
- Edge functions: `sync-211` (cron) — 211 API → resources; `hud-sync` (cron) — HUD housing API → resources; `imls-sync` (cron) — IMLS library API → resources; `snap-retailer-sync` (cron) — USDA SNAP retailer locator → `snap_retailers`
- Tables: `resources` (populated by syncs, `resource_source` enum distinguishes origin); `snap_retailers` (separate table, PostGIS location); `resource_categories`

**Surfaces**
- `MapPanel` — SNAP retailer markers (distinct layer)
- `ProgramsPanel` — resources from all sync sources
- `AdminShell` → `ResourcesTab` — sync status visible via pending/active counts

**Binding map**
- 211 cron fires → `sync-211` → external 211 API → upsert `resources` with `resource_source='211'`
- HUD cron fires → `hud-sync` → HUD API → upsert `resources` with `resource_source='hud'`
- IMLS cron fires → `imls-sync` → IMLS API → upsert `resources` with `resource_source='imls'`
- SNAP cron fires → `snap-retailer-sync` → USDA API → upsert `snap_retailers` with `location geography`
- Map SNAP layer → `supabase.from('snap_retailers').select('*')` within viewport bounds
- Programs list → `use-program-browser` queries `resources` with `.in('resource_source', ['211', 'hud', 'imls'])`

---

## PANEL_ALIASES (feed-shell.tsx)

The SPA uses alias routing to redirect panel IDs without changing callers:

| Alias ID | Resolves to |
|----------|-------------|
| `forms` | `documents#applications` |
| `messages` | `feed#messages` |
| `applications` | `documents#applications` |
| `petitions` | `feed#petitions` |
| `events` | `feed#events` |

---

## Admin Route Guard

`apps/web/src/app/(admin)/layout.tsx` calls `rpc('is_current_user_admin')` on mount. Returns `false` → redirect to `/`. All 18 Admin RPCs listed above require admin=true in their SECDEF body.

---

## Existing Verification Infrastructure

| Asset | Location | Coverage |
|-------|----------|----------|
| Playwright E2E specs | `apps/web/e2e/` | 50 specs |
| Static smoke tests | `apps/web/src/__tests__/smoke-tests.ts` | wiring checks |
| feed-smoke-runner agent | agent definition | 7 missions, static |
| Specialist agents | `~/.claude/agents/feed-*.md` | 18 agents |
| npm scripts | `apps/web/package.json` | type-check, lint, test:e2e, build |
