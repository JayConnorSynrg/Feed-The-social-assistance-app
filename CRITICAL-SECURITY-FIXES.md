# Critical Security Fixes - Required Before Launch

**Date:** 2026-02-15
**Priority:** URGENT
**Estimated Time:** 3-4 hours total

---

## 1. CRITICAL: Fix IV Reuse in Document Encryption

**Severity:** 🔴 **CRITICAL**
**File:** `/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/src/lib/document-encryption.ts`
**Lines:** 136-140, 265-270

### Issue

The current implementation reuses the same IV for all chunks when encrypting large files:

```typescript
// CURRENT (INSECURE)
const iv = generateIV()  // Generated ONCE

for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
  const encryptedChunk = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },  // SAME IV REUSED
    dek,
    chunkBuffer
  )
}
```

**Security Impact:**
- Reusing an IV with the same key breaks AES-GCM security guarantees
- Allows attackers to XOR ciphertexts and recover plaintext patterns
- This is a **critical cryptographic vulnerability**

### Fix

Implement counter-mode IVs (increment counter for each chunk):

```typescript
// SECURE: Counter-mode IVs
const baseIV = generateIV()  // Base IV
const ivs: Uint8Array[] = []

for (let offset = 0, chunkIndex = 0; offset < file.size; offset += CHUNK_SIZE, chunkIndex++) {
  // Create unique IV for this chunk by incrementing counter
  const chunkIV = new Uint8Array(baseIV)
  const view = new DataView(chunkIV.buffer)
  view.setUint32(chunkIV.byteLength - 4, chunkIndex, false)  // Last 4 bytes as counter

  ivs.push(chunkIV)

  const encryptedChunk = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: chunkIV as Uint8Array<ArrayBuffer> },
    dek,
    chunkBuffer
  )
}
```

**Storage Change:**
Instead of storing a single IV, store the base IV and chunk count:
```typescript
return {
  encryptedBlob: new Blob([combined], { type: 'application/octet-stream' }),
  iv: arrayBufferToBase64(baseIV.buffer as ArrayBuffer),  // Base IV
  chunkCount: ivs.length,  // Store chunk count
  // ... other fields
}
```

**Decryption Change:**
```typescript
// Reconstruct chunk IVs during decryption
const baseIV = new Uint8Array(base64ToArrayBuffer(iv))

for (let offset = 0, chunkIndex = 0; offset < encryptedBuffer.byteLength; offset += chunkSize, chunkIndex++) {
  const chunkIV = new Uint8Array(baseIV)
  const view = new DataView(chunkIV.buffer)
  view.setUint32(chunkIV.byteLength - 4, chunkIndex, false)

  const decryptedChunk = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: chunkIV as Uint8Array<ArrayBuffer> },
    dek,
    chunk
  )
}
```

### Testing

After fixing, test with:
1. Small file (<5MB) - verify encryption/decryption works
2. Large file (>5MB) - verify chunked encryption/decryption works
3. Verify each chunk uses different IV (log IVs during encryption)

**Estimated Time:** 1-2 hours

---

## 2. HIGH: Restrict CORS on Auth Endpoints

**Severity:** 🟠 **HIGH**
**Files:**
- `/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/auth-guard/index.ts`
- `/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/validate-password/index.ts`

### Issue

Both functions use wildcard CORS (`Access-Control-Allow-Origin: *`), allowing any origin to call these sensitive endpoints.

**Current (INSECURE):**
```typescript
return new Response(JSON.stringify(result), {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',  // ❌ WILDCARD
  },
})
```

**Security Impact:**
- Any website can call these endpoints
- Potential for CSRF attacks
- auth-guard handles sensitive login tracking
- validate-password could be abused for password guessing

### Fix

Replace wildcard with restricted origin list (same pattern as chat function):

```typescript
// Add at top of file
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'http://localhost:3000',
  'capacitor://localhost',  // Mobile app (iOS)
  'http://localhost',       // Mobile app (Android webview)
  'ionic://localhost',      // Ionic dev
]

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] // Default to APP_URL

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// Update handler
serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // ... rest of logic

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

### Files to Update

**auth-guard/index.ts:**
- Line 54: OPTIONS response
- Line 102: Success response
- Lines throughout: Replace all `'Access-Control-Allow-Origin': '*'`

**validate-password/index.ts:**
- Line 41: OPTIONS response
- Line 64: Success response
- Lines throughout: Replace all `'Access-Control-Allow-Origin': '*'`

**Estimated Time:** 30 minutes

---

## 3. HIGH: Execute RLS Verification

**Severity:** 🟠 **HIGH**
**Action:** Execute SQL script to verify database security

### Command

```bash
cd /Users/jelalconnor/CODING/CURSOR/FEED.
npx supabase db execute --file scripts/verify-rls.sql
```

### Expected Results

**All tables should have RLS enabled:**
```
tablename               | rls_status
------------------------|------------
resources               | ✓ ENABLED
user_secure_profiles    | ✓ ENABLED
form_submissions        | ✓ ENABLED
user_documents          | ✓ ENABLED
mfa_backup_codes        | ✓ ENABLED
password_history        | ✓ ENABLED
account_lockouts        | ✓ ENABLED
auth_login_attempts     | ✓ ENABLED
user_sessions           | ✓ ENABLED
```

**Encryption columns should exist:**
```
user_secure_profiles:
- encryption_salt (TEXT)
- wrapped_dek (TEXT)
- dek_iv (TEXT)
- encrypted_household_members (TEXT)
- household_members_iv (TEXT)
- encrypted_employer_info (TEXT)
- employer_info_iv (TEXT)
- encrypted_emergency_contact (TEXT)
- emergency_contact_iv (TEXT)
- encrypted_mailing_address (TEXT)
- mailing_address_iv (TEXT)
- encrypted_residential_address (TEXT)
- residential_address_iv (TEXT)
- encrypted_current_benefits (TEXT)
- current_benefits_iv (TEXT)
```

**Auth hardening tables should exist:**
```
- account_lockouts
- auth_login_attempts
- user_sessions
- password_history
- mfa_backup_codes
```

### If RLS is Missing

If any table shows `✗ DISABLED`, enable RLS:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

Then create appropriate policies:

```sql
-- Example: user_secure_profiles should only allow owner access
CREATE POLICY "Users can only access their own secure profile"
ON user_secure_profiles
FOR ALL
USING (id = auth.uid());
```

**Estimated Time:** 1 hour (including fixes if needed)

---

## 4. Database Migration Check

**Verify the following migrations exist:**

```bash
ls -la /Users/jelalconnor/CODING/CURSOR/FEED./supabase/migrations/
```

**Expected migrations (in order):**
1. Initial schema (users, profiles, resources)
2. Encryption fields (user_secure_profiles with encrypted columns)
3. Auth hardening (account_lockouts, auth_login_attempts, etc.)
4. RLS policies (for all tables)

**If missing:** Create migrations from `/Users/jelalconnor/CODING/CURSOR/FEED./SECURITY_IMPLEMENTATION.md`

---

## Summary Checklist

Before launching the platform, complete these tasks:

- [ ] **Fix IV reuse** in document-encryption.ts (CRITICAL - 1-2 hours)
- [ ] **Restrict CORS** in auth-guard and validate-password (HIGH - 30 min)
- [ ] **Execute RLS verification** script (HIGH - 1 hour)
- [ ] **Test encryption/decryption** after IV fix (30 min)
- [ ] **Test CORS restrictions** from different origins (30 min)
- [ ] **Review RLS results** and fix any missing policies (30 min)

**Total Estimated Time:** 3-4 hours
**Blocking for Launch:** YES - All three issues must be fixed

---

## Post-Fix Verification

After completing all fixes, run these tests:

### 1. Document Encryption Test
```typescript
// Test script
import { encryptFile, decryptFile } from '@/lib/document-encryption'

// Create test file >5MB (to trigger chunking)
const testFile = new File([new Uint8Array(6 * 1024 * 1024)], 'test.bin')

// Encrypt
const encrypted = await encryptFile(testFile, (progress) => {
  console.log('Encrypting:', progress.percentage)
})

// Decrypt
const decrypted = await decryptFile(
  encrypted.encryptedBlob,
  encrypted.iv,
  encrypted.encryptedName,
  encrypted.encryptedNameIV,
  encrypted.originalType,
  (progress) => {
    console.log('Decrypting:', progress.percentage)
  }
)

// Verify
console.assert(decrypted.size === testFile.size, 'File size mismatch')
console.assert(decrypted.name === testFile.name, 'Filename mismatch')
```

### 2. CORS Test
```bash
# Test from unauthorized origin (should fail)
curl -X POST https://your-project.supabase.co/functions/v1/auth-guard \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"action":"check-lockout","email":"test@example.com"}'

# Should return Access-Control-Allow-Origin: https://your-app.com (NOT *)
```

### 3. RLS Test
```sql
-- Test as unauthenticated user (should return 0 rows)
SET ROLE anon;
SELECT * FROM user_secure_profiles;  -- Should return 0 rows

-- Test as authenticated user (should only see own data)
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-id-123';
SELECT * FROM user_secure_profiles;  -- Should only see user-id-123's row
```

---

**END OF CRITICAL FIXES**

After completing these fixes, the platform will be secure for public launch.
