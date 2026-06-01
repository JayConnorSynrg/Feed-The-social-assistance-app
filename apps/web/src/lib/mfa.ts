// apps/web/src/lib/mfa.ts
// Multi-Factor Authentication service using Supabase native MFA
// Supports TOTP (Time-based One-Time Password) for Google Authenticator, Authy, etc.

import { createClient } from '@/lib/supabase/client'
import type { AuthMFAEnrollResponse, AuthMFAChallengeResponse, AuthMFAVerifyResponse } from '@supabase/supabase-js'

export type AssuranceLevel = 'aal1' | 'aal2'

export interface MFAEnrollmentData {
  qrCode: string      // otpauth:// URI for QR code
  secret: string      // Manual entry secret (base32 encoded)
  factorId: string    // Supabase factor ID
}

export interface MFAFactor {
  id: string
  friendly_name: string
  factor_type: 'totp'
  status: 'verified' | 'unverified'
  created_at: string
  updated_at: string
}

export interface BackupCode {
  code: string
  used: boolean
}

/**
 * MFA Service - Handles all TOTP operations
 */
export class MFAService {
  private supabase = createClient()

  /**
   * Check if current user has MFA enabled
   */
  async isMFAEnabled(): Promise<boolean> {
    try {
      const { data } = await this.supabase.auth.mfa.listFactors()
      return data?.all?.some((f: { status: string }) => f.status === 'verified') ?? false
    } catch (error) {
      console.error('Error checking MFA status:', error)
      return false
    }
  }

  /**
   * Get current authenticator assurance level
   * aal1 = password only
   * aal2 = password + TOTP verified
   */
  async getAssuranceLevel(): Promise<AssuranceLevel> {
    try {
      const { data } = await this.supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      return (data?.currentLevel || 'aal1') as AssuranceLevel
    } catch (error) {
      console.error('Error getting assurance level:', error)
      return 'aal1'
    }
  }

  /**
   * Get all MFA factors for current user
   */
  async listFactors(): Promise<MFAFactor[]> {
    try {
      const { data } = await this.supabase.auth.mfa.listFactors()
      return (data?.all ?? []) as MFAFactor[]
    } catch (error) {
      console.error('Error listing MFA factors:', error)
      return []
    }
  }

  /**
   * Start TOTP enrollment process
   * Returns QR code data and secret for manual entry
   */
  async enrollTOTP(friendlyName: string = 'Authenticator App'): Promise<MFAEnrollmentData | null> {
    try {
      const { data, error } = await this.supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      })

      if (error) {
        console.error('MFA enrollment error:', error)
        throw error
      }

      if (!data) {
        throw new Error('No enrollment data returned')
      }

      return {
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      }
    } catch (error) {
      console.error('Error enrolling TOTP:', error)
      return null
    }
  }

  /**
   * Verify TOTP code to complete enrollment
   * Must be called after enrollTOTP() to activate the factor
   */
  async verifyEnrollment(factorId: string, code: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      })

      if (error) {
        console.error('MFA verification error:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error verifying enrollment:', error)
      return false
    }
  }

  /**
   * Create a challenge for MFA verification during login
   * Returns challenge ID to be used with verifyChallenge()
   */
  async createChallenge(factorId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.auth.mfa.challenge({
        factorId,
      })

      if (error) {
        console.error('MFA challenge error:', error)
        return null
      }

      return data?.id ?? null
    } catch (error) {
      console.error('Error creating challenge:', error)
      return null
    }
  }

  /**
   * Verify TOTP code for an existing challenge (login flow)
   */
  async verifyChallenge(factorId: string, challengeId: string, code: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      })

      if (error) {
        console.error('MFA verify error:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error verifying challenge:', error)
      return false
    }
  }

  /**
   * Unenroll (disable) MFA factor
   * Requires user to be authenticated with aal2
   */
  async unenrollTOTP(factorId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.auth.mfa.unenroll({
        factorId,
      })

      if (error) {
        console.error('MFA unenroll error:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error unenrolling MFA:', error)
      return false
    }
  }

  /**
   * Generate backup codes for account recovery
   * Codes are stored hashed in the database
   */
  async generateBackupCodes(): Promise<string[]> {
    try {
      // Generate 10 random backup codes
      const codes: string[] = []
      for (let i = 0; i < 10; i++) {
        const code = this.generateSecureCode(8)
        codes.push(code)
      }

      // Store hashed codes in database via RPC
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Hash codes before storing
      const hashedCodes = await Promise.all(
        codes.map(async (code) => ({
          user_id: user.id,
          code_hash: await this.hashCode(code),
        }))
      )

      // Store in database (requires RPC function or direct insert with RLS)
      const { error } = await this.supabase
        .from('mfa_backup_codes')
        .insert(hashedCodes)

      if (error) {
        console.error('Error storing backup codes:', error)
        throw error
      }

      return codes
    } catch (error) {
      console.error('Error generating backup codes:', error)
      return []
    }
  }

  /**
   * Verify a backup code (for account recovery)
   */
  async verifyBackupCode(code: string): Promise<boolean> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return false

      const codeHash = await this.hashCode(code)

      // Find matching unused code
      const { data: backupCodes, error } = await this.supabase
        .from('mfa_backup_codes')
        .select('id, code_hash, used_at')
        .eq('user_id', user.id)
        .is('used_at', null)

      if (error || !backupCodes || backupCodes.length === 0) {
        return false
      }

      // Check if any code matches (constant-time comparison would be ideal)
      const matchingCode = backupCodes.find(bc => bc.code_hash === codeHash)
      if (!matchingCode) {
        return false
      }

      // Mark code as used
      const { error: updateError } = await this.supabase
        .from('mfa_backup_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', matchingCode.id)

      if (updateError) {
        console.error('Error marking backup code as used:', updateError)
        return false
      }

      return true
    } catch (error) {
      console.error('Error verifying backup code:', error)
      return false
    }
  }

  /**
   * Generate a cryptographically secure random code
   */
  private generateSecureCode(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding ambiguous chars
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)

    return Array.from(array)
      .map(byte => chars[byte % chars.length])
      .join('')
  }

  /**
   * Hash a backup code for storage
   * Uses Web Crypto API (SHA-256)
   */
  private async hashCode(code: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(code)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

// Singleton instance
export const mfaService = new MFAService()
