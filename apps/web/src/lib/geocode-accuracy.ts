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

export function isApproximateGeocode(accuracy: string | null | undefined): boolean {
  return !(accuracy != null && PRECISE_GEOCODE_TIERS.has(accuracy))
}

export function buildTierHistogram(rows: { geocode_accuracy?: string | null }[]): Record<string, number> {
  const histogram: Record<string, number> = {
    rooftop: 0,
    parcel: 0,
    point: 0,
    interpolated: 0,
    approximate: 0,
    intersection: 0,
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
