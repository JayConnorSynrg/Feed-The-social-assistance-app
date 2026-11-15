'use client'

// apps/web/src/components/auth/mfa-verify.tsx
// MFA Verification UI - Verify TOTP code during login
// Its words are in the viewer's language (lib/i18n-auth.ts, mfa* keys); the verification, focus and
// alert logic are unchanged.

import React, { useState, useEffect, useRef } from 'react'
import { Shield, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { mfaService } from '@/lib/mfa'
import { logPredefinedEvent } from '@/lib/audit-logger'
import { authT, type AuthKey } from '@/lib/i18n-auth'
import { useProfileLocale } from '@/hooks/use-profile-locale'

interface MFAVerifyProps {
  factorId: string
  /** Called after a verified code. A returned string is shown as the prompt's error instead. */
  onSuccess: () => void | string | null | Promise<void | string | null>
  onBack?: () => void
  /** False hides the backup-code option (a backup code would be consumed and still refused). */
  allowBackupCode?: boolean
}

const CODE_ID = 'mfa-code'
const ERROR_ID = 'mfa-code-error'
const HINT_ID = 'mfa-code-hint'

export function MFAVerify({ factorId, onSuccess, onBack, allowBackupCode = true }: MFAVerifyProps) {
  const locale = useProfileLocale()
  const a = (key: AuthKey) => authT(locale, key)
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [backupCode, setBackupCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)
  // Single flight: the 6th-digit auto-submit and Enter can both fire; only the first verifies.
  const inFlight = useRef(false)
  const autoSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current)
  }, [])

  useEffect(() => {
    // Create challenge on mount
    const createChallenge = async () => {
      const id = await mfaService.createChallenge(factorId)
      if (id) {
        setChallengeId(id)
      } else {
        setError(a('mfaInitFailed'))
      }
    }
    createChallenge()
    // `a` only words the failure line; a language change must not create a second challenge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factorId])

  const finishVerified = async () => {
    const refusal = await onSuccess()
    if (typeof refusal === 'string') throw new Error(refusal)
  }

  // `value` is passed by the 6-digit auto-submit, which runs from the render before `code` updated.
  const handleVerifyTOTP = async (value: string = code) => {
    // Any submit (Enter, button, or the timer itself) replaces a pending auto-submit.
    if (autoSubmitTimer.current) {
      clearTimeout(autoSubmitTimer.current)
      autoSubmitTimer.current = null
    }
    if (inFlight.current) return
    if (!challengeId || value.length !== 6) {
      setError(a('mfaInvalidFormat'))
      codeInputRef.current?.focus()
      return
    }

    inFlight.current = true
    setLoading(true)
    setError(null)

    try {
      const verified = await mfaService.verifyChallenge(factorId, challengeId, value)

      if (!verified) {
        // Log failed MFA attempt
        logPredefinedEvent('MFA_FAILED', {
          action: 'verify',
          resourceType: 'mfa_factor',
          resourceId: factorId,
          details: { method: 'totp' },
        })
        throw new Error(a('mfaInvalidCode'))
      }

      // Log successful MFA verification
      logPredefinedEvent('MFA_VERIFIED', {
        action: 'verify',
        resourceType: 'mfa_factor',
        resourceId: factorId,
        details: { method: 'totp' },
      })

      await finishVerified()
    } catch (err) {
      setError(err instanceof Error ? err.message : a('mfaVerifyFailed'))
      setCode('')
      codeInputRef.current?.focus()
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  const handleVerifyBackupCode = async () => {
    if (inFlight.current) return
    if (backupCode.length === 0) {
      setError(a('mfaEnterBackup'))
      backupInputRef.current?.focus()
      return
    }

    inFlight.current = true
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
        throw new Error(a('mfaInvalidBackup'))
      }

      // Log successful backup code verification
      logPredefinedEvent('MFA_BACKUP_CODE_USED', {
        action: 'verify',
        resourceType: 'mfa_backup_code',
        details: { method: 'backup_code' },
      })

      await finishVerified()
    } catch (err) {
      setError(err instanceof Error ? err.message : a('mfaVerifyFailed'))
      setBackupCode('')
      backupInputRef.current?.focus()
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  const handleCodeChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '')
    setCode(numericValue)
    setError(null)

    // Auto-submit when 6 digits entered (a later keystroke replaces the pending one)
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current)
    autoSubmitTimer.current = null
    if (numericValue.length === 6) {
      autoSubmitTimer.current = setTimeout(() => {
        autoSubmitTimer.current = null
        handleVerifyTOTP(numericValue)
      }, 100)
    }
  }

  const describedBy = error ? `${ERROR_ID} ${HINT_ID}` : HINT_ID

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-[#4a5d23]/10 flex items-center justify-center">
          <Shield aria-hidden="true" className="w-6 h-6 text-[#4a5d23]" />
        </div>
        <div>
          <h1 className="font-semibold text-lg">{a('mfaTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {useBackupCode
              ? a('mfaBackupPrompt')
              : a('mfaAppPrompt')}
          </p>
        </div>
      </div>

      {/* One live region, always rendered; only its text changes. */}
      <div
        role="alert"
        id={ERROR_ID}
        className={error ? 'bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2' : undefined}
      >
        {error && (
          <>
            <AlertCircle aria-hidden="true" className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-900">{error}</p>
          </>
        )}
      </div>

      {!useBackupCode ? (
        <>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void handleVerifyTOTP()
            }}
          >
            <div className="space-y-2">
              <label htmlFor={CODE_ID} className="block text-sm font-medium text-stone-800">
                {a('mfaCodeLabel')}
              </label>
              <Input
                ref={codeInputRef}
                id={CODE_ID}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="000000"
                aria-invalid={!!error}
                aria-describedby={describedBy}
                className="text-center text-2xl tracking-widest font-mono bg-white/90 border-stone-500 focus:border-lime-700 focus:ring-lime-500/20"
                autoFocus
                readOnly={loading}
              />
              <p id={HINT_ID} className="text-xs text-stone-600 text-center">
                {a('mfaCodeHint')}
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || code.length !== 6 || !challengeId}
              className="w-full bg-green-700 hover:bg-green-800 text-white"
            >
              {loading ? a('mfaVerifying') : a('mfaVerify')}
            </Button>
          </form>

          {allowBackupCode && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-lime-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-lime-50/80 px-2 text-stone-500">{a('mfaOr')}</span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setUseBackupCode(true)}
                className="w-full border-lime-300 bg-white/90 hover:bg-lime-100 text-stone-700"
              >
                {a('mfaUseBackup')}
              </Button>
            </>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="mfa-backup-code" className="block text-sm font-medium text-stone-800">
              {a('mfaBackupLabel')}
            </label>
            <Input
              ref={backupInputRef}
              id="mfa-backup-code"
              type="text"
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value.toUpperCase())
                setError(null)
              }}
              placeholder="ENTER-BACKUP-CODE"
              aria-invalid={!!error}
              aria-describedby={error ? ERROR_ID : undefined}
              className="text-center font-mono bg-white/90 border-stone-500 focus:border-lime-700 focus:ring-lime-500/20"
              autoFocus
              readOnly={loading}
            />
            <p className="text-xs text-muted-foreground text-center">
              {a('mfaBackupHint')}
            </p>
          </div>

          <Button
            onClick={handleVerifyBackupCode}
            aria-disabled={loading || backupCode.length === 0}
            className={cn('w-full bg-green-700 hover:bg-green-800 text-white', backupCode.length === 0 && 'bg-stone-200 text-stone-700 hover:bg-stone-200')}
          >
            {loading ? a('mfaVerifying') : a('mfaVerifyBackup')}
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
            <ArrowLeft className="w-4 h-4 rtl:-scale-x-100" />
            {a('mfaBackToApp')}
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
          {a('mfaDifferentUser')}
        </Button>
      )}
    </div>
  )
}
