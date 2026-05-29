// apps/web/src/lib/__tests__/mfa.test.ts
// Unit tests for MFA service

import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.hoisted() runs before module imports, making mockSupabase available
// inside the vi.mock() factory without hitting the temporal dead zone.
const mockSupabase = vi.hoisted(() => ({
  auth: {
    mfa: {
      listFactors: vi.fn(),
      getAuthenticatorAssuranceLevel: vi.fn(),
      enroll: vi.fn(),
      challengeAndVerify: vi.fn(),
      challenge: vi.fn(),
      verify: vi.fn(),
      unenroll: vi.fn(),
    },
    getUser: vi.fn(),
  },
  from: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

import { MFAService } from '../mfa'

describe('MFAService', () => {
  let mfaService: MFAService

  beforeEach(() => {
    vi.clearAllMocks()
    mfaService = new MFAService()
  })

  describe('isMFAEnabled', () => {
    // mfa.ts L42: data?.all?.some(f => f.status === 'verified') — uses data.all, not data.factors
    it('should return true when user has verified TOTP factor', async () => {
      mockSupabase.auth.mfa.listFactors.mockResolvedValue({
        data: {
          all: [
            { id: '1', status: 'verified', factor_type: 'totp' },
          ],
        },
      })

      const result = await mfaService.isMFAEnabled()
      expect(result).toBe(true)
    })

    it('should return false when user has no verified factors', async () => {
      mockSupabase.auth.mfa.listFactors.mockResolvedValue({
        data: {
          all: [
            { id: '1', status: 'unverified', factor_type: 'totp' },
          ],
        },
      })

      const result = await mfaService.isMFAEnabled()
      expect(result).toBe(false)
    })

    it('should return false when user has no factors', async () => {
      mockSupabase.auth.mfa.listFactors.mockResolvedValue({
        data: { all: [] },
      })

      const result = await mfaService.isMFAEnabled()
      expect(result).toBe(false)
    })
  })

  describe('getAssuranceLevel', () => {
    it('should return aal2 when MFA is verified', async () => {
      mockSupabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
        data: { currentLevel: 'aal2' },
      })

      const result = await mfaService.getAssuranceLevel()
      expect(result).toBe('aal2')
    })

    it('should return aal1 when only password auth', async () => {
      mockSupabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
        data: { currentLevel: 'aal1' },
      })

      const result = await mfaService.getAssuranceLevel()
      expect(result).toBe('aal1')
    })
  })

  describe('enrollTOTP', () => {
    it('should return enrollment data on success', async () => {
      mockSupabase.auth.mfa.enroll.mockResolvedValue({
        data: {
          id: 'factor-123',
          totp: {
            qr_code: 'otpauth://totp/...',
            secret: 'SECRET123',
          },
        },
        error: null,
      })

      const result = await mfaService.enrollTOTP('Test App')

      expect(result).toEqual({
        qrCode: 'otpauth://totp/...',
        secret: 'SECRET123',
        factorId: 'factor-123',
      })
    })

    it('should return null on error', async () => {
      mockSupabase.auth.mfa.enroll.mockResolvedValue({
        data: null,
        error: { message: 'Enrollment failed' },
      })

      const result = await mfaService.enrollTOTP()
      expect(result).toBeNull()
    })
  })

  describe('verifyEnrollment', () => {
    it('should return true on successful verification', async () => {
      mockSupabase.auth.mfa.challengeAndVerify.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null,
      })

      const result = await mfaService.verifyEnrollment('factor-123', '123456')
      expect(result).toBe(true)
    })

    it('should return false on invalid code', async () => {
      mockSupabase.auth.mfa.challengeAndVerify.mockResolvedValue({
        data: null,
        error: { message: 'Invalid code' },
      })

      const result = await mfaService.verifyEnrollment('factor-123', '000000')
      expect(result).toBe(false)
    })
  })

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      const mockFrom = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
      mockSupabase.from.mockReturnValue(mockFrom)

      const codes = await mfaService.generateBackupCodes()

      expect(codes).toHaveLength(10)
      expect(codes[0]).toMatch(/^[A-Z0-9]{8}$/)
      expect(mockFrom.insert).toHaveBeenCalled()
    })

    it('should store hashed codes in database', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      const mockFrom = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
      mockSupabase.from.mockReturnValue(mockFrom)

      await mfaService.generateBackupCodes()

      const insertCall = mockFrom.insert.mock.calls[0][0]
      expect(insertCall).toHaveLength(10)
      expect(insertCall[0]).toHaveProperty('user_id', 'user-123')
      expect(insertCall[0]).toHaveProperty('code_hash')
      expect(insertCall[0].code_hash).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })
  })
})
