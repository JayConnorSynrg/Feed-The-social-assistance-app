import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
          return NextResponse.redirect(redirectUrl)
        }
      }
    } catch (error) {
      // MFA check failed, continue with normal flow
      console.error('MFA check error:', error)
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
      if (!profile || !(profile as any).onboarding_completed) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
    return supabaseResponse
  }

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith('/api/')
  )

  // Onboarding is accessible only to authenticated users
  if (pathname === '/onboarding') {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // Redirect authenticated users away from auth pages to root
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Protected routes require auth
  if (!isPublicRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|_vercel/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
