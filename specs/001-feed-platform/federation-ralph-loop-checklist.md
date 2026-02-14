---
feature: "FEED Federation Protocol"
version: "1.0.0"
created: "2026-02-11"
last_updated: "2026-02-14"
status: "IN_PROGRESS"
current_phase: 5
current_task: "F5-T1"
total_phases: 6
total_tasks: 48
completed_tasks: 32
---

# FEED Federation - Ralph Loop Development Checklist

## Purpose
This checklist enables autonomous agent development of the FEED Federation Protocol via Ralph Loop. The agent references this file to:
1. Understand current federation implementation progress
2. Identify the next actionable federation task
3. Update completion status after each task
4. Self-prompt continuation of federation development

---

## How to Use This Checklist (Agent Instructions)

### On Session Start
1. READ this file completely
2. LOCATE `current_phase` and `current_task` in frontmatter
3. FIND the corresponding uncompleted task (marked `[ ]`)
4. EXECUTE that task following its specifications
5. UPDATE the checkbox to `[x]` when complete
6. INCREMENT `completed_tasks` in frontmatter
7. SET `current_task` to next uncompleted task ID
8. CONTINUE to next task or report phase completion

### Task Execution Protocol
```
FOR each task:
  1. Read task description and acceptance criteria
  2. Check dependencies (previous tasks must be [x])
  3. Execute implementation
  4. Run validation commands
  5. Mark complete [x] only if ALL validations pass
  6. Update frontmatter metrics
  7. Proceed to next task
```

### Phase Transition Protocol
```
WHEN all tasks in a phase are [x]:
  1. Run phase exit criteria validations
  2. Update current_phase to next phase number
  3. Set current_task to first task of new phase
  4. Report phase completion summary
```

---

## Progress Dashboard

| Phase | Name | Tasks | Completed | Status |
|-------|------|-------|-----------|--------|
| 1 | Federation Foundation | 8 | 8 | COMPLETE |
| 2 | Authentication & Trust | 8 | 8 | COMPLETE |
| 3 | Resource Sync | 8 | 8 | COMPLETE |
| 4 | Federated Search | 8 | 8 | COMPLETE |
| 5 | Advanced Features | 8 | 0 | IN_PROGRESS |
| 6 | Production Hardening | 8 | 0 | PENDING |

**Overall Progress**: 16 / 48 tasks (33%)

---

## PHASE 1: Federation Foundation (Weeks 1-4)

### Section 1A: Database Schema

#### F1-T1: Apply Federation Database Migration
- [x] **Status**: COMPLETE
- **ID**: F1-T1
- **Dependencies**: None (base FEED platform complete)
- **Description**: Apply the federation tables migration to local and production databases
- **Migration File**: `supabase/migrations/20260211000000_federation_tables.sql`
- **Commands**:
  ```bash
  # Local
  npx supabase db push

  # Production (after local test)
  npx supabase db push --linked

  # Regenerate types
  npx supabase gen types typescript --local > packages/database/types.ts
  ```
- **Validation**:
  ```bash
  # Verify all 6 tables created
  npx supabase db dump --schema-only | grep -E "(federated_instances|federation_peers|federated_resources|federation_sync_log|federation_health_checks|federation_trust_events)"

  # Check RLS policies
  npx supabase db dump --schema-only | grep -c "CREATE POLICY"  # Should be >= 12
  ```
- **Acceptance Criteria**:
  - [x] Migration file exists (already created)
  - [x] Migration applied to production database
  - [x] All 6 federation tables exist
  - [x] All RLS policies created
  - [x] TypeScript types regenerated
  - [x] Federation types available in packages/database/types.ts

#### F1-T2: Create Federation Configuration
- [x] **Status**: COMPLETE
- **ID**: F1-T2
- **Dependencies**: F1-T1
- **Description**: Create configuration management for federation settings
- **File**: `packages/shared/lib/federation-config.ts`
- **Implementation**:
  ```typescript
  export interface FederationConfig {
    instanceUrl: string
    instanceName: string
    publicKey: string
    privateKey: string
    isLocal: boolean
    syncIntervalMinutes: number
    maxPeerTrustScore: number
    minPeerTrustScore: number
  }

  export function loadFederationConfig(): FederationConfig
  export function validateConfig(config: FederationConfig): boolean
  ```
- **Acceptance Criteria**:
  - [x] Config interface defined
  - [x] Config loaded from environment variables
  - [x] Validation function implemented
  - [x] Types exported from package

### Section 1B: Cryptographic Infrastructure

#### F1-T3: Create Keypair Generation CLI
- [x] **Status**: COMPLETE
- **ID**: F1-T3
- **Dependencies**: F1-T2
- **Description**: Build CLI tool to generate RSA-4096 keypairs for federation auth
- **File**: `scripts/federation/generate-keypair.ts`
- **Commands**:
  ```bash
  npm run federation:generate-keys
  ```
- **Implementation**:
  ```typescript
  // Generate RSA-4096 keypair
  // Save private_key.pem (keep secret!)
  // Save public_key.pem (share with partners)
  // Update .env.local with FEDERATION_PRIVATE_KEY
  // Print public key for sharing
  ```
- **Acceptance Criteria**:
  - [x] Script generates 4096-bit RSA keypair
  - [x] Keys saved to files
  - [x] PEM format validated
  - [x] Instructions printed to console
  - [x] npm script added to package.json

#### F1-T4: Create HTTP Signature Utilities
- [x] **Status**: COMPLETE
- **ID**: F1-T4
- **Dependencies**: F1-T3
- **Description**: Implement HTTP Signatures (RFC 9421) for request authentication
- **File**: `packages/shared/lib/http-signatures.ts`
- **Implementation**:
  ```typescript
  export function signRequest(
    privateKey: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: string
  ): string

  export function verifySignature(
    publicKey: string,
    signature: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: string
  ): boolean
  ```
- **Acceptance Criteria**:
  - [x] signRequest creates valid HTTP signature
  - [x] verifySignature validates signatures
  - [x] Uses SHA-256 for body digest
  - [x] Includes (request-target), host, date, digest headers
  - [x] Unit tests pass

### Section 1C: Instance Metadata

#### F1-T5: Create Local Instance Registration
- [x] **Status**: COMPLETE
- **ID**: F1-T5
- **Dependencies**: F1-T1, F1-T3
- **Description**: Register this instance in federated_instances table
- **File**: `scripts/federation/register-local-instance.ts`
- **Commands**:
  ```bash
  npm run federation:register-local
  ```
- **Implementation**:
  - Check if local instance exists (is_local = TRUE)
  - If not, insert local instance record
  - Update public_key from generated keypair
  - Set instance_url from environment
  - Set status to 'active'
- **Acceptance Criteria**:
  - [x] Script creates local instance record
  - [x] Only one local instance allowed (unique constraint enforced)
  - [x] Public key stored correctly
  - [x] Instance URL matches .env.local

#### F1-T6: Create Instance Metadata Endpoint
- [x] **Status**: COMPLETE
- **ID**: F1-T6
- **Dependencies**: F1-T5
- **Description**: Build API endpoint to expose instance metadata for federation discovery
- **File**: `apps/web/src/app/api/federation/instance/route.ts`
- **Endpoint**: `GET /.well-known/feed-instance`
- **Response**:
  ```json
  {
    "instance_url": "https://oakland.feed.org",
    "instance_name": "Oakland FEED",
    "version": "1.0.0",
    "public_key": "-----BEGIN PUBLIC KEY-----...",
    "capabilities": ["resources", "search"],
    "metadata": {
      "region": "oakland-ca",
      "resource_count": 1234,
      "last_updated": "2026-02-11T00:00:00Z"
    }
  }
  ```
- **Acceptance Criteria**:
  - [x] Endpoint returns instance metadata
  - [x] Public key included in response
  - [x] No sensitive data exposed
  - [x] CORS headers configured
  - [x] Cached appropriately (1 hour)

### Section 1D: Basic Federation Client

#### F1-T7: Create Federation Client Service
- [x] **Status**: COMPLETE
- **ID**: F1-T7
- **Dependencies**: F1-T4, F1-T6
- **Description**: Build service to make authenticated requests to federated instances
- **File**: `packages/shared/lib/federation-client.ts`
- **Implementation**:
  ```typescript
  export class FederationClient {
    constructor(privateKey: string, instanceUrl: string)

    async fetchInstanceMetadata(remoteUrl: string): Promise<InstanceMetadata>
    async fetchResources(remoteUrl: string, query: ResourceQuery): Promise<Resource[]>
    async healthCheck(remoteUrl: string): Promise<HealthStatus>
  }
  ```
- **Acceptance Criteria**:
  - [x] Client signs all outbound requests
  - [x] Handles 401/403 errors gracefully
  - [x] Implements retry logic (3 attempts)
  - [x] Timeout after 10 seconds
  - [x] Unit tests for happy path and errors

#### F1-T8: Create Manual Partner Addition UI
- [x] **Status**: COMPLETE
- **ID**: F1-T8
- **Dependencies**: F1-T7
- **Description**: Build admin UI to manually add federation partners
- **File**: `apps/web/src/app/(admin)/federation/page.tsx`
- **Features**:
  - Form to add new partner (URL, name, notes)
  - Fetch remote instance metadata
  - Validate public key
  - Set initial trust level (pending)
  - Enable/disable federation
- **Acceptance Criteria**:
  - [x] Admin page renders
  - [x] Form validates inputs
  - [x] Fetches remote metadata on submit
  - [x] Creates federation_peers record
  - [x] Creates federated_instances record if new
  - [x] Displays success/error messages

---

## PHASE 1 EXIT CRITERIA

Before proceeding to Phase 2, ALL must be true:

- [x] Federation database tables exist with RLS policies
- [x] Keypair generated and stored securely
- [x] Local instance registered
- [x] Instance metadata endpoint accessible
- [x] Can manually add a federation partner
- [x] Federation client can make signed requests
- [x] All F1 tasks marked [x]

**Phase 1 Validation Command**:
```bash
# Run this validation suite
npm run build && npm run type-check
curl http://localhost:3000/.well-known/feed-instance | jq
npx supabase db dump --schema-only | grep -c "federated_"
```

---

## PHASE 2: Authentication & Trust (Weeks 5-8)

### Section 2A: Request Verification

#### F2-T1: Create Signature Verification Middleware
- [x] **Status**: COMPLETE
- **ID**: F2-T1
- **Dependencies**: F1 Complete
- **Description**: Build middleware to verify HTTP signatures on inbound federation requests
- **File**: `apps/web/src/lib/federation/verify-federation.ts`
- **Implementation**:
  - Extract signature from Authorization header
  - Look up sender's public key
  - Verify signature matches request
  - Check timestamp (reject if > 5 minutes old)
  - Attach verified instance to request context
- **Acceptance Criteria**:
  - [x] Middleware verifies valid signatures
  - [x] Rejects invalid signatures (401)
  - [x] Rejects expired signatures (401)
  - [x] Rejects unknown instances (403)
  - [x] Unit tests for all cases

#### F2-T2: Create Trust Score Calculator
- [x] **Status**: COMPLETE
- **ID**: F2-T2
- **Dependencies**: F2-T1
- **Description**: Implement trust score calculation algorithm
- **File**: `packages/shared/lib/trust-calculator.ts`
- **Algorithm**:
  ```typescript
  trustScore =
    uptime_score * 0.30 +
    data_quality_score * 0.25 +
    moderation_score * 0.20 +
    community_score * 0.15 +
    longevity_score * 0.10
  ```
- **Acceptance Criteria**:
  - [x] Function calculates weighted trust score
  - [x] Returns value 0.0 - 1.0
  - [x] Handles missing metrics gracefully
  - [x] Unit tests cover edge cases

#### F2-T3: Create Trust Level Classifier
- [x] **Status**: COMPLETE
- **ID**: F2-T3
- **Dependencies**: F2-T2
- **Description**: Classify trust scores into discrete trust levels
- **File**: `packages/shared/lib/trust-levels.ts`
- **Implementation**:
  ```typescript
  function classifyTrustLevel(score: number): TrustLevel {
    if (score < 0.2) return 'untrusted'
    if (score < 0.4) return 'pending'
    if (score < 0.7) return 'trusted'
    if (score < 0.9) return 'verified'
    return 'core'
  }
  ```
- **Acceptance Criteria**:
  - [x] Correctly maps scores to levels
  - [x] Returns appropriate permissions per level
  - [x] Unit tests for boundary conditions

### Section 2B: Health Monitoring

#### F2-T4: Create Health Check Scheduler
- [x] **Status**: COMPLETE
- **ID**: F2-T4
- **Dependencies**: F1-T7
- **Description**: Build scheduled job to health check all federation partners
- **File**: `supabase/functions/federation-health-check/index.ts`
- **Schedule**: Every 5 minutes
- **Implementation**:
  - Fetch all active federation_peers
  - For each peer, call /health endpoint
  - Record response time and status
  - Update federation_health_checks table
  - Decrement trust on repeated failures
- **Acceptance Criteria**:
  - [x] Edge Function deploys successfully
  - [x] Scheduled via pg_cron or Supabase cron
  - [x] Health checks recorded in database
  - [x] Trust score decreases on failures
  - [x] Logs errors for debugging

#### F2-T5: Create Uptime Calculator
- [x] **Status**: COMPLETE
- **ID**: F2-T5
- **Dependencies**: F2-T4
- **Description**: Calculate uptime percentage from health check history
- **File**: `packages/shared/lib/uptime-calculator.ts`
- **Implementation**:
  ```typescript
  function calculateUptime(instanceId: string, days: number = 30): number {
    // Query last N days of health checks
    // Calculate: healthy_checks / total_checks
    // Return as percentage
  }
  ```
- **Acceptance Criteria**:
  - [x] Returns uptime as 0-100 percentage
  - [x] Defaults to 30-day window
  - [x] Handles instances with no checks (returns null)
  - [x] Unit tests with mock data

#### F2-T6: Create Data Quality Scorer
- [x] **Status**: COMPLETE
- **ID**: F2-T6
- **Dependencies**: F2-T2
- **Description**: Score resource data quality from federated instances
- **File**: `packages/shared/lib/data-quality-scorer.ts`
- **Metrics**:
  - Completeness: % of required fields populated
  - Accuracy: User reports of correctness
  - Freshness: How recently updated
  - Validity: % passing validation
- **Acceptance Criteria**:
  - [x] Returns score 0.0 - 1.0
  - [x] Weighted by metric importance
  - [x] Handles sparse data gracefully
  - [x] Unit tests for all metrics

#### F2-T7: Create Trust Event Logger
- [x] **Status**: COMPLETE
- **ID**: F2-T7
- **Dependencies**: F2-T2
- **Description**: Log all trust score changes with audit trail
- **File**: `packages/shared/lib/trust-event-logger.ts`
- **Implementation**:
  ```typescript
  async function logTrustEvent(
    peerId: string,
    eventType: TrustEventType,
    oldScore: number,
    newScore: number,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void>
  ```
- **Acceptance Criteria**:
  - [x] Inserts into federation_trust_events table
  - [x] Captures before/after scores
  - [x] Includes reason and metadata
  - [x] Tracks created_by (system or admin)

#### F2-T8: Create Federation Admin Dashboard
- [x] **Status**: COMPLETE
- **ID**: F2-T8
- **Dependencies**: F2-T1 through F2-T7
- **Description**: Build admin UI to monitor federation health and trust
- **File**: `apps/web/src/app/(admin)/federation/dashboard/page.tsx`
- **Features**:
  - List all federation partners with trust scores
  - Show uptime graphs
  - Display recent health checks
  - View trust event history
  - Manual trust score override
  - Block/suspend instances
- **Acceptance Criteria**:
  - [x] Dashboard renders with real data
  - [x] Graphs display correctly
  - [x] Manual actions persist to database
  - [x] Real-time updates via Supabase realtime

---

## PHASE 2 EXIT CRITERIA

- [x] Inbound requests verified via HTTP signatures
- [x] Trust scores calculated for all partners
- [x] Health checks run on schedule
- [x] Admin can monitor federation health
- [x] Trust events audited
- [x] All F2 tasks marked [x]

---

## PHASE 3: Resource Sync (Weeks 9-12)

### Section 3A: Pull-Based Sync

#### F3-T1: Create Resource API Endpoint
- [x] **Status**: COMPLETE
- **ID**: F3-T1
- **Dependencies**: F2 Complete
- **Description**: Build API endpoint to serve local resources to federation partners
- **File**: `apps/web/src/app/api/federation/resources/route.ts`
- **Endpoint**: `GET /api/federation/resources`
- **Query Parameters**:
  - `since` (ISO8601 timestamp) - only return resources updated after this
  - `category` (string) - filter by resource category
  - `limit` (number) - max resources to return (default 100, max 1000)
  - `cursor` (string) - pagination cursor
- **Response**:
  ```json
  {
    "resources": [...],
    "cursor": "next_page_cursor",
    "has_more": true,
    "total": 1234
  }
  ```
- **Acceptance Criteria**:
  - [x] Endpoint requires federation authentication
  - [x] Filters resources by trust level
  - [x] Pagination works correctly
  - [x] Only returns public resources (not user data)
  - [x] Rate limited (100 req/min per instance)

#### F3-T2: Create Sync Scheduler
- [x] **Status**: COMPLETE
- **ID**: F3-T2
- **Dependencies**: F3-T1
- **Description**: Build scheduled job to sync resources from partners
- **File**: `supabase/functions/federation-sync/index.ts`
- **Schedule**: Every 15 minutes (configurable per peer)
- **Implementation**:
  - Fetch all enabled federation_peers
  - For each peer with auto_sync_enabled:
    - Call /api/federation/resources?since=last_synced_at
    - Transform resources to local schema
    - Upsert into federated_resources table
    - Update sync log
    - Update trust score based on data quality
- **Acceptance Criteria**:
  - [x] Syncs resources from all enabled peers
  - [x] Handles errors gracefully (logs, doesn't crash)
  - [x] Updates last_synced_at timestamp
  - [x] Records metrics in federation_sync_log
  - [x] Respects rate limits

#### F3-T3: Create Resource Transformer
- [x] **Status**: COMPLETE
- **ID**: F3-T3
- **Dependencies**: F3-T2
- **Description**: Transform federated resource schemas to local format
- **File**: `packages/shared/lib/resource-transformer.ts`
- **Implementation**:
  ```typescript
  export function transformFederatedResource(
    rawResource: any,
    sourceInstance: FederatedInstance
  ): FederatedResource {
    // Map fields to local schema
    // Inherit trust score from instance
    // Add source attribution
    // Validate required fields
  }
  ```
- **Acceptance Criteria**:
  - [x] Handles missing fields gracefully
  - [x] Validates transformed resource
  - [x] Preserves source attribution
  - [x] Unit tests for various input schemas

#### F3-T4: Create Deduplication Logic
- [x] **Status**: COMPLETE
- **ID**: F3-T4
- **Dependencies**: F3-T3
- **Description**: Detect and merge duplicate resources across instances
- **File**: `packages/shared/lib/resource-deduplicator.ts`
- **Algorithm**:
  - Fuzzy match on name + address
  - Levenshtein distance < 3 = likely duplicate
  - If duplicate: merge data, keep highest trust source
  - Track conflicts in federated_resource_conflicts
- **Acceptance Criteria**:
  - [x] Detects obvious duplicates (same name + address)
  - [x] Detects fuzzy duplicates (typos, abbreviations)
  - [x] Merges data intelligently
  - [x] Flags conflicts for review
  - [x] Unit tests with known duplicates

### Section 3B: Conflict Resolution

#### F3-T5: Create Conflict Detector
- [x] **Status**: COMPLETE
- **ID**: F3-T5
- **Dependencies**: F3-T4
- **Description**: Detect data conflicts between federated resources
- **File**: `packages/shared/lib/conflict-detector.ts`
- **Conflict Types**:
  - `duplicate`: Same resource from different instances
  - `divergent_data`: Different values for same field
  - `deleted`: Resource exists locally but deleted upstream
- **Acceptance Criteria**:
  - [x] Detects all conflict types
  - [x] Records in federated_resource_conflicts
  - [x] Includes conflicting data for review
  - [x] Returns conflict severity (low/medium/high)

#### F3-T6: Create Auto-Resolution Rules
- [x] **Status**: COMPLETE
- **ID**: F3-T6
- **Dependencies**: F3-T5
- **Description**: Implement automatic conflict resolution for low-severity conflicts
- **File**: `packages/shared/lib/auto-resolver.ts`
- **Rules**:
  - Prefer data from higher trust instance
  - For timestamps, take most recent
  - For enums, prefer canonical value
  - For phone/email, keep both if different
- **Acceptance Criteria**:
  - [x] Resolves duplicates automatically
  - [x] Logs resolution in conflict record
  - [x] Marks as 'auto_resolved'
  - [x] Leaves high-severity for manual review

#### F3-T7: Create Manual Conflict Review UI
- [x] **Status**: COMPLETE
- **ID**: F3-T7
- **Dependencies**: F3-T5, F3-T6
- **Description**: Build admin UI to review and resolve conflicts
- **File**: `apps/web/src/app/(admin)/federation/conflicts/page.tsx`
- **Features**:
  - List unresolved conflicts
  - Side-by-side diff view
  - Choose winning version
  - Merge fields manually
  - Mark as resolved
- **Acceptance Criteria**:
  - [x] Displays all unresolved conflicts
  - [x] Shows conflicting data clearly
  - [x] Admin can choose resolution
  - [x] Updates resource and marks resolved
  - [x] Logs resolved_by admin

#### F3-T8: Create Sync Status Monitor
- [x] **Status**: COMPLETE
- **ID**: F3-T8
- **Dependencies**: F3-T2
- **Description**: Build UI to monitor sync progress and errors
- **File**: `apps/web/src/app/(admin)/federation/sync/page.tsx`
- **Features**:
  - Last sync time per partner
  - Resources synced count
  - Error log
  - Manual sync trigger
  - Sync schedule configuration
- **Acceptance Criteria**:
  - [x] Shows sync status for all partners
  - [x] Displays recent errors
  - [x] Manual sync button works
  - [x] Updates in real-time

---

## PHASE 3 EXIT CRITERIA

- [x] Resources sync from partners on schedule
- [x] Duplicates detected and deduplicated
- [x] Conflicts logged and reviewable
- [x] Admin can monitor sync status
- [x] Sync errors handled gracefully
- [x] All F3 tasks marked [x]

---

## PHASE 4: Federated Search (Weeks 13-16)

### Section 4A: Distributed Query

#### F4-T1: Create Federated Search API
- [x] **Status**: COMPLETE
- **ID**: F4-T1
- **Dependencies**: F3 Complete
- **Description**: Build API to search across local + federated resources
- **File**: `apps/web/src/app/api/search/federated/route.ts`
- **Endpoint**: `POST /api/search/federated`
- **Request**:
  ```json
  {
    "query": "food bank",
    "category": "food",
    "location": { "lat": 37.8, "lng": -122.4, "radius_miles": 10 },
    "include_federated": true,
    "max_results": 50
  }
  ```
- **Implementation**:
  - Search local resources
  - Search federated_resources cache
  - Optionally: real-time query to trusted partners (if cache stale)
  - Merge and rank results
  - Deduplicate
- **Acceptance Criteria**:
  - [x] Searches local and federated resources
  - [x] Returns unified result set
  - [x] Includes source attribution
  - [x] Respects max_results limit
  - [x] Response time < 500ms (cached)

#### F4-T2: Create Result Ranking Algorithm
- [x] **Status**: COMPLETE
- **ID**: F4-T2
- **Dependencies**: F4-T1
- **Description**: Rank search results by relevance and trust
- **File**: `packages/shared/lib/result-ranker.ts`
- **Ranking Factors**:
  - Relevance score (text match quality)
  - Trust score (instance + resource)
  - Distance (proximity to user)
  - Freshness (last_synced_at)
  - Completeness (% of fields populated)
- **Acceptance Criteria**:
  - [x] Returns ranked results array
  - [x] Weights factors appropriately
  - [x] Local resources boosted slightly
  - [x] Unit tests verify ranking logic

#### F4-T3: Create Source Attribution UI
- [x] **Status**: COMPLETE
- **ID**: F4-T3
- **Dependencies**: F4-T1
- **Description**: Display resource source prominently in search results
- **File**: `apps/web/src/components/resources/resource-source-badge.tsx`
- **Design**:
  - Badge showing instance name
  - Trust level indicator (color-coded)
  - Tooltip with sync timestamp
- **Acceptance Criteria**:
  - [x] Badge renders for federated resources
  - [x] Color matches trust level
  - [x] Tooltip shows details on hover
  - [x] Accessible (ARIA labels)

#### F4-T4: Create Real-Time Federated Query
- [x] **Status**: COMPLETE
- **ID**: F4-T4
- **Dependencies**: F4-T1
- **Description**: Optionally query partners in real-time for fresh results
- **File**: `packages/shared/lib/realtime-federated-query.ts`
- **Implementation**:
  - Only for high-trust partners
  - Only if cache is stale (> 1 hour old)
  - Parallel requests with Promise.allSettled
  - Timeout after 2 seconds
  - Fall back to cached results on timeout
- **Acceptance Criteria**:
  - [x] Queries partners in parallel
  - [x] Handles timeouts gracefully
  - [x] Merges results with local
  - [x] Doesn't block local results
  - [x] Respects rate limits

### Section 4B: Search UX

#### F4-T5: Create Federated Search UI Toggle
- [x] **Status**: COMPLETE
- **ID**: F4-T5
- **Dependencies**: F4-T1
- **Description**: Add toggle to enable/disable federated search in UI
- **File**: `apps/web/src/components/search/search-filters.tsx`
- **Design**:
  - Checkbox: "Include results from partner instances"
  - Shows count of partners searched
  - Defaults to enabled
- **Acceptance Criteria**:
  - [x] Toggle controls include_federated parameter
  - [x] Persists to user preferences
  - [x] Updates results on change
  - [x] Shows partner count when enabled

#### F4-T6: Create Federated Resource Detail View
- [x] **Status**: COMPLETE
- **ID**: F4-T6
- **Dependencies**: F4-T3
- **Description**: Build detail view for federated resources
- **File**: `apps/web/src/components/resources/federated-resource-detail.tsx`
- **Features**:
  - All resource fields
  - Source instance badge
  - Link to original on source instance
  - Last synced timestamp
  - "Report incorrect data" button
- **Acceptance Criteria**:
  - [x] Displays all resource data
  - [x] Source attribution prominent
  - [x] Link to source instance works
  - [x] Report button functional

#### F4-T7: Create Search Performance Monitoring
- [x] **Status**: COMPLETE
- **ID**: F4-T7
- **Dependencies**: F4-T1, F4-T4
- **Description**: Track search performance metrics
- **File**: `packages/shared/lib/search-metrics.ts`
- **Metrics**:
  - Query latency (p50, p95, p99)
  - Result count (local vs federated)
  - Cache hit rate
  - Real-time query success rate
- **Acceptance Criteria**:
  - [x] Logs metrics to database
  - [x] Aggregates by time window
  - [x] Exportable to monitoring tools
  - [x] Admin dashboard displays trends

#### F4-T8: Create Search Analytics Dashboard
- [x] **Status**: COMPLETE
- **ID**: F4-T8
- **Dependencies**: F4-T7
- **Description**: Build admin dashboard for search analytics
- **File**: `apps/web/src/app/(admin)/federation/search-analytics/page.tsx`
- **Features**:
  - Search volume over time
  - Most popular queries
  - Federated vs local result ratio
  - Performance graphs
  - Partner contribution breakdown
- **Acceptance Criteria**:
  - [x] Displays all metrics
  - [x] Graphs render correctly
  - [x] Filterable by date range
  - [x] Exportable as CSV

---

## PHASE 4 EXIT CRITERIA

- [x] Federated search returns results from partners
- [x] Results ranked by relevance + trust
- [x] Source attribution visible in UI
- [x] Search performance acceptable (< 500ms)
- [x] Admin can monitor search analytics
- [x] All F4 tasks marked [x]

---

## PHASE 5: Advanced Features (Weeks 17-20)

### Section 5A: Discovery Protocol

#### F5-T1: Implement WebFinger Discovery
- [ ] **Status**: NOT_STARTED
- **ID**: F5-T1
- **Dependencies**: F4 Complete
- **Description**: Implement WebFinger (RFC 7033) for instance discovery
- **File**: `apps/web/src/app/.well-known/webfinger/route.ts`
- **Endpoint**: `GET /.well-known/webfinger?resource=acct:feed@oakland.feed.org`
- **Response**:
  ```json
  {
    "subject": "acct:feed@oakland.feed.org",
    "links": [
      {
        "rel": "self",
        "type": "application/activity+json",
        "href": "https://oakland.feed.org/api/federation/instance"
      },
      {
        "rel": "http://webfinger.net/rel/profile-page",
        "href": "https://oakland.feed.org"
      }
    ]
  }
  ```
- **Acceptance Criteria**:
  - [ ] Endpoint returns valid WebFinger response
  - [ ] CORS headers configured
  - [ ] Cached appropriately
  - [ ] Handles malformed queries

#### F5-T2: Create Instance Discovery UI
- [ ] **Status**: NOT_STARTED
- **ID**: F5-T2
- **Dependencies**: F5-T1
- **Description**: Build UI to discover and add instances via WebFinger
- **File**: `apps/web/src/app/(admin)/federation/discover/page.tsx`
- **Features**:
  - Search for instances by domain
  - Auto-detect via WebFinger
  - Show instance metadata preview
  - One-click add to partners
- **Acceptance Criteria**:
  - [ ] Search discovers instances
  - [ ] Displays instance info
  - [ ] Add button creates peer
  - [ ] Handles discovery failures

#### F5-T3: Create Instance Directory
- [ ] **Status**: NOT_STARTED
- **ID**: F5-T3
- **Dependencies**: F5-T2
- **Description**: Build public directory of known FEED instances
- **File**: `apps/web/src/app/federation/directory/page.tsx`
- **Features**:
  - List all active instances
  - Filter by region/category
  - Show resource count
  - Request federation button
- **Acceptance Criteria**:
  - [ ] Lists active instances
  - [ ] Filterable and searchable
  - [ ] Users can request federation
  - [ ] Publicly accessible (no auth)

#### F5-T4: Create Peer Recommendation Engine
- [ ] **Status**: NOT_STARTED
- **ID**: F5-T4
- **Dependencies**: F5-T3
- **Description**: Suggest federation partners based on proximity and trust
- **File**: `packages/shared/lib/peer-recommender.ts`
- **Algorithm**:
  - Find instances within 100 miles
  - Filter by min trust score (0.5)
  - Rank by resource count + trust
  - Exclude already-partnered instances
- **Acceptance Criteria**:
  - [ ] Returns recommended instances
  - [ ] Ranks by relevance
  - [ ] Handles edge cases (no nearby instances)
  - [ ] Admin can approve recommendations

### Section 5B: Advanced Sync

#### F5-T5: Implement Incremental Sync
- [ ] **Status**: NOT_STARTED
- **ID**: F5-T5
- **Dependencies**: F3-T2
- **Description**: Optimize sync to only fetch changed resources
- **Implementation**:
  - Use `If-Modified-Since` header
  - Track resource ETags
  - Only fetch resources updated since last sync
  - Handle deletions (tombstones)
- **Acceptance Criteria**:
  - [ ] Syncs only changed resources
  - [ ] Handles deletions correctly
  - [ ] Reduces network usage by 80%+
  - [ ] Maintains data consistency

#### F5-T6: Create Selective Sync Categories
- [ ] **Status**: NOT_STARTED
- **ID**: F5-T6
- **Dependencies**: F3-T2
- **Description**: Allow admins to select which resource categories to sync
- **File**: `apps/web/src/app/(admin)/federation/sync-config/page.tsx`
- **Features**:
  - Checkbox for each category (food, housing, healthcare, etc.)
  - Per-partner configuration
  - Bulk enable/disable
- **Acceptance Criteria**:
  - [ ] Admin can select categories
  - [ ] Sync respects category filter
  - [ ] Persists to federation_peers.shared_resource_categories
  - [ ] Updates take effect on next sync

#### F5-T7: Create Webhook Notifications
- [ ] **Status**: NOT_STARTED
- **ID**: F5-T7
- **Dependencies**: F3-T2
- **Description**: Notify partners of resource updates via webhooks
- **File**: `supabase/functions/federation-webhook/index.ts`
- **Implementation**:
  - Trigger on resource insert/update/delete
  - POST to partner webhook URLs
  - Include resource ID + change type
  - Retry on failure (3 attempts)
- **Acceptance Criteria**:
  - [ ] Webhook fires on resource changes
  - [ ] Partners receive notifications
  - [ ] Includes minimal data (just IDs)
  - [ ] Retries on network errors

#### F5-T8: Create Webhook Receiver
- [ ] **Status**: NOT_STARTED
- **ID**: F5-T8
- **Dependencies**: F5-T7
- **Description**: Receive webhook notifications from partners
- **File**: `apps/web/src/app/api/federation/webhook/route.ts`
- **Endpoint**: `POST /api/federation/webhook`
- **Implementation**:
  - Verify signature
  - Validate payload
  - Trigger immediate sync for updated resource
  - Log webhook receipt
- **Acceptance Criteria**:
  - [ ] Receives webhooks from partners
  - [ ] Verifies signatures
  - [ ] Triggers targeted sync
  - [ ] Logs for debugging

---

## PHASE 5 EXIT CRITERIA

- [ ] WebFinger discovery works
- [ ] Instance directory functional
- [ ] Incremental sync reduces bandwidth
- [ ] Webhooks notify partners of changes
- [ ] Admin can configure sync per-partner
- [ ] All F5 tasks marked [x]

---

## PHASE 6: Production Hardening (Weeks 21-24)

### Section 6A: Security Hardening

#### F6-T1: Implement Rate Limiting
- [ ] **Status**: NOT_STARTED
- **ID**: F6-T1
- **Dependencies**: F5 Complete
- **Description**: Add comprehensive rate limiting to federation endpoints
- **File**: `apps/web/src/middleware/federation-rate-limit.ts`
- **Limits**:
  - Instance metadata: 10 req/min
  - Resource API: 100 req/min per instance
  - Search: 50 req/min per instance
  - Webhooks: 200 req/min per instance
- **Acceptance Criteria**:
  - [ ] Rate limits enforced
  - [ ] Returns 429 with Retry-After header
  - [ ] Per-instance tracking (not global)
  - [ ] Redis-based counter

#### F6-T2: Create Abuse Detection
- [ ] **Status**: NOT_STARTED
- **ID**: F6-T2
- **Dependencies**: F6-T1
- **Description**: Detect and block abusive federation partners
- **File**: `packages/shared/lib/abuse-detector.ts`
- **Patterns**:
  - Excessive request rate
  - Repeated invalid signatures
  - Malformed data in resources
  - Spam resources
- **Acceptance Criteria**:
  - [ ] Detects abuse patterns
  - [ ] Auto-suspends egregious offenders
  - [ ] Alerts admins
  - [ ] Logs evidence for review

#### F6-T3: Implement Content Filtering
- [ ] **Status**: NOT_STARTED
- **ID**: F6-T3
- **Dependencies**: F3-T2
- **Description**: Filter inappropriate content from federated resources
- **File**: `packages/shared/lib/content-filter.ts`
- **Filters**:
  - Profanity in resource names/descriptions
  - Known scam phone numbers
  - Malicious URLs
  - Spam keywords
- **Acceptance Criteria**:
  - [ ] Filters profanity
  - [ ] Blocks known scams
  - [ ] Validates URLs
  - [ ] Logs filtered content

#### F6-T4: Create Security Audit Log
- [ ] **Status**: NOT_STARTED
- **ID**: F6-T4
- **Dependencies**: F6-T1, F6-T2
- **Description**: Log all security-relevant events
- **File**: `packages/shared/lib/security-logger.ts`
- **Events**:
  - Failed signature verifications
  - Rate limit violations
  - Abuse detections
  - Instance suspensions
  - Admin overrides
- **Acceptance Criteria**:
  - [ ] Logs all security events
  - [ ] Includes context (IP, instance, timestamp)
  - [ ] Queryable by admins
  - [ ] Retained for 90 days

### Section 6B: Performance Optimization

#### F6-T5: Implement Resource Caching
- [ ] **Status**: NOT_STARTED
- **ID**: F6-T5
- **Dependencies**: F4-T1
- **Description**: Add Redis caching for federated resources
- **File**: `packages/shared/lib/federation-cache.ts`
- **Cache Keys**:
  - `federation:resources:{instance_id}` (TTL: 15 min)
  - `federation:search:{query_hash}` (TTL: 5 min)
  - `federation:instance:{domain}` (TTL: 1 hour)
- **Acceptance Criteria**:
  - [ ] Caches resource lists
  - [ ] Caches search results
  - [ ] Invalidates on sync
  - [ ] Reduces DB queries by 70%+

#### F6-T6: Optimize Database Queries
- [ ] **Status**: NOT_STARTED
- **ID**: F6-T6
- **Dependencies**: F4-T1
- **Description**: Add indexes and optimize slow queries
- **Queries to Optimize**:
  - Federated resource search (add GIN index on JSONB)
  - Geographic queries (add GIST index on lat/lng)
  - Trust score calculations (materialize view)
- **Commands**:
  ```sql
  CREATE INDEX CONCURRENTLY idx_fed_res_gin ON federated_resources USING GIN (data);
  CREATE INDEX CONCURRENTLY idx_fed_res_geo ON federated_resources USING GIST (ll_to_earth(latitude, longitude));
  ```
- **Acceptance Criteria**:
  - [ ] Search queries < 100ms
  - [ ] Geographic queries < 50ms
  - [ ] No missing indexes flagged by pg_stat_statements

#### F6-T7: Implement Connection Pooling
- [ ] **Status**: NOT_STARTED
- **ID**: F6-T7
- **Dependencies**: F6-T5
- **Description**: Add connection pooling for outbound federation requests
- **File**: `packages/shared/lib/federation-pool.ts`
- **Implementation**:
  - Pool of HTTP agents (keep-alive)
  - Max 5 concurrent requests per instance
  - Reuse connections
  - Timeout idle connections after 60s
- **Acceptance Criteria**:
  - [ ] Connection pool created
  - [ ] Reuses connections
  - [ ] Limits concurrency
  - [ ] Reduces latency by 30%+

#### F6-T8: Production Launch Readiness
- [ ] **Status**: NOT_STARTED
- **ID**: F6-T8
- **Dependencies**: F6-T1 through F6-T7
- **Description**: Final production readiness checklist
- **File**: `FEDERATION_LAUNCH_CHECKLIST.md`
- **Checklist**:
  - [ ] All database migrations applied to production
  - [ ] Federation keypair generated and secured
  - [ ] Environment variables set in production
  - [ ] Rate limits tested under load
  - [ ] Monitoring dashboards configured
  - [ ] Error alerting set up
  - [ ] Documentation complete
  - [ ] At least 2 federation partners live
  - [ ] Load tested (1000 concurrent users)
  - [ ] Security audit passed
- **Acceptance Criteria**:
  - [ ] Checklist document created
  - [ ] All items checked
  - [ ] Production deployment successful
  - [ ] Federation operational

---

## PHASE 6 EXIT CRITERIA (Federation Launch)

- [ ] Rate limiting enforced on all endpoints
- [ ] Abuse detection active
- [ ] Caching reduces DB load by 70%+
- [ ] Load tested to 1000+ concurrent users
- [ ] At least 2 live federation partners
- [ ] Monitoring dashboards operational
- [ ] Documentation complete
- [ ] All F6 tasks marked [x]

---

## AGENT SELF-PROMPTING TEMPLATES

### Starting a Session
```
Read /specs/001-feed-platform/federation-ralph-loop-checklist.md
Current Phase: {current_phase}
Current Task: {current_task}
Next Action: Execute task {current_task} following its specifications
```

### After Completing a Task
```
Task {task_id} completed successfully.
Updating checklist:
- Marked {task_id} as [x]
- Incremented completed_tasks to {new_count}
- Set current_task to {next_task_id}

Proceeding to {next_task_id}: {task_description}
```

### On Phase Completion
```
Phase {phase_number} complete!
All {task_count} tasks marked [x]
Exit criteria verified:
{exit_criteria_list}

Transitioning to Phase {next_phase}: {phase_name}
First task: {first_task_id}
```

### On Encountering Blockers
```
Task {task_id} blocked.
Reason: {blocker_reason}
Dependencies not met: {missing_dependencies}

Action: Complete {dependency_task_id} first, then return to {task_id}
```

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-11 | Initial federation checklist creation |
| 1.1.0 | 2026-02-13 | Phase 1 complete: All 8 tasks implemented |
| 1.2.0 | 2026-02-13 | Phase 2 complete: Authentication & Trust system |
| 1.3.0 | 2026-02-14 | Phase 3 complete: Resource Sync & Conflict Resolution |
| 1.4.0 | 2026-02-14 | Phase 4 complete: Federated Search system |

---

**Checklist Hash**: phase4-complete
**Last Agent Session**: 2026-02-14
**Total Federation Development Time**: ~12 hours
**Estimated Completion**: 24 weeks from start
