# MISSION 8 — Petitions   | owner: feed-data-flow-analyzer | tier: P1
> One-line: a member views a petition with its live signature count, signs it once (server-stamped ESIGN with version-hash + retention metadata), sees the counter tick up live, and can withdraw before the organizer exports.

## 1. Backend surface
- RPCs:
  - `get_petition_signature_count(p_petition_id uuid)` — current signature tally — SECDEF — `supabase/migrations/20260608000200_petitions_and_signatures.sql:95` (SECDEF :98)
  - `has_signed_petition(p_petition_id uuid)` — whether the caller already signed — SECDEF — `supabase/migrations/20260608000200_petitions_and_signatures.sql:112` (SECDEF :115)
  - `withdraw_petition_signature(p_petition_id uuid)` — caller withdraws their signature (locked once exported) — `supabase/migrations/20260613000000_petition_signatures_admin_export_withdraw.sql:120`
  - `get_petition_signatures(petition_id)` / `export_petition_signatures(petition_id)` — organizer/admin signer list + export (see Mission 17/admin) — `supabase/migrations/20260613000000_petition_signatures_admin_export_withdraw.sql`
- Edge functions: none. Signing goes through a Next.js API route, not a Deno edge function.
- API route: `POST /api/petitions/sign` — server-stamped ESIGN/UETA-aligned handler: requires affirmation, captures `petition_version_hash`, `ip_address`, `user_agent`, `signed_at`; uses service-role client to insert — `apps/web/src/app/api/petitions/sign/route.ts:1-160`
- Tables:
  - `petitions` — petition definition (status, target_signatures, body_version_hash, exported_at/by) — RLS yes — `supabase/migrations/20260608000200_petitions_and_signatures.sql`
  - `petition_signatures` — one signature row per signer (unique per petition+user) — RLS yes; realtime YES (`supabase/migrations/20260608000200_petitions_and_signatures.sql:141`)

## 2. User-facing surfaces + interaction points
- `PetitionsPanel` (`apps/web/src/components/panels/petitions-panel.tsx`) — reached as a subtab of FeedPanel via PANEL_ALIASES `petitions → feed#petitions`. Interaction points: petition list/detail, signature counter, Sign (with affirmation), Withdraw.

## 3. Backend→Surface binding map
- Petition list load → `supabase.from('petitions').select('id, title, summary, ..., body_version_hash, status, exported_at, exported_by')` (`apps/web/src/hooks/use-petitions.ts:63-65`)
- Per-petition count + signed state (parallel) → `rpc('get_petition_signature_count', { p_petition_id })` (`use-petitions.ts:88`) + `rpc('has_signed_petition', { p_petition_id })` (`use-petitions.ts:95`)
- Live counter → `supabase.channel(petition_signatures_changes_<rand>)` on `{ event: 'INSERT', table: 'petition_signatures' }` (`apps/web/src/hooks/use-petitions.ts:135-139`); unique channel id per mount (`:44`) prevents multi-mount collisions; cleanup `removeChannel` (`:162-164`)
- Sign button → optimistic count++ → `fetch('/api/petitions/sign', { ..., signal: AbortSignal.timeout(20_000) })` (`apps/web/src/hooks/use-petitions.ts:208-212`); route inserts into `petition_signatures` server-side (`route.ts:122-135`) → realtime INSERT fires the live counter
- Withdraw → `rpc('withdraw_petition_signature', { p_petition_id })` (locked once `exported_at` is set)

## 4. Dependencies
- upstream (this feature needs): Mission 1 Auth (session for `/api/petitions/sign` + RLS); `SUPABASE_SERVICE_ROLE_KEY` available to the API route (service-role insert); Realtime + `supabase_realtime` publication containing `petition_signatures`; Mission 2 Profiles (first-name read for public signer display, `route.ts:96`).
- downstream (depend on this): Mission 18 Dashboard (`dashboard_petition_momentum` reads signature velocity); admin export flow (Mission 17/admin) consumes `export_petition_signatures` and sets `exported_at` which locks withdrawal.

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "channel\(channelIdRef|petition_signatures|removeChannel" apps/web/src/hooks/use-petitions.ts` → expected: unique per-mount channel id (:44), INSERT subscription (:135-139), removeChannel cleanup (:162-164)
- [ ] `grep -nE "rpc\('get_petition_signature_count'|rpc\('has_signed_petition'" apps/web/src/hooks/use-petitions.ts` → expected: both RPCs (:88, :95)
- [ ] `grep -nE "/api/petitions/sign|AbortSignal.timeout" apps/web/src/hooks/use-petitions.ts` → expected: POST with 20s timeout (:208-212)
- [ ] `grep -nE "petition_version_hash|ip_address|user_agent|signed_at|serviceClient|23505" apps/web/src/app/api/petitions/sign/route.ts` → expected: ESIGN metadata captured + service-role insert (:122-135) + 23505 already-signed branch (:138)
- [ ] `grep -nE "ALTER PUBLICATION supabase_realtime ADD TABLE public.petition_signatures" supabase/migrations/20260608000200_petitions_and_signatures.sql` → expected: line 141 present (live count works)
- [ ] `grep -nE "FUNCTION public.(get_petition_signature_count|has_signed_petition)|SECURITY DEFINER" supabase/migrations/20260608000200_petitions_and_signatures.sql` → expected: both functions SECDEF (:95/:98, :112/:115)

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Realtime publication membership (prod SQL, read-only): `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='petition_signatures';` → expected: 1 row (live counter can fire).
- [ ] Live-count probe (two-client): client A on PetitionsPanel viewing petition P; client B signs P via `/api/petitions/sign` → expected: client A's counter increments with no refresh (realtime INSERT). Cleanup: client B `select withdraw_petition_signature('P')` (prod write, self-reversing — only if P not yet exported).
- [ ] Server-stamp integrity (prod SQL after a test sign): `select petition_version_hash, ip_address, user_agent, signed_at from petition_signatures where petition_id=$P order by signed_at desc limit 1;` → expected: all four columns populated server-side (client cannot forge). Cleanup: withdraw as above.
- [ ] Double-sign guard: POST `/api/petitions/sign` twice for the same user/petition → expected: second returns the 23505 already-signed path returning current count, not a duplicate row (`route.ts:138-145`).
- [ ] Playwright: `npx playwright test apps/web/e2e/community-petitions.spec.ts apps/web/e2e/petition-signatures-admin.spec.ts` → expected: both pass (sign flow + admin export/withdraw-lock).

## 6. PASS criteria + residuals
- PASS when: `petition_signatures` is in `supabase_realtime`; count + has-signed RPCs are SECDEF and return correct values; `/api/petitions/sign` server-stamps version-hash + ip + user_agent + signed_at and blocks double-sign with 23505; the live counter increments on a B-client sign with no refresh; withdrawal works before export and is locked after `exported_at`; both petition E2E specs pass.
- Known residuals: signing depends on `SUPABASE_SERVICE_ROLE_KEY` being present in the Next.js route runtime (env-bound — verify in Vercel prod env, not just locally). Withdrawal lock-after-export is enforced in `withdraw_petition_signature`; confirm the LIVE function body post-deploy since the lock condition is migration-defined.
