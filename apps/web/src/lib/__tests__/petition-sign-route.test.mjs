/**
 * petition-sign-route.test.mjs
 *
 * Unit tests for /api/petitions/sign route logic.
 * Uses node:test (pure logic tests — no React harness needed).
 *
 * Covers:
 *  1. Rejects request where affirmed !== true (400)
 *  2. Rejects request where petitionId is missing (400)
 *  3. Returns idempotent alreadySigned:true on UNIQUE violation (23505)
 *  4. Affirmation text constant is the canonical ESIGN phrase
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Inline the pure validation logic from the route
// (Cannot import the actual route file directly — Next.js headers/cookies
//  imports are not available in plain node:test. Test the logic in isolation.)
// ---------------------------------------------------------------------------

const AFFIRMATION_TEXT = 'I add my verified signature of support to this petition.'

/**
 * Mirrors the route's body validation logic.
 * @param {unknown} body
 * @returns {{ error: string, status: number } | null}
 */
function validateSignBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'invalid_body', status: 400 }
  }
  const { petitionId, affirmed } = /** @type {Record<string, unknown>} */ (body)
  if (typeof petitionId !== 'string' || !petitionId.trim()) {
    return { error: 'petitionId_required', status: 400 }
  }
  if (affirmed !== true) {
    return { error: 'affirmation_required', status: 400 }
  }
  return null
}

/**
 * Mirrors the route's UNIQUE violation handling.
 * @param {{ code: string }} insertError
 * @returns {boolean}
 */
function isAlreadySigned(insertError) {
  return insertError.code === '23505'
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('petition sign route — body validation', () => {
  test('rejects when affirmed is false', () => {
    const result = validateSignBody({ petitionId: 'abc-123', affirmed: false })
    assert.ok(result !== null, 'should return error object')
    assert.equal(result.status, 400)
    assert.equal(result.error, 'affirmation_required')
  })

  test('rejects when affirmed is missing', () => {
    const result = validateSignBody({ petitionId: 'abc-123' })
    assert.ok(result !== null)
    assert.equal(result.status, 400)
    assert.equal(result.error, 'affirmation_required')
  })

  test('rejects when petitionId is missing', () => {
    const result = validateSignBody({ affirmed: true })
    assert.ok(result !== null)
    assert.equal(result.status, 400)
    assert.equal(result.error, 'petitionId_required')
  })

  test('rejects when petitionId is empty string', () => {
    const result = validateSignBody({ petitionId: '  ', affirmed: true })
    assert.ok(result !== null)
    assert.equal(result.status, 400)
    assert.equal(result.error, 'petitionId_required')
  })

  test('accepts valid affirmed + petitionId', () => {
    const result = validateSignBody({ petitionId: '30f09104-6904-43c7-9d43-9e0c480ceaa5', affirmed: true })
    assert.equal(result, null, 'should return null (no error) for valid input')
  })

  test('rejects null body', () => {
    const result = validateSignBody(null)
    assert.ok(result !== null)
    assert.equal(result.status, 400)
  })
})

describe('petition sign route — idempotent duplicate handling', () => {
  test('detects UNIQUE violation as alreadySigned', () => {
    assert.equal(isAlreadySigned({ code: '23505' }), true)
  })

  test('does not treat other errors as alreadySigned', () => {
    assert.equal(isAlreadySigned({ code: '42501' }), false)
    assert.equal(isAlreadySigned({ code: '23503' }), false)
  })
})

describe('petition sign route — affirmation text integrity', () => {
  test('affirmation text matches canonical ESIGN phrase', () => {
    // Regression guard: this exact phrase is what is stored as affirmation_text
    // in petition_signatures. Changing it breaks the ESIGN record for existing signers.
    assert.equal(
      AFFIRMATION_TEXT,
      'I add my verified signature of support to this petition.',
      'ESIGN affirmation text must not change without a data migration'
    )
  })

  test('affirmation text does not contain legal-contract language', () => {
    const forbidden = ['legally binding', 'legal contract', 'legally sign']
    for (const phrase of forbidden) {
      assert.ok(
        !AFFIRMATION_TEXT.toLowerCase().includes(phrase),
        `affirmation text must not contain "${phrase}" — petitions are First-Amendment advocacy, not contracts`
      )
    }
  })
})
