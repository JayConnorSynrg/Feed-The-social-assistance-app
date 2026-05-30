import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

// Browser client is a singleton: createBrowserClient is designed to be called
// once and reused. Returning a fresh instance per call gives every React render
// a new client reference, which destabilizes any useCallback/useEffect that
// depends on it (e.g. useViewportResources) and produces an infinite refetch
// loop that leaves loading spinners stuck on.
let browserClient: SupabaseClient<Database> | undefined

export function createClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // navigator.locks (Web Locks API) deadlocks getSession() in some
        // environments (PWA, Capacitor, incognito). Bypass with a no-op lock
        // so auth resolves immediately and authUser populates on first render.
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    }
  )
  return browserClient
}
