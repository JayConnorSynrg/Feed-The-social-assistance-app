# MISSION 2 — Profiles & Settings   | owner: feed-supabase-validator | tier: P1
> One-line: an authenticated user can load their own profile (including private PII fields), edit name/location/notification prefs, save them back, and never read another user's private columns — proving column-level PII privacy holds.

## 1. Backend surface
- RPCs:
  - `get_my_profile()` — public profile fields (own row) — SECDEF — `supabase/migrations/20260601043054_harden_security_definer_fns.sql`
  - `get_my_private_profile()` — email/phone/PII (own row only) — SECDEF — consumed `apps/web/src/components/panels/settings-panel.tsx:1066`
  - `get_my_coordinates()` — own lat/lng (coords are REVOKEd from direct SELECT) — SECDEF accessor (profiles-coordinate-hardening pattern, PR#57)
  - `is_current_user_admin()` — admin gate — SECDEF — `apps/web/src/app/(admin)/layout.tsx`
- Tables:
  - `profiles` — user profile — RLS yes, realtime off — column-scoped grants: direct SELECT of `full_name`/`email`/`phone`/`lat`/`lng`/`location`/`zip` REVOKEd for cross-user reads (column-grant-audit pattern; `pg_attribute.attacl` is authoritative)

## 2. User-facing surfaces + interaction points
- SettingsPanel (`apps/web/src/components/panels/settings-panel.tsx`) — interaction points: edit display name, avatar, location, notification preference toggles, Save button, sign-out, delete-account, "Forgot password" link (:808)
- Admin layout (`apps/web/src/app/(admin)/layout.tsx`) — interaction point: admin-gate check on mount

## 3. Backend→Surface binding map
- Settings mount → own private profile load → `supabase.rpc('get_my_private_profile')` — `apps/web/src/components/panels/settings-panel.tsx:1066`
- Public profile fields → `supabase.from('profiles').select(...)` (own row, RLS-scoped) — settings panel load effect
- Save profile → `supabase.from('profiles').update({...}).eq('id', user.id)` — settings panel save handler
- Coordinate display → `supabase.rpc('get_my_coordinates')` (direct lat/lng SELECT is REVOKEd)
- Admin gate → `supabase.rpc('is_current_user_admin')` → false redirects to `/` — `apps/web/src/app/(admin)/layout.tsx`

## 4. Dependencies
- upstream (this feature needs): Mission 1 authenticated session (RPCs are auth.uid()-scoped); `profiles` row created by `handle_new_user`
- downstream (depend on this): Resource Map (M4) reads profile city/state for initial viewport + `get_my_coordinates`; AI Chat (M3) personalization line is built from profile context; Admin gate guards Missions 17/18/19 surfaces

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "get_my_private_profile\|get_my_coordinates\|from('profiles')" apps/web/src/components/panels/settings-panel.tsx` → expected: private profile via RPC (:1066); update via `.from('profiles').update().eq('id', user.id)` (scoped to own id)
- [ ] `grep -n "\.update(" apps/web/src/components/panels/settings-panel.tsx` → expected: every profile write chains `.eq('id', user.id)` (no unscoped update)
- [ ] `grep -rn "is_current_user_admin" apps/web/src/app/\(admin\)/layout.tsx` → expected: rpc call + redirect-on-false
- [ ] `grep -rn "get_my_coordinates\|get_my_private_profile" supabase/migrations` → expected: SECDEF definitions exist (coords accessor avoids direct lat/lng read)

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Reuse Mission 1 authenticated-session fixture, then prod SQL — confirm column-level REVOKE is in force (the PII-leak guard): `SELECT attname, attacl FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname IN ('full_name','email','phone','lat','lng','location','zip') AND NOT attisdropped;` → expected: `attacl` does NOT grant SELECT on these columns to `anon`/`authenticated` broadly (per profiles-pii-revoke pattern). `pg_attribute.attacl` is authoritative — `column_privileges` can falsely return [].
- [ ] Prod SQL — confirm SECDEF + search_path on profile RPCs: `SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname IN ('get_my_profile','get_my_private_profile','get_my_coordinates');` → expected: `prosecdef=true`, `proconfig` has `search_path=`
- [ ] Playwright — load Settings as user A, edit display name, Save, reload → expected: name persists. (Prod write to own profile row; cleanup: restore original name in test teardown.)
- [ ] Cross-user leak probe — as user A, attempt `supabase.from('profiles').select('full_name,email').neq('id', A.id).limit(1)` → expected: no PII columns returned for other rows (RLS gates rows, column grant gates cols). Read-only, no cleanup.

## 6. PASS criteria + residuals
- PASS when: own private profile loads via `get_my_private_profile`; profile save persists and is `.eq('id', user.id)`-scoped; coordinates served only via `get_my_coordinates` (direct lat/lng SELECT REVOKEd); a cross-user PII column read returns nothing; profile RPCs are SECDEF with pinned search_path.
- Known residuals: realtime is intentionally OFF on `profiles` (Realtime WAL bypasses column_privileges — keeping it off avoids the leak path). Notification-preference persistence shares the profiles update path; verify the specific pref columns are in the update payload.
