/**
 * Federation Resource API
 *
 * Serves local resources to authenticated federation partners.
 * Requires HTTP signature verification.
 *
 * GET /api/federation/resources
 * Query params:
 * - since (ISO8601 timestamp) - only return resources updated after this
 * - category (string) - filter by resource category
 * - limit (number) - max resources to return (default 100, max 1000)
 * - cursor (string) - pagination cursor (base64 encoded last resource ID)
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

interface ResourcesResponse {
  resources: FederationResource[]
  cursor: string | null
  has_more: boolean
  total: number
}

/**
 * Parse query parameters from request
 */
function parseQueryParams(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const since = searchParams.get('since') || undefined
  const category = searchParams.get('category') || undefined
  const limitParam = searchParams.get('limit')
  const cursorParam = searchParams.get('cursor')

  // Parse and validate limit
  let limit = 100
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 1000) // Cap at 1000
    }
  }

  // Decode cursor (base64 encoded resource ID)
  let cursor: string | undefined
  if (cursorParam) {
    try {
      cursor = Buffer.from(cursorParam, 'base64').toString('utf-8')
    } catch {
      // Invalid cursor, ignore it
    }
  }

  // Validate since timestamp
  let sinceDate: Date | undefined
  if (since) {
    const parsed = new Date(since)
    if (!isNaN(parsed.getTime())) {
      sinceDate = parsed
    }
  }

  return {
    since: sinceDate,
    category,
    limit,
    cursor,
  }
}

/**
 * Convert database resource to federation format
 */
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
 * GET handler - fetch local resources
 */
async function getResources(
  request: NextRequest,
  context: { instance: VerifiedInstance }
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

  // Parse query parameters
  const { since, category, limit, cursor } = parseQueryParams(request)

  // SECURITY NOTE: Uses service role key for legitimate admin access.
  // This route is protected by HTTP signature verification (withFederationAuth wrapper).
  // Only verified federation instances can access this endpoint.
  // Returns only approved, verified resources (see WHERE clause line 175).
  //
  // TODO: Move to Supabase Edge Function to avoid exposing service role in Next.js API routes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

  try {
    // Query approved, verified resources via standard query builder
    let resourceQuery = supabase
      .from('resources')
      .select('*')
      .eq('status', 'approved')
      .eq('is_verified', true)
      .order('id', { ascending: true })
      .limit(limit + 1)

    if (since) {
      resourceQuery = resourceQuery.gt('updated_at', since.toISOString())
    }

    if (category) {
      resourceQuery = resourceQuery.eq('category', category as never)
    }

    if (cursor) {
      resourceQuery = resourceQuery.gt('id', cursor)
    }

    const { data, error } = await resourceQuery

    if (error) {
      console.error('Resource query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch resources', details: error.message },
        { status: 500 }
      )
    }

    const rows = (data || []) as ResourceRow[]
    const hasMore = rows.length > limit
    const results = rows.slice(0, limit)

    // Get total count (approximate for performance)
    const { count } = await supabase
      .from('resources')
      .select('*', { count: 'estimated', head: true })
      .eq('status', 'approved')
      .eq('is_verified', true)

    const response: ResourcesResponse = {
      resources: results.map((row) => toFederationResource(row)),
      cursor: hasMore
        ? Buffer.from(results[results.length - 1].id).toString('base64')
        : null,
      has_more: hasMore,
      total: count || 0,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Signature, Digest',
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    console.error('Unexpected error fetching resources:', err)
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
 * OPTIONS handler - CORS preflight
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
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    }
  )
}

/**
 * GET handler wrapped with federation authentication
 */
export const GET = withFederationAuth(getResources)
