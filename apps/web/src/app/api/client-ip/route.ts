// API Route: Get Client IP Address
// Returns the client's IP address for session tracking

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Get IP from headers (handles proxies, load balancers, etc.)
    const forwarded = req.headers.get('x-forwarded-for')
    const real = req.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || real || 'unknown'

    return NextResponse.json({
      ip,
      location: null, // Could integrate IP geolocation service here
    })
  } catch (error) {
    console.error('Client IP error:', error)
    return NextResponse.json(
      { ip: 'unknown', location: null },
      { status: 200 } // Return 200 even on error to not break session tracking
    )
  }
}
