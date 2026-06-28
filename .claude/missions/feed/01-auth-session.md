# MISSION 1 — Auth & Session   | owner: feed-auth-debugger | tier: P0
> One-line: a user can sign in (email + Google OAuth + anonymous guest), have their session refreshed and route-guarded on every request, and a profile row exists for them — proving the entire authenticated surface other missions depend on.

## 1. Backend surface
- RPCs:
  - `get_my_profile()` — fetch own profile row — SECDEF — defined in `supabase/migrations/20260601043054_harden_security_definer_fns.sql`
  - `get_my_private_profile()` — fetch own email/phone/PII fields — SECDEF — consumed at `apps/web/src/components/panels/settings-panel.tsx:1066`
  - `is_current_user_admin()` — admin route gate — SECDEF — consumed by `apps/web/src/app/(admin)/layout.tsx`
- Edge functions:
  - `delete-account` — irreversible account + data teardown — browser-invoked — `supabase/functions/delete-account/index.ts`; called from `apps/web/src/components/panels/settings-panel.tsx:764` via raw `fetch(${SUPABASE_URL}/functions/v1/delete-account)`
  - `auth-guard` — validates Bearer JWT for protected calls — browser-invoked — `supabase/functions/auth-guard/index.ts`
  - `validate-password` — HIBP + complexity check on signup/reset — browser-invoked — `supabase/functions/validate-password/index.ts`
- Tables:
  - `profiles` — user profile, created on signup — RLS yes, realtime off — created by `handle_new_user` trigger on `auth.users`
  - `auth_login_attempts`, `account_lockouts` — lockout tracking — RLS — consumed by `apps/web/src/app/api/auth/check-lockout/route.ts`

## 2. User-facing surfaces + interaction points
- Login page (`apps/web/src/app/(auth)/login/page.tsx`) — interaction points: email/password form submit, "Continue with Google" button, "Continue as guest" button, "Forgot password" link
- Signup page (`apps/web/src/app/(auth)/signup/page.tsx`) — interaction points: email/password registration, password-strength gate
- Onboarding (`apps/web/src/app/(auth)/onboarding/page.tsx`) — interaction points: first run profile completion (gated by middleware redirect)
- Forgot/reset password (`apps/web/src/app/(auth)/forgot-password/`, `reset-password/`) — interaction points: request reset, set new password
- Middleware `apps/web/src/proxy.ts` — runs on every request: session refresh + route guard (Next.js 15 uses `proxy.ts` for middleware)
- AuthProvider (`apps/web/src/providers/auth-provider.tsx`) — interaction points: `onAuthStateChange` subscription, `getSession()` boot, exposed `signOut()`
- SettingsPanel (`apps/web/src/components/panels/settings-panel.tsx`) — interaction points: sign-out, delete-account

## 3. Backend→Surface binding map
- Email sign-in form submit → `supabase.auth.signInWithPassword(...)` — `apps/web/src/app/(auth)/login/page.tsx:100`
- Google OAuth button → `supabase.auth.signInWithOAuth({ provider: 'google' })` — `apps/web/src/app/(auth)/login/page.tsx:189` (handler `handleOAuthLogin` at `:181`)
- Guest button → `supabase.auth.signInAnonymously()` — `apps/web/src/app/(auth)/login/page.tsx:222`
- Every request → `supabase.auth.getUser()` for session validation + route guard — `apps/web/src/proxy.ts:82`; redirects: unauthenticated→`/login` (`:175`), already-auth→`/` (`:186`), onboarding-incomplete→`/onboarding` (`:157`), mfa-required→`/login?step=mfa` (`:105`)
- App boot → `supabase.auth.getSession()` raced against 5s timeout + `onAuthStateChange` fallback — `apps/web/src/providers/auth-provider.tsx:106`
- Delete account → raw `fetch(${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account)` then `signOut()` + `router.push('/login')` — `apps/web/src/components/panels/settings-panel.tsx:764,785,786`
- Private profile load → `supabase.rpc('get_my_private_profile')` — `apps/web/src/components/panels/settings-panel.tsx:1066`
- New signup → `handle_new_user` DB trigger fires → inserts `profiles` row

## 4. Dependencies
- upstream (this feature needs): Supabase Auth (email + Google provider configured in dashboard); OAuth redirect URLs registered in both Google console AND Supabase; anonymous-auth enabled; `NEXT_PUBLIC_SUPABASE_URL` / anon key env vars; `handle_new_user` trigger present
- downstream (depend on this): EVERY other mission. Profiles & Settings (M2), AI Chat (M3, sends Bearer token), Resource Map (M4, RPCs are auth-scoped). This mission's 5b authenticated-session probe is reused by M2/M3/M4.

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "signInWithPassword\|signInWithOAuth\|signInAnonymously" apps/web/src/app/\(auth\)/login/page.tsx` → expected: all three present (lines 100, 189, 222)
- [ ] `grep -n "supabase.auth.getUser\|NextResponse.redirect" apps/web/src/proxy.ts` → expected: `getUser()` at :82 + redirect branches for unauthenticated/already-auth/onboarding
- [ ] `grep -n "onAuthStateChange\|getSession" apps/web/src/providers/auth-provider.tsx` → expected: both present; getSession raced with timeout (:98-:114)
- [ ] `grep -n "functions/v1/delete-account\|signOut\|router.push('/login')" apps/web/src/components/panels/settings-panel.tsx` → expected: delete fetch :764, signOut :785, push :786 (explicit push proves SPA sign-out navigation, per auth-fixes pattern)
- [ ] `grep -rn "handle_new_user" supabase/migrations` → expected: trigger function + `AFTER INSERT ON auth.users` binding
- [ ] `grep -n "config\|matcher" apps/web/src/proxy.ts` → expected: matcher config excludes static assets so guard runs on app routes only

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] **AUTHENTICATED-SESSION PROBE (canonical — reused by M2/M3/M4)**: run `npx playwright test apps/web/e2e/auth.spec.ts` against the dev server → expected: email login lands on `/`, session cookie set, no redirect loop. The resulting storage-state is the authenticated fixture other missions reuse (see `apps/web/e2e/fixtures` / `helpers`).
- [ ] Prod SQL — confirm SECDEF + pinned search_path on the auth RPCs: `SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname IN ('get_my_profile','get_my_private_profile','is_current_user_admin');` → expected: `prosecdef=true` AND `proconfig` contains a `search_path=` entry for each
- [ ] Prod SQL — confirm signup trigger is live: `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE '%handle_new_user%';` → expected: one row bound to `auth.users`
- [ ] Edge-fn smoke — `delete-account` rejects without Bearer: `curl -i -X POST ${SUPABASE_URL}/functions/v1/delete-account` → expected: 401/403 (NOT 200) — proves in-code auth gate. (No prod write — request is rejected pre-execution.)
- [ ] Guest path — in Playwright, click "Continue as guest" → expected: anonymous session established, lands on app. (Creates an anonymous auth.users row; cleanup: delete the anon user via admin API after test.)

## 6. PASS criteria + residuals
- PASS when: email + Google + guest sign-in all reach `/`; middleware redirects unauthenticated→`/login` and authenticated-away-from-login→`/`; `auth.spec.ts` green; the three auth RPCs are SECDEF with pinned search_path; `handle_new_user` trigger present; delete-account rejects unauthenticated calls.
- Known residuals: Google OAuth redirect URL correctness is environment-config, not code — verify in Supabase dashboard before each deploy (Error Prevention Matrix: OAuth redirect mismatch). Apple OAuth wired (`handleOAuthLogin('apple')`) but provider enablement is config-gated.
