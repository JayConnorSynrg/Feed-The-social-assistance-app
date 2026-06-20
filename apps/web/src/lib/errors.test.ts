/**
 * errors.test.ts
 *
 * Unit tests for getErrorMessage — the low-level error serializer.
 * These assertions guard against the "[object Object]" render regression
 * caused by PostgrestError plain objects that are not Error instances.
 */

import { describe, it, expect } from 'vitest'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('returns .message from a real Error instance', () => {
    const err = new Error('network failure')
    expect(getErrorMessage(err)).toBe('network failure')
  })

  it('returns message string from a PostgrestError-shaped plain object', () => {
    const postgrestError = {
      message: 'permission denied for table profiles',
      code: '42501',
      details: null,
      hint: null,
    }
    const result = getErrorMessage(postgrestError)
    expect(result).toContain('permission denied')
    // Must NOT be the stringified "[object Object]" sentinel
    expect(result).not.toBe('[object Object]')
  })

  it('returns the string unchanged when err is already a string', () => {
    expect(getErrorMessage('something went wrong')).toBe('something went wrong')
  })

  it('falls back to JSON.stringify for objects with no message/details/hint/code', () => {
    const weird = { foo: 'bar' }
    const result = getErrorMessage(weird)
    expect(result).not.toBe('[object Object]')
    expect(result).toContain('bar')
  })
})
