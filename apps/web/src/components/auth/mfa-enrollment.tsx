'use client'

// apps/web/src/components/auth/mfa-enrollment.tsx
// MFA Enrollment UI - Setup TOTP for two-factor authentication

import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Shield, Copy, CheckCircle, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mfaService, type MFAEnrollmentData } from '@/lib/mfa'
import { logPredefinedEvent } from '@/lib/audit-logger'

interface MFAEnrollmentProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function MFAEnrollment({ onSuccess, onCancel }: MFAEnrollmentProps) {
  const [step, setStep] = useState<'initial' | 'scan' | 'verify' | 'backup' | 'complete'>('initial')
  const [enrollmentData, setEnrollmentData] = useState<MFAEnrollmentData | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  const handleStartEnrollment = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await mfaService.enrollTOTP('FEED Authenticator')

      if (!data) {
        throw new Error('Failed to start enrollment')
      }

      setEnrollmentData(data)
      setStep('scan')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start enrollment')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!enrollmentData || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const verified = await mfaService.verifyEnrollment(enrollmentData.factorId, verificationCode)

      if (!verified) {
        throw new Error('Invalid verification code. Please try again.')
      }

      // Log successful MFA enrollment
      logPredefinedEvent('MFA_ENROLLED', {
        action: 'enroll',
        resourceType: 'mfa_factor',
        resourceId: enrollmentData.factorId,
      })

      // Generate backup codes
      const codes = await mfaService.generateBackupCodes()
      setBackupCodes(codes)

      // Log backup code generation
      logPredefinedEvent('MFA_BACKUP_CODES_GENERATED', {
        action: 'create',
        resourceType: 'mfa_backup_codes',
        details: { count: codes.length },
      })

      setStep('backup')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCopySecret = async () => {
    if (enrollmentData?.secret) {
      await navigator.clipboard.writeText(enrollmentData.secret)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    }
  }

  const handleCopyBackupCodes = async () => {
    const codesText = backupCodes.join('\n')
    await navigator.clipboard.writeText(codesText)
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  const handleDownloadBackupCodes = () => {
    const codesText = backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')
    const blob = new Blob([
      'FEED Platform - MFA Backup Codes\n',
      '================================\n\n',
      'Store these codes in a safe place.\n',
      'Each code can only be used once.\n\n',
      codesText,
      '\n\nGenerated: ' + new Date().toLocaleString()
    ], { type: 'text/plain' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feed-backup-codes-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleComplete = () => {
    setStep('complete')
    onSuccess?.()
  }

  // Initial Step
  if (step === 'initial') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#4a5d23]/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#4a5d23]" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Enable Two-Factor Authentication</h3>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security to your account
            </p>
          </div>
        </div>

        <div className="bg-lime-50 border border-lime-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-lime-900">What you will need:</p>
          <ul className="text-sm text-lime-800 space-y-1 ml-4 list-disc">
            <li>An authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
            <li>Access to your mobile device or computer</li>
            <li>A safe place to store backup codes</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleStartEnrollment}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Starting...' : 'Continue'}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Scan QR Code Step
  if (step === 'scan' && enrollmentData) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-1">Scan QR Code</h3>
          <p className="text-sm text-muted-foreground">
            Use your authenticator app to scan this QR code
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 flex flex-col items-center border-2 border-stone-200">
          <QRCodeSVG
            value={enrollmentData.qrCode}
            size={200}
            level="M"
            includeMargin={true}
          />
        </div>

        <div className="bg-stone-50 rounded-lg p-4 space-y-2">
          <p className="text-xs font-medium text-stone-700 uppercase">Manual Entry</p>
          <p className="text-sm text-muted-foreground mb-2">
            Can&apos;t scan? Enter this code manually:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-stone-200 rounded px-3 py-2 text-sm font-mono break-all">
              {enrollmentData.secret}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySecret}
              className="flex-shrink-0"
            >
              {copiedSecret ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <Button
          onClick={() => setStep('verify')}
          className="w-full"
        >
          I&apos;ve Scanned the Code
        </Button>
      </div>
    )
  }

  // Verify Code Step
  if (step === 'verify' && enrollmentData) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-1">Verify Setup</h3>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '')
              setVerificationCode(value)
              setError(null)
            }}
            placeholder="000000"
            className="text-center text-2xl tracking-widest font-mono"
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-center">
            The code changes every 30 seconds
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleVerifyCode}
            disabled={loading || verificationCode.length !== 6}
            className="flex-1"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStep('scan')
              setVerificationCode('')
              setError(null)
            }}
            disabled={loading}
          >
            Back
          </Button>
        </div>
      </div>
    )
  }

  // Backup Codes Step
  if (step === 'backup') {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-1">Save Backup Codes</h3>
          <p className="text-sm text-muted-foreground">
            Store these codes in a safe place. Each can only be used once.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-900">
            You won&apos;t be able to view these codes again. Download or copy them now.
          </p>
        </div>

        <div className="bg-stone-50 rounded-lg p-4 border border-stone-200">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {backupCodes.map((code, i) => (
              <div key={i} className="bg-white rounded px-3 py-2 font-mono text-sm border border-stone-200">
                {code}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleCopyBackupCodes}
            className="flex items-center justify-center gap-2"
          >
            {copiedCodes ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadBackupCodes}
            className="flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>

        <Button
          onClick={handleComplete}
          className="w-full"
        >
          I&apos;ve Saved My Codes
        </Button>
      </div>
    )
  }

  // Complete Step
  if (step === 'complete') {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-lg mb-1">Two-Factor Authentication Enabled</h3>
          <p className="text-sm text-muted-foreground">
            Your account is now protected with 2FA
          </p>
        </div>
        <Button onClick={onSuccess} className="w-full">
          Done
        </Button>
      </div>
    )
  }

  return null
}
