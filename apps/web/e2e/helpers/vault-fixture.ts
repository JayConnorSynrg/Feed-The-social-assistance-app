/**
 * vault-fixture.ts — E2E vault provisioning helper
 *
 * Provisions a test user with a fully-initialized vault in hosted Supabase
 * so the forms-flow spec can unlock the vault with a known password and
 * assert profile autofill works end-to-end.
 *
 * CRITICAL: All crypto uses the app's own Node-safe primitives from
 * apps/web/src/lib/crypto.ts. This fixture does NOT import vault.ts because
 * vault.ts pulls IndexedDB/idb which is browser-only.
 *
 * Mandatory self-check: after computing all ciphertext, verify decryption
 * round-trips before any DB write. A fixture crypto bug must fail loudly here,
 * not silently in the UI.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  deriveKEK,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  deriveVerificationKey,
  generateSalt,
  generateIV,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  VAULT_VERIFICATION_CONSTANT,
} from '../../src/lib/crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResidentialAddress {
  line1: string
  city: string
  state: string
  zip_code: string
}

export interface VaultProvisionInput {
  adminClient: SupabaseClient
  email: string
  password: string
  fullName: string
  phone: string
  residentialAddress: ResidentialAddress
}

export interface VaultProvisionResult {
  userId: string
  email: string
  password: string
  expected: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: ResidentialAddress
  }
}

// ---------------------------------------------------------------------------
// Encrypt a field value using the DEK (inline — mirrors vault.ts encryptField)
// Does NOT import vault.ts to avoid idb browser-only dependency.
// ---------------------------------------------------------------------------

async function encryptField(
  plaintext: string,
  dek: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = generateIV()
  const ct = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    dek,
    new TextEncoder().encode(plaintext)
  )
  return {
    ciphertext: arrayBufferToBase64(ct),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }
}

// ---------------------------------------------------------------------------
// Provision a vault user
// ---------------------------------------------------------------------------

export async function provisionVaultUser(
  input: VaultProvisionInput
): Promise<VaultProvisionResult> {
  const { adminClient, email, password, fullName, phone, residentialAddress } = input

  // 1. Create auth user (email confirmed immediately via admin API)
  const { data: userData, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
  if (createError || !userData.user) {
    throw new Error(`Failed to create user ${email}: ${createError?.message}`)
  }
  const userId = userData.user.id

  // 2. Derive KEK from password + fresh salt
  const salt = generateSalt(16)
  const kek = await deriveKEK(password, salt)

  // 3. Generate DEK and wrap it in AES-GCM envelope
  const { key: dek, rawBytes: dekRaw } = await generateDEK()
  const { wrappedKey, iv: dekIvArr } = await wrapDEK(dekRaw, kek)

  // 4. ZK verify: derive VVK, encrypt VAULT_VERIFICATION_CONSTANT
  const vvk = await deriveVerificationKey(password, salt)
  const vIv = generateIV()
  const vCipher = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: vIv as Uint8Array<ArrayBuffer> },
    vvk,
    VAULT_VERIFICATION_CONSTANT as Uint8Array<ArrayBuffer>
  )

  // 5. Encrypt residential address using DEK
  const addrJson = JSON.stringify(residentialAddress)
  const addrIv = generateIV()
  const addrCipher = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: addrIv as Uint8Array<ArrayBuffer> },
    dek,
    new TextEncoder().encode(addrJson)
  )

  // =========================================================================
  // 6. MANDATORY SELF-CHECK — verify all three crypto round-trips before DB
  // =========================================================================

  // (a) VVK verification — decrypt vCipher with a freshly re-derived VVK
  {
    const vvk2 = await deriveVerificationKey(password, salt)
    let decrypted: ArrayBuffer
    try {
      decrypted = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: vIv as Uint8Array<ArrayBuffer> },
        vvk2,
        vCipher
      )
    } catch (err) {
      throw new Error(
        `vault-fixture self-check FAILED at step (a): VVK re-derivation + decrypt threw. ` +
        `This means the verification ciphertext will never unlock. Error: ${err}`
      )
    }
    const decryptedStr = new TextDecoder().decode(decrypted)
    const expectedStr = new TextDecoder().decode(VAULT_VERIFICATION_CONSTANT)
    if (decryptedStr !== expectedStr) {
      throw new Error(
        `vault-fixture self-check FAILED at step (a): decrypted VVK payload ` +
        `"${decryptedStr}" !== expected "${expectedStr}"`
      )
    }
  }

  // (b) DEK unwrap — verify unwrapDEK succeeds with same kek + iv
  {
    let dek2: CryptoKey
    try {
      dek2 = await unwrapDEK(wrappedKey, kek, dekIvArr)
    } catch (err) {
      throw new Error(
        `vault-fixture self-check FAILED at step (b): unwrapDEK threw. ` +
        `Wrapped DEK cannot be recovered. Error: ${err}`
      )
    }

    // (c) Address decrypt — verify addrCipher decrypts back to original address
    let addrDecrypted: ArrayBuffer
    try {
      addrDecrypted = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: addrIv as Uint8Array<ArrayBuffer> },
        dek2,
        addrCipher
      )
    } catch (err) {
      throw new Error(
        `vault-fixture self-check FAILED at step (c): address decrypt threw. Error: ${err}`
      )
    }
    const parsedAddr: ResidentialAddress = JSON.parse(new TextDecoder().decode(addrDecrypted))
    if (
      parsedAddr.line1 !== residentialAddress.line1 ||
      parsedAddr.city !== residentialAddress.city ||
      parsedAddr.state !== residentialAddress.state ||
      parsedAddr.zip_code !== residentialAddress.zip_code
    ) {
      throw new Error(
        `vault-fixture self-check FAILED at step (c): decrypted address ` +
        `${JSON.stringify(parsedAddr)} !== expected ${JSON.stringify(residentialAddress)}`
      )
    }
  }

  // All three checks passed — safe to proceed with DB write.

  // 7. Upsert user_secure_profiles with vault data
  const { error: upsertSecureError } = await adminClient
    .from('user_secure_profiles')
    .upsert(
      {
        id: userId,
        encryption_salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
        wrapped_dek: arrayBufferToBase64(wrappedKey),
        dek_iv: arrayBufferToBase64(dekIvArr.buffer as ArrayBuffer),
        encryption_version: 1,
        vault_created_at: new Date().toISOString(),
        verification_ciphertext: arrayBufferToBase64(vCipher),
        verification_iv: arrayBufferToBase64(vIv.buffer as ArrayBuffer),
        encrypted_residential_address: arrayBufferToBase64(addrCipher),
        residential_address_iv: arrayBufferToBase64(addrIv.buffer as ArrayBuffer),
        encryption_migrated: true,
        encryption_migrated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
  if (upsertSecureError) {
    throw new Error(`Failed to upsert user_secure_profiles for ${userId}: ${upsertSecureError.message}`)
  }

  // 8. Upsert public profiles — name parts, phone, onboarding_completed.
  // The profile row is created by trigger on user create; UPDATE it here.
  // first_name/last_name are the privacy-lockdown columns (#9): the UI reads
  // first_name on cross-user surfaces, so fixtures MUST populate them.
  const [firstName, ...rest] = fullName.trim().split(' ')
  const lastName = rest.join(' ') || null

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        phone,
        onboarding_completed: true,
        location_city: residentialAddress.city,
        location_state: residentialAddress.state,
      },
      { onConflict: 'id' }
    )
  if (profileError) {
    throw new Error(`Failed to upsert profile for ${userId}: ${profileError.message}`)
  }

  return {
    userId,
    email,
    password,
    expected: {
      firstName,
      lastName,
      email,
      phone,
      address: residentialAddress,
    },
  }
}

// ---------------------------------------------------------------------------
// Cleanup helper — deletes form_submissions then the auth user
// ---------------------------------------------------------------------------

export async function deleteProvisionedUser(
  adminClient: SupabaseClient,
  userId: string
): Promise<void> {
  // Delete form_submissions for this user (FK might not cascade from auth.users)
  await adminClient
    .from('form_submissions')
    .delete()
    .eq('user_id', userId)

  // Delete auth user — profiles/user_secure_profiles should cascade via FK
  // If they don't, this will fail-silent via best-effort
  await adminClient.auth.admin.deleteUser(userId)
}

// ---------------------------------------------------------------------------
// Admin client factory (mirrors auth.spec.ts pattern)
// ---------------------------------------------------------------------------

export function makeAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Ensure apps/web/.env.local is present and playwright.config.ts loads it.'
    )
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
