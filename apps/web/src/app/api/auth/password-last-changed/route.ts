import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ last_changed: null }, { status: 401 })
  }

  // password_history table has no rows or grants; use user.created_at as the
  // best available approximation for when the account (and initial password)
  // was established.
  return NextResponse.json({
    last_changed: user.created_at,
  })
}
