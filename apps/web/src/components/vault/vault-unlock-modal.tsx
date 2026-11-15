'use client'

/**
 * Vault Unlock Modal
 *
 * Modal that appears when user needs to unlock their vault to access encrypted data.
 * Supports both initial setup and unlock flows.
 *
 * P6 W9: every word is in the member's language (lib/i18n-documents.ts), with lang/dir on the
 * portalled dialog. The password checks (length >= 12, the two entries equal), setup(), unlock() and
 * everything they derive are unchanged and the same in every language. A failure shows a translated
 * line: the context's message is read as a code (wrong password, time-out), and text the crypto
 * layer or the server wrote is never shown. An unlock failure is already logged (vault.unlock via
 * withMetric; the audit row for a wrong password); a setup failure writes one code-only
 * error_surface.shown row here. The alert line is always mounted; the submit button stays focusable
 * while busy (aria-disabled) and a press then does nothing.
 */

import { useRef, useState } from 'react'
import { useVault } from '@/contexts/vault-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Lock, AlertTriangle } from 'lucide-react'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir } from '@/lib/i18n'
import { documentsT, vaultErrorText, type DocumentsKey } from '@/lib/i18n-documents'
import { failureCode } from '@/lib/failure-code'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

interface VaultUnlockModalProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  mode?: 'setup' | 'unlock'
  onSuccess?: () => void
}

const INPUT = 'border-stone-500 text-stone-900 placeholder:text-stone-600'
const UNAVAILABLE = 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed'

export function VaultUnlockModal({
  open,
  onOpenChange,
  mode: initialMode,
  onSuccess,
}: VaultUnlockModalProps) {
  const { isSetup, setup, unlock, loading, error, clearError } = useVault()
  const locale = useProfileLocale()
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showWarning] = useState(true)
  // A press with something missing: the reason is shown under the field and focus moves there.
  const [hint, setHint] = useState<DocumentsKey | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  // Each failed attempt takes a new number: the alert's node is replaced, so an identical failure
  // (a second wrong password) is spoken again.
  const [failSeq, setFailSeq] = useState(0)
  const confirmRef = useRef<HTMLInputElement>(null)

  // Determine mode based on setup status
  const mode = initialMode || (isSetup ? 'unlock' : 'setup')
  const mismatch = mode === 'setup' && password !== confirmPassword
  const tooShort = mode === 'setup' && password.length < 12
  const unavailable = loading || !password || mismatch || tooShort

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    clearError()

    if (!password) {
      setHint('passwordRequired')
      passwordRef.current?.focus()
      return
    }

    if (mode === 'setup') {
      if (password.length < 12) {
        setHint('passwordTooShort')
        passwordRef.current?.focus()
        return
      }
      // Validate password confirmation
      if (password !== confirmPassword) {
        setHint('passwordMismatch')
        confirmRef.current?.focus()
        return
      }
      setHint(null)

      try {
        await setup(password)
        setPassword('')
        setConfirmPassword('')
        onSuccess?.()
        // Do NOT call onOpenChange(false) here — VaultGuard's isUnlocked becoming
        // true causes it to render children directly, naturally unmounting this
        // modal without triggering onDismiss. Calling onOpenChange(false) would
        // fire handleDismiss → onDismiss → cancel the guarded flow (P0 regression).
      } catch (err) {
        // The context keeps the message; the member reads the translated line. One code-only row.
        logger.warn('error_surface.shown', { surface: 'vault-setup', kind: failureCode(err), locale })
        setFailSeq((n) => n + 1)
        passwordRef.current?.focus()
      }
    } else {
      setHint(null)
      try {
        const success = await unlock(password)
        if (success) {
          setPassword('')
          onSuccess?.()
          // Same rationale as setup path: let VaultGuard's isUnlocked→true unmount
          // the modal naturally. Callers that own their own modal open-state
          // (encrypted-upload, documents-panel) close it via onSuccess callback,
          // not via onOpenChange, so they are unaffected.
        } else {
          // A wrong password: focus stays in the field, the alert says why.
          setFailSeq((n) => n + 1)
          passwordRef.current?.focus()
        }
      } catch {
        // Error is handled by context
        setFailSeq((n) => n + 1)
        passwordRef.current?.focus()
      }
    }
  }

  const handleClose = () => {
    if (!loading) {
      setPassword('')
      setConfirmPassword('')
      setHint(null)
      clearError()
      onOpenChange?.(false)
    }
  }

  const errorText = error ? vaultErrorText(error, mode, locale) : ''
  const passwordHint = hint === 'passwordRequired' || hint === 'passwordTooShort' ? t(hint) : ''
  const confirmHint = (confirmPassword && password !== confirmPassword) || hint === 'passwordMismatch' ? t('passwordMismatch') : ''

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[500px]"
        lang={locale}
        dir={dir(locale)}
        closeLabel={documentsT(locale, 'close')}
        data-testid="vault-unlock-modal"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" aria-hidden="true" />
            <DialogTitle>
              {mode === 'setup' ? t('setupTitle') : t('unlockTitle')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-stone-700">
            {mode === 'setup' ? t('setupDescription') : t('unlockDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 py-4">
            {mode === 'setup' && showWarning && (
              <div className="flex gap-3 rounded-lg border border-stone-500 p-3 text-sm text-stone-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong>{t('important')}</strong> {t('setupWarning')}
                </p>
              </div>
            )}

            {/* Always mounted, so a new failure is announced. */}
            <div role="alert" data-testid="vault-unlock-alert">
              {errorText && (
                <p key={failSeq} className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorText}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('masterPassword')}</Label>
              <Input
                id="password"
                ref={passwordRef}
                data-testid="vault-unlock-password-input"
                type="password"
                placeholder={mode === 'setup' ? t('createPasswordPlaceholder') : t('enterPasswordPlaceholder')}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (hint !== 'passwordMismatch') setHint(null) }}
                readOnly={loading}
                aria-disabled={loading || undefined}
                required
                aria-required="true"
                aria-invalid={passwordHint ? true : undefined}
                aria-describedby={mode === 'setup' ? 'vault-password-hint vault-password-error' : 'vault-password-error'}
                minLength={mode === 'setup' ? 12 : undefined}
                autoComplete="off"
                className={INPUT}
              />
              {mode === 'setup' && (
                <p className="text-sm text-stone-700" id="vault-password-hint">
                  {t('passwordHint')}
                </p>
              )}
              <p className="text-sm text-red-700" id="vault-password-error">{passwordHint}</p>
            </div>

            {mode === 'setup' && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
                <Input
                  id="confirm-password"
                  ref={confirmRef}
                  type="password"
                  placeholder={t('confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  readOnly={loading}
                  aria-disabled={loading || undefined}
                  required
                  aria-required="true"
                  aria-invalid={confirmHint ? true : undefined}
                  aria-describedby="vault-confirm-error"
                  autoComplete="off"
                  className={INPUT}
                />
                <p className="text-sm text-red-700" id="vault-confirm-error">{confirmHint}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              aria-disabled={loading}
              className={cn('border-stone-500', loading && UNAVAILABLE)}
            >
              {t('cancel')}
            </Button>
            <Button
              data-testid="vault-unlock-submit-button"
              type="submit"
              aria-disabled={unavailable}
              aria-busy={loading || undefined}
              className={cn(unavailable && UNAVAILABLE)}
            >
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode === 'setup' ? t('createVault') : t('unlock')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
