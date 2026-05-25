/**
 * Test suite for federation-webhook Edge Function
 *
 * Run with:
 *   deno test --allow-net --allow-env supabase/functions/federation-webhook/test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

const FUNCTION_URL = Deno.env.get('FUNCTION_URL') || 'http://localhost:54321/functions/v1/federation-webhook'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'test-key'

/**
 * Test 1: Reject non-POST requests
 */
Deno.test('Should reject GET requests', async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })

  assertEquals(response.status, 405)
  const data = await response.json()
  assertExists(data.error)
})

/**
 * Test 2: Reject requests with missing fields
 */
Deno.test('Should reject requests with missing fields', async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'insert',
      // Missing resource_id and resource_type
    }),
  })

  assertEquals(response.status, 400)
  const data = await response.json()
  assertExists(data.error)
})

/**
 * Test 3: Reject invalid event types
 */
Deno.test('Should reject invalid event types', async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'invalid',
      resource_id: '123e4567-e89b-12d3-a456-426614174000',
      resource_type: 'food',
    }),
  })

  assertEquals(response.status, 400)
  const data = await response.json()
  assertExists(data.error)
})

/**
 * Test 4: Accept valid request (no peers configured)
 */
Deno.test('Should accept valid request with no peers', async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'insert',
      resource_id: '123e4567-e89b-12d3-a456-426614174000',
      resource_type: 'food',
    }),
  })

  assertEquals(response.status, 200)
  const data = await response.json()
  assertEquals(data.success, true)
  assertEquals(data.event, 'resource.created')
  assertExists(data.deliveries)
})

/**
 * Test 5: Verify signature generation
 */
Deno.test('Should generate valid HMAC-SHA256 signature', async () => {
  const testPayload = {
    event: 'resource.created',
    instance_id: 'test-instance',
    instance_url: 'https://test.feed.org',
    resource_id: '123e4567-e89b-12d3-a456-426614174000',
    resource_type: 'food',
    timestamp: '2026-02-14T12:00:00Z',
  }

  const testSecret = Deno.env.get('TEST_HMAC_SECRET') || 'test-secret'
  const encoder = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(testSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(testPayload))
  )

  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const signatureWithPrefix = `sha256=${signatureHex}`

  assertExists(signatureWithPrefix)
  assertEquals(signatureWithPrefix.startsWith('sha256='), true)
  assertEquals(signatureWithPrefix.length, 71) // 'sha256=' (7) + 64 hex chars
})

/**
 * Test 6: CORS headers
 */
Deno.test('Should include CORS headers in response', async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://feed.org',
      'Access-Control-Request-Method': 'POST',
    },
  })

  assertEquals(response.status, 200)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertExists(response.headers.get('Access-Control-Allow-Headers'))
})

/**
 * Test 7: Event type mapping
 */
Deno.test('Should map event types correctly', async () => {
  const testCases = [
    { input: 'insert', expected: 'resource.created' },
    { input: 'update', expected: 'resource.updated' },
    { input: 'delete', expected: 'resource.deleted' },
  ]

  for (const testCase of testCases) {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: testCase.input,
        resource_id: '123e4567-e89b-12d3-a456-426614174000',
        resource_type: 'food',
      }),
    })

    const data = await response.json()
    assertEquals(data.event, testCase.expected)
  }
})

console.log('All tests completed!')
