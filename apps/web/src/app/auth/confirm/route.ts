import { createClient } from '@/lib/supabase/server'
import { safeRelativePath } from '@/lib/safe-redirect'
import { NextResponse } from 'next/server'

// Handles email confirmation links from Supabase
// These arrive as: /auth/confirm?token_hash=XXX&type=email&next=/onboarding
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as 'email' | 'recovery' | 'invite' | 'magiclink' | 'signup'
  // Open-redirect guard: only allow same-origin relative paths (CWE-601).
  const next = safeRelativePath(requestUrl.searchParams.get('next'), '/onboarding')

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // Token verification failed
  return NextResponse.redirect(
    new URL('/login?error=confirmation_failed', requestUrl.origin)
  )
}
