#!/bin/bash
# org_scoped_admin_events.race.sh — two-session concurrency check for create_org_event
# (20261020000000). Session A calls create_org_event and holds its transaction open; session B
# makes the SAME call (same org, same idempotency key) while A is uncommitted, so B's pre-check
# cannot see A's row and B reaches the INSERT ... ON CONFLICT (org_id, idempotency_key) path.
# Expected: both calls return the SAME event id; exactly 1 event, 1 date, 1 event.create audit row.
# A single-transaction SQL smoke cannot reach this path, hence a separate script.
#
# Usage: PSQL=<psql wrapper> TEMPLATE_DB=<db with the migration applied> org_scoped_admin_events.race.sh
#   PSQL is called as `DB=<name> $PSQL <psql args>` (the FEED PG17 harness `p` wrapper).
#   The local harness run-tests.sh runs every *.race.sh next to the smoke files it is given.
# Local / ephemeral databases only: it creates and drops a scratch database.
set -u
: "${PSQL:?set PSQL to the harness psql wrapper}"; TPL=${TEMPLATE_DB:-feed_base}
D=$(mktemp -d); RDB=feed_race_$$
trap 'rm -rf "$D"; DB=postgres $PSQL -qc "SET client_min_messages=warning" -c "DROP DATABASE IF EXISTS $RDB" >/dev/null' EXIT
DB=postgres $PSQL -qc "SET client_min_messages=warning" -c "DROP DATABASE IF EXISTS $RDB" -c "CREATE DATABASE $RDB TEMPLATE $TPL" >/dev/null || exit 1
ORG=$(uuidgen | tr A-Z a-z); KEY=$(uuidgen | tr A-Z a-z)
U=$(DB=$RDB $PSQL -Atc "SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.is_admin IS NOT TRUE AND u.is_anonymous IS NOT TRUE ORDER BY p.id LIMIT 1")
[ -z "$U" ] && { echo "SKIP race: needs one plain member"; exit 0; }
DB=$RDB $PSQL -q <<SQL || exit 1
INSERT INTO public.organizations (id, name, org_type, is_active, location)
VALUES ('$ORG', 'Race Org', 'community', true, ST_SetSRID(ST_MakePoint(-72.57, 44.26), 4326)::geography);
INSERT INTO public.organization_members (org_id, user_id, role) VALUES ('$ORG', '$U', 'admin');
SQL
CALL="SELECT public.create_org_event('$ORG', '$KEY', 'Race', 'America/New_York', '2026-11-10 10:00', '2026-11-10 11:00', 'org')"
SETUP="SELECT set_config('request.jwt.claims', '{\"sub\":\"$U\",\"role\":\"authenticated\"}', false); SET ROLE authenticated;"
(DB=$RDB $PSQL -At -c "BEGIN" -c "$SETUP" -c "$CALL" -c "SELECT pg_sleep(3)" -c "COMMIT" > "$D/a.out" 2>&1) &
sleep 1
DB=$RDB $PSQL -At -c "BEGIN" -c "$SETUP" -c "$CALL" -c "COMMIT" > "$D/b.out" 2>&1
wait
A=$(grep -E '^[0-9a-f-]{36}$' "$D/a.out"); B=$(grep -E '^[0-9a-f-]{36}$' "$D/b.out")
CNT=$(DB=$RDB $PSQL -At -c "SELECT (SELECT count(*) FROM public.assistance_events WHERE idempotency_key = '$KEY') || '/' ||
  (SELECT count(*) FROM public.event_occurrences eo JOIN public.assistance_events ae ON ae.id = eo.event_id WHERE ae.idempotency_key = '$KEY') || '/' ||
  (SELECT count(*) FROM public.admin_actions WHERE action = 'event.create' AND details->>'org_id' = '$ORG')")
if [ -n "$A" ] && [ "$A" = "$B" ] && [ "$CNT" = "1/1/1" ]; then
  echo "PASS race: concurrent same-key create_org_event -> one id ($A), event/date/audit = $CNT"; exit 0
fi
echo "FAIL race: A=${A:-<none>} B=${B:-<none>} event/date/audit=$CNT"; grep -h "ERROR" "$D/a.out" "$D/b.out" | head -2; exit 1
