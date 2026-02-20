# Vault Integration Guide - Quick Start

This guide shows you exactly how to integrate the vault system into the FEED app.

## Step 1: Run Database Migration

```bash
# Start Docker Desktop first

# Start Supabase
npx supabase start

# Apply the vault migration
npx supabase db reset --local

# Or if DB is already running, just push the migration
npx supabase db push
```

Verify the migration worked:

```sql
-- Check that user_secure_profiles has vault columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_secure_profiles'
AND column_name IN ('encryption_salt', 'wrapped_dek', 'dek_iv', 'vault_created_at');
```

## Step 2: Add VaultProvider to App

Edit `/apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VaultProvider } from "@/contexts/vault-context"; // ADD THIS
import { AuthProvider } from "@/providers/auth-provider"; // ADD THIS

// ... fonts config ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <VaultProvider>
            {children}
          </VaultProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

## Step 3: Update Auth Provider to Lock Vault on Logout

Edit `/apps/web/src/providers/auth-provider.tsx`:

```tsx
import { lockVault } from '@/lib/vault' // ADD THIS

// ... in AuthProvider component ...

// Update signOut function
const signOut = useCallback(async () => {
  await lockVault() // ADD THIS - Clear DEK from IndexedDB
  const { error } = await supabase.auth.signOut()
  if (error) {
    setError(error)
  }
}, [supabase])
```

## Step 4: Add Vault Setup Prompt for New Users

Create `/apps/web/src/components/vault-setup-prompt.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuthContext } from '@/providers/auth-provider'
import { useVault } from '@/contexts/vault-context'
import { VaultUnlockModal } from '@/components/vault'

export function VaultSetupPrompt() {
  const { isAuthenticated } = useAuthContext()
  const { isSetup, loading } = useVault()
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    // Show setup modal if user is logged in but hasn't set up vault
    if (isAuthenticated && !loading && !isSetup) {
      setShowSetup(true)
    }
  }, [isAuthenticated, loading, isSetup])

  return (
    <VaultUnlockModal
      open={showSetup}
      onOpenChange={setShowSetup}
      mode="setup"
    />
  )
}
```

Then add to your app shell (e.g., in `page.tsx` or `layout.tsx`):

```tsx
import { VaultSetupPrompt } from '@/components/vault-setup-prompt'

export default function Page() {
  return (
    <>
      <VaultSetupPrompt />
      {/* Your app content */}
    </>
  )
}
```

## Step 5: Use Vault in Components

### Example: Secure Profile Form

```tsx
'use client'

import { useState } from 'react'
import { useVault } from '@/contexts/vault-context'
import { VaultGuard } from '@/components/vault'
import { createClient } from '@/lib/supabase/client'

function SecureProfileForm() {
  const { encrypt, isUnlocked } = useVault()
  const [ssn, setSSN] = useState('')
  const [income, setIncome] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isUnlocked) {
      alert('Please unlock your vault first')
      return
    }

    // Encrypt sensitive fields
    const { ciphertext: encryptedSSN, iv: ssnIV } = await encrypt(ssn)
    const { ciphertext: encryptedIncome, iv: incomeIV } = await encrypt(income)

    // Save to database
    await supabase.from('user_secure_profiles').upsert({
      id: (await supabase.auth.getUser()).data.user?.id,
      encrypted_ssn: encryptedSSN,
      ssn_iv: ssnIV,
      encrypted_income: encryptedIncome,
      income_iv: incomeIV,
    })

    alert('Saved securely!')
  }

  return (
    <VaultGuard>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="SSN"
          value={ssn}
          onChange={(e) => setSSN(e.target.value)}
        />
        <input
          type="text"
          placeholder="Income"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
        />
        <button type="submit">Save</button>
      </form>
    </VaultGuard>
  )
}
```

### Example: Display Encrypted Data

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useVault } from '@/contexts/vault-context'
import { VaultGuard } from '@/components/vault'
import { createClient } from '@/lib/supabase/client'

function SecureDataDisplay() {
  const { decrypt } = useVault()
  const [ssn, setSSN] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data } = await supabase
        .from('user_secure_profiles')
        .select('encrypted_ssn, ssn_iv')
        .eq('id', user.user.id)
        .single()

      if (data?.encrypted_ssn && data?.ssn_iv) {
        const decryptedSSN = await decrypt(data.encrypted_ssn, data.ssn_iv)
        setSSN(decryptedSSN)
      }

      setLoading(false)
    }

    loadData()
  }, [decrypt, supabase])

  return (
    <VaultGuard>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          <p>SSN: {ssn ? `***-**-${ssn.slice(-4)}` : 'Not set'}</p>
        </div>
      )}
    </VaultGuard>
  )
}
```

### Example: Batch Encrypt/Decrypt

```tsx
import { useVault } from '@/contexts/vault-context'

function MultiFieldForm() {
  const { encryptMultiple, decryptMultiple } = useVault()

  const handleSubmit = async (formData: { ssn: string; dob: string; income: string }) => {
    // Encrypt all fields at once
    const encrypted = await encryptMultiple({
      ssn: formData.ssn,
      dob: formData.dob,
      income: formData.income,
    })

    // Save to database
    await supabase.from('user_secure_profiles').upsert({
      encrypted_ssn: encrypted.ssn.ciphertext,
      ssn_iv: encrypted.ssn.iv,
      encrypted_dob: encrypted.dob.ciphertext,
      dob_iv: encrypted.dob.iv,
      encrypted_income: encrypted.income.ciphertext,
      income_iv: encrypted.income.iv,
    })
  }

  const handleLoad = async () => {
    const { data } = await supabase.from('user_secure_profiles').select('*').single()

    // Decrypt all fields at once
    const decrypted = await decryptMultiple({
      ssn: { ciphertext: data.encrypted_ssn, iv: data.ssn_iv },
      dob: { ciphertext: data.encrypted_dob, iv: data.dob_iv },
      income: { ciphertext: data.encrypted_income, iv: data.income_iv },
    })

    console.log(decrypted) // { ssn: "123-45-6789", dob: "1990-01-01", income: "50000" }
  }
}
```

## Step 6: Add Vault Status Indicator (Optional)

Create a vault lock/unlock indicator in your nav:

```tsx
'use client'

import { useVault } from '@/contexts/vault-context'
import { Lock, Unlock } from 'lucide-react'
import { VaultUnlockModal } from '@/components/vault'
import { useState } from 'react'

export function VaultStatus() {
  const { isUnlocked, lock } = useVault()
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button onClick={() => isUnlocked ? lock() : setShowModal(true)}>
        {isUnlocked ? (
          <>
            <Unlock className="h-4 w-4" />
            Vault Unlocked
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Vault Locked
          </>
        )}
      </button>

      <VaultUnlockModal open={showModal} onOpenChange={setShowModal} />
    </>
  )
}
```

## Testing Your Integration

### 1. Test Setup Flow

```bash
# 1. Start app
npm run dev

# 2. Create new user account
# 3. You should see vault setup modal
# 4. Create master password (min 12 chars)
# 5. Verify vault created in database:
```

```sql
SELECT id, encryption_salt, wrapped_dek, vault_created_at
FROM user_secure_profiles
WHERE encryption_salt IS NOT NULL;
```

### 2. Test Unlock Flow

```bash
# 1. Lock vault (logout or manual)
# 2. Login again
# 3. Try to access encrypted data
# 4. Should see unlock modal
# 5. Enter correct password
# 6. Vault unlocks, data accessible
```

### 3. Test Encryption

```bash
# 1. Unlock vault
# 2. Submit form with sensitive data
# 3. Check database - should see base64 ciphertext:
```

```sql
SELECT encrypted_ssn, ssn_iv FROM user_secure_profiles LIMIT 1;
-- encrypted_ssn: "aGVsbG8gd29ybGQ..." (base64)
-- ssn_iv: "cmFuZG9tIGl2..." (base64)
```

### 4. Test Persistence

```bash
# 1. Unlock vault
# 2. Refresh page
# 3. Vault should still be unlocked (IndexedDB persists)
# 4. Close browser
# 5. Reopen browser
# 6. Vault should still be unlocked (if within 24 hours)
```

## Troubleshooting

### "Module not found: Can't resolve '@/contexts/vault-context'"

Make sure you've created all the files from VAULT-IMPLEMENTATION-SUMMARY.md

### "Table user_secure_profiles does not exist"

Run the migration:

```bash
npx supabase db reset --local
```

### "Cannot read properties of null (reading 'encrypt')"

Make sure VaultProvider wraps your component tree:

```tsx
<VaultProvider>
  <YourComponent />
</VaultProvider>
```

### Vault unlocks but encryption still fails

Check that you're calling `encrypt()` from inside a component that's wrapped by VaultProvider:

```tsx
// ❌ Wrong - outside provider
const vault = useVault() // Error!

// ✅ Correct - inside component
function MyComponent() {
  const vault = useVault() // Works!
}
```

### TypeScript errors about missing properties

Regenerate database types:

```bash
npx supabase gen types typescript --local > packages/database/types.ts
```

## Next Steps

1. **Add recovery key system** - See VAULT-IMPLEMENTATION-SUMMARY.md
2. **Migrate existing encrypted data** - See migration section in summary
3. **Add vault UI indicators** - Lock icon in nav, vault status
4. **Implement auto-lock on inactivity** - Use setTimeout to lock after 15min

## Support

For issues or questions, see:
- VAULT-IMPLEMENTATION-SUMMARY.md (complete documentation)
- ZERO-KNOWLEDGE-ENCRYPTION-ARCHITECTURE.md (architecture spec)
- /apps/web/src/lib/vault.ts (implementation code)
