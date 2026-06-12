'use client'

import { useRef, useImperativeHandle, forwardRef } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

/**
 * Cloudflare Turnstile site key, read at build time from the public env.
 *
 * MERGE-SAFE NO-OP CONTRACT: when this is absent/empty the widget renders
 * `null` and the parent's captchaToken stays `undefined`. Supabase treats an
 * absent captchaToken as "no captcha supplied"; the server only enforces a
 * captcha when the project's dashboard captcha toggle is ON. With the key
 * unset AND the toggle off (current production state) auth behavior is
 * byte-for-byte identical to before this component existed.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

/**
 * Pure predicate for the no-op gate. Exported so the no-op guarantee can be
 * asserted in a node-environment unit test without mounting React.
 */
export function shouldRenderTurnstile(siteKey: string | undefined | null): boolean {
  return typeof siteKey === 'string' && siteKey.trim().length > 0
}

export interface TurnstileWidgetHandle {
  /** Reset the widget so the next auth attempt gets a fresh, unused token. */
  reset: () => void
}

interface TurnstileWidgetProps {
  /** Called with the verification token once the visitor solves the challenge. */
  onVerify: (token: string) => void
  /** Optional: clear the parent token when the widget expires or errors. */
  onExpireOrError?: () => void
  /** Site key override (defaults to the public env key); primarily for tests. */
  siteKey?: string
}

/**
 * Cloudflare Turnstile CAPTCHA widget.
 *
 * Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (the no-op
 * guarantee). When a key is present it renders the managed widget, calls
 * onVerify(token) on success, and exposes an imperative reset() via ref —
 * Turnstile tokens are single-use, so the parent resets after every auth
 * attempt (success or error) to obtain a fresh token for any retry.
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onVerify, onExpireOrError, siteKey }, ref) {
    const key = siteKey ?? TURNSTILE_SITE_KEY
    const instanceRef = useRef<TurnstileInstance | null>(null)

    useImperativeHandle(ref, () => ({
      reset: () => {
        instanceRef.current?.reset()
      },
    }))

    // NO-OP: no key configured → render nothing, parent captchaToken stays undefined.
    if (!shouldRenderTurnstile(key)) {
      return null
    }

    return (
      <div className="flex justify-center">
        <Turnstile
          ref={instanceRef}
          siteKey={key}
          onSuccess={onVerify}
          onExpire={onExpireOrError}
          onError={onExpireOrError}
          options={{ theme: 'light', size: 'normal' }}
        />
      </div>
    )
  }
)
