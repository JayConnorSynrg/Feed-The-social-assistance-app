// apps/web/src/lib/org-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Proves the two admin-org-create invariants at the pure boundary where they live, so each test FAILS
// if the invariant is broken (mutation-proof, both directions):
//
//   INV-B (never business): buildOrgInsertPayload throws for org_type='business' or any value outside
//     org-vocab, and pins is_active=true for a valid non-business type — so no admin code path can
//     persist a business row. Break-on-purpose: delete the isNonBusinessOrgType guard in
//     buildOrgInsertPayload → the 'business' and 'unknown' cases stop throwing → RED.
//
//   INV-D (one row per linked resource): buildOrgResourceRows emits exactly one row per DISTINCT
//     resource id, sequential sort_order, org_id stamped. Break-on-purpose: drop the `seen` dedupe (or
//     emit two rows per id) → the duplicate/count assertions go RED.
//
// Also asserts INV-B at the vocabulary floor: 'business' is not a member of NON_BUSINESS_ORG_TYPES, so
// the admin Select (which renders exactly these) can never offer it.

import { describe, it, expect } from 'vitest'
import { buildOrgInsertPayload, buildOrgResourceRows, OrgWriteError } from './org-data'
import { NON_BUSINESS_ORG_TYPES } from './org-vocab'

describe('INV-B — admin org create is non-business only', () => {
  it('refuses org_type="business" (throws, nothing to insert)', () => {
    expect(() =>
      buildOrgInsertPayload({ name: 'X', org_type: 'business', createdBy: null }),
    ).toThrow(OrgWriteError)
  })

  it('refuses an org_type outside the vocabulary', () => {
    expect(() =>
      buildOrgInsertPayload({ name: 'X', org_type: 'club', createdBy: null }),
    ).toThrow(OrgWriteError)
  })

  it('the Select vocabulary never contains "business"', () => {
    expect((NON_BUSINESS_ORG_TYPES as readonly string[])).not.toContain('business')
  })

  it('accepts every non-business type and pins is_active=true for public visibility (INV-A)', () => {
    for (const t of NON_BUSINESS_ORG_TYPES) {
      const row = buildOrgInsertPayload({ name: '  Helping Hands  ', org_type: t, createdBy: 'u1' })
      expect(row.org_type).toBe(t)
      expect(row.is_active).toBe(true)
      expect(row.name).toBe('Helping Hands') // trimmed
      expect(row.created_by).toBe('u1')
    }
  })
})

describe('INV-D — one org_resources row per distinct linked resource', () => {
  it('emits exactly one row per id with sequential sort_order and the org id stamped', () => {
    const rows = buildOrgResourceRows('org-1', ['a', 'b', 'c'])
    expect(rows).toEqual([
      { org_id: 'org-1', resource_id: 'a', sort_order: 0 },
      { org_id: 'org-1', resource_id: 'b', sort_order: 1 },
      { org_id: 'org-1', resource_id: 'c', sort_order: 2 },
    ])
  })

  it('drops duplicates so a repeated id never produces two rows (PK backstop)', () => {
    const rows = buildOrgResourceRows('org-1', ['a', 'a', 'b'])
    expect(rows.map((r) => r.resource_id)).toEqual(['a', 'b'])
    expect(rows).toHaveLength(2)
  })

  it('an empty selection produces no rows', () => {
    expect(buildOrgResourceRows('org-1', [])).toEqual([])
  })
})
