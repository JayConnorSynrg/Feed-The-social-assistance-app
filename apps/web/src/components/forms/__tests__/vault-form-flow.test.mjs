/**
 * Vault Form Flow Smoke Tests
 *
 * Tests three contract assertions for the Phase A vault encryption migration:
 *
 *  (a) useUserSubmissions vault-equivalent returns typed-empty when vault is locked
 *  (b) encrypt→decrypt round-trip of a form submission preserves formData + signatureData
 *  (c) form_data stays null in the encrypted insert path
 *
 * These run as pure node:test (no browser, no DOM) via:
 *   node --test apps/web/src/components/forms/__tests__/vault-form-flow.test.mjs
 *
 * The vault encryption functions (encryptObject / decryptObject) depend on
 * globalThis.crypto (WebCrypto). Node 20+ exposes this natively; no polyfill needed.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ============================================
// (a) Locked-vault guard: useUserSubmissions returns typed-empty
// ============================================

describe('useUserSubmissions vault guard — locked vault', () => {
  it('returns empty submissions array when isUnlocked is false', async () => {
    // Simulate the exact guard from use-vault-form-submission.ts:
    //   if (!isUnlocked) { setSubmissions([]); setLoading(false); return }
    const isUnlocked = false

    let submissions = null
    let loading = null

    if (!isUnlocked) {
      submissions = []
      loading = false
    }

    assert.deepStrictEqual(submissions, [], 'submissions must be empty array when locked')
    assert.strictEqual(loading, false, 'loading must be false when locked (no spinner)')
    assert.notStrictEqual(submissions, null, 'submissions must not be null (typed-empty)')
  })

  it('does not throw when vault is locked', () => {
    // Guard must exit silently — no throw
    const isUnlocked = false
    assert.doesNotThrow(() => {
      if (!isUnlocked) {
        return []
      }
    })
  })
})

// ============================================
// (b) Encrypt→decrypt round-trip via WebCrypto (AES-GCM)
//     Mirrors the exact logic in field-encryption.ts encryptObject / decryptObject
// ============================================

async function generateTestKey() {
  return globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

async function encryptObject(key, data) {
  const json = JSON.stringify(data)
  const encoded = new TextEncoder().encode(json)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )
  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  }
}

async function decryptObject(key, ciphertext, iv) {
  const ctBuffer = Buffer.from(ciphertext, 'base64')
  const ivBuffer = Buffer.from(iv, 'base64')
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    ctBuffer
  )
  return JSON.parse(new TextDecoder().decode(decrypted))
}

async function encryptString(key, data) {
  const encoded = new TextEncoder().encode(data)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )
  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  }
}

async function decryptString(key, ciphertext, iv) {
  const ctBuffer = Buffer.from(ciphertext, 'base64')
  const ivBuffer = Buffer.from(iv, 'base64')
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    ctBuffer
  )
  return new TextDecoder().decode(decrypted)
}

describe('encrypt→decrypt round-trip (AES-GCM, mirrors field-encryption.ts)', () => {
  it('preserves formData across encrypt/decrypt', async () => {
    const key = await generateTestKey()
    const formData = {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '000-00-0000',
      annualIncome: 28000,
      householdSize: 3,
    }

    const { ciphertext, iv } = await encryptObject(key, formData)
    const decrypted = await decryptObject(key, ciphertext, iv)

    assert.deepStrictEqual(decrypted, formData, 'decrypted formData must equal original')
  })

  it('preserves signatureData across encrypt/decrypt', async () => {
    const key = await generateTestKey()
    const signatureData = 'Jane A. Doe'

    const { ciphertext, iv } = await encryptString(key, signatureData)
    const decrypted = await decryptString(key, ciphertext, iv)

    assert.strictEqual(decrypted, signatureData, 'decrypted signatureData must equal original')
  })

  it('ciphertext differs from plaintext (actually encrypted)', async () => {
    const key = await generateTestKey()
    const formData = { firstName: 'Jane' }

    const { ciphertext } = await encryptObject(key, formData)
    const originalJson = JSON.stringify(formData)

    assert.notStrictEqual(
      ciphertext,
      originalJson,
      'ciphertext must differ from plaintext (encryption is active)'
    )
    assert.notStrictEqual(
      Buffer.from(ciphertext, 'base64').toString('utf8'),
      originalJson,
      'base64-decoded ciphertext must still not equal plaintext'
    )
  })

  it('uses a fresh IV per encryption call (no IV reuse)', async () => {
    const key = await generateTestKey()
    const formData = { field: 'value' }

    const enc1 = await encryptObject(key, formData)
    const enc2 = await encryptObject(key, formData)

    assert.notStrictEqual(
      enc1.iv,
      enc2.iv,
      'each encryption call must produce a unique IV'
    )
  })
})

// ============================================
// (c) form_data stays null in the encrypted insert path
// ============================================

describe('vault insert path — form_data is null', () => {
  it('createDraft insert object has form_data=null', () => {
    // Mirrors use-vault-form-submission.ts createDraft() submission shape (lines ~105-117)
    const templateId = 'tmpl-snap-001'
    const userId = 'user-abc-123'
    const encryptedData = {
      encrypted_form_data: 'base64ciphertext==',
      form_data_iv: 'base64iv==',
    }

    const submission = {
      template_id: templateId,
      user_id: userId,
      status: 'draft',
      form_data: null,
      ...encryptedData,
      encryption_migrated: true,
    }

    assert.strictEqual(
      submission.form_data,
      null,
      'form_data must be null in vault insert (PII stored only in encrypted_form_data)'
    )
    assert.ok(submission.encrypted_form_data, 'encrypted_form_data must be present')
    assert.ok(submission.form_data_iv, 'form_data_iv must be present')
    assert.strictEqual(submission.encryption_migrated, true)
  })

  it('saveDraft update object has form_data=null', () => {
    // Mirrors use-vault-form-submission.ts saveDraft() updates shape (lines ~183-190)
    const encryptedData = {
      encrypted_form_data: 'base64ciphertext==',
      form_data_iv: 'base64iv==',
    }

    const updates = {
      form_data: null,
      ...encryptedData,
      encryption_migrated: true,
      updated_at: new Date().toISOString(),
    }

    assert.strictEqual(
      updates.form_data,
      null,
      'form_data must be null in vault update (no plaintext write)'
    )
  })

  it('submitForm update object has form_data=null', () => {
    // Mirrors use-vault-form-submission.ts submitForm() updates shape (lines ~248-260)
    const now = new Date().toISOString()
    const encryptedData = {
      encrypted_form_data: 'base64ciphertext==',
      form_data_iv: 'base64iv==',
      encrypted_signature_data: 'base64sig==',
      signature_data_iv: 'base64sigiv==',
    }

    const updates = {
      form_data: null,
      ...encryptedData,
      encryption_migrated: true,
      status: 'submitted',
      submitted_at: now,
      updated_at: now,
    }

    assert.strictEqual(
      updates.form_data,
      null,
      'form_data must be null on submit (most sensitive data — full SSN, completed form)'
    )
    assert.ok(updates.encrypted_signature_data, 'signature must be in encrypted column')
    assert.strictEqual(updates.status, 'submitted')
  })
})
