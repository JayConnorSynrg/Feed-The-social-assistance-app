/**
 * Federation Single-Resource API
 *
 * Serves one local resource to an authenticated federation partner.
 * Resolves the 404 that federation-webhook/route.ts triggers when it
 * calls fetchResourceFromPartner() at /api/federation/resources/{id}.
 *
 * GET /api/federation/resources/[id]
 *
 * Auth: same draft-cavage HTTP Signature gate as the collection route
 *       (withFederationAuth + requireTrustLevel 'pending').
 * Response shape mirrors a single entry from the collection route so the
 * webhook caller can treat both identically.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@feed/database'
import {
  withFederationAuth,
  requireTrustLevel,
  VerifiedInstance,
} from '@/lib/federation/verify-federation'

type ResourceRow = Database['public']['Tables']['resources']['Row']

interface FederationResource {
  id: string
  name: string
  description: string | null
  resource_type: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  hours_of_operation: Record<string, unknown> | null
  updated_at: string
  created_at: string
}

function toFederationResource(
  row: ResourceRow & { latitude?: number; longitude?: number }
): FederationResource {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    resource_type: row.category as string,
    address_line1: row.address_line1,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    phone: row.phone,
    email: row.email,
    website: row.website,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    hours_of_operation: row.hours_of_operation as Record<string, unknown> | null,
    updated_at: row.updated_at!,
    created_at: row.created_at!,
  }
}

/**
 * GET handler — fetch a single resource by id
 */
async function getResource(
  request: NextRequest,
  context: { instance: VerifiedInstance; params?: { id?: string } }
): Promise<NextResponse> {
  // Check minimum trust level (must be at least 'pending')
  if (!requireTrustLevel(context.instance, 'pending')) {
    return NextResponse.json(
      {
        error: 'Insufficient trust level',
        message: 'Your instance must have at least pending trust level to access resources',
        required_level: 'pending',
        current_level: context.instance.trust_level || 'untrusted',
      },
      { status: 403 }
    )
  }

  // Extract resource ID from URL path
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const resourceId = segments[segments.length - 1]

  if (!resourceId || !/^[0-9a-f-]{36}$/i.test(resourceId)) {
    return NextResponse.json(
      { error: 'Invalid or missing resource id' },
      { status: 400 }
    )
  }

  // SECURITY NOTE: Uses service role key for legitimate admin access.
  // This route is protected by HTTP signature verification (withFederationAuth wrapper).
  // Only verified federation instances can access this endpoint.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .eq('status', 'approved')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Resource not found' },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Signature, Digest',
          },
        }
      )
    }

    return NextResponse.json(toFederationResource(data as ResourceRow), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Signature, Digest',
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS handler — CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Signature, Digest',
        'Access-Control-Max-Age': '86400',
      },
    }
  )
}

/**
 * GET handler wrapped with federation authentication
 */
export const GET = withFederationAuth(getResource)
