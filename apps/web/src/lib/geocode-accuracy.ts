// Single source of truth for pin-precision classification.
//
// The approximate-pin render guard (resource-marker.tsx), the log
// tier-histogram (map-panel.tsx + use-viewport-resources.ts), and any future
// consumer MUST derive from this ONE module so the render decision and the
// logged histogram can never desync.

// Life-safety render fail-safe: a pin renders EXACT (solid) if and only if
// its accuracy is a verified precise tier -- exactly 'rooftop', 'parcel', or
// 'point'. Every other value renders APPROXIMATE (hollow), including NULL,
// undefined, empty string, and unknown/coarse tiers (interpolated,
// approximate, intersection, etc.). An untagged pin must never claim
// exactness -- absence of a verified tier is treated the same as an
// explicit coarse tier. Production has zero null-accuracy located rows as
// of the backfill closure, so this governs only future/new rows written by
// ingest or admin paths, and is the safe default for them.
export const PRECISE_GEOCODE_TIERS = new Set(['rooftop', 'parcel', 'point'])

// The 'location error' sentinel written into geocode_accuracy (plain text
// column, no enum/constraint) when a geocode attempt was weak or failed AND
// the row has no existing pin (admin_update_resource, p_mark_unlocated). It is
// the SINGLE state consumed by every surface: the admin list/editor badge
// ("needs location"), the map (never plotted — these rows carry no
// coordinates), and search (still findable — search filters on status, never
// on location). It is NOT a precise tier, so isApproximateGeocode() already
// treats it as approximate if a coordinate ever coexisted with it.
export const LOCATION_ERROR_ACCURACY = 'unlocated'

export function isApproximateGeocode(accuracy: string | null | undefined): boolean {
  return !(accuracy != null && PRECISE_GEOCODE_TIERS.has(accuracy))
}

/** True when a row is flagged with the 'location error' state — the admin must
 *  give it a location before it can appear on the map. Consumed by the admin
 *  list card badge and the edit/approve dialog badge. */
export function needsLocation(accuracy: string | null | undefined): boolean {
  return accuracy === LOCATION_ERROR_ACCURACY
}

export function buildTierHistogram(rows: { geocode_accuracy?: string | null }[]): Record<string, number> {
  const histogram: Record<string, number> = {
    rooftop: 0,
    parcel: 0,
    point: 0,
    interpolated: 0,
    approximate: 0,
    intersection: 0,
    unlocated: 0,
    null: 0,
    other: 0,
  }
  for (const row of rows) {
    const acc = row.geocode_accuracy
    if (acc == null || acc === '') {
      histogram.null += 1
    } else if (acc in histogram) {
      histogram[acc] += 1
    } else {
      histogram.other += 1
    }
  }
  return histogram
}
