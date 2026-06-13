import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { buildCsp, generateNonce } from '@/lib/csp'

// Lightweight server-side logger — wraps console.* so Vercel Log Drain
// receives structured JSON. NOT @vercel/analytics track(): that client-only
// SDK is unavailable in the Node.js proxy runtime.
function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ level, event, ...fields, timestamp: new Date().toISOString() })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}

export async function proxy(request: NextRequest) {
  // --- Wave 6b: per-request CSP nonce ---------------------------------------
  // Generate one fresh nonce per request and own the CSP here (it was removed
  // from next.config.ts). Next.js 16 reads the nonce out of the forwarded
  // REQUEST `Content-Security-Policy` header (getScriptNonceFromHeader) and
  // auto-applies it to every hydration/framework script; the browser enforces
  // the RESPONSE header. `x-nonce` is forwarded too so Server Components can
  // read it via headers() if they ever need to nonce a hand-written <Script>.
  //
  // ACCEPTED COST: a unique per-request nonce forces dynamic rendering on every
  // matched route — no static optimization / ISR / PPR. This is inherent to
  // nonce-based CSP and intentional.
  const nonce = generateNonce()
  const csp = buildCsp(nonce, { embed: request.nextUrl.pathname.startsWith('/s/embed/') })

  // Forward the nonce + CSP to the app via request headers. Both the initial
  // and the supabase-cookie-callback responses are built from these headers so
  // Next sees the nonce regardless of which response object is returned.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  // Stamp the enforced CSP on the RESPONSE for the browser. Applied to EVERY
  // return path (the pass-through responses AND the inline redirects) so no
  // exit escapes the policy.
  const withCsp = <T extends NextResponse>(response: T): T => {
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Re-derive headers from the freshly-mutated request so the updated
          // `cookie` header forwards (preserving supabase's SSR cookie sync),
          // then re-attach the per-request nonce + CSP.
          const refreshedHeaders = new Headers(request.headers)
          refreshedHeaders.set('x-nonce', nonce)
          refreshedHeaders.set('Content-Security-Policy', csp)
          supabaseResponse = NextResponse.next({
            request: { headers: refreshedHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get session - this will refresh the session if needed
  const getUserStart = Date.now()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const getUserMs = Date.now() - getUserStart
  // Log only slow getUser calls (>500 ms) to avoid noise on every request.
  if (getUserMs > 500) {
    log('warn', 'proxy.getUser.slow', { duration_ms: getUserMs, pathname: request.nextUrl.pathname })
  }

  const { pathname } = request.nextUrl

  // Check MFA assurance level for authenticated users
  if (user) {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      const currentLevel = data?.currentLevel
      const nextLevel = data?.nextLevel

      // If user has MFA enrolled but hasn't completed verification in this session
      if (nextLevel === 'aal2' && currentLevel === 'aal1') {
        // Redirect to login with MFA step for protected routes
        const protectedRoutes = ['/', '/onboarding', '/settings']
        const isProtectedRoute = protectedRoutes.some(route => pathname === route || pathname.startsWith(route))

        if (isProtectedRoute && pathname !== '/login') {
          const redirectUrl = new URL('/login', request.url)
          redirectUrl.searchParams.set('redirectTo', pathname)
          redirectUrl.searchParams.set('step', 'mfa')
          log('info', 'proxy.redirect', { reason: 'mfa_required', from: pathname, to: '/login?step=mfa' })
          return withCsp(NextResponse.redirect(redirectUrl))
        }
      }
    } catch (error) {
      // MFA check failed, continue with normal flow
      log('error', 'proxy.mfa.error', {
        pathname: request.nextUrl.pathname,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/signup',
    '/auth/callback',
    '/auth/confirm',
    '/forgot-password',
    '/reset-password',
    '/about',
    '/mission',
    '/blog',
    '/resources',
    // Public share / embed routes — anon-readable SSR pages
    '/s/post',
    '/s/donate',
    '/s/resource',
    '/s/embed',
  ]

  // Root SPA - if authenticated, check onboarding completion
  if (pathname === '/') {
    if (user) {
      // Anonymous (guest) users skip onboarding — they browse immediately.
      // is_anonymous is a first-class field on the Supabase User object
      // (supabase-js 2.105+); no extra DB query needed.
      const isAnonymous = (user as unknown as { is_anonymous?: boolean }).is_anonymous === true

      if (!isAnonymous) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle()

        // Redirect to onboarding if no profile row or onboarding not completed
        if (!profile || !profile.onboarding_completed) {
          log('info', 'proxy.redirect', { reason: 'onboarding_incomplete', from: '/', to: '/onboarding', userId: user.id })
          return withCsp(NextResponse.redirect(new URL('/onboarding', request.url)))
        }
      }
    }
    return withCsp(supabaseResponse)
  }

  // Check if the current path is a public route.
  // Routes that start with a listed prefix (e.g. /s/embed, /s/post) are
  // treated as public so dynamic segments like /s/embed/[id] are included.
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/') || pathname.startsWith('/api/')
  )

  // Onboarding is accessible only to authenticated users
  if (pathname === '/onboarding') {
    if (!user) {
      log('info', 'proxy.redirect', { reason: 'unauthenticated', from: pathname, to: '/login' })
      return withCsp(NextResponse.redirect(new URL('/login', request.url)))
    }
    return withCsp(supabaseResponse)
  }

  // Redirect authenticated users away from auth pages to root,
  // EXCEPT anonymous (guest) users — they should be able to visit /signup to upgrade.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const isAnonymous = (user as unknown as { is_anonymous?: boolean }).is_anonymous === true
    if (!isAnonymous) {
      log('info', 'proxy.redirect', { reason: 'already_authenticated', from: pathname, to: '/' })
      return withCsp(NextResponse.redirect(new URL('/', request.url)))
    }
  }

  // Protected routes require auth
  if (!isPublicRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    log('info', 'proxy.redirect', { reason: 'unauthenticated', from: pathname, to: '/login' })
    return withCsp(NextResponse.redirect(redirectUrl))
  }

  return withCsp(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|_vercel/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
