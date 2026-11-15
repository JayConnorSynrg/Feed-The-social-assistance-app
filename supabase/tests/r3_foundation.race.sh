#!/bin/bash
# r3_foundation.race.sh — two-session concurrency checks for 20261026600000 (Release 3 foundation) and
# 20261026700000 (its contract step). A single-transaction SQL smoke cannot reach these paths, hence a separate
# script. In every scenario session 1 makes its call and holds its transaction open; session 2 arrives while it
# is open. The release state is read from the ledger: after the contract step no client role can DELETE an opt-in,
# so the direct DELETEs of R3 / R3b / R3c are made by the table owner (a service-side delete) and R3e asserts the
# refusal; before it they are made by the seeker.
#   Alert version token
#   R1   two updates of one alert with the same expected version: one wins, the other gets PT409; one message for v2.
#   R1b  an update in flight, then a resolve with the version seen before it: waits, then PT409; the alert stays live.
#   R1c  a resolve in flight, then a vote: waits, then 'alert is no longer live'; no vote is stored.
#   R1d  two moderators verify at once: the first verifier stands; one audit row.
#   Comment lock
#   R2   a moderator's lock in flight, then a member's comment: the comment waits for the post row, reads the lock
#        from it and is refused comments_locked; 0 comments on the locked post.
#   R2b  a comment in flight, then the lock: the lock waits; the comment (made before the lock) stands; a later one is refused.
#   Opt-in slot return
#   R3   an offer with one slot, taken. A direct DELETE of that opt-in in flight, then another seeker opts in: the
#        opt-in waits, finds the slot returned and is taken; slots = capacity - rows.
#   R3b  two direct DELETEs of two opt-ins at once: both slots come back (never one, never three).
#   R3c  withdraw_opt_in in flight, then a direct DELETE of the same row (and the reverse order): one of them
#        deletes, the slot comes back exactly once.
#   R3e  the direct DELETE against the author's decide_opt_in, PAIRS (40) simultaneous pairs.
#        Expand: the two take the opt-in row and the post row in opposite orders, so a pair can end in a
#        detected deadlock (one side gets 40P01 and can retry); the count is printed, and what is asserted is
#        that the slots never drift. Contract: the seeker's direct DELETE is refused (42501), the row and its
#        slot stay, and no pair deadlocks.
#   R3f  decide_opt_in against withdraw_opt_in (the RPC every client uses): PAIRS forced interleaves (half with the
#        author's transaction holding the post row first, half with the withdrawal in flight first) and PAIRS
#        simultaneous pairs. Both take the post row before the opt-in row: no deadlock, ever; no drift.
#   An opt-in write against an account deletion (the deletion takes the profile row, or the member's posts, first and
#   reaches the opt-in through the cascade; the three RPCs take the seeker's profile row, KEY SHARE, before the post;
#   the trail takes no lock). Each family runs against every deletion shape that reaches the opt-in (auth.users, the
#   profile row, and for the author's deletion the deletion function's DELETE of the posts): the write in flight then
#   the deletion; the deletion holding its first row then the write; PAIRS simultaneous. Asserted each time: no
#   deadlock, a legal answer, the account and the opt-in gone at the end, no slot drift, and no trail row left naming
#   a deleted account or a deleted post.
#   R3g  decide_opt_in against the seeker's account deletion. The decision is recorded and the opt-in then goes with
#        the account, or the decision waits for the deletion and answers opt_in_not_found.
#   R3h  unblock_opt_in against the declined seeker's account deletion: true, or false after the wait.
#   R3i  withdraw_opt_in against that member's own account deletion: true, or false after the wait.
#   R3j  a status write that cannot take the profile lock first (the direct UPDATE the deployed client still sends
#        before the contract step; the table owner's after it) against the seeker's account deletion: it goes
#        through at once; the deletion then clears the seeker from its trail row.
#   R3k  decide_opt_in against the AUTHOR's own account deletion (the acting account is the one being deleted).
#   R3m  the author's direct status UPDATE (the deployed client before the contract step; the table owner after it)
#        against that author's own account deletion: the UPDATE holds the opt-in row, the deletion the profile and
#        the post; with no lock taken by the trail the two never meet.
#   R3l  a username change (an UPDATE of a UNIQUE column: the same FOR UPDATE row lock a deletion takes) against every
#        opt-in write, the seeker's and the author's, held / in flight / PAIRS simultaneous: every trail row names
#        exactly its seeker and its actor.
#   Labels
#   R4   two moderators apply the same label at once: one record; the second answers changed = false; one audit row.
#   R4b  a retraction in flight, then another moderator applies the label: after the wait a NEW record is written;
#        posts.labels equals the active records.
#   R4c  the author's own "sensitive" in flight, then a moderator's: two records, posts.labels = {sensitive}.
#   R4d  two writers that take NO post lock themselves (the table owner inserting two different label records):
#        the sync trigger alone serialises them; posts.labels = both active records.
#   R4e  a moderator's "outdated" in flight, then the author's own "sensitive" (different labels, through the
#        RPCs): posts.labels = {outdated,sensitive} = the active records.
#   R4f  a transaction that already holds the foreign key's KEY SHARE lock on the post, then writes a label, while
#        a second label writer arrives in between: both land, no deadlock (the trigger's lock is FOR NO KEY UPDATE).
#   Pin / unpin
#   R5   a pin in flight, then an unpin: the unpin waits and lands; unpinned, pinned_until NULL; two audit rows.
#   R5b  a hold in flight, then a pin: the pin waits and is refused post_not_visible (no pin lands on a hidden post).
#   Petition review vs edit
#   R6   two moderators approve one draft at once: one feed post; the second answers changed = false with that post.
#   R6b  an approval in flight, then a rejection: the rejection waits and gets PT409 petition_not_draft.
#   R6c  a text change by the table owner in flight, then the approval: it waits and approves the text as it now
#        stands (the audit row carries the new hash; the post carries the new title).
#   R6d  a first signature in flight, then a text change: the change waits and is refused petition_text_locked.
#   R6e  a text change in flight, then a signature carrying the old hash: waits, refused petition_text_changed.
#   Re-report
#   R7   after a dismissal and an edit, the same member reports the new version twice at once: one open report;
#        the second answers accepted = false (no unique violation reaches the client).
#   R7b  the second and third reporters of a comment at once: the third waits, counts 3 and hides the comment.
#
# Usage: PSQL=<psql wrapper> TEMPLATE_DB=<db with the migration applied> r3_foundation.race.sh
#   PSQL is called as `DB=<name> $PSQL <psql args>` (the FEED PG17 harness `p` wrapper).
# Local / ephemeral databases only: it creates, seeds and drops a scratch database.
set -u
: "${PSQL:?set PSQL to the harness psql wrapper}"; TPL=${TEMPLATE_DB:-feed_base}
D=$(mktemp -d); RDB=feed_race_r3_$$; HOLD=${HOLD:-1.5}; GAP=${GAP:-0.6}; PAIRS=${PAIRS:-40}
trap 'rm -rf "$D"; DB=postgres $PSQL -qc "SET client_min_messages=warning" -c "DROP DATABASE IF EXISTS $RDB" >/dev/null' EXIT
DB=postgres $PSQL -qc "SET client_min_messages=warning" -c "DROP DATABASE IF EXISTS $RDB" -c "CREATE DATABASE $RDB TEMPLATE $TPL" >/dev/null || exit 1
q() { DB=$RDB $PSQL -At -c "$1"; }

A=a0000000-0000-4000-8000-0000000000a1; B=b0000000-0000-4000-8000-0000000000b2; C=c0000000-0000-4000-8000-0000000000c3
C2=c2000000-0000-4000-8000-0000000000c4; CM=e0000000-0000-4000-8000-0000000000e5; CM2=e2000000-0000-4000-8000-0000000000e6
AL1=5a000000-0000-4000-8000-0000000000f1; AL2=5a000000-0000-4000-8000-0000000000f2; AL3=5a000000-0000-4000-8000-0000000000f3; AL4=5a000000-0000-4000-8000-0000000000f4
P1=00000000-0000-4000-a000-0000000000f1; P2=00000000-0000-4000-a000-0000000000f2; P3=00000000-0000-4000-a000-0000000000f3
P4=00000000-0000-4000-a000-0000000000f4; P5=00000000-0000-4000-a000-0000000000f5; P6=00000000-0000-4000-a000-0000000000f6
P7=00000000-0000-4000-a000-0000000000f7; P8=00000000-0000-4000-a000-0000000000f8; P9=00000000-0000-4000-a000-0000000000f9
P10=00000000-0000-4000-a000-0000000000fa; P11=00000000-0000-4000-a000-0000000000fb; P12=00000000-0000-4000-a000-0000000000fc
P13=00000000-0000-4000-a000-0000000000fd; P14=00000000-0000-4000-a000-0000000000fe; P15=00000000-0000-4000-a000-0000000000ff
P16=00000000-0000-4000-a000-0000000001f0; P17=00000000-0000-4000-a000-0000000001f1; P18=00000000-0000-4000-a000-0000000001f2
P19=00000000-0000-4000-a000-0000000001f3; P20=00000000-0000-4000-a000-0000000001f4; P21=00000000-0000-4000-a000-0000000001f5
P22=00000000-0000-4000-a000-0000000001f6
T1=0c000000-0000-4000-8000-0000000000f1; T2=0c000000-0000-4000-8000-0000000000f2; T3=0c000000-0000-4000-8000-0000000000f3
T4=0c000000-0000-4000-8000-0000000000f4; T5=0c000000-0000-4000-8000-0000000000f5
K1=0d000000-0000-4000-8000-0000000000f1
PT() { echo "ST_SetSRID(ST_MakePoint(-72.5, 44.2), 4326)::geography"; }
q "INSERT INTO auth.users (id, email) VALUES ('$A','r3race-a@t'), ('$B','r3race-b@t'), ('$C','r3race-c@t'), ('$C2','r3race-c2@t'), ('$CM','r3race-cm@t'), ('$CM2','r3race-cm2@t');
   INSERT INTO public.profiles (id) SELECT id FROM auth.users WHERE email LIKE 'r3race-%' ON CONFLICT (id) DO NOTHING;
   SELECT set_config('feed.tier_write', 'on', false);
   UPDATE public.profiles SET admin_tier = 'community_moderator' WHERE id IN ('$CM', '$CM2');
   INSERT INTO public.safety_alerts (id, alert_type, severity, description, location, status, created_by, expires_at) VALUES
     ('$AL1', 'general', 2, 'race alert 1', $(PT), 'live', '$A', now() + interval '5 hours'),
     ('$AL2', 'general', 2, 'race alert 2', $(PT), 'live', '$A', now() + interval '5 hours'),
     ('$AL3', 'general', 2, 'race alert 3', $(PT), 'live', '$A', now() + interval '5 hours'),
     ('$AL4', 'general', 2, 'race alert 4', $(PT), 'live', '$A', now() + interval '5 hours');
   INSERT INTO public.posts (id, user_id, content, post_type, max_seekers, created_at) VALUES
     ('$P1', '$A', 'lock race', 'feed', NULL, now() - interval '1 hour'),
     ('$P2', '$A', 'lock race, reverse', 'feed', NULL, now() - interval '1 hour'),
     ('$P3', '$A', 'one slot', 'source_offer', 1, now() - interval '1 hour'),
     ('$P4', '$A', 'two slots', 'source_offer', 2, now() - interval '1 hour'),
     ('$P5', '$A', 'withdraw vs delete', 'source_offer', 2, now() - interval '1 hour'),
     ('$P6', '$A', 'label twice', 'feed', NULL, now() - interval '1 hour'),
     ('$P7', '$A', 'retract vs apply', 'feed', NULL, now() - interval '1 hour'),
     ('$P8', '$A', 'author and moderator', 'feed', NULL, now() - interval '1 hour'),
     ('$P9', '$A', 'pin vs unpin', 'feed', NULL, now() - interval '1 hour'),
     ('$P10', '$A', 'hold vs pin', 'feed', NULL, now() - interval '1 hour'),
     ('$P11', '$A', 're-report', 'feed', NULL, now() - interval '1 hour'),
     ('$P12', '$A', 'comment reports', 'feed', NULL, now() - interval '1 hour'),
     ('$P13', '$A', 'delete vs withdraw', 'source_offer', 2, now() - interval '1 hour'),
     ('$P14', '$A', 'decide vs direct delete', 'source_offer', 2, now() - interval '1 hour'),
     ('$P15', '$A', 'decide vs withdraw', 'source_offer', 2, now() - interval '1 hour'),
     ('$P16', '$A', 'two unlocked label writers', 'feed', NULL, now() - interval '1 hour'),
     ('$P17', '$A', 'moderator and author, different labels', 'feed', NULL, now() - interval '1 hour'),
     ('$P18', '$A', 'key share, then a label', 'feed', NULL, now() - interval '1 hour'),
     ('$P19', '$A', 'decide vs account deletion', 'source_offer', 2, now() - interval '1 hour'),
     ('$P20', '$A', 'unblock vs account deletion', 'source_offer', 2, now() - interval '1 hour'),
     ('$P21', '$A', 'withdraw vs account deletion', 'source_offer', 2, now() - interval '1 hour'),
     ('$P22', '$A', 'status write vs account deletion', 'source_offer', 2, now() - interval '1 hour');
   INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('$K1', '$P12', '$A', 'a comment three members report');
   INSERT INTO public.petitions (id, title, summary, body, body_version_hash, status, created_by) VALUES
     ('$T1', 'approve twice', 's', 'body one', 'x', 'draft', '$A'), ('$T2', 'approve vs reject', 's', 'body two', 'x', 'draft', '$A'),
     ('$T3', 'edit vs approve', 's', 'body three', 'x', 'draft', '$A'), ('$T4', 'sign vs edit', 's', 'body four', 'x', 'approved', '$A'),
     ('$T5', 'edit vs sign', 's', 'body five', 'x', 'approved', '$A');" >/dev/null || { echo "FAIL race setup"; exit 1; }
AS() { [ "$1" = "-" ] && echo "SELECT 1" || echo "SELECT set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false); SET ROLE authenticated;"; }
# two <id> <uid1|-> <sql1> <uid2|-> <sql2>: session 1 runs sql1 and holds its transaction open; session 2 arrives while it is open
two() {
  (DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $2)" -c "$3" -c "SELECT pg_sleep($HOLD)" -c "COMMIT" > "$D/$1a" 2>&1) &
  sleep $GAP
  DB=$RDB $PSQL -At -c "$(AS $4)" -c "$5" > "$D/$1b" 2>&1
  wait
}
# the last value or ERROR line of a session's output
r() { grep -E '^[0-9a-z{]|ERROR' "$1" | grep -v '^set_config' | tail -1; }
fail=0
ok()  { echo "  $1 ok: $2"; }
bad() { echo "  $1 FAIL: $2"; fail=1; }
as1() { DB=$RDB $PSQL -At -c "$(AS $1)" -c "$2" 2>&1 | grep -E '^[0-9a-z{]|ERROR' | grep -v '^set_config' | tail -1; }
# the release state: after the contract step (20261026700000) no client role holds DELETE on opt-ins
CON=$(q "SELECT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261026700000')")
if [ "$CON" = "t" ]; then DEL=-; DELWHO="the table owner"; else DEL=$B; DELWHO="the seeker"; fi
INV() { q "SELECT slots_remaining = max_seekers - (SELECT count(*) FROM public.resource_opt_ins o WHERE o.post_id = p.id) FROM public.posts p WHERE id = '$1'"; }
SLOTS() { q "SELECT max_seekers || '/' || slots_remaining || '/' || (SELECT count(*) FROM public.resource_opt_ins o WHERE o.post_id = p.id) FROM public.posts p WHERE id = '$1'"; }
LABELS() { q "SELECT labels::text || '|' || (SELECT count(*) FROM public.post_labels l WHERE l.post_id = p.id AND l.retracted_at IS NULL) || '|' || (SELECT count(*) FROM public.post_labels l WHERE l.post_id = p.id) FROM public.posts p WHERE id = '$1'"; }

# ---- R1: two alert updates, same expected version
two r1 $A "SELECT public.update_safety_alert('$AL1', p_description => 'tab one', p_expected_version => 1) ->> 'version'" \
       $A "SELECT public.update_safety_alert('$AL1', p_description => 'tab two', p_expected_version => 1) ->> 'version'"
F=$(q "SELECT version || '|' || description || '|' || (SELECT count(*) FROM public.safety_alert_updates WHERE alert_id = '$AL1' AND version = 2) FROM public.safety_alerts WHERE id = '$AL1'")
if grep -q '^2$' "$D/r1a" && grep -q 'edit_conflict' "$D/r1b" && [ "$F" = "2|tab one|1" ]; then ok R1 "tab one -> 2, tab two -> PT409; final $F"
else bad R1 "a=$(r "$D/r1a") b=$(r "$D/r1b") final=$F"; fi

# ---- R1b: update in flight, then resolve with the version seen before it
two r1b $A "SELECT public.update_safety_alert('$AL2', p_severity => 4, p_expected_version => 1) ->> 'version'" \
        $A "SELECT public.resolve_safety_alert('$AL2', 1) ->> 'status'"
F=$(q "SELECT status || '|' || version || '|' || severity FROM public.safety_alerts WHERE id = '$AL2'")
if grep -q '^2$' "$D/r1ba" && grep -q 'edit_conflict' "$D/r1bb" && [ "$F" = "live|2|4" ]; then ok R1b "the resolve of the unseen version refused after the wait; final $F"
else bad R1b "update=$(r "$D/r1ba") resolve=$(r "$D/r1bb") final=$F"; fi

# ---- R1c: resolve in flight, then a vote
two r1c $A "SELECT public.resolve_safety_alert('$AL3', 1) ->> 'status'" \
        $B "SELECT public.vote_safety_alert('$AL3', 'confirm') ->> 'status'"
F=$(q "SELECT status || '|' || confirm_count || '|' || (SELECT count(*) FROM public.safety_alert_votes WHERE alert_id = '$AL3') FROM public.safety_alerts WHERE id = '$AL3'")
if grep -q '^resolved$' "$D/r1ca" && grep -q 'alert is no longer live' "$D/r1cb" && [ "$F" = "resolved|0|0" ]; then ok R1c "the vote waited, then was refused; final $F"
else bad R1c "resolve=$(r "$D/r1ca") vote=$(r "$D/r1cb") final=$F"; fi

# ---- R1d: two verifies at once
two r1d $CM  "SELECT public.admin_verify_safety_alert('$AL4') ->> 'verified'" \
        $CM2 "SELECT public.admin_verify_safety_alert('$AL4') ->> 'verified'"
F=$(q "SELECT (verified_by = '$CM') || '|' || (SELECT count(*) FROM public.admin_actions WHERE action = 'safety_alert.verify' AND target_id = '$AL4') FROM public.safety_alerts WHERE id = '$AL4'")
if grep -q '^true$' "$D/r1da" && grep -q '^true$' "$D/r1db" && [ "$F" = "true|1" ]; then ok R1d "the first verifier stands, one audit row; first-verifier|audit rows $F"
else bad R1d "a=$(r "$D/r1da") b=$(r "$D/r1db") final=$F"; fi

# ---- R2: lock in flight, then a member's comment
two r2 $CM "SELECT public.admin_set_comments_locked('$P1', true, 1, 'heated') ->> 'changed'" \
       $B  "INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('$P1', '$B', 'racing the lock') RETURNING 'inserted'"
F=$(q "SELECT (comments_locked_at IS NOT NULL) || '|' || (SELECT count(*) FROM public.post_comments WHERE post_id = '$P1') FROM public.posts WHERE id = '$P1'")
if grep -q '^true$' "$D/r2a" && grep -q 'comments_locked' "$D/r2b" && [ "$F" = "true|0" ]; then ok R2 "the comment waited, read the lock and was refused; locked|comments $F"
else bad R2 "lock=$(r "$D/r2a") comment=$(r "$D/r2b") locked|comments=$F"; fi

# ---- R2b: comment in flight, then the lock
two r2b $B  "INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('$P2', '$B', 'before the lock') RETURNING 'inserted'" \
        $CM "SELECT public.admin_set_comments_locked('$P2', true, 1, 'spam') ->> 'changed'"
L=$(as1 $C "INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('$P2', '$C', 'after the lock') RETURNING 'inserted'")
F=$(q "SELECT (comments_locked_at IS NOT NULL) || '|' || (SELECT count(*) FROM public.post_comments WHERE post_id = '$P2') FROM public.posts WHERE id = '$P2'")
if grep -q '^inserted$' "$D/r2ba" && grep -q '^true$' "$D/r2bb" && echo "$L" | grep -q 'comments_locked' && [ "$F" = "true|1" ]; then ok R2b "the earlier comment stands, the lock landed, a later comment is refused; locked|comments $F"
else bad R2b "comment=$(r "$D/r2ba") lock=$(r "$D/r2bb") later=$L locked|comments=$F"; fi

# ---- R3: one slot, taken by B. A direct DELETE of B's opt-in in flight (by B before the contract step, by the table owner after), then C opts in
as1 $B "SELECT (public.opt_in_to_post('$P3')).status" >/dev/null
two r3 $DEL "DELETE FROM public.resource_opt_ins WHERE post_id = '$P3' AND seeker_id = '$B' RETURNING 'deleted'" \
       $C "SELECT (public.opt_in_to_post('$P3')).status"
F=$(SLOTS $P3)
if grep -q '^deleted$' "$D/r3a" && grep -q '^pending$' "$D/r3b" && [ "$F" = "1/0/1" ]; then ok R3 "the opt-in waited, found the slot returned and was taken (delete by $DELWHO); max/slots/rows $F"
else bad R3 "delete=$(r "$D/r3a") optin=$(r "$D/r3b") max/slots/rows=$F"; fi

# ---- R3b: two direct DELETEs of two opt-ins at once (each seeker their own before the contract step; the table owner after)
as1 $B "SELECT (public.opt_in_to_post('$P4')).status" >/dev/null; as1 $C "SELECT (public.opt_in_to_post('$P4')).status" >/dev/null
[ "$CON" = "t" ] && DEL2=- || DEL2=$C
two r3b $DEL  "DELETE FROM public.resource_opt_ins WHERE post_id = '$P4' AND seeker_id = '$B' RETURNING 'deleted'" \
        $DEL2 "DELETE FROM public.resource_opt_ins WHERE post_id = '$P4' AND seeker_id = '$C' RETURNING 'deleted'"
F=$(SLOTS $P4)
if grep -q '^deleted$' "$D/r3ba" && grep -q '^deleted$' "$D/r3bb" && [ "$F" = "2/2/0" ]; then ok R3b "both slots came back; max/slots/rows $F"
else bad R3b "a=$(r "$D/r3ba") b=$(r "$D/r3bb") max/slots/rows=$F"; fi

# ---- R3c: withdraw_opt_in in flight, then a direct DELETE of the same row; then the reverse order (C keeps a second row throughout)
as1 $B "SELECT (public.opt_in_to_post('$P5')).status" >/dev/null; as1 $C "SELECT (public.opt_in_to_post('$P5')).status" >/dev/null
two r3c $B   "SELECT public.withdraw_opt_in('$P5')::text" \
        $DEL "WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '$P5' AND seeker_id = '$B' RETURNING 1) SELECT count(*) FROM d"
F=$(SLOTS $P5)
as1 $B "SELECT (public.opt_in_to_post('$P13')).status" >/dev/null; as1 $C "SELECT (public.opt_in_to_post('$P13')).status" >/dev/null
two r3d $DEL "WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '$P13' AND seeker_id = '$B' RETURNING 1) SELECT count(*) FROM d" \
        $B   "SELECT public.withdraw_opt_in('$P13')::text"
G=$(SLOTS $P13)
if grep -q '^true$' "$D/r3ca" && grep -q '^0$' "$D/r3cb" && [ "$F" = "2/1/1" ] && grep -q '^1$' "$D/r3da" && grep -q '^false$' "$D/r3db" && [ "$G" = "2/1/1" ]; then ok R3c "one delete each time, the slot back exactly once; max/slots/rows $F and $G"
else bad R3c "withdraw=$(r "$D/r3ca") delete=$(r "$D/r3cb") final=$F | delete=$(r "$D/r3da") withdraw=$(r "$D/r3db") final=$G"; fi

# pair <tag> <sql of session 1 (background, own BEGIN..COMMIT)> <sql of session 2>: fired at the same instant, no hold
V() { DB=$RDB $PSQL -At -v VERBOSITY=verbose "$@"; }
OPTIN() { q "SELECT set_config('request.jwt.claims', '{\"sub\":\"$B\",\"role\":\"authenticated\"}', false); SET ROLE authenticated; SELECT (public.opt_in_to_post('$1')).id;" | tail -1; }
CLEAN() { q "DELETE FROM public.resource_opt_ins WHERE post_id = '$1'" >/dev/null; }
LAS() { echo "SELECT set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', true); SET LOCAL ROLE authenticated;"; }

# ---- R3e: the direct DELETE against decide_opt_in, PAIRS simultaneous pairs
dl=0; drift=0; refused=0; kept=0
for i in $(seq 1 $PAIRS); do
  OI=$(OPTIN $P14)
  ( V -c "BEGIN; $(LAS $A) SELECT public.decide_opt_in('$OI', 'decline') ->> 'status'; COMMIT;" > "$D/e_a" 2>&1 ) &
  V -c "BEGIN; $(LAS $B) DELETE FROM public.resource_opt_ins WHERE id = '$OI'; COMMIT;" > "$D/e_b" 2>&1
  wait
  grep -q 40P01 "$D/e_a" "$D/e_b" && dl=$((dl+1))
  grep -q '42501: permission denied for table resource_opt_ins' "$D/e_b" && refused=$((refused+1))
  [ "$(q "SELECT count(*) FROM public.resource_opt_ins WHERE id = '$OI'")" = "1" ] && kept=$((kept+1))
  [ "$(INV $P14)" = "t" ] || drift=$((drift+1))
  CLEAN $P14; [ "$(INV $P14)" = "t" ] || drift=$((drift+1))
done
if [ "$CON" = "t" ]; then
  if [ $refused = $PAIRS ] && [ $kept = $PAIRS ] && [ $dl = 0 ] && [ $drift = 0 ]; then ok R3e "contract: the seeker's direct DELETE refused in $refused of $PAIRS pairs, the row and its slot kept, 0 deadlocks, 0 drift"
  else bad R3e "contract: refused=$refused kept=$kept of $PAIRS, deadlocks=$dl, drift=$drift"; fi
else
  if [ $drift = 0 ]; then ok R3e "expand: $PAIRS simultaneous direct DELETE / decide_opt_in pairs: $dl ended in a detected deadlock (opposite lock order; closed by the contract step), 0 drift"
  else bad R3e "expand: slots drifted in $drift of $PAIRS pairs (deadlocks $dl)"; fi
fi

# ---- R3f: decide_opt_in against withdraw_opt_in: forced interleaves (both orders) and simultaneous pairs
dl=0; drift=0; odd=0; H=0.3; G=0.12; half=$((PAIRS / 2))
for i in $(seq 1 $half); do            # the author's transaction holds the post row; the withdrawal arrives and waits
  OI=$(OPTIN $P15)
  ( V -c "BEGIN; SELECT 1 FROM public.posts WHERE id = '$P15' FOR UPDATE; SELECT pg_sleep($H); $(LAS $A) SELECT public.decide_opt_in('$OI', 'accept') ->> 'status'; COMMIT;" > "$D/f_a" 2>&1 ) &
  sleep $G
  V -c "BEGIN; $(LAS $B) SELECT public.withdraw_opt_in('$P15')::text; COMMIT;" > "$D/f_b" 2>&1
  wait
  grep -q 40P01 "$D/f_a" "$D/f_b" && dl=$((dl+1))
  { grep -q '^accepted$' "$D/f_a" && grep -q '^false$' "$D/f_b"; } || odd=$((odd+1))      # decided first; nothing pending left to withdraw
  [ "$(INV $P15)" = "t" ] || drift=$((drift+1)); CLEAN $P15
done
for i in $(seq 1 $half); do            # the withdrawal is in flight; the decision arrives and waits
  OI=$(OPTIN $P15)
  ( V -c "BEGIN; $(LAS $B) SELECT public.withdraw_opt_in('$P15')::text; SELECT pg_sleep($H); COMMIT;" > "$D/f_b" 2>&1 ) &
  sleep $G
  V -c "BEGIN; $(LAS $A) SELECT public.decide_opt_in('$OI', 'accept') ->> 'status'; COMMIT;" > "$D/f_a" 2>&1
  wait
  grep -q 40P01 "$D/f_a" "$D/f_b" && dl=$((dl+1))
  { grep -q '^true$' "$D/f_b" && grep -q 'opt_in_not_found' "$D/f_a"; } || odd=$((odd+1))  # withdrawn first; the decision finds no opt-in
  [ "$(INV $P15)" = "t" ] || drift=$((drift+1)); CLEAN $P15
done
udl=0; uodd=0
for i in $(seq 1 $PAIRS); do           # simultaneous, no hold
  OI=$(OPTIN $P15)
  ( V -c "BEGIN; $(LAS $A) SELECT public.decide_opt_in('$OI', 'decline') ->> 'status'; COMMIT;" > "$D/f_a" 2>&1 ) &
  V -c "BEGIN; $(LAS $B) SELECT public.withdraw_opt_in('$P15')::text; COMMIT;" > "$D/f_b" 2>&1
  wait
  grep -q 40P01 "$D/f_a" "$D/f_b" && udl=$((udl+1))
  { grep -q '^declined$' "$D/f_a" && grep -q '^false$' "$D/f_b"; } || { grep -q 'opt_in_not_found' "$D/f_a" && grep -q '^true$' "$D/f_b"; } || uodd=$((uodd+1))
  [ "$(INV $P15)" = "t" ] || drift=$((drift+1)); CLEAN $P15
done
if [ $dl = 0 ] && [ $udl = 0 ] && [ $drift = 0 ] && [ $odd = 0 ] && [ $uodd = 0 ]; then ok R3f "decide_opt_in / withdraw_opt_in: 0 deadlocks in $((half * 2)) forced interleaves and $PAIRS simultaneous pairs; exactly one of the two takes effect each time; 0 drift"
else bad R3f "forced: deadlocks=$dl unexpected outcomes=$odd; simultaneous: deadlocks=$udl unexpected outcomes=$uodd; drift=$drift (last: decide=$(r "$D/f_a") withdraw=$(r "$D/f_b"))"; fi

# ---- R3g / R3h / R3i / R3j / R3k / R3m: an opt-in write against an account deletion, in every shape a deletion takes:
#   authusers  DELETE FROM auth.users (the admin route's auth.admin.deleteUser; cascades to the profile)
#   profile    service_role DELETE FROM public.profiles (the delete-account function; cascades the posts still there)
#   posts      service_role DELETE FROM public.posts WHERE user_id (the delete-account function's step before the profile)
# The raced statement is the shape's; the rest of the account goes after it, so the account is gone at the end either way.
# The posts shape removes only the member's own posts, so it is raced against the AUTHOR's deletion (R3k, R3m); a
# seeker's opt-ins are reached by the other two.
SKN=0
NEWSK() { SKN=$((SKN+1)); SK=$(printf 'c9000000-0000-4000-8000-%012d' $SKN)
  q "INSERT INTO auth.users (id, email) VALUES ('$SK', 'r3race-sk$SKN@t'); INSERT INTO public.profiles (id) VALUES ('$SK') ON CONFLICT (id) DO NOTHING" >/dev/null; }
OPTINAS() { q "SELECT set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false); SET ROLE authenticated; SELECT (public.opt_in_to_post('$2')).id;" | tail -1; }
ASDO() { q "SELECT set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false); SET ROLE authenticated; $2" >/dev/null 2>&1; }
ans() { grep -E '^[a-z]|ERROR' "$1" | grep -v '^set_config' | tail -1 | sed -E 's/^ERROR: +[0-9A-Z]+: +//'; }
NEWAU() { AU=$(printf 'a9000000-0000-4000-8000-%012d' $SKN); PA=$(printf '00000000-0000-4000-b000-%012d' $SKN)
  q "INSERT INTO auth.users (id, email) VALUES ('$AU', 'r3race-au$SKN@t'); INSERT INTO public.profiles (id) VALUES ('$AU') ON CONFLICT (id) DO NOTHING;
     INSERT INTO public.posts (id, user_id, content, post_type, max_seekers) VALUES ('$PA', '$AU', 'the author leaves', 'source_offer', 2)" >/dev/null; }
GONE() { q "SELECT (NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '$1') AND NOT EXISTS (SELECT 1 FROM public.resource_opt_ins WHERE id = '$2'))::char"; }
# trail rows that still name a deleted account, or whose post is gone (the two foreign-key actions the trail keeps by trigger)
DANGLING() { q "SELECT count(*) FROM public.resource_opt_in_events e
                 WHERE (e.seeker_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = e.seeker_id))
                    OR (e.actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = e.actor_id))
                    OR NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = e.post_id)"; }
SRV="SELECT set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true); SET LOCAL ROLE service_role;"
delstmt() { case $DSH in authusers) echo "DELETE FROM auth.users WHERE id = '$1'";;
                         profile)   echo "$SRV DELETE FROM public.profiles WHERE id = '$1'";;
                         posts)     echo "$SRV DELETE FROM public.posts WHERE user_id = '$1'";; esac; }
holdstmt() { [ "$DSH" = posts ] && echo "SELECT 1 FROM public.posts WHERE user_id = '$1' FOR UPDATE" || echo "SELECT 1 FROM public.profiles WHERE id = '$1' FOR UPDATE"; }
finish() { q "DELETE FROM auth.users WHERE id = '$1'" >/dev/null; }
# versus <tag> <post, or AU: a fresh author with a fresh post each time, and it is the AUTHOR's account that is deleted>
#        <session of the write: uid, SK (the seeker), AU (that author) or - (table owner)> <prepare: none|decline> <sql of the write, \$OI = the opt-in id>
#        <answer when the write lands first> <answer when the deletion holds its first row> [<another legal answer of a simultaneous pair>]
# DSH = the deletion shape. VS = the verdict line.
versus() {
  local tag=$1 post=$2 who=$3 prep=$4 sql=$5 first=$6 second=$7 also=${8:-$7} dl=0 odd=0 drift=0 left=0 dang=0 a OI W X vpost=$2
  wr() { case $who in -) echo "$1";; SK) echo "$(LAS $SK) $1";; AU) echo "$(LAS $AU) $1";; *) echo "$(LAS $who) $1";; esac; }
  prepare() { NEWSK; X=$SK; if [ "$vpost" = AU ]; then NEWAU; post=$PA; X=$AU; fi
              OI=$(OPTINAS $SK $post); [ "$prep" = decline ] && ASDO $A "SELECT public.decide_opt_in('$OI', 'decline')"; W=$(wr "${sql//\$OI/$OI}"); }
  check() { finish $X; grep -q 40P01 "$D/v_a" "$D/v_b" && dl=$((dl+1)); grep -q ERROR "$D/v_b" && odd=$((odd+1)); [ "$(GONE $X $OI)" = t ] || left=$((left+1))
            [ "$vpost" = AU ] || { [ "$(INV $post)" = f ] && drift=$((drift+1)); }; [ "$(DANGLING)" = 0 ] || dang=$((dang+1)); }
  # 1. the write is in flight; the deletion arrives, waits for it, then removes the account and the opt-in
  prepare
  ( V -c "BEGIN; $W; SELECT pg_sleep(0.6); COMMIT;" > "$D/v_a" 2>&1 ) & sleep 0.2
  V -c "$(delstmt $X)" > "$D/v_b" 2>&1; wait; check
  a=$(ans "$D/v_a"); echo "$a" | grep -qE "^($first)$" || odd=$((odd+1)); local a1=$a
  # 2. the deletion holds its first row (the profile; the author's posts for the posts shape); the write arrives
  prepare
  ( V -c "BEGIN; $(holdstmt $X); SELECT pg_sleep(0.6); $(delstmt $X); COMMIT;" > "$D/v_b" 2>&1 ) & sleep 0.2
  V -c "BEGIN; $W; COMMIT;" > "$D/v_a" 2>&1; wait; check
  a=$(ans "$D/v_a"); echo "$a" | grep -qE "^($second)$" || odd=$((odd+1)); local a2=$a
  local seen2=$(q "SELECT COALESCE(string_agg(event || ':' || COALESCE(seeker_id::text, 'null'), ',' ORDER BY id), 'no rows') FROM public.resource_opt_in_events WHERE opt_in_id = '$OI' AND event NOT IN ('opted_in', 'declined')")
  # 3. simultaneous, no hold
  for i in $(seq 1 $PAIRS); do
    prepare
    ( V -c "BEGIN; $W; COMMIT;" > "$D/v_a" 2>&1 ) &
    V -c "$(delstmt $X)" > "$D/v_b" 2>&1; wait; check
    ans "$D/v_a" | grep -qE "^($first|$second|$also)$" || odd=$((odd+1))
  done
  VS="[$DSH] deadlocks $dl/$((PAIRS + 2)), outcomes outside the legal ones $odd, accounts or opt-ins left $left, slot drift $drift, dangling trail $dang; write first -> '$a1'; deletion first -> '$a2' (trail after it: $seen2)"
  [ $dl = 0 ] && [ $odd = 0 ] && [ $left = 0 ] && [ $drift = 0 ] && [ $dang = 0 ]
}
# shapes <tag> <label> <shapes> <versus args...>: one verdict over every shape
shapes() { local tag=$1 label=$2 list=$3 all=0 out=""; shift 3
  for DSH in $list; do if versus "$@"; then :; else all=1; fi; out="$out $VS;"; done
  if [ $all = 0 ]; then ok $tag "$label:$out"; else bad $tag "$label:$out"; fi; }
SEEKER_SHAPES="authusers profile"; AUTHOR_SHAPES="authusers profile posts"
shapes R3g "decide_opt_in / the seeker's account deletion, 2 forced interleaves + $PAIRS simultaneous pairs per shape" "$SEEKER_SHAPES" \
  r3g $P19 $A none "SELECT public.decide_opt_in('\$OI', 'accept') ->> 'status'" 'accepted' 'opt_in_not_found'
shapes R3h "unblock_opt_in / the seeker's account deletion, 2 forced + $PAIRS simultaneous per shape" "$SEEKER_SHAPES" \
  r3h $P20 $A decline "SELECT public.unblock_opt_in('\$OI')::text" 'true' 'false|Opt-in not found'
shapes R3i "withdraw_opt_in / that member's own account deletion, 2 forced + $PAIRS simultaneous per shape" "$SEEKER_SHAPES" \
  r3i $P21 SK none "SELECT public.withdraw_opt_in('$P21')::text" 'true' 'false'
# R3j: before the contract step this is the deployed client's request (the author, through the UPDATE (status) grant); after it only a service-side writer can send it
[ "$CON" = "t" ] && UW=- || UW=$A
shapes R3j "a direct UPDATE of status ($([ "$CON" = t ] && echo "the table owner" || echo "the author, as the deployed client sends it")) / the seeker's account deletion, 2 forced + $PAIRS simultaneous per shape" "$SEEKER_SHAPES" \
  r3j $P22 $UW none "WITH u AS (UPDATE public.resource_opt_ins SET status = 'accepted' WHERE id = '\$OI' RETURNING status) SELECT COALESCE((SELECT status FROM u), 'no row')" 'accepted' 'accepted' 'no row'
shapes R3k "decide_opt_in / the author's own account deletion, 2 forced + $PAIRS simultaneous per shape" "$AUTHOR_SHAPES" \
  r3k AU AU none "SELECT public.decide_opt_in('\$OI', 'accept') ->> 'status'" 'accepted' 'accepted|opt_in_not_found' 'opt_in_not_found'
# R3m: the author's direct status UPDATE (the deployed client, before the contract step; the table owner after it)
# against that author's own account deletion: the UPDATE holds the opt-in row, the deletion holds the profile and the
# post and asks for the opt-in last. The trail takes no lock on either, so the two never meet.
[ "$CON" = "t" ] && MW=- || MW=AU
shapes R3m "a direct UPDATE of status ($([ "$CON" = t ] && echo "the table owner" || echo "the author, as the deployed client sends it")) / that author's own account deletion, 2 forced + $PAIRS simultaneous per shape" "$AUTHOR_SHAPES" \
  r3m AU $MW none "WITH u AS (UPDATE public.resource_opt_ins SET status = 'accepted' WHERE id = '\$OI' RETURNING status) SELECT COALESCE((SELECT status FROM u), 'no row')" 'accepted' 'accepted|no row' 'no row'

# ---- R3l: a member changing their username never blanks them on the trail. A username change is an UPDATE of a
# UNIQUE column, so it locks the profile row FOR UPDATE, the lock an account deletion takes; the trail reads both
# accounts without a lock and names them. Each opt-in write against the seeker's and against the author's rename:
# the rename holding its lock when the write arrives, the write in flight when the rename arrives, and PAIRS
# simultaneous pairs. Every trail row must name exactly its seeker and its actor.
RA_=a8000000-0000-4000-8000-0000000000a8
q "INSERT INTO auth.users (id, email) VALUES ('$RA_', 'r3race-ra@t'); INSERT INTO public.profiles (id, username) VALUES ('$RA_', 'r3_author') ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username" >/dev/null
RN=0; RSK=
NEWR() { RN=$((RN+1)); RSK=$(printf 'c8000000-0000-4000-8000-%012d' $RN); RPO=$(printf '00000000-0000-4000-c800-%012d' $RN)
  q "INSERT INTO auth.users (id, email) VALUES ('$RSK', 'r3race-rs$RN@t'); INSERT INTO public.profiles (id, username) VALUES ('$RSK', 'r3_sk_$RN') ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
     INSERT INTO public.posts (id, user_id, content, post_type, max_seekers) VALUES ('$RPO', '$RA_', 'rename race', 'source_offer', 3)" >/dev/null
  ROI=$(OPTINAS $RSK $RPO); }
RENAME() { echo "$(LAS $1) UPDATE public.profiles SET username = username || '_r' WHERE id = '$1';"; }
# the last trail row of the opt-in: <event>:<seeker named>:<actor named> (t = exactly the expected account)
NAMED() { q "SELECT event || ':' || COALESCE((seeker_id = '$RSK')::char, 'NULL') || ':' || COALESCE((actor_id = '$1')::char, 'NULL') FROM public.resource_opt_in_events WHERE opt_in_id = '$ROI' ORDER BY id DESC LIMIT 1"; }
# rn <label> <who renames: seeker|author> <write sql, $ROI/$RPO substituted> <writer: seeker|author> <prep: none|decline> <expected event>
lost=0; rdl=0; rtotal=0; rdetail=""
rn() { local label=$1 ren=$2 sql=$3 wr=$4 prep=$5 ev=$6 rid wid w r t
  for mode in held inflight; do
    NEWR; [ "$prep" = decline ] && ASDO $RA_ "SELECT public.decide_opt_in('$ROI', 'decline')"
    [ $ren = seeker ] && rid=$RSK || rid=$RA_; [ $wr = seeker ] && wid=$RSK || wid=$RA_
    w="$(LAS $wid) ${sql//\$ROI/$ROI}"; w="${w//\$RPO/$RPO}"
    if [ $mode = held ]; then
      ( V -c "BEGIN; $(RENAME $rid) SELECT pg_sleep(0.6); COMMIT;" > "$D/rl_a" 2>&1 ) & sleep 0.2
      V -c "BEGIN; $w COMMIT;" > "$D/rl_b" 2>&1; wait
    else
      ( V -c "BEGIN; $w SELECT pg_sleep(0.6); COMMIT;" > "$D/rl_b" 2>&1 ) & sleep 0.2
      V -c "BEGIN; $(RENAME $rid) COMMIT;" > "$D/rl_a" 2>&1; wait
    fi
    t=$(NAMED $wid); rtotal=$((rtotal+1)); grep -q 40P01 "$D/rl_a" "$D/rl_b" && rdl=$((rdl+1))
    [ "$t" = "$ev:t:t" ] || { lost=$((lost+1)); rdetail="$rdetail $label/$mode=$t"; }
  done
  local plost=0
  for i in $(seq 1 $PAIRS); do
    NEWR; [ "$prep" = decline ] && ASDO $RA_ "SELECT public.decide_opt_in('$ROI', 'decline')"
    [ $ren = seeker ] && rid=$RSK || rid=$RA_; [ $wr = seeker ] && wid=$RSK || wid=$RA_
    w="$(LAS $wid) ${sql//\$ROI/$ROI}"; w="${w//\$RPO/$RPO}"
    ( V -c "BEGIN; $(RENAME $rid) COMMIT;" > "$D/rl_a" 2>&1 ) &
    V -c "BEGIN; $w COMMIT;" > "$D/rl_b" 2>&1; wait
    t=$(NAMED $wid); rtotal=$((rtotal+1)); grep -q 40P01 "$D/rl_a" "$D/rl_b" && rdl=$((rdl+1))
    [ "$t" = "$ev:t:t" ] || { lost=$((lost+1)); plost=$((plost+1)); }
  done
  rdetail="$rdetail $label: $plost/$PAIRS simultaneous lost a name;"
}
DEC="SELECT public.decide_opt_in('\$ROI', 'accept');"
if [ "$CON" != t ]; then
  rn "seeker renames / author's direct UPDATE" seeker "UPDATE public.resource_opt_ins SET status = 'accepted' WHERE id = '\$ROI';" author none accepted
  rn "author renames / author's direct UPDATE" author "UPDATE public.resource_opt_ins SET status = 'accepted' WHERE id = '\$ROI';" author none accepted
fi
rn "seeker renames / decide_opt_in" seeker "$DEC" author none accepted
rn "author renames / decide_opt_in" author "$DEC" author none accepted
rn "seeker renames / own withdraw_opt_in" seeker "SELECT public.withdraw_opt_in('\$RPO');" seeker none withdrawn
rn "author renames / unblock_opt_in" author "SELECT public.unblock_opt_in('\$ROI');" author decline unblocked
if [ $lost = 0 ] && [ $rdl = 0 ]; then ok R3l "username change against every opt-in write ($rtotal writes, held, in flight and $PAIRS simultaneous each): every trail row names exactly its seeker and its actor, 0 deadlocks;$rdetail"
else bad R3l "$lost of $rtotal trail rows lost a name, deadlocks $rdl:$rdetail"; fi

# ---- R4: two moderators apply the same label at once
two r4 $CM  "SELECT public.admin_set_post_label('$P6', 'outdated', true, 1, 'stale hours') ->> 'changed'" \
       $CM2 "SELECT public.admin_set_post_label('$P6', 'outdated', true, 1, 'stale hours too') ->> 'changed'"
F=$(LABELS $P6); N=$(q "SELECT count(*) FROM public.admin_actions WHERE action = 'post.label' AND target_id = '$P6'")
if grep -q '^true$' "$D/r4a" && grep -q '^false$' "$D/r4b" && [ "$F" = "{outdated}|1|1" ] && [ "$N" = "1" ]; then ok R4 "one record, the second changed nothing, one audit row; labels|active|records $F"
else bad R4 "a=$(r "$D/r4a") b=$(r "$D/r4b") labels|active|records=$F audit=$N"; fi

# ---- R4b: a retraction in flight, then another moderator applies the label
as1 $CM "SELECT public.admin_set_post_label('$P7', 'misleading', true, 1, 'wrong address') ->> 'changed'" >/dev/null
two r4b $CM2 "SELECT public.admin_set_post_label('$P7', 'misleading', false, 1, 'fixed') ->> 'changed'" \
        $CM  "SELECT public.admin_set_post_label('$P7', 'misleading', true, 1, 'still wrong') ->> 'changed'"
F=$(LABELS $P7)
if grep -q '^true$' "$D/r4ba" && grep -q '^true$' "$D/r4bb" && [ "$F" = "{misleading}|1|2" ]; then ok R4b "retracted, then a new record after the wait; labels|active|records $F"
else bad R4b "retract=$(r "$D/r4ba") apply=$(r "$D/r4bb") labels|active|records=$F"; fi

# ---- R4c: the author's own "sensitive" in flight, then a moderator's
two r4c $A  "SELECT (public.set_own_post_label('$P8', 'sensitive', true, 1) -> 'labels')::text" \
        $CM "SELECT public.admin_set_post_label('$P8', 'sensitive', true, 1, 'graphic') ->> 'changed'"
F=$(LABELS $P8)
if grep -q 'sensitive' "$D/r4ca" && grep -q '^true$' "$D/r4cb" && [ "$F" = "{sensitive}|2|2" ]; then ok R4c "two records, one label on the post; labels|active|records $F"
else bad R4c "author=$(r "$D/r4ca") moderator=$(r "$D/r4cb") labels|active|records=$F"; fi

# ---- R4d: two writers that lock nothing themselves (the table owner writes two different label records)
two r4d - "INSERT INTO public.post_labels (post_id, label, post_version, source_role, reason) VALUES ('$P16', 'outdated', 1, 'community_moderator', 'race') RETURNING 'a'" \
        - "INSERT INTO public.post_labels (post_id, label, post_version, source_role, reason) VALUES ('$P16', 'misleading', 1, 'platform_admin', 'race') RETURNING 'b'"
F=$(LABELS $P16)
if grep -q '^a$' "$D/r4da" && grep -q '^b$' "$D/r4db" && [ "$F" = "{misleading,outdated}|2|2" ]; then ok R4d "the sync trigger alone serialised two unlocked writers; labels|active|records $F"
else bad R4d "a=$(r "$D/r4da") b=$(r "$D/r4db") labels|active|records=$F"; fi

# ---- R4e: a moderator's "outdated" in flight, then the author's own "sensitive"
two r4e $CM "SELECT public.admin_set_post_label('$P17', 'outdated', true, NULL, 'stale') ->> 'changed'" \
        $A  "SELECT public.set_own_post_label('$P17', 'sensitive', true) ->> 'applied'"
F=$(LABELS $P17)
if grep -q '^true$' "$D/r4ea" && grep -q '^true$' "$D/r4eb" && [ "$F" = "{outdated,sensitive}|2|2" ]; then ok R4e "two different labels, both on the post; labels|active|records $F"
else bad R4e "moderator=$(r "$D/r4ea") author=$(r "$D/r4eb") labels|active|records=$F"; fi

# ---- R4f: session 1 holds KEY SHARE on the post (what a foreign-key check takes), sleeps, then writes a label; session 2 writes another label in between
two r4f - "SELECT 'held' FROM public.posts WHERE id = '$P18' FOR KEY SHARE; SELECT pg_sleep(1.0); INSERT INTO public.post_labels (post_id, label, post_version, source_role, reason) VALUES ('$P18', 'outdated', 1, 'community_moderator', 'race') RETURNING 'a'" \
        - "INSERT INTO public.post_labels (post_id, label, post_version, source_role, reason) VALUES ('$P18', 'misleading', 1, 'platform_admin', 'race') RETURNING 'b'"
F=$(LABELS $P18)
if grep -q '^a$' "$D/r4fa" && grep -q '^b$' "$D/r4fb" && ! grep -q 'deadlock' "$D/r4fa" "$D/r4fb" && [ "$F" = "{misleading,outdated}|2|2" ]; then ok R4f "both label writes landed, no deadlock; labels|active|records $F"
else bad R4f "a=$(r "$D/r4fa") b=$(r "$D/r4fb") labels|active|records=$F"; fi

# ---- R5: a pin in flight, then an unpin
two r5 $CM  "SELECT public.admin_set_post_pinned('$P9', true, 1) ->> 'is_pinned'" \
       $CM2 "SELECT public.admin_set_post_pinned('$P9', false, 1) ->> 'is_pinned'"
F=$(q "SELECT is_pinned || '|' || (pinned_until IS NULL) || '|' || (SELECT string_agg(action, ',' ORDER BY id) FROM public.admin_actions WHERE target_id = '$P9') FROM public.posts WHERE id = '$P9'")
if grep -q '^true$' "$D/r5a" && grep -q '^false$' "$D/r5b" && [ "$F" = "false|true|post.pin,post.unpin" ]; then ok R5 "the unpin waited and landed; pinned|until null|audit $F"
else bad R5 "pin=$(r "$D/r5a") unpin=$(r "$D/r5b") final=$F"; fi

# ---- R5b: a hold in flight, then a pin
two r5b $CM  "SELECT public.admin_hold_post('$P10', 1) ->> 'success'" \
        $CM2 "SELECT public.admin_set_post_pinned('$P10', true, 1) ->> 'is_pinned'"
F=$(q "SELECT is_hidden || '|' || is_pinned || '|' || (pinned_until IS NULL) FROM public.posts WHERE id = '$P10'")
if grep -q '^true$' "$D/r5ba" && grep -q 'post_not_visible' "$D/r5bb" && [ "$F" = "true|false|true" ]; then ok R5b "the pin waited and was refused on the held post; hidden|pinned|until null $F"
else bad R5b "hold=$(r "$D/r5ba") pin=$(r "$D/r5bb") final=$F"; fi

# ---- R6: two moderators approve one draft at once
two r6 $CM  "SELECT public.admin_review_petition('$T1', 'approve') ->> 'changed'" \
       $CM2 "SELECT (j ->> 'changed') || '|' || ((j ->> 'post_id') IS NOT NULL) FROM public.admin_review_petition('$T1', 'approve') j"
F=$(q "SELECT status || '|' || (SELECT count(*) FROM public.posts WHERE petition_id = '$T1') || '|' || (SELECT count(*) FROM public.admin_actions WHERE target_id = '$T1') FROM public.petitions WHERE id = '$T1'")
if grep -q '^true$' "$D/r6a" && grep -q '^false|true$' "$D/r6b" && [ "$F" = "approved|1|1" ]; then ok R6 "one post, one audit row; the second answered the same post; status|posts|audit $F"
else bad R6 "a=$(r "$D/r6a") b=$(r "$D/r6b") final=$F"; fi

# ---- R6b: an approval in flight, then a rejection
two r6b $CM  "SELECT public.admin_review_petition('$T2', 'approve') ->> 'status'" \
        $CM2 "SELECT public.admin_review_petition('$T2', 'reject', 'duplicate') ->> 'status'"
F=$(q "SELECT status || '|' || (SELECT count(*) FROM public.posts WHERE petition_id = '$T2') FROM public.petitions WHERE id = '$T2'")
if grep -q '^approved$' "$D/r6ba" && grep -q 'petition_not_draft' "$D/r6bb" && [ "$F" = "approved|1" ]; then ok R6b "one decision; the rejection waited and was refused; status|posts $F"
else bad R6b "approve=$(r "$D/r6ba") reject=$(r "$D/r6bb") final=$F"; fi

# ---- R6c: a text change by the table owner in flight, then the approval
two r6c - "UPDATE public.petitions SET title = 'edit vs approve (new title)', body = 'body three, rewritten' WHERE id = '$T3' RETURNING 'edited'" \
        $CM "SELECT public.admin_review_petition('$T3', 'approve') ->> 'status'"
F=$(q "SELECT (p.body_version_hash = encode(sha256(convert_to('body three, rewritten', 'UTF8')), 'hex')) || '|' || ((SELECT details ->> 'body_version_hash' FROM public.admin_actions WHERE target_id = '$T3') = p.body_version_hash) || '|' || (SELECT content FROM public.posts WHERE petition_id = p.id) FROM public.petitions p WHERE id = '$T3'")
if grep -q '^edited$' "$D/r6ca" && grep -q '^approved$' "$D/r6cb" && [ "$F" = "true|true|edit vs approve (new title)" ]; then ok R6c "the approval waited and approved the text as it stands; hash ok|audit hash ok|post text: $F"
else bad R6c "edit=$(r "$D/r6ca") approve=$(r "$D/r6cb") final=$F"; fi

# ---- R6d: a first signature in flight, then a text change
SIGN() { echo "INSERT INTO public.petition_signatures (petition_id, signer_id, signer_display_name, affirmation_text, petition_version_hash) VALUES ('$1', '$B', 'B', 'I support this', '$2') RETURNING 'signed'"; }
H4=$(q "SELECT body_version_hash FROM public.petitions WHERE id = '$T4'"); H5=$(q "SELECT body_version_hash FROM public.petitions WHERE id = '$T5'")
two r6d - "$(SIGN $T4 $H4)" \
        - "UPDATE public.petitions SET body = 'a different text' WHERE id = '$T4' RETURNING 'edited'"
F=$(q "SELECT body || '|' || (SELECT count(*) FROM public.petition_signatures s WHERE s.petition_id = p.id AND s.petition_version_hash = p.body_version_hash) FROM public.petitions p WHERE id = '$T4'")
if grep -q '^signed$' "$D/r6da" && grep -q 'petition_text_locked' "$D/r6db" && [ "$F" = "body four|1" ]; then ok R6d "the text change waited for the signature and was refused; text|matching signatures $F"
else bad R6d "sign=$(r "$D/r6da") edit=$(r "$D/r6db") final=$F"; fi

# ---- R6e: a text change in flight, then a signature carrying the old hash
two r6e - "UPDATE public.petitions SET body = 'body five, rewritten' WHERE id = '$T5' RETURNING 'edited'" \
        - "$(SIGN $T5 $H5)"
F=$(q "SELECT body || '|' || (SELECT count(*) FROM public.petition_signatures s WHERE s.petition_id = p.id) FROM public.petitions p WHERE id = '$T5'")
if grep -q '^edited$' "$D/r6ea" && grep -q 'petition_text_changed' "$D/r6eb" && [ "$F" = "body five, rewritten|0" ]; then ok R6e "the signature of the old text waited and was refused; text|signatures $F"
else bad R6e "edit=$(r "$D/r6ea") sign=$(r "$D/r6eb") final=$F"; fi

# ---- R7: dismissed, edited, then the same member reports the new version twice at once
as1 $B "SELECT public.submit_content_report('post', '$P11', 'spam') ->> 'accepted'" >/dev/null
as1 $CM "SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '$P11'), 'dismiss') ->> 'action'" >/dev/null
as1 $A "SELECT public.edit_post('$P11', 1, '{\"content\":\"re-report, edited\"}') ->> 'version'" >/dev/null
two r7 $B "SELECT public.submit_content_report('post', '$P11', 'abusive') ->> 'accepted'" \
       $B "SELECT public.submit_content_report('post', '$P11', 'abusive') ->> 'accepted'"
F=$(q "SELECT string_agg(status || '@' || reported_version, ',' ORDER BY reported_version, status) FROM public.content_reports WHERE content_id = '$P11'")
if grep -q '^true$' "$D/r7a" && grep -q '^false$' "$D/r7b" && [ "$F" = "dismissed@1,open@2" ]; then ok R7 "one open report for the new version; the double tap changed nothing; reports $F"
else bad R7 "a=$(r "$D/r7a") b=$(r "$D/r7b") reports=$F"; fi

# ---- R7b: the second and third reporters of a comment at once
as1 $B "SELECT public.submit_content_report('comment', '$K1', 'spam') ->> 'accepted'" >/dev/null
two r7b $C  "SELECT public.submit_content_report('comment', '$K1', 'spam') ->> 'report_count'" \
        $C2 "SELECT public.submit_content_report('comment', '$K1', 'spam')::text"
F=$(q "SELECT (SELECT count(*) FROM public.content_reports WHERE content_id = c.id AND status = 'open') || '|' || is_hidden || '|' || COALESCE(hidden_reason, '-') FROM public.post_comments c WHERE id = '$K1'")
if grep -q '^2$' "$D/r7ba" && grep -q '"hidden": true' "$D/r7bb" && [ "$F" = "3|true|community_reports_threshold" ]; then ok R7b "the third report waited, counted 3 and hid the comment; open|hidden|reason $F"
else bad R7b "a=$(r "$D/r7ba") b=$(r "$D/r7bb") open|hidden|reason=$F"; fi

if [ $fail = 0 ]; then echo "PASS r3_foundation race: R1 R1b R1c R1d R2 R2b R3 R3b R3c R3e R3f R3g R3h R3i R3j R3k R3m R3l R4 R4b R4c R4d R4e R4f R5 R5b R6 R6b R6c R6d R6e R7 R7b"; else echo "FAIL r3_foundation race"; exit 1; fi
