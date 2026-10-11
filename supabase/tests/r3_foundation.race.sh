#!/bin/bash
# r3_foundation.race.sh — two-session concurrency checks for 20261026600000 (Release 3 foundation).
# A single-transaction SQL smoke cannot reach these paths, hence a separate script. In every scenario session 1
# makes its call and holds its transaction open; session 2 arrives while it is open.
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
#   R3   an offer with one slot, taken. The seeker's direct DELETE in flight, then another seeker opts in: the
#        opt-in waits, finds the slot returned and is taken; slots = capacity - rows.
#   R3b  two seekers direct-DELETE their own opt-ins at once: both slots come back (never one, never three).
#   R3c  withdraw_opt_in in flight, then the same seeker's direct DELETE of the same row (and the reverse order):
#        one of them deletes, the slot comes back exactly once.
#   Labels
#   R4   two moderators apply the same label at once: one record; the second answers changed = false; one audit row.
#   R4b  a retraction in flight, then another moderator applies the label: after the wait a NEW record is written;
#        posts.labels equals the active records.
#   R4c  the author's own "sensitive" in flight, then a moderator's: two records, posts.labels = {sensitive}.
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
D=$(mktemp -d); RDB=feed_race_r3_$$; HOLD=${HOLD:-1.5}; GAP=${GAP:-0.6}
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
P13=00000000-0000-4000-a000-0000000000fd
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
     ('$P13', '$A', 'delete vs withdraw', 'source_offer', 2, now() - interval '1 hour');
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

# ---- R3: one slot, taken by B. B's direct DELETE in flight, then C opts in
as1 $B "SELECT (public.opt_in_to_post('$P3')).status" >/dev/null
two r3 $B "DELETE FROM public.resource_opt_ins WHERE post_id = '$P3' AND seeker_id = '$B' RETURNING 'deleted'" \
       $C "SELECT (public.opt_in_to_post('$P3')).status"
F=$(SLOTS $P3)
if grep -q '^deleted$' "$D/r3a" && grep -q '^pending$' "$D/r3b" && [ "$F" = "1/0/1" ]; then ok R3 "the opt-in waited, found the slot returned and was taken; max/slots/rows $F"
else bad R3 "delete=$(r "$D/r3a") optin=$(r "$D/r3b") max/slots/rows=$F"; fi

# ---- R3b: two seekers direct-DELETE their own opt-ins at once
as1 $B "SELECT (public.opt_in_to_post('$P4')).status" >/dev/null; as1 $C "SELECT (public.opt_in_to_post('$P4')).status" >/dev/null
two r3b $B "DELETE FROM public.resource_opt_ins WHERE post_id = '$P4' AND seeker_id = '$B' RETURNING 'deleted'" \
        $C "DELETE FROM public.resource_opt_ins WHERE post_id = '$P4' AND seeker_id = '$C' RETURNING 'deleted'"
F=$(SLOTS $P4)
if grep -q '^deleted$' "$D/r3ba" && grep -q '^deleted$' "$D/r3bb" && [ "$F" = "2/2/0" ]; then ok R3b "both slots came back; max/slots/rows $F"
else bad R3b "a=$(r "$D/r3ba") b=$(r "$D/r3bb") max/slots/rows=$F"; fi

# ---- R3c: withdraw_opt_in in flight, then the same seeker's direct DELETE; then the reverse order (C keeps a second row throughout)
as1 $B "SELECT (public.opt_in_to_post('$P5')).status" >/dev/null; as1 $C "SELECT (public.opt_in_to_post('$P5')).status" >/dev/null
two r3c $B "SELECT public.withdraw_opt_in('$P5')::text" \
        $B "WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '$P5' AND seeker_id = '$B' RETURNING 1) SELECT count(*) FROM d"
F=$(SLOTS $P5)
as1 $B "SELECT (public.opt_in_to_post('$P13')).status" >/dev/null; as1 $C "SELECT (public.opt_in_to_post('$P13')).status" >/dev/null
two r3d $B "WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '$P13' AND seeker_id = '$B' RETURNING 1) SELECT count(*) FROM d" \
        $B "SELECT public.withdraw_opt_in('$P13')::text"
G=$(SLOTS $P13)
if grep -q '^true$' "$D/r3ca" && grep -q '^0$' "$D/r3cb" && [ "$F" = "2/1/1" ] && grep -q '^1$' "$D/r3da" && grep -q '^false$' "$D/r3db" && [ "$G" = "2/1/1" ]; then ok R3c "one delete each time, the slot back exactly once; max/slots/rows $F and $G"
else bad R3c "withdraw=$(r "$D/r3ca") delete=$(r "$D/r3cb") final=$F | delete=$(r "$D/r3da") withdraw=$(r "$D/r3db") final=$G"; fi

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

if [ $fail = 0 ]; then echo "PASS r3_foundation race: R1 R1b R1c R1d R2 R2b R3 R3b R3c R4 R4b R4c R5 R5b R6 R6b R6c R6d R6e R7 R7b"; else echo "FAIL r3_foundation race"; exit 1; fi
