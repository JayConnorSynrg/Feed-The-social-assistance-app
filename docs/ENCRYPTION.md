# FEED Platform - Zero-Knowledge Encryption System

## Overview

The FEED platform implements a **zero-knowledge encryption system** for all PII/PHI (Personally Identifiable Information / Protected Health Information). The server stores encrypted data but cannot decrypt it without the user's master password.

## Architecture

### Key Hierarchy

```
Master Password (user-provided, never stored)
       ↓
    PBKDF2 (600k iterations)
       ↓
    KEK (Key Encryption Key)
       ↓
    Wraps/Unwraps DEK
       ↓
    DEK (Data Encryption Key, stored encrypted)
       ↓
    Encrypts/Decrypts user data
```

### Components

1. **Vault System** (`/apps/web/src/lib/vault.ts`)
   - Manages the vault unlock/lock lifecycle
   - Handles DEK wrapping/unwrapping with KEK
   - Stores DEK in IndexedDB when unlocked

2. **Field Encryption Service** (`/apps/web/src/lib/field-encryption.ts`)
   - High-level encryption for specific field types
   - Handles JSONB objects, strings, and arrays
   - Batch operations for profiles and form submissions

3. **Migration Utility** (`/apps/web/src/lib/migrate-to-encrypted.ts`)
   - Migrates existing plaintext data to encrypted columns
   - Runs automatically when user unlocks vault
   - Tracks migration progress

4. **Crypto Library** (`/apps/web/src/lib/crypto.ts`)
   - Low-level Web Crypto API wrappers
   - AES-GCM for data encryption
   - PBKDF2 for key derivation

## Encrypted Fields

### User Secure Profiles Table

| Field | Type | Description |
|-------|------|-------------|
| `encrypted_household_members` | TEXT | Household members (names, DOBs, SSNs) |
| `encrypted_employer_info` | TEXT | Employment history, EIN |
| `encrypted_emergency_contact` | TEXT | Emergency contact information |
| `encrypted_mailing_address` | TEXT | Mailing address |
| `encrypted_residential_address` | TEXT | Physical address |
| `encrypted_current_benefits` | TEXT | Government benefits list |
| `encrypted_ssn` | TEXT | Social Security Number |
| `encrypted_dob` | TEXT | Date of Birth |
| `encrypted_income` | TEXT | Income information |

Each encrypted field has a corresponding `_iv` column for the initialization vector.

### Form Submissions Table

| Field | Type | Description |
|-------|------|-------------|
| `encrypted_form_data` | TEXT | All form data (SSN, income, addresses, medical info) |
| `encrypted_signature_data` | TEXT | E-signature data (legally binding) |

## Usage

### 1. Setup Vault (First-Time Users)

```typescript
import { useVault } from '@/contexts/vault-context'

function SetupVault() {
  const { setup } = useVault()

  const handleSetup = async () => {
    const masterPassword = prompt('Create a master password')
    await setup(masterPassword)
    // Vault is now set up and unlocked
  }

  return <button onClick={handleSetup}>Setup Vault</button>
}
```

### 2. Unlock Vault

```typescript
import { useVault } from '@/contexts/vault-context'

function UnlockVault() {
  const { unlock, isUnlocked } = useVault()

  const handleUnlock = async () => {
    const masterPassword = prompt('Enter master password')
    const success = await unlock(masterPassword)
    if (success) {
      console.log('Vault unlocked!')
      // Migration runs automatically here
    }
  }

  return (
    <button onClick={handleUnlock} disabled={isUnlocked}>
      Unlock Vault
    </button>
  )
}
```

### 3. Save Encrypted Profile

```typescript
import { useVaultSecureProfile } from '@/hooks/use-vault-secure-profile'

function SaveProfile() {
  const { save, profile } = useVaultSecureProfile()

  const handleSave = async () => {
    const success = await save({
      household_members: [
        { name: 'John Doe', relationship: 'Self', ssn: '123-45-6789' }
      ],
      mailing_address: {
        line1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip_code: '62701'
      }
    })

    if (success) {
      console.log('Profile saved and encrypted!')
    }
  }

  return <button onClick={handleSave}>Save Profile</button>
}
```

### 4. Save Encrypted Form Submission

```typescript
import { useVaultFormSubmission } from '@/hooks/use-vault-form-submission'

function SubmitForm() {
  const { submitForm } = useVaultFormSubmission()

  const handleSubmit = async () => {
    const formData = {
      ssn: '123-45-6789',
      income: '50000',
      address: '123 Main St'
    }

    const signatureData = 'base64-encoded-signature'

    const success = await submitForm(formData, signatureData)
    if (success) {
      console.log('Form submitted and encrypted!')
    }
  }

  return <button onClick={handleSubmit}>Submit Form</button>
}
```

### 5. Lock Vault

```typescript
import { useVault } from '@/contexts/vault-context'

function LockVault() {
  const { lock } = useVault()

  return <button onClick={lock}>Lock Vault</button>
}
```

## Data Migration

### Automatic Migration

When a user unlocks their vault for the first time after the encryption migration:

1. System checks if `encryption_migrated = false`
2. Reads plaintext data from old columns
3. Encrypts data with user's DEK
4. Writes to new encrypted columns
5. Sets `encryption_migrated = true`

### Manual Migration Check

```typescript
import { needsMigration, getMigrationProgress } from '@/lib/migrate-to-encrypted'

const shouldMigrate = await needsMigration(userId)
if (shouldMigrate) {
  const progress = await getMigrationProgress(userId)
  console.log(`Migration ${progress.percentComplete}% complete`)
}
```

## Security Properties

### Zero-Knowledge

- **Server cannot decrypt**: Server stores `wrapped_dek` but cannot unwrap it without the user's master password
- **Master password never stored**: Only a hash is stored for verification
- **Client-side only decryption**: All decryption happens in the browser

### Encryption Standards

- **AES-GCM 256-bit**: Authenticated encryption for all data
- **PBKDF2 600k iterations**: Key derivation from master password
- **Unique IVs**: Each encrypted field gets a fresh initialization vector
- **No IV reuse**: IVs are never reused across encryptions

### Key Storage

- **DEK in IndexedDB**: Stored only when vault is unlocked
- **Session-based**: Cleared when user locks vault or logs out
- **No persistence**: Master password never persists anywhere

## Database Schema

### Migration Strategy

1. **Phase 1** (Current): Add encrypted columns alongside plaintext
2. **Phase 2**: Application writes to both plaintext and encrypted
3. **Phase 3**: Migrate existing users' data
4. **Phase 4**: Application reads only from encrypted columns
5. **Phase 5**: Drop plaintext columns (after all users migrated)

### Constraints

All encrypted fields have database constraints ensuring:
- Both ciphertext and IV are present together
- Or both are NULL (field not set)
- Never just one or the other (data integrity)

## Error Handling

### Vault Locked

```typescript
try {
  await encryptField('sensitive data')
} catch (error) {
  if (error.message === 'Vault is locked. Please unlock your vault first.') {
    // Prompt user to unlock vault
  }
}
```

### Decryption Failure

```typescript
try {
  await decryptField(ciphertext, iv)
} catch (error) {
  // Handle corrupted data or wrong key
  console.error('Decryption failed:', error)
}
```

### Migration Errors

```typescript
const result = await migrateUserDataToEncrypted(userId)
if (result.errors.length > 0) {
  console.error('Migration errors:', result.errors)
  // Migration can be retried
}
```

## Performance Considerations

### Batch Operations

Use batch encryption for multiple fields:

```typescript
// ❌ Bad: Multiple encrypt calls
const field1 = await encryptField(data1)
const field2 = await encryptField(data2)

// ✅ Good: Batch operation
const encrypted = await encryptSecureProfile({
  household_members: data1,
  employer_info: data2
})
```

### IndexedDB Caching

- DEK is cached in IndexedDB while vault is unlocked
- No need to re-derive from password on each encryption
- Fast encryption/decryption operations

## Testing

### Unit Tests

```bash
# Test encryption/decryption
npm test -- crypto.test.ts

# Test vault operations
npm test -- vault.test.ts

# Test field encryption
npm test -- field-encryption.test.ts
```

### Integration Tests

```bash
# Test full flow: setup → unlock → encrypt → decrypt
npm test -- vault.integration.test.ts
```

## Troubleshooting

### "Vault is locked" Error

**Cause**: Attempting to encrypt/decrypt without unlocking vault
**Solution**: Call `unlock(masterPassword)` first

### "Invalid encryption key" Error

**Cause**: Wrong master password provided
**Solution**: User must provide correct master password

### Migration Not Running

**Cause**: User already migrated or no plaintext data exists
**Solution**: Check `encryption_migrated` flag in database

### Data Corruption

**Cause**: IV or ciphertext missing/corrupted
**Solution**: Database constraints prevent this; contact support if occurs

## Best Practices

### DO

✅ Always check `isUnlocked` before encryption operations
✅ Lock vault when user is done with sensitive operations
✅ Use batch operations for multiple fields
✅ Handle encryption errors gracefully
✅ Clear vault on logout

### DON'T

❌ Store master password anywhere
❌ Send decrypted data to server
❌ Reuse initialization vectors
❌ Skip migration checks
❌ Ignore encryption errors

## API Reference

See individual files for detailed API documentation:

- `/apps/web/src/lib/vault.ts` - Vault operations
- `/apps/web/src/lib/field-encryption.ts` - Field encryption
- `/apps/web/src/lib/migrate-to-encrypted.ts` - Migration utilities
- `/apps/web/src/contexts/vault-context.tsx` - React context
- `/apps/web/src/hooks/use-vault-secure-profile.ts` - Profile hook
- `/apps/web/src/hooks/use-vault-form-submission.ts` - Form submission hook

## Compliance

This encryption system is designed to comply with:

- **HIPAA**: Protected Health Information (PHI) encrypted at rest
- **GDPR**: Personal data encrypted with user control
- **Zero-Knowledge**: Server cannot access unencrypted data

## Future Enhancements

1. **Key Rotation**: Periodic DEK rotation
2. **Multi-Factor Auth**: Require 2FA before unlocking vault
3. **Biometric Unlock**: Use device biometrics for convenience
4. **Recovery Keys**: Backup recovery mechanism
5. **Audit Logging**: Track encryption/decryption events
