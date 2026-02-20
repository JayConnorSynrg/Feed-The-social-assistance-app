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
 * Generate a random DEK (Data Encryption Key)
 * DEK is used to encrypt actual user data
 *
 * SECURITY: extractable is false. WebCrypto's wrapKey() can wrap non-extractable
 * keys — that is a core feature of the API. Setting extractable: false prevents
 * an XSS attacker from calling exportKey() to steal the raw key material.
 */
export async function generateDEK(): Promise<CryptoKey> {
  const crypto = getCrypto()
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: prevents XSS exportKey() exfiltration
    ['encrypt', 'decrypt']
  )
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
  return generateDEK()
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

  // Derive KEK for key wrapping/unwrapping
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
    ['wrapKey', 'unwrapKey']
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
// Key Wrapping/Unwrapping (KEK/DEK Architecture)
// ============================================

/**
 * Wrap a DEK with a KEK for storage
 * Returns the wrapped key and IV used for wrapping
 */
export async function wrapDEK(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<{ wrappedKey: ArrayBuffer; iv: Uint8Array }> {
  const crypto = getCrypto()
  const iv = generateIV()

  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    dek,
    kek,
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> }
  )

  return { wrappedKey, iv }
}

/**
 * Unwrap a DEK using a KEK
 * Restores the DEK from its wrapped form
 *
 * SECURITY: extractable is false. WebCrypto's wrapKey() can wrap non-extractable
 * keys — this is explicitly guaranteed by the W3C WebCrypto specification
 * (https://www.w3.org/TR/WebCryptoAPI/#dfn-SubtleCrypto-method-wrapKey).
 * The DEK does NOT need to be extractable to be re-wrapped during password
 * rotation; rotateKEK() passes the unwrapped DEK directly to wrapDEK(), which
 * calls wrapKey() and works on non-extractable keys. Setting extractable: false
 * here prevents an XSS attacker from obtaining raw DEK bytes via exportKey()
 * even if they gain access to the CryptoKey handle.
 */
export async function unwrapDEK(
  wrappedKey: ArrayBuffer,
  kek: CryptoKey,
  iv: Uint8Array
): Promise<CryptoKey> {
  const crypto = getCrypto()

  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    kek,
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: wrapKey() works on non-extractable keys per WebCrypto spec
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
 * Rotate KEK - re-encrypt DEK with new password
 * Used when user changes their master password
 */
export async function rotateKEK(
  oldPassword: string,
  newPassword: string,
  salt: Uint8Array,
  wrappedDEK: ArrayBuffer,
  iv: Uint8Array
): Promise<{ newWrappedKey: ArrayBuffer; newIV: Uint8Array; newSalt: Uint8Array }> {
  // 1. Derive old KEK and unwrap DEK
  const oldKEK = await deriveKEK(oldPassword, salt)
  const dek = await unwrapDEK(wrappedDEK, oldKEK, iv)

  // 2. Generate new salt and derive new KEK
  const newSalt = generateSalt()
  const newKEK = await deriveKEK(newPassword, newSalt)

  // 3. Wrap DEK with new KEK
  const { wrappedKey: newWrappedKey, iv: newIV } = await wrapDEK(dek, newKEK)

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
