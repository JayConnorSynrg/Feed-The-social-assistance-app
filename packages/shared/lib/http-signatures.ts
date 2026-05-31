/**
 * HTTP Signatures (draft-cavage HTTP Signatures) for Federation Authentication
 *
 * Implements request signing and verification for secure communication
 * between federated FEED instances.
 *
 * NOTE: Despite the earlier "RFC 9421" label, this file implements the
 * draft-cavage-http-signatures scheme (Signature header, keyId/algorithm/headers
 * parameters, (request-target) pseudo-header). RFC 9421 is a separate, later
 * standard. Do not change this implementation — the inbound Next.js verifier
 * (verify-federation.ts) depends on it and all peer sign/verify round-trips
 * have been validated against it.
 */

import { createSign, createVerify, createHash } from 'crypto'

export interface SignatureComponents {
  method: string
  path: string
  headers: Record<string, string>
  body?: string
}

export interface SignatureParams {
  keyId: string
  algorithm: string
  headers: string[]
  signature: string
  created?: number
  expires?: number
}

/**
 * Create a digest of the request body using SHA-256
 */
export function createDigest(body: string): string {
  const hash = createHash('sha256').update(body).digest('base64')
  return `SHA-256=${hash}`
}

/**
 * Build the signature string from request components
 */
export function buildSignatureString(
  components: SignatureComponents,
  headersToSign: string[]
): string {
  const parts: string[] = []

  for (const header of headersToSign) {
    if (header === '(request-target)') {
      parts.push(`(request-target): ${components.method.toLowerCase()} ${components.path}`)
    } else if (header === '(created)') {
      parts.push(`(created): ${Math.floor(Date.now() / 1000)}`)
    } else if (header === '(expires)') {
      // Signature expires in 5 minutes
      parts.push(`(expires): ${Math.floor(Date.now() / 1000) + 300}`)
    } else {
      const value = components.headers[header.toLowerCase()]
      if (value) {
        parts.push(`${header.toLowerCase()}: ${value}`)
      }
    }
  }

  return parts.join('\n')
}

/**
 * Sign an HTTP request for federation authentication
 *
 * @param privateKey - PEM-encoded RSA private key
 * @param keyId - Identifier for the signing key (usually instance URL + #main-key)
 * @param components - Request components to sign
 * @returns Authorization header value
 */
export function signRequest(
  privateKey: string,
  keyId: string,
  components: SignatureComponents
): string {
  const headersToSign = ['(request-target)', 'host', 'date', '(created)', '(expires)']

  // Add digest if body present
  if (components.body) {
    const digest = createDigest(components.body)
    components.headers['digest'] = digest
    headersToSign.push('digest')
  }

  // Add date if not present
  if (!components.headers['date']) {
    components.headers['date'] = new Date().toUTCString()
  }

  const signatureString = buildSignatureString(components, headersToSign)
  const created = Math.floor(Date.now() / 1000)
  const expires = created + 300

  // Create signature
  const signer = createSign('RSA-SHA256')
  signer.update(signatureString)
  const signature = signer.sign(privateKey, 'base64')

  // Build Signature header value
  const signatureHeader = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${headersToSign.join(' ')}"`,
    `created=${created}`,
    `expires=${expires}`,
    `signature="${signature}"`,
  ].join(',')

  return signatureHeader
}

/**
 * Parse a Signature header into components
 */
export function parseSignatureHeader(header: string): SignatureParams | null {
  try {
    const params: Partial<SignatureParams> = {}

    // Parse key="value" or key=value pairs
    const regex = /(\w+)=(?:"([^"]+)"|(\d+))/g
    let match

    while ((match = regex.exec(header)) !== null) {
      const [, key, quotedValue, numericValue] = match
      const value = quotedValue ?? numericValue

      switch (key) {
        case 'keyId':
          params.keyId = value
          break
        case 'algorithm':
          params.algorithm = value
          break
        case 'headers':
          params.headers = value.split(' ')
          break
        case 'signature':
          params.signature = value
          break
        case 'created':
          params.created = parseInt(value, 10)
          break
        case 'expires':
          params.expires = parseInt(value, 10)
          break
      }
    }

    if (!params.keyId || !params.signature || !params.headers) {
      return null
    }

    return params as SignatureParams
  } catch {
    return null
  }
}

/**
 * Verify an HTTP signature
 *
 * @param publicKey - PEM-encoded RSA public key of the sender
 * @param signatureHeader - The Signature header value
 * @param components - Request components that were signed
 * @returns true if signature is valid
 */
export function verifySignature(
  publicKey: string,
  signatureHeader: string,
  components: SignatureComponents
): boolean {
  try {
    const params = parseSignatureHeader(signatureHeader)
    if (!params) {
      console.error('Failed to parse signature header')
      return false
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (params.expires && params.expires < now) {
      console.error('Signature has expired')
      return false
    }

    // Check creation time (reject if more than 5 minutes old)
    if (params.created && now - params.created > 300) {
      console.error('Signature is too old')
      return false
    }

    // Rebuild the signature string
    const signatureString = buildSignatureStringForVerification(components, params)

    // Verify
    const verifier = createVerify('RSA-SHA256')
    verifier.update(signatureString)

    return verifier.verify(publicKey, params.signature, 'base64')
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Build signature string for verification (uses provided headers)
 */
function buildSignatureStringForVerification(
  components: SignatureComponents,
  params: SignatureParams
): string {
  const parts: string[] = []

  for (const header of params.headers) {
    if (header === '(request-target)') {
      parts.push(`(request-target): ${components.method.toLowerCase()} ${components.path}`)
    } else if (header === '(created)') {
      parts.push(`(created): ${params.created}`)
    } else if (header === '(expires)') {
      parts.push(`(expires): ${params.expires}`)
    } else {
      const value = components.headers[header.toLowerCase()]
      if (value) {
        parts.push(`${header.toLowerCase()}: ${value}`)
      }
    }
  }

  return parts.join('\n')
}

/**
 * Verify the body digest matches
 */
export function verifyDigest(body: string, digestHeader: string): boolean {
  const expectedDigest = createDigest(body)
  return expectedDigest === digestHeader
}

/**
 * Extract key ID from signature to lookup public key
 */
export function extractKeyId(signatureHeader: string): string | null {
  const params = parseSignatureHeader(signatureHeader)
  return params?.keyId ?? null
}
