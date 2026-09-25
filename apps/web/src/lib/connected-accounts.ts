// apps/web/src/lib/connected-accounts.ts
//
// Pure mapping from a Supabase user's linked identities to the connection state
// of the OAuth providers FEED configures (google, apple — see login/signup
// pages). Read-only reflection: Settings → Account renders "Connected" for a
// provider IF AND ONLY IF the user has an identity with that provider.
//
// Kept pure + dependency-free so it is unit-testable without a Supabase client.

/** The OAuth providers FEED offers on the login/signup pages. */
export const OAUTH_PROVIDERS = ['google', 'apple'] as const
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

/** Minimal shape of a Supabase UserIdentity we depend on. */
export interface IdentityLike {
  provider?: string | null
}

export type ConnectedAccounts = Record<OAuthProvider, boolean>

/**
 * Map a user's identities to a {google, apple} connection map.
 * undefined / empty identities → every provider false.
 */
export function mapConnectedAccounts(identities: IdentityLike[] | null | undefined): ConnectedAccounts {
  const providers = new Set(
    (identities ?? [])
      .map((i) => (typeof i?.provider === 'string' ? i.provider.toLowerCase() : null))
      .filter((p): p is string => p !== null)
  )
  return OAUTH_PROVIDERS.reduce((acc, provider) => {
    acc[provider] = providers.has(provider)
    return acc
  }, {} as ConnectedAccounts)
}

/** Human-facing label for a provider. */
export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
}
