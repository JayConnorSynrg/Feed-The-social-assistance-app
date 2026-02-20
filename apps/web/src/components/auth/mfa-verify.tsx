'use client'

// apps/web/src/components/auth/mfa-verify.tsx
// MFA Verification UI - Verify TOTP code during login

import React, { useState, useEffect } from 'react'
import { Shield, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mfaService } from '@/lib/mfa'
import { logPredefinedEvent } from '@/lib/audit-logger'

interface MFAVerifyProps {
  factorId: string
  onSuccess: () => void
  onBack?: () => void
}

export function MFAVerify({ factorId, onSuccess, onBack }: MFAVerifyProps) {
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [backupCode, setBackupCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [challengeId, setChallengeId] = useState<string | null>(null)

  useEffect(() => {
    // Create challenge on mount
    const createChallenge = async () => {
      const id = await mfaService.createChallenge(factorId)
      if (id) {
        setChallengeId(id)
      } else {
        setError('Failed to initialize MFA verification')
      }
    }
    createChallenge()
  }, [factorId])

  const handleVerifyTOTP = async () => {
    if (!challengeId || code.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const verified = await mfaService.verifyChallenge(factorId, challengeId, code)

      if (!verified) {
        // Log failed MFA attempt
        logPredefinedEvent('MFA_FAILED', {
          action: 'verify',
          resourceType: 'mfa_factor',
          resourceId: factorId,
          details: { method: 'totp' },
        })
        throw new Error('Invalid verification code')
      }

      // Log successful MFA verification
      logPredefinedEvent('MFA_VERIFIED', {
        action: 'verify',
        resourceType: 'mfa_factor',
        resourceId: factorId,
        details: { method: 'totp' },
      })

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyBackupCode = async () => {
    if (backupCode.length === 0) {
      setError('Please enter a backup code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const verified = await mfaService.verifyBackupCode(backupCode)

      if (!verified) {
        // Log failed backup code attempt
        logPredefinedEvent('MFA_FAILED', {
          action: 'verify',
          resourceType: 'mfa_backup_code',
          details: { method: 'backup_code' },
        })
        throw new Error('Invalid backup code')
      }

      // Log successful backup code verification
      logPredefinedEvent('MFA_BACKUP_CODE_USED', {
        action: 'verify',
        resourceType: 'mfa_backup_code',
        details: { method: 'backup_code' },
      })

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setBackupCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '')
    setCode(numericValue)
    setError(null)

    // Auto-submit when 6 digits entered
    if (numericValue.length === 6) {
      setTimeout(() => {
        handleVerifyTOTP()
      }, 100)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-[#4a5d23]/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-[#4a5d23]" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Two-Factor Authentication</h3>
          <p className="text-sm text-muted-foreground">
            {useBackupCode
              ? 'Enter a backup code to sign in'
              : 'Enter the code from your authenticator app'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {!useBackupCode ? (
        <>
          <div className="space-y-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono bg-white/90 border-lime-300 focus:border-lime-600 focus:ring-lime-500/20"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground text-center">
              The code changes every 30 seconds
            </p>
          </div>

          <Button
            onClick={handleVerifyTOTP}
            disabled={loading || code.length !== 6 || !challengeId}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-lime-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-lime-50/80 px-2 text-stone-500">Or</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => setUseBackupCode(true)}
            className="w-full border-lime-300 bg-white/90 hover:bg-lime-100 text-stone-700"
          >
            Use Backup Code
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Input
              type="text"
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value.toUpperCase())
                setError(null)
              }}
              placeholder="ENTER-BACKUP-CODE"
              className="text-center font-mono bg-white/90 border-lime-300 focus:border-lime-600 focus:ring-lime-500/20"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground text-center">
              Each backup code can only be used once
            </p>
          </div>

          <Button
            onClick={handleVerifyBackupCode}
            disabled={loading || backupCode.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Verifying...' : 'Verify Backup Code'}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setUseBackupCode(false)
              setBackupCode('')
              setError(null)
            }}
            className="w-full border-lime-300 bg-white/90 hover:bg-lime-100 text-stone-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Authenticator Code
          </Button>
        </>
      )}

      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="w-full text-stone-500 hover:text-stone-700"
          disabled={loading}
        >
          Sign in as different user
        </Button>
      )}
    </div>
  )
}
