/**
 * feed-subtab.ts
 *
 * Pure (no-JSX, no-React) resolution of the Community panel's active subtab from
 * the durable navigation param (`panelParams.subtab`).
 *
 * The Community ("feed") panel hosts six subtabs — Feed, Events, Businesses,
 * Organizations, Petitions, Messages. The five non-default ones (events /
 * businesses / organizations / petitions / messages) are reached via
 * PANEL_ALIASES, which set `panelParams.subtab` to that value; the base "feed"
 * view is the default when no (or an unrecognized) subtab is present.
 *
 * Extracting this as a pure function means the derivation is unit-testable in
 * isolation and shared by a single code path, so the rendered subtab can never
 * disagree with the resolved value. Any value that is not one of the explicit
 * subtabs resolves to 'feed' — including `undefined` (the param having
 * been cleared on a return-to-feed navigation), which is what makes clicking
 * "Feed" from Events/Petitions land back on the feed.
 */

export type FeedSubtab = 'feed' | 'events' | 'businesses' | 'organizations' | 'petitions' | 'messages'

/**
 * Resolve the active Community subtab from an untyped `panelParams.subtab` value.
 * Only the explicit non-default subtabs are recognized; everything else
 * (including undefined/null/unknown strings) resolves to the 'feed' default.
 */
export function resolveFeedSubtab(subtab: unknown): FeedSubtab {
  if (subtab === 'messages') return 'messages'
  if (subtab === 'events') return 'events'
  if (subtab === 'businesses') return 'businesses'
  if (subtab === 'organizations') return 'organizations'
  if (subtab === 'petitions') return 'petitions'
  return 'feed'
}
