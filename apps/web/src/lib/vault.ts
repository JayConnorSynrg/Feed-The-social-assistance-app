/**
 * Vault Manager
 *
 * Manages the vault unlock/lock lifecycle for zero-knowledge encryption.
 *
 * Flow:
 * 1. Setup: User creates master password → Generate DEK → Derive KEK → Wrap DEK → Store in DB
 * 2. Unlock: User enters password → Derive KEK → Unwrap DEK → Store in IndexedDB
 * 3. Lock: Clear DEK from IndexedDB
 * 4. Encrypt/Decrypt: Use DEK from IndexedDB for data operations
 */

import { createClient } from '@/lib/supabase/client'
import {
  generateDEK,
  deriveKEK,
  deriveVerificationKey,
  VAULT_VERIFICATION_CONSTANT,
  wrapDEK,
  unwrapDEK,
  rotateKEK,
  generateSalt,
  generateIV,
  encrypt,
  decrypt,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '@/lib/crypto'
import {
  storeDEK,
  getDEK,
  clearKeys,
  hasActiveDEK,
  isSessionValid,
} from '@/lib/key-store'

export const QUERY_TIMEOUT_MS = 12_000

export class VaultTimeoutError extends Error {
  constructor(message = 'Vault operation timed out. Please check your connection and try again.') {
    super(message)
    this.name = 'VaultTimeoutError'
  }
}

/** Detect a PostgREST/fetch abort or timeout from a resolved error object (postgrest resolves, not throws, on abort; error.code is '' so we key on message). */
export function isQueryTimeout(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : ''
  return /AbortError|TimeoutError|abort|timeout/i.test(msg)
}

export interface VaultSetupResult {
  salt: string
  wrappedDEK: string
  dekIV: string
}

export interface VaultData {
  encryption_salt: string | null
  wrapped_dek: string | null
  dek_iv: string | null
  encryption_version: number | null
  vault_created_at: string | null
  /**
   * Zero-knowledge verification fields (replace legacy key_check).
   * verification_ciphertext: base64(AES-GCM ciphertext of VAULT_VERIFICATION_CONSTANT)
   * verification_iv:         base64(12-byte random IV used for that encryption)
   * Both are produced by deriveVerificationKey() + crypto.subtle.encrypt().
   * Requires DB migration: add columns verification_ciphertext TEXT, verification_iv TEXT
   * and drop (or null-out) the legacy key_check column.
   */
  verification_ciphertext: string | null
  verification_iv: string | null
}

/**
 * Setup vault for the first time
 * Creates salt, derives KEK, generates DEK, wraps DEK
 */
export async function setupVault(
  masterPassword: string,
  userId: string
): Promise<VaultSetupResult> {
  const supabase = createClient()

  // 1. Generate salt
  const salt = generateSalt()

  // 2. Derive KEK from master password + salt
  const kek = await deriveKEK(masterPassword, salt)

  // 3. Generate new DEK (raw bytes for wrapping + non-extractable key for use)
  const { key: dek, rawBytes: dekRawBytes } = await generateDEK()

  // 4. Wrap raw DEK bytes with KEK (envelope pattern — dek CryptoKey stays non-extractable)
  const { wrappedKey, iv } = await wrapDEK(dekRawBytes, kek)

  // 5. Convert to base64 for storage
  const result: VaultSetupResult = {
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    wrappedDEK: arrayBufferToBase64(wrappedKey),
    dekIV: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }

  // 6. Generate zero-knowledge verification data.
  //
  //    SECURITY: We do NOT store hash(masterPassword). Instead we derive a
  //    dedicated Vault Verification Key (VVK) via PBKDF2 (600k iterations,
  //    domain-separated salt) and encrypt a fixed known constant with it.
  //    The AES-GCM auth tag proves password knowledge on unlock without
  //    exposing any password-derived secret to offline brute-force.
  //    An attacker with DB access still must pay the full PBKDF2 cost per guess.
  const vvk = await deriveVerificationKey(masterPassword, salt)
  const verificationIv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const verificationCiphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: verificationIv },
    vvk,
    VAULT_VERIFICATION_CONSTANT
  )

  // 7. Store in database.
  //    DB migration required: add columns verification_ciphertext TEXT and
  //    verification_iv TEXT to user_secure_profiles; drop or stop writing key_check.
  const { error } = await supabase
    .from('user_secure_profiles')
    .upsert({
      id: userId,
      encryption_salt: result.salt,
      wrapped_dek: result.wrappedDEK,
      dek_iv: result.dekIV,
      encryption_version: 1,
      vault_created_at: new Date().toISOString(),
      // Zero-knowledge verification (replaces legacy key_check)
      verification_ciphertext: arrayBufferToBase64(verificationCiphertext),
      verification_iv: arrayBufferToBase64(verificationIv.buffer as ArrayBuffer),
    })

  if (error) {
    throw new Error(`Failed to setup vault: ${error.message}`)
  }

  // 7. Store DEK in IndexedDB for immediate use
  await storeDEK(dek, userId)

  return result
}

/**
 * Unlock vault with master password
 * Fetches salt+wrappedDEK from DB, derives KEK, unwraps DEK, stores in IndexedDB
 */
export async function unlockVault(
  masterPassword: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient()

  // 1. Fetch vault data from database.
  //    .retry(false): disable PostgREST auto-retry (GET requests are retryable by default).
  //    Without this, a timed-out first attempt triggers a retry that runs with an already-
  //    aborted AbortSignal. Playwright route intercept can stall that retry too, extending
  //    the hang beyond QUERY_TIMEOUT_MS. Disabling retries ensures one attempt = one timeout.
  const { data, error } = await supabase
    .from('user_secure_profiles')
    .select('encryption_salt, wrapped_dek, dek_iv, verification_ciphertext, verification_iv')
    .eq('id', userId)
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    .retry(false)
    .single()

  if (error && isQueryTimeout(error)) {
    throw new VaultTimeoutError()
  }

  if (error || !data) {
    throw new Error('Vault not found. Please set up your vault first.')
  }

  // Type guard: ensure data has the expected shape
  if (
    !('encryption_salt' in data) ||
    !('wrapped_dek' in data) ||
    !('dek_iv' in data) ||
    !('verification_ciphertext' in data) ||
    !('verification_iv' in data)
  ) {
    throw new Error('Vault data incomplete. Please contact support.')
  }

  const encryption_salt = data.encryption_salt as string
  const wrapped_dek = data.wrapped_dek as string
  const dek_iv = data.dek_iv as string
  const verification_ciphertext = data.verification_ciphertext as string | null
  const verification_iv = data.verification_iv as string | null

  if (!encryption_salt || !wrapped_dek || !dek_iv) {
    throw new Error('Vault data incomplete. Please contact support.')
  }

  // 2. Derive the shared salt (needed for both verification and KEK derivation).
  const salt = new Uint8Array(base64ToArrayBuffer(encryption_salt))

  // 3. Zero-knowledge password verification.
  //
  //    SECURITY: We do NOT compare hash(masterPassword) against a stored hash.
  //    Instead we re-derive the Vault Verification Key (VVK) from the supplied
  //    password and attempt to decrypt the stored verification ciphertext with
  //    AES-GCM. Because AES-GCM is an authenticated cipher, a wrong password
  //    produces a different VVK → the 128-bit auth tag will not match → the
  //    Web Crypto API throws an error. We catch that error and return false.
  //    A correct password produces the exact same VVK → auth tag validates →
  //    decryption succeeds. The attacker must pay 600,000 PBKDF2 iterations
  //    per guess regardless of which verification scheme is stored in the DB.
  if (verification_ciphertext && verification_iv) {
    try {
      const vvk = await deriveVerificationKey(masterPassword, salt)
      const ivBuffer = new Uint8Array(base64ToArrayBuffer(verification_iv))
      const ciphertextBuffer = base64ToArrayBuffer(verification_ciphertext)
      await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        vvk,
        ciphertextBuffer
      )
      // Reaching here means the GCM auth tag validated — password is correct.
    } catch {
      // GCM auth tag mismatch — wrong password.
      return false
    }
  }
  // If verification fields are null (legacy vaults set up before this migration),
  // we fall through and let the DEK unwrap attempt below act as the gate.
  // Once the user successfully unlocks a legacy vault, the caller should
  // re-call setupVault() or a migration helper to write the verification fields.

  // 4. Derive KEK from password + salt
  const kek = await deriveKEK(masterPassword, salt)

  // 5. Unwrap DEK — if verification_ciphertext was null (legacy vault),
  //    a wrong password will still fail here via AES-KW/AES-GCM auth tag.
  try {
    const wrappedKeyBuffer = base64ToArrayBuffer(wrapped_dek)
    const ivBuffer = new Uint8Array(base64ToArrayBuffer(dek_iv))
    const dek = await unwrapDEK(wrappedKeyBuffer, kek, ivBuffer)

    // 6. Store DEK in IndexedDB
    await storeDEK(dek, userId)

    return true
  } catch (unwrapError) {
    console.error('Failed to unwrap DEK:', unwrapError)
    return false // Wrong password or corrupted data
  }
}

/**
 * Lock vault - clear DEK from IndexedDB
 */
export async function lockVault(): Promise<void> {
  await clearKeys()
}

/**
 * Check if vault is unlocked
 */
export async function isVaultUnlocked(userId?: string): Promise<boolean> {
  const hasDEK = await hasActiveDEK()
  if (!hasDEK) {
    return false
  }

  // If userId provided, verify session is valid for this user
  if (userId) {
    return await isSessionValid(userId)
  }

  return true
}

/**
 * Check if user has a vault set up
 */
export async function hasVault(userId: string): Promise<boolean> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_secure_profiles')
    .select('encryption_salt')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return !!data.encryption_salt
}

/**
 * Change master password
 * Re-wraps DEK with new KEK derived from new password
 */
export async function changeMasterPassword(
  oldPassword: string,
  newPassword: string,
  userId: string
): Promise<VaultSetupResult> {
  const supabase = createClient()

  // 1. Fetch current vault data
  const { data, error } = await supabase
    .from('user_secure_profiles')
    .select('encryption_salt, wrapped_dek, dek_iv')
    .eq('id', userId)
    .single()

  if (error || !data) {
    throw new Error('Vault not found')
  }

  const { encryption_salt, wrapped_dek, dek_iv } = data

  if (!encryption_salt || !wrapped_dek || !dek_iv) {
    throw new Error('Vault data incomplete')
  }

  // 2. Rotate KEK
  const salt = new Uint8Array(base64ToArrayBuffer(encryption_salt))
  const wrappedKeyBuffer = base64ToArrayBuffer(wrapped_dek)
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(dek_iv))

  const { newWrappedKey, newIV, newSalt } = await rotateKEK(
    oldPassword,
    newPassword,
    salt,
    wrappedKeyBuffer,
    ivBuffer
  )

  // 3. Convert to base64
  const result: VaultSetupResult = {
    salt: arrayBufferToBase64(newSalt.buffer as ArrayBuffer),
    wrappedDEK: arrayBufferToBase64(newWrappedKey),
    dekIV: arrayBufferToBase64(newIV.buffer as ArrayBuffer),
  }

  // 4. Generate new zero-knowledge verification data for the new password.
  //
  //    SECURITY: Re-derive VVK from newPassword + newSalt (same domain-separated
  //    derivation as setupVault). The old verification_ciphertext becomes invalid
  //    the moment this update is committed; no SHA-256 hash of any password is
  //    ever stored.
  const newSaltUint8 = new Uint8Array(base64ToArrayBuffer(result.salt))
  const newVvk = await deriveVerificationKey(newPassword, newSaltUint8)
  const newVerificationIv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const newVerificationCiphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: newVerificationIv },
    newVvk,
    VAULT_VERIFICATION_CONSTANT
  )

  // 5. Update database (atomic: new KEK material + new verification data)
  const { error: updateError } = await supabase
    .from('user_secure_profiles')
    .update({
      encryption_salt: result.salt,
      wrapped_dek: result.wrappedDEK,
      dek_iv: result.dekIV,
      // Zero-knowledge verification (replaces legacy key_check)
      verification_ciphertext: arrayBufferToBase64(newVerificationCiphertext),
      verification_iv: arrayBufferToBase64(newVerificationIv.buffer as ArrayBuffer),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    throw new Error(`Failed to update vault: ${updateError.message}`)
  }

  return result
}

/**
 * Encrypt a field using the session DEK
 */
export async function encryptField(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const dek = await getDEK()
  if (!dek) {
    throw new Error('Vault is locked. Please unlock your vault first.')
  }

  const iv = generateIV()
  const crypto = globalThis.crypto

  const encoder = new TextEncoder()
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    dek,
    encoder.encode(plaintext)
  )

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }
}

/**
 * Decrypt a field using the session DEK
 */
export async function decryptField(ciphertext: string, iv: string): Promise<string> {
  const dek = await getDEK()
  if (!dek) {
    throw new Error('Vault is locked. Please unlock your vault first.')
  }

  const crypto = globalThis.crypto
  const decoder = new TextDecoder()

  const ciphertextBuffer = base64ToArrayBuffer(ciphertext)
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv))

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer as Uint8Array<ArrayBuffer> },
    dek,
    ciphertextBuffer
  )

  return decoder.decode(plaintextBuffer)
}

/**
 * Encrypt multiple fields at once
 */
export async function encryptFields(
  fields: Record<string, string>
): Promise<Record<string, { ciphertext: string; iv: string }>> {
  const result: Record<string, { ciphertext: string; iv: string }> = {}

  for (const [key, value] of Object.entries(fields)) {
    if (value) {
      result[key] = await encryptField(value)
    }
  }

  return result
}

/**
 * Decrypt multiple fields at once
 */
export async function decryptFields(
  fields: Record<string, { ciphertext: string; iv: string }>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  for (const [key, { ciphertext, iv }] of Object.entries(fields)) {
    if (ciphertext && iv) {
      result[key] = await decryptField(ciphertext, iv)
    }
  }

  return result
}
