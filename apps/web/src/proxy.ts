import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

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
  let supabaseResponse = NextResponse.next({
    request,
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
          supabaseResponse = NextResponse.next({
            request,
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
          return NextResponse.redirect(redirectUrl)
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()

      // Redirect to onboarding if no profile row or onboarding not completed
      if (!profile || !profile.onboarding_completed) {
        log('info', 'proxy.redirect', { reason: 'onboarding_incomplete', from: '/', to: '/onboarding', userId: user.id })
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
    return supabaseResponse
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
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // Redirect authenticated users away from auth pages to root
  if (user && (pathname === '/login' || pathname === '/signup')) {
    log('info', 'proxy.redirect', { reason: 'already_authenticated', from: pathname, to: '/' })
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Protected routes require auth
  if (!isPublicRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    log('info', 'proxy.redirect', { reason: 'unauthenticated', from: pathname, to: '/login' })
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|_vercel/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
