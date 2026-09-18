import { describe, expect, it } from 'vitest'
import {
  bucketAccuracy,
  buildAddressQuery,
  computeCoarseDecision,
  pageThroughRpc,
  resolveCoarseWrite,
  runWithConcurrency,
  type MapboxFeatureCollection,
  type ResourceRow,
} from './decision.ts'

function addressedRow(overrides: Partial<ResourceRow> = {}): ResourceRow {
  return {
    id: 'r1',
    address_line1: '123 Main St',
    address_line2: null,
    city: 'Rutland',
    state: 'VT',
    zip_code: '05701',
    country: 'us',
    ...overrides,
  }
}

function addresslessRow(id = 'r-no-addr'): ResourceRow {
  return {
    id,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    zip_code: null,
    country: null,
  }
}

function fc(
  accuracy: string | undefined,
  confidence: string | null,
  coords: [number, number] | undefined = [-73.0, 43.6],
): MapboxFeatureCollection {
  return {
    features: [
      {
        geometry: coords ? { coordinates: coords } : undefined,
        properties: {
          coordinates: { accuracy },
          match_code: confidence ? { confidence } : undefined,
        },
      },
    ],
  }
}

describe('bucketAccuracy', () => {
  it('passes through the four precise tiers unchanged', () => {
    expect(bucketAccuracy('rooftop')).toBe('rooftop')
    expect(bucketAccuracy('parcel')).toBe('parcel')
    expect(bucketAccuracy('point')).toBe('point')
    expect(bucketAccuracy('interpolated')).toBe('interpolated')
  })

  it('buckets every other/unknown/undefined value as approximate', () => {
    expect(bucketAccuracy('street')).toBe('approximate')
    expect(bucketAccuracy('place')).toBe('approximate')
    expect(bucketAccuracy(undefined)).toBe('approximate')
  })
})

describe('buildAddressQuery', () => {
  it('drops empty parts without stray commas', () => {
    const row: ResourceRow = {
      id: '1',
      address_line1: '123 Main St',
      address_line2: null,
      city: 'Rutland',
      state: 'VT',
      zip_code: '05701',
      country: 'us',
    }
    expect(buildAddressQuery(row)).toBe('123 Main St, Rutland, VT 05701')
  })

  it('returns null when there is nothing usable', () => {
    const row: ResourceRow = {
      id: '1',
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      zip_code: null,
      country: null,
    }
    expect(buildAddressQuery(row)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// INV-2 (move-only-on-strong-match): computeCoarseDecision
// ---------------------------------------------------------------------------
describe('computeCoarseDecision — INV-2 move-vs-tag', () => {
  it('MOVES the pin on a precise tier + high/exact confidence', () => {
    for (const tier of ['rooftop', 'parcel', 'point'] as const) {
      for (const confidence of ['exact', 'high'] as const) {
        const decision = computeCoarseDecision(fc(tier, confidence, [-73.1, 43.7]))
        expect(decision.isPreciseUpgrade).toBe(true)
        expect(decision.tier).toBe(tier)
        expect(decision.lat).toBe(43.7)
        expect(decision.lng).toBe(-73.1)
      }
    }
  })

  it('TAGS WITHOUT MOVING on a coarser tier even with high confidence', () => {
    const decision = computeCoarseDecision(fc('interpolated', 'exact', [-73.1, 43.7]))
    expect(decision.isPreciseUpgrade).toBe(false)
    expect(decision.lat).toBeNull()
    expect(decision.lng).toBeNull()
  })

  it('TAGS WITHOUT MOVING on a precise tier but medium/low confidence', () => {
    for (const confidence of ['medium', 'low'] as const) {
      const decision = computeCoarseDecision(fc('rooftop', confidence, [-73.1, 43.7]))
      expect(decision.isPreciseUpgrade).toBe(false)
      expect(decision.lat).toBeNull()
      expect(decision.lng).toBeNull()
    }
  })

  it('TAGS WITHOUT MOVING when there is no feature at all', () => {
    const decision = computeCoarseDecision({ features: [] })
    expect(decision.isPreciseUpgrade).toBe(false)
    expect(decision.tier).toBe('approximate')
    expect(decision.lat).toBeNull()
    expect(decision.lng).toBeNull()
  })

  it('TAGS WITHOUT MOVING when coordinates are missing/non-finite', () => {
    const noCoords: MapboxFeatureCollection = {
      features: [
        {
          geometry: undefined,
          properties: {
            coordinates: { accuracy: 'rooftop' },
            match_code: { confidence: 'exact' },
          },
        },
      ],
    }
    const decision = computeCoarseDecision(noCoords)
    expect(decision.isPreciseUpgrade).toBe(false)
    expect(decision.lat).toBeNull()
    expect(decision.lng).toBeNull()
  })

  it('TAGS WITHOUT MOVING on an undefined fc (batch/window error path)', () => {
    const decision = computeCoarseDecision(undefined)
    expect(decision.isPreciseUpgrade).toBe(false)
    expect(decision.tier).toBe('approximate')
  })
})

// ---------------------------------------------------------------------------
// FIX-1 (INV-1 completeness) + INV-2, unified: resolveCoarseWrite
// ---------------------------------------------------------------------------
describe('resolveCoarseWrite — FIX-1 no-address + INV-2 move-vs-tag', () => {
  it('TAGS WITHOUT MOVING a coarse row with no usable address (FIX-1)', () => {
    const result = resolveCoarseWrite(addresslessRow(), undefined)
    expect(result.action).toBe('tagged')
    expect(result.reason).toBe('no_address')
    expect(result.rpcArgs).toEqual({
      p_lat: null,
      p_lng: null,
      p_accuracy: 'approximate',
      p_confidence: null,
    })
  })

  it('TAGS WITHOUT MOVING a coarse row whose address is fine but Mapbox returned no feature', () => {
    const result = resolveCoarseWrite(addressedRow(), { features: [] })
    expect(result.action).toBe('tagged')
    expect(result.reason).toBeUndefined()
    expect(result.rpcArgs).toEqual({
      p_lat: null,
      p_lng: null,
      p_accuracy: 'approximate',
      p_confidence: null,
    })
  })

  it('MOVES an addressed row on a strong match', () => {
    const result = resolveCoarseWrite(addressedRow(), fc('rooftop', 'exact', [-73.2, 43.8]))
    expect(result.action).toBe('upgraded')
    expect(result.rpcArgs).toEqual({
      p_lat: 43.8,
      p_lng: -73.2,
      p_accuracy: 'rooftop',
      p_confidence: 'exact',
    })
  })

  it('TAGS WITHOUT MOVING an addressed row on a weak match', () => {
    const result = resolveCoarseWrite(addressedRow(), fc('point', 'low', [-73.2, 43.8]))
    expect(result.action).toBe('tagged')
    expect(result.rpcArgs.p_lat).toBeNull()
    expect(result.rpcArgs.p_lng).toBeNull()
    expect(result.rpcArgs.p_accuracy).toBe('approximate')
  })

  it('no-address short-circuits even if a (stale) fc is passed', () => {
    // Defensive: address-less rows never reach Mapbox in index.ts, but the
    // function itself must not accidentally MOVE a pin if ever called with
    // a leftover fc for a no-address row.
    const result = resolveCoarseWrite(
      addresslessRow(),
      fc('rooftop', 'exact', [-73.2, 43.8]),
    )
    expect(result.action).toBe('tagged')
    expect(result.reason).toBe('no_address')
    expect(result.rpcArgs.p_lat).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// FIX-3: runWithConcurrency
// ---------------------------------------------------------------------------
describe('runWithConcurrency', () => {
  it('runs every task exactly once', async () => {
    const seen: number[] = []
    const tasks = Array.from({ length: 23 }, (_, idx) => async () => {
      seen.push(idx)
    })
    await runWithConcurrency(tasks, 8)
    expect(seen.length).toBe(23)
    expect(new Set(seen).size).toBe(23)
  })

  it('never exceeds the concurrency cap', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const tasks = Array.from({ length: 20 }, () => async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 1))
      inFlight--
    })
    await runWithConcurrency(tasks, 8)
    expect(maxInFlight).toBeLessThanOrEqual(8)
    expect(maxInFlight).toBeGreaterThan(1) // proves it actually overlaps, not serial
  })

  it('completes with zero tasks (no hang, no throw)', async () => {
    await expect(runWithConcurrency([], 8)).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// PR-4 limit-cap fix: pageThroughRpc
// ---------------------------------------------------------------------------
describe('pageThroughRpc — limit-cap fix', () => {
  /** Simulates a platform hard-cap of `cap` rows per single request, backed
   * by a total pool of `total` rows — mirrors the observed prod behavior
   * where a single request for >1000 rows silently came back as 1000. */
  function makeCappedSource(total: number, cap: number) {
    const calls: Array<{ offset: number; pageEnd: number }> = []
    const fetchPage = async (offset: number, pageEnd: number): Promise<number[]> => {
      calls.push({ offset, pageEnd })
      const requested = pageEnd - offset + 1
      const grantable = Math.min(requested, cap, Math.max(0, total - offset))
      return Array.from({ length: grantable }, (_, i) => offset + i)
    }
    return { fetchPage, calls }
  }

  it('a single request for more than the platform cap returns only `cap` rows (proves the bug this fix targets)', async () => {
    const { fetchPage } = makeCappedSource(1200, 1000)
    const singleShot = await fetchPage(0, 1199)
    expect(singleShot.length).toBe(1000) // NOT 1200 — the cap silently truncates
  })

  it('pages past a platform cap smaller than the requested limit (1200 requested, 1000 cap → all 1200 collected across 2 pages)', async () => {
    const { fetchPage, calls } = makeCappedSource(1200, 1000)
    const rows = await pageThroughRpc<number>(fetchPage, 1200, 1000)
    expect(rows.length).toBe(1200)
    expect(new Set(rows).size).toBe(1200) // no duplicates
    expect(calls.length).toBe(2) // 0-999, 1000-1199
  })

  it('stops early when the underlying set is smaller than `limit` (short page signals exhaustion, no extra round trip)', async () => {
    const { fetchPage, calls } = makeCappedSource(450, 1000)
    const rows = await pageThroughRpc<number>(fetchPage, 4000, 1000)
    expect(rows.length).toBe(450)
    expect(calls.length).toBe(1) // one short page proves exhaustion — no wasted 2nd call
  })

  it('collects exactly `limit` rows across many pages (4000 requested, 1000 cap → 4 pages)', async () => {
    const { fetchPage, calls } = makeCappedSource(10_000, 1000)
    const rows = await pageThroughRpc<number>(fetchPage, 4000, 1000)
    expect(rows.length).toBe(4000)
    expect(calls.length).toBe(4)
  })

  it('never exceeds `limit` even if a page could return more (page slice bound is enforced by fetchPage\'s own contract)', async () => {
    const { fetchPage } = makeCappedSource(2000, 1000)
    const rows = await pageThroughRpc<number>(fetchPage, 1500, 1000)
    expect(rows.length).toBe(1500)
  })
})
