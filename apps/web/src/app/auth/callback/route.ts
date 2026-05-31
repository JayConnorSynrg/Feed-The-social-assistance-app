import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const sp = requestUrl.searchParams

  // ── Capture every search param for diagnostics ──────────────────────────
  const code = sp.get('code')
  const errorParam = sp.get('error')
  const errorDescription = sp.get('error_description')
  const rawNext = sp.get('redirectTo') || sp.get('next') || '/'
  const allSearchParamKeys = Array.from(sp.keys())
  const host = requestUrl.host

  // ── Open-redirect guard: only allow same-origin relative paths ───────────
  const redirectTo =
    rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/'

  // ── 1. Entry log — always emitted ────────────────────────────────────────
  logger.info('oauth.callback.enter', {
    hasCode: !!code,
    hasError: !!errorParam,
    errorParam,
    errorDescription,
    allSearchParamKeys,
    host,
    redirectTo,
  })

  // ── 2. Supabase-side provider error (appended by Supabase before redirect)
  if (errorParam) {
    logger.error('oauth.callback.provider_error', undefined, {
      error: errorParam,
      error_description: errorDescription,
    })
    const dest = new URL('/login', requestUrl.origin)
    dest.searchParams.set('error', 'oauth_provider')
    dest.searchParams.set('detail', errorDescription ?? errorParam)
    return NextResponse.redirect(dest)
  }

  // ── 3. No code and no provider error ─────────────────────────────────────
  if (!code) {
    logger.warn('oauth.callback.no_code', {
      allSearchParamKeys,
      host,
    })
    const dest = new URL('/login', requestUrl.origin)
    dest.searchParams.set('error', 'no_code')
    return NextResponse.redirect(dest)
  }

  // ── 4. Exchange code for session ──────────────────────────────────────────
  try {
    const supabase = await createClient()
    const timer = logger.time('oauth.callback.exchange')

    const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code)

    if (exchErr) {
      timer.error(exchErr, {
        message: exchErr.message,
        status: exchErr.status,
        code: (exchErr as unknown as Record<string, unknown>).code,
      })
      logger.error('oauth.callback.exchange_failed', exchErr, {
        message: exchErr.message,
        status: exchErr.status,
        code: (exchErr as unknown as Record<string, unknown>).code,
      })
      const dest = new URL('/login', requestUrl.origin)
      dest.searchParams.set('error', 'exchange_failed')
      dest.searchParams.set('detail', exchErr.message)
      return NextResponse.redirect(dest)
    }

    // ── 5. Verify a session was actually returned ─────────────────────────
    if (!data.session) {
      timer.error(new Error('no_session'), { userId: data.user?.id })
      logger.error('oauth.callback.no_session', undefined, {
        userId: data.user?.id,
        hasUser: !!data.user,
      })
      const dest = new URL('/login', requestUrl.origin)
      dest.searchParams.set('error', 'no_session')
      return NextResponse.redirect(dest)
    }

    timer.end({ userId: data.session.user.id })
    logger.info('oauth.callback.exchange_ok', {
      userId: data.session.user.id,
      hasSession: true,
    })

    // ── 6. Log which sb-* cookies are now present ─────────────────────────
    const cookieStore = await cookies()
    const sbCookies = cookieStore
      .getAll()
      .filter(c => c.name.startsWith('sb-'))
      .map(c => c.name)
    logger.info('oauth.callback.cookies', { sbCookies })

    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
  } catch (unexpectedErr) {
    logger.error('oauth.callback.unexpected', unexpectedErr, {
      host,
    })
    const dest = new URL('/login', requestUrl.origin)
    dest.searchParams.set('error', 'exchange_failed')
    dest.searchParams.set(
      'detail',
      unexpectedErr instanceof Error ? unexpectedErr.message : 'unexpected_error'
    )
    return NextResponse.redirect(dest)
  }
}
