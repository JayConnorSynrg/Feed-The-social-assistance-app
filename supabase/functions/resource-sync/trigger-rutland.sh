#!/usr/bin/env bash
# Trigger an OSM resource sync for Rutland, Vermont (05701).
# Rutland city center: 43.6106° N, 72.9726° W
# 25 km radius covers Rutland city + surrounding towns.
#
# Usage:
#   Local dev (Supabase running locally):
#     ./trigger-rutland.sh
#
#   Production:
#     SUPABASE_URL=https://ndtpovonpadugthmcntl.supabase.co \
#     SUPABASE_ANON_KEY=<anon-key> \
#     RESOURCE_SYNC_SECRET=<secret> \
#     ./trigger-rutland.sh

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
RESOURCE_SYNC_SECRET="${RESOURCE_SYNC_SECRET:-}"

# Build auth headers
AUTH_HEADERS=()
if [[ -n "$RESOURCE_SYNC_SECRET" ]]; then
  AUTH_HEADERS+=(-H "x-sync-secret: ${RESOURCE_SYNC_SECRET}")
fi
if [[ -n "$SUPABASE_ANON_KEY" ]]; then
  AUTH_HEADERS+=(-H "apikey: ${SUPABASE_ANON_KEY}")
fi

echo "Triggering OSM resource sync for Rutland, VT..."
echo "  Endpoint: ${SUPABASE_URL}/functions/v1/resource-sync"
echo "  Center: 43.6106° N, 72.9726° W"
echo "  Radius: 25 km"
echo ""

curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/resource-sync" \
  "${AUTH_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 43.6106,
    "lng": -72.9726,
    "radius_km": 25,
    "source_types": ["osm"]
  }' | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "Done."
