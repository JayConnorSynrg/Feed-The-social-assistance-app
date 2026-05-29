/**
 * Encryption Utilities - Zero-Knowledge Key Management
 *
 * Uses native Web Crypto API (SubtleCrypto) - zero external dependencies.
 * Works in browsers, Node.js 18+, Deno, and Edge Functions.
 *
 * Key Hierarchy:
 * - Master Password → (PBKDF2 600k iterations) → KEK (Key Encryption Key)
 * - KEK wraps/unwraps → DEK (Data Encryption Key)
 * - DEK encrypts/decrypts → User's sensitive data
 *
 * Algorithms:
 * - AES-GCM: Authenticated encryption (256-bit)
 * - AES-KW: Key wrapping for DEK
 * - PBKDF2: Key derivation from passwords (600k iterations)
 * - SHA-256: Hashing
 */

// Check for crypto availability
const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto
  }
  throw new Error('Web Crypto API not available')
}

/**
 * Generate a random DEK (Data Encryption Key).
 * Returns both the raw 32-byte key material and a non-extractable CryptoKey.
 *
 * SECURITY: The in-use CryptoKey (key) is always non-extractable, preventing
 * an XSS attacker from calling exportKey() to steal raw key material.
 * The raw bytes are only retained long enough to be AES-GCM-wrapped with the KEK
 * (envelope pattern — see wrapDEK). They must not be persisted in JS memory
 * beyond the wrapDEK call in vault setup / KEK rotation.
 */
export async function generateDEK(): Promise<{ key: CryptoKey; rawBytes: Uint8Array }> {
  const crypto = getCrypto()
  const rawBytes = crypto.getRandomValues(new Uint8Array(32))
  const key = await crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: prevents XSS exportKey() exfiltration
    ['encrypt', 'decrypt']
  )
  return { key, rawBytes }
}

/**
 * Generate a DEK that can be exported to raw bytes for native secure storage.
 *
 * SECURITY NOTE — MOBILE PLATFORM LIMITATION:
 * iOS Keychain and Android KeyStore are managed by the OS, not the browser's
 * WebCrypto key store. To persist a key across app restarts, the Capacitor
 * secure storage plugin requires raw bytes. This means the key must briefly
 * exist as an exportable CryptoKey in JS memory during the export, before
 * being handed to the OS. This is an accepted limitation of the Capacitor
 * bridge architecture; the exposure window is minimised by immediately calling
 * exportDEKToBase64() → storeDEKNative() and not retaining the CryptoKey
 * reference beyond that call.
 *
 * DO NOT use this function on web — use generateDEK() instead.
 */
export async function generateExtractableDEK(): Promise<CryptoKey> {
  const crypto = getCrypto()
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable: required for native Keychain/KeyStore export via Capacitor
    ['encrypt', 'decrypt']
  )
}

/**
 * Legacy function - kept for backwards compatibility
 * Use generateDEK for new implementations
 */
export async function generateKey(): Promise<CryptoKey> {
  const { key } = await generateDEK()
  return key
}

/**
 * Export a CryptoKey to base64 string for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const crypto = getCrypto()
  const exported = await crypto.subtle.exportKey('raw', key)
  return arrayBufferToBase64(exported)
}

/**
 * Import a base64 key string back to CryptoKey
 *
 * SECURITY: extractable is false. The key material already lived as a base64
 * string (legacy storage format). Re-importing as non-extractable ensures it
 * cannot be re-exported from the CryptoKey handle by XSS code after import.
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
  const crypto = getCrypto()
  const keyData = base64ToArrayBuffer(keyString)
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: prevents XSS exportKey() exfiltration post-import
    ['encrypt', 'decrypt']
  )
}

/**
 * Derive a KEK (Key Encryption Key) from a master password using PBKDF2
 * Uses 600k iterations for enhanced security (FIPS compliant)
 */
export async function deriveKEK(
  masterPassword: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  // Derive KEK for DEK envelope encryption/decryption.
  // Usages are encrypt/decrypt because the envelope pattern uses AES-GCM
  // crypto.subtle.encrypt/decrypt to wrap/unwrap the raw DEK bytes rather
  // than the wrapKey/unwrapKey API (which requires the wrapped key to be
  // extractable, conflicting with our XSS-safe non-extractable DEK design).
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 600000, // Increased from 100k for better security
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  )
}

/**
 * Legacy function - kept for backwards compatibility
 * Use deriveKEK for new implementations
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 600000
): Promise<CryptoKey> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  // Derive AES key
  // SECURITY: extractable is false — derived keys must not be exportable.
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: prevents XSS exportKey() exfiltration
    ['encrypt', 'decrypt']
  )
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(length: number = 16): Uint8Array {
  const crypto = getCrypto()
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Generate a random initialization vector (IV) for AES-GCM
 */
export function generateIV(): Uint8Array {
  const crypto = getCrypto()
  return crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM
}

/**
 * Encrypt data using AES-GCM
 * Returns: base64 string containing IV + ciphertext
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<string> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()
  const iv = generateIV()

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    key,
    encoder.encode(data)
  )

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)

  return arrayBufferToBase64(combined.buffer as ArrayBuffer)
}

/**
 * Decrypt data using AES-GCM
 * Expects: base64 string containing IV + ciphertext
 */
export async function decrypt(
  encryptedData: string,
  key: CryptoKey
): Promise<string> {
  const crypto = getCrypto()
  const decoder = new TextDecoder()

  const combined = new Uint8Array(base64ToArrayBuffer(encryptedData))

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    key,
    ciphertext
  )

  return decoder.decode(decrypted)
}

/**
 * Encrypt with password (convenience function)
 * Returns: base64 string containing salt + IV + ciphertext
 */
export async function encryptWithPassword(
  data: string,
  password: string
): Promise<string> {
  const salt = generateSalt()
  const key = await deriveKeyFromPassword(password, salt)

  const crypto = getCrypto()
  const encoder = new TextEncoder()
  const iv = generateIV()

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    key,
    encoder.encode(data)
  )

  // Combine: salt (16) + iv (12) + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)

  return arrayBufferToBase64(combined.buffer as ArrayBuffer)
}

/**
 * Decrypt with password (convenience function)
 */
export async function decryptWithPassword(
  encryptedData: string,
  password: string
): Promise<string> {
  const crypto = getCrypto()
  const decoder = new TextDecoder()

  const combined = new Uint8Array(base64ToArrayBuffer(encryptedData))

  // Extract: salt (16) + iv (12) + ciphertext
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const ciphertext = combined.slice(28)

  const key = await deriveKeyFromPassword(password, salt)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    key,
    ciphertext
  )

  return decoder.decode(decrypted)
}

/**
 * Hash data using SHA-256
 */
export async function hash(data: string): Promise<string> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return arrayBufferToBase64(hashBuffer)
}

/**
 * Hash data to hex string (common format)
 */
export async function hashToHex(data: string): Promise<string> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return arrayBufferToHex(hashBuffer)
}

/**
 * Encrypt an object (serializes to JSON first)
 */
export async function encryptObject<T>(
  obj: T,
  key: CryptoKey
): Promise<string> {
  const json = JSON.stringify(obj)
  return encrypt(json, key)
}

/**
 * Decrypt to an object
 */
export async function decryptObject<T>(
  encryptedData: string,
  key: CryptoKey
): Promise<T> {
  const json = await decrypt(encryptedData, key)
  return JSON.parse(json) as T
}

// ============================================
// Key Wrapping/Unwrapping (KEK/DEK Envelope Pattern)
// ============================================

/**
 * Wrap DEK raw bytes with a KEK using AES-GCM (envelope encryption).
 *
 * SECURITY DESIGN — why envelope instead of wrapKey('raw'/'jwk'):
 * The WebCrypto wrapKey() API with 'raw' or 'jwk' format requires the wrapped
 * key to have extractable:true, which would allow XSS code to call exportKey()
 * and exfiltrate the raw DEK material. The envelope pattern avoids this: we
 * treat the 32 raw DEK bytes as arbitrary plaintext, AES-GCM-encrypt them with
 * the KEK, and store only the ciphertext+IV. The in-use CryptoKey (created by
 * generateDEK() or unwrapDEK()) remains non-extractable at all times.
 *
 * @param dekRawBytes - The 32 raw DEK bytes returned by generateDEK().rawBytes.
 * @param kek         - The non-extractable AES-GCM KEK derived by deriveKEK().
 * @returns wrappedKey (48 bytes: 32-byte DEK ciphertext + 16-byte GCM tag) and iv.
 */
export async function wrapDEK(
  dekRawBytes: Uint8Array,
  kek: CryptoKey
): Promise<{ wrappedKey: ArrayBuffer; iv: Uint8Array }> {
  const crypto = getCrypto()
  const iv = generateIV()

  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    kek,
    dekRawBytes as Uint8Array<ArrayBuffer>
  )

  return { wrappedKey, iv }
}

/**
 * Unwrap a DEK from its AES-GCM-encrypted form (envelope decryption).
 * Returns a non-extractable CryptoKey ready for encrypt/decrypt use.
 *
 * SECURITY: The restored CryptoKey is always non-extractable, preventing
 * XSS code from obtaining raw DEK bytes via exportKey() after unwrapping.
 *
 * @param wrappedKey - The 48-byte ciphertext produced by wrapDEK().
 * @param kek        - The non-extractable AES-GCM KEK derived by deriveKEK().
 * @param iv         - The 12-byte IV returned by wrapDEK().
 * @returns A non-extractable AES-GCM-256 CryptoKey.
 */
export async function unwrapDEK(
  wrappedKey: ArrayBuffer,
  kek: CryptoKey,
  iv: Uint8Array
): Promise<CryptoKey> {
  const crypto = getCrypto()

  // Decrypt the envelope to recover the raw DEK bytes.
  const dekRawBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    kek,
    wrappedKey
  )

  // Import as non-extractable CryptoKey for use.
  return crypto.subtle.importKey(
    'raw',
    dekRawBytes,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: prevents XSS exportKey() exfiltration
    ['encrypt', 'decrypt']
  )
}

// ============================================
// Zero-Knowledge Verification Key Derivation
// ============================================

/**
 * ZERO-KNOWLEDGE VERIFICATION DESIGN
 *
 * Problem with SHA-256 key_check: storing hash(masterPassword) in the database
 * allows an attacker with DB access to brute-force the master password at
 * billions of hashes per second, completely bypassing the 600,000-iteration
 * PBKDF2 investment and destroying the encryption safe harbor.
 *
 * Solution: Derive a separate AES-GCM key (the "VVK" — Vault Verification Key)
 * from the same master password + salt using the same PBKDF2 parameters as
 * deriveKEK. A domain-separation suffix ("_verify") is appended to the salt
 * bytes before derivation, ensuring the VVK is cryptographically independent
 * from the KEK even though both share the same password input.
 *
 * The VVK is used solely to encrypt a fixed known constant
 * ("FEED_VAULT_VERIFY_v1"). The AES-GCM ciphertext + IV are stored in the
 * database instead of key_check. On unlock, we attempt to decrypt with a freshly
 * derived VVK — AES-GCM authentication tag verification acts as the password
 * check. A wrong password produces a different VVK → auth tag mismatch →
 * decryption throws → we return false. The plaintext of the constant is never
 * secret; only the ability to authenticate the GCM tag proves knowledge of the
 * correct password, and that ability still requires defeating 600,000 PBKDF2
 * iterations.
 */

/** Fixed plaintext that the VVK encrypts for zero-knowledge verification. */
export const VAULT_VERIFICATION_CONSTANT = new TextEncoder().encode('FEED_VAULT_VERIFY_v1')

/**
 * Derive a Vault Verification Key (VVK) from the master password.
 *
 * Uses the same PBKDF2 parameters as deriveKEK but with a domain-separated
 * salt (original salt bytes + UTF-8 "_verify" suffix) and encrypt/decrypt
 * usages rather than wrapKey/unwrapKey. This guarantees the VVK is
 * cryptographically independent from the KEK.
 *
 * @param masterPassword - The user's master password.
 * @param salt           - The same random salt stored with the vault (from generateSalt()).
 * @returns              A non-extractable AES-GCM-256 CryptoKey for encrypt/decrypt.
 */
export async function deriveVerificationKey(
  masterPassword: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()

  // Domain-separated salt: original salt bytes || "_verify"
  const suffix = encoder.encode('_verify')
  const domainSalt = new Uint8Array(salt.length + suffix.length)
  domainSalt.set(salt)
  domainSalt.set(suffix, salt.length)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: domainSalt.buffer as ArrayBuffer,
      iterations: 600000, // Matches KEK derivation — attacker must pay full cost
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  )
}

/**
 * Rotate KEK — re-encrypt DEK envelope with a new password.
 * Used when the user changes their master password.
 *
 * The raw DEK bytes are decrypted from the old envelope, re-encrypted into a
 * new envelope under the new KEK, and immediately discarded. The in-memory
 * exposure window of the raw bytes is confined to this function's stack frame.
 */
export async function rotateKEK(
  oldPassword: string,
  newPassword: string,
  salt: Uint8Array,
  wrappedDEK: ArrayBuffer,
  iv: Uint8Array
): Promise<{ newWrappedKey: ArrayBuffer; newIV: Uint8Array; newSalt: Uint8Array }> {
  const crypto = getCrypto()

  // 1. Derive old KEK and decrypt envelope to recover raw DEK bytes.
  const oldKEK = await deriveKEK(oldPassword, salt)
  const dekRawBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    oldKEK,
    wrappedDEK
  )

  // 2. Generate new salt and derive new KEK.
  const newSalt = generateSalt()
  const newKEK = await deriveKEK(newPassword, newSalt)

  // 3. Re-encrypt raw DEK bytes under new KEK.
  const { wrappedKey: newWrappedKey, iv: newIV } = await wrapDEK(new Uint8Array(dekRawBytes), newKEK)

  return { newWrappedKey, newIV, newSalt }
}

// ============================================
// Utility functions (no dependencies)
// ============================================

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  // Use btoa in browser, Buffer in Node
  if (typeof btoa === 'function') {
    return btoa(binary)
  }
  return Buffer.from(binary, 'binary').toString('base64')
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Use atob in browser, Buffer in Node
  let binary: string
  if (typeof atob === 'function') {
    binary = atob(base64)
  } else {
    binary = Buffer.from(base64, 'base64').toString('binary')
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
