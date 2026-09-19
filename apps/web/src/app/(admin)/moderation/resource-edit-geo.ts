// Pure geocode-decision core for the admin resource edit/approve dialog
// (resource-edit-dialog.tsx). Extracted so the load-bearing "which coordinates
// go into the save payload" logic is unit-testable in the node test env without
// rendering the dialog. The dialog imports planSaveGeo + applySuggestion from
// here; the tests exercise the exact same functions the component runs.
//
// Two paths feed the save payload's coordinates:
//   1. Address autocomplete (W2): the admin picks a live Mapbox v6 suggestion.
//      A STRONG match (precise tier + strong confidence) sets coords + accuracy;
//      a WEAK match fills only the text fields and leaves the pin untouched
//      (move-only-on-strong-match gate).
//   2. On-save forward geocode (pre-existing fallback): when no suggestion backs
//      the current address (free-typed), the address changed since prefill OR the
//      row had no coordinates, run the async forward geocode exactly as before.
// Every other case omits coordinates from the payload so the RPC leaves the
// existing location untouched — an unrelated-field edit never flings the pin.
import { normalizeState } from '@/lib/us-states'
import type { GeocodeMatch, AddressSuggestion } from '@/lib/mapbox-geocode-v6'

/** The address fields whose change (since prefill) can trigger a re-geocode. */
export interface AddressSnapshot {
  address_line1: string
  city: string
  state: string
  zip_code: string
}

export function addressSnapshotOf(f: AddressSnapshot): AddressSnapshot {
  return { address_line1: f.address_line1, city: f.city, state: f.state, zip_code: f.zip_code }
}

export function addressChanged(a: AddressSnapshot, b: AddressSnapshot): boolean {
  return (
    a.address_line1 !== b.address_line1
    || a.city !== b.city
    || a.state !== b.state
    || a.zip_code !== b.zip_code
  )
}

/** A match is "strong" — allowed to move the pin — when it carried a precise
 *  tier + strong confidence, which classifyV6Feature encodes as any accuracy
 *  other than the 'approximate' catch-all. */
export function isStrongMatch(match: GeocodeMatch | null | undefined): match is GeocodeMatch {
  return !!match && match.accuracy !== 'approximate'
}

/** Provisional source label for the geocode event log. When `geocode` is true
 *  the caller finalizes 'mapbox_forward' → 'geocode_failed' on an empty result. */
export type GeoPlanSource =
  | 'use_selected'              // strong-match suggestion selected → its coords go into the payload
  | 'skipped_weak_match'        // weak-match suggestion selected → text filled, pin left untouched
  | 'skipped_online'            // online resource → never geocoded/placed
  | 'no_address'                // no usable address to geocode
  | 'skipped_address_unchanged' // free-typed, address unchanged and row already has coords
  | 'mapbox_forward'            // free-typed → run on-save forward geocode
  | 'geocode_failed'            // free-typed → forward geocode returned nothing (caller sets)

export interface GeoPlan {
  /** Caller must run the async on-save forward geocode when true. */
  geocode: boolean
  /** Query for the async geocode; '' unless geocode is true. */
  query: string
  /** Coordinates to place directly into the payload from a selected strong
   *  match; undefined means "no coordinates from a selection". */
  selected?: GeocodeMatch
  source: GeoPlanSource
}

function buildQuery(f: AddressSnapshot): string {
  return [
    f.address_line1.trim(),
    f.city.trim(),
    normalizeState(f.state) ?? f.state.trim(),
    f.zip_code.trim(),
  ].filter(Boolean).join(', ')
}

export interface PlanSaveGeoArgs {
  serviceMode: string
  form: AddressSnapshot
  initialAddress: AddressSnapshot | null
  initialHasCoords: boolean
  /** The suggestion currently backing the address, or null when the address was
   *  free-typed / edited by hand since the last selection. */
  selection: AddressSuggestion | null
}

/**
 * Decides what coordinates (if any) the save should carry. Pure and sync — the
 * async forward geocode is left to the caller when `geocode` is true.
 */
export function planSaveGeo(args: PlanSaveGeoArgs): GeoPlan {
  const { serviceMode, form, initialAddress, initialHasCoords, selection } = args

  const hasAddress = Boolean(
    form.address_line1.trim() && (form.city.trim() || form.state.trim() || form.zip_code.trim()),
  )

  if (serviceMode === 'online') return { geocode: false, query: '', source: 'skipped_online' }
  if (!hasAddress) return { geocode: false, query: '', source: 'no_address' }

  // A live suggestion currently backs the address (W2 selection path).
  if (selection) {
    if (isStrongMatch(selection.match)) {
      return { geocode: false, query: '', selected: selection.match, source: 'use_selected' }
    }
    // Weak (or coordinate-less) selection: fields are filled, but the pin is
    // left exactly where it was — never fling it to an approximate point.
    return { geocode: false, query: '', source: 'skipped_weak_match' }
  }

  // Free-typed address: keep the pre-existing on-save geocode behavior.
  const changed = addressChanged(form, initialAddress ?? form)
  if (changed || !initialHasCoords) {
    return { geocode: true, query: buildQuery(form), source: 'mapbox_forward' }
  }
  return { geocode: false, query: '', source: 'skipped_address_unchanged' }
}

/** The address subset a suggestion autofills onto a form. */
export interface FormAddressFields {
  address_line1: string
  city: string
  state: string
  zip_code: string
}

/**
 * Returns the address fields overwritten from a chosen suggestion. Only the
 * four address fields change; the caller merges the result into the full form.
 * Every part is written (even '') so the fields faithfully reflect the picked
 * address rather than a stale mix of old and new parts.
 */
export function applySuggestion<T extends FormAddressFields>(form: T, s: AddressSuggestion): T {
  return {
    ...form,
    address_line1: s.address_line1,
    city: s.city,
    state: s.state,
    zip_code: s.zip,
  }
}
