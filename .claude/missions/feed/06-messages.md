# MISSION 6 — Messages   | owner: feed-messages-expert | tier: P1
> One-line: a seeker can request a volunteer's resource, the two parties exchange messages that arrive live, and a duplicate pending request to the same counterparty is prevented.

## 1. Backend surface
- RPCs:
  - `get_my_conversation_counterparties()` — returns each conversation with the OTHER participant's first-name only (name-privacy lockdown) — SECDEF — `supabase/migrations/20260612000000_profiles_name_privacy_expand.sql:154`
  - `get_conversation_counterparty(conversation_id)` — single-conversation counterparty resolver — SECDEF
  - `get_my_conversation_review(conversation_id)` — fetch the post-conversation review for this conversation (see Mission 15)
- Edge functions: none (messaging is PostgREST insert + Realtime; no Deno function).
- Tables:
  - `conversations` — one row per seeker↔volunteer thread; partial unique index enforces one PENDING request per pair — RLS yes; realtime YES (`supabase/migrations/20260527000001_add_volunteer_messaging.sql:143`)
  - `messages` — individual message rows — RLS yes; realtime YES (`supabase/migrations/20260527000001_add_volunteer_messaging.sql:144`)
  - `conversation_reviews` — post-conversation review join (Mission 15)

## 2. User-facing surfaces + interaction points
- `MessagesPanel` (`apps/web/src/components/panels/messages-panel.tsx`) — reached as a subtab of FeedPanel via PANEL_ALIASES `messages → feed#messages`. Interaction points: conversation list, open conversation, message input + Send, accept/decline a pending request, request-resource entry.

## 3. Backend→Surface binding map
- Panel mount → load conversations → `supabase.rpc('get_my_conversation_counterparties')` (`apps/web/src/hooks/use-conversations.ts:115`)
- Live conversation list (volunteer side) → `supabase.channel('conv-vol-${user.id}')` (`apps/web/src/hooks/use-conversations.ts:171`)
- Live conversation list (requester side) → `supabase.channel('conv-req-${user.id}')` (`apps/web/src/hooks/use-conversations.ts:188`)
- Open a conversation → subscribe to its messages → `supabase.channel('msg-${id}')` (`apps/web/src/hooks/use-conversations.ts:235`); previous channel unsubscribed first (:227) and on unmount (:258)
- Initial messages load → `supabase.from('messages').select(...)` (`apps/web/src/hooks/use-conversations.ts:151`)
- Request resource (create thread) → `supabase.from('conversations').insert({...})` (`apps/web/src/hooks/use-conversations.ts:279-280`) — guarded by the partial unique index against duplicate pending requests
- Accept / decline / update thread state → `supabase.from('conversations').update(...)` (`use-conversations.ts:327`, `:346`, `:365`, `:388`, `:407`)
- Send message → `supabase.from('messages').insert({...})` (`apps/web/src/hooks/use-conversations.ts:300-301` and `:433-434`); `isSending` set true before, reset in `finally` (:315, :336, :355, :374, :397, :416, :446)

## 4. Dependencies
- upstream (this feature needs): Mission 1 Auth (`auth.uid()` for both-participant RLS); Realtime + `supabase_realtime` publication containing `conversations` AND `messages`; profiles first-name read path (name-privacy RPC).
- downstream (depend on this): Mission 15 Reviews & Harmony (review prompt fires at conversation end → `get_my_conversation_review`).

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "isSending|finally|setIsSending" apps/web/src/hooks/use-conversations.ts` → expected: `setIsSending(true)` paired with a reset inside `finally` for every mutation (no stuck-spinner-on-error). State at :82; finally blocks at :315/:336/:355/:374/:397/:416/:446
- [ ] `grep -nE "channel\('conv-vol|channel\('conv-req|channel\('msg-|removeChannel|unsubscribe" apps/web/src/hooks/use-conversations.ts` → expected: 3 distinct channels + teardown of prior message channel (:227) and unmount cleanup (:258)
- [ ] `grep -nE "from\('conversations'\)\s*\.insert" apps/web/src/hooks/use-conversations.ts` → expected: insert at :279-280 (request creation guarded by unique index)
- [ ] `grep -nE "ALTER PUBLICATION supabase_realtime ADD TABLE public.(conversations|messages)" supabase/migrations/20260527000001_add_volunteer_messaging.sql` → expected: both at :143 and :144
- [ ] `grep -nE "UNIQUE INDEX.*conversations|status.*pending" supabase/migrations/20260527000001_add_volunteer_messaging.sql` → expected: partial unique index restricting one pending request per participant pair

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Realtime publication membership (prod SQL, read-only): `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename in ('conversations','messages');` → expected: BOTH rows returned (live message delivery works).
- [ ] Live-update probe (two-client): client A has conversation open (subscribed `msg-${id}`); client B inserts a message into that conversation → expected: client A renders the new message with no refresh. Cleanup: `delete from messages where content='__verify_realtime__'` (prod write — use marked test content).
- [ ] Duplicate-request guard (prod SQL): with an existing PENDING conversation for a pair, attempt a second `insert into conversations(...)` for the same pair/status → expected: `23505` unique violation (duplicate prevented). No durable write (insert rejected). Run against a disposable test pair only.
- [ ] Counterparty privacy (prod SQL): `select * from get_my_conversation_counterparties();` as a test user → expected: only FIRST name of the other participant exposed (no last name / email leak).
- [ ] Playwright (closest existing surface): `npx playwright test apps/web/e2e/conversation-reviews.spec.ts` → expected: pass (exercises a conversation lifecycle through to the review prompt; no dedicated messages-send spec exists yet).

## 6. PASS criteria + residuals
- PASS when: both `conversations` and `messages` are in `supabase_realtime`; a B-client message appears live on the A-client; every send mutation resets `isSending` in `finally`; a duplicate pending request raises `23505`; `get_my_conversation_counterparties` exposes first-name only; conversation-reviews E2E passes.
- Known residuals: no dedicated Playwright spec for the message-send realtime path (covered by two-client SQL probe + conversation-reviews spec). The `isSending` stuck-on-error bug is the historically-known failure mode for this subsystem — re-verify the `finally` coverage after any edit to `use-conversations.ts`.
