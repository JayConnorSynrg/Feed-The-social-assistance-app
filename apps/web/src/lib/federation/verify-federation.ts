/**
 * Federation Request Verification
 *
 * Verifies HTTP signatures on inbound federation requests.
 * Used by federation API routes to authenticate remote instances.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  verifySignature,
  verifyDigest,
  extractKeyId,
  SignatureComponents,
} from '@feed/shared/lib/http-signatures'

export interface VerifiedInstance {
  id: string
  instance_url: string
  instance_name: string
  public_key: string
  status: 'active' | 'suspended' | 'blocked'
  trust_level?: 'untrusted' | 'pending' | 'trusted' | 'verified' | 'core'
  trust_score?: number
}

export interface VerificationResult {
  success: boolean
  instance?: VerifiedInstance
  error?: string
  errorCode?: 'MISSING_SIGNATURE' | 'INVALID_SIGNATURE' | 'EXPIRED_SIGNATURE' | 'UNKNOWN_INSTANCE' | 'BLOCKED_INSTANCE' | 'INVALID_DIGEST'
}

/**
 * Extract request components for signature verification
 */
function extractRequestComponents(request: NextRequest, body?: string): SignatureComponents {
  const url = new URL(request.url)

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })

  return {
    method: request.method,
    path: url.pathname + url.search,
    headers,
    body,
  }
}

/**
 * Verify an incoming federation request
 *
 * @param request - The Next.js request object
 * @param body - Optional request body (for POST/PUT requests)
 * @returns Verification result with instance info if successful
 */
export async function verifyFederationRequest(
  request: NextRequest,
  body?: string
): Promise<VerificationResult> {
  // SECURITY NOTE: Uses service role key to verify federation instances.
  // This function validates HTTP signatures from external federation peers.
  // It needs admin access to look up instance public keys and update last_seen_at.
  //
  // TODO: Move to Supabase Edge Function or create a dedicated RPC function
  // that can verify signatures without exposing service role key to Next.js
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      success: false,
      error: 'Server configuration error',
      errorCode: 'MISSING_SIGNATURE',
    }
  }

  // Get signature from header (can be Signature or Authorization)
  const signatureHeader = request.headers.get('signature') || request.headers.get('authorization')

  if (!signatureHeader) {
    return {
      success: false,
      error: 'Missing signature header',
      errorCode: 'MISSING_SIGNATURE',
    }
  }

  // Extract keyId to look up the instance
  const keyId = extractKeyId(signatureHeader)
  if (!keyId) {
    return {
      success: false,
      error: 'Could not extract keyId from signature',
      errorCode: 'INVALID_SIGNATURE',
    }
  }

  // keyId format: "https://instance.url#main-key"
  // Extract the instance URL from the keyId
  const instanceUrl = keyId.split('#')[0]

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Look up the instance by URL
  const { data: instance, error: instanceError } = await supabase
    .from('federated_instances')
    .select('id, instance_url, instance_name, public_key, status')
    .eq('instance_url', instanceUrl)
    .single()

  if (instanceError || !instance) {
    return {
      success: false,
      error: `Unknown federation instance: ${instanceUrl}`,
      errorCode: 'UNKNOWN_INSTANCE',
    }
  }

  // Check if instance is blocked or suspended
  if (instance.status === 'blocked') {
    return {
      success: false,
      error: 'Instance is blocked',
      errorCode: 'BLOCKED_INSTANCE',
    }
  }

  if (instance.status === 'suspended') {
    return {
      success: false,
      error: 'Instance is suspended',
      errorCode: 'BLOCKED_INSTANCE',
    }
  }

  // Verify body digest if present
  const digestHeader = request.headers.get('digest')
  if (body && digestHeader) {
    if (!verifyDigest(body, digestHeader)) {
      return {
        success: false,
        error: 'Request body digest mismatch',
        errorCode: 'INVALID_DIGEST',
      }
    }
  }

  // Extract request components
  const components = extractRequestComponents(request, body)

  // Verify the signature
  const isValid = verifySignature(instance.public_key, signatureHeader, components)

  if (!isValid) {
    return {
      success: false,
      error: 'Invalid signature',
      errorCode: 'INVALID_SIGNATURE',
    }
  }

  // Get the federation peer info for trust level/score
  const { data: localInstance } = await supabase
    .from('federated_instances')
    .select('id')
    .eq('is_local', true)
    .single()

  let trustLevel: VerifiedInstance['trust_level'] = undefined
  let trustScore: number | undefined = undefined

  if (localInstance) {
    const { data: peer } = await supabase
      .from('federation_peers')
      .select('trust_level, trust_score')
      .eq('local_instance_id', localInstance.id)
      .eq('remote_instance_id', instance.id)
      .single()

    if (peer) {
      trustLevel = peer.trust_level as VerifiedInstance['trust_level']
      trustScore = peer.trust_score
    }
  }

  // Update last_seen_at for the instance
  await supabase
    .from('federated_instances')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', instance.id)

  return {
    success: true,
    instance: {
      id: instance.id,
      instance_url: instance.instance_url,
      instance_name: instance.instance_name,
      public_key: instance.public_key,
      status: instance.status,
      trust_level: trustLevel,
      trust_score: trustScore,
    },
  }
}

/**
 * Higher-order function to wrap an API route with federation verification
 */
export function withFederationAuth(
  handler: (
    request: NextRequest,
    context: { instance: VerifiedInstance; body?: string }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Read body if present
    let body: string | undefined
    if (request.method === 'POST' || request.method === 'PUT') {
      body = await request.text()
    }

    const result = await verifyFederationRequest(request, body)

    if (!result.success || !result.instance) {
      const statusCode =
        result.errorCode === 'MISSING_SIGNATURE' ||
        result.errorCode === 'INVALID_SIGNATURE' ||
        result.errorCode === 'EXPIRED_SIGNATURE' ||
        result.errorCode === 'INVALID_DIGEST'
          ? 401
          : result.errorCode === 'BLOCKED_INSTANCE' || result.errorCode === 'UNKNOWN_INSTANCE'
          ? 403
          : 500

      return NextResponse.json(
        { error: result.error, code: result.errorCode },
        {
          status: statusCode,
          headers: {
            'WWW-Authenticate': 'Signature realm="FEED Federation"',
          },
        }
      )
    }

    return handler(request, { instance: result.instance, body })
  }
}

/**
 * Check if a request has minimum required trust level
 */
export function requireTrustLevel(
  instance: VerifiedInstance,
  minimumLevel: 'untrusted' | 'pending' | 'trusted' | 'verified' | 'core'
): boolean {
  const levels = ['untrusted', 'pending', 'trusted', 'verified', 'core']
  const instanceIndex = levels.indexOf(instance.trust_level || 'untrusted')
  const requiredIndex = levels.indexOf(minimumLevel)
  return instanceIndex >= requiredIndex
}
