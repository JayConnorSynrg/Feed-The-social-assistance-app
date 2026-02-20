/**
 * Unified Key Store
 *
 * Platform-aware key storage that uses:
 * - Web: IndexedDB (CryptoKey objects stored directly)
 * - iOS/Android: Native secure storage (iOS Keychain + Android KeyStore)
 *
 * Architecture:
 * - Web: DEK stored as non-extractable CryptoKey in IndexedDB
 * - Native: DEK exported to raw bytes → base64 → secure storage → re-imported on retrieval
 * - Keys cleared on logout across all platforms
 * - Session persistence across page refreshes (web) and app restarts (native)
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import { isNativePlatform, isBrowser } from '@/lib/platform'
import {
  storeDEKNative,
  getDEKNative,
  clearKeysNative,
  hasActiveDEKNative,
  isSessionValidNative,
  getSessionMetadataNative,
  updateSessionTimestampNative,
  exportDEKToBase64,
  importDEKFromBase64,
} from '@/lib/native-key-store'

interface CryptoKeysDB extends DBSchema {
  keys: {
    key: string
    value: CryptoKey
  }
  metadata: {
    key: string
    value: {
      userId: string
      timestamp: number
      version: number
    }
  }
}

const DB_NAME = 'feed-crypto-keys'
const DB_VERSION = 1
const KEYS_STORE = 'keys'
const METADATA_STORE = 'metadata'
const DEK_KEY_NAME = 'dek'
const METADATA_KEY_NAME = 'session-metadata'

let dbInstance: IDBPDatabase<CryptoKeysDB> | null = null

/**
 * Initialize the IndexedDB database (web only)
 */
async function getDB(): Promise<IDBPDatabase<CryptoKeysDB>> {
  // Only initialize IndexedDB on web platform
  if (!isBrowser() || isNativePlatform()) {
    throw new Error('IndexedDB is only available on web platform')
  }

  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<CryptoKeysDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE)
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE)
      }
    },
  })

  return dbInstance
}

/**
 * Store the unwrapped DEK for the session (platform-aware)
 */
export async function storeDEK(dek: CryptoKey, userId: string): Promise<void> {
  // Native platform: export to base64 and store in secure storage
  if (isNativePlatform()) {
    const dekBytes = await exportDEKToBase64(dek)
    await storeDEKNative(dekBytes, userId)
    return
  }

  // Web platform: store CryptoKey directly in IndexedDB
  const db = await getDB()

  // Store the DEK
  await db.put(KEYS_STORE, dek, DEK_KEY_NAME)

  // Store metadata
  await db.put(METADATA_STORE, {
    userId,
    timestamp: Date.now(),
    version: 1,
  }, METADATA_KEY_NAME)
}

/**
 * Retrieve the session DEK (platform-aware)
 */
export async function getDEK(): Promise<CryptoKey | null> {
  try {
    // Native platform: retrieve base64 bytes and import as CryptoKey
    if (isNativePlatform()) {
      const dekBytes = await getDEKNative()
      if (!dekBytes) {
        return null
      }
      return await importDEKFromBase64(dekBytes)
    }

    // Web platform: retrieve CryptoKey directly from IndexedDB
    const db = await getDB()
    const dek = await db.get(KEYS_STORE, DEK_KEY_NAME)
    return dek || null
  } catch (error) {
    console.error('Error retrieving DEK:', error)
    return null
  }
}

/**
 * Get session metadata (platform-aware)
 */
export async function getSessionMetadata(): Promise<{
  userId: string
  timestamp: number
  version: number
} | null> {
  try {
    // Native platform: retrieve from secure storage
    if (isNativePlatform()) {
      return await getSessionMetadataNative()
    }

    // Web platform: retrieve from IndexedDB
    const db = await getDB()
    const metadata = await db.get(METADATA_STORE, METADATA_KEY_NAME)
    return metadata || null
  } catch (error) {
    console.error('Error retrieving session metadata:', error)
    return null
  }
}

/**
 * Clear all keys (logout) - platform-aware
 */
export async function clearKeys(): Promise<void> {
  try {
    // Native platform: clear from secure storage
    if (isNativePlatform()) {
      await clearKeysNative()
      return
    }

    // Web platform: clear from IndexedDB
    const db = await getDB()
    await db.clear(KEYS_STORE)
    await db.clear(METADATA_STORE)
  } catch (error) {
    console.error('Error clearing keys:', error)
  }
}

/**
 * Check if DEK is available (user has unlocked vault) - platform-aware
 */
export async function hasActiveDEK(): Promise<boolean> {
  // Native platform: check secure storage
  if (isNativePlatform()) {
    return await hasActiveDEKNative()
  }

  // Web platform: check IndexedDB
  const dek = await getDEK()
  return dek !== null
}

/**
 * Check if session is valid for the given user (platform-aware)
 */
export async function isSessionValid(userId: string): Promise<boolean> {
  // Native platform: use native session validation
  if (isNativePlatform()) {
    return await isSessionValidNative(userId)
  }

  // Web platform: check IndexedDB metadata
  const metadata = await getSessionMetadata()
  if (!metadata) {
    return false
  }

  // Check if userId matches
  if (metadata.userId !== userId) {
    return false
  }

  // Check if session is not too old (24 hours)
  const MAX_SESSION_AGE = 24 * 60 * 60 * 1000 // 24 hours
  const age = Date.now() - metadata.timestamp
  if (age > MAX_SESSION_AGE) {
    await clearKeys()
    return false
  }

  return true
}

/**
 * Update session timestamp (keep session alive) - platform-aware
 */
export async function updateSessionTimestamp(): Promise<void> {
  // Native platform: update in secure storage
  if (isNativePlatform()) {
    await updateSessionTimestampNative()
    return
  }

  // Web platform: update in IndexedDB
  const metadata = await getSessionMetadata()
  if (!metadata) {
    return
  }

  const db = await getDB()
  await db.put(METADATA_STORE, {
    ...metadata,
    timestamp: Date.now(),
  }, METADATA_KEY_NAME)
}
