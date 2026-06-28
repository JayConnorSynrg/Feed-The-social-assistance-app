# MISSION 15 — Reviews & Harmony   | owner: feed-resources-expert | tier: P2
> One-line: after a completed exchange (opt-in or conversation), a participant submits a star rating + comment via a SECDEF RPC, and the reviewee's harmony badge updates — while a client can NEVER forge `harmony_score` directly.

## 1. Backend surface
- RPCs:
  - `submit_review(p_rating int, p_would_recommend bool, p_comment text, p_opt_in_id uuid | p_conversation_id uuid)` — server derives reviewer/reviewee from `auth.uid()` + participant data, inserts into `reviews`, triggers harmony recompute — SECDEF — `supabase/migrations/20260604150000_reviews_and_harmony.sql:181`. Grants: `REVOKE EXECUTE … FROM PUBLIC, anon; GRANT … TO authenticated` (:268-270). `SET search_path = public, pg_temp` (:190).
  - `recompute_harmony()` — SECDEF trigger fn; recomputes `profiles.harmony_score` + `harmony_reviews_count` as the table owner (bypasses column-level REVOKE) — `…reviews_and_harmony.sql:96-125`. `SET search_path = public, pg_temp` (:100).
  - `get_my_conversation_review(p_conversation_id uuid)` — fetch caller's review for a conversation (returns {} not null on miss — guard at hook) — `supabase/migrations/20260609100100_conversation_reviews.sql`.
- Edge functions: none.
- Tables:
  - `reviews` — one review per (reviewer, exchange); RLS yes — SELECT/UPDATE/DELETE policies at `…reviews_and_harmony.sql:152-176`; INSERT has NO policy (writes go only through `submit_review` SECDEF) — header note in `use-reviews.ts:6-8`.
  - `profiles.harmony_score numeric(3,2)` + `harmony_reviews_count` — computed columns; **forge-protected** (see §3).

## 2. User-facing surfaces + interaction points
- `MessagesPanel` / opt-in management list → "Review seeker" / "Review sourcer" button → star-rating modal (rating, would-recommend, comment) → submit.
- Harmony badge on profile/post cards — reads `profiles.harmony_score`.

## 3. Backend→Surface binding map
- Review submit (opt-in path) → `submitReview({ optInId, rating, comment })` → `supabase.rpc('submit_review', { p_rating, p_would_recommend, p_comment, p_opt_in_id })` (`apps/web/src/hooks/use-reviews.ts:65-72`).
- Review submit (conversation path) → same hook with `p_conversation_id` (`use-reviews.ts:71`).
- Harmony recompute → server-side: `submit_review` → `recompute_harmony()` trigger updates `profiles.harmony_score` (:125). No client RPC.
- Already-reviewed check (opt-in) → `fetchMyReviewsForOptIns(ids)` → `supabase.from('reviews').select('*').in('opt_in_id',ids).eq('reviewer_id',user.id)` (`use-reviews.ts:111-116`).
- Already-reviewed check (conversation) → `fetchMyReviewForConversation` → `rpc('get_my_conversation_review')` with `{}`-vs-null guard (`use-reviews.ts:146-157`).
- Harmony badge display → `supabase.from('profiles').select('harmony_score, harmony_reviews_count')` (anon+authenticated SELECT granted at `…reviews_and_harmony.sql:20-21`).

### harmony_score FORGE PROTECTION (critical)
A client must NOT be able to write `profiles.harmony_score`. Column-level `REVOKE` alone is a no-op under a table-level UPDATE grant — so the migration REVOKEs the whole-table UPDATE then GRANTs UPDATE on an explicit allow-list of columns that EXCLUDES `harmony_score`/`harmony_reviews_count`:
- `REVOKE UPDATE ON public.profiles FROM authenticated, anon;` (`…reviews_and_harmony.sql:38-39`)
- `GRANT UPDATE (username, full_name, avatar_url, bio, venmo_username, paypal_email, location_city, location_state, updated_at, zip_code, latitude, longitude, needs, onboarding_completed, phone, user_role) ON public.profiles TO authenticated;` (:40-58) — `harmony_score`/`harmony_reviews_count` are absent → client UPDATE of them returns 42501.
- Only `recompute_harmony()` (SECDEF, runs as owner) may set them (:125).

## 4. Dependencies
- upstream: a completed exchange (opt-in `status='completed'` OR a conversation with a counterparty); authenticated user; `submit_review` + `recompute_harmony` deployed with pinned search_path.
- downstream: Mission 2 Profiles (harmony badge), Mission 5 Feed / Mission 6 Messages (review prompts after completion).

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "REVOKE UPDATE ON public.profiles|GRANT UPDATE \(" supabase/migrations/20260604150000_reviews_and_harmony.sql` → expected: whole-table UPDATE revoked then column allow-list granted.
- [ ] `grep -nE "harmony_score|harmony_reviews_count" supabase/migrations/20260604150000_reviews_and_harmony.sql` → expected: appears as a computed column + in recompute body, NEVER inside the `GRANT UPDATE (...)` allow-list (:40-58).
- [ ] `grep -nE "SECURITY DEFINER|SET search_path|REVOKE EXECUTE.*submit_review|GRANT  EXECUTE.*submit_review" supabase/migrations/20260604150000_reviews_and_harmony.sql` → expected: SECDEF + pinned search_path + execute revoked from PUBLIC/anon, granted to authenticated (:189-270).
- [ ] `grep -n "submit_review" apps/web/src/hooks/use-reviews.ts` → expected: client writes ONLY via RPC (:66), never a direct `from('reviews').insert`.
- [ ] `read apps/web/e2e/review-harmony.spec.ts:1-25` → expected: 5 scenarios incl. duplicate-review blocked + bidirectional harmony badge update.

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Prod SQL — **forge proof via pg_attribute.attacl (authoritative for column grants; `information_schema.column_privileges` can falsely return [])**:
  `select a.attname, a.attacl from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='profiles' and a.attname in ('harmony_score','harmony_reviews_count','full_name');`
  → expected: `full_name` carries an UPDATE grant for `authenticated`; `harmony_score`/`harmony_reviews_count` do NOT (no `authenticated=…U…` ACL entry) → client UPDATE blocked.
- [ ] Prod SQL — confirm reviews INSERT has no policy: `select cmd, polname from pg_policies where tablename='reviews';` → expected: SELECT/UPDATE/DELETE only, no INSERT row (writes funnel through SECDEF).
- [ ] Prod SQL — function hardening: `select proname, prosecdef, proconfig from pg_proc where proname in ('submit_review','recompute_harmony');` → expected: `prosecdef=true` and `proconfig` contains `search_path=public, pg_temp` for both.
- [ ] Playwright E2E: `npx playwright test apps/web/e2e/review-harmony.spec.ts --reporter=line` → expected: 5 scenarios green. PROD-WRITE: provisions 2 test users + post + opt-in (completed) + reviews; CLEANUP: spec teardown deletes seeded users/posts/reviews via admin API.

## 6. PASS criteria + residuals
- PASS when: a participant submits a review only through `submit_review`; the reviewee's `harmony_score`/`harmony_reviews_count` update via the SECDEF trigger; a second review of the same exchange by the same reviewer is rejected with a friendly error; a direct client UPDATE of `profiles.harmony_score` fails (42501), proven via `pg_attribute.attacl` showing no authenticated grant on that column; both functions are SECDEF with pinned search_path.
- Known residuals: none — forge path is closed at the column-grant layer and verified via attacl (not the unreliable `column_privileges` view).
