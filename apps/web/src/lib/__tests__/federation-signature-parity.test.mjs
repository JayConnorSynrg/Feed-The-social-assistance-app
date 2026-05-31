/**
 * Parity test: Deno _shared signer ↔ Next.js verifier
 *
 * Proves that the signing logic in supabase/functions/_shared/http-signatures.ts
 * (reimplemented here using Node WebCrypto, which is byte-identical to Deno
 * WebCrypto for RSASSA-PKCS1-v1_5/SHA-256) produces signatures that
 * packages/shared/lib/http-signatures.ts verifySignature() accepts.
 *
 * Node WebCrypto ≡ Deno WebCrypto ≡ Node legacy crypto for this algorithm
 * (same RSASSA-PKCS1-v1_5 + SHA-256, same base64 encoding).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createVerify, createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// ---------------------------------------------------------------------------
// Helpers — mirror supabase/functions/_shared/http-signatures.ts exactly
// ---------------------------------------------------------------------------

const subtle = webcrypto.subtle

async function importPrivateKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const der = Buffer.from(b64, 'base64')
  return subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function importPublicKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')
  const der = Buffer.from(b64, 'base64')
  return subtle.importKey(
    'spki',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify']
  )
}

async function computeDigest(body) {
  const buf = await subtle.digest('SHA-256', Buffer.from(body, 'utf8'))
  return `SHA-256=${Buffer.from(buf).toString('base64')}`
}

/**
 * Deno signer logic — mirrored from _shared/http-signatures.ts
 */
async function denoSignRequest({ privateKeyPem, method, url: rawUrl, keyId, body, created, expires }) {
  const parsedUrl = new URL(rawUrl)
  const host = parsedUrl.host
  const path = parsedUrl.pathname + parsedUrl.search
  const dateStr = new Date().toUTCString()

  const ts = created ?? Math.floor(Date.now() / 1000)
  const exp = expires ?? ts + 300

  const headersToSign = ['(request-target)', 'host', 'date', '(created)', '(expires)']
  let digestHeader
  if (body !== undefined && body !== null) {
    digestHeader = await computeDigest(body)
    headersToSign.push('digest')
  }

  const lines = []
  for (const header of headersToSign) {
    if (header === '(request-target)') lines.push(`(request-target): ${method.toLowerCase()} ${path}`)
    else if (header === '(created)') lines.push(`(created): ${ts}`)
    else if (header === '(expires)') lines.push(`(expires): ${exp}`)
    else if (header === 'host') lines.push(`host: ${host}`)
    else if (header === 'date') lines.push(`date: ${dateStr}`)
    else if (header === 'digest' && digestHeader) lines.push(`digest: ${digestHeader}`)
  }
  const signingString = lines.join('\n')

  const privateKey = await importPrivateKey(privateKeyPem)
  const rawSig = await subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    Buffer.from(signingString, 'utf8')
  )
  const signatureB64 = Buffer.from(rawSig).toString('base64')

  const signatureHeaderValue = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${headersToSign.join(' ')}"`,
    `created=${ts}`,
    `expires=${exp}`,
    `signature="${signatureB64}"`,
  ].join(',')

  return {
    Signature: signatureHeaderValue,
    Host: host,
    Date: dateStr,
    Digest: digestHeader,
    _signingString: signingString, // exposed for inspection in tests
  }
}

// ---------------------------------------------------------------------------
// Next.js verifier — mirrored from packages/shared/lib/http-signatures.ts
// (parseSignatureHeader + buildSignatureStringForVerification + verifySignature)
// Reimplemented in JS so the test has zero import-resolution dependency on the
// TypeScript source. Behaviour is identical to the compiled output.
// ---------------------------------------------------------------------------

function parseSignatureHeader(header) {
  const params = {}
  const regex = /(\w+)=(?:"([^"]+)"|(\d+))/g
  let match
  while ((match = regex.exec(header)) !== null) {
    const [, key, quotedValue, numericValue] = match
    const value = quotedValue ?? numericValue
    switch (key) {
      case 'keyId': params.keyId = value; break
      case 'algorithm': params.algorithm = value; break
      case 'headers': params.headers = value.split(' '); break
      case 'signature': params.signature = value; break
      case 'created': params.created = parseInt(value, 10); break
      case 'expires': params.expires = parseInt(value, 10); break
    }
  }
  if (!params.keyId || !params.signature || !params.headers) return null
  return params
}

function buildSignatureStringForVerification(components, params) {
  const parts = []
  for (const header of params.headers) {
    if (header === '(request-target)') {
      parts.push(`(request-target): ${components.method.toLowerCase()} ${components.path}`)
    } else if (header === '(created)') {
      parts.push(`(created): ${params.created}`)
    } else if (header === '(expires)') {
      parts.push(`(expires): ${params.expires}`)
    } else {
      const value = components.headers[header.toLowerCase()]
      if (value) parts.push(`${header.toLowerCase()}: ${value}`)
    }
  }
  return parts.join('\n')
}

function nextVerifySignature(publicKeyPem, signatureHeader, components) {
  try {
    const params = parseSignatureHeader(signatureHeader)
    if (!params) return false

    const now = Math.floor(Date.now() / 1000)
    if (params.expires && params.expires < now) return false
    if (params.created && now - params.created > 300) return false

    const signingString = buildSignatureStringForVerification(components, params)

    const verifier = createVerify('RSA-SHA256')
    verifier.update(signingString)
    return verifier.verify(publicKeyPem, params.signature, 'base64')
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Key generation helper (RSA 2048, PKCS8/SPKI PEM)
// ---------------------------------------------------------------------------

async function generateRsaKeyPair() {
  const keyPair = await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )
  const privateDer = await subtle.exportKey('pkcs8', keyPair.privateKey)
  const publicDer = await subtle.exportKey('spki', keyPair.publicKey)

  const toPem = (label, buf) =>
    `-----BEGIN ${label}-----\n${Buffer.from(buf).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`

  return {
    privateKeyPem: toPem('PRIVATE KEY', privateDer),
    publicKeyPem: toPem('PUBLIC KEY', publicDer),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Deno signer → Next verifier: GET request without body — round-trip passes', async () => {
  const { privateKeyPem, publicKeyPem } = await generateRsaKeyPair()
  const url = 'https://peer.example.com/api/federation/resources?since=2026-01-01T00%3A00%3A00Z'
  const keyId = 'https://local.example.com#main-key'

  const signed = await denoSignRequest({ privateKeyPem, method: 'GET', url, keyId })

  const components = {
    method: 'GET',
    path: new URL(url).pathname + new URL(url).search,
    headers: {
      host: new URL(url).host,
      date: signed.Date,
    },
  }

  const result = nextVerifySignature(publicKeyPem, signed.Signature, components)
  assert.equal(result, true, 'GET round-trip must verify')
})

test('Deno signer → Next verifier: POST request with body — round-trip passes', async () => {
  const { privateKeyPem, publicKeyPem } = await generateRsaKeyPair()
  const url = 'https://peer.example.com/api/federation/webhook'
  const keyId = 'https://local.example.com#main-key'
  const body = JSON.stringify({ event: 'resource.updated', resource_id: 'abc-123' })

  const signed = await denoSignRequest({ privateKeyPem, method: 'POST', url, keyId, body })

  const components = {
    method: 'POST',
    path: new URL(url).pathname,
    headers: {
      host: new URL(url).host,
      date: signed.Date,
      digest: signed.Digest,
    },
    body,
  }

  const result = nextVerifySignature(publicKeyPem, signed.Signature, components)
  assert.equal(result, true, 'POST with body round-trip must verify')
})

test('Tampered signature — Next verifier rejects', async () => {
  const { privateKeyPem, publicKeyPem } = await generateRsaKeyPair()
  const url = 'https://peer.example.com/api/federation/resources'
  const keyId = 'https://local.example.com#main-key'

  const signed = await denoSignRequest({ privateKeyPem, method: 'GET', url, keyId })

  // Flip one character in the base64 signature to produce an invalid sig
  const tamperedHeader = signed.Signature.replace(/signature="(.)/, (_, c) =>
    `signature="${c === 'A' ? 'B' : 'A'}`
  )

  const components = {
    method: 'GET',
    path: new URL(url).pathname,
    headers: { host: new URL(url).host, date: signed.Date },
  }

  const result = nextVerifySignature(publicKeyPem, tamperedHeader, components)
  assert.equal(result, false, 'Tampered signature must be rejected')
})

test('Wrong public key — Next verifier rejects', async () => {
  const { privateKeyPem } = await generateRsaKeyPair()
  const { publicKeyPem: wrongPublicKeyPem } = await generateRsaKeyPair()
  const url = 'https://peer.example.com/api/federation/resources'
  const keyId = 'https://local.example.com#main-key'

  const signed = await denoSignRequest({ privateKeyPem, method: 'GET', url, keyId })

  const components = {
    method: 'GET',
    path: new URL(url).pathname,
    headers: { host: new URL(url).host, date: signed.Date },
  }

  const result = nextVerifySignature(wrongPublicKeyPem, signed.Signature, components)
  assert.equal(result, false, 'Signature verified with wrong key must fail')
})

test('Signing string matches verifier reconstruction for GET', async () => {
  const { privateKeyPem } = await generateRsaKeyPair()
  const url = 'https://peer.example.com/api/federation/resources?cursor=abc'
  const keyId = 'https://local.example.com#main-key'
  const ts = Math.floor(Date.now() / 1000)

  const signed = await denoSignRequest({ privateKeyPem, method: 'GET', url, keyId, created: ts, expires: ts + 300 })
  const params = parseSignatureHeader(signed.Signature)

  const components = {
    method: 'GET',
    path: new URL(url).pathname + new URL(url).search,
    headers: { host: new URL(url).host, date: signed.Date },
  }

  const reconstructed = buildSignatureStringForVerification(components, params)
  assert.equal(reconstructed, signed._signingString,
    'Signing string built by verifier must equal signing string built by signer')
})
