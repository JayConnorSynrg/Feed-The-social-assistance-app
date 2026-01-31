/**
 * Secure Profile Storage
 *
 * Manages encrypted storage of sensitive profile data.
 * Uses Web Crypto API for encryption - zero external dependencies.
 *
 * Architecture:
 * - Encryption key derived from user's password + server salt
 * - Key is stored in memory only (never persisted)
 * - Encrypted data stored in Supabase
 * - User must re-authenticate to decrypt
 */

import {
  generateKey,
  exportKey,
  importKey,
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  hash,
  encryptWithPassword,
  decryptWithPassword,
} from '@/lib/crypto'

// Sensitive fields that should be encrypted
export const SENSITIVE_FIELDS = [
  'ssn',
  'date_of_birth',
  'income',
  'bank_account',
  'bank_routing',
  'drivers_license',
  'passport_number',
  'immigration_status',
  'medical_conditions',
  'medications',
  'employer_ein',
] as const

export type SensitiveField = (typeof SENSITIVE_FIELDS)[number]

export interface SecureProfileData {
  // Personal identifiers
  ssn?: string
  date_of_birth?: string
  drivers_license?: string
  passport_number?: string

  // Financial
  income?: string
  bank_account?: string
  bank_routing?: string
  employer_ein?: string

  // Immigration
  immigration_status?: string

  // Medical
  medical_conditions?: string
  medications?: string

  // Additional encrypted fields
  [key: string]: string | undefined
}

export interface EncryptedProfile {
  user_id: string
  encrypted_data: string // Base64 encrypted JSON
  key_check: string // Hash to verify correct key
  version: number
  updated_at: string
}

// In-memory key storage (cleared on page refresh)
let cachedKey: CryptoKey | null = null
let cachedUserId: string | null = null

/**
 * Generate a new encryption key for the user
 */
export async function createUserKey(): Promise<{ key: CryptoKey; exportedKey: string }> {
  const key = await generateKey()
  const exportedKey = await exportKey(key)
  return { key, exportedKey }
}

/**
 * Store the encryption key in memory (call after user authenticates)
 */
export function setUserKey(key: CryptoKey, userId: string): void {
  cachedKey = key
  cachedUserId = userId
}

/**
 * Import and cache a key from stored format
 */
export async function importAndCacheKey(exportedKey: string, userId: string): Promise<CryptoKey> {
  const key = await importKey(exportedKey)
  setUserKey(key, userId)
  return key
}

/**
 * Get the cached key (returns null if not set)
 */
export function getCachedKey(): CryptoKey | null {
  return cachedKey
}

/**
 * Clear the cached key (call on logout)
 */
export function clearUserKey(): void {
  cachedKey = null
  cachedUserId = null
}

/**
 * Check if user has a cached key
 */
export function hasKey(): boolean {
  return cachedKey !== null
}

/**
 * Create a key verification hash
 * Used to verify the correct key is being used without storing the key
 */
export async function createKeyCheck(key: CryptoKey): Promise<string> {
  const exported = await exportKey(key)
  return hash(exported + 'FEED_KEY_CHECK')
}

/**
 * Verify a key matches the stored key check
 */
export async function verifyKey(key: CryptoKey, storedKeyCheck: string): Promise<boolean> {
  const check = await createKeyCheck(key)
  return check === storedKeyCheck
}

/**
 * Encrypt profile data
 */
export async function encryptProfile(
  data: SecureProfileData,
  key?: CryptoKey
): Promise<string> {
  const encryptionKey = key || cachedKey
  if (!encryptionKey) {
    throw new Error('No encryption key available')
  }
  return encryptObject(data, encryptionKey)
}

/**
 * Decrypt profile data
 */
export async function decryptProfile(
  encryptedData: string,
  key?: CryptoKey
): Promise<SecureProfileData> {
  const encryptionKey = key || cachedKey
  if (!encryptionKey) {
    throw new Error('No encryption key available')
  }
  return decryptObject<SecureProfileData>(encryptedData, encryptionKey)
}

/**
 * Encrypt a single field
 */
export async function encryptField(
  value: string,
  key?: CryptoKey
): Promise<string> {
  const encryptionKey = key || cachedKey
  if (!encryptionKey) {
    throw new Error('No encryption key available')
  }
  return encrypt(value, encryptionKey)
}

/**
 * Decrypt a single field
 */
export async function decryptField(
  encryptedValue: string,
  key?: CryptoKey
): Promise<string> {
  const encryptionKey = key || cachedKey
  if (!encryptionKey) {
    throw new Error('No encryption key available')
  }
  return decrypt(encryptedValue, encryptionKey)
}

/**
 * Check if a field name is sensitive
 */
export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_FIELDS.includes(fieldName as SensitiveField)
}

/**
 * Filter object to only sensitive fields
 */
export function extractSensitiveFields(
  data: Record<string, unknown>
): SecureProfileData {
  const sensitive: SecureProfileData = {}
  for (const field of SENSITIVE_FIELDS) {
    if (data[field] !== undefined && data[field] !== null) {
      sensitive[field] = String(data[field])
    }
  }
  return sensitive
}

/**
 * Merge decrypted sensitive data with non-sensitive data
 */
export function mergeProfileData<T extends Record<string, unknown>>(
  publicData: T,
  sensitiveData: SecureProfileData
): T & SecureProfileData {
  return { ...publicData, ...sensitiveData }
}

// ============================================
// Secure storage in browser (for key backup)
// Uses sessionStorage (cleared when tab closes)
// ============================================

const KEY_STORAGE_KEY = 'feed_secure_key'

/**
 * Store encrypted key backup in session storage
 * Key is encrypted with a user-provided passphrase
 */
export async function backupKeyToSession(
  key: CryptoKey,
  passphrase: string
): Promise<void> {
  const exported = await exportKey(key)
  const encrypted = await encryptWithPassword(exported, passphrase)

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(KEY_STORAGE_KEY, encrypted)
  }
}

/**
 * Restore key from session storage using passphrase
 */
export async function restoreKeyFromSession(
  passphrase: string
): Promise<CryptoKey | null> {
  if (typeof sessionStorage === 'undefined') {
    return null
  }

  const encrypted = sessionStorage.getItem(KEY_STORAGE_KEY)
  if (!encrypted) {
    return null
  }

  try {
    const exported = await decryptWithPassword(encrypted, passphrase)
    return importKey(exported)
  } catch {
    return null // Wrong passphrase or corrupted data
  }
}

/**
 * Clear key backup from session storage
 */
export function clearKeyBackup(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(KEY_STORAGE_KEY)
  }
}
