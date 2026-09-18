// Single source of truth for pin-precision classification.
//
// The approximate-pin render guard (resource-marker.tsx), the log
// tier-histogram (map-panel.tsx + use-viewport-resources.ts), and any future
// consumer MUST derive from this ONE module so the render decision and the
// logged histogram can never desync.

// Precise geocode tiers render as the normal solid pin. Any other present,
// non-empty value (interpolated/approximate/intersection/etc.) renders the
// distinct hollow "approximate" pin. Null/absent ALWAYS renders solid --
// runtime data has untagged rows despite the generated RPC type being
// non-null `string`, so this guard must defend against null regardless of type.
export const PRECISE_GEOCODE_TIERS = new Set(['rooftop', 'parcel', 'point'])

export function isApproximateGeocode(accuracy: string | null | undefined): boolean {
  return accuracy != null && accuracy !== '' && !PRECISE_GEOCODE_TIERS.has(accuracy)
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
