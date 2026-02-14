# FEED Federation Protocol (FFP)
## Version 1.0 - Draft Specification

**Status**: Draft
**Created**: 2026-02-05
**Authors**: FEED Platform Team

---

## Executive Summary

The FEED Federation Protocol (FFP) enables volunteer-hosted FEED instances to share resource directories while maintaining complete data sovereignty and privacy. This protocol allows a Seattle user to discover Oakland food banks without centralizing data, preserving the mutual aid ethos of community ownership.

**Core Principles**:
1. **Data Sovereignty**: Each instance controls its own data
2. **Opt-In Federation**: Instances choose federation partners
3. **Privacy-Preserving**: No cross-instance user tracking
4. **Resilient**: Graceful degradation when instances are offline
5. **Resource-Focused**: Federates public resources only (not user data)

---

## Table of Contents

1. [Protocol Overview](#protocol-overview)
2. [Instance Discovery](#instance-discovery)
3. [Federation Handshake](#federation-handshake)
4. [Resource Sharing API](#resource-sharing-api)
5. [Trust Model](#trust-model)
6. [Search Federation](#search-federation)
7. [Data Consistency](#data-consistency)
8. [Security Model](#security-model)
9. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Protocol Overview

### 1.1 Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Oakland FEED   │◄───────►│  Seattle FEED   │◄───────►│ Portland FEED   │
│   Instance A    │         │   Instance B    │         │   Instance C    │
└─────────────────┘         └─────────────────┘         └─────────────────┘
        │                            │                            │
        │                            │                            │
        ▼                            ▼                            ▼
   50 food banks             35 food banks              42 food banks
   127 resources             98 resources               156 resources
```

**Federation Topology**: Mesh network where each instance maintains its own federation list.

### 1.2 What Gets Federated

#### Federated Data (Public)
- **Resources**: Food banks, housing services, healthcare clinics
- **Resource metadata**: Name, address, hours, eligibility, contact info
- **Instance metadata**: Name, location, admin contact, trust score
- **Federation status**: Online/offline, last sync time

#### Never Federated (Private)
- User accounts and profiles
- Form submissions and encrypted data
- Posts and social feed content
- User activity logs
- Authentication credentials
- Personal documents

### 1.3 Protocol Stack

```
┌──────────────────────────────────────┐
│     Application Layer (FEED App)     │
├──────────────────────────────────────┤
│   FEED Federation Protocol (FFP)     │
│   - Resource discovery                │
│   - Trust negotiation                 │
│   - Query federation                  │
├──────────────────────────────────────┤
│   HTTP/2 + JSON-LD (ActivityPub)     │
├──────────────────────────────────────┤
│   TLS 1.3 (Mutual Authentication)    │
├──────────────────────────────────────┤
│         TCP/IP (Internet)             │
└──────────────────────────────────────┘
```

---

## 2. Instance Discovery

### 2.1 Discovery Mechanisms

**Three-Tiered Discovery Strategy**:

#### Tier 1: Manual Federation (MVP)
- Admin manually adds federation partners via config file
- Simple, secure, appropriate for small networks
- No external dependencies

```json
// config/federation.json
{
  "federatedInstances": [
    {
      "name": "Oakland FEED",
      "domain": "oakland.feed.social",
      "adminContact": "admin@oakland.feed.social",
      "addedAt": "2026-01-15T10:00:00Z",
      "trustLevel": "verified"
    }
  ]
}
```

#### Tier 2: WebFinger + Well-Known (v1.1)
- Standard web discovery protocol (RFC 7033)
- Instances publish metadata at `/.well-known/feed-instance`
- WebFinger resolves instance capabilities

```
GET https://seattle.feed.social/.well-known/feed-instance
```

```json
{
  "subject": "feed://seattle.feed.social",
  "aliases": ["https://seattle.feed.social"],
  "links": [
    {
      "rel": "self",
      "type": "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"",
      "href": "https://seattle.feed.social/api/federation/instance"
    },
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "type": "text/html",
      "href": "https://seattle.feed.social/about"
    }
  ],
  "properties": {
    "http://feed.social/ns/1.0#version": "1.0",
    "http://feed.social/ns/1.0#resources": 98,
    "http://feed.social/ns/1.0#lastSync": "2026-02-05T08:30:00Z"
  }
}
```

#### Tier 3: DHT Registry (v2.0)
- Distributed registry using Kademlia DHT
- Instances announce presence via IPFS/libp2p
- Resilient to single-point failures

**MVP Implementation**: Start with Tier 1 (manual federation) only.

### 2.2 Instance Metadata

Each instance publishes metadata at `/api/federation/instance`:

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Service",
  "id": "https://seattle.feed.social/api/federation/instance",
  "name": "Seattle FEED",
  "preferredUsername": "seattle",
  "summary": "Mutual aid resource sharing for the Seattle metro area",
  "url": "https://seattle.feed.social",
  "inbox": "https://seattle.feed.social/api/federation/inbox",
  "outbox": "https://seattle.feed.social/api/federation/outbox",
  "publicKey": {
    "id": "https://seattle.feed.social/api/federation/instance#main-key",
    "owner": "https://seattle.feed.social/api/federation/instance",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  },
  "endpoints": {
    "sharedInbox": "https://seattle.feed.social/api/federation/inbox",
    "resourceSearch": "https://seattle.feed.social/api/federation/resources/search",
    "resourceList": "https://seattle.feed.social/api/federation/resources",
    "health": "https://seattle.feed.social/api/federation/health"
  },
  "metadata": {
    "version": "1.0.0",
    "capabilities": ["resource_search", "geo_query", "category_filter"],
    "resourceCount": 98,
    "lastUpdated": "2026-02-05T08:30:00Z",
    "geographicFocus": {
      "city": "Seattle",
      "state": "WA",
      "country": "US",
      "coordinates": {
        "lat": 47.6062,
        "lng": -122.3321
      }
    },
    "trustScore": 0.92,
    "moderationPolicy": "https://seattle.feed.social/moderation-policy"
  }
}
```

---

## 3. Federation Handshake

### 3.1 Handshake Process

```
Oakland Instance (A)                          Seattle Instance (B)
        │                                              │
        │  1. GET /.well-known/feed-instance          │
        │─────────────────────────────────────────────►
        │                                              │
        │  2. Instance metadata (public key)          │
        │◄─────────────────────────────────────────────┤
        │                                              │
        │  3. POST /api/federation/handshake          │
        │    - A's instance metadata                  │
        │    - Signed with A's private key            │
        │─────────────────────────────────────────────►
        │                                              │
        │  4. Verify signature with A's public key    │
        │                                              │
        │  5. Accept/Reject response                  │
        │    - Signed with B's private key            │
        │◄─────────────────────────────────────────────┤
        │                                              │
        │  6. Store B in federation list              │
        │                                              │
        │  7. Begin resource sync                     │
        │                                              │
```

### 3.2 Handshake Request

```http
POST /api/federation/handshake HTTP/2
Host: seattle.feed.social
Content-Type: application/ld+json; profile="https://www.w3.org/ns/activitystreams"
Signature: keyId="https://oakland.feed.social/api/federation/instance#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="..."
Date: Wed, 05 Feb 2026 10:30:00 GMT
Digest: SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=

{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "FederationRequest",
  "actor": "https://oakland.feed.social/api/federation/instance",
  "to": "https://seattle.feed.social/api/federation/instance",
  "object": {
    "type": "Service",
    "id": "https://oakland.feed.social/api/federation/instance",
    "name": "Oakland FEED",
    "url": "https://oakland.feed.social",
    "publicKey": {
      "id": "https://oakland.feed.social/api/federation/instance#main-key",
      "owner": "https://oakland.feed.social/api/federation/instance",
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
    },
    "metadata": {
      "version": "1.0.0",
      "resourceCount": 127,
      "geographicFocus": {
        "city": "Oakland",
        "state": "CA"
      }
    }
  },
  "published": "2026-02-05T10:30:00Z"
}
```

### 3.3 Handshake Response

**Accept Response**:
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Accept",
  "actor": "https://seattle.feed.social/api/federation/instance",
  "object": {
    "type": "FederationRequest",
    "id": "https://oakland.feed.social/federation-request/abc123"
  },
  "published": "2026-02-05T10:30:15Z",
  "to": "https://oakland.feed.social/api/federation/instance",
  "syncSchedule": {
    "interval": "15m",
    "method": "pull"
  }
}
```

**Reject Response**:
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Reject",
  "actor": "https://seattle.feed.social/api/federation/instance",
  "object": {
    "type": "FederationRequest",
    "id": "https://oakland.feed.social/federation-request/abc123"
  },
  "published": "2026-02-05T10:30:15Z",
  "to": "https://oakland.feed.social/api/federation/instance",
  "reason": "Insufficient trust score"
}
```

### 3.4 Key Management

**Key Generation (on instance setup)**:
```bash
# Generate RSA-4096 keypair
openssl genrsa -out private_key.pem 4096
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Store private key in environment variable (not in database)
export FEED_FEDERATION_PRIVATE_KEY="$(cat private_key.pem)"
```

**Key Storage**:
- Private key: Environment variable only (never in database)
- Public key: Published in instance metadata endpoint
- Key rotation: Every 12 months (with 30-day overlap period)

---

## 4. Resource Sharing API

### 4.1 Resource Query Endpoint

**Endpoint**: `GET /api/federation/resources`

**Query Parameters**:
- `category` - Filter by resource category
- `lat` & `lng` - Geographic center point
- `radius` - Search radius in kilometers
- `limit` - Max results (default: 50, max: 200)
- `offset` - Pagination offset
- `lastModified` - Only return resources modified after timestamp

**Example Request**:
```http
GET /api/federation/resources?category=food&lat=47.6062&lng=-122.3321&radius=10&limit=50 HTTP/2
Host: seattle.feed.social
Accept: application/ld+json
```

**Response**:
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "id": "https://seattle.feed.social/api/federation/resources?page=1",
  "totalItems": 35,
  "next": "https://seattle.feed.social/api/federation/resources?page=2",
  "orderedItems": [
    {
      "@context": "http://schema.org",
      "@type": "LocalBusiness",
      "@id": "https://seattle.feed.social/resources/res_12345",
      "name": "Seattle Food Bank - Ballard",
      "description": "Emergency food assistance for Seattle metro residents",
      "category": "food",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "1234 Market St",
        "addressLocality": "Seattle",
        "addressRegion": "WA",
        "postalCode": "98107",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 47.6688,
        "longitude": -122.3833
      },
      "telephone": "+1-206-555-1234",
      "email": "info@seattlefoodbank.org",
      "url": "https://seattlefoodbank.org",
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Wednesday", "Friday"],
          "opens": "09:00",
          "closes": "17:00"
        }
      ],
      "eligibilityRequirements": "Seattle metro residents, income verification required",
      "inLanguage": ["en", "es", "vi"],
      "servicesOffered": ["Emergency food boxes", "Fresh produce", "Nutrition classes"],
      "metadata": {
        "source": "user_submitted",
        "status": "approved",
        "isVerified": true,
        "lastVerified": "2026-01-15T10:00:00Z",
        "submittedBy": null,
        "federationOrigin": "https://seattle.feed.social"
      },
      "published": "2025-12-01T10:00:00Z",
      "updated": "2026-02-01T15:30:00Z"
    }
  ]
}
```

### 4.2 Resource Detail Endpoint

**Endpoint**: `GET /api/federation/resources/:id`

Returns single resource with full details. Format same as collection item above.

### 4.3 Resource Search Endpoint

**Endpoint**: `POST /api/federation/resources/search`

**Request Body**:
```json
{
  "query": "free food pantry",
  "filters": {
    "category": ["food", "housing"],
    "location": {
      "lat": 47.6062,
      "lng": -122.3321,
      "radius": 25
    },
    "requirements": {
      "languages": ["es"],
      "accessibility": true
    }
  },
  "limit": 50,
  "offset": 0
}
```

**Response**: Same format as resource query endpoint.

### 4.4 Rate Limiting

**Rate Limits** (per source instance):
- **Health checks**: 1 req/min
- **Resource queries**: 30 req/min
- **Resource searches**: 10 req/min
- **Resource details**: 60 req/min

**Rate limit headers**:
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1738753200
```

**Rate limit exceeded response**:
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

---

## 5. Trust Model

### 5.1 Trust Levels

**Five Trust Levels**:

1. **Untrusted (0.0 - 0.2)**: Default for unknown instances
   - No federation allowed
   - Handshake automatically rejected

2. **Pending (0.2 - 0.4)**: Handshake accepted, probation period
   - Limited resource sharing (10 resources/query max)
   - Manual admin approval required for promotion

3. **Trusted (0.4 - 0.7)**: Standard federation partner
   - Full resource sharing
   - Standard rate limits

4. **Verified (0.7 - 0.9)**: Known good actor
   - Higher rate limits (2x)
   - Prioritized in search results

5. **Core (0.9 - 1.0)**: Official FEED network instances
   - Unlimited rate limits
   - Shared moderation tools

### 5.2 Trust Score Calculation

**Trust score formula**:
```
trust_score = (
  uptime_score * 0.30 +
  data_quality_score * 0.25 +
  moderation_score * 0.20 +
  community_reports_score * 0.15 +
  longevity_score * 0.10
)
```

**Component Scores**:

1. **Uptime Score** (0.0 - 1.0):
   ```
   uptime_score = successful_health_checks / total_health_checks_last_30d
   ```

2. **Data Quality Score** (0.0 - 1.0):
   ```
   data_quality_score = (
     complete_resources / total_resources * 0.5 +
     verified_resources / total_resources * 0.3 +
     (1 - stale_resources / total_resources) * 0.2
   )
   ```

3. **Moderation Score** (0.0 - 1.0):
   ```
   moderation_score = 1 - (spam_reports_upheld / total_resources)
   ```

4. **Community Reports Score** (0.0 - 1.0):
   ```
   community_reports_score = max(0, 1 - (negative_reports / 100))
   ```

5. **Longevity Score** (0.0 - 1.0):
   ```
   longevity_score = min(1.0, days_federated / 180)
   ```

### 5.3 Trust Verification

**Verification Methods**:

1. **Out-of-Band Contact**: Email/phone verification with admin
2. **Mutual Federation**: Other trusted instances federate with them
3. **Domain Verification**: DNS TXT record proves domain ownership
4. **Social Proof**: Known organization (verified 501(c)(3))

**Verification DNS Record**:
```
_feed-federation.seattle.feed.social. IN TXT "v=ffp1; instance=https://seattle.feed.social/api/federation/instance; key=abc123"
```

### 5.4 Reputation Propagation

**Web of Trust Model** (inspired by PGP):

```
If Oakland (trust: 0.8) trusts Seattle (trust: 0.9)
And Portland queries Oakland's trust network
Then Portland sees Seattle with derived trust: 0.8 * 0.9 = 0.72
```

**Trust Attestation**:
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "TrustAttestation",
  "actor": "https://oakland.feed.social/api/federation/instance",
  "object": "https://seattle.feed.social/api/federation/instance",
  "rating": 0.9,
  "summary": "Reliable partner, high-quality resource data",
  "published": "2026-02-01T10:00:00Z"
}
```

### 5.5 Blocklist Management

**Block Reasons**:
- Spam/malicious content
- Consistent downtime
- Policy violations
- Community reports

**Blocklist Entry**:
```json
{
  "domain": "malicious.example.com",
  "reason": "spam",
  "addedAt": "2026-02-05T10:00:00Z",
  "addedBy": "admin@oakland.feed.social",
  "evidence": "https://oakland.feed.social/moderation/report/123"
}
```

**Shared Blocklists** (optional):
- Trusted instances can share blocklists
- Receiving instance decides whether to apply

---

## 6. Search Federation

### 6.1 Federated Search Architecture

**Query Aggregation Pattern**:

```
User Query: "food banks near Seattle"
        │
        ▼
┌────────────────┐
│ Local Instance │ (Seattle FEED)
│  - Query local │
│    resources   │
└────────┬───────┘
         │
         ├──────► Federation Query (parallel)
         │
         ├─────► Oakland Instance: "food banks near Seattle"
         │       (filters by geography: within 500km)
         │
         ├─────► Portland Instance: "food banks near Seattle"
         │       (filters by geography: within 500km)
         │
         └─────► Los Angeles Instance: skipped (too far)

         │
         ▼
┌─────────────────┐
│ Result Merger   │
│ - Deduplicate   │
│ - Sort by       │
│   distance      │
│ - Add origin    │
│   labels        │
└─────────────────┘
```

### 6.2 Federated Search Request

**Local instance initiates search to federation partners**:

```http
POST /api/federation/resources/search HTTP/2
Host: portland.feed.social
Content-Type: application/ld+json
Signature: keyId="https://seattle.feed.social/api/federation/instance#main-key",...

{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "SearchRequest",
  "actor": "https://seattle.feed.social/api/federation/instance",
  "to": "https://portland.feed.social/api/federation/instance",
  "object": {
    "type": "ResourceQuery",
    "query": "food banks",
    "filters": {
      "category": ["food"],
      "location": {
        "lat": 47.6062,
        "lng": -122.3321,
        "radius": 100
      }
    },
    "limit": 20
  },
  "published": "2026-02-05T10:30:00Z"
}
```

### 6.3 Result Deduplication

**Deduplication Strategy**:
1. Normalize resource names (lowercase, trim)
2. Compare addresses (fuzzy match)
3. Check phone numbers (exact match)
4. Calculate similarity score

**Duplicate Detection**:
```typescript
function isDuplicate(resource1: Resource, resource2: Resource): boolean {
  // Exact match on external_id (211 API ID)
  if (resource1.external_id && resource1.external_id === resource2.external_id) {
    return true;
  }

  // Fuzzy match on name + address
  const nameSimilarity = levenshtein(resource1.name, resource2.name);
  const addressSimilarity = levenshtein(
    resource1.address_line1,
    resource2.address_line1
  );

  if (nameSimilarity > 0.85 && addressSimilarity > 0.85) {
    return true;
  }

  // Exact match on phone number
  if (resource1.phone && resource1.phone === resource2.phone) {
    return true;
  }

  return false;
}
```

**Conflict Resolution (when duplicates detected)**:
- Prefer resource from instance with higher trust score
- If equal trust, prefer resource with more recent `updated_at`
- Tag result with "Available from multiple sources" badge

### 6.4 Result Ranking

**Ranking Formula**:
```
result_score = (
  geographic_distance_score * 0.40 +
  text_relevance_score * 0.30 +
  trust_score * 0.15 +
  freshness_score * 0.10 +
  completeness_score * 0.05
)
```

**Score Components**:

1. **Geographic Distance Score** (0.0 - 1.0):
   ```
   distance_score = max(0, 1 - (distance_km / max_radius_km))
   ```

2. **Text Relevance Score** (0.0 - 1.0):
   - Full-text search score from query
   - Weighted by field (name: 2x, description: 1x, services: 1.5x)

3. **Trust Score** (0.0 - 1.0):
   - Instance trust score (see Trust Model section)

4. **Freshness Score** (0.0 - 1.0):
   ```
   freshness_score = max(0, 1 - (days_since_update / 180))
   ```

5. **Completeness Score** (0.0 - 1.0):
   ```
   completeness_score = filled_fields / total_fields
   ```

### 6.5 Search Performance Optimization

**Timeout Strategy**:
- Total query timeout: 5 seconds
- Per-instance timeout: 2 seconds
- If instance times out, continue with other results

**Parallel Queries**:
- Query all federated instances simultaneously
- Use Promise.allSettled() to handle partial failures

**Result Streaming**:
- Return local results immediately (0-100ms)
- Stream federated results as they arrive (100-2000ms)
- UI shows "Loading results from Oakland..." indicator

**Caching**:
- Cache federated search results for 15 minutes
- Invalidate cache on resource updates
- Cache key: `search:${query}:${filters_hash}`

---

## 7. Data Consistency

### 7.1 Consistency Model

**Eventual Consistency**: FEED federation uses eventual consistency, not strong consistency.

**Why Eventual Consistency?**:
- Resources change slowly (hours/days, not seconds)
- Availability > consistency for mutual aid use case
- Strong consistency requires distributed transactions (complex, brittle)

### 7.2 Sync Strategy

**Pull-Based Sync** (MVP):
- Instances periodically pull updates from federation partners
- Sync interval: Every 15 minutes (configurable)
- Incremental sync using `lastModified` timestamp

**Sync Request**:
```http
GET /api/federation/resources?lastModified=2026-02-05T09:00:00Z HTTP/2
Host: oakland.feed.social
```

**Response**: Returns only resources modified after timestamp.

### 7.3 Conflict Resolution

**Conflict Scenarios**:

1. **Resource Updated on Multiple Instances**:
   - Use Last Write Wins (LWW) based on `updated_at` timestamp
   - Store conflicts in `federated_resource_conflicts` table for admin review

2. **Resource Deleted on One Instance**:
   - Mark as `archived` locally, don't delete
   - Show "No longer available at origin instance" message

3. **Resource Metadata Divergence**:
   - Prefer source instance's data (instance that originally published)
   - Tag with "Federated" badge showing origin

### 7.4 Sync Algorithm

```typescript
async function syncFederatedResources(remoteInstance: Instance): Promise<void> {
  const lastSync = await getLastSyncTime(remoteInstance.id);

  // Fetch updated resources
  const response = await fetch(
    `${remoteInstance.url}/api/federation/resources?lastModified=${lastSync}`
  );
  const resources = await response.json();

  for (const resource of resources.orderedItems) {
    const existing = await db.federatedResources.findOne({
      originInstanceId: remoteInstance.id,
      originResourceId: resource.id
    });

    if (!existing) {
      // New resource - insert
      await db.federatedResources.insert({
        originInstanceId: remoteInstance.id,
        originResourceId: resource.id,
        data: resource,
        firstSeenAt: new Date(),
        lastSyncedAt: new Date()
      });
    } else if (new Date(resource.updated) > new Date(existing.data.updated)) {
      // Updated resource - update
      await db.federatedResources.update(existing.id, {
        data: resource,
        lastSyncedAt: new Date()
      });
    }
  }

  // Update last sync time
  await setLastSyncTime(remoteInstance.id, new Date());
}
```

### 7.5 Data Staleness Handling

**Stale Data Indicators**:
- Last sync > 1 hour: Yellow indicator "Last updated 2h ago"
- Last sync > 24 hours: Orange indicator "Last updated yesterday"
- Last sync > 7 days: Red indicator "Data may be outdated"

**Automatic Cleanup**:
- If instance unreachable for 30 days, mark all its resources as `stale`
- If unreachable for 90 days, hide resources from search (but don't delete)

---

## 8. Security Model

### 8.1 Authentication

**HTTP Signatures** (RFC draft-cavage-http-signatures):
- All federation requests signed with instance's private key
- Receiving instance verifies signature using sender's public key
- Prevents impersonation and MITM attacks

**Signature Header**:
```http
Signature: keyId="https://oakland.feed.social/api/federation/instance#main-key",
           algorithm="rsa-sha256",
           headers="(request-target) host date digest content-type",
           signature="Base64(RSA-SHA256(signing-string))"
```

### 8.2 Authorization

**Authorization Checks**:
1. Verify signature (authentication)
2. Check if sender is in federation list (authorization)
3. Verify trust level meets minimum threshold
4. Check rate limits

**Authorization Failure Response**:
```json
{
  "error": "unauthorized",
  "message": "Instance not in federation list",
  "code": "NOT_FEDERATED"
}
```

### 8.3 Attack Prevention

**Spam Prevention**:
- Rate limiting (see Resource Sharing API section)
- Resource submission requires manual approval
- Blocklist enforcement

**DDoS Protection**:
- Rate limiting at edge (Cloudflare/Nginx)
- Federation queries limited to trusted instances only
- Circuit breaker: Temporarily block instance if error rate > 50%

**Data Poisoning Prevention**:
- Trust score system penalizes bad data
- Manual moderation for resources from low-trust instances
- Community reporting system

**Privacy Protection**:
- No user tracking across instances
- No personal data in federated resources
- No cross-instance user profiles

### 8.4 Vulnerability Disclosure

**Security Contact**:
```
/.well-known/security.txt

Contact: security@feed.social
Expires: 2026-12-31T23:59:59Z
Encryption: https://feed.social/pgp-key.txt
Preferred-Languages: en
Canonical: https://feed.social/.well-known/security.txt
```

---

## 9. Implementation Roadmap

### 9.1 Phase 1: Foundation (Weeks 1-4)

**Goal**: Single-instance federation with manual configuration

**Tasks**:
1. **Database Schema**:
   ```sql
   CREATE TABLE federated_instances (
     id UUID PRIMARY KEY,
     domain TEXT UNIQUE NOT NULL,
     name TEXT NOT NULL,
     public_key TEXT NOT NULL,
     trust_level NUMERIC NOT NULL DEFAULT 0.5,
     status TEXT NOT NULL DEFAULT 'active',
     metadata JSONB,
     last_health_check TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE TABLE federated_resources (
     id UUID PRIMARY KEY,
     origin_instance_id UUID REFERENCES federated_instances(id),
     origin_resource_id TEXT NOT NULL,
     data JSONB NOT NULL,
     first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     is_stale BOOLEAN NOT NULL DEFAULT FALSE,
     UNIQUE(origin_instance_id, origin_resource_id)
   );

   CREATE TABLE federation_sync_log (
     id UUID PRIMARY KEY,
     instance_id UUID REFERENCES federated_instances(id),
     sync_started_at TIMESTAMPTZ NOT NULL,
     sync_completed_at TIMESTAMPTZ,
     resources_fetched INTEGER,
     resources_updated INTEGER,
     resources_added INTEGER,
     error TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```

2. **Keypair Generation**:
   - CLI tool: `npm run federation:generate-keys`
   - Store private key in environment variable
   - Publish public key in instance metadata endpoint

3. **Instance Metadata Endpoint**:
   - `GET /api/federation/instance`
   - Returns instance metadata + public key

4. **Basic Resource API**:
   - `GET /api/federation/resources`
   - No authentication (open endpoint)
   - Return all approved resources

5. **Manual Federation Config**:
   - Admin UI to add/remove federation partners
   - Config stored in `federated_instances` table

**Acceptance Criteria**:
- [ ] Instance can publish its metadata
- [ ] Instance can fetch resources from remote instance (unauthenticated)
- [ ] Admin can manually add federation partner

### 9.2 Phase 2: Authentication & Trust (Weeks 5-8)

**Goal**: Secure federation with HTTP signatures and trust scoring

**Tasks**:
1. **HTTP Signature Implementation**:
   - Sign all outgoing requests with private key
   - Verify signatures on incoming requests
   - Reject requests with invalid signatures

2. **Federation Handshake**:
   - `POST /api/federation/handshake` endpoint
   - Accept/reject logic based on trust score
   - Store accepted instances in `federated_instances` table

3. **Trust Score System**:
   - Implement trust score calculation
   - Background job to update trust scores daily
   - Admin UI to view trust scores

4. **Health Checks**:
   - Background job to ping federation partners every 5 minutes
   - Update `last_health_check` timestamp
   - Adjust trust score based on uptime

5. **Rate Limiting**:
   - Implement rate limiting middleware
   - Store rate limit counters in Redis
   - Return 429 with `Retry-After` header

**Acceptance Criteria**:
- [ ] All federation requests use HTTP signatures
- [ ] Handshake protocol works end-to-end
- [ ] Trust scores calculate correctly
- [ ] Rate limiting enforces limits

### 9.3 Phase 3: Resource Sync (Weeks 9-12)

**Goal**: Automated resource synchronization

**Tasks**:
1. **Pull-Based Sync**:
   - Background job runs every 15 minutes
   - Fetches updated resources using `lastModified` filter
   - Stores in `federated_resources` table

2. **Deduplication**:
   - Implement duplicate detection algorithm
   - Mark duplicates in database
   - Prefer higher-trust instance's data

3. **Conflict Resolution**:
   - Implement Last Write Wins (LWW) logic
   - Store conflicts in `federated_resource_conflicts` table
   - Admin UI to review conflicts

4. **Staleness Detection**:
   - Mark resources as stale if not synced in 24h
   - Hide stale resources from search after 7 days
   - Archive after 90 days of instance downtime

**Acceptance Criteria**:
- [ ] Resources sync automatically every 15 minutes
- [ ] Duplicates detected and merged
- [ ] Conflicts resolved using LWW
- [ ] Stale resources marked appropriately

### 9.4 Phase 4: Federated Search (Weeks 13-16)

**Goal**: Search across federation network

**Tasks**:
1. **Federated Search API**:
   - `POST /api/federation/resources/search` endpoint
   - Query local + federated resources
   - Parallel queries to federation partners

2. **Result Aggregation**:
   - Merge results from multiple instances
   - Deduplicate across instances
   - Sort by ranking formula

3. **Result Streaming**:
   - Return local results immediately
   - Stream federated results as they arrive
   - UI shows "Loading from Oakland..." indicator

4. **Search Caching**:
   - Cache search results for 15 minutes
   - Invalidate cache on resource updates
   - Use Redis for cache storage

5. **UI Integration**:
   - Show "Federated" badge on external resources
   - Display origin instance name
   - Show trust score indicator

**Acceptance Criteria**:
- [ ] Search queries federation partners
- [ ] Results aggregate and deduplicate correctly
- [ ] UI shows origin instance for federated resources
- [ ] Search completes within 5 seconds (including timeouts)

### 9.5 Phase 5: Advanced Features (Weeks 17-20)

**Goal**: Web of trust, shared moderation, DHT registry

**Tasks**:
1. **Web of Trust**:
   - Trust attestations between instances
   - Derived trust calculations
   - Trust graph visualization

2. **Shared Blocklists**:
   - Export/import blocklist API
   - Admin UI to subscribe to trusted blocklists
   - Apply blocks to federation queries

3. **WebFinger Discovery**:
   - `/.well-known/feed-instance` endpoint
   - DNS verification (TXT record)
   - Automatic instance discovery

4. **DHT Registry** (optional):
   - IPFS/libp2p integration
   - Publish instance metadata to DHT
   - Query DHT for instances by location

5. **Monitoring & Analytics**:
   - Federation dashboard
   - Sync success rate metrics
   - Query performance metrics
   - Trust score trends

**Acceptance Criteria**:
- [ ] Web of trust propagates correctly
- [ ] Blocklists shared between trusted instances
- [ ] WebFinger discovery works
- [ ] Federation metrics visible in dashboard

### 9.6 Phase 6: Production Hardening (Weeks 21-24)

**Goal**: Security audit, performance optimization, documentation

**Tasks**:
1. **Security Audit**:
   - Penetration testing
   - Code review by security team
   - Fix identified vulnerabilities

2. **Performance Optimization**:
   - Database query optimization
   - Connection pooling
   - CDN for static resources
   - Load testing (1000 req/s)

3. **Documentation**:
   - API documentation (OpenAPI spec)
   - Admin guide
   - Federation setup guide
   - Troubleshooting guide

4. **Monitoring & Alerting**:
   - Prometheus metrics export
   - Grafana dashboards
   - PagerDuty/Opsgenie alerts
   - Error tracking (Sentry)

5. **Compliance**:
   - GDPR compliance review
   - CCPA compliance review
   - Data retention policies
   - Privacy policy updates

**Acceptance Criteria**:
- [ ] No critical security vulnerabilities
- [ ] Load test passes at 1000 req/s
- [ ] Documentation complete
- [ ] Monitoring dashboards deployed
- [ ] Compliance review passed

---

## 10. Migration Path for Existing Instances

### 10.1 Backward Compatibility

**Federation is Opt-In**:
- Existing instances work without federation
- No breaking changes to existing APIs
- Federation endpoints are additive

**Migration Checklist**:
1. Generate keypair (`npm run federation:generate-keys`)
2. Deploy federation endpoints
3. Add first federation partner manually
4. Enable resource sync background job
5. Test federated search

### 10.2 Gradual Rollout

**Rollout Strategy**:
1. **Week 1-2**: Deploy to staging instances (Oakland, Seattle test instances)
2. **Week 3-4**: Deploy to 2-3 production instances (beta federation)
3. **Week 5-8**: Open federation to all instances
4. **Week 9-12**: Promote federation in documentation

---

## 11. Open Questions & Future Work

### 11.1 Open Questions

1. **Resource ownership**: What happens if a resource exists on multiple instances with conflicting data?
   - **Proposed**: Prefer data from instance with higher trust score

2. **User accounts**: Should users be able to log in across instances (like Mastodon)?
   - **Proposed**: No (Phase 1). Users are local to each instance. May revisit in Phase 2.

3. **Form submissions**: Should form submissions federate across instances?
   - **Answer**: No. Forms contain personal data and should never leave the instance.

4. **Push vs Pull sync**: Should instances push updates or pull updates?
   - **Proposed**: Pull for MVP (simpler), push for Phase 2 (more real-time)

### 11.2 Future Work

**Phase 2+ Features**:
- Push-based sync (webhook notifications)
- Real-time resource updates (WebSocket)
- Cross-instance messaging (admin communication)
- Federated analytics (aggregate resource usage stats)
- Federated moderation tools (shared spam detection)
- Mobile app federation (peer-to-peer on same WiFi)
- Offline-first federation (mesh network without internet)

**Research Topics**:
- Conflict-Free Replicated Data Types (CRDTs) for resources
- Blockchain-based trust scores (immutable attestations)
- Zero-knowledge proofs for privacy-preserving federation
- AI-powered duplicate detection (semantic similarity)

---

## 12. Conclusion

The FEED Federation Protocol enables decentralized resource sharing while preserving data sovereignty and privacy. By adopting ActivityPub-inspired patterns, web of trust reputation, and eventual consistency, FEED instances can collaborate without centralizing power or data.

**Key Takeaways**:
- **Simple MVP**: Start with manual federation and pull-based sync
- **Privacy-First**: Never federate user data or form submissions
- **Trust-Based**: Use web of trust to prevent malicious actors
- **Resilient**: Graceful degradation when instances are offline
- **Community-Owned**: Instances decide who to federate with

**Next Steps**:
1. Review this specification with FEED community
2. Gather feedback from instance administrators
3. Build prototype (Phase 1) with 2-3 test instances
4. Iterate based on real-world usage

---

## Appendix A: Related Protocols

### ActivityPub
- **W3C Standard**: [https://www.w3.org/TR/activitypub/](https://www.w3.org/TR/activitypub/)
- **Used by**: Mastodon, Pixelfed, PeerTube
- **Strengths**: Mature, widely adopted, proven at scale
- **Weaknesses**: Complex, designed for social networks (not resource directories)

### WebFinger (RFC 7033)
- **Spec**: [https://datatracker.ietf.org/doc/html/rfc7033](https://datatracker.ietf.org/doc/html/rfc7033)
- **Used by**: Mastodon, Matrix, Email discovery
- **Strengths**: Simple, widely supported
- **Weaknesses**: Requires DNS/HTTP (no offline support)

### Distributed Hash Tables (DHT)
- **Implementations**: Kademlia, Chord, IPFS
- **Used by**: BitTorrent, IPFS, Ethereum
- **Strengths**: Decentralized, no single point of failure
- **Weaknesses**: Complex, requires P2P network

### Web of Trust
- **Origins**: PGP (1992)
- **Used by**: OpenPGP, Bitcoin, reputation systems
- **Strengths**: Decentralized trust, social proof
- **Weaknesses**: Slow to build, requires active participation

### Eventual Consistency
- **Origins**: Distributed systems theory
- **Used by**: Cassandra, DynamoDB, CouchDB
- **Strengths**: High availability, partition tolerance (CAP theorem)
- **Weaknesses**: Temporary inconsistency, conflict resolution needed

---

## Appendix B: Data Models

### TypeScript Type Definitions

```typescript
// Instance
interface FederatedInstance {
  id: string; // UUID
  domain: string; // oakland.feed.social
  name: string; // Oakland FEED
  publicKey: string; // PEM-encoded RSA public key
  trustLevel: number; // 0.0 - 1.0
  status: 'active' | 'suspended' | 'offline';
  metadata: {
    version: string;
    capabilities: string[];
    resourceCount: number;
    lastUpdated: string; // ISO 8601
    geographicFocus: {
      city: string;
      state: string;
      country: string;
      coordinates: {
        lat: number;
        lng: number;
      };
    };
    trustScore: number;
    moderationPolicy: string; // URL
  };
  lastHealthCheck: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// Federated Resource
interface FederatedResource {
  id: string; // UUID
  originInstanceId: string; // UUID
  originResourceId: string; // Resource ID at origin instance
  data: Resource; // Full resource object
  firstSeenAt: string; // ISO 8601
  lastSyncedAt: string; // ISO 8601
  isStale: boolean;
}

// Resource (from main FEED schema)
interface Resource {
  id: string;
  name: string;
  description: string | null;
  category: ResourceCategory;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string;
  };
  location: {
    lat: number;
    lng: number;
  } | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hoursOfOperation: HoursOfOperation[] | null;
  eligibilityRequirements: string | null;
  languagesServed: string[] | null;
  servicesOffered: string[] | null;
  source: ResourceSource;
  externalId: string | null;
  submittedBy: string | null;
  status: ResourceStatus;
  moderatedBy: string | null;
  moderatedAt: string | null;
  rejectionReason: string | null;
  isVerified: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Sync Log
interface FederationSyncLog {
  id: string; // UUID
  instanceId: string; // UUID
  syncStartedAt: string; // ISO 8601
  syncCompletedAt: string | null; // ISO 8601
  resourcesFetched: number;
  resourcesUpdated: number;
  resourcesAdded: number;
  error: string | null;
  createdAt: string; // ISO 8601
}

// Trust Attestation
interface TrustAttestation {
  actor: string; // Instance URL
  object: string; // Instance URL being attested
  rating: number; // 0.0 - 1.0
  summary: string;
  published: string; // ISO 8601
}

// Blocklist Entry
interface BlocklistEntry {
  domain: string;
  reason: 'spam' | 'malicious' | 'policy_violation' | 'downtime';
  addedAt: string; // ISO 8601
  addedBy: string; // Email
  evidence: string; // URL to report
}
```

---

## Appendix C: Example Flows

### Example 1: User Searches for "food banks near me"

```
1. User enters query on Seattle FEED instance
   └─► Query: "food banks near Seattle, WA"

2. Seattle instance searches local resources
   └─► Returns 35 local food banks (100ms)

3. Seattle instance queries federation partners in parallel
   ├─► Oakland FEED: "food banks near Seattle" (400ms)
   │   └─► Returns 3 resources (Portland, OR area - within 250km)
   │
   └─► Portland FEED: "food banks near Seattle" (350ms)
       └─► Returns 8 resources (Portland metro area)

4. Seattle instance aggregates results
   ├─► Deduplicates (found 1 duplicate between Portland and Oakland)
   ├─► Sorts by distance from Seattle
   └─► Tags with origin instance

5. User sees results (total: 45 unique resources)
   └─► "35 from Seattle, 7 from Portland, 3 from Oakland"
```

### Example 2: New Instance Joins Federation

```
1. San Francisco FEED instance spins up
   └─► Generates keypair
   └─► Publishes instance metadata at /.well-known/feed-instance

2. SF admin manually adds Oakland FEED to federation list
   └─► Config: {domain: "oakland.feed.social", trustLevel: 0.3}

3. SF instance initiates handshake with Oakland
   └─► POST /api/federation/handshake (signed with SF private key)

4. Oakland verifies signature
   ├─► Checks SF's public key from metadata endpoint
   ├─► Verifies signature matches
   └─► Checks trust level (0.3 = "Pending")

5. Oakland accepts handshake
   └─► Returns Accept response (signed with Oakland private key)
   └─► Adds SF to federation list (trust: 0.3, status: "pending")

6. SF begins syncing resources from Oakland
   └─► GET /api/federation/resources (authenticated)
   └─► Fetches 127 resources
   └─► Stores in federated_resources table

7. Over 30 days, Oakland monitors SF
   ├─► Uptime: 99.5% ✓
   ├─► Data quality: 92% ✓
   └─► No spam reports ✓

8. Oakland promotes SF to "Trusted" (trust: 0.6)
   └─► SF now appears in federated search results
```

### Example 3: Malicious Instance Blocked

```
1. Spam instance "evil.feed.com" joins network
   └─► Initial trust level: 0.3 (pending)

2. Evil instance submits 500 spam resources
   └─► "Buy Viagra now!" instead of food banks

3. Multiple instances receive spam
   ├─► Oakland admin files report: "Spam content"
   ├─► Seattle admin files report: "Malicious resources"
   └─► Portland admin files report: "Policy violation"

4. Trust score plummets
   └─► community_reports_score: 0.2
   └─► data_quality_score: 0.1
   └─► Overall trust: 0.15 (below "Untrusted" threshold)

5. Instances automatically block evil.feed.com
   └─► Federation requests rejected
   └─► Resources removed from search

6. Oakland shares blocklist with trusted partners
   └─► {domain: "evil.feed.com", reason: "spam", evidence: "..."}

7. Portland imports blocklist
   └─► evil.feed.com pre-emptively blocked
```

---

## Appendix D: Configuration Files

### federation.json (Manual Federation Config)

```json
{
  "version": "1.0",
  "instance": {
    "name": "Seattle FEED",
    "domain": "seattle.feed.social",
    "adminContact": "admin@seattle.feed.social",
    "geographicFocus": {
      "city": "Seattle",
      "state": "WA",
      "country": "US"
    }
  },
  "federation": {
    "enabled": true,
    "autoAcceptHandshakes": false,
    "minimumTrustLevel": 0.3,
    "syncInterval": "15m",
    "maxFederatedInstances": 50
  },
  "federatedInstances": [
    {
      "name": "Oakland FEED",
      "domain": "oakland.feed.social",
      "adminContact": "admin@oakland.feed.social",
      "addedAt": "2026-01-15T10:00:00Z",
      "trustLevel": 0.8,
      "status": "active",
      "notes": "Original federation partner"
    },
    {
      "name": "Portland FEED",
      "domain": "portland.feed.social",
      "adminContact": "admin@portland.feed.social",
      "addedAt": "2026-01-20T14:30:00Z",
      "trustLevel": 0.7,
      "status": "active"
    }
  ],
  "blocklist": [
    {
      "domain": "evil.feed.com",
      "reason": "spam",
      "addedAt": "2026-02-01T09:00:00Z",
      "addedBy": "admin@seattle.feed.social"
    }
  ]
}
```

### .env (Federation Secrets)

```bash
# Federation Private Key (NEVER commit to git)
FEED_FEDERATION_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# Redis (for rate limiting and caching)
REDIS_URL="redis://localhost:6379"

# Supabase (existing)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
```

---

## Appendix E: References & Further Reading

### Research Papers
- [Mastodon Architecture](https://softwaremill.com/the-architecture-of-mastodon/) - SoftwareMill Blog
- [Distributed Hash Tables](https://docs.ipfs.tech/concepts/dht/) - IPFS Documentation
- [Eventual Consistency](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html) - Werner Vogels, CTO Amazon
- [Web of Trust](https://wiki.p2pfoundation.net/Web_of_Trust) - P2P Foundation

### Protocol Specifications
- [ActivityPub W3C Recommendation](https://www.w3.org/TR/activitypub/)
- [WebFinger RFC 7033](https://datatracker.ietf.org/doc/html/rfc7033)
- [HTTP Signatures Draft](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures)
- [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)

### Implementation Examples
- [Mastodon Federation Documentation](https://docs.joinmastodon.org/spec/activitypub/)
- [Lemmy ActivityPub Federation (Rust)](https://github.com/LemmyNet/activitypub-federation-rust)
- [ForgeFed Protocol](https://github.com/forgefed/forgefed)

### Tools & Libraries
- **HTTP Signatures**: [http-signature](https://www.npmjs.com/package/http-signature) (Node.js)
- **ActivityPub**: [activitypub-express](https://www.npmjs.com/package/activitypub-express)
- **DHT**: [libp2p](https://libp2p.io/) (IPFS stack)
- **Trust Scoring**: Custom implementation (see Trust Model section)

---

## Appendix F: FAQ

**Q: Why not use ActivityPub directly?**

A: ActivityPub is designed for social networks (user follows, posts, likes). FEED needs resource directories (food banks, services). We borrow ActivityPub patterns (HTTP signatures, JSON-LD, Actor model) but simplify for our use case.

**Q: Can users log in across instances?**

A: Not in Phase 1. Users are local to each instance. We may add cross-instance authentication in Phase 2 using OAuth/OIDC.

**Q: What if two instances have conflicting data for the same resource?**

A: We use Last Write Wins (LWW) based on `updated_at` timestamp. Conflicts are logged for admin review. In the future, we may use CRDTs for automatic conflict resolution.

**Q: How do you prevent spam instances?**

A: Trust score system + blocklists. New instances start with low trust (limited resource sharing). Trust increases over time with good behavior. Malicious instances are blocklisted and shared across federation.

**Q: What if a federated instance goes offline?**

A: Resources remain cached locally. After 24 hours, resources are marked as "stale". After 90 days, resources are hidden from search (but not deleted). When instance comes back online, resources are re-synced.

**Q: Can I federate with only specific instances?**

A: Yes. Federation is opt-in and manual. Admin explicitly adds each federation partner. You control who you federate with.

**Q: Does federation share user data?**

A: No. Only resources (food banks, services) are federated. User accounts, form submissions, posts, and personal data NEVER leave the instance.

**Q: What about GDPR compliance?**

A: Resources contain no personal data (only public service information). Form submissions are never federated. Each instance is its own data controller for its users.

**Q: Can I run a private instance without federation?**

A: Yes. Federation is optional. You can run FEED as a standalone instance without any federation.

---

**End of Specification**

---

## Document Metadata

- **Version**: 1.0 (Draft)
- **Status**: Request for Comments (RFC)
- **Authors**: FEED Platform Team
- **License**: CC BY-SA 4.0
- **Feedback**: Submit issues at `github.com/feed-platform/federation`
- **Discussion**: Discord #federation channel

**Changelog**:
- 2026-02-05: Initial draft (v1.0)
