-- 20261003000000_restore_realtime_publication.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-h-hygiene (restore realtime tables wiped by W1.3)
--
-- ── CAUSE ─────────────────────────────────────────────────────────────────────
-- 20260929000000_ranked_feed_w1_3.sql:246 ran
--   ALTER PUBLICATION supabase_realtime SET TABLE public.posts (...)
-- SET TABLE replaces the ENTIRE publication table set, so it silently dropped
-- notifications, messages, conversations and petition_signatures. W1.4
-- (20261001000000) later re-added post_comments + poll_votes. Live publication
-- today = posts(18 cols), post_comments(id,post_id), poll_votes(id,poll_id).
-- Effect: incoming P2P messages, conversation changes and notification bells no
-- longer arrive live (use-conversations.ts / use-notifications.ts postgres_changes).
--
-- ── INVARIANT ─────────────────────────────────────────────────────────────────
-- Each published column list contains exactly: every column the client handler reads
-- from the payload, every realtime `filter:` column, every column the RLS SELECT
-- policy needs to authorize the subscriber, and the replica-identity columns (PK, since
-- every table below is relreplident='d'). Nothing else goes on the WAL. A column-scoped
-- table that emits UPDATE/DELETE MUST carry its replica-identity columns or those events
-- abort — conversations subscribes with event '*', so its list includes the PK `id`.
--
-- ── DERIVATION ────────────────────────────────────────────────────────────────
--  table          | site (file:line)                       | events | payload read        | filter cols                 | RLS SELECT cols            | replreplident/PK | column list
--  messages       | use-conversations.ts:234-253           | INSERT | full Message row    | conversation_id             | conversation_id (→conv)    | d / id           | FULL ROW (no list)
--  notifications  | use-notifications.ts:246-251           | INSERT | full Notification   | (none)                      | user_id                    | d / id           | FULL ROW (no list)
--  conversations  | use-conversations.ts:170-199 (2 chans) | *      | none (refetch only) | volunteer_id, requester_id  | volunteer_id, requester_id | d / id           | (id, volunteer_id, requester_id)
--  petition_signatures — INTENTIONALLY OUT: use-petitions.ts:143-163 DOES subscribe to
--    its INSERTs, but RLS limits those events to the signer, and the signer's own count
--    is already optimistic (use-petitions.ts:203) plus server-reconciled (:235) — so that
--    subscription would receive nothing useful. It also carries ip_address/user_agent/
--    names, so keeping it off the WAL avoids PII leakage at no functional cost.
--
-- messages/notifications are published FULL ROW (approved) — their handlers append the
-- whole payload.new. conversations is column-scoped to {id, volunteer_id, requester_id}:
-- filter + RLS reference only volunteer_id/requester_id, the handler reads no payload
-- field (it refetches), and id is the replica identity required for its UPDATE/DELETE.
--
-- ── SAFETY ────────────────────────────────────────────────────────────────────
-- Per-table guarded + idempotent (uses FOUND, so a NULL SELECT INTO never mis-gates):
-- ADD only if absent; if present with the wrong column list, DROP then ADD the correct
-- one. NEVER SET TABLE (that is what caused the wipe). The existing posts / post_comments
-- / poll_votes entries are never touched, so they stay byte-identical. Valid on PG15
-- (publication column lists require PG15+).

-- messages — FULL ROW
DO $$
DECLARE v_has_collist boolean;
BEGIN
  SELECT (pr.prattrs IS NOT NULL) INTO v_has_collist
  FROM pg_publication p
  JOIN pg_publication_rel pr ON pr.prpubid = p.oid
  JOIN pg_class c ON c.oid = pr.prrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'messages';

  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  ELSIF v_has_collist THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;

-- notifications — FULL ROW
DO $$
DECLARE v_has_collist boolean;
BEGIN
  SELECT (pr.prattrs IS NOT NULL) INTO v_has_collist
  FROM pg_publication p
  JOIN pg_publication_rel pr ON pr.prpubid = p.oid
  JOIN pg_class c ON c.oid = pr.prrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'notifications';

  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  ELSIF v_has_collist THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;

-- conversations — COLUMN-SCOPED (id, volunteer_id, requester_id)
DO $$
DECLARE v_dummy boolean; v_cols text[];
BEGIN
  SELECT true INTO v_dummy
  FROM pg_publication p
  JOIN pg_publication_rel pr ON pr.prpubid = p.oid
  JOIN pg_class c ON c.oid = pr.prrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'conversations';

  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations (id, volunteer_id, requester_id);
  ELSE
    -- Aggregate over the published column names. NULL when published full-row
    -- (prattrs NULL → LATERAL unnest yields no rows), which is DISTINCT FROM the
    -- target array and therefore triggers a DROP + correct ADD.
    SELECT array_agg(a.attname ORDER BY a.attname) INTO v_cols
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN LATERAL unnest(pr.prattrs) AS an(num) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = an.num
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'conversations';

    IF v_cols IS DISTINCT FROM ARRAY['id','requester_id','volunteer_id']::text[] THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.conversations;
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations (id, volunteer_id, requester_id);
    END IF;
  END IF;
END
$$;
