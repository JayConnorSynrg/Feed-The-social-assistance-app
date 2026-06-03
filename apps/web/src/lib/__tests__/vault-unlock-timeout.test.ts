// apps/web/src/lib/__tests__/vault-unlock-timeout.test.ts
// Unit tests for vault unlock timeout resilience

import { describe, it, expect, vi } from 'vitest'

// vi.hoisted() runs before module imports, making mockSupabase available
// inside the vi.mock() factory without hitting the temporal dead zone.
const mockSupabase = vi.hoisted(() => {
  const single = vi.fn()
  const retry = vi.fn(() => ({ single }))
  const abortSignal = vi.fn(() => ({ retry, single }))
  const eq = vi.fn(() => ({ abortSignal }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))

  return { from, select, eq, abortSignal, retry, single }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

// Stub crypto dependencies — unlockVault throws before reaching them on timeout
vi.mock('@/lib/crypto', () => ({
  deriveKEK: vi.fn(),
  deriveVerificationKey: vi.fn(),
  unwrapDEK: vi.fn(),
  generateSalt: vi.fn(),
  generateIV: vi.fn(),
  generateDEK: vi.fn(),
  wrapDEK: vi.fn(),
  rotateKEK: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  arrayBufferToBase64: vi.fn(),
  base64ToArrayBuffer: vi.fn(),
  VAULT_VERIFICATION_CONSTANT: new Uint8Array(0),
}))

vi.mock('@/lib/key-store', () => ({
  storeDEK: vi.fn(),
  getDEK: vi.fn(),
  clearKeys: vi.fn(),
  hasActiveDEK: vi.fn(),
  isSessionValid: vi.fn(),
}))

import { unlockVault, isQueryTimeout, VaultTimeoutError } from '../vault'

describe('vault timeout resilience', () => {
  describe('isQueryTimeout', () => {
    it('returns true for TimeoutError message', () => {
      expect(
        isQueryTimeout({ message: 'TimeoutError: The operation was aborted due to timeout' })
      ).toBe(true)
    })

    it('returns false for a non-timeout vault error message', () => {
      expect(
        isQueryTimeout({ message: 'Vault not found. Please set up your vault first.' })
      ).toBe(false)
    })

    it('returns true for AbortError message', () => {
      expect(isQueryTimeout({ message: 'AbortError: signal was aborted' })).toBe(true)
    })

    it('returns true for an actual Error instance with timeout in message', () => {
      expect(isQueryTimeout(new Error('TimeoutError: signal timed out'))).toBe(true)
    })

    it('returns false for null / undefined', () => {
      expect(isQueryTimeout(null)).toBe(false)
      expect(isQueryTimeout(undefined)).toBe(false)
    })
  })

  describe('unlockVault', () => {
    it('rejects with VaultTimeoutError when the DB read resolves as a timeout error', async () => {
      // PostgREST resolves (does not throw) on abort; code is '' so we key on message.
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          message: 'TimeoutError: The operation was aborted due to timeout',
          code: '',
        },
      })

      await expect(unlockVault('any-password', 'user-uid')).rejects.toBeInstanceOf(VaultTimeoutError)
    })

    it('rejection message is the user-facing timeout message', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          message: 'TimeoutError: The operation was aborted due to timeout',
          code: '',
        },
      })

      await expect(unlockVault('any-password', 'user-uid')).rejects.toThrow(
        'Vault operation timed out'
      )
    })
  })
})
