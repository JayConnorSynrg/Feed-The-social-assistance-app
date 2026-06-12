import { describe, it, expect } from 'vitest'
import { shouldRenderTurnstile, TurnstileWidget } from './turnstile-widget'

/**
 * No-op guarantee for the Turnstile CAPTCHA widget.
 *
 * The merge-safe contract is: with NO site key the widget renders nothing and
 * the parent's captchaToken stays undefined → auth behavior is identical to
 * before. The component gates its entire output on this single predicate
 * (`if (!shouldRenderTurnstile(key)) return null`), so asserting the predicate
 * proves the no-op without mounting React (vitest runs in the node environment).
 */
describe('shouldRenderTurnstile — the no-op gate', () => {
  it('is false when the site key is absent (undefined) → widget renders null', () => {
    expect(shouldRenderTurnstile(undefined)).toBe(false)
  })

  it('is false when the site key is empty, whitespace, or null → widget renders null', () => {
    expect(shouldRenderTurnstile('')).toBe(false)
    expect(shouldRenderTurnstile('   ')).toBe(false)
    expect(shouldRenderTurnstile(null)).toBe(false)
  })

  it('is true when a real site key is present → widget renders', () => {
    expect(shouldRenderTurnstile('0x4AAAAAAA_test_site_key')).toBe(true)
  })
})

describe('TurnstileWidget export surface', () => {
  it('is a forwardRef component (exposes a render fn) so parents can reset() it', () => {
    // forwardRef components carry a `render` function; the parent uses the ref
    // to reset() the single-use token after each auth attempt.
    expect(
      typeof (TurnstileWidget as unknown as { render?: unknown }).render
    ).toBe('function')
  })
})
