/**
 * Document Encryption Service
 *
 * Encrypts files client-side before uploading to Supabase Storage.
 * Uses the vault's DEK for encryption (same key used for profile data).
 *
 * Features:
 * - Chunked encryption for large files (>1MB)
 * - Progress callbacks for UI feedback
 * - File validation before encryption
 * - Original filename encryption
 */

import { getDEK } from '@/lib/key-store'
import { generateIV, arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/crypto'
import { validateFileUpload, type FileValidationResult } from '@/lib/security'

const CHUNK_SIZE = 1024 * 1024 // 1MB plaintext chunks for large files
const GCM_TAG_BYTES = 16 // AES-GCM authentication tag appended to each encrypted chunk
const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + GCM_TAG_BYTES // on-disk size per encrypted chunk
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024 // 5MB threshold for chunked processing

export interface EncryptedFileResult {
  encryptedBlob: Blob
  iv: string // Base64 IV
  originalName: string // Original filename
  originalType: string // Original MIME type
  originalSize: number // Original file size in bytes
  encryptedNameIV: string // IV used to encrypt the filename
  encryptedName: string // Encrypted filename (Base64)
}

export interface DocumentEncryptionProgress {
  bytesProcessed: number
  totalBytes: number
  percentage: number
}

/**
 * Validate file before encryption
 */
export function validateDocument(
  file: File,
  options?: {
    maxSizeMB?: number
    allowedTypes?: string[]
    allowedExtensions?: string[]
  }
): FileValidationResult {
  return validateFileUpload(file, options)
}

/**
 * Derive a unique IV for a specific chunk using counter mode
 * Takes a base IV and increments it by the chunk index
 */
function deriveChunkIV(baseIV: Uint8Array, chunkIndex: number): Uint8Array {
  const chunkIV = new Uint8Array(baseIV)

  // Treat the last 4 bytes as a 32-bit counter (little-endian)
  // This gives us 2^32 chunks (~4 billion) before overflow
  const view = new DataView(chunkIV.buffer, chunkIV.byteOffset + 8, 4)
  const currentCounter = view.getUint32(0, true)
  view.setUint32(0, currentCounter + chunkIndex, true)

  return chunkIV
}

/**
 * Encrypt the filename itself (for privacy)
 */
async function encryptFilename(filename: string, dek: CryptoKey): Promise<{ encryptedName: string; iv: string }> {
  const iv = generateIV()
  const encoder = new TextEncoder()

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    dek,
    encoder.encode(filename)
  )

  return {
    encryptedName: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }
}

/**
 * Decrypt filename
 */
async function decryptFilename(encryptedName: string, iv: string, dek: CryptoKey): Promise<string> {
  const decoder = new TextDecoder()
  const ciphertextBuffer = base64ToArrayBuffer(encryptedName)
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv))

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer as Uint8Array<ArrayBuffer> },
    dek,
    ciphertextBuffer
  )

  return decoder.decode(plaintext)
}

/**
 * Encrypt a file in one pass (for files < 5MB)
 */
async function encryptFileSimple(file: File, dek: CryptoKey): Promise<EncryptedFileResult> {
  const iv = generateIV()

  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer()

  // Encrypt the entire file
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    dek,
    fileBuffer
  )

  // Encrypt the filename
  const { encryptedName, iv: encryptedNameIV } = await encryptFilename(file.name, dek)

  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    originalName: file.name,
    originalType: file.type,
    originalSize: file.size,
    encryptedNameIV,
    encryptedName,
  }
}

/**
 * Encrypt a file in chunks (for large files >5MB)
 */
async function encryptFileChunked(
  file: File,
  dek: CryptoKey,
  onProgress?: (progress: DocumentEncryptionProgress) => void
): Promise<EncryptedFileResult> {
  const baseIV = generateIV()
  const encryptedChunks: Uint8Array[] = []
  let bytesProcessed = 0

  // Process file in chunks
  let chunkIndex = 0
  for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE)
    const chunkBuffer = await chunk.arrayBuffer()

    // Generate unique IV for this chunk using counter mode
    const chunkIV = deriveChunkIV(baseIV, chunkIndex)

    // Encrypt chunk with unique IV
    const encryptedChunk = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: chunkIV as Uint8Array<ArrayBuffer> },
      dek,
      chunkBuffer
    )

    encryptedChunks.push(new Uint8Array(encryptedChunk))
    bytesProcessed += chunkBuffer.byteLength
    chunkIndex++

    // Report progress
    if (onProgress) {
      onProgress({
        bytesProcessed,
        totalBytes: file.size,
        percentage: Math.round((bytesProcessed / file.size) * 100),
      })
    }
  }

  // Combine all encrypted chunks
  const totalLength = encryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const combined = new Uint8Array(totalLength)
  let position = 0
  for (const chunk of encryptedChunks) {
    combined.set(chunk, position)
    position += chunk.length
  }

  // Encrypt the filename
  const { encryptedName, iv: encryptedNameIV } = await encryptFilename(file.name, dek)

  return {
    encryptedBlob: new Blob([combined], { type: 'application/octet-stream' }),
    iv: arrayBufferToBase64(baseIV.buffer as ArrayBuffer),
    originalName: file.name,
    originalType: file.type,
    originalSize: file.size,
    encryptedNameIV,
    encryptedName,
  }
}

/**
 * Main encryption function - automatically chooses chunked or simple based on file size
 */
export async function encryptFile(
  file: File,
  onProgress?: (progress: DocumentEncryptionProgress) => void
): Promise<EncryptedFileResult> {
  // Get DEK from session
  const dek = await getDEK()
  if (!dek) {
    throw new Error('Vault is locked. Please unlock your vault first.')
  }

  // Validate file first
  const validation = validateDocument(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file')
  }

  // Choose encryption method based on file size
  if (file.size > LARGE_FILE_THRESHOLD) {
    return encryptFileChunked(file, dek, onProgress)
  } else {
    return encryptFileSimple(file, dek)
  }
}

/**
 * Decrypt a file blob back to original File object
 */
export async function decryptFile(
  encryptedBlob: Blob,
  iv: string,
  encryptedName: string,
  encryptedNameIV: string,
  originalType: string,
  onProgress?: (progress: DocumentEncryptionProgress) => void
): Promise<File> {
  // Get DEK from session
  const dek = await getDEK()
  if (!dek) {
    throw new Error('Vault is locked. Please unlock your vault first.')
  }

  const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv))
  const encryptedBuffer = await encryptedBlob.arrayBuffer()

  // For large files, decrypt in chunks
  if (encryptedBuffer.byteLength > LARGE_FILE_THRESHOLD) {
    return decryptFileChunked(encryptedBlob, ivBuffer, encryptedName, encryptedNameIV, originalType, dek, onProgress)
  }

  // Decrypt the entire file
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer as Uint8Array<ArrayBuffer> },
    dek,
    encryptedBuffer
  )

  // Decrypt the filename
  const originalName = await decryptFilename(encryptedName, encryptedNameIV, dek)

  // Create File object
  return new File([decryptedBuffer], originalName, { type: originalType })
}

/**
 * Decrypt a file in chunks (for large files)
 */
async function decryptFileChunked(
  encryptedBlob: Blob,
  baseIV: Uint8Array,
  encryptedName: string,
  encryptedNameIV: string,
  originalType: string,
  dek: CryptoKey,
  onProgress?: (progress: DocumentEncryptionProgress) => void
): Promise<File> {
  const encryptedBuffer = await encryptedBlob.arrayBuffer()
  const decryptedChunks: Uint8Array[] = []
  let bytesProcessed = 0

  // Process in chunks.
  // Each encrypted chunk is ENCRYPTED_CHUNK_SIZE bytes (CHUNK_SIZE plaintext +
  // GCM_TAG_BYTES auth tag). The decrypt loop must step by ENCRYPTED_CHUNK_SIZE
  // so that slices align with what encryptFileChunked wrote. Stepping by
  // CHUNK_SIZE instead would misalign every chunk after the first, causing
  // AES-GCM auth tag verification to fail for files larger than LARGE_FILE_THRESHOLD.
  let chunkIndex = 0
  for (let offset = 0; offset < encryptedBuffer.byteLength; offset += ENCRYPTED_CHUNK_SIZE) {
    const chunkSize = Math.min(ENCRYPTED_CHUNK_SIZE, encryptedBuffer.byteLength - offset)
    const chunk = encryptedBuffer.slice(offset, offset + chunkSize)

    // Derive the same unique IV that was used for this chunk during encryption
    const chunkIV = deriveChunkIV(baseIV, chunkIndex)

    // Decrypt chunk with matching IV
    const decryptedChunk = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: chunkIV as Uint8Array<ArrayBuffer> },
      dek,
      chunk
    )

    decryptedChunks.push(new Uint8Array(decryptedChunk))
    bytesProcessed += chunkSize
    chunkIndex++

    // Report progress
    if (onProgress) {
      onProgress({
        bytesProcessed,
        totalBytes: encryptedBuffer.byteLength,
        percentage: Math.round((bytesProcessed / encryptedBuffer.byteLength) * 100),
      })
    }
  }

  // Combine all decrypted chunks
  const totalLength = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const combined = new Uint8Array(totalLength)
  let position = 0
  for (const chunk of decryptedChunks) {
    combined.set(chunk, position)
    position += chunk.length
  }

  // Decrypt the filename
  const originalName = await decryptFilename(encryptedName, encryptedNameIV, dek)

  // Create File object
  return new File([combined], originalName, { type: originalType })
}

/**
 * Get encrypted file size estimate.
 * AES-GCM appends GCM_TAG_BYTES (16) bytes of authentication tag per chunk.
 */
export function estimateEncryptedSize(originalSize: number): number {
  const numChunks = Math.ceil(originalSize / CHUNK_SIZE)
  return originalSize + (numChunks * GCM_TAG_BYTES)
}
