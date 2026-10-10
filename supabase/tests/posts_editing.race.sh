#!/bin/bash
# posts_editing.race.sh — two-session concurrency checks for 20261026000000 (post editing).
# A single-transaction SQL smoke cannot reach these paths, hence a separate script.
#   C1  two edits of one post with the same expected version: exactly one wins, the other gets PT409
#       (never a silent overwrite); one history row.
#   C2  a vote in flight, then an options edit: the edit waits for the vote, sees it, and is refused
#       (post_field_locked:options); the vote stands. The poll is already engaged (engaged_at set), so the
#       vote takes no post lock and only edit_post's polls row lock orders the two.
#   C2b an options edit in flight, then a vote (the poll's first engagement: the vote's BEFORE trigger waits
#       on the post lock): the vote waits, then lands on the edited options.
#   C3  capacity cut to the committed count while another opt-in is in flight behind it: the opt-in
#       waits and is refused 'This offer is full'; max/slots/rows stay consistent.
#   C3b an opt-in in flight, then a capacity cut below the new count: the cut waits, then is refused
#       capacity_below_committed.
#   C4  two edits of one comment with the same expected version: one wins, the other gets PT409.
#   C5  an author edit of a HELD post in flight while a moderator approves the version they saw:
#       the approval waits, then gets PT409; the post stays hidden for review.
#   C6  a delete in flight, then an edit: the edit waits, then gets post_not_found.
#   C7  two deletes of one post at once: exactly one succeeds, the other gets post_not_found;
#       deleted_at is the winner's.
#   C8  two deletes of one comment at once: exactly one succeeds, the other gets PT404.
#   C9  two members soft-delete DIFFERENT comments of one post at once: posts.comment_count ends equal to
#       the comments neither deleted nor hidden (the second recount waits for the first's post lock).
#   C9b a soft delete in flight while a moderator hides another comment of the same post: same invariant.
#   C10 the author likes their own post (no profile lock on that path) while another member likes it:
#       like_count ends equal to the like rows.
#   C11 two members report a post that already has one open report: the second report waits for the
#       first, counts 3 and hides the post (without the post lock both counted 2 and it stayed visible).
#   C12 a like in flight on a fresh post while its author edits: the edit waits for the like, sees
#       engaged_at and is recorded (no quiet edit after someone engaged).
#
# Usage: PSQL=<psql wrapper> TEMPLATE_DB=<db with the migration applied> posts_editing.race.sh
#   PSQL is called as `DB=<name> $PSQL <psql args>` (the FEED PG17 harness `p` wrapper).
# Local / ephemeral databases only: it creates, seeds and drops a scratch database.
set -u
: "${PSQL:?set PSQL to the harness psql wrapper}"; TPL=${TEMPLATE_DB:-feed_base}
D=$(mktemp -d); RDB=feed_race_posts_$$
trap 'rm -rf "$D"; DB=postgres $PSQL -qc "SET client_min_messages=warning" -c "DROP DATABASE IF EXISTS $RDB" >/dev/null' EXIT
DB=postgres $PSQL -qc "SET client_min_messages=warning" -c "DROP DATABASE IF EXISTS $RDB" -c "CREATE DATABASE $RDB TEMPLATE $TPL" >/dev/null || exit 1
q() { DB=$RDB $PSQL -At -c "$1"; }

A=a0000000-0000-4000-8000-0000000000a1; B=b0000000-0000-4000-8000-0000000000b2; C=c0000000-0000-4000-8000-0000000000c3
CM=e0000000-0000-4000-8000-0000000000e5
P1=00000000-0000-4000-a000-0000000000f1; P3=00000000-0000-4000-a000-0000000000f3; P5=00000000-0000-4000-a000-0000000000f5
P6=00000000-0000-4000-a000-0000000000f6; P7=00000000-0000-4000-a000-0000000000f7; P8=00000000-0000-4000-a000-0000000000f8
P9=00000000-0000-4000-a000-0000000000f9; P10=00000000-0000-4000-a000-0000000000fa; P11=00000000-0000-4000-a000-0000000000fb
P12=00000000-0000-4000-a000-0000000000fc; P13=00000000-0000-4000-a000-0000000000fd; P14=00000000-0000-4000-a000-0000000000fe
POLL=0b000000-0000-4000-8000-0000000000f5; POLL2=0b000000-0000-4000-8000-0000000000f6; K1=0d000000-0000-4000-8000-0000000000f1
K2=0d000000-0000-4000-8000-0000000000f2; K3=0d000000-0000-4000-8000-0000000000f3; K4=0d000000-0000-4000-8000-0000000000f4
K5=0d000000-0000-4000-8000-0000000000f5; K6=0d000000-0000-4000-8000-0000000000f6; K7=0d000000-0000-4000-8000-0000000000f7
q "INSERT INTO auth.users (id, email) VALUES ('$A','race-a@t'), ('$B','race-b@t'), ('$C','race-c@t'), ('$CM','race-cm@t');
   INSERT INTO public.profiles (id) SELECT id FROM auth.users WHERE email LIKE 'race-%' ON CONFLICT (id) DO NOTHING;
   SELECT set_config('feed.tier_write', 'on', false);
   UPDATE public.profiles SET admin_tier = 'community_moderator' WHERE id = '$CM';
   INSERT INTO public.posts (id, user_id, content, post_type, max_seekers, created_at) VALUES
     ('$P1', '$A', 'race post', 'feed', NULL, now() - interval '1 hour'),
     ('$P3', '$A', 'race offer', 'source_offer', 3, now() - interval '1 hour'),
     ('$P5', '$A', 'Race poll?', 'poll', NULL, now() - interval '1 hour'),
     ('$P6', '$A', 'Race poll 2?', 'poll', NULL, now() - interval '1 hour'),
     ('$P7', '$A', 'held post', 'feed', NULL, now() - interval '1 hour'),
     ('$P8', '$A', 'to delete', 'feed', NULL, now() - interval '1 hour'),
     ('$P9', '$A', 'delete twice', 'feed', NULL, now() - interval '1 hour'),
     ('$P10', '$A', 'count race', 'feed', NULL, now() - interval '1 hour'),
     ('$P11', '$A', 'count race 2', 'feed', NULL, now() - interval '1 hour'),
     ('$P12', '$A', 'like race', 'feed', NULL, now() - interval '1 hour'),
     ('$P13', '$A', 'report race', 'feed', NULL, now() - interval '1 hour'),
     ('$P14', '$A', 'fresh post', 'feed', NULL, now());
   INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason) VALUES ('$CM', 'post', '$P13', 'spam');
   INSERT INTO public.polls (id, post_id, question, options) VALUES ('$POLL', '$P5', 'Race poll?', '[\"Sat\",\"Sun\"]'),
                                                                     ('$POLL2', '$P6', 'Race poll 2?', '[\"Sat\",\"Sun\"]');
   INSERT INTO public.post_comments (id, post_id, user_id, content, created_at) VALUES ('$K1', '$P1', '$B', 'race comment', now() - interval '1 hour'),
                                                                                    ('$K2', '$P1', '$B', 'delete me twice', now() - interval '1 hour'),
     ('$K3', '$P10', '$B', 'b on p10', now()), ('$K4', '$P10', '$C', 'c on p10', now()), ('$K5', '$P10', '$A', 'a on p10', now()),
     ('$K6', '$P11', '$B', 'b on p11', now()), ('$K7', '$P11', '$C', 'c on p11', now());
   UPDATE public.posts SET is_hidden = true, hidden_at = now(), hidden_reason = 'hold_for_review' WHERE id = '$P7';
   UPDATE public.posts SET engaged_at = now() - interval '1 hour' WHERE id = '$P5';" >/dev/null || { echo "FAIL race setup"; exit 1; }
AS() { echo "SELECT set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false); SET ROLE authenticated;"; }
# first line that is a value or an ERROR from a session's output
r() { grep -E '^[0-9a-z{]|ERROR' "$1" | grep -v '^set_config' | tail -1; }
fail=0
ok()  { echo "  $1 ok: $2"; }
bad() { echo "  $1 FAIL: $2"; fail=1; }

# ---- C1: two edits, same expected version
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $A)" -c "SELECT public.edit_post('$P1', 1, '{\"content\":\"tab one\"}')->>'version'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c1a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $A)" -c "SELECT public.edit_post('$P1', 1, '{\"content\":\"tab two\"}')->>'version'" > "$D/c1b" 2>&1
wait
F1=$(q "SELECT version || '|' || content || '|' || (SELECT count(*) FROM public.post_revisions WHERE post_id = '$P1') FROM public.posts WHERE id = '$P1'")
if grep -q '^2$' "$D/c1a" && grep -q 'edit_conflict' "$D/c1b" && [ "$F1" = "2|tab one|1" ]; then ok C1 "tab one -> 2, tab two -> PT409, final $F1"
else bad C1 "a=$(r "$D/c1a") b=$(r "$D/c1b") final=$F1"; fi

# ---- C2: vote in flight, then options edit
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $B)" -c "INSERT INTO public.poll_votes (poll_id, user_id, option_index) VALUES ('$POLL', '$B', 0) RETURNING 'voted'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c2a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $A)" -c "SELECT public.edit_post('$P5', 1, '{\"options\":[\"Mon\",\"Tue\"]}')->>'version'" > "$D/c2b" 2>&1
wait
F2=$(q "SELECT options::text || '|' || (SELECT count(*) FROM public.poll_votes WHERE poll_id = '$POLL') FROM public.polls WHERE id = '$POLL'")
if grep -q 'post_field_locked:options' "$D/c2b" && [ "$F2" = '["Sat", "Sun"]|1' ]; then ok C2 "edit waited, saw the vote, refused; final $F2"
else bad C2 "vote=$(r "$D/c2a") edit=$(r "$D/c2b") final=$F2"; fi

# ---- C2b: options edit in flight, then vote
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $A)" -c "SELECT public.edit_post('$P6', 1, '{\"options\":[\"Mon\",\"Tue\"]}')->>'version'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c2c" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $B)" -c "INSERT INTO public.poll_votes (poll_id, user_id, option_index) VALUES ('$POLL2', '$B', 1) RETURNING 'voted'" > "$D/c2d" 2>&1
wait
F2b=$(q "SELECT options::text || '|' || (SELECT count(*) FROM public.poll_votes WHERE poll_id = '$POLL2') FROM public.polls WHERE id = '$POLL2'")
if grep -q '^2$' "$D/c2c" && grep -q '^voted$' "$D/c2d" && [ "$F2b" = '["Mon", "Tue"]|1' ]; then ok C2b "vote waited, landed on the edited options; final $F2b"
else bad C2b "edit=$(r "$D/c2c") vote=$(r "$D/c2d") final=$F2b"; fi

# ---- C3: B committed opt-in; cut to 1 held open; C's opt-in waits, then 'full'
DB=$RDB $PSQL -At -c "$(AS $B)" -c "SELECT (public.opt_in_to_post('$P3')).status" >/dev/null 2>&1
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $A)" -c "SELECT public.edit_post('$P3', 1, '{\"max_seekers\":1}')->>'version'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c3a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $C)" -c "SELECT (public.opt_in_to_post('$P3')).status" > "$D/c3b" 2>&1
wait
F3=$(q "SELECT max_seekers || '/' || slots_remaining || '/' || (SELECT count(*) FROM public.resource_opt_ins WHERE post_id = '$P3') FROM public.posts WHERE id = '$P3'")
if grep -q '^2$' "$D/c3a" && grep -q 'This offer is full' "$D/c3b" && [ "$F3" = "1/0/1" ]; then ok C3 "cut won, opt-in refused full; max/slots/rows $F3"
else bad C3 "cut=$(r "$D/c3a") optin=$(r "$D/c3b") final=$F3"; fi

# ---- C3b: raise to 3, C's opt-in held open, cut to 1 waits then refused (2 committed)
q "SELECT set_config('request.jwt.claims', '{\"sub\":\"$A\",\"role\":\"authenticated\"}', false); SELECT public.edit_post('$P3', 2, '{\"max_seekers\":3}')" >/dev/null
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $C)" -c "SELECT (public.opt_in_to_post('$P3')).status" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c3c" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $A)" -c "SELECT public.edit_post('$P3', 3, '{\"max_seekers\":1}')->>'version'" > "$D/c3d" 2>&1
wait
F3b=$(q "SELECT max_seekers || '/' || slots_remaining || '/' || (SELECT count(*) FROM public.resource_opt_ins WHERE post_id = '$P3') FROM public.posts WHERE id = '$P3'")
if grep -q '^pending$' "$D/c3c" && grep -q 'capacity_below_committed' "$D/c3d" && [ "$F3b" = "3/1/2" ]; then ok C3b "opt-in won, cut refused below committed; max/slots/rows $F3b"
else bad C3b "optin=$(r "$D/c3c") cut=$(r "$D/c3d") final=$F3b"; fi

# ---- C4: two comment edits, same expected version
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $B)" -c "SELECT public.edit_comment('$K1', 1, 'comment tab one')->>'version'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c4a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $B)" -c "SELECT public.edit_comment('$K1', 1, 'comment tab two')->>'version'" > "$D/c4b" 2>&1
wait
F4=$(q "SELECT version || '|' || content || '|' || (SELECT count(*) FROM public.post_comment_revisions WHERE comment_id = '$K1') FROM public.post_comments WHERE id = '$K1'")
if grep -q '^2$' "$D/c4a" && grep -q 'edit_conflict' "$D/c4b" && [ "$F4" = "2|comment tab one|1" ]; then ok C4 "tab one -> 2, tab two -> PT409, final $F4"
else bad C4 "a=$(r "$D/c4a") b=$(r "$D/c4b") final=$F4"; fi

# ---- C5: author edits a HELD post (in flight) while a moderator approves version 1
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $A)" -c "SELECT public.edit_post('$P7', 1, '{\"content\":\"held post (changed)\"}')->>'version'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c5a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $CM)" -c "SELECT public.admin_authorize_post('$P7', 1)::text" > "$D/c5b" 2>&1
wait
F5=$(q "SELECT is_hidden || '|' || version || '|' || (needs_review_at IS NOT NULL) FROM public.posts WHERE id = '$P7'")
if grep -q '^2$' "$D/c5a" && grep -q 'edit_conflict' "$D/c5b" && [ "$F5" = "true|2|true" ]; then ok C5 "approval of the unseen version refused after the wait; final hidden|version|needs_review $F5"
else bad C5 "edit=$(r "$D/c5a") approve=$(r "$D/c5b") final=$F5"; fi

# ---- C6: delete in flight, then edit
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $A)" -c "SELECT public.delete_own_post('$P8')->>'deleted'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c6a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $A)" -c "SELECT public.edit_post('$P8', 1, '{\"content\":\"too late\"}')->>'version'" > "$D/c6b" 2>&1
wait
F6=$(q "SELECT content || '|' || version || '|' || (deleted_at IS NOT NULL) FROM public.posts WHERE id = '$P8'")
if grep -q '^true$' "$D/c6a" && grep -q 'post_not_found' "$D/c6b" && [ "$F6" = "to delete|1|true" ]; then ok C6 "edit waited for the delete, then post_not_found; final $F6"
else bad C6 "delete=$(r "$D/c6a") edit=$(r "$D/c6b") final=$F6"; fi

# ---- C7: two deletes at once
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $A)" -c "SELECT public.delete_own_post('$P9')->>'deleted'" -c "SELECT now()::text" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c7a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $A)" -c "SELECT public.delete_own_post('$P9')->>'deleted'" > "$D/c7b" 2>&1
wait
W7=$(grep -E '^[0-9]{4}-' "$D/c7a" | tail -1); F7=$(q "SELECT deleted_at::text FROM public.posts WHERE id = '$P9'")
if grep -q '^true$' "$D/c7a" && grep -q 'post_not_found' "$D/c7b" && [ -n "$W7" ] && [ "$F7" = "$W7" ]; then ok C7 "one delete, the second post_not_found; deleted_at kept"
else bad C7 "a=$(r "$D/c7a") b=$(r "$D/c7b") deleted_at=$F7 winner=$W7"; fi

# ---- C8: two comment deletes at once
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $B)" -c "SELECT public.delete_own_comment('$K2')->>'deleted'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c8a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $B)" -c "SELECT public.delete_own_comment('$K2')->>'deleted'" > "$D/c8b" 2>&1
wait
F8=$(q "SELECT (deleted_at IS NOT NULL) || '|' || content || '|' || (SELECT count(*) FROM public.post_comments WHERE id = '$K2') FROM public.post_comments WHERE id = '$K2'")
if grep -q '^true$' "$D/c8a" && grep -q 'comment_not_found' "$D/c8b" && [ "$F8" = "true||1" ]; then ok C8 "one comment delete, the second PT404; row kept, text removed"
else bad C8 "a=$(r "$D/c8a") b=$(r "$D/c8b") final=$F8"; fi

# posts.comment_count vs the comments neither deleted nor hidden: 'count|truth'
CC() { q "SELECT comment_count || '|' || (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL AND NOT c.is_hidden) FROM public.posts p WHERE id = '$1'"; }

# ---- C9: two soft deletes of different comments of one post at once
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $B)" -c "SELECT public.delete_own_comment('$K3')->>'deleted'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c9a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $C)" -c "SELECT public.delete_own_comment('$K4')->>'deleted'" > "$D/c9b" 2>&1
wait
F9=$(CC $P10)
if grep -q '^true$' "$D/c9a" && grep -q '^true$' "$D/c9b" && [ "$F9" = "1|1" ]; then ok C9 "both deletes landed; count|truth $F9"
else bad C9 "a=$(r "$D/c9a") b=$(r "$D/c9b") count|truth=$F9"; fi

# ---- C9b: a soft delete in flight while a moderator hides another comment of the same post
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $B)" -c "SELECT public.delete_own_comment('$K6')->>'deleted'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c9c" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $CM)" -c "SELECT public.admin_set_comment_hidden('$K7', true)->>'is_hidden'" > "$D/c9d" 2>&1
wait
F9b=$(CC $P11)
if grep -q '^true$' "$D/c9c" && grep -q '^true$' "$D/c9d" && [ "$F9b" = "0|0" ]; then ok C9b "delete and hide both landed; count|truth $F9b"
else bad C9b "delete=$(r "$D/c9c") hide=$(r "$D/c9d") count|truth=$F9b"; fi

# ---- C10: the author's own like in flight, another member's like
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $A)" -c "INSERT INTO public.post_likes (post_id, user_id) VALUES ('$P12', '$A') RETURNING 'liked'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c10a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $B)" -c "INSERT INTO public.post_likes (post_id, user_id) VALUES ('$P12', '$B') RETURNING 'liked'" > "$D/c10b" 2>&1
wait
F10=$(q "SELECT like_count || '|' || (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id) FROM public.posts p WHERE id = '$P12'")
if grep -q '^liked$' "$D/c10a" && grep -q '^liked$' "$D/c10b" && [ "$F10" = "2|2" ]; then ok C10 "both likes landed; like_count|rows $F10"
else bad C10 "a=$(r "$D/c10a") b=$(r "$D/c10b") like_count|rows=$F10"; fi

# ---- C11: reports 2 and 3 at once
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $B)" -c "SELECT public.submit_content_report('post', '$P13', 'spam')->>'report_count'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c11a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $C)" -c "SELECT public.submit_content_report('post', '$P13', 'spam')::text" > "$D/c11b" 2>&1
wait
F11=$(q "SELECT (SELECT count(*) FROM public.content_reports WHERE content_id = p.id AND status = 'open') || '|' || is_hidden || '|' || COALESCE(hidden_reason, '-') FROM public.posts p WHERE id = '$P13'")
if grep -q '^2$' "$D/c11a" && grep -q '"hidden": true, "report_count": 3' "$D/c11b" && [ "$F11" = "3|true|community_reports_threshold" ]; then ok C11 "the second report counted 3 and hid the post; open|hidden|reason $F11"
else bad C11 "a=$(r "$D/c11a") b=$(r "$D/c11b") open|hidden|reason=$F11"; fi

# ---- C12: a like in flight on a fresh post, then the author's edit
(DB=$RDB $PSQL -At -c "BEGIN" -c "$(AS $B)" -c "INSERT INTO public.post_likes (post_id, user_id) VALUES ('$P14', '$B') RETURNING 'liked'" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$D/c12a" 2>&1) &
sleep 0.7
DB=$RDB $PSQL -At -c "$(AS $A)" -c "SELECT public.edit_post('$P14', 1, '{\"content\":\"fresh post!\"}')->>'grace'" > "$D/c12b" 2>&1
wait
F12=$(q "SELECT (engaged_at IS NOT NULL) || '|' || edit_count || '|' || (SELECT count(*) FROM public.post_revisions WHERE post_id = p.id) FROM public.posts p WHERE id = '$P14'")
if grep -q '^liked$' "$D/c12a" && grep -q '^false$' "$D/c12b" && [ "$F12" = "true|1|1" ]; then ok C12 "the edit waited for the like and was recorded; engaged|edit_count|revisions $F12"
else bad C12 "like=$(r "$D/c12a") edit=$(r "$D/c12b") engaged|edit_count|revisions=$F12"; fi

if [ $fail = 0 ]; then echo "PASS posts_editing race: C1 C2 C2b C3 C3b C4 C5 C6 C7 C8 C9 C9b C10 C11 C12"; else echo "FAIL posts_editing race"; exit 1; fi
