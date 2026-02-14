# FEED Federation Implementation Guide

**Version**: 1.0
**Created**: 2026-02-05
**Companion to**: FEDERATION_PROTOCOL.md

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Database Setup](#database-setup)
3. [Code Examples](#code-examples)
4. [Testing Federation](#testing-federation)
5. [Deployment Checklist](#deployment-checklist)

---

## 1. Quick Start

### Prerequisites

- FEED instance running (Phase 6 complete)
- Supabase PostgreSQL database
- Redis (for rate limiting and caching)
- Node.js 20+
- OpenSSL (for key generation)

### 5-Minute Setup

```bash
# 1. Generate federation keypair
npm run federation:generate-keys

# 2. Run database migrations
npx supabase migration up

# 3. Add environment variables
echo "FEED_FEDERATION_PRIVATE_KEY=\"$(cat private_key.pem)\"" >> .env.local
echo "REDIS_URL=\"redis://localhost:6379\"" >> .env.local

# 4. Start federation sync job
npm run federation:sync

# 5. Add your first federation partner
npm run federation:add-instance -- \
  --domain oakland.feed.social \
  --name "Oakland FEED" \
  --contact admin@oakland.feed.social
```

---

## 2. Database Setup

### Migration: 001_federation_tables.sql

```sql
-- ============================================
-- Federation Tables
-- ============================================

-- Federated Instances
CREATE TABLE federated_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  public_key TEXT NOT NULL,
  trust_level NUMERIC NOT NULL DEFAULT 0.5 CHECK (trust_level >= 0 AND trust_level <= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'offline')),

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Trust score components
  uptime_score NUMERIC NOT NULL DEFAULT 1.0,
  data_quality_score NUMERIC NOT NULL DEFAULT 1.0,
  moderation_score NUMERIC NOT NULL DEFAULT 1.0,
  community_reports_score NUMERIC NOT NULL DEFAULT 1.0,
  longevity_score NUMERIC NOT NULL DEFAULT 0.0,

  -- Health tracking
  last_health_check TIMESTAMPTZ,
  health_check_failures INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  first_federated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_federated_instances_domain ON federated_instances(domain);
CREATE INDEX idx_federated_instances_status ON federated_instances(status);
CREATE INDEX idx_federated_instances_trust_level ON federated_instances(trust_level);

-- Federated Resources
CREATE TABLE federated_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_instance_id UUID NOT NULL REFERENCES federated_instances(id) ON DELETE CASCADE,
  origin_resource_id TEXT NOT NULL,

  -- Resource data (denormalized for performance)
  data JSONB NOT NULL,

  -- Tracking
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,

  UNIQUE(origin_instance_id, origin_resource_id)
);

-- Indexes
CREATE INDEX idx_federated_resources_origin_instance ON federated_resources(origin_instance_id);
CREATE INDEX idx_federated_resources_is_stale ON federated_resources(is_stale);
CREATE INDEX idx_federated_resources_last_synced ON federated_resources(last_synced_at);

-- GIN index for JSONB data (enables fast queries on resource properties)
CREATE INDEX idx_federated_resources_data ON federated_resources USING GIN (data);

-- Sync Log
CREATE TABLE federation_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES federated_instances(id) ON DELETE CASCADE,
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_completed_at TIMESTAMPTZ,

  -- Metrics
  resources_fetched INTEGER NOT NULL DEFAULT 0,
  resources_updated INTEGER NOT NULL DEFAULT 0,
  resources_added INTEGER NOT NULL DEFAULT 0,

  -- Error tracking
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_federation_sync_log_instance ON federation_sync_log(instance_id);
CREATE INDEX idx_federation_sync_log_status ON federation_sync_log(status);
CREATE INDEX idx_federation_sync_log_created ON federation_sync_log(created_at DESC);

-- Trust Attestations
CREATE TABLE trust_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attestor_instance_id UUID NOT NULL REFERENCES federated_instances(id) ON DELETE CASCADE,
  target_instance_id UUID NOT NULL REFERENCES federated_instances(id) ON DELETE CASCADE,

  rating NUMERIC NOT NULL CHECK (rating >= 0 AND rating <= 1),
  summary TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(attestor_instance_id, target_instance_id)
);

-- Blocklist
CREATE TABLE federation_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'malicious', 'policy_violation', 'downtime', 'other')),
  evidence TEXT,

  added_by TEXT NOT NULL, -- admin email
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_federation_blocklist_domain ON federation_blocklist(domain);

-- Resource Conflicts (for manual review)
CREATE TABLE federated_resource_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES federated_resources(id) ON DELETE CASCADE,

  conflict_type TEXT NOT NULL, -- 'duplicate', 'divergent_data', 'deleted'
  conflicting_data JSONB,
  resolution TEXT, -- 'auto_resolved', 'manual_override', 'unresolved'

  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- Functions
-- ============================================

-- Update trust score
CREATE OR REPLACE FUNCTION calculate_trust_score(instance_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  trust_score NUMERIC;
BEGIN
  SELECT (
    uptime_score * 0.30 +
    data_quality_score * 0.25 +
    moderation_score * 0.20 +
    community_reports_score * 0.15 +
    longevity_score * 0.10
  ) INTO trust_score
  FROM federated_instances
  WHERE id = instance_id;

  RETURN trust_score;
END;
$$ LANGUAGE plpgsql;

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER federated_instances_updated_at
  BEFORE UPDATE ON federated_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================

-- Federated instances (read-only for authenticated users, write for admins)
ALTER TABLE federated_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "federated_instances_select" ON federated_instances
  FOR SELECT USING (true); -- Public read

CREATE POLICY "federated_instances_admin_insert" ON federated_instances
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "federated_instances_admin_update" ON federated_instances
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Federated resources (read-only)
ALTER TABLE federated_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "federated_resources_select" ON federated_resources
  FOR SELECT USING (is_stale = false);

-- Sync log (admin only)
ALTER TABLE federation_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "federation_sync_log_admin_select" ON federation_sync_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Trust attestations (read-only)
ALTER TABLE trust_attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trust_attestations_select" ON trust_attestations
  FOR SELECT USING (true);

-- Blocklist (read-only for users, write for admins)
ALTER TABLE federation_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "federation_blocklist_select" ON federation_blocklist
  FOR SELECT USING (true);

CREATE POLICY "federation_blocklist_admin_insert" ON federation_blocklist
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
```

---

## 3. Code Examples

### 3.1 Key Generation CLI Tool

**File**: `scripts/federation/generate-keys.ts`

```typescript
#!/usr/bin/env tsx

import { generateKeyPairSync } from 'crypto';
import { writeFileSync } from 'fs';

console.log('🔑 Generating RSA-4096 keypair for federation...\n');

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// Write to files
writeFileSync('private_key.pem', privateKey);
writeFileSync('public_key.pem', publicKey);

console.log('✅ Keypair generated successfully!\n');
console.log('📄 Files created:');
console.log('   - private_key.pem (KEEP SECRET!)');
console.log('   - public_key.pem (publish in instance metadata)\n');
console.log('⚠️  Next steps:');
console.log('   1. Add private key to .env.local:');
console.log('      FEED_FEDERATION_PRIVATE_KEY="$(cat private_key.pem)"');
console.log('   2. Delete private_key.pem (it\'s now in env)');
console.log('   3. Public key will be published automatically\n');
```

### 3.2 HTTP Signature Utilities

**File**: `packages/shared/lib/federation/http-signature.ts`

```typescript
import crypto from 'crypto';

export interface SignatureParams {
  keyId: string; // URL to public key
  algorithm: 'rsa-sha256';
  headers: string[]; // e.g., ['(request-target)', 'host', 'date', 'digest']
  signature: string; // Base64-encoded signature
}

/**
 * Sign an HTTP request
 */
export function signRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: string | null,
  privateKey: string,
  keyId: string
): string {
  // Build signing string
  const signingHeaders = ['(request-target)', 'host', 'date'];

  if (body) {
    // Add digest header
    const digest = crypto.createHash('sha256').update(body).digest('base64');
    headers['digest'] = `SHA-256=${digest}`;
    signingHeaders.push('digest');
  }

  const signingString = signingHeaders
    .map((header) => {
      if (header === '(request-target)') {
        return `(request-target): ${method.toLowerCase()} ${path}`;
      }
      return `${header}: ${headers[header]}`;
    })
    .join('\n');

  // Sign with private key
  const sign = crypto.createSign('SHA256');
  sign.update(signingString);
  const signature = sign.sign(privateKey, 'base64');

  // Build signature header
  return [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${signingHeaders.join(' ')}"`,
    `signature="${signature}"`,
  ].join(',');
}

/**
 * Verify a signed HTTP request
 */
export async function verifyRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: string | null,
  publicKey: string
): Promise<boolean> {
  const signatureHeader = headers['signature'];
  if (!signatureHeader) {
    throw new Error('Missing signature header');
  }

  // Parse signature header
  const params = parseSignatureHeader(signatureHeader);

  // Build signing string
  const signingString = params.headers
    .map((header) => {
      if (header === '(request-target)') {
        return `(request-target): ${method.toLowerCase()} ${path}`;
      }
      return `${header}: ${headers[header]}`;
    })
    .join('\n');

  // Verify signature
  const verify = crypto.createVerify('SHA256');
  verify.update(signingString);

  try {
    return verify.verify(publicKey, params.signature, 'base64');
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

function parseSignatureHeader(header: string): SignatureParams {
  const params: any = {};

  header.split(',').forEach((part) => {
    const [key, value] = part.trim().split('=');
    params[key] = value.replace(/^"|"$/g, '');
  });

  return {
    keyId: params.keyId,
    algorithm: params.algorithm as 'rsa-sha256',
    headers: params.headers.split(' '),
    signature: params.signature,
  };
}
```

### 3.3 Federation Client

**File**: `packages/shared/lib/federation/client.ts`

```typescript
import { signRequest } from './http-signature';

export interface FederationClientOptions {
  instanceUrl: string; // https://oakland.feed.social
  privateKey: string;
  publicKeyId: string; // https://seattle.feed.social/api/federation/instance#main-key
}

export class FederationClient {
  private instanceUrl: string;
  private privateKey: string;
  private publicKeyId: string;

  constructor(options: FederationClientOptions) {
    this.instanceUrl = options.instanceUrl;
    this.privateKey = options.privateKey;
    this.publicKeyId = options.publicKeyId;
  }

  /**
   * Fetch instance metadata
   */
  async getInstanceMetadata(): Promise<any> {
    const url = new URL('/api/federation/instance', this.instanceUrl);
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch instance metadata: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send federation handshake
   */
  async sendHandshake(ownInstanceMetadata: any): Promise<any> {
    const path = '/api/federation/handshake';
    const body = JSON.stringify({
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'FederationRequest',
      actor: ownInstanceMetadata.id,
      to: `${this.instanceUrl}/api/federation/instance`,
      object: ownInstanceMetadata,
      published: new Date().toISOString(),
    });

    const headers = {
      host: new URL(this.instanceUrl).host,
      date: new Date().toUTCString(),
      'content-type': 'application/ld+json',
    };

    const signature = signRequest(
      'POST',
      path,
      headers,
      body,
      this.privateKey,
      this.publicKeyId
    );

    const response = await fetch(`${this.instanceUrl}${path}`, {
      method: 'POST',
      headers: {
        ...headers,
        signature,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Handshake failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Query resources
   */
  async queryResources(params: {
    category?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    limit?: number;
    offset?: number;
    lastModified?: string;
  }): Promise<any> {
    const url = new URL('/api/federation/resources', this.instanceUrl);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const path = url.pathname + url.search;
    const headers = {
      host: url.host,
      date: new Date().toUTCString(),
      accept: 'application/ld+json',
    };

    const signature = signRequest(
      'GET',
      path,
      headers,
      null,
      this.privateKey,
      this.publicKeyId
    );

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...headers,
        signature,
      },
    });

    if (!response.ok) {
      throw new Error(`Resource query failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = new URL('/api/federation/health', this.instanceUrl);
      const response = await fetch(url.toString(), { method: 'GET' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
```

### 3.4 Resource Sync Service

**File**: `packages/shared/lib/federation/sync-service.ts`

```typescript
import { FederationClient } from './client';
import { createClient } from '@supabase/supabase-js';

export class ResourceSyncService {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Sync resources from a federated instance
   */
  async syncInstance(instanceId: string): Promise<void> {
    // Get instance details
    const { data: instance, error: instanceError } = await this.supabase
      .from('federated_instances')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    // Create sync log entry
    const { data: syncLog, error: logError } = await this.supabase
      .from('federation_sync_log')
      .insert({
        instance_id: instanceId,
        sync_started_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to create sync log: ${logError.message}`);
    }

    try {
      // Get last sync time
      const { data: lastLog } = await this.supabase
        .from('federation_sync_log')
        .select('sync_completed_at')
        .eq('instance_id', instanceId)
        .eq('status', 'completed')
        .order('sync_completed_at', { ascending: false })
        .limit(1)
        .single();

      const lastModified = lastLog?.sync_completed_at;

      // Create federation client
      const client = new FederationClient({
        instanceUrl: `https://${instance.domain}`,
        privateKey: process.env.FEED_FEDERATION_PRIVATE_KEY!,
        publicKeyId: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/instance#main-key`,
      });

      // Fetch resources
      const result = await client.queryResources({
        lastModified,
        limit: 200,
      });

      let resourcesAdded = 0;
      let resourcesUpdated = 0;

      // Process resources
      for (const resource of result.orderedItems) {
        const existing = await this.supabase
          .from('federated_resources')
          .select('*')
          .eq('origin_instance_id', instanceId)
          .eq('origin_resource_id', resource['@id'])
          .single();

        if (!existing.data) {
          // Insert new resource
          await this.supabase.from('federated_resources').insert({
            origin_instance_id: instanceId,
            origin_resource_id: resource['@id'],
            data: resource,
            first_seen_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          });
          resourcesAdded++;
        } else {
          // Update existing resource
          await this.supabase
            .from('federated_resources')
            .update({
              data: resource,
              last_synced_at: new Date().toISOString(),
              is_stale: false,
            })
            .eq('id', existing.data.id);
          resourcesUpdated++;
        }
      }

      // Update sync log (success)
      await this.supabase
        .from('federation_sync_log')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'completed',
          resources_fetched: result.totalItems,
          resources_added: resourcesAdded,
          resources_updated: resourcesUpdated,
        })
        .eq('id', syncLog.id);

      console.log(`✅ Synced ${instance.name}: +${resourcesAdded}, ~${resourcesUpdated}`);
    } catch (error: any) {
      // Update sync log (failure)
      await this.supabase
        .from('federation_sync_log')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'failed',
          error: error.message,
        })
        .eq('id', syncLog.id);

      throw error;
    }
  }

  /**
   * Sync all active federated instances
   */
  async syncAll(): Promise<void> {
    const { data: instances, error } = await this.supabase
      .from('federated_instances')
      .select('id, name')
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch instances: ${error.message}`);
    }

    console.log(`🔄 Syncing ${instances.length} federated instances...`);

    for (const instance of instances) {
      try {
        await this.syncInstance(instance.id);
      } catch (error: any) {
        console.error(`❌ Failed to sync ${instance.name}:`, error.message);
      }
    }

    console.log('✅ Sync complete!');
  }
}
```

### 3.5 API Route: Instance Metadata

**File**: `apps/web/src/app/api/federation/instance/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';

export async function GET() {
  const publicKey = process.env.FEED_FEDERATION_PUBLIC_KEY ||
    readFileSync('public_key.pem', 'utf-8');

  const metadata = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Service',
    id: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/instance`,
    name: process.env.NEXT_PUBLIC_INSTANCE_NAME || 'FEED Instance',
    preferredUsername: process.env.NEXT_PUBLIC_INSTANCE_DOMAIN || 'feed',
    summary: process.env.NEXT_PUBLIC_INSTANCE_DESCRIPTION || 'Mutual aid resource sharing',
    url: process.env.NEXT_PUBLIC_APP_URL,
    inbox: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/inbox`,
    outbox: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/outbox`,
    publicKey: {
      id: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/instance#main-key`,
      owner: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/instance`,
      publicKeyPem: publicKey,
    },
    endpoints: {
      sharedInbox: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/inbox`,
      resourceSearch: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/resources/search`,
      resourceList: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/resources`,
      health: `${process.env.NEXT_PUBLIC_APP_URL}/api/federation/health`,
    },
    metadata: {
      version: '1.0.0',
      capabilities: ['resource_search', 'geo_query', 'category_filter'],
      // Note: resourceCount populated dynamically below
      lastUpdated: new Date().toISOString(),
      geographicFocus: {
        city: process.env.NEXT_PUBLIC_INSTANCE_CITY,
        state: process.env.NEXT_PUBLIC_INSTANCE_STATE,
        country: process.env.NEXT_PUBLIC_INSTANCE_COUNTRY || 'US',
      },
      moderationPolicy: `${process.env.NEXT_PUBLIC_APP_URL}/moderation-policy`,
    },
  };

  return NextResponse.json(metadata);
}
```

---

## 4. Testing Federation

### 4.1 Local Testing Setup

**Two-Instance Test** using Docker Compose:

```yaml
# docker-compose.federation-test.yml
version: '3.8'

services:
  # Instance A (Seattle)
  seattle-web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_APP_URL=http://localhost:3000
      - NEXT_PUBLIC_INSTANCE_NAME=Seattle FEED
      - NEXT_PUBLIC_INSTANCE_CITY=Seattle
      - NEXT_PUBLIC_INSTANCE_STATE=WA
      - FEED_FEDERATION_PRIVATE_KEY=${SEATTLE_PRIVATE_KEY}
    depends_on:
      - seattle-supabase
      - redis

  # Instance B (Oakland)
  oakland-web:
    build: .
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_APP_URL=http://localhost:3001
      - NEXT_PUBLIC_INSTANCE_NAME=Oakland FEED
      - NEXT_PUBLIC_INSTANCE_CITY=Oakland
      - NEXT_PUBLIC_INSTANCE_STATE=CA
      - FEED_FEDERATION_PRIVATE_KEY=${OAKLAND_PRIVATE_KEY}
    depends_on:
      - oakland-supabase
      - redis

  # Shared Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Supabase instances (use standard Supabase Docker setup)
  seattle-supabase:
    # ... standard Supabase config

  oakland-supabase:
    # ... standard Supabase config
```

### 4.2 Manual Test Script

```bash
#!/bin/bash
# test-federation.sh

echo "🧪 Testing FEED Federation Protocol"
echo "===================================="

# Instance URLs
SEATTLE="http://localhost:3000"
OAKLAND="http://localhost:3001"

echo ""
echo "1️⃣ Testing instance metadata endpoints..."
curl -s "$SEATTLE/api/federation/instance" | jq '.name'
curl -s "$OAKLAND/api/federation/instance" | jq '.name'

echo ""
echo "2️⃣ Testing health checks..."
curl -s "$SEATTLE/api/federation/health"
curl -s "$OAKLAND/api/federation/health"

echo ""
echo "3️⃣ Testing resource queries..."
curl -s "$SEATTLE/api/federation/resources?limit=5" | jq '.totalItems'

echo ""
echo "4️⃣ Testing federated search..."
curl -X POST "$SEATTLE/api/federation/resources/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "food banks", "limit": 10}' | jq '.totalItems'

echo ""
echo "✅ Federation tests complete!"
```

### 4.3 Automated Test Suite

**File**: `apps/web/src/__tests__/federation/federation.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { FederationClient } from '@feed/shared/lib/federation/client';

describe('Federation Protocol', () => {
  let seattleClient: FederationClient;
  let oaklandClient: FederationClient;

  beforeAll(() => {
    seattleClient = new FederationClient({
      instanceUrl: 'http://localhost:3000',
      privateKey: process.env.SEATTLE_PRIVATE_KEY!,
      publicKeyId: 'http://localhost:3000/api/federation/instance#main-key',
    });

    oaklandClient = new FederationClient({
      instanceUrl: 'http://localhost:3001',
      privateKey: process.env.OAKLAND_PRIVATE_KEY!,
      publicKeyId: 'http://localhost:3001/api/federation/instance#main-key',
    });
  });

  describe('Instance Discovery', () => {
    it('should fetch instance metadata', async () => {
      const metadata = await seattleClient.getInstanceMetadata();
      expect(metadata.name).toBe('Seattle FEED');
      expect(metadata.publicKey).toBeDefined();
    });

    it('should verify public key format', async () => {
      const metadata = await seattleClient.getInstanceMetadata();
      expect(metadata.publicKey.publicKeyPem).toMatch(/BEGIN PUBLIC KEY/);
    });
  });

  describe('Federation Handshake', () => {
    it('should complete handshake between instances', async () => {
      const seattleMetadata = await seattleClient.getInstanceMetadata();
      const response = await oaklandClient.sendHandshake(seattleMetadata);

      expect(response.type).toBe('Accept');
    });
  });

  describe('Resource Query', () => {
    it('should query resources with filters', async () => {
      const result = await seattleClient.queryResources({
        category: 'food',
        limit: 10,
      });

      expect(result.totalItems).toBeGreaterThan(0);
      expect(result.orderedItems).toHaveLength(10);
    });

    it('should respect rate limits', async () => {
      const promises = Array(100).fill(null).map(() =>
        seattleClient.queryResources({ limit: 1 })
      );

      await expect(Promise.all(promises)).rejects.toThrow('rate_limit_exceeded');
    });
  });

  describe('Health Checks', () => {
    it('should return healthy status', async () => {
      const isHealthy = await seattleClient.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
```

---

## 5. Deployment Checklist

### Pre-Deployment

- [ ] Generate federation keypair (`npm run federation:generate-keys`)
- [ ] Store private key in secure environment variable (not in git)
- [ ] Publish public key in instance metadata endpoint
- [ ] Run database migrations
- [ ] Configure Redis for rate limiting
- [ ] Set up DNS records (optional: for WebFinger)
- [ ] Configure HTTPS with valid SSL certificate
- [ ] Test federation with staging instance

### Environment Variables

```bash
# Federation
FEED_FEDERATION_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
NEXT_PUBLIC_APP_URL="https://seattle.feed.social"
NEXT_PUBLIC_INSTANCE_NAME="Seattle FEED"
NEXT_PUBLIC_INSTANCE_CITY="Seattle"
NEXT_PUBLIC_INSTANCE_STATE="WA"
NEXT_PUBLIC_INSTANCE_COUNTRY="US"
NEXT_PUBLIC_INSTANCE_DESCRIPTION="Mutual aid resource sharing for Seattle metro"

# Redis (for rate limiting)
REDIS_URL="redis://localhost:6379"

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Production Deployment

- [ ] Deploy to production (Vercel/Railway/self-hosted)
- [ ] Verify instance metadata endpoint is public
- [ ] Test health check endpoint
- [ ] Add first federation partner manually
- [ ] Set up cron job for resource sync (every 15 minutes)
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure alerts for sync failures
- [ ] Document federation policy (who you federate with)

### Post-Deployment Monitoring

**Metrics to track**:
- Federation sync success rate (should be > 95%)
- Average sync duration (should be < 30 seconds)
- Resource staleness (should be < 5%)
- API response times (p95 < 500ms)
- Rate limit violations (should be < 1% of requests)

**Alerts to configure**:
- Sync failures > 3 in a row
- Instance unreachable > 1 hour
- Trust score drops below 0.5
- Rate limit violations spike

---

## 6. Troubleshooting

### Common Issues

**Issue**: Signature verification fails
- **Cause**: Clock skew between instances
- **Solution**: Ensure system clocks are synchronized (use NTP)

**Issue**: Resources not syncing
- **Cause**: Firewall blocking outbound requests
- **Solution**: Whitelist federation partner IPs

**Issue**: High memory usage during sync
- **Cause**: Syncing too many resources at once
- **Solution**: Reduce batch size in sync configuration

**Issue**: Trust score unexpectedly low
- **Cause**: Stale resources or failed health checks
- **Solution**: Run manual resource verification, restart sync job

### Debug Commands

```bash
# Check federation status
npm run federation:status

# Manually trigger sync
npm run federation:sync -- --instance oakland.feed.social

# View sync logs
npm run federation:logs -- --instance oakland.feed.social --tail 50

# Test signature verification
npm run federation:verify-signature -- --request-file test-request.json

# Check trust scores
npm run federation:trust-scores
```

---

## 7. Next Steps

After implementing Phase 1 (Foundation), proceed to:

1. **Phase 2**: Authentication & Trust (HTTP signatures, handshake)
2. **Phase 3**: Resource Sync (automated pull-based sync)
3. **Phase 4**: Federated Search (cross-instance queries)
4. **Phase 5**: Advanced Features (web of trust, WebFinger)
5. **Phase 6**: Production Hardening (security audit, monitoring)

**Estimated Timeline**: 20-24 weeks (see FEDERATION_PROTOCOL.md for detailed roadmap)

---

**Questions?** Open an issue on GitHub or ask in Discord #federation channel.
