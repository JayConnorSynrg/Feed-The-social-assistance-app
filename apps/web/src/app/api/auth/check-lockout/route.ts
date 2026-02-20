// API Route: Account Lockout Check
// Proxies to Supabase Edge Function for server-side lockout validation

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, email, ip_address, user_agent, success, failure_reason } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    // Get client IP if not provided
    const clientIp = ip_address || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    const clientUserAgent = user_agent || req.headers.get('user-agent')

    // Call Supabase Edge Function
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/auth-guard`
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action,
        email,
        ip_address: clientIp,
        user_agent: clientUserAgent,
        success,
        failure_reason,
      }),
    })

    if (!response.ok) {
      console.error('Edge Function call failed:', response.status)
      throw new Error('Edge Function call failed')
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Lockout check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
