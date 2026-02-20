# Vault Implementation - TODO Checklist

## Completed ✅

- [x] Enhanced crypto.ts with KEK/DEK architecture
- [x] Created key-store.ts for IndexedDB management
- [x] Created vault.ts with complete vault API
- [x] Created vault-context.tsx React context
- [x] Created vault-unlock-modal.tsx UI component
- [x] Created vault-guard.tsx wrapper component
- [x] Created database migration file
- [x] Created comprehensive documentation
- [x] Created integration guide
- [x] Created test file structure

## Immediate Next Steps (Required Before Testing)

### 1. Start Docker and Supabase

```bash
# Start Docker Desktop application

# Start Supabase
npx supabase start

# Apply migrations
npx supabase db reset --local
```

### 2. Regenerate Database Types

```bash
# After migration runs successfully
npx supabase gen types typescript --local > packages/database/types.ts
```

This will fix the TypeScript errors in vault.ts because it will add the new columns to the user_secure_profiles type.

### 3. Install Missing Dev Dependency (Optional)

```bash
cd apps/web
npm install -D vitest
```

This is only needed if you want to run the tests.

### 4. Integrate VaultProvider into App

Edit `apps/web/src/app/layout.tsx`:

```tsx
import { AuthProvider } from '@/providers/auth-provider'
import { VaultProvider } from '@/contexts/vault-context'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <VaultProvider>
            {children}
          </VaultProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
```

### 5. Update Auth Provider Logout

Edit `apps/web/src/providers/auth-provider.tsx`:

```tsx
import { lockVault } from '@/lib/vault'

// In signOut function
const signOut = useCallback(async () => {
  await lockVault() // ADD THIS
  const { error } = await supabase.auth.signOut()
  if (error) {
    setError(error)
  }
}, [supabase])
```

## Testing Checklist

After completing the above steps:

- [ ] Run `npm run dev` - App should start without errors
- [ ] Create new user account - Should see vault setup modal
- [ ] Set master password - Vault should be created
- [ ] Check database - Should see encryption_salt, wrapped_dek, dek_iv populated
- [ ] Refresh page - Vault should remain unlocked (IndexedDB persists)
- [ ] Logout - Vault should lock (DEK cleared from IndexedDB)
- [ ] Login again - Should prompt to unlock vault
- [ ] Enter correct password - Vault unlocks successfully
- [ ] Enter wrong password - Should show error
- [ ] Test encryption - Save encrypted data to database
- [ ] Test decryption - Load and decrypt data successfully
- [ ] Check database content - Should only see base64 ciphertext

## TypeScript Errors to Fix

Current errors are expected because database types haven't been regenerated:

```
error TS2339: Property 'encryption_salt' does not exist on type...
error TS2339: Property 'wrapped_dek' does not exist on type...
error TS2339: Property 'dek_iv' does not exist on type...
```

These will be resolved after running:

```bash
npx supabase gen types typescript --local > packages/database/types.ts
```

## Optional Enhancements (Post-MVP)

- [ ] Add recovery key system for password reset
- [ ] Add vault status indicator in UI (lock icon)
- [ ] Add auto-lock after inactivity (15 minutes)
- [ ] Migrate existing encrypted data from old system
- [ ] Add biometric unlock support (Touch ID/Face ID)
- [ ] Add Web Worker for PBKDF2 (avoid blocking UI)
- [ ] Add rate limiting for failed unlock attempts
- [ ] Add audit logging for vault access
- [ ] Upgrade from PBKDF2 to Argon2id
- [ ] Add comprehensive test coverage (unit + integration)

## File Reference

All implementation files:

```
apps/web/src/
├── lib/
│   ├── crypto.ts (MODIFIED)
│   ├── key-store.ts (NEW)
│   ├── vault.ts (NEW)
│   └── __tests__/vault.test.ts (NEW)
├── contexts/
│   └── vault-context.tsx (NEW)
└── components/
    └── vault/
        ├── vault-unlock-modal.tsx (NEW)
        ├── vault-guard.tsx (NEW)
        └── index.ts (NEW)

supabase/migrations/
└── 20260214200000_add_vault_key_storage.sql (NEW)

Documentation:
├── VAULT-IMPLEMENTATION-SUMMARY.md
├── VAULT-INTEGRATION-GUIDE.md
└── VAULT-TODO.md (this file)
```

## Known Issues

1. **Docker not running** - Migration cannot run without Docker Desktop
2. **Types not generated** - TypeScript errors until types regenerated
3. **vitest not installed** - Test file shows warning (optional dependency)
4. **No UI integration yet** - VaultProvider not added to app layout

## Success Criteria

Implementation is complete when:

1. ✅ All files created
2. ⏳ Docker running and migration applied
3. ⏳ Database types regenerated
4. ⏳ TypeScript compiles without errors
5. ⏳ VaultProvider integrated into app
6. ⏳ Manual testing checklist complete
7. ⏳ User can create vault, lock, unlock
8. ⏳ Encrypted data persists in database as ciphertext
9. ⏳ Host/admin cannot decrypt data

## Next Steps

**Right now:**

1. Start Docker Desktop
2. Run `npx supabase start`
3. Run `npx supabase db reset --local`
4. Run `npx supabase gen types typescript --local > packages/database/types.ts`
5. Add VaultProvider to layout.tsx
6. Update auth-provider.tsx logout function
7. Test the implementation

**After testing:**

8. Create PR with vault implementation
9. Deploy to staging
10. Test in staging environment
11. Plan migration strategy for existing users
12. Deploy to production

## Questions?

See the documentation files for details:
- VAULT-IMPLEMENTATION-SUMMARY.md - Complete architecture
- VAULT-INTEGRATION-GUIDE.md - Step-by-step integration
- specs/001-feed-platform/ZERO-KNOWLEDGE-ENCRYPTION-ARCHITECTURE.md - Original spec
