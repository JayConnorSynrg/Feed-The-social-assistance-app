/**
 * Pure-logic smoke test for normalizeState (apps/web/src/lib/us-states.ts).
 *
 * Why an inline mirror (not an import): us-states.ts is TypeScript and the repo
 * has no TS test transform wired for `node --test` (vitest binary is absent).
 * Following the pattern in apps/web/src/hooks/__tests__/use-viewport-resources.race.test.mjs,
 * the normalizeState control flow is replicated here line-for-line so the test
 * runs under plain `node --test` while still asserting the exact behavior.
 *
 * Run: node --test apps/web/src/lib/__tests__/normalize-state.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

const STATE_TO_ABBR = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'Puerto Rico': 'PR', 'Guam': 'GU', 'US Virgin Islands': 'VI',
  'American Samoa': 'AS', 'Northern Mariana Islands': 'MP',
}

const VALID_ABBRS = new Set(Object.values(STATE_TO_ABBR))
const LOWER_NAME_TO_ABBR = Object.fromEntries(
  Object.entries(STATE_TO_ABBR).map(([name, abbr]) => [name.toLowerCase(), abbr])
)

function normalizeState(input) {
  if (input == null) return null
  const trimmed = input.trim()
  if (trimmed === '') return null
  const upper = trimmed.toUpperCase()
  if (upper.length === 2 && VALID_ABBRS.has(upper)) return upper
  const byName = LOWER_NAME_TO_ABBR[trimmed.toLowerCase()]
  if (byName) return byName
  return trimmed
}

test('full name -> abbreviation', () => {
  assert.equal(normalizeState('Vermont'), 'VT')
})

test('lowercase full name -> abbreviation (case-insensitive)', () => {
  assert.equal(normalizeState('vermont'), 'VT')
})

test('already-uppercase abbreviation is idempotent', () => {
  assert.equal(normalizeState('VT'), 'VT')
})

test('lowercase abbreviation -> uppercased', () => {
  assert.equal(normalizeState('vt'), 'VT')
})

test('null -> null', () => {
  assert.equal(normalizeState(null), null)
})

test('empty string -> null', () => {
  assert.equal(normalizeState(''), null)
})

test('territory full name -> abbreviation', () => {
  assert.equal(normalizeState('Puerto Rico'), 'PR')
})

test('whitespace-only -> null (fail-open guard)', () => {
  assert.equal(normalizeState('   '), null)
})

test('unknown value fails open (returned trimmed, not nulled)', () => {
  assert.equal(normalizeState('  Atlantis  '), 'Atlantis')
})
