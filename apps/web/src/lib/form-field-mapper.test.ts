/**
 * Unit tests for mapProfileToAutofill (form-field-mapper.ts)
 *
 * Run with:  npx vitest run src/lib/form-field-mapper.test.ts
 *
 * Covers:
 *   1. Full name split — "Maria Santos Cruz" → first="Maria" last="Santos Cruz"
 *   2. Single-token name — "Cher" → first="Cher", no last_name key
 *   3. Email passthrough from the email arg
 *   4. Phone from publicProfile.phone
 *   5. Address remap — zip_code → zip, no zip_code key leaks
 *   6. SECURITY — household_members ssn/date_of_birth/income never in output
 *   7. Graceful empty/undefined inputs — returns object, no throw
 */

import { describe, it, expect } from 'vitest'
import { mapProfileToAutofill } from './form-field-mapper'
import type { MapProfileToAutofillArgs } from './form-field-mapper'
import type { SecureProfileInput } from './field-encryption'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeArgs(overrides: Partial<MapProfileToAutofillArgs> = {}): MapProfileToAutofillArgs {
  return {
    vaultProfile: null,
    publicProfile: null,
    email: null,
    ...overrides,
  }
}

// ─── tests ─────────────────────────────────────────────────────────────────────

describe('mapProfileToAutofill', () => {
  // Case 1: full_name with multiple tokens — split on FIRST space only
  it('splits "Maria Santos Cruz" into first_name="Maria" and last_name="Santos Cruz"', () => {
    const result = mapProfileToAutofill(
      makeArgs({ publicProfile: { full_name: 'Maria Santos Cruz' } })
    )
    expect(result.first_name).toBe('Maria')
    expect(result.last_name).toBe('Santos Cruz')
  })

  // Case 2: single-token name — first only, last_name must not be present
  it('maps single-token name "Cher" to first_name="Cher" with no last_name key', () => {
    const result = mapProfileToAutofill(
      makeArgs({ publicProfile: { full_name: 'Cher' } })
    )
    expect(result.first_name).toBe('Cher')
    expect('last_name' in result).toBe(false)
  })

  // Case 3: email passthrough from the email argument
  it('passes email from the email arg directly to output', () => {
    const result = mapProfileToAutofill(
      makeArgs({ email: 'user@example.com' })
    )
    expect(result.email).toBe('user@example.com')
  })

  // Case 4: phone from publicProfile.phone
  it('maps publicProfile.phone to output phone', () => {
    const result = mapProfileToAutofill(
      makeArgs({ publicProfile: { phone: '802-555-1234' } })
    )
    expect(result.phone).toBe('802-555-1234')
  })

  // Case 5: address remap — zip_code becomes zip; no zip_code key leaks into address
  it('remaps vaultProfile.residential_address.zip_code to address.zip and omits zip_code from output', () => {
    const vaultProfile: SecureProfileInput = {
      residential_address: {
        line1: '100 Main St',
        city: 'Burlington',
        state: 'VT',
        zip_code: '90210',
      },
    }
    const result = mapProfileToAutofill(makeArgs({ vaultProfile }))
    expect(result.address).toBeDefined()
    expect(result.address!.zip).toBe('90210')
    // The WizardAddress type only has `zip` — no `zip_code` should exist on the address object
    expect('zip_code' in (result.address as object)).toBe(false)
  })

  // Case 6: SECURITY — household_members sensitive fields never autofilled
  it('SECURITY: does not include ssn, date_of_birth, or income from household_members in output', () => {
    const vaultProfile: SecureProfileInput = {
      household_members: [
        {
          name: 'John Doe',
          relationship: 'spouse',
          ssn: '123-45-6789',
          date_of_birth: '1985-03-15',
          income: '50000',
        },
      ],
    }
    const result = mapProfileToAutofill(makeArgs({ vaultProfile }))

    // Flatten the entire result to a string to catch any serialised leakage
    const serialised = JSON.stringify(result)

    expect(serialised).not.toContain('ssn')
    expect(serialised).not.toContain('date_of_birth')
    expect(serialised).not.toContain('income')
    expect(serialised).not.toContain('annual_income')

    // Also assert the result object's keys directly
    expect('ssn' in result).toBe(false)
    expect('date_of_birth' in result).toBe(false)
    expect('annual_income' in result).toBe(false)
  })

  // Case 7: all-empty/undefined inputs — no throw, returns plain object
  it('returns an object without throwing when all inputs are null/undefined', () => {
    expect(() => mapProfileToAutofill(makeArgs())).not.toThrow()
    const result = mapProfileToAutofill(makeArgs())
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })
})
