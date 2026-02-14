import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /.well-known/feed-instance
 *
 * Federation discovery endpoint that exposes instance metadata.
 * This allows other FEED instances to discover and connect to this instance.
 *
 * Response is cached for 1 hour to reduce database load.
 */

const CACHE_MAX_AGE = 3600 // 1 hour

interface InstanceMetadata {
  instance_url: string
  instance_name: string
  version: string
  public_key: string
  capabilities: string[]
  metadata: {
    region?: string
    resource_count?: number
    last_updated?: string
    contact_email?: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch local instance
    const { data: instance, error: instanceError } = await supabase
      .from('federated_instances')
      .select('*')
      .eq('is_local', true)
      .eq('status', 'active')
      .single()

    if (instanceError || !instance) {
      return NextResponse.json(
        { error: 'Instance not registered for federation' },
        { status: 404 }
      )
    }

    // Get resource count
    const { count: resourceCount } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })

    // Build response
    const metadata: InstanceMetadata = {
      instance_url: instance.instance_url,
      instance_name: instance.instance_name,
      version: '1.0.0',
      public_key: instance.public_key,
      capabilities: instance.metadata?.capabilities || ['resources', 'search'],
      metadata: {
        region: instance.metadata?.region,
        resource_count: resourceCount ?? 0,
        last_updated: instance.updated_at,
        contact_email: instance.metadata?.contact_email,
      }
    }

    // Return with CORS headers and caching
    return NextResponse.json(metadata, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}`,
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    console.error('Federation instance endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
