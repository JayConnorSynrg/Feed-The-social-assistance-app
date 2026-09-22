/**
 * poll-tally.ts
 *
 * Pure (no-React) poll tally aggregation, shared by usePollData's initial fetch,
 * its settle-from-server path, and its realtime signal handler.
 *
 * W1.4: poll_votes realtime events are column-scoped SIGNALS — the publication
 * puts ONLY poll_id on the wire, so a realtime payload carries no option_index.
 * The correct response to any signal is therefore to RE-AGGREGATE tallies from an
 * authoritative RLS-filtered read of the vote rows — never to increment/decrement
 * from the payload (which, under the signal-only publication, would read an
 * undefined option_index and corrupt the tally with NaN).
 *
 * JSX-free so the vitest (node-environment) suite can exercise it directly.
 */

/** The only field aggregation needs from a vote row. */
export interface PollVoteOption {
  option_index: number
}

/**
 * Aggregate per-option tallies from an authoritative list of vote rows.
 *
 * Absolute, never incremental: the returned array is the count of votes per
 * option index derived wholly from `votes`. An out-of-range or non-numeric
 * option_index (e.g. the `undefined` a signal-only realtime payload would carry
 * if it were ever mistakenly aggregated) is skipped, so a malformed row can
 * never produce a NaN tally.
 */
export function aggregatePollTallies(
  optionCount: number,
  votes: readonly PollVoteOption[]
): number[] {
  const tallies = Array<number>(Math.max(0, optionCount)).fill(0)
  for (const v of votes) {
    const idx = v.option_index
    if (typeof idx === 'number' && idx >= 0 && idx < tallies.length) {
      tallies[idx]++
    }
  }
  return tallies
}
