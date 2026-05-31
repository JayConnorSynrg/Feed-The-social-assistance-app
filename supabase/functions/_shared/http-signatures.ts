/**
 * HTTP Signatures (draft-cavage) — Deno/WebCrypto signer
 *
 * Produces signatures BYTE-IDENTICAL to the Next.js verifier in
 * packages/shared/lib/http-signatures.ts.  Both sides use
 * RSASSA-PKCS1-v1_5 / SHA-256 over the same draft-cavage signing string,
 * so a token signed here is accepted by verifySignature() on the Next side.
 *
 * Signing string construction (matches buildSignatureString in the Node lib):
 *   (request-target): <method> <path>
 *   host: <host>
 *   date: <RFC 7231 date>
 *   (created): <unix seconds>
 *   (expires): <unix seconds + 300>
 *   [digest: SHA-256=<base64>]   ← only when body is present
 *
 * Emitted Signature header (matches signRequest in the Node lib):
 *   keyId="<keyId>",algorithm="rsa-sha256",headers="...",
 *   created=<n>,expires=<n+300>,signature="<base64>"
 *
 * NOTE: federation-webhook uses a separate HMAC scheme
 * (X-Federation-Signature: sha256=<hex>, HMAC key derived from FEDERATION_PRIVATE_KEY[:64]).
 * That scheme is self-consistent sender+receiver; do not touch it from here.
 * The key-reuse smell (RSA private key first 64 chars used as HMAC key) is
 * a known limitation; address when federation goes live.
 */

export interface SignRequestOptions {
  /** RSA private key in PKCS8 PEM format */
  privateKeyPem: string
  /** HTTP method (GET, POST, …) */
  method: string
  /** Full URL of the request */
  url: string
  /** keyId value for the Signature header, e.g. "https://instance.example#main-key" */
  keyId: string
  /** Optional pre-set unix timestamp (seconds). Defaults to Date.now()/1000. */
  created?: number
  /** Optional expiry unix timestamp (seconds). Defaults to created + 300. */
  expires?: number
  /** Optional request body — when present, a Digest header is included in signing */
  body?: string
}

export interface SignedHeaders {
  /** The full draft-cavage Signature header value */
  Signature: string
  /** Host header derived from the URL */
  Host: string
  /** Date header in RFC 7231 format */
  Date: string
  /** Digest header (only present when body was provided) */
  Digest?: string
}

/** Import a PKCS8 PEM private key using SubtleCrypto (Deno / browser WebCrypto). */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

/** Compute SHA-256 digest of a string and return "SHA-256=<base64>". */
async function computeDigest(body: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(body)
  )
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  return `SHA-256=${b64}`
}

/**
 * Sign an HTTP request using draft-cavage HTTP Signatures.
 *
 * Returns the headers that must be included in the outbound request.
 * The caller is responsible for forwarding Host, Date, Signature, and
 * (when present) Digest to the remote peer.
 */
export async function signRequest(options: SignRequestOptions): Promise<SignedHeaders> {
  const { privateKeyPem, method, url: rawUrl, keyId, body } = options

  const parsedUrl = new URL(rawUrl)
  const host = parsedUrl.host
  const path = parsedUrl.pathname + parsedUrl.search
  const dateStr = new Date().toUTCString()

  const created = options.created ?? Math.floor(Date.now() / 1000)
  const expires = options.expires ?? created + 300

  // Build the ordered list of headers to include in the signing string.
  // This order must match headersToSign in packages/shared/lib/http-signatures.ts:signRequest.
  const headersToSign: string[] = [
    '(request-target)',
    'host',
    'date',
    '(created)',
    '(expires)',
  ]

  // Compute digest and add to signing list when body is present
  let digestHeader: string | undefined
  if (body !== undefined && body !== null) {
    digestHeader = await computeDigest(body)
    headersToSign.push('digest')
  }

  // Build signing string — each line is "<header-name>: <value>\n", joined without trailing \n
  const lines: string[] = []
  for (const header of headersToSign) {
    if (header === '(request-target)') {
      lines.push(`(request-target): ${method.toLowerCase()} ${path}`)
    } else if (header === '(created)') {
      lines.push(`(created): ${created}`)
    } else if (header === '(expires)') {
      lines.push(`(expires): ${expires}`)
    } else if (header === 'host') {
      lines.push(`host: ${host}`)
    } else if (header === 'date') {
      lines.push(`date: ${dateStr}`)
    } else if (header === 'digest' && digestHeader) {
      lines.push(`digest: ${digestHeader}`)
    }
  }
  const signingString = lines.join('\n')

  // Sign with RSASSA-PKCS1-v1_5 / SHA-256 (WebCrypto)
  const privateKey = await importPrivateKey(privateKeyPem)
  const rawSig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingString)
  )
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(rawSig)))

  // Assemble draft-cavage Signature header value
  const signatureHeaderValue = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${headersToSign.join(' ')}"`,
    `created=${created}`,
    `expires=${expires}`,
    `signature="${signatureB64}"`,
  ].join(',')

  const result: SignedHeaders = {
    Signature: signatureHeaderValue,
    Host: host,
    Date: dateStr,
  }
  if (digestHeader) {
    result.Digest = digestHeader
  }
  return result
}
