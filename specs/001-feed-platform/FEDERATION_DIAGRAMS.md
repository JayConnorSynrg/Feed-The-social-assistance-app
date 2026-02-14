# FEED Federation Protocol - Visual Diagrams

**Version**: 1.0
**Date**: 2026-02-05

This document contains visual diagrams for the FEED Federation Protocol, including sequence diagrams, architecture diagrams, and data flows.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Sequence Diagrams](#sequence-diagrams)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [State Machines](#state-machines)
5. [Network Topology](#network-topology)

---

## 1. System Architecture

### 1.1 Instance Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      FEED Instance                               │
│                   (e.g., Seattle FEED)                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Web Application Layer                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │  Feed    │  │   Map    │  │  Chat    │  │ Settings │  │ │
│  │  │  Panel   │  │  Panel   │  │  Panel   │  │  Panel   │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                                            │ │
│  │  ┌────────────────────────────────────────────────────┐   │ │
│  │  │        Federated Search Component                  │   │ │
│  │  │  • Searches local + federated resources           │   │ │
│  │  │  • Displays "Federated" badges                    │   │ │
│  │  └────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   API Layer (Next.js)                      │ │
│  │  ┌──────────────────┐          ┌──────────────────┐      │ │
│  │  │  Local Resources │          │  Federation API  │      │ │
│  │  │  CRUD Endpoints  │          │                  │      │ │
│  │  │                  │          │ GET /instance    │      │ │
│  │  │ GET /resources   │          │ POST /handshake  │      │ │
│  │  │ POST /resources  │          │ GET /resources   │      │ │
│  │  └──────────────────┘          │ POST /search     │      │ │
│  │                                 └──────────────────┘      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Federation Module                        │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │   Sync      │  │    Trust     │  │   HTTP          │  │ │
│  │  │   Service   │  │    Scorer    │  │   Signature     │  │ │
│  │  │             │  │              │  │   Verifier      │  │ │
│  │  │ • Pull sync │  │ • Calculate  │  │ • Sign reqs     │  │ │
│  │  │ • Every 15m │  │ • Monitor    │  │ • Verify sigs   │  │ │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │ │
│  │                                                            │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │   Search    │  │  Deduplicator│  │   Rate Limiter  │  │ │
│  │  │   Federator │  │              │  │                 │  │ │
│  │  │             │  │ • Detect     │  │ • Token bucket  │  │ │
│  │  │ • Query all │  │ • Merge      │  │ • Redis-backed  │  │ │
│  │  │ • Aggregate │  │ • Resolve    │  │                 │  │ │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Data Layer                               │ │
│  │  ┌──────────────────────┐      ┌──────────────────────┐   │ │
│  │  │   Supabase (Local)   │      │   Redis (Cache)      │   │ │
│  │  │                      │      │                      │   │ │
│  │  │ • resources          │      │ • Rate limits        │   │ │
│  │  │ • profiles           │      │ • Search results     │   │ │
│  │  │ • posts              │      │ • Session tokens     │   │ │
│  │  │                      │      │                      │   │ │
│  │  │ • federated_instances│      │                      │   │ │
│  │  │ • federated_resources│      │                      │   │ │
│  │  │ • sync_log           │      │                      │   │ │
│  │  └──────────────────────┘      └──────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   External APIs                            │ │
│  │  ┌──────────────┐      ┌──────────────┐      ┌─────────┐ │ │
│  │  │  211 API     │      │  OpenRouter  │      │  Mapbox │ │ │
│  │  │  (resources) │      │  (AI chat)   │      │  (maps) │ │ │
│  │  └──────────────┘      └──────────────┘      └─────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS + HTTP Signatures
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Other Federated Instances                      │
│              (Oakland, Portland, San Francisco, ...)             │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Federation Network Topology

```
                  ┌─────────────────┐
                  │   Portland      │
                  │   156 resources │
                  │   Trust: 0.85   │
                  └────────┬────────┘
                           │
                           │ federated
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        │                  │                  │
┌───────▼────────┐  ┌──────▼─────────┐  ┌────▼──────────┐
│   Oakland      │  │    Seattle     │  │  San Francisco │
│   127 resources│◄─┤    98 resources│◄─┤  84 resources  │
│   Trust: 0.92  │  │    Trust: 0.88 │  │  Trust: 0.75   │
└────────────────┘  └────────────────┘  └────────────────┘
        │                  │                  │
        │                  │                  │
        │                  │                  │
        └──────────┬───────┴──────────┬───────┘
                   │                  │
                   │                  │
              ┌────▼─────────┐  ┌─────▼────────┐
              │   Berkeley   │  │   Tacoma     │
              │  45 resources│  │  62 resources│
              │  Trust: 0.65 │  │  Trust: 0.70 │
              └──────────────┘  └──────────────┘

Legend:
──── Federation relationship (bidirectional)
Trust score: 0.0 (untrusted) → 1.0 (core)
```

### 1.3 Trust Levels Visualization

```
Trust Level Spectrum:

0.0                 0.2        0.4               0.7          0.9    1.0
├───────────────────┼──────────┼─────────────────┼────────────┼──────┤
│    UNTRUSTED      │ PENDING  │     TRUSTED     │  VERIFIED  │ CORE │
└───────────────────┴──────────┴─────────────────┴────────────┴──────┘
      │                  │            │               │           │
      │                  │            │               │           │
      ▼                  ▼            ▼               ▼           ▼
  Blocked          Limited      Full sharing    Prioritized   Unlimited
  Auto-reject      10 res/query  Standard       2x rate limit  No limits
  No federation    Manual review All categories Fast sync     Core network
```

---

## 2. Sequence Diagrams

### 2.1 Federation Handshake

```mermaid
sequenceDiagram
    participant OA as Oakland Instance
    participant SE as Seattle Instance

    Note over OA,SE: Phase 1: Discovery

    OA->>SE: GET /.well-known/feed-instance
    SE-->>OA: Instance metadata + public key

    Note over OA,SE: Phase 2: Handshake Request

    OA->>OA: Sign request with private key
    OA->>SE: POST /api/federation/handshake<br/>(signed with OA private key)
    Note right of OA: Includes OA metadata,<br/>public key

    SE->>SE: Fetch OA public key from metadata
    SE->>SE: Verify signature
    SE->>SE: Check trust level (0.3 = pending)

    Note over OA,SE: Phase 3: Accept/Reject

    alt Trust level acceptable
        SE->>SE: Add OA to federation list
        SE->>OA: Accept (signed with SE private key)
        Note left of SE: Includes sync schedule
        OA->>OA: Add SE to federation list
        OA->>SE: Begin resource sync
    else Trust level too low
        SE->>OA: Reject (with reason)
        Note left of SE: Insufficient trust score
    end
```

### 2.2 Resource Sync Flow

```mermaid
sequenceDiagram
    participant Cron as Cron Job (every 15min)
    participant Sync as Sync Service
    participant DB as Local Database
    participant Remote as Remote Instance

    Cron->>Sync: Trigger sync

    Sync->>DB: Get federated instances (status: active)
    DB-->>Sync: List of instances

    loop For each instance
        Sync->>DB: Get last sync time
        DB-->>Sync: 2026-02-05T08:00:00Z

        Sync->>Remote: GET /api/federation/resources<br/>?lastModified=2026-02-05T08:00:00Z
        Note right of Sync: Signed with private key

        Remote->>Remote: Verify signature
        Remote->>Remote: Check rate limit
        Remote->>Remote: Query updated resources

        Remote-->>Sync: Resources (JSON-LD)

        loop For each resource
            Sync->>DB: Check if resource exists
            alt Resource exists
                Sync->>Sync: Compare updated_at
                alt Remote newer
                    Sync->>DB: UPDATE resource
                    Note left of DB: Update data, last_synced_at
                end
            else Resource new
                Sync->>DB: INSERT resource
                Note left of DB: Store with origin metadata
            end
        end

        Sync->>DB: Log sync success
        Note left of DB: Store metrics:<br/>- resources_fetched<br/>- resources_added<br/>- resources_updated
    end
```

### 2.3 Federated Search Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Search UI
    participant API as Search API
    participant Local as Local DB
    participant Fed as Federation Service
    participant Remote1 as Oakland Instance
    participant Remote2 as Portland Instance

    User->>UI: Search "food banks near Seattle"
    UI->>API: POST /api/search<br/>{query: "food banks", location: Seattle}

    par Local Search
        API->>Local: Search local resources
        Local-->>API: 35 resources (100ms)
    and Federated Search
        API->>Fed: Query federation network
        Fed->>Fed: Get active federated instances

        par Query Oakland
            Fed->>Remote1: POST /resources/search<br/>(signed, with filters)
            Remote1-->>Fed: 12 resources (400ms)
        and Query Portland
            Fed->>Remote2: POST /resources/search<br/>(signed, with filters)
            Remote2-->>Fed: 8 resources (350ms)
        end

        Fed->>Fed: Deduplicate results<br/>(found 1 duplicate)
        Fed->>Fed: Sort by distance from Seattle
        Fed-->>API: 19 federated resources
    end

    API->>API: Merge local + federated
    API->>API: Apply final ranking
    API-->>UI: 54 total results<br/>(35 local + 19 federated)

    UI->>UI: Add "Federated" badges
    UI-->>User: Display results with origin labels

    Note over User,UI: "35 from Seattle, 12 from Oakland, 7 from Portland"
```

### 2.4 Trust Score Update Flow

```mermaid
sequenceDiagram
    participant Cron as Daily Cron Job
    participant Scorer as Trust Scorer
    participant DB as Database
    participant Instance as Remote Instance

    Cron->>Scorer: Update trust scores

    Scorer->>DB: Get all federated instances
    DB-->>Scorer: List of instances

    loop For each instance
        par Calculate Components
            Scorer->>DB: Get health check history (30 days)
            DB-->>Scorer: Success/failure records
            Scorer->>Scorer: uptime_score = successes / total

            Scorer->>DB: Get resource quality metrics
            DB-->>Scorer: Complete/verified/stale counts
            Scorer->>Scorer: data_quality_score = f(metrics)

            Scorer->>DB: Get moderation reports
            DB-->>Scorer: Spam report count
            Scorer->>Scorer: moderation_score = 1 - (spam / total)

            Scorer->>DB: Get community reports
            DB-->>Scorer: Negative report count
            Scorer->>Scorer: community_reports_score = max(0, 1 - reports/100)

            Scorer->>Scorer: longevity_score = days_federated / 180
        end

        Scorer->>Scorer: trust_score = weighted_average(<br/>  uptime * 0.30,<br/>  data_quality * 0.25,<br/>  moderation * 0.20,<br/>  community * 0.15,<br/>  longevity * 0.10<br/>)

        Scorer->>DB: UPDATE trust_level = trust_score
        Note left of DB: Also update component scores

        alt Trust score dropped below 0.2
            Scorer->>DB: UPDATE status = 'suspended'
            Scorer->>Scorer: Send alert to admin
        end
    end

    Scorer->>Scorer: Log trust score update
```

---

## 3. Data Flow Diagrams

### 3.1 Resource Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Resource Lifecycle                       │
└─────────────────────────────────────────────────────────────┘

[1] Resource Created on Oakland Instance
                │
                ▼
        ┌──────────────┐
        │  Oakland DB  │
        │  resources   │
        └──────┬───────┘
               │
               │ (15 min sync)
               │
               ▼
[2] Seattle Sync Service Polls Oakland
        ┌────────────────────────┐
        │ GET /resources         │
        │ ?lastModified=...      │
        └───────────┬────────────┘
                    │
                    ▼
[3] Oakland Returns Updated Resources
        ┌────────────────────────┐
        │ [{resource1}, ...]     │
        └───────────┬────────────┘
                    │
                    ▼
[4] Seattle Stores in federated_resources
        ┌─────────────────────────┐
        │  federated_resources    │
        │  - origin_instance_id   │
        │  - origin_resource_id   │
        │  - data (JSONB)         │
        │  - last_synced_at       │
        └────────────┬────────────┘
                     │
                     ▼
[5] User Searches on Seattle
        ┌─────────────────────────┐
        │ "food banks near me"    │
        └────────────┬────────────┘
                     │
                     ├───► Local resources (35)
                     │
                     └───► Federated resources (19)
                              │
                              ▼
[6] Results Displayed with Badges
        ┌──────────────────────────────┐
        │ "Food Bank A" [SEATTLE]      │
        │ "Food Bank B" [OAKLAND] 🔗   │
        │ "Food Bank C" [SEATTLE]      │
        │ "Food Bank D" [PORTLAND] 🔗  │
        └──────────────────────────────┘

        🔗 = Federated resource badge
```

### 3.2 Trust Propagation (Web of Trust)

```
┌────────────────────────────────────────────────────────────────┐
│                    Trust Propagation Example                   │
└────────────────────────────────────────────────────────────────┘

Step 1: Direct Trust
        Oakland (0.90) ──trusts──► Seattle (0.85)

Step 2: Portland Joins Network
        Portland ──?──► Seattle (unknown trust)

Step 3: Portland Queries Oakland's Trust Network
        Portland ──GET /trust-attestations──► Oakland
        Oakland responds: "I trust Seattle with score 0.85"

Step 4: Derived Trust Calculation
        Portland calculates:
        derived_trust = oakland_trust_in_portland * oakland_trust_in_seattle
                      = 0.80 * 0.85
                      = 0.68

Step 5: Portland Decides to Federate
        0.68 > 0.4 (Trusted threshold)
        ✓ Portland federates with Seattle

Visual:
        Oakland (0.90)
           │
           ├─► Seattle (0.85) ──direct trust──► ✓
           │
           └─► Portland (0.80)
                   │
                   └─► Seattle (0.68) ──derived trust──► ✓


Multi-Hop Trust:
        Core Instance A (1.0)
              │
              ├─► Instance B (0.85)
              │       │
              │       └─► Instance C (0.70)
              │               │
              │               └─► Instance D (0.55)
              │
              └─► Direct: Instance B trust = 0.85
                  Two-hop: Instance C trust = 0.85 * 0.70 = 0.595
                  Three-hop: Instance D trust = 0.85 * 0.70 * 0.55 = 0.327
                                                (below threshold, blocked)
```

---

## 4. State Machines

### 4.1 Federation Instance State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│              Federated Instance State Transitions                │
└──────────────────────────────────────────────────────────────────┘

Initial State:
┌─────────────┐
│  UNKNOWN    │  (Not yet in federation list)
└──────┬──────┘
       │
       │ admin adds instance
       │
       ▼
┌─────────────┐
│  PENDING    │  (Handshake accepted, trust < 0.4)
└──────┬──────┘
       │
       │ Conditions:
       │ • Uptime > 95% for 30 days
       │ • Data quality > 80%
       │ • No spam reports
       │
       ▼
┌─────────────┐
│  TRUSTED    │  (Trust: 0.4 - 0.7)
└──────┬──────┘
       │
       │ Conditions:
       │ • Uptime > 98% for 60 days
       │ • Data quality > 90%
       │ • Verified by admin
       │
       ▼
┌─────────────┐
│  VERIFIED   │  (Trust: 0.7 - 0.9)
└──────┬──────┘
       │
       │ Conditions:
       │ • Official FEED network instance
       │ • Trust attestations from core instances
       │
       ▼
┌─────────────┐
│    CORE     │  (Trust: 0.9 - 1.0)
└─────────────┘

Error States (can occur from any state):

SUSPENDED ◄─── Trust score drops below 0.2
   │           • Too many spam reports
   │           • Data quality < 50%
   │           • Policy violations
   │
   │ (30 day probation)
   │
   └──────► TRUSTED (if issues resolved)

OFFLINE ◄───── Health checks fail for 24 hours
   │           • Instance unreachable
   │           • Network issues
   │
   │ (auto-retry every hour)
   │
   └──────► Previous state (when back online)

BLOCKED ◄───── Manual admin action or trust < 0.0
               • Malicious content
               • Persistent policy violations
               • Community vote

               (requires manual unblock)
```

### 4.2 Resource Sync State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│                  Resource Sync State Machine                     │
└──────────────────────────────────────────────────────────────────┘

┌────────────┐
│   IDLE     │  (Waiting for next sync interval)
└──────┬─────┘
       │
       │ Cron trigger (every 15 min)
       │
       ▼
┌────────────┐
│ SYNCING    │  (Fetching resources from remote)
└──────┬─────┘
       │
       ├───► Success
       │     └──► PROCESSING (parsing + deduplicating)
       │             │
       │             ├──► MERGING (updating database)
       │             │       │
       │             │       └──► COMPLETED
       │             │               │
       │             │               └──► IDLE
       │             │
       │             └──► CONFLICT_DETECTED
       │                     │
       │                     ├──► AUTO_RESOLVED (Last Write Wins)
       │                     │       └──► COMPLETED
       │                     │
       │                     └──► MANUAL_REVIEW_REQUIRED
       │                             (logged for admin)
       │
       └───► Failure
             ├──► NETWORK_ERROR (retry in 5 min)
             ├──► AUTH_ERROR (signature verification failed)
             ├──► RATE_LIMIT_ERROR (wait for reset)
             └──► TIMEOUT_ERROR (instance slow/offline)

All failures:
   • Log error
   • Increment failure counter
   • Update health check status
   • Return to IDLE (will retry next interval)
```

---

## 5. Network Topology

### 5.1 Hub-and-Spoke vs. Mesh

```
Hub-and-Spoke (NOT USED):
                ┌─────────────┐
                │   Central   │
                │   Registry  │
                └──────┬──────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌───────┐      ┌───────┐      ┌───────┐
    │ Inst1 │      │ Inst2 │      │ Inst3 │
    └───────┘      └───────┘      └───────┘

    ❌ Single point of failure
    ❌ Central authority (against mutual aid ethos)


Mesh Network (USED):
    ┌───────┐          ┌───────┐
    │ Inst1 │◄────────►│ Inst2 │
    └───┬───┘          └───┬───┘
        │                  │
        │                  │
        │   ┌───────┐      │
        └──►│ Inst3 │◄─────┘
            └───┬───┘
                │
                ▼
            ┌───────┐
            │ Inst4 │
            └───────┘

    ✅ No single point of failure
    ✅ Decentralized (each instance independent)
    ✅ Resilient (if Inst2 offline, Inst1↔Inst3 still works)
```

### 5.2 Geographic Distribution

```
┌──────────────────────────────────────────────────────────────────┐
│            FEED Federation Network (Example)                     │
│                    North America                                 │
└──────────────────────────────────────────────────────────────────┘

        🇨🇦 Canada
            │
            │
    ┌───────┴────────┐
    │                │
┌───▼────┐      ┌────▼───┐
│Vancouver│      │Toronto │
│ 45 res. │      │ 78 res.│
└───┬─────┘      └────────┘
    │
    │
────┼────────────────────────  US-Canada Border
    │
    │ 🇺🇸 United States
    │
    ▼
┌─────────────┐
│  Seattle    │────────┐
│  98 res.    │        │
└──────┬──────┘        │
       │               │
       │               │
       ▼               ▼
┌──────────┐      ┌──────────┐
│ Portland │      │ Spokane  │
│ 156 res. │      │  32 res. │
└─────┬────┘      └──────────┘
      │
      │
      ▼
┌──────────┐      ┌──────────┐
│San Fran. │◄────►│Sacramento│
│ 84 res.  │      │  51 res. │
└─────┬────┘      └──────────┘
      │
      │
      ▼
┌──────────┐      ┌──────────┐
│  Oakland │◄────►│ Berkeley │
│ 127 res. │      │  45 res. │
└──────────┘      └──────────┘

Legend:
──── Federation relationship
🇨🇦 🇺🇸 Country borders
res. = resources

Note: Geographic proximity does NOT determine federation.
      Instances choose partners based on trust + community ties.
```

### 5.3 Query Propagation (Federated Search)

```
┌──────────────────────────────────────────────────────────────────┐
│          Query Propagation: "food banks near Seattle"            │
└──────────────────────────────────────────────────────────────────┘

User Query Origin: Seattle Instance

Step 1: Query Filtering (Geographic)
        Seattle evaluates which instances to query based on:
        • Distance from query location
        • Instance geographic focus
        • Trust level

        ┌──────────────┬──────────┬───────┬──────────┐
        │   Instance   │ Distance │ Trust │  Query?  │
        ├──────────────┼──────────┼───────┼──────────┤
        │ Seattle      │    0 km  │ 1.00  │ Yes (self)│
        │ Portland     │  233 km  │ 0.85  │ Yes ✓    │
        │ Vancouver    │  192 km  │ 0.80  │ Yes ✓    │
        │ Spokane      │  361 km  │ 0.70  │ Yes ✓    │
        │ San Francisco│ 1094 km  │ 0.90  │ No (far) │
        │ Oakland      │ 1129 km  │ 0.92  │ No (far) │
        └──────────────┴──────────┴───────┴──────────┘

        Filter: distance < 500km AND trust > 0.5

Step 2: Parallel Query
                    Seattle (origin)
                         │
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    Vancouver        Portland         Spokane
    (192km)          (233km)          (361km)
    Query ✓          Query ✓          Query ✓

Step 3: Result Aggregation
        Vancouver: 4 resources (250ms)
        Portland:  8 resources (300ms)
        Spokane:   2 resources (450ms)
        Seattle:  35 resources (100ms)
        ─────────────────────────────────
        Total:    49 resources

Step 4: Deduplication
        Found 1 duplicate (Vancouver ↔ Seattle)
        Final: 48 unique resources

Step 5: Ranking
        Sort by:
        • Distance from query location (40%)
        • Text relevance (30%)
        • Instance trust score (15%)
        • Freshness (10%)
        • Completeness (5%)

Step 6: Result Presentation
        ┌──────────────────────────────────┐
        │  Search Results (48)             │
        ├──────────────────────────────────┤
        │  1. Food Bank A [SEATTLE]        │
        │  2. Food Bank B [PORTLAND] 🔗    │
        │  3. Food Bank C [SEATTLE]        │
        │  4. Food Bank D [VANCOUVER] 🔗   │
        │  ...                             │
        └──────────────────────────────────┘

        🔗 = Federated resource
        Click for details (opens in new tab to origin instance)
```

---

## 6. Component Diagrams

### 6.1 HTTP Signature Flow

```
┌──────────────────────────────────────────────────────────────────┐
│              HTTP Signature Request/Verify Flow                  │
└──────────────────────────────────────────────────────────────────┘

Sender (Oakland):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. Prepare Request                                             │
│     ┌────────────────────────────────────────────────┐         │
│     │ POST /api/federation/handshake                 │         │
│     │ Host: seattle.feed.social                      │         │
│     │ Date: Wed, 05 Feb 2026 10:30:00 GMT           │         │
│     │ Digest: SHA-256=X48E9qOokqqrvdts8nOJRJ...     │         │
│     │ Content-Type: application/ld+json              │         │
│     │                                                │         │
│     │ Body: {"@context": ..., "type": ...}          │         │
│     └────────────────────────────────────────────────┘         │
│                                                                 │
│  2. Build Signing String                                        │
│     ┌────────────────────────────────────────────────┐         │
│     │ (request-target): post /api/federation/handsh  │         │
│     │ host: seattle.feed.social                      │         │
│     │ date: Wed, 05 Feb 2026 10:30:00 GMT           │         │
│     │ digest: SHA-256=X48E9qOokqqrvdts8nOJRJ...     │         │
│     └────────────────────────────────────────────────┘         │
│                           │                                     │
│                           ▼                                     │
│  3. Sign with Private Key (RSA-SHA256)                          │
│     ┌────────────────────────────────────────────────┐         │
│     │ Private Key (from env var)                     │         │
│     │ -----BEGIN RSA PRIVATE KEY-----                │         │
│     │ MIIJKAIBAAKCAgEA...                            │         │
│     │ -----END RSA PRIVATE KEY-----                  │         │
│     └────────────────────────────────────────────────┘         │
│                           │                                     │
│                           ▼                                     │
│     ┌────────────────────────────────────────────────┐         │
│     │ Signature: Base64(RSA-SHA256(signing_string))  │         │
│     └────────────────────────────────────────────────┘         │
│                                                                 │
│  4. Add Signature Header                                        │
│     ┌────────────────────────────────────────────────┐         │
│     │ Signature: keyId="https://oakland.../main-key" │         │
│     │           algorithm="rsa-sha256"                │         │
│     │           headers="(request-target) host date   │         │
│     │           signature="QXBwbGU=..."               │         │
│     └────────────────────────────────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
Receiver (Seattle):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. Receive Request                                             │
│     ┌────────────────────────────────────────────────┐         │
│     │ POST /api/federation/handshake                 │         │
│     │ Signature: keyId="...", signature="..."        │         │
│     └────────────────────────────────────────────────┘         │
│                           │                                     │
│                           ▼                                     │
│  2. Parse Signature Header                                      │
│     Extract: keyId, algorithm, headers, signature               │
│                           │                                     │
│                           ▼                                     │
│  3. Fetch Sender's Public Key                                   │
│     ┌────────────────────────────────────────────────┐         │
│     │ GET https://oakland.../api/federation/instance │         │
│     │ Response: { publicKey: { publicKeyPem: "..." } }│         │
│     └────────────────────────────────────────────────┘         │
│                           │                                     │
│                           ▼                                     │
│  4. Rebuild Signing String                                      │
│     Use same headers as sender: (request-target), host, etc.    │
│                           │                                     │
│                           ▼                                     │
│  5. Verify Signature                                            │
│     ┌────────────────────────────────────────────────┐         │
│     │ crypto.verify(                                 │         │
│     │   algorithm: 'SHA256',                         │         │
│     │   data: signing_string,                        │         │
│     │   publicKey: sender_public_key,                │         │
│     │   signature: request_signature                 │         │
│     │ )                                              │         │
│     └────────────────────────────────────────────────┘         │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                            │
│                  │   Valid? ✓      │                            │
│                  └────┬────────────┘                            │
│                       │                                         │
│                       ├──► Yes: Process request                 │
│                       │                                         │
│                       └──► No: Reject with 401 Unauthorized     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. UI Mockups (ASCII)

### 7.1 Federated Search Results

```
┌──────────────────────────────────────────────────────────────────┐
│  FEED - Seattle                                    🔍  johndoe ▼│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Search: [food banks near me                        ] [Search]  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Filters:                                                  │ │
│  │  [✓] Food   [ ] Housing   [ ] Healthcare   [ ] Employment  │ │
│  │  Radius: [===●=====] 25 km                                 │ │
│  │  [✓] Show federated results                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                  │
│  Found 54 results (35 from Seattle, 12 from Oakland,            │
│                     7 from Portland)                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📍 Seattle Food Bank - Ballard                             │ │
│  │    1234 Market St, Seattle, WA 98107                       │ │
│  │    Open: Mon-Fri 9am-5pm  |  Distance: 2.3 km              │ │
│  │    [SEATTLE]                              [Get Directions] │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📍 Northwest Harvest - Capitol Hill                        │ │
│  │    5678 Broadway, Seattle, WA 98102                        │ │
│  │    Open: Tue-Thu 10am-6pm  |  Distance: 3.1 km             │ │
│  │    [SEATTLE]                              [Get Directions] │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📍 Portland Food Pantry Network             🔗 FEDERATED   │ │
│  │    9101 SW Oak St, Portland, OR 97223                      │ │
│  │    Open: Mon-Sat 8am-6pm  |  Distance: 234 km              │ │
│  │    [PORTLAND FEED]                        [Visit Instance] │ │
│  │    ℹ️  This resource is hosted by Portland FEED            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📍 Oakland Food Bank - Fruitvale            🔗 FEDERATED   │ │
│  │    3344 International Blvd, Oakland, CA 94601              │ │
│  │    Open: Daily 9am-5pm  |  Distance: 1,129 km              │ │
│  │    [OAKLAND FEED]                         [Visit Instance] │ │
│  │    ℹ️  This resource is hosted by Oakland FEED             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Load More Results]                                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Legend:
🔗 FEDERATED = Resource from another instance
[INSTANCE NAME] = Origin instance tag
```

### 7.2 Federation Admin Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  FEED Admin - Federation Management            admin@seattle ▼  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┬──────────┬──────────┬──────────┬──────────────┐   │
│  │ Dash ◄  │ Instances│Resources │ Trust    │ Sync Logs    │   │
│  └─────────┴──────────┴──────────┴──────────┴──────────────┘   │
│                                                                  │
│  Federation Overview                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Federated   │  │   Synced     │  │   Sync       │         │
│  │  Instances   │  │   Resources  │  │   Success    │         │
│  │      5       │  │    847       │  │    98.2%     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  Federated Instances                              [+ Add New]   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Oakland FEED                                               │ │
│  │ oakland.feed.social                                        │ │
│  │ Trust: ████████████████████░░ 0.92 (Verified)             │ │
│  │ Status: 🟢 Online  |  Last sync: 2 minutes ago             │ │
│  │ Resources: 127  |  Uptime: 99.5%                           │ │
│  │ [View Details] [Edit] [Sync Now] [Remove]                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Portland FEED                                              │ │
│  │ portland.feed.social                                       │ │
│  │ Trust: █████████████████░░░░ 0.85 (Verified)              │ │
│  │ Status: 🟢 Online  |  Last sync: 5 minutes ago             │ │
│  │ Resources: 156  |  Uptime: 98.8%                           │ │
│  │ [View Details] [Edit] [Sync Now] [Remove]                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Berkeley FEED                                              │ │
│  │ berkeley.feed.social                                       │ │
│  │ Trust: ████████████░░░░░░░░░ 0.65 (Trusted)               │ │
│  │ Status: 🟢 Online  |  Last sync: 15 minutes ago            │ │
│  │ Resources: 45  |  Uptime: 97.2%                            │ │
│  │ [View Details] [Edit] [Sync Now] [Remove]                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ San Francisco FEED                                         │ │
│  │ sf.feed.social                                             │ │
│  │ Trust: ███████░░░░░░░░░░░░░░ 0.35 (Pending)               │ │
│  │ Status: 🟡 Limited  |  Last sync: 1 hour ago               │ │
│  │ Resources: 84  |  Uptime: 92.1%                            │ │
│  │ ⚠️  Probation period: 15 days remaining                    │ │
│  │ [View Details] [Edit] [Promote to Trusted] [Remove]       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Spokane FEED                                               │ │
│  │ spokane.feed.social                                        │ │
│  │ Trust: █████████████████████ 1.00 (Core)                  │ │
│  │ Status: 🔴 Offline  |  Last sync: 2 days ago               │ │
│  │ Resources: 32  |  Uptime: 85.4% (dropping)                 │ │
│  │ ⚠️  Instance unreachable for 48 hours                      │ │
│  │ [View Details] [Contact Admin] [Mark as Suspended]        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Summary

This document provides visual representations of the FEED Federation Protocol architecture, data flows, and interactions. These diagrams complement the technical specification (`FEDERATION_PROTOCOL.md`) and implementation guide (`FEDERATION_IMPLEMENTATION_GUIDE.md`).

**Key Takeaways**:
- **Mesh topology**: Decentralized, resilient, no single point of failure
- **Trust-based**: Web of trust model with derived trust calculations
- **Privacy-first**: Only resources federate, never user data
- **Graceful degradation**: System works even when instances offline
- **Simple MVP**: Start with manual federation, grow incrementally

**Next Steps**:
1. Review diagrams with engineering team
2. Validate sequence flows with security team
3. Use as reference during implementation (Phase 1-6)
4. Update diagrams as protocol evolves

---

**Document Version**: 1.0
**Last Updated**: 2026-02-05
**Maintained By**: FEED Platform Team
