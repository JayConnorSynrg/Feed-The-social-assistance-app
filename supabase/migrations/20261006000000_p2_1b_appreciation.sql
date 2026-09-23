-- 20261006000000_p2_1b_appreciation.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-p2-1b-appreciation
--
-- Peer appreciation gifts on the P2.1a engagement ledger (20261005000000). A giver
-- sends one of 12 small "gifts" to another member; the RECEIVER earns the public
-- community badge "Appreciated" (level only, thresholds from badge_config). WHO gave
-- WHICH gift to whom is visible ONLY to the two parties (RLS), never to a third party.
--
-- USER RULING: the public "Appreciated" LEVEL counts DISTINCT PEOPLE who gave, not gifts —
-- the receiver's badge:appreciated counter = the number of distinct non-guest givers who have
-- ever sent them at least one item, exactly once per (receiver, giver), never per item, never
-- zero for a giver who gave. All 12 items stay individually giftable (UNIQUE(giver,receiver,
-- item)) and all still show on the receiver's private shelf; only the public counting changes.
--
-- Replay-safe on PG15 (local) and PG17.6 (prod). Every statement is idempotent; no
-- PG16/17-only syntax. Wrapped in BEGIN/COMMIT with a bounded lock wait. No publication
-- change (the new table is never added to supabase_realtime).
--
-- ============================================================================
-- INVARIANTS (derived per-site, not pattern-matched)
--   I1  AT-MOST-ONCE PER (giver, receiver, item). UNIQUE(giver_id,receiver_id,item) +
--       ON CONFLICT DO NOTHING in give_appreciation → re-gifting the same item is an
--       idempotent no-op that returns the existing row (created=false). One gift row per
--       (giver, receiver, item) (never zero, never twice); all 12 items remain giftable.
--   I2  SERVER-ONLY WRITES. appreciation_gifts has NO client write policy and table-level
--       REVOKE ALL; only the SECDEF give_appreciation RPC (owner) inserts. Gifts are
--       PERMANENT (Sprouts ethics) — there is no UPDATE/DELETE path. A guest (JWT
--       is_anonymous) and anon cannot GIVE (RPC raises); a guest RECEIVER is rejected with
--       the same generic 'Recipient not found' as a nonexistent recipient (MEDIUM-2 — no
--       guest-status oracle); anon cannot execute the RPC.
--   I3  ONE LEDGER EVENT PER DISTINCT (RECEIVER, GIVER), CREDITED TO THE RECEIVER, keyed
--       target_id = giver_id (USER RULING: the public "Appreciated" LEVEL counts distinct
--       PEOPLE, not gifts). The ledger UNIQUE(actor_id,kind,target_id) with actor=receiver,
--       target=giver makes the FIRST gift from a giver the only counted event; every later
--       gift from the same giver still creates its gift row (I1) but adds no credit (ON
--       CONFLICT no-op). So badge:appreciated counter = number of distinct non-guest givers,
--       exactly once per pair. reconcile_engagement rebuilds identical counts by iterating
--       DISTINCT (receiver_id, giver_id) from appreciation_gifts with the same actor/kind/
--       target/source_pk. (This realises the reserved P2.1a header line 71 target=giver.)
--   I3a ACCOUNT DELETION OF A GIVER — awards never disappear (Sprouts ethics). The credit is
--       a ledger row keyed (actor=receiver, kind, target_id=giver): target_id has NO FK
--       (engagement_events.target_id is a bare uuid), so deleting the giver's auth.users row —
--       which CASCADEs their profiles row and thus their appreciation_gifts rows away — does
--       NOT delete the receiver's credit. recompute_user_engagement derives the counter from
--       the surviving ledger row, so the count is stable. reconcile_engagement is ADDITIVE
--       ONLY (ON CONFLICT DO NOTHING; it never DELETEs a ledger row) — consistent with every
--       other kind (P2.1a Round-3 fix 8 / LOW-8: a like/comment credit likewise survives its
--       source deletion, because reconcile only inserts). The nightly job therefore never
--       drops a credit for a deleted giver. The ONLY way a deleted-giver credit is not
--       reconstructed is a destructive "wipe the ledger then rebuild from current source" —
--       a test-only harness path (used to prove wipe+rebuild parity when all gifts are
--       present), never reachable in production. CHOICE (documented): production honours
--       "awards never disappear"; reconcile-from-source is inherently limited to surviving
--       source rows, exactly like every other kind.
--   I4  PUBLIC LEVEL, PRIVATE EDGE. appreciation_gift is PUBLIC in engagement_is_public,
--       so the RECEIVER's badge LEVEL lands in profiles.badge_summary (levels only, no
--       count — the P2.1a public-summary floor). The giver→receiver EDGE lives ONLY in
--       appreciation_gifts, whose RLS restricts every row to its two parties; no view,
--       grant, or SECDEF function exposes an edge to a third party.
--       TIMING CHANNEL (evaluated): a public credit calls recompute_badge_summary(receiver),
--       which rewrites profiles.badge_summary — and bumps profiles.updated_at — ONLY when
--       the receiver's "appreciated" LEVEL changes (at 3/10/25, per badge_config), never
--       per gift, and the write carries no giver identity. appreciation_gifts.created_at
--       is NOT readable by a third party (RLS), so it cannot be joined to updated_at. The
--       bump is indistinguishable from every other public badge threshold crossing
--       (voice/helper/connector already bump updated_at the same way). CONCLUSION: no new
--       giver→receiver channel; acceptable without mitigation. This is the SAME lens that
--       made "watcher" private in P2.1a — there, a granted verified_at column equalled the
--       bumped updated_at and unmasked the reporter; here the gift timestamp is ungranted
--       to third parties, so the equivalent join is impossible.
--   I5  ANY signed-in non-guest may give (user ruling); no activity gate beyond non-guest.
--   I6  LOCK ORDER. give_appreciation credits ONLY the receiver; record_engagement_event
--       → recompute_badge_summary(receiver) takes profiles(receiver) FOR NO KEY UPDATE and
--       nothing else (appreciation_gift is public, so no private-summary lock). A single
--       profile lock cannot deadlock with the P2.1a paths (which lock profiles in uuid
--       order, then the private summary) — this path never holds a second profile lock.
--   I7  UI DOES SOMETHING. Every element shipped is wired to this RPC / these reads.
--
-- ============================================================================
-- CROSSWALK to P2.1a header (line 71):
--   RESERVED (P2.1a): appreciation_gift | actor=recipient | target=giver | private
--   THIS WAVE:        appreciation_gift | actor=receiver  | target=giver | PUBLIC (level)
--       wt 1, family none, community dim badge:appreciated, verified no.
--   Rationale (USER RULING): the public "Appreciated" LEVEL counts distinct PEOPLE who gave,
--   so target=giver is exactly right — UNIQUE(actor=receiver, kind, target=giver) yields
--   one-credit-per-pair for free (the reserved design's target). All 12 items stay giftable
--   (per-item UNIQUE(giver,receiver,item) on appreciation_gifts) and shelf-visible; only the
--   public COUNT is distinct-people. PUBLIC (not private) because the ruling makes the EARNED
--   LEVEL public; the private part (who gave what) is enforced by appreciation_gifts RLS, not
--   by ledger scope.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1. appreciation_gifts table ─────────────────────────────────────────────
-- giver_id/receiver_id reference public.profiles(id) (NOT auth.users) so PostgREST can
-- embed the giver's first_name/avatar for the receiver's shelf, AND so account deletion
-- cascades: profiles.id → auth.users(id) is ON DELETE CASCADE (verified live), so deleting
-- the auth user removes the profile which removes their gifts. post_id → posts ON DELETE
-- SET NULL keeps the gift (permanent) when its source post is removed.
CREATE TABLE IF NOT EXISTS public.appreciation_gifts (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  giver_id    uuid        NOT NULL,
  receiver_id uuid        NOT NULL,
  item        text        NOT NULL,
  post_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appreciation_gifts_giver_fk
    FOREIGN KEY (giver_id)    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT appreciation_gifts_receiver_fk
    FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT appreciation_gifts_post_fk
    FOREIGN KEY (post_id)     REFERENCES public.posts(id)    ON DELETE SET NULL,
  CONSTRAINT appreciation_gifts_not_self  CHECK (giver_id <> receiver_id),
  CONSTRAINT appreciation_gifts_item_chk  CHECK (item IN (
    'heart','smile','cheer','flower','sunflower','leaf',
    'bread','apple','soup','sun','seedling','tree'
  )),
  CONSTRAINT appreciation_gifts_once UNIQUE (giver_id, receiver_id, item)
);
CREATE INDEX IF NOT EXISTS idx_appreciation_gifts_receiver ON public.appreciation_gifts (receiver_id);
CREATE INDEX IF NOT EXISTS idx_appreciation_gifts_giver    ON public.appreciation_gifts (giver_id);

-- ── 2. classifier extensions (CREATE OR REPLACE preserves grants) ────────────
-- appreciation_gift → community dimension badge:appreciated.
CREATE OR REPLACE FUNCTION public.engagement_community_dim(p_kind text)
  RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_kind
    WHEN 'comment'                        THEN 'badge:voice'
    WHEN 'opt_in_completed_provider'      THEN 'badge:helper'
    WHEN 'conversation_completed_volunteer' THEN 'badge:connector'
    WHEN 'petition_signature'             THEN 'badge:advocate'
    WHEN 'safety_alert_verified'          THEN 'badge:watcher'
    WHEN 'appreciation_gift'              THEN 'badge:appreciated'
    ELSE NULL
  END;
$fn$;

-- engagement_is_public — extends the P2.1a classifier with appreciation_gift (public level).
CREATE OR REPLACE FUNCTION public.engagement_is_public(p_kind text)
  RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  -- Public ONLY when another user can read the actor↔target link through a granted column
  -- (column grants, not just row RLS). safety_alert_verified is PRIVATE: safety_alerts
  -- .created_by has no client grant, but verified_at IS granted, so a public write would let
  -- anyone join profiles.updated_at = verified_at to unmask the hidden reporter. Watcher is
  -- therefore a private badge.
  -- appreciation_gift is PUBLIC (level only): the earned "Appreciated" LEVEL lands in
  -- profiles.badge_summary, while the giver→receiver EDGE stays private via appreciation_gifts
  -- RLS — no granted column exposes it (see I4) — so no third party can reconstruct who gave.
  SELECT p_kind IN (
    'like','poll_vote','follow','comment','post_created',
    'opt_in_completed_provider','conversation_completed_volunteer',
    'resource_approved','appreciation_gift'
  );
$fn$;

-- ── 3. give_appreciation RPC (SECDEF; the gift IS the core write → fail loudly) ─
-- Records the gift and, on a NEW row, the receiver's ledger credit ATOMICALLY (one txn).
-- Idempotent re-gift returns the existing row with created=false and writes nothing.
CREATE OR REPLACE FUNCTION public.give_appreciation(
  p_receiver uuid, p_item text, p_post_id uuid DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  SET lock_timeout = '5s'
AS $fn$
DECLARE
  v_giver       uuid := auth.uid();
  v_gift        public.appreciation_gifts%ROWTYPE;
  v_existing    public.appreciation_gifts%ROWTYPE;
  v_post_author uuid;
BEGIN
  IF v_giver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_giver AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required to send appreciation' USING ERRCODE = '42501';
  END IF;
  IF p_receiver IS NULL THEN
    RAISE EXCEPTION 'Recipient is required' USING ERRCODE = '22023';
  END IF;
  IF p_receiver = v_giver THEN
    RAISE EXCEPTION 'You cannot appreciate yourself' USING ERRCODE = '22023';
  END IF;
  -- MEDIUM-2: a guest (auth.users.is_anonymous) receiver is treated EXACTLY like a
  -- nonexistent recipient — same generic 'Recipient not found', no separate guest branch —
  -- so the caller cannot use the error to learn whether a target is a guest (no guest-status
  -- oracle; the minimal-leak choice). This also keeps every gift row backed by a credit:
  -- record_engagement_event silently skips anonymous ACTORS (the receiver is the actor here),
  -- so without this a guest receiver would get a gift row with no ledger credit.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    JOIN auth.users u ON u.id = pr.id
    WHERE pr.id = p_receiver AND u.is_anonymous IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Recipient not found' USING ERRCODE = '22023';
  END IF;
  IF p_item IS NULL OR p_item NOT IN (
      'heart','smile','cheer','flower','sunflower','leaf',
      'bread','apple','soup','sun','seedling','tree') THEN
    RAISE EXCEPTION 'Unknown appreciation item: %', COALESCE(p_item, '(null)') USING ERRCODE = '22023';
  END IF;
  IF p_post_id IS NOT NULL THEN
    -- LOW-1: the post is OPTIONAL context only. A valid gift from a signed-in non-guest to a
    -- real non-guest other member must SUCCEED regardless of the context post's visibility (a
    -- post can be hidden after the sheet loads; staff see hidden posts). If the referenced post
    -- is missing, hidden, or not authored by the recipient, silently DROP the context
    -- (p_post_id := NULL) instead of raising. This also removes every post oracle: missing,
    -- hidden, and wrong-author are now indistinguishable (all yield a gift with no post link),
    -- preserving the hidden-vs-nonexistent property the review required — no error tells the
    -- caller whether a post exists or is merely hidden.
    SELECT user_id INTO v_post_author
    FROM public.posts WHERE id = p_post_id AND is_hidden = false;
    IF v_post_author IS NULL OR v_post_author <> p_receiver THEN
      p_post_id := NULL;
    END IF;
  END IF;

  INSERT INTO public.appreciation_gifts (giver_id, receiver_id, item, post_id)
  VALUES (v_giver, p_receiver, p_item, p_post_id)
  ON CONFLICT (giver_id, receiver_id, item) DO NOTHING
  RETURNING * INTO v_gift;

  IF v_gift.id IS NULL THEN
    -- I1: idempotent no-op — the gift already exists. Return it, write nothing.
    SELECT * INTO v_existing FROM public.appreciation_gifts
      WHERE giver_id = v_giver AND receiver_id = p_receiver AND item = p_item;
    RETURN jsonb_build_object(
      'id', v_existing.id, 'item', v_existing.item,
      'created', false, 'created_at', v_existing.created_at);
  END IF;

  -- I3 (USER RULING): the public "Appreciated" counter counts DISTINCT PEOPLE, not gifts.
  -- Credit the RECEIVER with the GIVER as target, so UNIQUE(actor=receiver, kind, target=giver)
  -- makes the FIRST gift from this giver the only counted event; every later gift from the
  -- same giver still creates its gift row (I1) but this credit is an ON CONFLICT no-op. The
  -- counter = number of distinct non-guest givers, exactly once per pair. source_pk is
  -- deterministic per pair (receiver:giver), so reconcile rebuilds byte-identical rows no
  -- matter which of the pair's gifts it iterates first.
  -- Inline (not exception-wrapped): the gift is the core write, so any ledger failure must
  -- roll back the whole transaction — no gift row can exist without its credit.
  PERFORM public.record_engagement_event(
    p_receiver, 'appreciation_gift', 'user', v_giver,
    'appreciation_gifts', p_receiver::text || ':' || v_giver::text, NULL, false);

  RETURN jsonb_build_object(
    'id', v_gift.id, 'item', v_gift.item,
    'created', true, 'created_at', v_gift.created_at);
END;
$fn$;

-- ── 4. reconcile_engagement — CREATE OR REPLACE: verbatim P2.1a body + appreciation loop ─
-- (Copied byte-for-byte from 20261005000000 and extended with the appreciation_gift loop,
--  so the nightly cron self-heals any gift whose ledger row is missing, rebuilding the
--  same counts that give_appreciation writes inline.)
CREATE OR REPLACE FUNCTION public.reconcile_engagement(p_user uuid DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  SET lock_timeout = '5s'
AS $fn$
DECLARE r record; v_family text; v_author uuid;
BEGIN
  -- like (A1: liker <> post author)
  FOR r IN SELECT pl.user_id, pl.post_id, p.user_id AS author, p.resource_id FROM public.post_likes pl
           JOIN public.posts p ON p.id = pl.post_id
           WHERE pl.user_id <> p.user_id AND (p_user IS NULL OR pl.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'like','post',r.post_id,'post_likes',r.user_id::text||':'||r.post_id::text,v_family,false);
  END LOOP;
  -- poll_vote (A1: voter <> post author)
  FOR r IN SELECT pv.user_id, pv.poll_id, p.user_id AS author, p.resource_id FROM public.poll_votes pv
           JOIN public.polls pl ON pl.id = pv.poll_id JOIN public.posts p ON p.id = pl.post_id
           WHERE pv.user_id <> p.user_id AND (p_user IS NULL OR pv.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'poll_vote','poll',r.poll_id,'poll_votes',r.user_id::text||':'||r.poll_id::text,v_family,false);
  END LOOP;
  -- follow (A1: follower <> following)
  FOR r IN SELECT follower_id, following_id FROM public.follows WHERE follower_id <> following_id AND (p_user IS NULL OR follower_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.follower_id,'follow','user',r.following_id,'follows',r.follower_id::text||':'||r.following_id::text,NULL,false);
  END LOOP;
  -- comment (A1: commenter <> post author; visible only)
  FOR r IN SELECT DISTINCT pc.user_id, pc.post_id, p.user_id AS author, p.resource_id FROM public.post_comments pc
           JOIN public.posts p ON p.id = pc.post_id
           WHERE (pc.is_hidden IS NOT TRUE) AND pc.user_id <> p.user_id AND (p_user IS NULL OR pc.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'comment','post',r.post_id,'post_comments',r.user_id::text||':'||r.post_id::text,v_family,false);
  END LOOP;
  -- petition_signature (private; A1: signer <> petition creator)
  FOR r IN SELECT ps.signer_id, ps.petition_id FROM public.petition_signatures ps
           JOIN public.petitions pt ON pt.id = ps.petition_id
           WHERE ps.signer_id IS DISTINCT FROM pt.created_by AND (p_user IS NULL OR ps.signer_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.signer_id,'petition_signature','petition',r.petition_id,'petition_signatures',r.signer_id::text||':'||r.petition_id::text,NULL,false);
  END LOOP;
  -- event_checkin (private)
  FOR r IN SELECT user_id, occurrence_id FROM public.event_checkins WHERE user_id IS NOT NULL AND (p_user IS NULL OR user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'event_checkin','event',r.occurrence_id,'event_checkins',r.user_id::text||':'||r.occurrence_id::text,NULL,false);
  END LOOP;
  -- safety_alert_vote (A1: voter <> alert creator; private)
  FOR r IN SELECT v.voter_id, v.alert_id FROM public.safety_alert_votes v JOIN public.safety_alerts a ON a.id = v.alert_id
           WHERE v.voter_id IS DISTINCT FROM a.created_by AND (p_user IS NULL OR v.voter_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.voter_id,'safety_alert_vote','safety_alert',r.alert_id,'safety_alert_votes',r.voter_id::text||':'||r.alert_id::text,NULL,false);
  END LOOP;
  -- message (private; once per conversation)
  FOR r IN SELECT DISTINCT sender_id, conversation_id FROM public.messages WHERE p_user IS NULL OR sender_id = p_user LOOP
    PERFORM public.record_engagement_event(r.sender_id,'message','conversation',r.conversation_id,'messages',r.sender_id::text||':'||r.conversation_id::text,NULL,false);
  END LOOP;
  -- resource_bookmark (A1: user <> resource submitter; private)
  FOR r IN SELECT rb.user_id, rb.resource_id, res.category, res.submitted_by FROM public.resource_bookmarks rb
           JOIN public.resources res ON res.id = rb.resource_id
           WHERE rb.user_id IS DISTINCT FROM res.submitted_by AND (p_user IS NULL OR rb.user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'resource_bookmark','resource',r.resource_id,'resource_bookmarks',r.user_id::text||':'||r.resource_id::text,public.engagement_category_family(r.category),false);
  END LOOP;
  -- saved_resource (A1: user <> resource submitter; private)
  FOR r IN SELECT sr.user_id, sr.resource_id, res.category, res.submitted_by FROM public.saved_resources sr
           JOIN public.resources res ON res.id = sr.resource_id
           WHERE sr.resource_id IS NOT NULL AND sr.user_id IS DISTINCT FROM res.submitted_by AND (p_user IS NULL OR sr.user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'saved_resource','resource',r.resource_id,'saved_resources',r.user_id::text||':'||r.resource_id::text,public.engagement_category_family(r.category),false);
  END LOOP;
  -- opt_in completed: provider (public) + seeker (private)
  FOR r IN SELECT oi.id, oi.seeker_id, oi.resource_id, p.user_id AS author FROM public.resource_opt_ins oi
           JOIN public.posts p ON p.id = oi.post_id
           WHERE oi.status = 'completed' AND (p_user IS NULL OR oi.seeker_id = p_user OR p.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.author,'opt_in_completed_provider','opt_in',r.id,'resource_opt_ins',r.id::text,v_family,false);
    PERFORM public.record_engagement_event(r.seeker_id,'opt_in_completed_seeker','opt_in',r.id,'resource_opt_ins',r.id::text,v_family,false);
  END LOOP;
  -- conversation completed: volunteer (public) + requester (private)
  FOR r IN SELECT c.id, c.volunteer_id, c.requester_id, c.resource_id FROM public.conversations c
           WHERE c.status = 'completed' AND (p_user IS NULL OR c.volunteer_id = p_user OR c.requester_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.volunteer_id,'conversation_completed_volunteer','conversation',r.id,'conversations',r.id::text,v_family,false);
    PERFORM public.record_engagement_event(r.requester_id,'conversation_completed_requester','conversation',r.id,'conversations',r.id::text,v_family,false);
  END LOOP;
  -- review_received (private; keyed on anchor)
  FOR r IN SELECT id, reviewee_id, opt_in_id, conversation_id FROM public.reviews WHERE p_user IS NULL OR reviewee_id = p_user LOOP
    v_family := NULL;
    IF r.opt_in_id IS NOT NULL THEN
      SELECT public.engagement_category_family(res.category) INTO v_family
      FROM public.resource_opt_ins oi LEFT JOIN public.resources res ON res.id = oi.resource_id WHERE oi.id = r.opt_in_id;
    ELSIF r.conversation_id IS NOT NULL THEN
      SELECT public.engagement_category_family(res.category) INTO v_family
      FROM public.conversations c JOIN public.resources res ON res.id = c.resource_id WHERE c.id = r.conversation_id;
    END IF;
    PERFORM public.record_engagement_event(r.reviewee_id,'review_received','review',COALESCE(r.opt_in_id, r.conversation_id),'reviews',COALESCE(r.opt_in_id, r.conversation_id)::text,v_family,true);
  END LOOP;
  -- safety_alert_verified (PRIVATE — reporter created_by has no client grant; admin; not self-verified)
  FOR r IN SELECT id, created_by FROM public.safety_alerts
           WHERE verified IS TRUE AND created_by IS NOT NULL AND verified_by IS NOT NULL AND verified_by <> created_by
             AND (p_user IS NULL OR created_by = p_user) LOOP
    PERFORM public.record_engagement_event(r.created_by,'safety_alert_verified','safety_alert',r.id,'safety_alerts',r.id::text,NULL,true);
  END LOOP;
  -- resource_approved (public; admin; not self-approved)
  FOR r IN SELECT id, submitted_by, category FROM public.resources
           WHERE status = 'approved' AND submitted_by IS NOT NULL AND moderated_by IS NOT NULL AND moderated_by <> submitted_by
             AND (p_user IS NULL OR submitted_by = p_user) LOOP
    PERFORM public.record_engagement_event(r.submitted_by,'resource_approved','resource',r.id,'resources',r.id::text,public.engagement_category_family(r.category),true);
  END LOOP;
  -- appreciation_gift (P2.1b, USER RULING) — PUBLIC badge level; edge stays private in
  -- appreciation_gifts. Credit the RECEIVER once per DISTINCT giver (target_id = giver_id), so
  -- the counter = number of distinct non-guest givers — byte-identical to give_appreciation's
  -- inline write (same actor/kind/target/source_pk). DISTINCT collapses repeat gifts from one
  -- giver to a single credit; record_engagement_event additionally skips any guest receiver.
  -- ADDITIVE-only (ON CONFLICT DO NOTHING): a credit for a giver whose account was later
  -- deleted (their gift rows CASCADE away) is never recreated here, but is also never removed —
  -- the surviving ledger row keeps it (target_id has no FK). See I3a in the header.
  FOR r IN SELECT DISTINCT receiver_id, giver_id FROM public.appreciation_gifts
           WHERE (p_user IS NULL OR receiver_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.receiver_id,'appreciation_gift','user',r.giver_id,'appreciation_gifts',r.receiver_id::text||':'||r.giver_id::text,NULL,false);
  END LOOP;
  -- post_created (A2: author credited iff a QUALIFYING outside engagement exists by a
  -- non-guest ≠ author — a like, a NON-HIDDEN comment, a POLL VOTE, or an opt-in. This must
  -- match the live triggers exactly (poll_vote also credits post_created; hidden comments do
  -- not). The EXISTS proves outside engagement; family is derived from the post.
  FOR r IN SELECT p.id, p.user_id, p.resource_id, p.metadata FROM public.posts p
           WHERE (p_user IS NULL OR p.user_id = p_user)
             AND EXISTS (
               SELECT 1 FROM public.post_likes pl JOIN auth.users u ON u.id = pl.user_id
                 WHERE pl.post_id = p.id AND pl.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.post_comments pc JOIN auth.users u ON u.id = pc.user_id
                 WHERE pc.post_id = p.id AND pc.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
                   AND pc.is_hidden IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.poll_votes pv JOIN public.polls pol ON pol.id = pv.poll_id
                 JOIN auth.users u ON u.id = pv.user_id
                 WHERE pol.post_id = p.id AND pv.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.resource_opt_ins oi JOIN auth.users u ON u.id = oi.seeker_id
                 WHERE oi.post_id = p.id AND oi.seeker_id <> p.user_id AND u.is_anonymous IS NOT TRUE
             ) LOOP
    v_family := NULL;
    IF r.resource_id IS NOT NULL THEN
      SELECT public.engagement_category_family(category) INTO v_family FROM public.resources WHERE id = r.resource_id;
    END IF;
    IF v_family IS NULL AND r.metadata ? 'categories' AND jsonb_typeof(r.metadata->'categories') = 'array'
       AND jsonb_array_length(r.metadata->'categories') > 0 THEN
      v_family := public.engagement_family_from_chip(r.metadata->'categories'->>0);
    END IF;
    PERFORM public.record_engagement_event(r.user_id,'post_created','post',r.id,'posts',r.id::text,v_family,false);
  END LOOP;
END;
$fn$;

-- ============================================================================
-- 5. RLS + GRANTS (I2 + I4)
-- ============================================================================
ALTER TABLE public.appreciation_gifts ENABLE ROW LEVEL SECURITY;
-- Both parties (and only them) may read a gift row: the receiver builds the shelf; the
-- giver marks already-sent items. No client write policy exists → no client can
-- INSERT/UPDATE/DELETE (writes go only through give_appreciation SECDEF). Gifts are
-- permanent, so there is deliberately no UPDATE/DELETE path at all.
DROP POLICY IF EXISTS appreciation_gifts_select_parties ON public.appreciation_gifts;
CREATE POLICY appreciation_gifts_select_parties ON public.appreciation_gifts
  FOR SELECT TO authenticated
  USING (giver_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()));

-- Table-level grants: revoke Supabase defaults, then grant SELECT only (RLS-scoped above).
-- No INSERT/UPDATE/DELETE grant to anon or authenticated. anon gets nothing.
REVOKE ALL ON public.appreciation_gifts FROM anon, authenticated;
GRANT SELECT ON public.appreciation_gifts TO authenticated;

-- ============================================================================
-- 6. FUNCTION EXECUTE GRANTS
-- ============================================================================
-- give_appreciation is client-callable by authenticated only (guests are blocked in-body).
REVOKE EXECUTE ON FUNCTION public.give_appreciation(uuid, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.give_appreciation(uuid, text, uuid) TO authenticated;

-- Re-assert the classifier grants (CREATE OR REPLACE preserves ACL; assert to be safe).
GRANT EXECUTE ON FUNCTION public.engagement_community_dim(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_is_public(text)     TO anon, authenticated, service_role;

-- Re-assert reconcile lockdown (must stay non-client-executable; smoke 26/27 verify).
REVOKE EXECUTE ON FUNCTION public.reconcile_engagement(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reconcile_engagement(uuid) TO service_role;

COMMIT;
