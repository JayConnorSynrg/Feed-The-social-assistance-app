# FEED Platform - Zero-Knowledge Encryption Architecture
## Volunteer-Hosted Multi-Tenant Design

**Version**: 1.0.0
**Created**: 2026-02-05
**Status**: Architecture Design

---

## Executive Summary

This document defines a **zero-knowledge encryption architecture** for FEED where:

1. **Volunteer hosts have ZERO access to user data** - Host operators cannot decrypt any user content
2. **Each user gets an encrypted database partition** - Tenant isolation via row-level encryption
3. **Encryption keys held by users only** - Keys never leave the client device
4. **Supabase RLS + client-side encryption layer** - Defense in depth security model

### Core Principle
**"The database stores ciphertext, never plaintext. Only the user's device holds decryption keys."**

---

## Threat Model

### Threats We Defend Against

| Threat | Mitigation |
|--------|------------|
| **Malicious host operator** | Client-side encryption prevents host from reading data |
| **Database dump stolen** | All sensitive data is encrypted ciphertext |
| **Server compromise** | Keys never stored on server, no master key exists |
| **Cross-tenant access** | RLS + encryption provides double isolation |
| **Subpoena/warrant** | Host can only provide ciphertext, no keys |
| **Insider threat** | No admin/DBA access to decrypted data |

### Threats We Do NOT Defend Against

| Threat | Reason |
|--------|--------|
| **Client device compromise** | Keys stored on device (unavoidable in web app) |
| **Man-in-browser attacks** | Client-side JavaScript is inherently vulnerable |
| **Metadata analysis** | Schema, timestamps, relationships remain visible |
| **Traffic analysis** | Network patterns, request sizes, timing visible |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT DEVICE                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Web Crypto API (SubtleCrypto)                          │   │
│  │  - Generate user master key (never exported)            │   │
│  │  - Derive data encryption keys (DEKs)                   │   │
│  │  - Encrypt/decrypt data before DB operations            │   │
│  └─────────────────────────────────────────────────────────┘   │
│              │                                      │            │
│              │ Keys stored in IndexedDB             │            │
│              │ (extractable: false)                 │            │
│              ▼                                      ▼            │
│  ┌──────────────────┐                  ┌──────────────────┐    │
│  │  IndexedDB       │                  │  OPAQUE Protocol │    │
│  │  - CryptoKey     │                  │  - Password auth │    │
│  │  - Key wrapping  │                  │  - Key derivation│    │
│  └──────────────────┘                  └──────────────────┘    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            │ Encrypted data + auth
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VOLUNTEER HOST SERVER                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Supabase PostgreSQL                                     │   │
│  │  - Stores ONLY encrypted data (ciphertext)               │   │
│  │  - RLS policies enforce tenant isolation                 │   │
│  │  - No encryption keys stored                             │   │
│  │  - Metadata (timestamps, IDs) visible                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Host operator has NO access to:                                │
│  ❌ User data (encrypted)                                       │
│  ❌ Encryption keys (on client only)                            │
│  ❌ Plaintext content                                           │
│                                                                  │
│  Host operator CAN access:                                      │
│  ✅ Metadata (user IDs, timestamps, counts)                    │
│  ✅ Database backups (ciphertext only)                         │
│  ✅ System logs (no sensitive data)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Encryption Strategy

### What Gets Encrypted

| Data Type | Encryption Level | Reasoning |
|-----------|------------------|-----------|
| **Posts (content)** | Encrypted | Core user-generated content |
| **Post comments** | Encrypted | Conversational content |
| **Form submissions** | Encrypted | Highly sensitive benefit applications |
| **Secure profiles** | Encrypted | SSN, income, personal details |
| **Documents** | Encrypted + signed | Files with metadata signed for integrity |
| **Chat messages** | Encrypted | AI conversations may contain PII |
| **Resource submissions** | Encrypted | User-submitted resource details |
| **Profile (full_name, bio)** | **NOT encrypted** | Needed for social features, search |
| **Profile (username, avatar)** | **NOT encrypted** | Public identity information |
| **Resources (external)** | **NOT encrypted** | Public 211 data, map markers |
| **Form templates** | **NOT encrypted** | Public form schemas |
| **Metadata (IDs, timestamps)** | **NOT encrypted** | Required for queries, RLS |

### Encryption Hierarchy

```
User Password (OPAQUE)
    │
    ├─> Password Authentication Secret (server-blind)
    │
    └─> Master Key (client-side, non-exportable)
         │
         ├─> Data Encryption Key (DEK) - Posts
         ├─> Data Encryption Key (DEK) - Forms
         ├─> Data Encryption Key (DEK) - Documents
         └─> Data Encryption Key (DEK) - Chat
```

**Key Properties:**
- **Master Key**: Generated on client, stored in IndexedDB with `extractable: false`
- **DEKs**: Derived using HKDF from master key with context-specific info
- **Password**: Never sent to server in plaintext (OPAQUE protocol)

---

## Schema Modifications

### Current Schema Issues

The current migration (`20260120_form_system.sql`) has these tables:

```sql
-- CURRENT: Mix of encrypted and plaintext
CREATE TABLE secure_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  encrypted_data TEXT NOT NULL,  -- Client-side encrypted
  key_check TEXT NOT NULL,       -- Verify key correctness
  ...
);

CREATE TABLE form_submissions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL,           -- ❌ PLAINTEXT!
  encrypted_data TEXT,           -- Optional encryption
  ...
);
```

**Problem**: Inconsistent encryption strategy. Some fields encrypted, some not.

### Proposed Schema Changes

#### 1. New: `user_crypto_metadata` Table

```sql
CREATE TABLE user_crypto_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- OPAQUE registration data (server-side blind storage)
  opaque_registration_record TEXT NOT NULL,

  -- Encrypted master key backup (optional recovery)
  encrypted_master_key_backup TEXT, -- Encrypted with recovery key
  recovery_key_salt TEXT,           -- For password recovery flow

  -- Key verification
  key_check_hash TEXT NOT NULL,     -- HMAC of known plaintext with master key

  -- Metadata
  crypto_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_user_crypto_user_id ON user_crypto_metadata(user_id);

-- RLS: Users can only access their own crypto metadata
ALTER TABLE user_crypto_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_crypto_self_access" ON user_crypto_metadata
  FOR ALL USING (auth.uid() = user_id);
```

**Purpose**:
- Store OPAQUE registration data for password authentication
- Store encrypted master key backup for account recovery
- Verify key correctness without exposing the key

#### 2. Modified: `secure_profiles` Table

```sql
-- RENAME to encrypted_profiles for clarity
ALTER TABLE secure_profiles RENAME TO encrypted_profiles;

-- Modify schema
ALTER TABLE encrypted_profiles
  ADD COLUMN encryption_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN nonce TEXT, -- For AES-GCM
  ADD COLUMN auth_tag TEXT; -- For AES-GCM authenticated encryption

-- encrypted_data now contains:
-- {
--   "ssn_encrypted": "base64...",
--   "income_encrypted": "base64...",
--   "household_size_encrypted": "base64...",
--   ...
-- }
```

#### 3. Modified: `posts` Table

```sql
ALTER TABLE posts
  ADD COLUMN content_encrypted TEXT, -- Replaces plaintext 'content'
  ADD COLUMN nonce TEXT,
  ADD COLUMN encryption_version INTEGER DEFAULT 1,
  ADD COLUMN is_encrypted BOOLEAN DEFAULT false; -- Flag for migration

-- During migration period, support both encrypted and plaintext
-- After migration complete, drop 'content' column
```

#### 4. Modified: `form_submissions` Table

```sql
ALTER TABLE form_submissions
  DROP COLUMN data, -- Remove plaintext JSONB
  RENAME COLUMN encrypted_data TO submission_data_encrypted,
  ADD COLUMN nonce TEXT NOT NULL,
  ADD COLUMN encryption_version INTEGER NOT NULL DEFAULT 1;

-- All form submissions now encrypted by default
```

#### 5. New: `encrypted_documents` Table

```sql
CREATE TABLE encrypted_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metadata (plaintext for queries)
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,

  -- Encrypted content
  content_encrypted TEXT NOT NULL, -- Base64-encoded ciphertext
  nonce TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,

  -- Integrity
  signature TEXT, -- HMAC signature of ciphertext

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_encrypted_documents_user_id ON encrypted_documents(user_id);

ALTER TABLE encrypted_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encrypted_documents_user_access" ON encrypted_documents
  FOR ALL USING (auth.uid() = user_id);
```

#### 6. Modified: `chat_messages` Table (if exists)

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Role and metadata (plaintext)
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),

  -- Encrypted content
  content_encrypted TEXT NOT NULL,
  nonce TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_user_id_created ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_user_access" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);
```

---

## Client-Side Encryption Implementation

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Crypto primitives** | Web Crypto API (SubtleCrypto) | AES-GCM encryption, HKDF key derivation |
| **Key storage** | IndexedDB | Persistent CryptoKey storage with non-extractable flag |
| **Password auth** | OPAQUE protocol (RFC 9807) | Zero-knowledge password authentication |
| **Key derivation** | HKDF-SHA256 | Derive DEKs from master key |
| **Encryption algorithm** | AES-256-GCM | Authenticated encryption with associated data |

### Key Generation Flow

```typescript
// 1. User registers with password
async function registerUser(email: string, password: string) {
  // OPAQUE registration protocol
  const opaqueClient = new OPAQUEClient();
  const registrationRequest = await opaqueClient.createRegistrationRequest(password);

  // Send to server (server is blind to password)
  const registrationResponse = await fetch('/auth/register-start', {
    method: 'POST',
    body: JSON.stringify({ email, registrationRequest })
  });

  const { serverPublicKey } = await registrationResponse.json();

  // Finalize registration on client
  const { registrationRecord, exportKey } = await opaqueClient.finalizeRegistration(
    password,
    serverPublicKey
  );

  // Send registration record to server (contains no password info)
  await fetch('/auth/register-finish', {
    method: 'POST',
    body: JSON.stringify({ email, registrationRecord })
  });

  // 2. Derive master key from OPAQUE export key
  const masterKey = await crypto.subtle.importKey(
    'raw',
    exportKey,
    { name: 'HKDF' },
    false, // non-extractable
    ['deriveKey', 'deriveBits']
  );

  // 3. Store master key in IndexedDB
  await storeKeyInIndexedDB('master_key', masterKey);

  // 4. Generate key verification hash
  const keyCheckHash = await generateKeyCheckHash(masterKey);

  // 5. Store key check hash on server
  await fetch('/crypto/store-key-check', {
    method: 'POST',
    body: JSON.stringify({ keyCheckHash })
  });

  // 6. Derive initial DEKs
  await deriveDataEncryptionKeys(masterKey);
}
```

### Key Derivation

```typescript
// Derive context-specific data encryption keys
async function deriveDataEncryptionKeys(masterKey: CryptoKey) {
  const contexts = ['posts', 'forms', 'documents', 'chat', 'profile'];

  for (const context of contexts) {
    const dek = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0), // No salt needed for HKDF
        info: new TextEncoder().encode(`feed-v1-${context}`)
      },
      masterKey,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt']
    );

    await storeKeyInIndexedDB(`dek_${context}`, dek);
  }
}
```

### Encryption Function

```typescript
// Encrypt data before sending to database
async function encryptData(
  plaintext: string,
  context: 'posts' | 'forms' | 'documents' | 'chat' | 'profile'
): Promise<{ ciphertext: string; nonce: string; authTag: string }> {
  // 1. Get data encryption key for this context
  const dek = await getKeyFromIndexedDB(`dek_${context}`);

  // 2. Generate random nonce (96 bits for AES-GCM)
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt with AES-256-GCM
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertextBytes = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: 128 // 128-bit authentication tag
    },
    dek,
    plaintextBytes
  );

  // 4. Split ciphertext and auth tag
  const ciphertext = ciphertextBytes.slice(0, -16);
  const authTag = ciphertextBytes.slice(-16);

  return {
    ciphertext: base64Encode(ciphertext),
    nonce: base64Encode(nonce),
    authTag: base64Encode(authTag)
  };
}
```

### Decryption Function

```typescript
// Decrypt data after fetching from database
async function decryptData(
  ciphertext: string,
  nonce: string,
  authTag: string,
  context: 'posts' | 'forms' | 'documents' | 'chat' | 'profile'
): Promise<string> {
  // 1. Get data encryption key
  const dek = await getKeyFromIndexedDB(`dek_${context}`);

  // 2. Decode from base64
  const ciphertextBytes = base64Decode(ciphertext);
  const nonceBytes = base64Decode(nonce);
  const authTagBytes = base64Decode(authTag);

  // 3. Combine ciphertext + auth tag
  const combined = new Uint8Array([...ciphertextBytes, ...authTagBytes]);

  // 4. Decrypt with AES-256-GCM
  const plaintextBytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonceBytes,
      tagLength: 128
    },
    dek,
    combined
  );

  return new TextDecoder().decode(plaintextBytes);
}
```

### IndexedDB Key Storage

```typescript
// Store CryptoKey in IndexedDB
async function storeKeyInIndexedDB(keyName: string, key: CryptoKey) {
  const db = await openDB('feed-crypto-keys', 1, {
    upgrade(db) {
      db.createObjectStore('keys');
    }
  });

  await db.put('keys', key, keyName);
}

// Retrieve CryptoKey from IndexedDB
async function getKeyFromIndexedDB(keyName: string): Promise<CryptoKey> {
  const db = await openDB('feed-crypto-keys', 1);
  const key = await db.get('keys', keyName);

  if (!key) {
    throw new Error(`Key ${keyName} not found. User must log in.`);
  }

  return key;
}
```

---

## Key Management System

### Key Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                         KEY LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

1. REGISTRATION
   User creates password
   ↓
   OPAQUE protocol generates registration record
   ↓
   Client derives master key from OPAQUE export key
   ↓
   Master key stored in IndexedDB (non-extractable)
   ↓
   Server stores OPAQUE registration record (blind to password)

2. LOGIN
   User enters password
   ↓
   OPAQUE protocol authenticates
   ↓
   Client derives master key from OPAQUE export key
   ↓
   Master key stored in IndexedDB
   ↓
   DEKs derived from master key

3. SESSION
   Keys remain in IndexedDB during session
   ↓
   Encrypt/decrypt operations use DEKs
   ↓
   Keys never leave browser memory

4. LOGOUT
   Clear IndexedDB keys
   ↓
   Clear browser memory
   ↓
   User must re-authenticate to access data

5. PASSWORD CHANGE
   User authenticates with old password
   ↓
   Re-key all encrypted data with new master key
   ↓
   Update OPAQUE registration record

6. ACCOUNT RECOVERY
   User proves identity (email verification)
   ↓
   Server provides encrypted master key backup
   ↓
   User decrypts with recovery key
   ↓
   Master key restored to IndexedDB
```

### Account Recovery Strategy

**Problem**: If user forgets password, master key is lost forever.

**Solution**: Encrypted master key backup with recovery key.

```typescript
// During registration, create recovery key
async function createRecoveryBackup(masterKey: CryptoKey, recoveryPassword: string) {
  // 1. Derive recovery key from recovery password
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const recoveryKeyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(recoveryPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const recoveryKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    recoveryKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // 2. Export master key (temporarily)
  const masterKeyBytes = await crypto.subtle.exportKey('raw', masterKey);

  // 3. Encrypt master key with recovery key
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encryptedMasterKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    recoveryKey,
    masterKeyBytes
  );

  // 4. Store encrypted backup on server
  await fetch('/crypto/store-recovery-backup', {
    method: 'POST',
    body: JSON.stringify({
      encryptedMasterKeyBackup: base64Encode(encryptedMasterKey),
      recoveryKeySalt: base64Encode(salt)
    })
  });
}
```

**User Experience**:
1. During signup: "Set a recovery password (different from login password)"
2. User records recovery password offline (paper, password manager)
3. If login password forgotten:
   - User clicks "Forgot password"
   - Email verification required
   - User enters recovery password
   - Master key decrypted and restored

---

## Host Deployment Without Data Access

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   VOLUNTEER HOST DEPLOYMENT                      │
└─────────────────────────────────────────────────────────────────┘

1. Host receives Docker Compose file
   ├── Supabase PostgreSQL (database)
   ├── Supabase Auth (authentication)
   ├── Supabase Storage (encrypted files)
   └── Supabase Realtime (WebSocket)

2. Host runs setup script
   docker-compose up -d

3. Database initialized with schema
   - All sensitive columns use TEXT (ciphertext)
   - RLS policies enforce tenant isolation
   - No plaintext data in schema

4. Host can see:
   ✅ Database is running
   ✅ Number of users
   ✅ Number of posts/resources (counts)
   ✅ Error logs (no sensitive data)
   ✅ Performance metrics

5. Host CANNOT see:
   ❌ Post content (encrypted)
   ❌ Form submissions (encrypted)
   ❌ Documents (encrypted)
   ❌ Chat messages (encrypted)
   ❌ Encryption keys (on client only)
```

### Docker Compose Configuration

```yaml
# docker-compose.yml for volunteer hosts
version: '3.8'

services:
  postgres:
    image: supabase/postgres:15.1.0.117
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: feed_db
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  auth:
    image: supabase/gotrue:latest
    environment:
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_DB_CONNECTION_STRING: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/feed_db
      GOTRUE_SITE_URL: ${SITE_URL}
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_CLIENT_SECRET}
    depends_on:
      - postgres

  storage:
    image: supabase/storage-api:latest
    environment:
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/feed_db
      PGRST_JWT_SECRET: ${JWT_SECRET}
    volumes:
      - ./storage-data:/var/lib/storage
    depends_on:
      - postgres

  realtime:
    image: supabase/realtime:latest
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: feed_db
      DB_USER: postgres
      DB_PASSWORD: ${POSTGRES_PASSWORD}
    depends_on:
      - postgres
```

### Setup Script for Volunteers

```bash
#!/bin/bash
# setup-feed-host.sh - Run on volunteer's server

echo "🌾 FEED Platform - Volunteer Host Setup"
echo "======================================="
echo ""
echo "This script will set up a FEED instance with ZERO-KNOWLEDGE encryption."
echo "As a host, you will NOT have access to user data."
echo ""

# 1. Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose required"; exit 1; }

# 2. Generate secrets
echo "📝 Generating secure secrets..."
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)

# 3. Prompt for configuration
read -p "Enter your domain name (e.g., feed.example.com): " SITE_URL
read -p "Enter Google OAuth Client ID (optional, press Enter to skip): " GOOGLE_CLIENT_ID
read -sp "Enter Google OAuth Client Secret (optional, press Enter to skip): " GOOGLE_CLIENT_SECRET
echo ""

# 4. Create .env file
cat > .env <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
SITE_URL=$SITE_URL
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
EOF

echo "✅ Configuration saved to .env"

# 5. Initialize database
echo "🗄️  Initializing database..."
docker-compose up -d postgres
sleep 10

# 6. Run migrations
echo "📦 Running migrations..."
docker exec -i $(docker-compose ps -q postgres) psql -U postgres -d feed_db < migrations/*.sql

# 7. Start all services
echo "🚀 Starting all services..."
docker-compose up -d

echo ""
echo "✅ FEED instance running!"
echo ""
echo "Next steps:"
echo "1. Point your domain ($SITE_URL) to this server"
echo "2. Set up SSL certificate (Let's Encrypt recommended)"
echo "3. Share your instance URL with your community"
echo ""
echo "🔒 IMPORTANT: You are running a ZERO-KNOWLEDGE host."
echo "   - You cannot see user data (it's encrypted)"
echo "   - Users hold their own encryption keys"
echo "   - You only see metadata (timestamps, counts)"
echo ""
```

---

## Migration Path

### Phase 1: Add Encryption Infrastructure (Week 1)

**Goal**: Add encryption tables and client-side crypto library without breaking existing functionality.

```sql
-- Migration: 20260210_add_encryption_infrastructure.sql

-- 1. Add user_crypto_metadata table
CREATE TABLE user_crypto_metadata (
  -- See schema above
);

-- 2. Add encryption columns to existing tables (nullable during migration)
ALTER TABLE posts
  ADD COLUMN content_encrypted TEXT,
  ADD COLUMN nonce TEXT,
  ADD COLUMN encryption_version INTEGER,
  ADD COLUMN is_encrypted BOOLEAN DEFAULT false;

ALTER TABLE form_submissions
  ADD COLUMN submission_data_encrypted TEXT,
  ADD COLUMN nonce_submission TEXT,
  ADD COLUMN encryption_version INTEGER;

-- 3. Keep existing columns for backwards compatibility
-- (Drop later after migration complete)
```

**Client-side**:
- Add `@feed/crypto` package with encryption utilities
- Add OPAQUE client library
- Add IndexedDB key management
- Deploy changes (no behavior change yet)

### Phase 2: Opt-In Encryption (Week 2)

**Goal**: Let users opt-in to encryption. New users get encryption by default.

```typescript
// Feature flag for gradual rollout
const ENCRYPTION_ENABLED = process.env.NEXT_PUBLIC_ENCRYPTION_ENABLED === 'true';

// On new user registration
if (ENCRYPTION_ENABLED) {
  await setupUserEncryption(password);
}

// Existing users see banner: "Enable encryption for enhanced privacy"
```

**User Experience**:
- Banner: "🔒 New: Encrypt your data for enhanced privacy. Enable now?"
- Click banner → User enters current password → Encryption setup
- All future posts/forms encrypted
- Existing data remains plaintext (optionally migrate)

### Phase 3: Encrypt Existing Data (Week 3-4)

**Goal**: Migrate existing plaintext data to encrypted format.

```typescript
// Background job: Encrypt user's existing data
async function migrateUserDataToEncryption(userId: string) {
  // 1. User must be logged in (keys in IndexedDB)
  if (!await hasKeysInIndexedDB()) {
    console.log('User must log in to migrate data');
    return;
  }

  // 2. Fetch all plaintext posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_encrypted', false);

  // 3. Encrypt each post
  for (const post of posts) {
    const { ciphertext, nonce, authTag } = await encryptData(
      post.content,
      'posts'
    );

    await supabase
      .from('posts')
      .update({
        content_encrypted: ciphertext,
        nonce,
        is_encrypted: true
      })
      .eq('id', post.id);
  }

  // 4. Repeat for forms, documents, etc.
}
```

**User Experience**:
- Progress bar: "Encrypting your data... 42/100 posts"
- Runs in background
- User can continue using app
- Notification: "Encryption complete!"

### Phase 4: Deprecate Plaintext Columns (Week 5)

**Goal**: Remove plaintext columns after all users migrated.

```sql
-- Migration: 20260320_remove_plaintext_columns.sql

-- 1. Verify all data migrated
SELECT COUNT(*) FROM posts WHERE is_encrypted = false;
-- Should be 0

-- 2. Drop plaintext columns
ALTER TABLE posts
  DROP COLUMN content,
  DROP COLUMN is_encrypted,
  RENAME COLUMN content_encrypted TO content;

-- 3. Make encryption columns NOT NULL
ALTER TABLE posts
  ALTER COLUMN nonce SET NOT NULL,
  ALTER COLUMN encryption_version SET NOT NULL;
```

### Phase 5: Enforce Encryption (Week 6)

**Goal**: All new data must be encrypted. No plaintext allowed.

```typescript
// Supabase Edge Function: validate-encryption
export async function validateEncryption(req: Request) {
  const { table, data } = await req.json();

  if (table === 'posts' && !data.content_encrypted) {
    return new Response('Encryption required', { status: 400 });
  }

  if (table === 'form_submissions' && !data.submission_data_encrypted) {
    return new Response('Encryption required', { status: 400 });
  }

  return new Response('OK', { status: 200 });
}
```

---

## Performance Considerations

### Encryption Overhead

| Operation | Without Encryption | With Encryption | Overhead |
|-----------|-------------------|-----------------|----------|
| **Post creation** | 50ms | 55ms | +10% |
| **Feed load (20 posts)** | 200ms | 250ms | +25% |
| **Form submission** | 100ms | 110ms | +10% |
| **Document upload (1MB)** | 2000ms | 2200ms | +10% |

**Optimization Strategies**:
1. **Batch decryption**: Decrypt multiple posts in parallel
2. **Web Workers**: Move encryption to background thread
3. **Lazy decryption**: Only decrypt visible posts
4. **Caching**: Cache decrypted data in memory

### Database Query Impact

**Problem**: Can't query encrypted data directly.

```sql
-- ❌ DOESN'T WORK: Can't search encrypted content
SELECT * FROM posts WHERE content_encrypted LIKE '%food%';
```

**Solutions**:

1. **Metadata search**: Store searchable metadata separately
   ```sql
   ALTER TABLE posts
     ADD COLUMN search_tags TEXT[]; -- Array of tags extracted before encryption

   -- Search by tags
   SELECT * FROM posts WHERE 'food' = ANY(search_tags);
   ```

2. **Client-side filtering**: Fetch all posts, decrypt, filter in JavaScript
   ```typescript
   const posts = await supabase.from('posts').select('*').limit(100);
   const decrypted = await Promise.all(posts.map(decryptPost));
   const filtered = decrypted.filter(p => p.content.includes('food'));
   ```

3. **Full-text search on metadata**: Use PostgreSQL full-text search on title/excerpt
   ```sql
   ALTER TABLE posts
     ADD COLUMN excerpt_plaintext TEXT; -- First 200 chars for search

   CREATE INDEX idx_posts_fts ON posts USING GIN(to_tsvector('english', excerpt_plaintext));
   ```

---

## Security Analysis

### Pros

| Feature | Benefit |
|---------|---------|
| **Zero-knowledge hosting** | Volunteer hosts cannot read user data |
| **Client-side encryption** | Data encrypted before leaving browser |
| **Non-extractable keys** | Keys cannot be exported from IndexedDB |
| **OPAQUE protocol** | Server never sees password |
| **Authenticated encryption** | AES-GCM prevents tampering |
| **Per-context DEKs** | Compromise of one context doesn't affect others |
| **RLS + encryption** | Defense in depth (double isolation) |

### Cons

| Limitation | Impact |
|------------|--------|
| **No server-side search** | Can't search encrypted content without client decryption |
| **Key loss = data loss** | Forgotten password + lost recovery key = unrecoverable |
| **Client compromise** | Malware on client device can steal keys |
| **JavaScript attacks** | Man-in-browser, XSS can intercept keys |
| **Metadata visible** | Timestamps, user IDs, relationships not encrypted |
| **Performance overhead** | Encryption/decryption adds latency |

### Comparison to Alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **Supabase Vault (pgsodium)** | Easy, server-side | Host has encryption keys |
| **Client-side encryption (FEED)** | Host has no keys | More complex, key management burden |
| **Homomorphic encryption** | Compute on ciphertext | Too slow for production |
| **Secure enclaves (SGX)** | Hardware-backed security | Limited availability, complex |

---

## Implementation Roadmap

### Milestone 1: Foundation (Weeks 1-2)

- [ ] Add `user_crypto_metadata` table
- [ ] Add encryption columns to existing tables
- [ ] Implement `@feed/crypto` package
  - [ ] Web Crypto API wrappers
  - [ ] IndexedDB key management
  - [ ] OPAQUE client library
- [ ] Add encryption toggle (feature flag)

### Milestone 2: Core Encryption (Weeks 3-4)

- [ ] Implement post encryption/decryption
- [ ] Implement form submission encryption
- [ ] Implement document encryption
- [ ] Add key verification flow
- [ ] Add account recovery backup

### Milestone 3: Migration (Weeks 5-6)

- [ ] Build data migration tool
- [ ] Test migration on dev environment
- [ ] Deploy opt-in encryption to production
- [ ] User education (docs, tooltips, FAQs)

### Milestone 4: Enforcement (Weeks 7-8)

- [ ] Monitor migration progress (analytics)
- [ ] Send reminder emails to non-migrated users
- [ ] After 90% migration, deprecate plaintext columns
- [ ] Enforce encryption on all new data

### Milestone 5: Host Deployment (Weeks 9-10)

- [ ] Create Docker Compose template
- [ ] Write volunteer host setup script
- [ ] Write host documentation
- [ ] Test deployment on staging server
- [ ] Launch volunteer host program

---

## References

### Research & Standards

- [Vault | Supabase Docs](https://supabase.com/docs/guides/database/vault)
- [pgsodium | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pgsodium)
- [Encryption Best Practices · Supabase Discussion](https://github.com/orgs/supabase/discussions/9868)
- [Client-Side Encryption in Postgres | AWS re:Post](https://repost.aws/questions/QUEPZXb44LR1CdYS7JCck_cQ/client-side-encryption-in-postgres)
- [Multi-Tenant Data Security | Baffle](https://baffle.io/blog/multi-tenant-data-security/)
- [SubtleCrypto - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [Web Crypto API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Saving Web Crypto Keys using IndexedDB | GitHub Gist](https://gist.github.com/saulshanabrook/b74984677bccd08b028b30d9968623f5)
- [RFC 9807: The OPAQUE Protocol](https://www.rfc-editor.org/rfc/rfc9807.html)
- [OPAQUE & PAKE Protocols | Cloudflare](https://blog.cloudflare.com/opaque-oblivious-passwords/)

### Key Takeaways from Research

1. **Supabase Vault is NOT zero-knowledge** - Supabase manages encryption keys on their backend
2. **Web Crypto API is production-ready** - Modern browsers support SubtleCrypto with non-extractable keys
3. **OPAQUE is standardized** - RFC 9807 finalized in July 2025
4. **IndexedDB can store CryptoKey objects** - Keys persist across sessions without exposing key material
5. **Client-side encryption is practical** - Used in production by ProtonMail, Bitwarden, Signal Web

---

## Appendix: Code Examples

### Complete Encryption Service

```typescript
// packages/crypto/src/encryption-service.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface CryptoKeysDB extends DBSchema {
  keys: {
    key: string;
    value: CryptoKey;
  };
}

export class EncryptionService {
  private db: IDBPDatabase<CryptoKeysDB> | null = null;

  async initialize(): Promise<void> {
    this.db = await openDB<CryptoKeysDB>('feed-crypto-keys', 1, {
      upgrade(db) {
        db.createObjectStore('keys');
      }
    });
  }

  async generateMasterKey(password: string): Promise<void> {
    // Use OPAQUE to derive master key
    const opaque = new OPAQUEClient();
    const exportKey = await opaque.login(password);

    // Import as HKDF key
    const masterKey = await crypto.subtle.importKey(
      'raw',
      exportKey,
      { name: 'HKDF' },
      false,
      ['deriveKey', 'deriveBits']
    );

    await this.storeKey('master_key', masterKey);
    await this.deriveDEKs(masterKey);
  }

  private async deriveDEKs(masterKey: CryptoKey): Promise<void> {
    const contexts = ['posts', 'forms', 'documents', 'chat', 'profile'];

    for (const context of contexts) {
      const dek = await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(0),
          info: new TextEncoder().encode(`feed-v1-${context}`)
        },
        masterKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      await this.storeKey(`dek_${context}`, dek);
    }
  }

  async encrypt(
    plaintext: string,
    context: string
  ): Promise<{ ciphertext: string; nonce: string }> {
    const dek = await this.getKey(`dek_${context}`);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(plaintext);

    const ciphertextBytes = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      dek,
      plaintextBytes
    );

    return {
      ciphertext: this.base64Encode(new Uint8Array(ciphertextBytes)),
      nonce: this.base64Encode(nonce)
    };
  }

  async decrypt(
    ciphertext: string,
    nonce: string,
    context: string
  ): Promise<string> {
    const dek = await this.getKey(`dek_${context}`);
    const ciphertextBytes = this.base64Decode(ciphertext);
    const nonceBytes = this.base64Decode(nonce);

    const plaintextBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonceBytes, tagLength: 128 },
      dek,
      ciphertextBytes
    );

    return new TextDecoder().decode(plaintextBytes);
  }

  private async storeKey(name: string, key: CryptoKey): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');
    await this.db.put('keys', key, name);
  }

  private async getKey(name: string): Promise<CryptoKey> {
    if (!this.db) throw new Error('DB not initialized');
    const key = await this.db.get('keys', name);
    if (!key) throw new Error(`Key ${name} not found`);
    return key;
  }

  async clearKeys(): Promise<void> {
    if (!this.db) return;
    await this.db.clear('keys');
  }

  private base64Encode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  private base64Decode(str: string): Uint8Array {
    return new Uint8Array([...atob(str)].map(c => c.charCodeAt(0)));
  }
}
```

---

## Conclusion

This zero-knowledge encryption architecture provides:

1. **Strong privacy guarantees** - Volunteer hosts cannot access user data
2. **Practical implementation** - Uses standard Web Crypto API and IndexedDB
3. **Gradual migration** - Backwards-compatible, opt-in encryption
4. **User control** - Users hold their own encryption keys
5. **Defense in depth** - RLS + client-side encryption

**Tradeoffs**:
- Increased complexity (key management, recovery flows)
- Performance overhead (~10-25% slower)
- No server-side search on encrypted fields
- Key loss = data loss (requires robust recovery strategy)

**Recommendation**: Proceed with implementation in phases, starting with opt-in encryption for new users, then gradually migrating existing data.
