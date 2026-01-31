/**
 * Encryption Utilities
 *
 * Uses native Web Crypto API (SubtleCrypto) - zero external dependencies.
 * Works in browsers, Node.js 18+, Deno, and Edge Functions.
 *
 * Algorithms:
 * - AES-GCM: Authenticated encryption (256-bit)
 * - PBKDF2: Key derivation from passwords
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
 * Generate a random encryption key
 */
export async function generateKey(): Promise<CryptoKey> {
  const crypto = getCrypto()
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  )
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
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
  const crypto = getCrypto()
  const keyData = base64ToArrayBuffer(keyString)
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Derive an encryption key from a password using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
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
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
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
// Utility functions (no dependencies)
// ============================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
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

function base64ToArrayBuffer(base64: string): ArrayBuffer {
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
  return bytes.buffer
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ============================================
// Secure data wrapper for storing encrypted profile data
// ============================================

export interface EncryptedField {
  encrypted: true
  data: string // base64 encrypted data
  version: number // for future algorithm upgrades
}

export interface SecureProfileData {
  ssn?: EncryptedField
  dateOfBirth?: EncryptedField
  income?: EncryptedField
  bankAccount?: EncryptedField
  address?: EncryptedField
  [key: string]: EncryptedField | undefined
}

/**
 * Encrypt a single field value
 */
export async function encryptField(
  value: string,
  key: CryptoKey
): Promise<EncryptedField> {
  return {
    encrypted: true,
    data: await encrypt(value, key),
    version: 1,
  }
}

/**
 * Decrypt a single field value
 */
export async function decryptField(
  field: EncryptedField,
  key: CryptoKey
): Promise<string> {
  if (!field.encrypted) {
    throw new Error('Field is not encrypted')
  }
  return decrypt(field.data, key)
}

/**
 * Encrypt multiple fields in an object
 */
export async function encryptFields<T extends Record<string, string | undefined>>(
  data: T,
  key: CryptoKey,
  fieldsToEncrypt: (keyof T)[]
): Promise<Record<keyof T, string | EncryptedField | undefined>> {
  const result: Record<string, string | EncryptedField | undefined> = { ...data }

  for (const field of fieldsToEncrypt) {
    const value = data[field]
    if (value !== undefined && value !== null && value !== '') {
      result[field as string] = await encryptField(value, key)
    }
  }

  return result as Record<keyof T, string | EncryptedField | undefined>
}
