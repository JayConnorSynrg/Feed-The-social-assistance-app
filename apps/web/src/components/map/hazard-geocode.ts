// Pure geocode-decision core for the hazard bubble menu (hazard-bubble-menu.tsx).
// Extracted so the load-bearing "does the address geocode move the staging pin"
// gate is unit-testable in the node test env without rendering the menu. The
// menu imports planHazardGeocode from here; the tests exercise the exact same
// function the component runs.
//
// A hazard pin always has a coordinate independent of the address box (seeded
// from map center on wizard open, mutable by drag). The address geocode is a
// third, convenience source that is allowed to overwrite that coordinate ONLY
// on a strong match — mirroring the resource pins' move-only-on-strong-match
// gate so a weak/approximate address never flings a hazard pin to the wrong
// place. Any non-strong result (weak match, no feature, missing token, network
// failure — all surface as resolveGeoPointV6 → non-strong or null) leaves the
// existing pin coordinate untouched.
import type { GeocodeMatch } from '@/lib/mapbox-geocode-v6'
import { isStrongMatch } from '@/app/(admin)/moderation/resource-edit-geo'

/** The decision on whether an address geocode may move the staging pin, plus
 *  the classification fields for structured logging. `move` is true only on a
 *  strong match, in which case `coords` carries the coordinate to apply. */
export interface HazardGeocodeDecision {
  move: boolean
  coords?: { lng: number; lat: number }
  accuracy?: string
  confidence?: string
}

/**
 * Pure gate over a classified v6 geocode result. Reuses isStrongMatch (the same
 * predicate the resource-edit path uses) so both surfaces agree on what counts
 * as strong. Strong match → move the pin to the geocoded coordinate; anything
 * else → leave the pin where it is, but surface accuracy/confidence (when a
 * match came back at all) so the caller can log WHY it did not move.
 */
export function planHazardGeocode(match: GeocodeMatch | null | undefined): HazardGeocodeDecision {
  // Read classification fields while `match` still holds its object type — the
  // isStrongMatch guard narrows the else branch to null|undefined, where a
  // `match?.accuracy` access would have no object type to resolve against.
  const accuracy = match?.accuracy
  const confidence = match?.confidence
  if (isStrongMatch(match)) {
    return { move: true, coords: { lng: match.lng, lat: match.lat }, accuracy, confidence }
  }
  return { move: false, accuracy, confidence }
}
