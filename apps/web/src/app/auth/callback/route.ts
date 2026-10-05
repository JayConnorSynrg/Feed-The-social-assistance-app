import { createClient } from '@/lib/supabase/server'
import { safeRelativePath } from '@/lib/safe-redirect'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// RFC 6749 §4.1.2.1 authorization error codes. The `error` / `error_description`
// query params are caller-controlled text, so only a closed-vocabulary code is
// ever logged — anything else is recorded as 'other', and the description only
// as a presence flag.
const OAUTH_ERROR_CODES = new Set([
  'invalid_request',
  'unauthorized_client',
  'access_denied',
  'unsupported_response_type',
  'invalid_scope',
  'server_error',
  'temporarily_unavailable',
])
function oauthErrorCode(param: string): string {
  return OAUTH_ERROR_CODES.has(param) ? param : 'other'
}

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

  // ── Open-redirect guard: only allow same-origin relative paths (CWE-601) ──
  const redirectTo = safeRelativePath(rawNext, '/')

  // ── 1. Entry log — always emitted ────────────────────────────────────────
  logger.info('oauth.callback.enter', {
    hasCode: !!code,
    hasError: !!errorParam,
    hasDescription: !!errorDescription,
    allSearchParamKeys,
    host,
    redirectTo,
  })

  // ── 2. Supabase-side provider error (appended by Supabase before redirect)
  if (errorParam) {
    logger.error('oauth.callback.provider_error', undefined, {
      provider_error: oauthErrorCode(errorParam),
      has_description: !!errorDescription,
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
      // Log the auth error's code + HTTP status only — never its raw message.
      const exchCode = String((exchErr as unknown as Record<string, unknown>).code ?? exchErr.name)
      timer.error({ code: exchCode }, { status: exchErr.status, code: exchCode })
      logger.error('oauth.callback.exchange_failed', { code: exchCode }, {
        status: exchErr.status,
        code: exchCode,
      })
      const dest = new URL('/login', requestUrl.origin)
      dest.searchParams.set('error', 'exchange_failed')
      dest.searchParams.set('detail', exchErr.message)
      return NextResponse.redirect(dest)
    }

    // ── 5. Verify a session was actually returned ─────────────────────────
    if (!data.session) {
      timer.error(new Error('no_session'), { hasUser: !!data.user })
      logger.error('oauth.callback.no_session', undefined, {
        hasUser: !!data.user,
      })
      const dest = new URL('/login', requestUrl.origin)
      dest.searchParams.set('error', 'no_session')
      return NextResponse.redirect(dest)
    }

    timer.end({ hasSession: true })
    logger.info('oauth.callback.exchange_ok', {
      hasSession: true,
    })

    // Guarantee: exchangeCodeForSession writes the authenticated session into
    // the same sb-* cookie, replacing any prior anonymous/guest session. Surface
    // the resolved identity so a lingering guest cookie would be visible here.
    logger.info('oauth.callback.session_identity', {
      isAnonymous:
        (data.session.user as unknown as { is_anonymous?: boolean }).is_anonymous ?? false,
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
