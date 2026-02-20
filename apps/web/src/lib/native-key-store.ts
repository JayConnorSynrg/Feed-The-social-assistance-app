/**
 * Native Key Store Adapter
 *
 * Wraps Capacitor secure storage plugin for native platforms (iOS Keychain + Android KeyStore).
 * Stores DEK bytes (exported from CryptoKey) as base64 strings in native secure storage.
 *
 * Architecture:
 * - Web: CryptoKey stored directly in IndexedDB (non-extractable)
 * - Native: CryptoKey exported to raw bytes → base64 → secure storage → re-imported on retrieval
 *
 * NOTE: Uses capacitor-secure-storage-plugin for Capacitor 6 compatibility.
 * When upgrading to Capacitor 8+, migrate to @aparajita/capacitor-secure-storage.
 */

import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/crypto'

const STORAGE_KEYS = {
  DEK: 'feed_dek_bytes',
  METADATA_USER_ID: 'feed_metadata_userId',
  METADATA_TIMESTAMP: 'feed_metadata_timestamp',
  METADATA_VERSION: 'feed_metadata_version',
} as const

interface SessionMetadata {
  userId: string
  timestamp: number
  version: number
}

/**
 * Store DEK bytes in native secure storage
 * @param dekBytes - Base64-encoded DEK bytes (from crypto.subtle.exportKey)
 */
export async function storeDEKNative(dekBytes: string, userId: string): Promise<void> {
  try {
    // Store DEK bytes
    await SecureStoragePlugin.set({
      key: STORAGE_KEYS.DEK,
      value: dekBytes,
    })

    // Store metadata
    const metadata: SessionMetadata = {
      userId,
      timestamp: Date.now(),
      version: 1,
    }

    await SecureStoragePlugin.set({
      key: STORAGE_KEYS.METADATA_USER_ID,
      value: metadata.userId,
    })
    await SecureStoragePlugin.set({
      key: STORAGE_KEYS.METADATA_TIMESTAMP,
      value: metadata.timestamp.toString(),
    })
    await SecureStoragePlugin.set({
      key: STORAGE_KEYS.METADATA_VERSION,
      value: metadata.version.toString(),
    })
  } catch (error) {
    console.error('Error storing DEK in native secure storage:', error)
    throw new Error('Failed to store encryption key in secure storage')
  }
}

/**
 * Retrieve DEK bytes from native secure storage
 * @returns Base64-encoded DEK bytes or null if not found
 */
export async function getDEKNative(): Promise<string | null> {
  try {
    const result = await SecureStoragePlugin.get({ key: STORAGE_KEYS.DEK })
    return result.value || null
  } catch (error) {
    // Key doesn't exist or other error
    console.error('Error retrieving DEK from native secure storage:', error)
    return null
  }
}

/**
 * Get session metadata from native secure storage
 */
export async function getSessionMetadataNative(): Promise<SessionMetadata | null> {
  try {
    const userId = await SecureStoragePlugin.get({ key: STORAGE_KEYS.METADATA_USER_ID })
    const timestamp = await SecureStoragePlugin.get({ key: STORAGE_KEYS.METADATA_TIMESTAMP })
    const version = await SecureStoragePlugin.get({ key: STORAGE_KEYS.METADATA_VERSION })

    if (!userId.value || !timestamp.value || !version.value) {
      return null
    }

    return {
      userId: userId.value,
      timestamp: parseInt(timestamp.value, 10),
      version: parseInt(version.value, 10),
    }
  } catch (error) {
    console.error('Error retrieving session metadata from native secure storage:', error)
    return null
  }
}

/**
 * Update session timestamp (keep session alive)
 */
export async function updateSessionTimestampNative(): Promise<void> {
  try {
    await SecureStoragePlugin.set({
      key: STORAGE_KEYS.METADATA_TIMESTAMP,
      value: Date.now().toString(),
    })
  } catch (error) {
    console.error('Error updating session timestamp in native secure storage:', error)
  }
}

/**
 * Clear all keys from native secure storage (logout)
 */
export async function clearKeysNative(): Promise<void> {
  try {
    // Remove all keys
    await Promise.allSettled([
      SecureStoragePlugin.remove({ key: STORAGE_KEYS.DEK }),
      SecureStoragePlugin.remove({ key: STORAGE_KEYS.METADATA_USER_ID }),
      SecureStoragePlugin.remove({ key: STORAGE_KEYS.METADATA_TIMESTAMP }),
      SecureStoragePlugin.remove({ key: STORAGE_KEYS.METADATA_VERSION }),
    ])
  } catch (error) {
    console.error('Error clearing keys from native secure storage:', error)
  }
}

/**
 * Check if DEK exists in native secure storage
 */
export async function hasActiveDEKNative(): Promise<boolean> {
  const dekBytes = await getDEKNative()
  return dekBytes !== null
}

/**
 * Export CryptoKey to base64 string for storage in native secure storage
 */
export async function exportDEKToBase64(dek: CryptoKey): Promise<string> {
  try {
    // Export CryptoKey to raw bytes
    const rawBytes = await crypto.subtle.exportKey('raw', dek)
    // Convert to base64
    return arrayBufferToBase64(rawBytes)
  } catch (error) {
    console.error('Error exporting DEK to base64:', error)
    throw new Error('Failed to export encryption key')
  }
}

/**
 * Import CryptoKey from base64 string (retrieved from native secure storage)
 */
export async function importDEKFromBase64(base64Bytes: string): Promise<CryptoKey> {
  try {
    // Convert base64 to ArrayBuffer
    const rawBytes = base64ToArrayBuffer(base64Bytes)

    // Import as CryptoKey (AES-GCM, 256-bit)
    const dek = await crypto.subtle.importKey(
      'raw',
      rawBytes,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable (for security)
      ['encrypt', 'decrypt']
    )

    return dek
  } catch (error) {
    console.error('Error importing DEK from base64:', error)
    throw new Error('Failed to import encryption key')
  }
}

/**
 * Check if session is valid for the given user (native storage)
 */
export async function isSessionValidNative(userId: string): Promise<boolean> {
  const metadata = await getSessionMetadataNative()
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
    await clearKeysNative()
    return false
  }

  return true
}
