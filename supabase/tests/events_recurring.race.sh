#!/bin/bash
# events_recurring.race.sh — multi-session concurrency checks for 20261023000000 (repeating events).
# A single-transaction SQL smoke cannot reach these paths, hence a separate script.
#   C1  pattern edit held open (A) while the nightly job runs (B): B must not write dates of the
#       replaced pattern (the generator locks the event and reads the rule from the locked row;
#       the nightly job skips an event a writer holds). Afterwards: only the new pattern's dates.
#   C2  nightly job holding its locks (A) while a pattern edit runs (B): B waits, then reconciles.
#   C3  two nightly runs at once: the second returns skipped and writes one 'warn' row; the first
#       writes one 'info' row; no date is written twice.
#   C4  the same repeating create_org_event twice at once (same idempotency key): one event, its
#       dates once, one audit row.
#
# Usage: PSQL=<psql wrapper> TEMPLATE_DB=<db with the migration applied> events_recurring.race.sh
#   PSQL is called as `DB=<name> $PSQL <psql args>` (the FEED PG17 harness `p` wrapper).
# Local / ephemeral databases only: it creates and drops a scratch database.
set -u
: "${PSQL:?set PSQL to the harness psql wrapper}"; TPL=${TEMPLATE_DB:-feed_base}
D=$(mktemp -d); RDB=feed_race_recur_$$
trap 'rm -rf "$D"; DB=postgres $PSQL -qc "SET client_min_messages=warning" -c "DROP DATABASE IF EXISTS $RDB" >/dev/null' EXIT
DB=postgres $PSQL -qc "SET client_min_messages=warning" -c "DROP DATABASE IF EXISTS $RDB" -c "CREATE DATABASE $RDB TEMPLATE $TPL" >/dev/null || exit 1
q() { DB=$RDB $PSQL -At -c "$1"; }
U=$(q "SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.is_admin IS NOT TRUE AND u.is_anonymous IS NOT TRUE ORDER BY p.id LIMIT 1")
[ -z "$U" ] && { echo "SKIP race: needs one plain member"; exit 0; }
ORG=$(uuidgen | tr A-Z a-z)
q "INSERT INTO public.organizations (id, name, org_type, is_active, location) VALUES ('$ORG', 'Race Recur', 'community', true, ST_SetSRID(ST_MakePoint(-72.57, 44.26), 4326)::geography);
   INSERT INTO public.organization_members (org_id, user_id, role) VALUES ('$ORG', '$U', 'admin');" >/dev/null || exit 1
AS_ADMIN="SELECT set_config('request.jwt.claims', '{\"sub\":\"$U\",\"role\":\"authenticated\"}', false); SET ROLE authenticated;"
S=$(q "SELECT (now() AT TIME ZONE 'Etc/UTC')::date + 1")
WK() { q "SELECT jsonb_build_object('frequency','weekly','byDay',jsonb_build_array(jsonb_build_object('day',(ARRAY['mo','tu','we','th','fr','sa','su'])[extract(isodow FROM '$1'::date)::int])))"; }
mk() { DB=$RDB $PSQL -At -c "$AS_ADMIN" -c "SELECT public.create_org_event('$ORG', '$(uuidgen | tr A-Z a-z)', '$1', 'Etc/UTC', '$S 10:00', '$S 11:00', 'org', p_recurrence => '$(WK "$S")'::jsonb)" | grep -E '^[0-9a-f-]{36}$'; }
EDIT() { echo "SELECT public.admin_update_event(p_event_id => '$1', p_recurrence => '$(WK "$2")'::jsonb, p_series_starts_local => '$2 10:00', p_series_ends_local => '$2 11:00')"; }
# Verdict for one event moved to the weekday of NEWD: rule dates only on that weekday, each once.
check() { q "SELECT (SELECT count(*) FROM public.event_occurrences WHERE event_id = '$1' AND source = 'rule' AND status = 'upcoming'
                       AND extract(isodow FROM series_local_date) <> extract(isodow FROM '$2'::date)) || '/' ||
                    (SELECT count(*) FROM public.event_occurrences WHERE event_id = '$1' AND source = 'rule' AND status = 'upcoming') || '/' ||
                    (((now() AT TIME ZONE 'Etc/UTC')::date + 180 - '$2'::date) / 7 + 1)"; }
fail=0; NEWD=$(q "SELECT '$S'::date + 1")

# ---- C1: edit held open, nightly runs meanwhile
E1=$(mk "Race C1"); [ -z "$E1" ] && { echo "FAIL race setup: create"; exit 1; }
(DB=$RDB $PSQL -At -c "BEGIN" -c "$AS_ADMIN" -c "$(EDIT "$E1" "$NEWD")" -c "SELECT pg_sleep(3)" -c "COMMIT" > "$D/c1a.out" 2>&1) &
sleep 1
q "SELECT public.events_generate_nightly()" > "$D/c1b.out" 2>&1
wait
R1=$(check "$E1" "$NEWD"); SK1=$(grep -o '"events_skipped_locked": [0-9]*' "$D/c1b.out")
IFS=/ read -r old new exp <<< "$R1"
if [ "$old" = 0 ] && [ "$new" = "$exp" ] && ! grep -q ERROR "$D/c1a.out" "$D/c1b.out"; then echo "  C1 ok: old-pattern dates=0, new=$new/$exp ($SK1)"
else echo "  C1 FAIL: old-pattern dates=$old new=$new expected=$exp ($SK1)"; grep -h ERROR "$D/c1a.out" "$D/c1b.out" | head -2; fail=1; fi

# ---- C2: nightly holds its locks, edit waits then reconciles
E2=$(mk "Race C2")
(DB=$RDB $PSQL -At -c "BEGIN" -c "SELECT public.events_generate_nightly()" -c "SELECT pg_sleep(3)" -c "COMMIT" > "$D/c2a.out" 2>&1) &
sleep 1
DB=$RDB $PSQL -At -c "BEGIN" -c "$AS_ADMIN" -c "$(EDIT "$E2" "$NEWD")" -c "COMMIT" > "$D/c2b.out" 2>&1
wait
R2=$(check "$E2" "$NEWD"); IFS=/ read -r old new exp <<< "$R2"
if [ "$old" = 0 ] && [ "$new" = "$exp" ] && ! grep -q ERROR "$D/c2a.out" "$D/c2b.out"; then echo "  C2 ok: old-pattern dates=0, new=$new/$exp"
else echo "  C2 FAIL: old=$old new=$new expected=$exp"; grep -h ERROR "$D/c2a.out" "$D/c2b.out" | head -2; fail=1; fi

# ---- C3: two nightly runs at once
q "DELETE FROM public.app_logs WHERE event LIKE 'events.generate.%';
   DELETE FROM public.event_occurrences WHERE event_id = '$E2' AND source = 'rule' AND series_local_date > '$NEWD'::date + 30" >/dev/null
GAP=$(check "$E2" "$NEWD" | cut -d/ -f2)
(DB=$RDB $PSQL -At -c "BEGIN" -c "SELECT public.events_generate_nightly()" -c "SELECT pg_sleep(3)" -c "COMMIT" > "$D/c3a.out" 2>&1) &
sleep 1
q "SELECT public.events_generate_nightly()" > "$D/c3b.out" 2>&1
wait
L3=$(q "SELECT (SELECT count(*) FROM public.app_logs WHERE event = 'events.generate.nightly' AND level = 'info') || '/' ||
               (SELECT count(*) FROM public.app_logs WHERE event = 'events.generate.skipped' AND level = 'warn')")
R3=$(check "$E2" "$NEWD"); IFS=/ read -r old new exp <<< "$R3"
if grep -q '"skipped": true' "$D/c3b.out" && [ "$L3" = "1/1" ] && [ "$new" = "$exp" ] && [ "$GAP" -lt "$exp" ]; then
  echo "  C3 ok: second run skipped, logs info/warn=$L3, refilled $GAP->$new"
else echo "  C3 FAIL: logs=$L3 rows $GAP->$new expected=$exp b=$(head -c 200 "$D/c3b.out")"; fail=1; fi

# ---- C4: same-key repeating create twice at once
KEY=$(uuidgen | tr A-Z a-z)
CALL="SELECT public.create_org_event('$ORG', '$KEY', 'Race C4', 'Etc/UTC', '$S 10:00', '$S 11:00', 'org', p_recurrence => '$(WK "$S")'::jsonb)"
(DB=$RDB $PSQL -At -c "BEGIN" -c "$AS_ADMIN" -c "$CALL" -c "SELECT pg_sleep(3)" -c "COMMIT" > "$D/c4a.out" 2>&1) &
sleep 1
DB=$RDB $PSQL -At -c "BEGIN" -c "$AS_ADMIN" -c "$CALL" -c "COMMIT" > "$D/c4b.out" 2>&1
wait
A=$(grep -E '^[0-9a-f-]{36}$' "$D/c4a.out"); B=$(grep -E '^[0-9a-f-]{36}$' "$D/c4b.out")
N4=$(q "SELECT (SELECT count(*) FROM public.assistance_events WHERE idempotency_key = '$KEY') || '/' ||
               (SELECT count(*) FROM public.event_occurrences eo JOIN public.assistance_events ae ON ae.id = eo.event_id WHERE ae.idempotency_key = '$KEY') || '/' ||
               (SELECT count(*) FROM public.admin_actions WHERE action = 'event.create' AND details->>'org_id' = '$ORG' AND details->>'recurrence' IS NOT NULL
                  AND target_id = (SELECT id::text FROM public.assistance_events WHERE idempotency_key = '$KEY'))")
EXP4="1/$(( ( $(q "SELECT (now() AT TIME ZONE 'Etc/UTC')::date + 180 - '$S'::date") ) / 7 + 1 ))/1"
if [ -n "$A" ] && [ "$A" = "$B" ] && [ "$N4" = "$EXP4" ]; then echo "  C4 ok: one id, event/dates/audit=$N4"
else echo "  C4 FAIL: A=${A:-none} B=${B:-none} event/dates/audit=$N4 expected $EXP4"; grep -h ERROR "$D/c4a.out" "$D/c4b.out" | head -2; fail=1; fi

if [ $fail = 0 ]; then echo "PASS race: C1 edit-vs-nightly, C2 nightly-vs-edit, C3 nightly-vs-nightly, C4 same-key repeating create"; exit 0; fi
echo "FAIL race (events_recurring)"; exit 1
