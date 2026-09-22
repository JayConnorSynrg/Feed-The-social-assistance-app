// poll-tally.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Guards the W1.4 poll realtime path: a poll_votes SIGNAL carries no option_index
// (publication is poll_id-only), so tallies are RE-AGGREGATED from an authoritative
// vote-row read, never incremented from a payload. These tests pin that the
// aggregation is absolute and cannot be corrupted by a signal-shaped (option_index
// undefined) row into a NaN tally.

import { describe, it, expect } from 'vitest'
import { aggregatePollTallies } from './poll-tally'

describe('aggregatePollTallies', () => {
  it('counts votes per option (absolute, not incremental)', () => {
    const votes = [
      { option_index: 0 },
      { option_index: 2 },
      { option_index: 0 },
      { option_index: 1 },
    ]
    expect(aggregatePollTallies(3, votes)).toEqual([2, 1, 1])
  })

  it('re-aggregating the same list twice yields the same absolute tallies (no drift under repeated signals)', () => {
    const votes = [{ option_index: 0 }, { option_index: 0 }, { option_index: 1 }]
    const first = aggregatePollTallies(2, votes)
    const second = aggregatePollTallies(2, votes)
    // Two realtime signals both settle from the SAME authoritative read → identical
    // result, never a doubled 2x-increment.
    expect(first).toEqual([2, 1])
    expect(second).toEqual(first)
  })

  it('skips an undefined option_index without producing NaN (signal-only payload shape)', () => {
    // A poll_votes realtime payload under the signal-only publication carries no
    // option_index. If such a row ever reached aggregation, it must be ignored —
    // not incremented into a NaN tally (the pre-W1.4 payload-increment regression).
    const votes = [{ option_index: undefined as unknown as number }, { option_index: 1 }]
    const tallies = aggregatePollTallies(3, votes)
    expect(tallies).toEqual([0, 1, 0])
    expect(tallies.some((t) => Number.isNaN(t))).toBe(false)
  })

  it('ignores out-of-range indexes and returns a zero-filled array for an empty list', () => {
    expect(aggregatePollTallies(2, [{ option_index: 5 }, { option_index: -1 }])).toEqual([0, 0])
    expect(aggregatePollTallies(3, [])).toEqual([0, 0, 0])
  })
})
