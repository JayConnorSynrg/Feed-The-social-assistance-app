/**
 * Unit tests for src/lib/connected-accounts.ts
 *
 * Run with: npx vitest run src/lib/connected-accounts.test.ts
 *
 * INV-CA: a provider is "connected" IFF the user has an identity for it.
 */

import { describe, it, expect } from 'vitest'
import { mapConnectedAccounts, type IdentityLike } from './connected-accounts'

describe('mapConnectedAccounts', () => {
  it('maps undefined identities to all-false', () => {
    expect(mapConnectedAccounts(undefined)).toEqual({ google: false, apple: false })
  })

  it('maps null identities to all-false', () => {
    expect(mapConnectedAccounts(null)).toEqual({ google: false, apple: false })
  })

  it('maps an empty array to all-false', () => {
    expect(mapConnectedAccounts([])).toEqual({ google: false, apple: false })
  })

  it('marks only the providers present in identities', () => {
    const identities: IdentityLike[] = [{ provider: 'google' }]
    expect(mapConnectedAccounts(identities)).toEqual({ google: true, apple: false })
  })

  it('marks both when both identities are present', () => {
    const identities: IdentityLike[] = [{ provider: 'google' }, { provider: 'apple' }]
    expect(mapConnectedAccounts(identities)).toEqual({ google: true, apple: true })
  })

  it('is case-insensitive on the provider name', () => {
    const identities: IdentityLike[] = [{ provider: 'Apple' }]
    expect(mapConnectedAccounts(identities)).toEqual({ google: false, apple: true })
  })

  it('ignores identities with a missing/non-string provider', () => {
    const identities: IdentityLike[] = [{ provider: null }, { provider: 'google' }, {}]
    expect(mapConnectedAccounts(identities)).toEqual({ google: true, apple: false })
  })

  it('ignores non-configured providers (e.g. email) without error', () => {
    const identities: IdentityLike[] = [{ provider: 'email' }]
    expect(mapConnectedAccounts(identities)).toEqual({ google: false, apple: false })
  })
})
