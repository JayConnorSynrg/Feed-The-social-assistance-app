# Secure Storage Implementation

## Overview

FEED uses a platform-aware key storage system that automatically selects the most secure storage backend based on the runtime environment:

- **Web**: IndexedDB (CryptoKey objects stored directly, non-extractable)
- **iOS**: Native Keychain (via `capacitor-secure-storage-plugin`)
- **Android**: Native KeyStore (via `capacitor-secure-storage-plugin`)

## Architecture

### Key Hierarchy

```
Master Password
    ↓ PBKDF2 (600k iterations)
KEK (Key Encryption Key)
    ↓ AES-KW wrap/unwrap
DEK (Data Encryption Key) ← Stored in platform-specific secure storage
    ↓ AES-GCM encrypt/decrypt
User's Sensitive Data
```

### Platform Detection Flow

```typescript
import { getPlatform, isNativePlatform } from '@/lib/platform'

const platform = getPlatform() // 'web' | 'ios' | 'android'
const isNative = isNativePlatform() // boolean
```

### Storage Layer Selection

```
┌─────────────────┐
│  Application    │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Vault   │ (lib/vault.ts)
    └────┬────┘
         │
    ┌────▼────────┐
    │ Key Store   │ (lib/key-store.ts) ← Unified interface
    └────┬────────┘
         │
    ┌────▼─────────────────────┐
    │ Platform Detection       │
    └────┬────────────────┬────┘
         │                │
    ┌────▼─────┐     ┌────▼────────┐
    │ IndexedDB│     │ Native Store│ (lib/native-key-store.ts)
    │ (Web)    │     │ (iOS/Android)│
    └──────────┘     └─────────────┘
         │                │
         │                ▼
         │         ┌─────────────────┐
         │         │ SecureStorage   │
         │         │ Plugin          │
         │         └────┬────────────┘
         │              │
         ▼              ▼
    ┌──────────────────────────┐
    │   iOS Keychain           │
    │   Android EncryptedSP    │
    └──────────────────────────┘
```

## Files and Responsibilities

### Core Files

| File | Purpose |
|------|---------|
| `lib/platform.ts` | Platform detection utilities |
| `lib/key-store.ts` | Unified key storage interface (platform-aware) |
| `lib/native-key-store.ts` | Native secure storage adapter (iOS Keychain + Android KeyStore) |
| `lib/vault.ts` | Vault unlock/lock lifecycle manager (unchanged) |
| `lib/crypto.ts` | Web Crypto API wrappers (unchanged) |

### Utility Files

| File | Purpose |
|------|---------|
| `lib/utils/key-store-diagnostics.ts` | Debugging and testing utilities |
| `lib/utils/test-key-store.ts` | Manual integration tests |

## Usage Examples

### Basic Vault Operations

```typescript
import { setupVault, unlockVault, lockVault, isVaultUnlocked } from '@/lib/vault'
import { encryptField, decryptField } from '@/lib/vault'

// Setup vault (first time)
const result = await setupVault('masterPassword123', userId)

// Unlock vault (login)
const unlocked = await unlockVault('masterPassword123', userId)
if (!unlocked) {
  console.error('Wrong password')
}

// Check if vault is unlocked
const isUnlocked = await isVaultUnlocked(userId)

// Encrypt sensitive data
const { ciphertext, iv } = await encryptField('SSN: 123-45-6789')

// Decrypt sensitive data
const plaintext = await decryptField(ciphertext, iv)

// Lock vault (logout)
await lockVault()
```

### Platform-Specific Behavior

The key store automatically adapts to the platform:

```typescript
// This works identically on web and mobile:
import { storeDEK, getDEK } from '@/lib/key-store'

const dek = await generateDEK()
await storeDEK(dek, userId) // Web: IndexedDB | Mobile: Keychain/KeyStore

const retrievedDEK = await getDEK() // Web: CryptoKey | Mobile: Re-imported CryptoKey
```

### Diagnostics

```typescript
import { logDiagnostics, generateDiagnosticReport } from '@/lib/utils/key-store-diagnostics'

// Log current state to console
await logDiagnostics()

// Get diagnostic report
const report = await generateDiagnosticReport()
console.log(report)
// {
//   platform: 'ios',
//   isNative: true,
//   hasActiveDEK: true,
//   sessionMetadata: { userId: '...', timestamp: 1234567890, version: 1 },
//   timestamp: '2026-02-14T...'
// }
```

### Testing

```typescript
import { testKeyStoreLifecycle } from '@/lib/utils/test-key-store'

// Run full lifecycle test
const result = await testKeyStoreLifecycle()
console.log('Success:', result.success)
console.log('Platform:', result.platform)
if (!result.success) {
  console.error('Errors:', result.errors)
}
```

## Technical Details

### Web (IndexedDB)

- **Storage**: CryptoKey objects stored directly in IndexedDB
- **Security**: Keys are non-extractable (can't be exported as raw bytes after retrieval)
- **Persistence**: Survives page refreshes, cleared on logout or browser data clear
- **Compatibility**: All modern browsers (Chrome, Firefox, Safari, Edge)

### Native (iOS Keychain)

- **Storage**: Base64-encoded raw key bytes in iOS Keychain
- **Security**: Hardware-backed encryption on devices with Secure Enclave (iPhone 5s+)
- **Persistence**: Survives app restarts and updates, NOT cleared on app reinstall by default
- **Accessibility**: Keys stored with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`

### Native (Android KeyStore)

- **Storage**: Base64-encoded raw key bytes in EncryptedSharedPreferences
- **Security**: Hardware-backed encryption on devices with TEE/StrongBox
- **Persistence**: Survives app restarts, cleared on app reinstall
- **Encryption**: AES-256-GCM with keys stored in Android KeyStore

## CryptoKey Handling

### Web Platform

CryptoKey objects can be stored directly in IndexedDB:

```typescript
// Store CryptoKey directly
await db.put('keys', dekCryptoKey, 'dek')

// Retrieve CryptoKey directly
const dekCryptoKey = await db.get('keys', 'dek')
```

### Native Platforms

CryptoKey must be exported/imported:

```typescript
// Export for storage
const rawBytes = await crypto.subtle.exportKey('raw', dekCryptoKey)
const base64 = arrayBufferToBase64(rawBytes)
await SecureStoragePlugin.set({ key: 'dek', value: base64 })

// Import from storage
const base64 = await SecureStoragePlugin.get({ key: 'dek' })
const rawBytes = base64ToArrayBuffer(base64.value)
const dekCryptoKey = await crypto.subtle.importKey(
  'raw',
  rawBytes,
  { name: 'AES-GCM', length: 256 },
  false, // non-extractable
  ['encrypt', 'decrypt']
)
```

## Session Management

All platforms use the same session logic:

- **Session Duration**: 24 hours
- **Validation**: Checks userId match + timestamp age
- **Auto-Expire**: Sessions older than 24 hours are automatically cleared
- **Keep-Alive**: Call `updateSessionTimestamp()` to extend session

```typescript
import { isSessionValid, updateSessionTimestamp } from '@/lib/key-store'

// Check if session is still valid
const valid = await isSessionValid(userId) // false if expired or wrong user

// Extend session
await updateSessionTimestamp() // Resets the 24-hour timer
```

## Security Considerations

### Web

- ✅ CryptoKey stored as non-extractable (can't export raw bytes)
- ✅ IndexedDB is origin-isolated (same-origin policy)
- ⚠️ Vulnerable to XSS attacks (malicious scripts can access keys)
- ⚠️ No hardware backing (software-only encryption)

### iOS

- ✅ Hardware-backed encryption (Secure Enclave on modern devices)
- ✅ System-level protection (OS enforces access controls)
- ✅ Survives app updates and restarts
- ⚠️ Keys persist across app reinstalls by default (can be changed)
- ⚠️ Accessible when device is unlocked (not when locked)

### Android

- ✅ Hardware-backed encryption (TEE/StrongBox on modern devices)
- ✅ EncryptedSharedPreferences (double encryption layer)
- ✅ Cleared on app uninstall
- ⚠️ Varies by device security level (some devices lack hardware backing)

## Migration Path

### Current: Capacitor 6

Using `capacitor-secure-storage-plugin@0.10.0` (Capacitor 6 compatible)

### Future: Capacitor 8+

When upgrading to Capacitor 8, migrate to `@aparajita/capacitor-secure-storage`:

1. Update dependencies:
   ```bash
   npm install @aparajita/capacitor-secure-storage
   npm uninstall capacitor-secure-storage-plugin
   ```

2. Update import in `native-key-store.ts`:
   ```typescript
   import { SecureStorage } from '@aparajita/capacitor-secure-storage'
   ```

3. Update API calls (API is similar but check documentation)

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@capacitor/core` | ^6.2.1 | Platform detection |
| `capacitor-secure-storage-plugin` | 0.10.0 | Native secure storage |
| `idb` | ^8.0.3 | IndexedDB wrapper (web) |

## Troubleshooting

### "Vault is locked" errors

The DEK is not in storage. User needs to unlock the vault:

```typescript
await unlockVault(masterPassword, userId)
```

### Keys persist after logout

Ensure `clearKeys()` is called:

```typescript
await lockVault() // Calls clearKeys() internally
```

### Platform detection fails

Check Capacitor initialization:

```typescript
import { Capacitor } from '@capacitor/core'
console.log('Capacitor initialized:', Capacitor.isNativePlatform())
```

### Type errors in TypeScript

Ensure tsconfig paths are configured:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Testing Checklist

- [ ] Web: Store and retrieve DEK in IndexedDB
- [ ] iOS: Store and retrieve DEK in Keychain
- [ ] Android: Store and retrieve DEK in KeyStore
- [ ] Session expiration after 24 hours
- [ ] Clear keys on logout
- [ ] Encrypt/decrypt with retrieved DEK
- [ ] Platform detection works correctly
- [ ] No type errors in build

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [iOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Android KeyStore](https://developer.android.com/training/articles/keystore)
- [Capacitor Secure Storage Plugin](https://github.com/martinkasa/capacitor-secure-storage-plugin)
