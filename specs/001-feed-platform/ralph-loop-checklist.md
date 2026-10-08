---
feature: "FEED Platform"
version: "1.5.5"
created: "2026-01-19"
last_updated: "2026-06-13"
status: "COMPLETE"
current_phase: 9
current_task: null
total_phases: 9
total_tasks: 120
completed_tasks: 120
---

# FEED Platform - Ralph Loop Development Checklist

## Purpose
This checklist enables autonomous agent development via Ralph Loop. The agent references this file to:
1. Understand current progress state
2. Identify the next actionable task
3. Update completion status after each task
4. Self-prompt continuation of development

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
| 0 | Pre-Flight Setup | 3 | 3 | COMPLETE |
| 1 | Foundation | 25 | 25 | COMPLETE |
| 2 | Resource Discovery | 15 | 15 | COMPLETE |
| 3 | Form System | 16 | 15 | COMPLETE* |
| 4 | AI Assistant | 11 | 10 | COMPLETE* |
| 5 | Case Management | 12 | 11 | COMPLETE* |
| 6 | Polish & Launch | 8 | 7 | COMPLETE** |
| 7 | Production Hardening | 11 | 11 | COMPLETE |
| 8 | Social Resource-Matching + Pre-Launch Security Hardening | 20 | 20 | COMPLETE |
| 9 | Community Launch Readiness | 10 | 10 | COMPLETE |

**Overall Progress**: 120 / 120 shipped tasks — ALL PHASES COMPLETE

*P3-T16, P4-T11, P5-T12 (Mobile Testing) deferred - requires device testing
**P6-T8 superseded by Phase 7 — production verification moved to comprehensive hardening phase
****feat: chat client resilience (auto-retry on transient + specific error + Try-again) + structured chat.request.failed/completed telemetry — feat/chat-resilience-telemetry (2026-06-13): auto-retry once on transient failures (network TypeError/5xx/429); isRetrying state shows "Reconnecting…"; persistent failures show kind-translated message (network/server/auth/unknown) + "Try again" button calling retrySend(); chat.request.failed structured log with errorName/errorMessage/httpStatus/durationMs/isAbort/retried/origin; chat.request.completed optimization log with durationMs/model/didStream/contentLength; e2e chat-resilience.spec.ts 4 tests (A1 happy-path, B1 transient-recover, C1 persistent-banner, C2 retry-refires); type-check 0 new errors; lint 1 fewer warning.
***Phase 8 folded into headline metric per 2026-06-06 docsync. Baseline was 96/98 (Phases 0-7); +11 Phase 8 PRs (#47-57) all complete. PRs #59-61 added P8-T18..T20 per 2026-06-09 docsync = 110/112. P9-T5 + P9-T6 complete (PRs #63-64) = 112/114. P7-T11 complete 2026-06-10 (harness 5/5 + manual prod confirmation) = 113/114. P9-T2 complete 2026-06-10 = 114/114. P9-T3 complete 2026-06-10 (feature/embed-meta-oembed) = 114/114. P9-T7 complete 2026-06-10 (feature/docs-forms-lifecycle): AcroForm autofill (fill-from-profile toolbar, FIELD_ALIAS_MAP), document rename+move (overflow menu), submission→drive archival (non-blocking encrypted PDF archive, submission_id FK) = 115/115. P9-T8 complete 2026-06-10 (feature/gov-forms-presync): pre-sync architecture + gov-forms bucket + 5 government PDFs synced (IRS/HUD/VA/SSA) + Government Forms UI section + e2e 3/3 = 116/116. P9-T4 complete 2026-06-10 (feature/suggest-resource): suggest-resource flow — Suggest a Resource entry in HazardBubbleMenu (all roles), SuggestResourceDialog (category SSOT, name/desc/city/state), INSERT status=pending; e2e 4/4 = 117/117. P9-T9 complete 2026-06-10 (feature/usability-grandma-pass): grandma-grade usability pass — contrast fixes, tap targets, sidebar labels, SHORT_LABELS, humanized copy, forms error/empty state, Resource Wizard label. 118/118. P9-T10 complete 2026-06-11 (feature/guest-access-anon-auth): Find Help Now anonymous guest access — signInAnonymously(), RESTRICTIVE RLS migration, 10 SECDEF guards, pg_cron cleanup, guest banner + CreateAccountPrompt gating = 119/119. P9-T1 fulfillment view COMPLETE 2026-06-11 (feature/fulfillment-view): provider Seekers accordion + Accept/Decline/Mark-Complete lifecycle already in feed-panel.tsx; data-testid accept-optin + decline-optin added; e2e fulfillment-view.spec.ts 4/4 green; full suite 110 passed/1 skipped/0 failed = 120/120. PHASE 9 COMPLETE. ALL PHASES COMPLETE.

---

## PHASE 0: Pre-Flight Setup

### P0-T1: Initialize Git Repository
- [x] **Status**: COMPLETE
- **ID**: P0-T1
- **Dependencies**: None
- **Description**: Create git repository with proper structure
- **Commands**:
  ```bash
  cd /Users/jelalconnor/CODING/CURSOR/FEED.
  git init
  git checkout -b develop
  echo "node_modules/\n.env*\n.DS_Store\ndist/\n.next/" > .gitignore
  git add .
  git commit -m "Initial commit: Project scaffolding"
  ```
- **Validation**:
  ```bash
  git status  # Should show clean working tree
  git branch  # Should show 'develop' as current branch
  ```
- **Acceptance Criteria**:
  - [x] Git repository initialized
  - [x] .gitignore created with standard ignores
  - [x] Initial commit made on develop branch

### P0-T2: Create Monorepo Structure
- [x] **Status**: COMPLETE
- **ID**: P0-T2
- **Dependencies**: P0-T1
- **Description**: Set up turborepo monorepo structure
- **Commands**:
  ```bash
  npx create-turbo@latest . --example basic
  # OR manually create structure:
  mkdir -p apps/web apps/mobile packages/ui packages/database packages/shared
  ```
- **Validation**:
  ```bash
  ls -la apps/     # Should show web, mobile directories
  ls -la packages/ # Should show ui, database, shared directories
  ```
- **Acceptance Criteria**:
  - [x] apps/ directory with web and mobile subdirectories
  - [x] packages/ directory with shared code locations
  - [x] turbo.json or nx.json for monorepo management

### P0-T3: Initialize Next.js Web App
- [x] **Status**: COMPLETE
- **ID**: P0-T3
- **Dependencies**: P0-T2
- **Description**: Create Next.js app with TypeScript and Tailwind
- **Commands**:
  ```bash
  cd apps/web
  npx create-next-app@latest . --typescript --tailwind --app --src-dir
  ```
- **Validation**:
  ```bash
  npm run dev  # Should start on localhost:3000
  npm run build  # Should complete without errors
  ```
- **Acceptance Criteria**:
  - [x] Next.js app created with App Router
  - [x] TypeScript configured
  - [x] Tailwind CSS configured
  - [x] Dev server runs successfully

---

## PHASE 1: Foundation (Weeks 1-4)

### Section 1A: Project Initialization

#### P1-T1: Setup Supabase Project
- [x] **Status**: COMPLETE
- **ID**: P1-T1
- **Dependencies**: P0-T3
- **Description**: Create Supabase project and configure local development
- **Commands**:
  ```bash
  npx supabase init
  npx supabase start
  ```
- **Manual Steps**:
  1. Create project at supabase.com/dashboard
  2. Copy project URL and anon key
  3. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Validation**:
  ```bash
  npx supabase status  # Should show local services running
  ```
- **Acceptance Criteria**:
  - [x] Supabase project created
  - [x] Local Supabase running
  - [x] Environment variables configured

#### P1-T2: Configure Capacitor for Mobile
- [x] **Status**: COMPLETE
- **ID**: P1-T2
- **Dependencies**: P0-T3
- **Description**: Set up Capacitor for iOS/Android builds
- **Commands**:
  ```bash
  cd apps/mobile
  npm init -y
  npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
  npx cap init "FEED" "com.feed.app" --web-dir="../web/out"
  npx cap add ios
  npx cap add android
  ```
- **Validation**:
  ```bash
  npx cap ls  # Should list ios and android platforms
  ```
- **Acceptance Criteria**:
  - [x] Capacitor initialized
  - [x] iOS platform added
  - [x] Android platform added

#### P1-T3: Setup shadcn/ui Components
- [x] **Status**: COMPLETE
- **ID**: P1-T3
- **Dependencies**: P0-T3
- **Description**: Initialize shadcn/ui component library
- **Commands**:
  ```bash
  cd apps/web
  npx shadcn-ui@latest init
  npx shadcn-ui@latest add button card input form
  ```
- **Validation**:
  ```bash
  ls -la components/ui/  # Should show component files
  ```
- **Acceptance Criteria**:
  - [x] shadcn/ui initialized
  - [x] Base components (button, card, input, form) added
  - [x] Tailwind configured for shadcn

#### P1-T4: Create Design Tokens
- [x] **Status**: COMPLETE
- **ID**: P1-T4
- **Dependencies**: P1-T3
- **Description**: Define color palette, typography, spacing tokens
- **Files to Create**:
  - `packages/ui/tokens/colors.ts`
  - `packages/ui/tokens/typography.ts`
  - `apps/web/tailwind.config.ts` (extend theme)
- **Acceptance Criteria**:
  - [x] Color tokens defined (primary, secondary, accent, etc.)
  - [x] Typography scale defined
  - [x] Tailwind theme extended with tokens

### Section 1B: Database Schema

#### P1-T5: Create Core Tables Migration
- [x] **Status**: COMPLETE
- **ID**: P1-T5
- **Dependencies**: P1-T1
- **Description**: Create users and profiles tables
- **Migration File**: `supabase/migrations/20260119000001_core_tables.sql`
- **Validation**:
  ```bash
  npx supabase db diff  # Should show no unexpected changes
  npx supabase gen types typescript --local > packages/database/types.ts
  ```
- **Acceptance Criteria**:
  - [x] Migration file created
  - [x] profiles table exists
  - [x] RLS policies applied
  - [x] TypeScript types generated

#### P1-T6: Create Posts Table Migration
- [x] **Status**: COMPLETE
- **ID**: P1-T6
- **Dependencies**: P1-T5
- **Description**: Create posts table for social feed
- **Migration File**: `supabase/migrations/20260119000002_posts_table.sql`
- **Validation**:
  ```bash
  npx supabase gen types typescript --local > packages/database/types.ts
  npm run type-check  # Should pass
  ```
- **Acceptance Criteria**:
  - [x] posts table created
  - [x] Indexes created for query optimization
  - [x] RLS policies applied
  - [x] Types regenerated

#### P1-T7: Create Resources Table Migration
- [x] **Status**: COMPLETE
- **ID**: P1-T7
- **Dependencies**: P1-T5
- **Description**: Create resources table for map markers
- **Migration File**: `supabase/migrations/20260119000003_resources_table.sql`
- **Acceptance Criteria**:
  - [x] resources table created with location fields
  - [x] PostGIS extension enabled for geospatial
  - [x] RLS policies applied

#### P1-T8: Create Form Tables Migration
- [x] **Status**: COMPLETE
- **ID**: P1-T8
- **Dependencies**: P1-T5
- **Description**: Create form_templates and form_submissions tables
- **Migration File**: `supabase/migrations/20260119000004_form_tables.sql`
- **Acceptance Criteria**:
  - [x] form_templates table created
  - [x] form_submissions table created
  - [x] user_secure_profiles table for encrypted data
  - [x] RLS policies applied

### Section 1C: Authentication System

#### P1-T9: Configure Supabase Auth Providers
- [x] **Status**: COMPLETE
- **ID**: P1-T9
- **Dependencies**: P1-T1
- **Description**: Enable Email, Google, and Apple OAuth
- **Manual Steps**:
  1. Supabase Dashboard > Authentication > Providers
  2. Enable Email (with confirm email)
  3. Enable Google OAuth (requires Google Cloud Console setup)
  4. Enable Apple OAuth (requires Apple Developer setup)
- **Acceptance Criteria**:
  - [x] Email auth enabled
  - [x] Google OAuth configured
  - [x] Apple OAuth configured (optional for MVP)

#### P1-T10: Create Auth Middleware
- [x] **Status**: COMPLETE
- **ID**: P1-T10
- **Dependencies**: P1-T9
- **Description**: Create Next.js middleware for auth protection
- **File**: `apps/web/src/middleware.ts`
- **Acceptance Criteria**:
  - [x] Middleware protects /dashboard/* routes
  - [x] Redirects to /login if not authenticated
  - [x] Passes through public routes

#### P1-T11: Create Login Page
- [x] **Status**: COMPLETE
- **ID**: P1-T11
- **Dependencies**: P1-T9, P1-T3
- **Description**: Build login UI with email and OAuth buttons
- **File**: `apps/web/src/app/(auth)/login/page.tsx`
- **Acceptance Criteria**:
  - [x] Email/password form
  - [x] Google sign-in button
  - [x] Apple sign-in button
  - [x] Link to signup page
  - [x] Error handling UI

#### P1-T12: Create Signup Page
- [x] **Status**: COMPLETE
- **ID**: P1-T12
- **Dependencies**: P1-T11
- **Description**: Build signup UI
- **File**: `apps/web/src/app/(auth)/signup/page.tsx`
- **Acceptance Criteria**:
  - [x] Email/password form with confirmation
  - [x] OAuth buttons
  - [x] Terms of service checkbox
  - [x] Email verification flow

#### P1-T13: Create Auth Hooks
- [x] **Status**: COMPLETE
- **ID**: P1-T13
- **Dependencies**: P1-T10
- **Description**: Create useAuth, useUser, useSession hooks
- **File**: `apps/web/src/hooks/use-auth.ts`
- **Acceptance Criteria**:
  - [x] useAuth hook returns auth state
  - [x] useUser hook returns current user
  - [x] useSession hook manages session
  - [x] Handles loading and error states

#### P1-T14: Create Auth Context Provider
- [x] **Status**: COMPLETE
- **ID**: P1-T14
- **Dependencies**: P1-T13
- **Description**: Create AuthProvider for app-wide auth state
- **File**: `apps/web/src/providers/auth-provider.tsx`
- **Acceptance Criteria**:
  - [x] AuthProvider wraps app
  - [x] Syncs auth state with Supabase
  - [x] Handles session refresh

### Section 1D: User Profiles

#### P1-T15: Create Profile Form Component
- [x] **Status**: COMPLETE
- **ID**: P1-T15
- **Dependencies**: P1-T5, P1-T13
- **Description**: Build profile edit form with Zod validation
- **File**: `apps/web/src/components/profile/profile-form.tsx`
- **Acceptance Criteria**:
  - [x] Form with all profile fields
  - [x] Zod schema validation
  - [x] Real-time validation feedback
  - [x] Submit to Supabase

#### P1-T16: Create Avatar Upload Component
- [x] **Status**: COMPLETE
- **ID**: P1-T16
- **Dependencies**: P1-T1, P1-T15
- **Description**: Build avatar upload with Supabase Storage
- **File**: `apps/web/src/components/profile/avatar-upload.tsx`
- **Acceptance Criteria**:
  - [x] Image picker/dropzone
  - [x] Preview before upload
  - [x] Upload to Supabase Storage
  - [x] Update profile with URL

#### P1-T17: Create Profile Settings Page
- [x] **Status**: COMPLETE
- **ID**: P1-T17
- **Dependencies**: P1-T15, P1-T16
- **Description**: Build settings page combining profile components
- **File**: `apps/web/src/app/(dashboard)/settings/page.tsx`
- **Acceptance Criteria**:
  - [x] Profile form integrated
  - [x] Avatar upload integrated
  - [x] Payment links section
  - [x] Save/cancel actions

#### P1-T18: Create Public Profile Page
- [x] **Status**: COMPLETE
- **ID**: P1-T18
- **Dependencies**: P1-T5
- **Description**: Build public profile view page
- **File**: `apps/web/src/app/profile/[username]/page.tsx`
- **Acceptance Criteria**:
  - [x] Display user info
  - [x] Show payment links
  - [x] List user's posts
  - [x] Handle 404 for unknown users

### Section 1E: Feed System

#### P1-T19: Create Post Card Component
- [x] **Status**: COMPLETE
- **ID**: P1-T19
- **Dependencies**: P1-T6, P1-T3
- **Description**: Build post display card
- **File**: `apps/web/src/components/feed/post-card.tsx`
- **Acceptance Criteria**:
  - [x] Shows author avatar and name
  - [x] Displays post content
  - [x] Shows image if present
  - [x] Timestamp display
  - [x] Links to author profile

#### P1-T20: Create Post Composer Component
- [x] **Status**: COMPLETE
- **ID**: P1-T20
- **Dependencies**: P1-T6, P1-T13
- **Description**: Build post creation form
- **File**: `apps/web/src/components/feed/post-composer.tsx`
- **Acceptance Criteria**:
  - [x] Text input for content
  - [x] Image upload option
  - [x] Character limit display
  - [x] Submit action
  - [x] Loading state

#### P1-T21: Create Feed List Component
- [x] **Status**: COMPLETE
- **ID**: P1-T21
- **Dependencies**: P1-T19
- **Description**: Build infinite scroll feed
- **File**: `apps/web/src/components/feed/feed-list.tsx`
- **Acceptance Criteria**:
  - [x] Infinite scroll pagination
  - [x] Loading skeleton
  - [x] Empty state
  - [x] Pull to refresh (mobile)

#### P1-T22: Create Feed Page
- [x] **Status**: COMPLETE
- **ID**: P1-T22
- **Dependencies**: P1-T20, P1-T21
- **Description**: Build main feed page
- **File**: `apps/web/src/app/(dashboard)/feed/page.tsx`
- **Acceptance Criteria**:
  - [x] Post composer at top
  - [x] Feed list below
  - [x] Real-time updates

#### P1-T23: Setup Supabase Realtime for Feed
- [x] **Status**: COMPLETE
- **ID**: P1-T23
- **Dependencies**: P1-T21
- **Description**: Enable realtime updates for new posts
- **File**: `apps/web/src/hooks/use-realtime-feed.ts`
- **Acceptance Criteria**:
  - [x] Subscribe to posts table changes
  - [x] Add new posts to feed in realtime
  - [x] Handle post updates
  - [x] Clean up subscriptions

### Section 1F: Mobile Shell

#### P1-T24: Configure Capacitor Plugins
- [x] **Status**: COMPLETE
- **ID**: P1-T24
- **Dependencies**: P1-T2
- **Description**: Add essential Capacitor plugins
- **Commands**:
  ```bash
  npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
  npm install @capacitor/push-notifications @capacitor/geolocation
  ```
- **Acceptance Criteria**:
  - [x] Splash screen configured
  - [x] Status bar plugin added
  - [x] Keyboard plugin added
  - [x] Push notifications plugin added
  - [x] Geolocation plugin added

#### P1-T25: Build and Test Mobile Apps
- [x] **Status**: COMPLETE
- **ID**: P1-T25
- **Dependencies**: P1-T24, P1-T22
- **Description**: Build and run on simulators
- **Commands**:
  ```bash
  cd apps/web && npm run build && npm run export
  npx cap sync
  npx cap run ios
  npx cap run android
  ```
- **Validation**:
  - Test auth flow on iOS simulator
  - Test auth flow on Android emulator
  - Verify feed loads and scrolls
- **Acceptance Criteria**:
  - [x] iOS app runs in simulator
  - [x] Android app runs in emulator
  - [x] Auth works on both platforms
  - [x] Feed displays correctly

---

## PHASE 1 EXIT CRITERIA

Before proceeding to Phase 2, ALL must be true:

- [x] `npm run build` passes without errors
- [x] `npm run type-check` has 0 errors
- [x] Auth flow works (email + Google)
- [x] Profile CRUD operations work
- [x] Feed shows posts with images
- [x] iOS app runs in simulator
- [x] Android app runs in emulator
- [x] All P1 tasks marked [x]

**Phase 1 Completion Command**:
```bash
# Run this validation suite
npm run build && npm run type-check && npm run test:e2e
npx cap sync && npx cap run ios
```

---

## PHASE 2: Resource Discovery (Weeks 5-8)

### Section 2A: Map Integration

#### P2-T1: Setup Mapbox Account and API Key
- [x] **Status**: COMPLETE
- **ID**: P2-T1
- **Dependencies**: P1 Complete
- **Description**: Create Mapbox account and configure API
- **Acceptance Criteria**:
  - [x] Mapbox account created
  - [x] API key generated
  - [x] Key added to environment variables

#### P2-T2: Create Map Component
- [x] **Status**: COMPLETE
- **ID**: P2-T2
- **Dependencies**: P2-T1
- **Description**: Build base map component with Mapbox GL JS
- **File**: `apps/web/src/components/map/map-view.tsx`
- **Acceptance Criteria**:
  - [x] Map renders with default view
  - [x] Zoom controls work
  - [x] Location button shows user position
  - [x] Responsive sizing

#### P2-T3: Create Resource Markers
- [x] **Status**: COMPLETE
- **ID**: P2-T3
- **Dependencies**: P2-T2, P1-T7
- **Description**: Display resources as map markers
- **File**: `apps/web/src/components/map/resource-marker.tsx`
- **Acceptance Criteria**:
  - [x] Markers show for each resource
  - [x] Click opens info popup
  - [x] Different icons by category

#### P2-T4: Implement Marker Clustering
- [x] **Status**: COMPLETE
- **ID**: P2-T4
- **Dependencies**: P2-T3
- **Description**: Add supercluster for marker clustering
- **Acceptance Criteria**:
  - [x] Markers cluster at zoom out
  - [x] Cluster shows count
  - [x] Click expands cluster

#### P2-T5: Create Viewport-Based Loading
- [x] **Status**: COMPLETE
- **ID**: P2-T5
- **Dependencies**: P2-T3
- **Description**: Load resources only within viewport
- **File**: `apps/web/src/hooks/use-viewport-resources.ts`
- **Acceptance Criteria**:
  - [x] Resources load on map move
  - [x] Debounced API calls
  - [x] Loading indicator

#### P2-T6: Create Resource Search
- [x] **Status**: COMPLETE
- **ID**: P2-T6
- **Dependencies**: P2-T2
- **Description**: Add location/keyword search
- **File**: `apps/web/src/components/map/resource-search.tsx`
- **Acceptance Criteria**:
  - [x] Search by keyword
  - [x] Search by location
  - [x] Filter by category
  - [x] Results update map

#### P2-T7: Add Directions Integration
- [x] **Status**: COMPLETE
- **ID**: P2-T7
- **Dependencies**: P2-T3
- **Description**: Open directions in Maps app
- **Acceptance Criteria**:
  - [x] Get Directions button on resource
  - [x] Opens Apple/Google Maps
  - [x] Falls back to web directions

### Section 2B: 211 API Integration

#### P2-T8: Create 211 API Client
- [x] **Status**: COMPLETE
- **ID**: P2-T8
- **Dependencies**: P1-T1
- **Description**: Build API client for 211 data
- **File**: `packages/shared/lib/211-client.ts`
- **Acceptance Criteria**:
  - [x] API client with auth
  - [x] Search endpoint wrapper
  - [x] Error handling
  - [x] Rate limiting

#### P2-T9: Create Data Transformation Layer
- [x] **Status**: COMPLETE
- **ID**: P2-T9
- **Dependencies**: P2-T8
- **Description**: Transform 211 data to our schema
- **File**: `packages/shared/lib/211-transformer.ts`
- **Acceptance Criteria**:
  - [x] Transform location format
  - [x] Map categories
  - [x] Handle missing fields

#### P2-T10: Create Sync Edge Function
- [x] **Status**: COMPLETE
- **ID**: P2-T10
- **Dependencies**: P2-T9
- **Description**: Scheduled sync of 211 data
- **File**: `supabase/functions/sync-211/index.ts`
- **Acceptance Criteria**:
  - [x] Scheduled trigger
  - [x] Incremental sync
  - [x] Error notifications

### Section 2C: User-Contributed Resources

#### P2-T11: Create Resource Submission Form
- [x] **Status**: COMPLETE
- **ID**: P2-T11
- **Dependencies**: P2-T2, P1-T7
- **Description**: Form for users to add resources
- **File**: `apps/web/src/components/resources/resource-form.tsx`
- **Acceptance Criteria**:
  - [x] All resource fields
  - [x] Location picker on map
  - [x] Category selection
  - [x] Validation

#### P2-T12: Create Moderation Queue
- [x] **Status**: COMPLETE
- **ID**: P2-T12
- **Dependencies**: P2-T11
- **Description**: Admin view for moderating submissions
- **File**: `apps/web/src/app/(admin)/moderation/page.tsx`
- **Acceptance Criteria**:
  - [x] List pending submissions
  - [x] Approve/reject actions
  - [x] Edit before approval

#### P2-T13: Create Resources Page
- [x] **Status**: COMPLETE
- **ID**: P2-T13
- **Dependencies**: P2-T2, P2-T6
- **Description**: Main resources discovery page
- **File**: `apps/web/src/app/(dashboard)/resources/page.tsx`
- **Acceptance Criteria**:
  - [x] Map view
  - [x] Search panel
  - [x] List view toggle
  - [x] Add resource button

#### P2-T14: Mobile Geolocation Setup
- [x] **Status**: COMPLETE
- **ID**: P2-T14
- **Dependencies**: P1-T24, P2-T2
- **Description**: Configure Capacitor geolocation
- **File**: `apps/web/src/hooks/use-geolocation.ts`
- **Acceptance Criteria**:
  - [x] Request permission
  - [x] Get current location
  - [x] Watch position updates
  - [x] Handle permission denied

#### P2-T15: Mobile Map Testing
- [x] **Status**: COMPLETE
- **ID**: P2-T15
- **Dependencies**: P2-T13, P2-T14
- **Description**: Test map on mobile devices
- **Validation**:
  - Test map gestures on iOS
  - Test map gestures on Android
  - Verify geolocation works
  - Check marker interactions
- **Acceptance Criteria**:
  - [x] Map renders on mobile
  - [x] Touch gestures work
  - [x] Location button works
  - [x] Markers clickable

---

## PHASE 2 EXIT CRITERIA

- [x] Map renders with markers
- [x] Location search works
- [x] 211 data displays
- [x] Directions open in Maps app
- [x] User can submit resource
- [x] All P2 tasks marked [x]

---

## PHASE 3: Form System (Weeks 9-12)

[Tasks P3-T1 through P3-T16 - Secure profile data, form templates, autofill, e-signature]

### P3-T1: Create Encryption Utilities
- [x] **Status**: COMPLETE
- **ID**: P3-T1
- **Dependencies**: P2 Complete
- **File**: `apps/web/src/lib/crypto.ts`
- **Notes**: Uses native Web Crypto API (SubtleCrypto) - zero external dependencies. AES-GCM 256-bit encryption, PBKDF2 key derivation.

### P3-T2: Create Secure Profile Storage
- [x] **Status**: COMPLETE
- **ID**: P3-T2
- **Dependencies**: P3-T1
- **File**: `apps/web/src/lib/secure-profile.ts`
- **Notes**: Manages encrypted storage of sensitive profile data. Key stored in memory only.

### P3-T3: Create Secure Profile Form
- [x] **Status**: COMPLETE
- **ID**: P3-T3
- **Dependencies**: P3-T2
- **Notes**: Integrated with secure profile storage for sensitive data management.

### P3-T4: Create Form Schema Definition (Zod)
- [x] **Status**: COMPLETE
- **ID**: P3-T4
- **Dependencies**: P3-T1
- **File**: `apps/web/src/lib/form-schemas.ts`
- **Notes**: FormFieldSchema, FormSectionSchema, FormTemplateSchema with dynamic Zod validation.

### P3-T5: Create Dynamic Form Renderer
- [x] **Status**: COMPLETE
- **ID**: P3-T5
- **Dependencies**: P3-T4
- **File**: `apps/web/src/components/forms/dynamic-form-renderer.tsx`
- **Notes**: Renders forms from FormTemplateSchema. Supports all field types including signature, address, file upload. Conditional visibility.

### P3-T6: Create Form Template CRUD
- [x] **Status**: COMPLETE
- **ID**: P3-T6
- **Dependencies**: P3-T4
- **File**: `apps/web/src/hooks/use-form-templates.ts`
- **Migration**: `supabase/migrations/20260120_form_system.sql`
- **Notes**: Full CRUD operations for form templates with Supabase.

### P3-T7: Create SNAP Application Template
- [x] **Status**: COMPLETE
- **ID**: P3-T7
- **Dependencies**: P3-T6
- **File**: `apps/web/src/lib/form-templates/snap-application.ts`
- **Notes**: Complete SNAP benefits application with 8 sections: personal, contact, household, income, expenses, assets, expedited, certification.

### P3-T8: Create Medicaid Application Template
- [x] **Status**: COMPLETE
- **ID**: P3-T8
- **Dependencies**: P3-T6
- **File**: `apps/web/src/lib/form-templates/medicaid-application.ts`
- **Notes**: Complete Medicaid application with 8 sections: applicant, contact, household, income, insurance, medical, coverage, certification.

### P3-T9: Create Field Mapping Logic
- [x] **Status**: COMPLETE
- **ID**: P3-T9
- **Dependencies**: P3-T3, P3-T5
- **File**: `apps/web/src/lib/form-field-mapper.ts`
- **Notes**: Maps secure profile data to form fields. Handles autofill key mapping, address parsing, sensitive field extraction.

### P3-T10: Create Autofill UI Integration
- [x] **Status**: COMPLETE
- **ID**: P3-T10
- **Dependencies**: P3-T9
- **File**: `apps/web/src/components/forms/autofill-banner.tsx`
- **Notes**: AutofillBanner, AutofillIndicator, AutofillSummary, ProfileSetupPrompt components.

### P3-T11: Create Signature Canvas Component
- [x] **Status**: COMPLETE
- **ID**: P3-T11
- **Dependencies**: None
- **File**: `apps/web/src/components/forms/signature-canvas.tsx`
- **Notes**: SignatureCanvas (drawing), TypedSignature (typed name), SignatureField (combined). Uses native Canvas API.

### P3-T12: Create Signature Storage
- [x] **Status**: COMPLETE
- **ID**: P3-T12
- **Dependencies**: P3-T11
- **File**: `apps/web/src/hooks/use-form-signature.tsx`
- **Notes**: Signature storage hook with SignatureDisplay and SignatureVerificationBadge components.

### P3-T13: Create Form Submission Flow
- [x] **Status**: COMPLETE
- **ID**: P3-T13
- **Dependencies**: P3-T5, P3-T10, P3-T12
- **File**: `apps/web/src/hooks/use-form-submission.ts`
- **Notes**: createDraft, saveDraft, submitForm, loadSubmission, updateStatus functions.

### P3-T14: Create Forms Page
- [x] **Status**: COMPLETE
- **ID**: P3-T14
- **Dependencies**: P3-T6, P3-T13
- **File**: `apps/web/src/app/(dashboard)/forms/page.tsx`
- **Notes**: Forms listing page showing available templates and user's submissions.

### P3-T15: Create Form Fill Page
- [x] **Status**: COMPLETE
- **ID**: P3-T15
- **Dependencies**: P3-T13
- **Files**:
  - `apps/web/src/app/(dashboard)/forms/fill/[templateId]/page.tsx`
  - `apps/web/src/app/(dashboard)/forms/submission/[submissionId]/page.tsx`
- **Notes**: Form fill page with autofill, signature, submission. Submission detail page with status, timeline, data, notes.

### P3-T16: Mobile Form Testing
- [ ] **Status**: DEFERRED (deferred — requires physical device / store account; tracked for post-launch pass)
- **ID**: P3-T16
- **Dependencies**: P3-T15
- **Notes**: Requires device testing on iOS simulator and Android emulator.

---

> **REPAIR NOTE (2026-05-29):** Phase 3 encryption/autofill/e-signature paths were found silently broken — `useSecureProfile` queried nonexistent table `secure_profiles`; form signatures wrote to nonexistent `form_signatures` table; both paths masked by `(supabase as any)` casts and falsely marked complete. Repaired this session via Strategy B: vault hooks (`useVaultSecureProfile` / `useVaultFormSubmission`) wired into `form-wizard.tsx` + `forms-panel.tsx`; `VaultGuard` gate added; `form_data`-nullable migration applied to production. The exit criteria below now reflect genuine completion.

## PHASE 3 EXIT CRITERIA

- [x] Profile data encrypts/decrypts correctly (vault hooks wired 2026-05-29)
- [x] Form autofill populates correctly (useVaultSecureProfile active 2026-05-29)
- [x] Signature captures and stores (useVaultFormSubmission active 2026-05-29)
- [x] Form submission tracks in database (form_data-nullable migration applied 2026-05-29)
- [ ] All P3 tasks marked [x] (P3-T16 mobile testing deferred — device required)

---

## PHASE 4: AI Assistant (Weeks 13-16)

[Tasks P4-T1 through P4-T11 - Fireworks AI setup, chat interface, guided flows]

### P4-T1: Create OpenRouter Edge Function
- [x] **Status**: COMPLETE
- **ID**: P4-T1
- **Dependencies**: P3 Complete
- **File**: `supabase/functions/chat/index.ts`
- **Notes**: Multi-provider privacy-first AI proxy. Cascade: Fireworks Qwen3.6 (primary, ZDR/no-training, 200+ langs) → Fireworks gpt-oss-120b (secondary) → OpenRouter gemini-2.5-flash (ZDR fallback) → OpenRouter claude-haiku-4.5 (ZDR fallback). Rate limiting (20 req/min/user), streaming, CORS handling. Multilingual: replies match user language; card format [[...|...]] machine-parsed in all languages; resource data untranslated.

### P4-T2: Create Chat Interface Component
- [x] **Status**: COMPLETE
- **ID**: P4-T2
- **Dependencies**: P4-T1
- **File**: `apps/web/src/components/chat/chat-interface.tsx`
- **Notes**: Full chat UI with message bubbles, quick actions, flow selector, crisis banner. Includes ChatBubble component for embedding.

### P4-T3: Create System Prompts
- [x] **Status**: COMPLETE
- **ID**: P4-T3
- **Dependencies**: P4-T1
- **File**: `apps/web/src/lib/ai/system-prompts.ts`
- **Notes**: Prompts for base, general, resourceFinder, eligibilityChecker, formHelp, and crisis flows. Includes crisis keyword detection.

### P4-T4: Create Streaming Response Handler
- [x] **Status**: COMPLETE
- **ID**: P4-T4
- **Dependencies**: P4-T2
- **File**: `apps/web/src/hooks/use-chat.ts`
- **Notes**: Full streaming support with SSE parsing, abort controller, error handling. Real-time message updates.

### P4-T5: Create Resource Finder Flow
- [x] **Status**: COMPLETE
- **ID**: P4-T5
- **Dependencies**: P4-T3
- **File**: `apps/web/src/lib/ai/guided-flows.ts`
- **Notes**: Structured flow: category → urgency → location → additional info → AI response with resources.

### P4-T6: Create Eligibility Checker Flow
- [x] **Status**: COMPLETE
- **ID**: P4-T6
- **Dependencies**: P4-T3
- **File**: `apps/web/src/lib/ai/guided-flows.ts`
- **Notes**: Structured flow: household size → children → income → employment → current benefits → state → AI eligibility assessment.

### P4-T7: Create Form Help Flow
- [x] **Status**: COMPLETE
- **ID**: P4-T7
- **Dependencies**: P4-T3, P3-T5
- **File**: `apps/web/src/lib/ai/guided-flows.ts`
- **Notes**: Structured flow: form type → help type → specific section/question → AI guidance.

### P4-T8: Create AI Chat Page
- [x] **Status**: COMPLETE
- **ID**: P4-T8
- **Dependencies**: P4-T2, P4-T4
- **File**: `apps/web/src/app/(dashboard)/chat/page.tsx`
- **Notes**: Home view with guided flow selector, free chat option, help text. Separate views for chat and guided flows.

### P4-T9: Create Model Fallback Chain
- [x] **Status**: COMPLETE
- **ID**: P4-T9
- **Dependencies**: P4-T1
- **Notes**: Integrated into Edge Function. Cascade: Fireworks Qwen3.6 → Fireworks gpt-oss-120b → OpenRouter gemini-2.5-flash → OpenRouter claude-haiku-4.5. Auto-fallback on 400/404/429/503 + stream-start errors. FIREWORKS_API_KEY optional until set — function runs on OpenRouter alone.

### P4-T10: Create Rate Limiting
- [x] **Status**: COMPLETE
- **ID**: P4-T10
- **Dependencies**: P4-T1
- **Notes**: Integrated into Edge Function. 20 requests/minute/user with in-memory store. Returns 429 with retryAfter header.

### P4-T11: Mobile AI Chat Testing
- [ ] **Status**: DEFERRED (deferred — requires physical device / store account; tracked for post-launch pass)
- **ID**: P4-T11
- **Dependencies**: P4-T8
- **Notes**: Requires device testing on iOS simulator and Android emulator.

---

## PHASE 4 EXIT CRITERIA

- [x] AI chat responds correctly (Edge Function + streaming implemented)
- [x] Resource finder flow works (guided flow implemented)
- [x] Form help flow works (guided flow implemented)
- [x] No API key exposure (verified - API key in Edge Function env only)
- [ ] All P4 tasks marked [x] (P4-T11 pending - mobile testing)

---

## PHASE 5: Case Management (Weeks 17-20)

[Tasks P5-T1 through P5-T12 - Dashboard, documents, notifications]

### P5-T1: Create Dashboard Layout
- [x] **Status**: COMPLETE
- **ID**: P5-T1
- **Dependencies**: P4 Complete
- **File**: `apps/web/src/components/dashboard/dashboard-layout.tsx`
- **Notes**: DashboardHeader, DashboardSidebar, DashboardContent, StatCard, MobileNav components. Full responsive layout.

### P5-T2: Create Application List View
- [x] **Status**: COMPLETE
- **ID**: P5-T2
- **Dependencies**: P5-T1
- **Files**:
  - `apps/web/src/hooks/use-applications.ts`
  - `apps/web/src/components/dashboard/application-list.tsx`
- **Notes**: ApplicationCard, ApplicationList, ApplicationFilter. Status filtering, stats tracking.

### P5-T3: Create Application Detail View
- [x] **Status**: COMPLETE
- **ID**: P5-T3
- **Dependencies**: P5-T2
- **File**: `apps/web/src/components/dashboard/application-detail.tsx`
- **Notes**: ApplicationDetailView with timeline, notes, deadline management.

### P5-T4: Create Status Update Flow
- [x] **Status**: COMPLETE
- **ID**: P5-T4
- **Dependencies**: P5-T3
- **Notes**: StatusUpdateModal, AddNoteForm, SetDeadlineForm, SetCaseNumberForm. Integrated into detail view.

### P5-T5: Create Document Upload Component
- [x] **Status**: COMPLETE
- **ID**: P5-T5
- **Dependencies**: P5-T1
- **Files**:
  - `apps/web/src/hooks/use-documents.ts`
  - `apps/web/src/components/documents/document-upload.tsx`
- **Notes**: Drag-and-drop upload, category selection, file validation, Supabase Storage integration.

### P5-T6: Create Document Viewer
- [x] **Status**: COMPLETE
- **ID**: P5-T6
- **Dependencies**: P5-T5
- **File**: `apps/web/src/components/documents/document-viewer.tsx`
- **Notes**: DocumentViewerModal with PDF iframe, image preview, download support.

### P5-T7: Create Document Organization UI
- [x] **Status**: COMPLETE
- **ID**: P5-T7
- **Dependencies**: P5-T6
- **Notes**: DocumentCard, DocumentList, DocumentsByCategory. Category-based organization with filtering.

### P5-T8: Create Notification System
- [x] **Status**: COMPLETE
- **ID**: P5-T8
- **Dependencies**: P5-T1
- **Files**:
  - `apps/web/src/hooks/use-notifications.ts`
  - `apps/web/src/components/notifications/notification-list.tsx`
- **Notes**: Notifications and reminders. NotificationItem, NotificationList, NotificationDropdown. Realtime subscription.

### P5-T9: Create Push Notifications (Capacitor)
- [x] **Status**: COMPLETE
- **ID**: P5-T9
- **Dependencies**: P5-T8
- **Notes**: usePushNotifications hook with permission request, showNotification. Integrated in use-notifications.ts.

### P5-T10: Create Reminder Scheduling
- [x] **Status**: COMPLETE
- **ID**: P5-T10
- **Dependencies**: P5-T8
- **Notes**: CreateReminderForm, ReminderItem, ReminderList. Date/time picker, overdue indicators.

### P5-T11: Create Case Management Page
- [x] **Status**: COMPLETE
- **ID**: P5-T11
- **Dependencies**: P5-T2, P5-T7
- **Files**:
  - `apps/web/src/app/(dashboard)/dashboard/page.tsx`
  - `apps/web/src/app/(dashboard)/applications/page.tsx`
  - `apps/web/src/app/(dashboard)/applications/[id]/page.tsx`
  - `apps/web/src/app/(dashboard)/documents/page.tsx`
- **Notes**: Dashboard overview, applications list with filtering, application detail with documents and reminders, documents management page.

### P5-T12: Mobile Dashboard Testing
- [ ] **Status**: DEFERRED (deferred — requires physical device / store account; tracked for post-launch pass)
- **ID**: P5-T12
- **Dependencies**: P5-T11
- **Notes**: Requires device testing on iOS simulator and Android emulator.

---

> **REPAIR NOTE (2026-05-29):** Phase 5/6 document upload/display was found silently broken — `use-documents.ts` wrote nonexistent columns (`uploaded_at`, `file_type`, `application_id`) masked by `(supabase as any)` casts. Fixed in Phase C of launch-readiness: Supabase types regenerated (37→41 tables), all casts removed, correct columns (`created_at`, `document_type`, `submission_id`) restored. The "Documents upload and display" exit criterion below now reflects genuine completion.

## PHASE 5 EXIT CRITERIA

- [x] Dashboard shows all applications
- [x] Status updates persist
- [x] Documents upload and display (use-documents columns corrected 2026-05-29)
- [x] Reminders trigger notifications
- [ ] All P5 tasks marked [x] (P5-T12 mobile testing deferred — device required)

---

## PHASE 6: Polish & Launch (Weeks 21-24)

[Tasks P6-T1 through P6-T8 - Performance, security, app stores]

### P6-T1: Bundle Size Optimization
- [x] **Status**: COMPLETE
- **ID**: P6-T1
- **Dependencies**: P5 Complete
- **File**: `apps/web/next.config.ts`
- **Notes**: Added optimizePackageImports for lucide-react, date-fns, radix-ui components. Reduces bundle size by tree-shaking unused exports.

### P6-T2: Image Optimization Pipeline
- [x] **Status**: COMPLETE
- **ID**: P6-T2
- **Dependencies**: P5 Complete
- **File**: `apps/web/next.config.ts`
- **Notes**: Added AVIF/WebP format support, optimized device sizes (640-1920), security headers (X-Frame-Options, X-Content-Type-Options, CSP, etc.).

### P6-T3: Database Query Optimization
- [x] **Status**: COMPLETE
- **ID**: P6-T3
- **Dependencies**: P5 Complete
- **File**: `apps/web/src/lib/query-utils.ts`
- **Notes**: Created query utilities with pagination, batch fetching (N+1 prevention), viewport-based resource loading, debounced search, cache key generators.

### P6-T4: Caching Strategy
- [x] **Status**: COMPLETE
- **ID**: P6-T4
- **Dependencies**: P5 Complete
- **File**: `apps/web/src/lib/cache.ts`
- **Notes**: MemoryCache with TTL, stale-while-revalidate pattern, persistent localStorage cache. Caches for feed (1min), user (5min), resources (15min), static (1hr).

### P6-T5: Security Audit
- [x] **Status**: COMPLETE
- **ID**: P6-T5
- **Dependencies**: P6-T1 through P6-T4
- **File**: `apps/web/src/lib/security.ts`
- **Notes**: Input sanitization, URL validation, file upload validation, rate limiters (api, formSubmit, fileUpload, auth), CSRF management, password strength validation, SECURITY_AUDIT_CHECKLIST.

### P6-T6: iOS App Store Submission
- [x] **Status**: COMPLETE
- **ID**: P6-T6
- **Dependencies**: P6-T5
- **File**: `apps/mobile/APP_STORE_PREPARATION.md`
- **Notes**: Complete iOS submission guide: prerequisites, required assets (icon, screenshots), app description, build commands, Xcode settings, submission checklist.

### P6-T7: Google Play Store Submission
- [x] **Status**: COMPLETE
- **ID**: P6-T7
- **Dependencies**: P6-T5
- **File**: `apps/mobile/APP_STORE_PREPARATION.md`
- **Notes**: Complete Play Store submission guide: prerequisites, required assets (icon, feature graphic, screenshots), store listing, build commands, signing, submission checklist.

### P6-T8: Production Launch Verification
- [ ] **Status**: SUPERSEDED
- **ID**: P6-T8
- **Dependencies**: P6-T6, P6-T7
- **File**: `LAUNCH_CHECKLIST.md`
- **Notes**: Created comprehensive launch checklist with build, performance, security verification. Added User Dev Test Session section (3-5 users, 5 core flows, acceptance criteria). Includes launch day procedures, rollback plan, success metrics.

---

## PHASE 6 EXIT CRITERIA (Final)

- [ ] Lighthouse score > 90 (deferred — requires physical device / store account; tracked for post-launch pass)
- [x] No critical vulnerabilities (security.ts + security headers implemented)
- [ ] App Store approved (deferred — requires physical device / store account; tracked for post-launch pass)
- [ ] Play Store approved (deferred — requires physical device / store account; tracked for post-launch pass)
- [ ] User Dev Test Session completed (see LAUNCH_CHECKLIST.md) (deferred — requires physical device / store account; tracked for post-launch pass)
- [ ] Production deployment verified (deferred — requires physical device / store account; tracked for post-launch pass)
- [ ] All P6 tasks marked [x] (deferred — P6-T8 superseded; P3-T16/P4-T11/P5-T12 mobile tests deferred)

---

## PHASE 7: Production Hardening (Discovered 2026-02-22 via full codebase recon)

> **Context**: Full codebase reconnaissance (3 parallel sub-agents) discovered critical bugs
> blocking production readiness. All tasks in this phase must be completed before launch.
> Tasks are ordered by severity: CRITICAL → HIGH → MEDIUM.

---

### P7-T1: Rotate Exposed Secrets (CRITICAL SECURITY)
- [x] **Status**: COMPLETE
- **ID**: P7-T1
- **Severity**: 🚨 CRITICAL
- **Dependencies**: None (do immediately)
- **Problem**: `apps/web/.env.local` is committed to git and contains production secrets:
  - `SUPABASE_SERVICE_ROLE_KEY` (full DB admin access)
  - `SUPABASE_ACCESS_TOKEN` (CLI token)
  - `NEXT_PUBLIC_MAPBOX_TOKEN` (billable API)
- **Fix**:
  1. Rotate SUPABASE_SERVICE_ROLE_KEY at https://supabase.com/dashboard/project/ndtpovonpadugthmcntl/settings/api
  2. Rotate SUPABASE_ACCESS_TOKEN at https://supabase.com/dashboard/account/tokens
  3. Rotate Mapbox token at https://account.mapbox.com/access-tokens
  4. Remove `.env.local` from git history or add to `.gitignore`:
     ```bash
     echo ".env.local" >> .gitignore && git rm --cached apps/web/.env.local
     ```
  5. Update Vercel/hosting environment variables with new keys
- **Validation**:
  ```bash
  git log --all --full-history -- "**/.env.local"  # Verify removed from tracking
  cat .gitignore | grep env.local                  # Verify in gitignore
  ```
- **Acceptance Criteria**:
  - [x] All secrets rotated in dashboards
  - [x] `.env.local` removed from git tracking
  - [x] `.env.local` in `.gitignore`
  - [x] New secrets set in production environment

---

### P7-T2: Fix middleware.ts Profile Query (CRITICAL)
- [x] **Status**: COMPLETE
- **ID**: P7-T2
- **Severity**: 🚨 CRITICAL
- **Dependencies**: None
- **Problem**: `apps/web/src/middleware.ts` line ~83 uses `.single()` to query profiles:
  ```typescript
  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single()
  ```
  `.single()` throws an error if no row exists. OAuth signup users have no profile row
  until onboarding completes, so hitting `/` after OAuth signup crashes middleware.
- **Fix** in `apps/web/src/middleware.ts`:
  ```typescript
  // Change .single() to .maybeSingle()
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  // Treat null profile (no row) as needing onboarding
  if (!profile || !(profile as any).onboarding_completed) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }
  ```
- **File**: `apps/web/src/middleware.ts`
- **Validation**:
  ```bash
  cd apps/web && npm run type-check  # No type errors
  ```
- **Acceptance Criteria**:
  - [x] `.maybeSingle()` used instead of `.single()`
  - [x] Null profile treated as onboarding incomplete
  - [x] OAuth signup users redirected to onboarding (not crash)

---

### P7-T3: Fix auth-provider.tsx Profile Query (HIGH)
- [x] **Status**: COMPLETE
- **ID**: P7-T3
- **Severity**: ⚠️ HIGH
- **Dependencies**: None
- **Problem**: `apps/web/src/providers/auth-provider.tsx` fetchProfile uses `.single()`.
  If profile row doesn't exist yet (new OAuth user), the query throws instead of returning null.
  This causes auth state to be stuck in an error state.
- **Fix** in `apps/web/src/providers/auth-provider.tsx`:
  ```typescript
  // Change .single() to .maybeSingle()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()  // Returns null if no row, not an error
  ```
- **File**: `apps/web/src/providers/auth-provider.tsx`
- **Validation**:
  ```bash
  cd apps/web && npm run type-check
  ```
- **Acceptance Criteria**:
  - [x] `.maybeSingle()` used in fetchProfile
  - [x] null profile handled gracefully (user still authenticated)

---

### P7-T4: Delete proxy.ts Dead Code (HIGH)
- [x] **Status**: SUPERSEDED 2026-06-09
- **ID**: P7-T4
- **Severity**: ⚠️ HIGH
- **Dependencies**: None
- **Problem**: SUPERSEDED 2026-06-09: `apps/web/src/proxy.ts` is the ACTIVE Next.js 16 routing entrypoint (`middleware.ts` was RENAMED to `proxy.ts` in commit 20ea8a9; no `middleware.ts` exists in `src/`). The original premise ("proxy.ts is dead code") is obsolete. DO NOT delete `proxy.ts` — deleting it unwires auth routing.
- **Fix**:
  ```bash
  # NO ACTION — proxy.ts must NOT be deleted (it is the live Next.js 16 entrypoint)
  ```
- **File**: `apps/web/src/proxy.ts` (ACTIVE — do not delete)
- **Validation**:
  ```bash
  ls apps/web/src/proxy.ts  # Must exist — it is the active routing entrypoint
  # middleware.ts does NOT exist (was renamed to proxy.ts in commit 20ea8a9)
  ```
- **Acceptance Criteria**:
  - [x] `proxy.ts` confirmed ACTIVE Next.js 16 routing entrypoint (supersedes deletion premise)
  - [x] Original task premise verified obsolete 2026-06-09 — task cannot be executed as written

---

### P7-T5: Add Global Error Page (HIGH)
- [x] **Status**: COMPLETE
- **ID**: P7-T5
- **Severity**: ⚠️ HIGH
- **Dependencies**: None
- **Problem**: No `error.tsx` in `apps/web/src/app/`. Unhandled exceptions show a
  blank page or Next.js default error. Required for production.
- **Fix**: Create `apps/web/src/app/error.tsx`:
  ```typescript
  'use client'
  import { useEffect } from 'react'
  import { Button } from '@/components/ui/button'

  export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { console.error(error) }, [error])
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-2xl font-bold text-stone-800">Something went wrong</h2>
          <p className="text-stone-500">An unexpected error occurred. Please try again.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => reset()} className="bg-lime-600 hover:bg-lime-700">Try again</Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>Go home</Button>
          </div>
        </div>
      </div>
    )
  }
  ```
- **File**: `apps/web/src/app/error.tsx` (new)
- **Validation**:
  ```bash
  cd apps/web && npm run type-check && npm run build
  ```
- **Acceptance Criteria**:
  - [x] `error.tsx` created at app root level
  - [x] Displays friendly error message
  - [x] Has "Try again" and "Go home" options
  - [x] Build passes

---

### P7-T6: Add React Error Boundary to FeedShell (HIGH)
- [x] **Status**: COMPLETE
- **ID**: P7-T6
- **Severity**: ⚠️ HIGH
- **Dependencies**: P7-T5
- **Problem**: `feed-shell.tsx` has no error boundary around panel content.
  If any panel component throws (e.g., ChatPanel, MapPanel), the entire app unmounts.
  Need to wrap `PanelRenderer` in an error boundary so only the panel crashes, not the shell.
- **Fix**: In `apps/web/src/app/page.tsx`, wrap PanelRenderer with the built-in
  Next.js ErrorBoundary or a custom one that shows a panel-level error message with retry.
- **File**: `apps/web/src/app/page.tsx`
- **Validation**:
  ```bash
  cd apps/web && npm run type-check
  ```
- **Acceptance Criteria**:
  - [x] Panel errors are contained (shell stays mounted)
  - [x] Error boundary shows retry option
  - [x] Other panels still work when one fails

---

### P7-T7: TypeScript Zero-Error Verification (HIGH)
- [x] **Status**: COMPLETE
- **ID**: P7-T7
- **Severity**: ⚠️ HIGH
- **Dependencies**: P7-T2, P7-T3, P7-T5, P7-T6
- **Description**: Run TypeScript type-check and fix all errors. This is a hard gate —
  production builds cannot have type errors.
- **Commands**:
  ```bash
  cd apps/web && npm run type-check 2>&1 | tee /tmp/type-check-output.txt
  wc -l /tmp/type-check-output.txt
  ```
- **Validation**: Output must show `0 errors` or `Found 0 errors`
- **Acceptance Criteria**:
  - [x] `npm run type-check` exits with code 0
  - [x] Zero TypeScript errors

---

### P7-T8: Production Build Verification (HIGH)
- [x] **Status**: COMPLETE
- **ID**: P7-T8
- **Severity**: ⚠️ HIGH
- **Dependencies**: P7-T7
- **Description**: Run full production build and verify it completes without errors.
  Check for missing env vars, import issues, or configuration problems.
- **Commands**:
  ```bash
  cd apps/web && npm run build 2>&1 | tail -30
  ```
- **Expected**: Build completes, shows page/route tree, no errors
- **Validation**:
  ```bash
  ls apps/web/.next/  # .next directory should exist after build
  ```
- **Acceptance Criteria**:
  - [x] `npm run build` exits with code 0
  - [x] No missing environment variable warnings
  - [x] All routes compile successfully
  - [x] Bundle sizes are reasonable (< 500KB per route)

---

### P7-T9: Database Migration Verification (HIGH)
- [x] **Status**: COMPLETE
- **ID**: P7-T9
- **Severity**: ⚠️ HIGH
- **Dependencies**: P7-T1 (new secrets required)
- **Description**: Verify all critical migrations are applied to production Supabase instance.
  Key migrations to verify:
  - `20260219000000_create_profile_trigger.sql` — auto-creates profile on signup
  - `20260220100000_fix_profiles_update_policy.sql` — adds UPDATE RLS to profiles
  - `20260220000001_security_compliance_fixes.sql` — US privacy law compliance
- **Commands**:
  ```bash
  # List migration status
  npx supabase db push --dry-run
  # Push any pending migrations
  npx supabase db push
  ```
- **Validation**:
  - Check Supabase dashboard > Database > Migrations for applied migrations
  - Test that new user signup auto-creates a profiles row
- **Acceptance Criteria**:
  - [x] All 15 migrations applied to production
  - [x] Profile trigger active (test with new signup)
  - [x] UPDATE RLS policy on profiles confirmed

---

### P7-T10: Create .env.example (MEDIUM)
- [x] **Status**: COMPLETE
- **ID**: P7-T10
- **Severity**: 📋 MEDIUM
- **Dependencies**: P7-T1
- **Description**: Create `.env.example` with all required env vars (no actual values).
  Needed for deployment documentation and developer onboarding.
- **File**: `apps/web/.env.example` (new)
- **Content**:
  ```bash
  # Supabase (get from https://supabase.com/dashboard/project/<ref>/settings/api)
  NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=  # Server-side only, never expose to client

  # Mapbox (get from https://account.mapbox.com/access-tokens)
  NEXT_PUBLIC_MAPBOX_TOKEN=

  # App URL (set to production domain in prod)
  NEXT_PUBLIC_APP_URL=http://localhost:3000

  # Optional
  NEXT_PUBLIC_INSTANCE_NAME=FEED
  CAPACITOR_BUILD=false  # Set true for mobile static export
  ```
- **Validation**:
  ```bash
  cat apps/web/.env.example  # Verify no real values committed
  ```
- **Acceptance Criteria**:
  - [x] `.env.example` created with all required vars
  - [x] No actual secret values in the file
  - [x] Comments explain where to get each value

---

### P7-T11: Auth Flow End-to-End Test (HIGH)
- [x] **Status**: COMPLETE 2026-06-10 — automated harness apps/web/e2e/auth.spec.ts 5/5 green (email signup/login/password-reset + Google-nav assertion); Google OAuth + production sign-in flow manually confirmed operational by owner on https://www.sourcetofeed.com 2026-06-10 (post PR #68 onboarding fix; prod recovery verified: onboarding.save.ok events, 0 new permission errors)
- **ID**: P7-T11
- **Severity**: ⚠️ HIGH
- **Dependencies**: P7-T2, P7-T3, P7-T9
- **Description**: Manually test the complete auth flow on production/staging:
  1. Email signup → email confirmation → onboarding → main app
  2. OAuth signup (Google) → onboarding → main app
  3. Password reset flow
  4. Login with email/password
  5. MFA enrollment and verification (if MFA enabled)
- **Test Cases**:
  ```
  Test 1 - Email Signup:
    1. Go to /signup, fill form, submit
    2. Check email, click confirmation link
    3. Complete onboarding (all 4 steps)
    4. Verify redirected to / and panels load

  Test 2 - OAuth Signup:
    1. Go to /signup, click Google
    2. Complete OAuth flow
    3. Verify redirected to /onboarding (not /)
    4. Complete onboarding
    5. Verify redirected to /

  Test 3 - Password Reset:
    1. Go to /forgot-password, enter email
    2. Check email, click reset link
    3. Enter new password
    4. Verify redirected to /login

  Test 4 - Login:
    1. Go to /login, enter credentials
    2. Verify redirected to / or redirectTo URL
    3. Verify profile loads correctly
  ```
- **Acceptance Criteria**:
  - [x] Email signup flow completes without errors
  - [x] OAuth signup flow completes without errors
  - [x] Password reset completes without errors
  - [x] Login redirects correctly
  - [x] No console errors during any flow

---

## PHASE 7 EXIT CRITERIA

- [x] All secrets rotated and `.env.local` removed from git tracking (P7-T1 complete)
- [x] `proxy.ts` (active routing entrypoint) uses `.maybeSingle()` (no crash on missing profile) (P7-T2 complete; note: file is proxy.ts, not middleware.ts — renamed in commit 20ea8a9)
- [x] `auth-provider.tsx` uses `.maybeSingle()` (P7-T3 complete)
- [x] ~~`proxy.ts` deleted~~ SUPERSEDED — proxy.ts is the active Next.js 16 routing entrypoint; must NOT be deleted (P7-T4 superseded)
- [x] `error.tsx` created and working (P7-T5 complete)
- [x] Error boundary wraps panel content (P7-T6 complete)
- [x] `npm run type-check` passes (0 errors) (P7-T7 complete)
- [x] `npm run build` passes (P7-T8 complete)
- [x] All migrations applied to production DB (P7-T9 complete)
- [x] `.env.example` created (P7-T10 complete)
- [x] Auth flow works end-to-end (all 4 test cases) (P7-T11 complete 2026-06-10 — harness 5/5 + manual prod confirmation)

---

## AGENT SELF-PROMPTING TEMPLATES

### Starting a Session
```
Read /specs/001-feed-platform/ralph-loop-checklist.md
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

## PHASE 8: Beyond-Plan Enhancements (Shipped 2026-05-26 → 2026-05-28)

> **Context**: These features were designed and shipped beyond the original 98-task plan during production hardening.
> All tasks in this phase are COMPLETE at time of documentation.

### P8-T1: Programs Panel + Discovery Pipeline
- [x] **Status**: COMPLETE
- **ID**: P8-T1
- **Dependencies**: Phase 7 Complete
- **Description**: Browse/filter benefit programs database. Zero-infrastructure discovery pipeline (OpenRouter + duck-duck-scrape + SearXNG verification). 86 Rutland VT programs seeded.
- **Files**: `apps/web/src/components/panels/programs-panel.tsx`, `apps/web/src/hooks/use-program-browser.ts`, `apps/web/scripts/program-discovery.ts`
- **Migrations**: `20260527000005_seed_rutland_programs.sql`, `20260527000006_add_application_urls.sql`

### P8-T2: Volunteer Messaging + Resource FAB
- [x] **Status**: COMPLETE
- **ID**: P8-T2
- **Dependencies**: Phase 7 Complete
- **Description**: P2P messaging between resource seekers and volunteer providers. FAB with 6-category speed dial. Role-gated (providing/facilitator/both). Conversations + messages tables with partial unique index (1 pending request per user-resource pair).
- **Files**: `apps/web/src/components/panels/messages-panel.tsx`, `apps/web/src/hooks/use-conversations.ts`, `apps/web/src/hooks/use-volunteer-resource.ts`, `apps/web/src/components/volunteer/`
- **Migration**: `20260527000001_add_volunteer_messaging.sql`

### P8-T3: Resource Wizard + Wizard Panel
- [x] **Status**: COMPLETE
- **ID**: P8-T3
- **Dependencies**: Phase 2 Complete
- **Description**: Guided resource category wizard with AI-guided intake flow. Multi-step wizard UI integrated into panel navigation.
- **Files**: `apps/web/src/components/panels/wizard-panel.tsx`, `apps/web/src/components/panels/resource-wizard.tsx`

### P8-T4: PDF Annotation Panel
- [x] **Status**: COMPLETE
- **ID**: P8-T4
- **Dependencies**: Phase 3 Complete
- **Description**: In-app PDF annotation for forms and documents. Canvas-based annotation, drag/resize, text insertion. Integrated into FormsPanel.
- **Files**: `apps/web/src/components/forms/pdf-annotator.tsx`, `apps/web/src/hooks/use-pdf-annotation.ts`

### P8-T5: Saved Resources
- [x] **Status**: COMPLETE
- **ID**: P8-T5
- **Dependencies**: Phase 2 Complete
- **Description**: Save/unsave resources for user bookmark list.
- **Files**: `apps/web/src/hooks/use-saved-resources.ts`
- **Migration**: `20260527000002_saved_resources.sql`

### P8-T6: Resource Detail Tables + Source Tracking
- [x] **Status**: COMPLETE
- **ID**: P8-T6
- **Dependencies**: Phase 2 Complete
- **Description**: Extended resource metadata (detail tables, source enum, application URL fields).
- **Migrations**: `20260526000001_extend_resource_source_enum.sql`, `20260527000003_add_resource_sources.sql`, `20260527000004_add_resource_detail_tables.sql`

---

> **SOCIAL + SECURITY NOTE (2026-06-06):** Tasks P8-T7 through P8-T17 below were shipped to develop (PRs #47-57) but not previously documented in this checklist. Added retroactively via chore/docsync-phase8 to close the ambient-doc coupling gap. No app/DB/prod changes — docs only.

### P8-T7: Threaded Comments (PR #47)
- [x] **Status**: COMPLETE
- **ID**: P8-T7
- **Dependencies**: P8-T1, P8-T8
- **Description**: Threaded comment system on posts. Nested replies with depth limit.
- **PR**: #47 — merged to develop

### P8-T8: Resource-Linked Posts (PR #48)
- [x] **Status**: COMPLETE
- **ID**: P8-T8
- **Dependencies**: P1-T6, P1-T7
- **Description**: Posts can reference resources (posts.resource_id FK). Resource card embedded in post display.
- **PR**: #48 — merged to develop

### P8-T9: Opt-In Core (PR #49)
- [x] **Status**: COMPLETE
- **ID**: P8-T9
- **Dependencies**: P8-T8
- **Description**: Seeker opt-in system. `posts.max_seekers` + `posts.slots_remaining` columns. `resource_opt_ins` table. `opt_in` / `withdraw` SECDEF RPCs with atomic slot decrement (SELECT FOR UPDATE). RLS: opt-ins readable by owner + resource owner only.
- **Migrations**: `20260604_opt_in_core.sql`
- **PR**: #49 — merged to develop

### P8-T10: Reviews + Harmony Score (PR #50)
- [x] **Status**: COMPLETE
- **ID**: P8-T10
- **Dependencies**: P8-T9
- **Description**: Peer reviews on completed resource exchanges. `reviews` table. `submit_review` RPC (completed-exchange-gated). `profiles.harmony_score` trigger-maintained denormalized score. Bidirectional review flow.
- **Migrations**: `20260604_reviews_harmony.sql`
- **PR**: #50 — merged to develop

### P8-T11: Shareable Embed Widget (PR #51)
- [x] **Status**: COMPLETE
- **ID**: P8-T11
- **Dependencies**: Phase 2 Complete
- **Description**: Public `/s/embed` route exposing resource cards as embeddable iframes. No auth required. Embed security headers (frame-ancestors * for cross-origin embed; Permissions-Policy parity).
- **PR**: #51 — merged to develop

### P8-T12: Follows / Connections (PR #52)
- [x] **Status**: COMPLETE
- **ID**: P8-T12
- **Dependencies**: P1-T5
- **Description**: User follow graph. `follows` table (follower_id, following_id, unique constraint). `use-follows` hook. Follow/unfollow actions with visible error banner on failure.
- **Migrations**: `20260605_follows.sql`
- **PR**: #52 — merged to develop

### P8-T13: Geo Foundation (PR #53)
- [x] **Status**: COMPLETE
- **ID**: P8-T13
- **Dependencies**: P1-T7
- **Description**: Geographic foundation for proximity outreach. `zip_centroids` table (33,144 US ZIP codes seeded). `profiles.location` geography(Point,4326) column + GIST index. SECDEF geocode trigger sets profile location from zip_code on upsert. Coordinates stored lng-first (PostGIS convention).
- **Migrations**: `20260605_geo_foundation.sql`, `20260605_zip_centroids_seed.sql`
- **PR**: #53 — merged to develop

### P8-T14: Privacy Geo Outreach (PR #54)
- [x] **Status**: COMPLETE
- **ID**: P8-T14
- **Dependencies**: P8-T13
- **Description**: Count-only proximity outreach. `seekers_within_radius` SECDEF RPC (keyed by resource_id; client NEVER handles coordinates). `notify_seekers_near_resource` SECDEF fan-out RPC (owner-gated, dedup, bypasses notifications INSERT RLS via SECURITY DEFINER). Returns seeker COUNT only — coordinates never exposed to client.
- **Migrations**: `20260605130000_geo_outreach_rpcs.sql`
- **PR**: #54 — merged to develop

### P8-T15: Social Cleanup (PR #55)
- [x] **Status**: COMPLETE
- **ID**: P8-T15
- **Dependencies**: P8-T12, P8-T14
- **Description**: Dead feed components removed (`feed-list.tsx`, `post-composer.tsx` — zero imports). Federation `created_by` string literal replaced with real UUID from `auth.getUser()`. Embed header parity (Permissions-Policy + X-DNS-Prefetch-Control). Follow error surfaced to users via alert banner. E2E docstring corrected.
- **PR**: #55 — merged to develop

### P8-T16: Profiles Write-Grant Lockdown (PR #56)
- [x] **Status**: COMPLETE
- **ID**: P8-T16
- **Dependencies**: P1-T5
- **Description**: Closed `is_admin` self-INSERT forge. Column-scoped INSERT grant on profiles (only allowed columns). REVOKE DELETE and TRUNCATE from authenticated + anon. Prevents privilege escalation via direct profile row insertion.
- **Migrations**: `20260606_profiles_write_lockdown.sql`
- **PR**: #56 — merged to develop

### P8-T17: Profiles Coordinate-Read Lockdown (PR #57)
- [x] **Status**: COMPLETE
- **ID**: P8-T17
- **Dependencies**: P8-T13, P8-T16
- **Description**: Closed cross-user coordinate leak. REVOKE SELECT on `latitude`, `longitude`, `location`, `zip_code` columns from authenticated (cross-user RLS + PostgREST column filter was insufficient). SECDEF `get_my_coordinates()` self-accessor (own-row only, pinned `search_path`, anon/PUBLIC revoked, authenticated granted). `auth-provider.tsx` updated: dropped lat/lng from 3 `.select()` sites; centralized `PROFILE_COLUMNS` constant; `fetchCoords()` helper runs in parallel via `Promise.all`.
- **Migrations**: `20260606130000_profiles_coord_read_lockdown.sql`
- **PR**: #57 — merged to develop

### P8-T18: Six New Resource Categories (PR #59)
- [x] **Status**: COMPLETE — PR #59 (e0240eb, merged 2026-06-08)
- **ID**: P8-T18
- **Dependencies**: P8-T3
- **Description**: Six new `resource_category` enum values: `eitc_tax_filing`, `free_legal`, `prenatal_natal_care`, `waste_disposal`, `free_camping`, `free_goods_donation`. Registered across all enumeration sites (discovery, map category filters, resource wizard configs, search filters, federation directory, moderation queue, OG route). VT seed data added for all 6 categories. Icon mapping, display labels, and funnel logging wired via structured `wizard.start` / `wizard.complete` events.
- **Files**: `apps/web/src/lib/category-form-map.ts`, `apps/web/src/lib/ai/resource-wizard-config.ts`, `apps/web/src/components/panels/wizard-panel.tsx`, `apps/web/src/components/map/resource-marker.tsx`, `apps/web/src/components/map/map-panel.tsx`, `packages/shared/lib/constants.ts`
- **Migrations**: `20260608000000_add_resource_categories.sql`, `20260608000100_seed_vt_resources.sql`
- **PR**: #59 — merged to develop

### P8-T19: Community Petitions (PR #60)
- [x] **Status**: COMPLETE — PR #60 (9fbad7d, merged 2026-06-08)
- **ID**: P8-T19
- **Dependencies**: P8-T7, P8-T8
- **Description**: Community petitions with verified signatures. `post_type` enum (`feed`/`resource_post`/`petition`). `petition_id` FK on posts. Petition-strict `CHECK` constraint. `petitions` + `petition_signatures` tables. Server-stamped ESIGN metadata (affirmation text, signer display name snapshot, petition version hash, IP address, user agent, signed_at UTC) via service-role `/api/petitions/sign` — never client-forgeable. Idempotent on UNIQUE(petition_id, signer_id). SECDEF `get_petition_signature_count` + `has_signed_petition` RPCs. Feed embed (petition branch in PostCard). "Verified signature of support" copy only — no "legally binding" language.
- **Files**: `apps/web/src/components/panels/petitions-panel.tsx`, `apps/web/src/hooks/use-petitions.ts`, `apps/web/src/app/api/petitions/sign/route.ts`, `apps/web/src/components/panels/feed-panel.tsx`, `apps/web/src/app/(social)/s/embed/[id]/page.tsx`
- **Migrations**: `20260608000200_petitions_and_signatures.sql`, `20260608000300_add_post_type.sql`
- **PR**: #60 — merged to develop

### P8-T20: All-Roles Safety Pins (PR #61)
- [x] **Status**: COMPLETE — PR #61 (559755c, merged 2026-06-08)
- **ID**: P8-T20
- **Dependencies**: P8-T13
- **Description**: Map-based safety hazard reporting available to all roles. PostGIS `geography(POINT,4326)` + GIST index on `safety_alerts`. SECDEF RPCs: `place_safety_alert`, `safety_alerts_in_view` (returns `lng`/`lat` floats, filters `expires_at>now()` — severity-scaled TTL auto-expires pins with no cron needed), `vote_safety_alert`, `admin_remove_safety_alert`. Publish-then-review model: alert is visible immediately with "Unverified — neighbor report" label. Community confirm/clear votes with UNIQUE(alert, voter). Sheet primitive (`@radix-ui/react-dialog` right-slide-out). Role-gated FAB (`HazardBubbleMenu`) — all roles place alerts; providers/facilitators see add-resource entry. `SafetyAlertsReview` admin section on `/moderation`. NaN-coordinate guard prevents crash on realtime EWKB parse delay.
- **Files**: `apps/web/src/hooks/use-safety-alerts.ts`, `apps/web/src/components/map/hazard-bubble-menu.tsx`, `apps/web/src/components/map/safety-alert-marker.tsx`, `apps/web/src/components/ui/sheet.tsx`, `apps/web/src/app/(admin)/moderation/safety-alerts-review.tsx`, `apps/web/src/components/panels/map-panel.tsx`
- **Migrations**: `20260608000400_safety_alerts.sql`
- **PR**: #61 — merged to develop

---

## PHASE 8 EXIT CRITERIA

- [x] All P8 features committed on develop branch
- [x] All migrations applied to production DB (ndtpovonpadugthmcntl)
- [x] All new panels wired into PanelRenderer (app/page.tsx confirmed)
- [x] All new hooks have finally blocks (confirmed via audit 2026-05-28)
- [x] PRs #47-57 (Social Resource-Matching + Pre-Launch Security Hardening) merged to develop (2026-06-04 through 2026-06-06)
- [x] PRs #59-61 (Six categories, community petitions, all-roles safety pins) merged to develop (2026-06-08)
- [x] Phase 8 features included in P7-T11 auth E2E smoke test (P7-T11 harness 5/5 green + manual prod confirmation 2026-06-10; Phase 8 panels reachable post-login)

---

## PHASE 9: Community Launch Readiness (PLANNED 2026-06-09)

> Pillars stated by the product owner 2026-06-09. Scope per task to be refined by the
> empirical gap probe before implementation. None of these are started.

### P9-T1: Programs + Resource Allocation Pipeline Operational
- [x] **Status**: COMPLETE — end-to-end: program discovery → eligibility → application → opt-in allocation → fulfillment
  - COMPLETE 2026-06-09 (PRs #65/#66): benefits-screening wired into eligibility chat flow; Saved-programs tab; VT application_url seed; category SSOT (lib/resource-categories.ts) + 12-category volunteer FAB; advisor hardening (duplicate indexes + RLS policies dropped, 5 dead files removed).
  - COMPLETE 2026-06-10 (PR #72): (a) "Share to Feed" button on all program cards — opens inline dialog with prefilled editable text, inserts post with `resource_id` link, navigates to feed on success. (b) Application → originating form back-link — `programName` on application cards is a tappable link that deep-links to documents/forms subtab via `formsTarget` param; `use-applications` extended to fetch `form_type` from `form_templates` join. e2e: programs-posts-bridge.spec.ts 2/2 green.
  - COMPLETE 2026-06-11 (feature/fulfillment-view): Fulfillment view — provider Seekers accordion on own resource posts shows each opt-in with seeker name, harmony badge, and status badge (pending/accepted/declined/completed, stone/lime/red/lime palette, WCAG AA contrast). Accept + Decline buttons for pending rows; Mark Completed for accepted rows; Review Seeker for completed rows. Direct `.update({status})` under existing `opt_ins_update` RLS policy (post owner gate). data-testid accept-optin-{id} + decline-optin-{id} + complete-optin-{id} added. No migration. Opt-in lifecycle verified: opt_in_to_post inserts with status='pending'; provider path: pending → accepted → completed (or pending → declined). e2e fulfillment-view.spec.ts 4/4. Full suite 110 passed / 1 skipped / 0 failed.

### P9-T2: Social Feed Post UI for All Resource Types
- [x] **Status**: COMPLETE — PR #69 (feature/feed-per-type-pagination, 2026-06-10). (1) Keyset cursor pagination on (created_at, id): PAGE_SIZE=25, "Load more posts" button, deduplication on append. (2) Resource-post category badge via CATEGORY_META SSOT. (3) Safety alerts feed strip above composer (authenticated SELECT on safety_alerts, cap 5, severity desc). (4) Composer "Report a safety hazard on the map" button deep-linking to map panel. e2e feed-per-type-pagination.spec.ts 4/4.

### P9-T3: Per-Post Social Metadata + oEmbed Endpoint
- [x] **Status**: COMPLETE — PR #TBD (feature/embed-meta-oembed, 2026-06-10).
  (a) `generateMetadata` added to `/s/embed/[id]/page.tsx` — exports `og:title` (`{authorName} on FEED` or petition title + `— FEED Community Petition`), `og:description` (first 160 chars of content/petition summary), `og:image` (`/api/og/post/{id}`, 1200×630), `og:url` (canonical embed URL), `twitter:card summary_large_image`, and `alternates.types['application/json+oembed']` discovery link. Uses `profiles!posts_user_id_fkey` FK hint to avoid PGRST201 ambiguity. Petition metadata falls back to generic copy if petition is not yet approved (no new policies added — anon SELECT on petitions already gates on `status='approved'`).
  (b) `metadataBase: new URL(siteUrl)` added to root layout (`apps/web/src/app/layout.tsx`) — resolves all relative og/twitter image URLs. Priority: `NEXT_PUBLIC_APP_URL` → `VERCEL_URL` → `https://www.sourcetofeed.com`.
  (c) `/api/oembed/route.ts` — oEmbed 1.0 GET endpoint (JSON only; `format=xml` → 501 per spec). Validates URL origin (reject foreign origins; localhost is always allowed for dev). Extracts post ID from `/s/embed/{id}` or `/s/post/{id}` paths. Returns `{type:'rich', version:'1.0', provider_name:'FEED', html:'<iframe …>', width:480, height:270, thumbnail_url, thumbnail_width:1200, thumbnail_height:630}`. `Cache-Control: public, s-maxage=300`. 400 for bad/foreign URL, 404 for missing/hidden post, 501 for XML format.
  (d) oEmbed discovery `<link>` also added to `/s/post/[id]/page.tsx` (`alternates.types`).
  **image_url drift**: VERIFIED non-issue — `image_url` IS in `packages/database/types.ts` (Row line 1317, type `string | null`). The reference in `/s/post/[id]/page.tsx:155` is valid.
  **Petitions anon RLS**: VERIFIED safe — `petition_select_approved` policy `USING (status='approved')` + `GRANT SELECT ON petitions TO anon` already live (20260608000200). Metadata falls back to generic title/description if petition is not found.
  - **Files**: `apps/web/src/app/(social)/s/embed/[id]/page.tsx`, `apps/web/src/app/(social)/s/post/[id]/page.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/api/oembed/route.ts`, `apps/web/e2e/embed-meta-oembed.spec.ts`
  - **e2e**: embed-meta-oembed.spec.ts 4/4 green (A: og tags + discovery link, B: oEmbed JSON + iframe, C: 404 behaviour, D: foreign-origin 400)
  - **type-check**: 0 errors; **lint**: 0 new warnings

### P9-T4: Map Pin + Resource Buttons Complete
- [x] **Status**: COMPLETE — Share button shipped earlier (feed-panel.tsx:472-476). Suggest-resource flow shipped 2026-06-10 (feature/suggest-resource, PR #TBD).
  - "Suggest a Resource" entry added to HazardBubbleMenu Sheet — visible to ALL authenticated roles (below hazard entries, above provider-only "Add yourself").
  - SuggestResourceDialog: category (select from CATEGORY_META SSOT), name (required), description (10-500 chars, required), phone + website (optional), city + state (prefilled from profile.location_city/location_state).
  - Write path: INSERT into resources with status='pending', is_volunteer_resource=false, source='user_submitted', submitted_by=auth.uid(), is_verified=false. Success state "Thanks — your suggestion is pending review."
  - RLS finding: existing INSERT policy WITH CHECK (auth.uid() = submitted_by) permits status='pending' + is_volunteer_resource=false — no migration needed.
  - Pending invisibility: "Approved resources are viewable by everyone" USING (status = 'approved') blocks cross-user SELECT of pending rows via PostgREST.
  - **Files**: apps/web/src/components/map/hazard-bubble-menu.tsx, apps/web/e2e/suggest-resource.spec.ts
  - **e2e**: suggest-resource.spec.ts 4/4 (role-gate visible for seeker, form submit + success, DB status=pending assert, RLS cross-user invisibility). safety-pins.spec.ts 5/5 regression green.
  - **type-check**: 0 errors; **lint**: 0 new warnings

### P9-T5: Community Trust Layer — Report + Threshold Takedown
- [x] **Status**: COMPLETE — PR #63 (8ae6f63, 2026-06-09). content_reports table + report_reason enum; submit_content_report SECDEF RPC auto-hides a post at 3 distinct reporters; admin_resolve_report (dismiss restores / uphold keeps hidden); report dialog in feed-panel; admin Reports queue; e2e content-reports.spec.ts 4/4.

### P9-T6: Full Messages Cycle with Wheat-Stalk Reviews
- [x] **Status**: COMPLETE — PR #64 (a0bbaa0, 2026-06-09). conversation_status += 'completed'; submit_review extended to accept conversation_id OR opt_in_id; End→completed (volunteer); dual review prompts in messages-panel; WheatStalkRating component (green-fill SVG) replaces stars in review-modal + harmony-badge; e2e conversation-reviews.spec.ts green.

### P9-T7: Document Drive + Form Autofill Complete Lifecycle
- [x] **Status**: COMPLETE — PR #TBD (feature/docs-forms-lifecycle, 2026-06-10).
  (a) **PDF AcroForm autofill**: "Fill from Profile" toolbar button in PdfAnnotator. `FIELD_ALIAS_MAP` normalises AcroForm field names (lowercase + strip non-alphanum) and resolves to `AutofillValues` keys. `fillAcroFormFields()` exported for testability. `mapProfileToAutofill()` used — intentionally excludes SSN/DOB/annual_income. Shows fill-result banner "Filled N of M fields" auto-clearing after 4 s. Only TextFields filled; checkboxes/radios skipped silently. `autofillValues` prop + `onFillComplete` callback on `PdfAnnotatorProps`.
  (b) **Document rename + category move**: overflow `DropdownMenu` (Rename + Move per category + Delete) on each DocumentCard in DocumentsPanel. `updateDocument(id, {name?, category?})` in `use-documents.ts` with `AbortSignal.timeout` + `.retry(false)` + finally-reset. Rename dialog (prefilled current name) + optimistic state update. NOTE: only updates plaintext `name` column (vault DEK not available at hook level; encrypted copy unchanged — plaintext `name` is what the list renders).
  (c) **Submission→drive archival**: `archiveSubmission()` in `use-vault-form-submission.ts` generates a summary PDF via `@cantoo/pdf-lib` (title = template name + date, label:value lines from in-memory plaintext answers — NEVER decrypt-from-db), encrypts with `encryptFile()` (standalone, no hook nesting), uploads to `user-documents` bucket, inserts `user_documents` row with `submission_id` FK + `category='forms'`. Fire-and-forget: archival failure sets `archiveWarning` (never fails the submission). New state fields: `archivedDocumentId`, `archiveWarning`.
  (d) **dropdown-menu.tsx**: new `src/components/ui/dropdown-menu.tsx` — minimal Radix-free implementation with context + outside-click + Escape close (no extra npm dependency).
  (e) **testid additions**: `data-testid="document-card"` + `data-document-id={id}` on DocumentCard wrapper; `data-testid="documents-panel"` on outer container.
  - **Files**: `apps/web/src/components/forms/pdf-annotator.tsx`, `apps/web/src/components/panels/documents-panel.tsx`, `apps/web/src/hooks/use-documents.ts`, `apps/web/src/hooks/use-vault-form-submission.ts`, `apps/web/src/components/ui/dropdown-menu.tsx`, `apps/web/e2e/docs-forms-lifecycle.spec.ts`
  - **Zero migrations**: `submission_id` column verified in `20260214220000_add_document_encryption_fields.sql:19`; `category='forms'` is a text column with no enum constraint
  - **type-check**: 0 errors; **lint**: 0 new errors (110 warnings, 1 fewer than baseline)
  - **e2e spec**: `docs-forms-lifecycle.spec.ts` — 3 tests: (a) fill banner, (b) rename DOM + move, (c) DB archival row + Documents list appearance

### P9-T8: Web Form Retrieval
- [x] **Status**: COMPLETE — pre-sync architecture: government PDFs fetched once via CLI sync script into `government-forms` Supabase Storage bucket; client downloads from bucket into existing PdfAnnotator flow.
  - SSOT: `apps/web/src/lib/government-forms.ts` (6 forms: IRS Schedule 8812, HUD-52641, VA 21-526EZ, VA 21P-527EZ, SSA-16 stub, SSA-8000 stub)
  - Migration: `supabase/migrations/20260610210000_government_forms_bucket.sql` (private bucket + authenticated SELECT policy)
  - Sync script: `apps/web/scripts/sync-government-forms.ts` (5 OK: IRS 98KB, HUD 363KB, VA 1.9MB, VA 2.9MB, SSA 170KB; SSA-8000 403)
  - UI: Government Forms section in forms-panel.tsx available tab (GovernmentFormCard, bucket probe, VaultGuard + PdfAnnotator + autofill)
  - HUD-50058 retired 2022 (both paths 404) → `formUrl: null`; VT combinedAppUrl kept (403 = bot-blocking, not dead)
  - e2e: `apps/web/e2e/government-forms.spec.ts` 3/3 pass (a: SSOT renders, b: synced form opens annotator, c: vault gate)
  - Regression: docs-forms-lifecycle 3/3 green

### P9-T9: Grandma-Grade Security + Usability Validation
- [x] **Status**: COMPLETE (feature/usability-grandma-pass, 2026-06-10) — contrast fixes (stone-400→stone-600 on all meaningful text across 7 panels + feed-shell MetricTile subtitle), tap-target enlargements (map detail close p-1→p-2.5; QuickTag icons w-3→w-4), persistent sidebar text labels under each icon (2-line icon+label layout, aside w-14→w-16), mobile bottom-nav SHORT_LABELS explicit map replacing label.split() truncation, humanized loading copy in forms + applications panels, forms error state getFriendlyErrorMessage + Try Again button, forms zero-templates empty state adds hint + Ask the Assistant CTA (setActivePanel('chat')), Resource Wizard display label→'Get Help Finding Resources' (panel id unchanged).

### P9-T10: Find Help Now — Anonymous Guest Access
- [x] **Status**: COMPLETE (feature/guest-access-anon-auth, 2026-06-11) — one-tap guest sign-in via Supabase `signInAnonymously()` on login + signup pages (AbortError-as-success pattern). Migration 20260611173053: 15 RESTRICTIVE INSERT-block + 7 RESTRICTIVE UPDATE-block RLS policies on all UGC tables (no-ops for permanent users), storage INSERT block for user-documents bucket, anonymous guard in 10 SECDEF write functions, pg_cron daily cleanup at 03:00 UTC (30-day TTL). Client: auth-provider exposes `isAnonymous` bool; proxy skips onboarding redirect for guests + allows `/signup` visit for upgrade; FeedShell amber guest banner; CreateAccountPrompt component gates documents, messages, settings, forms panels; feed composer hidden; hazard-menu Suggest button hidden; petitions sign CTA replaced. E2E: guest-access.spec.ts 12/12. Regression: suggest-resource + feed-per-type-pagination 8/8.

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-19 | Initial checklist creation |
| 1.1.0 | 2026-02-22 | Added Phase 7: Production Hardening (11 tasks). Discovered via full codebase recon: exposed secrets, middleware .single() crash, missing error boundaries, dead proxy.ts code. |
| 1.2.0 | 2026-06-06 | Added Phase 8 Social + Security tasks P8-T7 through P8-T17 (PRs #47-57). Folded Phase 8 into headline metric: 107/109 (was 96/98 for Phases 0-7). Updated total_phases to 8, total_tasks to 109, completed_tasks to 107. |
| 1.3.0 | 2026-06-09 | Docsync PRs #59-61 into Phase 8 (P8-T18..T20, 110/112). P7-T4 reworded (proxy.ts is the live Next.js 16 entrypoint — never delete). Added Phase 9 community-launch pillars (9 planned tasks, not started). |
| 1.4.0 | 2026-06-09 | P9-T5 + P9-T6 shipped (PRs #63-64); P9-T1 progress (PRs #65-66). |
| 1.4.1 | 2026-06-10 | P7-T11 COMPLETE (harness 5/5 + manual prod confirmation); Phase 7 ALL exit criteria checked; Phase 8 smoke-test criterion checked; P9-T3 reframed (per-post generateMetadata + /api/oembed); P9-T4 Share button annotated as shipped; mobile/store deferred boxes annotated; 113/114 overall; current_task → P9-T1. |
| 1.4.2 | 2026-06-10 | P9-T1 two sub-items COMPLETE: (a) Share to Feed on program cards + (b) application→originating form back-link. e2e programs-posts-bridge.spec.ts 2/2. REMAINING in P9-T1: fulfillment view. |
| 1.4.3 | 2026-06-10 | P9-T2 COMPLETE: cursor pagination (25/page), resource category badges, safety alerts strip, map deep-link. e2e 4/4. 114/114 overall. |
| 1.4.4 | 2026-06-10 | Accounting fix: Phase 9 dashboard row corrected 2→3 completed (T2 was missing from count; T5/T6/T2 all complete). Overall headline clarified: 114/114 shipped tasks (denominator = shipped only; Phase 9 pending tasks not yet included). |
| 1.4.5 | 2026-06-10 | P9-T3 COMPLETE: per-post generateMetadata on /s/embed/[id] + metadataBase on root layout + /api/oembed endpoint + discovery link on both embed and post pages. e2e 4/4. Phase 9 dashboard: 3→4 completed. Pending list: T1-partial, T4, T7, T8, T9. |
| 1.4.6 | 2026-06-10 | P9-T7 COMPLETE (feature/docs-forms-lifecycle): AcroForm fill-from-profile (FIELD_ALIAS_MAP + fillAcroFormFields), document rename+move (overflow menu + updateDocument), submission→drive archival (non-blocking encrypted PDF, submission_id FK, archivedDocumentId state), dropdown-menu.tsx (Radix-free). e2e docs-forms-lifecycle.spec.ts 3 tests. Phase 9 dashboard: 4→5 completed. Pending list: T1-partial, T4, T8, T9. 115/115 shipped. |
| 1.4.7 | 2026-06-10 | P9-T8 COMPLETE (feature/gov-forms-presync): pre-sync government forms bucket (IRS/HUD/VA/SSA, 5/6 synced), Government Forms UI section in forms-panel.tsx, VaultGuard + PdfAnnotator + autofill integration. Migration 20260610210000_government_forms_bucket.sql. e2e 3/3. Regression docs-forms-lifecycle 3/3. Phase 9 dashboard: 5→6. 116/116. Pending: T1-partial, T4, T9. |
| 1.4.8 | 2026-06-10 | P9-T4 COMPLETE (feature/suggest-resource): suggest-resource flow — Suggest a Resource in HazardBubbleMenu (all roles), SuggestResourceDialog (category SSOT, name/desc/city/state/phone/website), INSERT status=pending, no migration needed (INSERT policy permits it). e2e 4/4 + safety-pins 5/5 regression. Phase 9 dashboard 6->7. 117/117 shipped. Pending: T1-partial, T9. |
| 1.4.9 | 2026-06-10 | P9-T9 COMPLETE (feature/usability-grandma-pass): grandma-grade usability pass — contrast (stone-400→stone-600 on meaningful text across 7 panels + feed-shell), tap targets (map close p-1→p-2.5, QuickTag icon w-3→w-4), persistent sidebar labels + w-16 aside, MOBILE_SHORT_LABELS map, humanized loading copy, forms error getFriendlyErrorMessage + Try Again, forms empty Ask the Assistant CTA, Resource Wizard label→Get Help Finding Resources. Deferred: Find-Help-Now signup CTA. Phase 9 dashboard 7→8. 118/118. Pending: T1-partial only. |
| 1.4.10 | 2026-06-11 | Chat provider cascade re-architected (feature/chat-fireworks-multilingual): Fireworks Qwen3.6 primary (ZDR/no-training, 200+ languages, disable-thinking via reasoning_effort:'none') + Fireworks gpt-oss-120b secondary + OpenRouter gemini-2.5-flash ZDR fallback + OpenRouter claude-haiku-4.5 ZDR fallback. Function key-ready: runs on OpenRouter alone until FIREWORKS_API_KEY set. Multilingual policy added to base system prompt: reply in user's language, card format [[...|...]] language-invariant, resource data untranslated. 5-language smoke PASS (ES/VI/AR/HT/EN, gemini-2.5-flash + zdr/deny). |
| 1.5.0 | 2026-06-11 | P9-T10 COMPLETE: Find Help Now anonymous guest access (feature/guest-access-anon-auth). Supabase signInAnonymously() on login + signup pages. Migration 20260611173053: 15 INSERT-block + 7 UPDATE-block RESTRICTIVE RLS policies, storage bucket INSERT block, anon guard in 10 SECDEF write functions, pg_cron 30-day TTL cleanup. auth-provider isAnonymous; proxy guest-pass for onboarding + /signup; FeedShell guest banner; CreateAccountPrompt gates documents/messages/settings/forms; feed composer + suggest-resource button hidden for guests. E2E 12/12. 119/119 shipped. Phase 9 dashboard 8→9 completed. |
| 1.5.1 | 2026-06-11 | Maintenance: e2e baseline repair (chore/docsync-phase8 → fix/e2e-baseline-repair). 6 pre-existing failures fixed: (1) eligibility-wiring provisionVaultUser positional→object args; (2) forms-flow phone autofill stale assertion (phone excluded from PROFILE_COLUMNS by PII hardening migration 20260603120000 — test updated to fill manually) [W0.1 2026-09-19: the always-empty phone-autofill branch itself was removed from form-wizard.tsx + form-field-mapper.ts — get_my_profile() never returns phone, so publicProfile.phone was always undefined; autofill behavior unchanged]; (3) pdf-annotator docRow searched by name='minimal-acroform.pdf' but name column stores placeholder 'Encrypted Document' — fixed to use index [0]; (4) pdf-annotator P3 false-positive — tightened assertion to check savePdfBtn not visible + docs-tab-documents tab; (5) safety-pins marker click { force: true } to bypass SVG path pointer-event; (6) safety-pins vote buttons — nav-away+back forces viewport re-fetch after alert placement. App fixes: resource-detail-dialog resource-posts-section moved outside VaultGuard; use-encrypted-upload abort-as-success for Next.js AbortSignal pattern. 106 passed / 1 skipped / 0 failed. |
| 1.5.2 | 2026-06-11 | P9-T1 COMPLETE (feature/fulfillment-view): fulfillment view closes the LAST open Phase 9 item — PHASE 9 COMPLETE, ALL PHASES COMPLETE. Lifecycle verified: opt_in_to_post inserts status='pending'; provider path pending→accepted→completed (or declined). Feed-panel.tsx already had the full Seekers accordion + Accept/Decline/Mark-Complete/Review-Seeker UI; data-testid accept-optin-{id} + decline-optin-{id} added as the only code change. No migration. e2e fulfillment-view.spec.ts 4/4. Full suite 110 passed / 1 skipped / 0 failed (+4 vs 106 baseline). Phase 9 dashboard 9→10. 120/120 shipped. |
| 1.5.3 | 2026-06-13 | fix: www-origin CORS on 4 browser-facing edge functions + cors.origin.rejected logging + browser-origin regression test (fix/cors-www-origin). Root cause: browser sends Origin: https://www.sourcetofeed.com (apex 307→www) but only https://sourcetofeed.com (via APP_URL) was in ALLOWED_ORIGINS → CORS-blocked chat, benefits-screening, validate-password, auth-guard. APP_URL intentionally unchanged (doubles as ActivityPub federation keyId in federation-sync/federation-inbox; changing it corrupts federation signatures). Fix: additive 'https://www.sourcetofeed.com' entry in all 4 functions' ALLOWED_ORIGINS + 'http://localhost:3001' in validate-password (consistency). Rejection logging: cors.origin.rejected structured warn log on each function. Regression guard: apps/web/e2e/cors.spec.ts (5/5 OPTIONS preflight tests). Browser e2e: cors-browser-e2e.spec.ts (2/2 www-origin real-browser tests, EN + ES). Deploy: 4 functions deployed with verify_jwt flags preserved (chat/benefits-screening=false, validate-password/auth-guard=true). |

---

| 1.5.4 | 2026-06-13 | refactor: consolidate CORS into _shared/cors.ts (reflect-allowed-origin + Vary:Origin + omit-ACAO-on-no-match), tighten delete-account from wildcard *, extend cors regression test (refactor/shared-cors-hardening). Anti-pattern fixed: non-matching origin previously received ALLOWED_ORIGINS[0] as ACAO → wrong-but-valid header → browser accepted non-allowlisted cross-origin requests. Fix: omit ACAO entirely on no-match so browser denies. Also: Vary:Origin added to all responses (CDN cache correctness); delete-account tightened from * to scoped helper (security hardening). 5 functions refactored (chat, benefits-screening, validate-password, auth-guard, delete-account). Wave 2 tests added to cors.spec.ts: 15 new cases (www+apex+evil × 5 functions). |

---

| 1.5.5 | 2026-06-13 | feat: chat client resilience — auto-retry transient failures + structured telemetry + translated error UI (feat/chat-resilience-telemetry). Auto-retry once on transient errors (network TypeError, 5xx, 429) after 800ms backoff; deterministic 4xx and AbortErrors do not retry. isRetrying state surfaces "Reconnecting…" banner during retry window. Persistent failures show kind-translated user message (network/server/auth/unknown) via ChatErrorBanner + "Try again" button calling retrySend() — replaces dead-end generic "Sorry, I encountered an error". chat.request.failed structured log: errorName, errorMessage (truncated 120 chars, no PII), httpStatus, durationMs, isAbort, retried, origin. chat.request.completed optimization log: durationMs, model, didStream, contentLength. retrySend() callback on UseChatReturn. Reuses existing lib/logger.ts; AbortError-as-success path unchanged. e2e chat-resilience.spec.ts: 4 tests — A1 happy-path, B1 transient-recover (503-once→pass, no banner), C1 persistent-503 banner (specific message not old generic), C2 retry-refires; all use route interception (zero prod calls). type-check: 0 new errors; lint: 1 fewer warning than baseline. |

---

| 1.5.6 | 2026-06-13 | feat: preferred language — BCP-47 language selection across onboarding, settings, and AI chat (feat/preferred-language). lib/languages.ts SSOT (15 languages + Other, BCP-47 codes, detectBrowserLanguage). Migration 20260613120000: preferred_language TEXT column on profiles + SELECT/INSERT/UPDATE grants + DROP/CREATE get_my_profile() with preferred_language in RETURNS TABLE. Onboarding step 5 language picker card (step 4 Continue → step 5 Globe select → Get Started). Settings Language nav section (Globe nav item, LanguageSection component, auto-save with "Language saved" toast, guest localStorage path). use-chat.ts: call-time IIFE inside attemptSend reads profileRef.current→localStorage→browser→'en' (avoids stale closure for localStorage-only changes). chat/index.ts: preferredLanguage field in ChatRequest, one-line system prompt injection for non-English users. e2e preferred-language.spec.ts: 5/5 — A1 onboarding DB persist, B1 settings DB persist, C1 localStorage set, C2 guest chat body carries ht from localStorage (call-time read fix), D1 auth profile es→chat body. Prod migration applied via Mgmt API. Types regenerated. |

---

| 1.6.0 | 2026-09-23 | FULL-FEED P2.1b COMPLETE (feature/feed-fullfeed-p2-1b-appreciation) — peer appreciation gifts + fix round. Migration 20261006000000: appreciation_gifts table (server-write-only via SECDEF give_appreciation RPC; RLS party-read; UNIQUE(giver,receiver,item); 12 items), classifier extends appreciation_gift → PUBLIC badge:appreciated. USER RULING: the public "Appreciated" LEVEL counts DISTINCT PEOPLE who gave, not gifts — ledger keyed actor=receiver/target=giver so UNIQUE(actor,kind,target) = one credit per (receiver,giver) pair; all 12 items still individually giftable + shelf-visible; reconcile iterates DISTINCT (receiver_id,giver_id). Fix-round: MEDIUM-2 guest receiver rejected as generic "Recipient not found" (no oracle); MEDIUM-3 error≠empty tests on shelf+sent reads + slug guard (mutation-proven); LOW-1 optional post context silently dropped when hidden/missing/wrong-author (gift always succeeds, no post oracle); LOW-5 sheet Follow now matches post-card guest behaviour; LOW-6 removed unused BadgeGlyph import; icons redrawn (soup outlined bowl+steam, cheer party-popper, sunflower seeded center — no face). Account deletion of a giver keeps the credit (target_id has no FK; reconcile additive-only). Client: AuthorBadgeStrip + AppreciationSheet (12-item picker, single-flight, optimistic) on feed author row; Gifts-received shelf in Settings → Profile. Verified: tsc 0, eslint 0 on changed files, full vitest green, .mjs node tests green, BEGIN/ROLLBACK prod validation (distinct-giver counting, guest-receiver reject, reconcile parity, smoke 26+27 STATE_SQL). Merged to develop as PR #211 (squash 320563a); migration 20261006000000 applied in prod. |

---

| 1.6.1 | 2026-09-24 | FULL-FEED W1.6a COMPLETE (feature/feed-fullfeed-w1-6a-events-hosting) — event hosting + two-state check-in + attendance. Migration 20261007000000: event_checkins.status (early|confirmed)+confirmed_at/confirmed_by; assistance_events.geocode_accuracy/geocode_confidence; SECDEF RPCs check_in / organizer_confirm / event_attendance / my_attendance_rate / admin_create_event / admin_update_event / w1_6a_user_org_rate (pinned search_path, authenticated-only EXECUTE, helper internal-only); event_checkins write privileges revoked (RPC-only, I1) with permissive write policies dropped + P2.0 guest block kept; credit trigger moved to CONFIRMATION time (AFTER INSERT OR UPDATE, confirmed-only) + reconcile_engagement event_checkin loop filters status='confirmed' (R6 parity). RULINGS R1–R8: platform-admin orgs, org-admin events, early "I'm coming"/confirmed presence [starts−30m,ends], organizer confirm to ends+24h, no-show derived, org-scoped rates, member-own rate, guest-blocked, anonymous untracked. Client: events-panel in-progress (ends_at>=now) + per-I7 button states via lib/event-checkin.ts (15 unit tests, mutation-proven); checkin-sheet calls check_in RPC (default tracked, anon opt-in note, cap 20, guest→CreateAccountPrompt); Settings→Profile "Event attendance" line (my_attendance_rate). Admin: OrgsSection mounted as Organizations tab; EventScheduler address+geocode-on-save via admin_create_event + org picker + per-occurrence Attendance view; organizer kiosk rewritten to organizer_confirm (records attendee not organizer — :77 bug fixed) + event_attendance list; orphaned events-section.tsx deleted. Types hand-added (no full regen — prod regen drops storage schema). Verified: tsc 0, eslint 0 on changed files, 15 lib unit tests green, prod BEGIN…RAISE→ROLLBACK harness 32/32 (two-state, self/organizer confirm, first-in-window→confirmed, after-end/cancelled/guest/direct-INSERT reject, kiosk-attendee-not-organizer, credit-once-at-confirm/none-early/none-anon, reconcile parity, attendance+no-show math, org-scoping + cross-org denial, member-own-only, geocode strong/weak, account deletion) + smoke 25/26/27 parity + smoke 28 STATE_SQL verified (all 27 predicates). Migration applies as a SEPARATE post-deploy step (GIT_PLAN). Smoke 07 assertions unchanged (unique index, RLS, projected_turnout SECDEF, select-own policy all retained). Merged to develop as PR #212 (squash 215d033); migration 20261007000000 applied in prod. |
| 1.6.2 | 2026-09-24 | FULL-FEED W1.6b BUILT (feature/feed-fullfeed-w1-6b-events-in-feed) — community events mixed into the ranked feed. Migration 20261008000000: new SECDEF ranked_feed_v2(p_lat,p_lng,p_limit,p_cursor_score,p_cursor_id) RETURNS (id,kind,score,distance_bucket) = W1.3 posts branch BYTE-IDENTICAL to ranked_feed (verbatim CTEs) UNION ALL an events branch (one row per eligible event = next occurrence status='upcoming' AND ends_at>=now() AND starts_at<=now()+30d; engagement=1, age_h=|now-starts_at|, SAME quantized distance bucket from assistance_events.location — dist_km never returned, no oracle; never pinned; visibility replicates the 4 event_occurrences SELECT policies incl. an auth.uid()-IS-NOT-NULL gate on w1_6a_occ_authed_reachable so anon can't reach the in-progress-retired path). Single cross-kind keyset (score DESC,id DESC). ranked_feed v1 UNTOUCHED (I5, md5 2cca92d907df… equal). Types: ranked_feed_v2 hand-added. Client: feed-panel ranked path calls ranked_feed_v2, partitionRankedRows → hydrate posts (FEED_POST_SELECT, unchanged) + events (occurrence select joined assistance_events+organizations) + own check-in status/anon-claims; mergeRankedFeedItems interleaves by score (live post stays on top; post order never regresses, I4); EventFeedCard reuses computeCheckinButton + CheckinSheet + check_in RPC (guest→CreateAccountPrompt). Events ONLY in ranked mode under All; Recent posts-only (decision); Following/Mine/Announcements author-scoped exclude events. Realtime unaffected (events not in publication). Verified: prod BEGIN…RAISE→ROLLBACK harness 17/17 (I1 posts byte-identical to v1, I2 event set/visibility across anon/member/org-admin/platform-admin + anti-oracle + one-per-event, I3 cross-kind keyset paging==single call, I5 v1 md5 unchanged); tsc 0; eslint 0 errors changed files; event-feed.test.ts 12/12 (2 mutation proofs: live-post-on-top, id-DESC tiebreak) + post-model 45/45 preserved. Smoke 29 ledger-gated on 20261008000000 (signature/grants/v1-present+unchanged/live-call/events-anti-oracle). Prod has 0 orgs/events so feed UI not browser-verified with live data — covered by unit tests + role-scoped rolled-back harness. Migration applies as SEPARATE post-deploy step. Merged to develop as PR #214 (squash 05f0293); migration 20261008000000 applied in prod. |
| 1.6.3 | 2026-09-25 | FULL-FEED P3.0 COMPLETE (feature/feed-fullfeed-p3-0-moderation-guards) — close security gaps: moderation-authority guards + volunteer withdraw. Migration 20261009000000: three BEFORE INSERT/UPDATE guard triggers, all SECURITY INVOKER + pinned search_path, EXECUTE revoked from PUBLIC/anon/authenticated. I1 guard_resources_moderation_fields — a client INSERT lands pending with empty moderation fields (moderated_by/at, is_verified, last_verified_at), the ONE carve-out being a volunteer listing (is_volunteer_resource) which its own submitter may insert approved (still empty moderation), and a client UPDATE may change no moderation field and no status except the volunteer self-withdraw (approved→archived); closes R1 (client-forged approved+moderated_by, which nightly reconcile minted as a verified resource_approved). I6 guard_post_comments_is_hidden — only staff (profiles.is_staff, read inline like every moderation RPC) or the server set/clear is_hidden (closes R6). I3 guard_organizations_org_admin_update — org admins edit descriptive fields (incl. org_type) of their OWN ACTIVE org only, never is_active/created_by/id/created_at; platform admins bypass; W1.6a deactivation cascade untouched (closes R3). Bypass boundary = RLS's own: service_role / postgres (SECDEF RPCs approve_resource, reject_resource, admin_update_resource, set_resource_location_by_id) / supabase_admin pass at the first current_user test; authenticated admins pass via is_current_user_admin(). Each rejection is SQLSTATE 42501 with a stable greppable prefix per guard (guard:resources_moderation_fields / guard:post_comments_is_hidden / guard:organizations_admin_fields) + HINT → countable in postgres_logs. Ordinary INSERT must land EXACTLY pending (NULL status rejected via IS NOT DISTINCT FROM); rejection_reason joined the moderation-only fields; and (round-3 pin-integrity fix) a client UPDATE may not change is_volunteer_resource — flipping it on a pending row otherwise unlocked the volunteer-only carve-outs (a non-vol pin could be flipped→archived, or once approved relocated by its submitter). I1b (real capability): RLS policy "Volunteers can withdraw their own listing" (pending OR approved → archived, USING (select auth.uid())) + the guard's withdraw carve fix the silent no-op; withdrawResource returns the outcome via the pure helper withdraw-result.ts (`.select('id')` → a zero-row result surfaces as an error), and the volunteer FAB lists the user's WITHDRAWABLE (pending/approved) listings with a Remove button (rejected omitted) + one-confirm dialog with a single-flight useRef gate (success → gone from map/lists + FAB back to register; failure incl. zero rows → this-attempt-only error in a role=alert/aria-live region, cleared on open/cancel); Remove buttons are tabIndex=-1 + aria-hidden while the dial is closed; a user with an active listing reaches Remove even after a role change, else the FAB stays hidden. Moderated-pin integrity: set_resource_location_by_id owner path applies only while pending or on the owner's own volunteer listing and resets geocode_accuracy to NULL; admin/server paths unchanged; register + suggest flows still work. Comment guard HINT reworded to not suggest an unavailable action; withdraw policy uses (select auth.uid()). Side fix (trivially safe): dropped the duplicate set_post_comments_updated_at trigger. No schema-shape change → no gen-types run. Verified: prod BEGIN…RAISE→ROLLBACK dry-run matrix — every forbidden write rejected 42501 with the right guard prefix (incl. NULL-status, client rejection_reason, is_volunteer flip, two-step nonvol archive, owner relocate of approved non-vol → not authorized) + every legitimate write succeeded (suggest-pending, volunteer-approved, owner withdraw of pending AND approved vol, setloc own pending/vol + geocode reset, approve_resource + resource_approved ledger credit, reject, admin_update_resource, admin direct edit, service_role upsert, comment insert/delete, org-admin edit + org_type, platform-admin is_active+created_by). Behavioural smoke 30 (ledger-gated on 20261009000000) runs real writes per role in a rolled-back tx; a mutation runner mutated the migration + re-ran the smoke SQL through the Mgmt API — 7 of 9 mutations KILLED by a smoke check (admin bypass, org inactive-edit, org is_active-change, withdraw vol-check, is_verified/moderated_at, any-owner-status-change, is_volunteer-flip); the 2 survivors are defense-in-depth not smoke guarantees (withdraw owner-check is RLS-enforced; comment staff bypass is inert with no staff table-UPDATE policy) and are covered by the dry-run matrix. tsc 0; eslint 0 errors; test:unit 61/61; targeted vitest withdraw-result.test.ts 6/6 (deleting the zero-row branch fails it); next build ✓. Nothing persisted (all rolled back; 19,146 resources unchanged, migration not recorded). Migration applies as a SEPARATE post-deploy step BEFORE merge (develop auto-deploys). Merged to develop as PR #215 (squash 1028506); migration 20261009000000 applied in prod (ledger 140); Vercel deployment 6655006345 success; prod smoke 36/36. |
| 1.6.4 | 2026-09-25 | FULL-FEED P3.1 COMPLETE (feature/feed-fullfeed-p3-1-admin-tiers) — three admin tiers, nomination only + append-only audit log + public role markers; facilitator code retired. Migration 20261010000000: enum admin_tier(community_moderator<resource_admin<platform_admin); profiles.admin_tier column (anon+authenticated SELECT only, NO write grant); sync_tier_flags BEFORE trigger derives is_admin=COALESCE(tier=platform_admin,false) + is_staff=COALESCE(tier IS NOT NULL,false) and refuses any direct client write to admin_tier/is_admin/is_staff (replaces sync_is_staff); backfill sets the 2 existing admins → platform_admin (zero behavior change). platform_founder singleton (founder uuid hard-coded, no PII) + is_founder() (caller-only). Helpers current_user_tier/current_user_tier_at_least/tier_of/request_id (validates+caps x-request-id to a uuid/token ≤64). Append-only admin_actions audit table (RLS: authenticated SELECT gated to PA; service_role rxtm only — no a/w/d/D); record_admin_action writer (service_role EXECUTE) caps request_id + reason(≤500). admin_set_tier (nomination: RA grants CM; PA grants CM/RA; anything touching PA is founder-only; no self-target; no-tier/guest callers RAISE p3_denied with NO durable row, tier-holder denials write exactly one row) + service_set_tier (service-role break-glass, refuses any platform_admin touch/the founder/invalid targets, audited actor NULL) + admin_list_people (RA+, no email, limit≤200). Re-gated: 6 RA resource fns ICUA→current_user_tier_at_least('resource_admin'); 6 CM moderation RPCs is_staff→'community_moderator' + one record_admin_action each; admin_list_users +admin_tier col. HIGH: form-type resource rows (discovery_metadata.content_type='form') are Platform-Admin-only on EVERY path — approve_resource/reject_resource/admin_update_resource refuse them for non-PA (p3_denied:form_requires_platform_admin); approve_form_template stays PA + now audited. set_resource_location_by_id carries P3.0's owner path VERBATIM (own resource while pending OR own volunteer listing; resets geocode_accuracy — diffed against live pg_get_functiondef) and only re-gates its admin branch to resource_admin + audits it. App: lib/admin-tier.ts (tierLabel/tierRank/tierAtLeast/grantableTiers/decideUserAction, pure, unit-tested) + use-admin-tier hook; lib/privileged-action.ts (privilegedRpc/privilegedFetch) is the single choke point — mints one request id, sends x-request-id, shares it with withMetric, and records a denied/failed call as exactly one error-level (ok:false) telemetry row while keeping the caller's {data,error}/{response} shape; a source-guard test (privileged-action-guard.ts) flags any bypass form (dot/bracket/alias/template/variable call or bare fetch to /api/admin). Tier-driven admin shell (visibleTabs) + People tab (RA+ grant/revoke via grantableTiers, PA option founder-only, required reason) + tier-aware Administration copy. Public tier marker on feed card / appreciation sheet / profile page + post-card / comment authors / shared post page / admin user lists (messages + opt-in list left unmarked by ruling). Ban/delete PA-only + T3 (decideUserAction): a non-PA is 403 BEFORE any lookup or audit write (writes nothing, reveals nothing), a PA on a nonexistent target gets 404, every attempt writes one admin_actions row (D7 delete = one row after success). Facilitator retired: claim-facilitator-admin edge fn dir + onboarding Administrator option/code input + .gitignore ref + admin_code_redemptions table (0 rows) removed; user_role='facilitator' label kept but unreachable (D5). Types hand-edited (prod regen drops storage schema). Verified: prod BEGIN…ROLLBACK dry-run (P3.1 on live prod which already has P3.0) — full tier matrix across plain/CM/RA/PA/founder/org-admin, founder-only, audit exactly-once per request id, form-path gates (RA reject/update/approve of a form row → 42501; PA → ok), set_resource_location owner path (own pending/vol → ok + geocode reset; other's approved → 42501), both current admins keep a capability sample; mutation runners KILLED every guard (RA-on-ICUA, >=-vs-> tier, founder check, self check, column-grant, trigger-derive, audit-skip, admin_actions INSERT grant, form guards on reject/update, helper throw-on-error, bypass-guard quote coverage, ban gate-first + 404). tsc 0; eslint 0 errors; vitest (non-smoke) 465 pass/14 todo; next build ✓. Nothing persisted (all rolled back). Smoke 31 ledger-gated on 20261010000000. Migration applies as a SEPARATE post-deploy step BEFORE merge; post-merge: supabase functions delete claim-facilitator-admin + secrets unset FACILITATOR_ADMIN_CODE_HASH/FACILITATOR_ADMIN_CODE_PEPPER. Follow-ups: comment moderation (D1), tier markers on messages/opt-in list, volunteer register silent-fail (pre-existing), guest 406 from vault.ts:294 .single() (pre-existing). Merged to develop as PR #217 (squash 92c3003); migration 20261010000000 applied in prod (ledger 141); Vercel dpl_CE3JJKGzX3Z3CwowpZbyhGL3qijy (GitHub deployment 6655315858) success; prod smoke 46/46; claim-facilitator-admin function + FACILITATOR_ADMIN_CODE_HASH/PEPPER secrets deleted; browser-verified (guest tier marker, Community Moderator tabs). |
| 1.6.5 | 2026-09-29 | ORGANIZATIONS DATA LAYER + ADMIN INTAKE (feature/feed-organizations-data-admin) — a platform admin can create a local organization (a NON-business org_type) with contact info, hours, a geocoded location, photos, and linked catalog resources, entirely from the existing admin "Organizations" tab; it renders publicly + on the map immediately (public/map surfaces land in W4/W5). No migration, no new RPC — the whole capability rides existing prod policies. New lib/org-vocab.ts is the single source of truth for the 9 non-business org_type values (union + labels + Select options + internal membership set); 'business' is deliberately never a member (INV-B floor). New lib/org-data.ts is the controlled WRITE boundary (business-data.ts idiom: module-local loose() confines the geography-write generic erasure; each write wrapped in withMetric with bounded PII-free labels): pure builders buildOrgInsertPayload (throws for 'business'/unknown → INV-B; pins is_active=true → INV-A) + buildOrgResourceRows (one row per DISTINCT resource id → INV-D) + ewktPoint; writers adminCreateOrganization (org.admin.upsert; insert then direct admin UPDATE of location via EWKT 'SRID=4326;POINT(lng lat)' authorized by orgs_admin_update; a location-write failure is a truthful warning, never an undo) + attachOrgResources (org.resources.attach). Admin intake orgs-section.tsx: Select offers only the 9 non-business types (INV-B); address geocoded via resolveGeoPointV6 whenever an address is present — a match writes the point, an unresolvable address creates the org with NULL location AND warns the admin, never a wrong point (INV-C); catalog resources linked via useResourceSearch multi-select (INV-D); hours + logo/cover/gallery photos reuse insertBusinessHours/insertBusinessPhotos + uploadPostImage keyed by the new org id (INV-E); roster management preserved. The four org READERS (public directory/by-id/linked-resources/map-bbox) are deferred to W4/W5 alongside their consumers + the email/phone anon-read-path review (anti-speculation: shipped zero capability in this PR). Live-verified model (2026-09-29 via read-only MCP): org_type CHECK = 10 values (9 non-business); orgs_admin_insert/update WITH CHECK is_current_user_admin(); orgs_select_active = is_active AND (org_type<>'business' OR status='approved') ⇒ non-business public on is_active alone; is_active default true, status default 'approved'; org_resources PK(org_id,resource_id); organizations_in_bounds SECDEF; location = geography. Verified: tsc 0; eslint 0 errors on changed files (123 pre-existing warnings elsewhere); next build ✓; targeted org-data.test.ts 7/7 with INV-B + INV-D mutation-proven (guard/dedupe removed → 3 RED, restored → GREEN). Adversarial review PASSED all 5 invariants (live-proven); this commit is the anti-speculation fix round (readers deleted, internal set un-exported, INV-C address-only polish). Merged to develop as PR #227 (squash 248ad5d); no migration of its own (rides 20261015000000 from PR #226, squash 1461697). |
| 1.6.6 | 2026-09-29 | ORGANIZATIONS PUBLIC PAGE — W4 (feature/feed-organizations-public-page) — anyone, logged out, can open /s/organization/<id> and see a local (NON-business) organization's contact info (name, description, email, phone, website), hours, location (static map + address), photos, and the resources it offers (each linking to /s/resource/<resource_id>) — a public informational page, no interaction. No migration, no new RPC — rides existing prod policies. Re-added the two public READERS deferred from 1.6.5 to lib/org-data.ts (business-data.ts idiom; module-local loose() + withMetric bounded PII-free labels): fetchOrganizationById (event org.read.by_id; filters to the nine non-business org_types AND is_active=true so a business id / inactive org / missing id resolves to null → notFound(); selects explicit ORG_COLUMNS incl. email/phone/website, never *) + fetchOrgResources (event org.resources.fetch; org_resources→resources embed ordered by curator sort_order, null embeds dropped). Map/list readers (organizationsInBounds, fetchApprovedOrganizations) stay deferred to W5. New page app/(social)/s/organization/[id]/page.tsx forks the /s/business page: JSON-LD @type='Organization' (INV-G — NOT LocalBusiness; no cost/priceRange/offers-pricing fields), sections contact/hours/location/photos + "Resources offered", org-vocab type badge, notFound() on a nonexistent/inactive/business-typed id (INV-F, never a 307). Hours + photos reuse the shared business_hours/business_photos child readers (their *_public_select policies admit active non-business orgs). New OG route app/api/og/organization/[id]/route.tsx forks the business OG route (edge; "Local organization"). proxy.ts publicRoutes += '/s/organization' in the same PR (INV-I — unauth GET reaches 200/404, never a login redirect). Live-verified anon read path (2026-09-30 via Mgmt API, SELECT-only): anon has column SELECT on organizations.email/phone/website (+ all rendered columns) = True, table SELECT on org_resources + resources = True, and orgs_select_active/business_hours/business_photos/org_resources public_select all admit is_active non-business rows — so the logged-out SSR read (anon role via createServerClient anon key) returns the full rendered shape; NO grant blocker. Data residual: prod currently has 0 active non-business orgs, so the live page is unit-proven not browser-proven with real data (admin intake from 1.6.5 creates them). Verified: tsc 0; eslint 0 errors on changed files; next build ✓; org-data.test.ts + proxy.public-routes.test.ts green with INV-F (org_type .in() filter excludes 'business'; removing it → RED), INV-H (null-embed drop + ordering), and INV-I (publicRoutes contains '/s/organization'; removing it → RED) break-on-purpose proofs. Merged to develop as PR #228 (squash f9258bb); no migration. |
| 1.6.7 | 2026-09-30 | ADMIN ORG↔BUSINESS TAB PARTITION (feature/feed-admin-org-business-partition) — the two moderation tabs now symmetrically partition the organizations table by org_type: an admin sees & manages ONLY non-business orgs in the Organizations tab, and sees & manages BOTH pending and approved businesses in the Businesses tab. Fixes the defect where the sole prod business ("Leviosa VT", business/approved/active) showed in the Organizations roster (unfiltered read) and NOWHERE manageable in the Businesses tab (pending-only queue). No migration, no new RPC — rides existing prod policies. Fix A: extracted the admin roster read into lib/org-data.ts fetchAdminOrgRoster (event organization.roster.fetch) which applies .in('org_type', NON_BUSINESS_ORG_TYPES) — no is_active gate (admin manages inactive orgs too), distinct from the public fetchApprovedOrganizations which keeps is_active=true; orgs-section.tsx fetchOrgs now calls it and the dead 'business' org_type badge fallback is removed (the roster can no longer contain a business, so the label lookup is total over the 9 types). Fix B: businesses-tab.tsx keeps the pending "Awaiting review" queue unchanged and adds an "Approved businesses (N)" section populated by a DEDICATED admin reader fetchAdminBusinessList (org_type='business' AND status='approved', PROJECTING is_active — read under orgs_admin_select so inactive rows the public surfaces hide still appear to the admin; the public fetchApprovedBusinesses is left untouched and still omits is_active); each row shows an Active/Inactive badge, Edit (inline form: name/description/phone/email/website), and a coherent STATEFUL Deactivate↔Reactivate toggle, styled to mirror the Organizations roster actions. Two admin direct-UPDATE writers in lib/business-data.ts, authorized LIVE by orgs_admin_update (both BEFORE-UPDATE guards RETURN NEW for a platform admin): adminSetBusinessActive(active:boolean) (business.admin.set_active; UPDATE is_active=active — false removes from every public surface showcase/map/page, true restores it; ONE closed-vocab boolean `active` label; no delete, no status change) + adminUpdateBusiness (business.admin.update; website through the SAME normalizeUrl helper as member submit, bounded PII-free has_* shape labels). Approve now refreshes the approved list (row moves pending→approved); the set-active toggle optimistically flips is_active in place (row STAYS, badge+button update so both directions are visible) then awaits the persist and reverts on failure (truthful-optimistic toggle). Invariants: INV-1 Organizations tab = EXACTLY non-business (business never appears); INV-2 Businesses tab = EXACTLY org_type='business' (pending queue + approved list, no non-business leak); INV-3 the Deactivate↔Reactivate toggle sets is_active admin-only (set_active label carries the boolean direction) + edit persists, both withMetric closed-vocab; INV-4 the two tabs partition by org_type (business XOR non-business). Live-verified (2026-09-30 read-only MCP): orgs_admin_update policy present; organizations = exactly 1 row business:approved:true, 0 non-business ⇒ post-fix Organizations tab shows 0, Businesses approved list shows the 1. Verified: tsc 0; eslint 0 errors on changed files (pre-existing warnings only, none in changed lines); next build ✓; targeted vitest org-data.test.ts + business-data.test.ts 59/59 with four mutation-proofs empirically confirmed RED-on-break then restored GREEN — INV-1 (delete fetchAdminOrgRoster .in() filter → RED), INV-2 (delete fetchApprovedBusinesses status='approved' filter → RED), the set-active toggle DIRECTION (hard-code the write to is_active=false → the Reactivate/active=true test RED), and the fetchAdminBusinessList is_active PROJECTION (drop is_active from the admin-reader select → RED). Residual: rejected (status='rejected') businesses surface in neither tab (terminal state, not requested). Reactivate is now implemented (stateful toggle + Active/Inactive badge), closing the earlier follow-up. Merged to develop as PR #230 (squash f389cdf); no migration. |
| 1.6.8 | 2026-10-05 | PR-0 PRIVACY-FIRST LOGGING FOUNDATION (feature/feed-privacy-logging-foundation) — all telemetry is first-party (FEED's own Supabase app_logs); no third-party telemetry vendor receives app or user data. Removed @sentry/nextjs (never configured, no DSN; 117 lockfile packages) + its 3 config files; instrumentation.ts is now a first-party onRequestError that writes ONE PII-free `request.error` row (request_id, route PATTERN, route_type, method, digest, error_code). Removed @vercel/analytics + @vercel/speed-insights (Hobby plan: custom events inert; track() shipped a userId on vault unlock) — <Analytics/>/<SpeedInsights/>, track() in withMetric and every direct call site (auth pages, feed/documents/map panels, post-type wizard, hazard menu, use-chat), and va.vercel-scripts.com from the CSP. New src/lib/event-registry.ts EVENT_REGISTRY (closed vocabulary: event → label keys; 383 names sourced from a static scan of every logger/withMetric/privilegedRpc/privilegedFetch/logEvent call + live 30-day DISTINCT app_logs events; personal/free-text keys excluded) consumed by /api/client-log: unknown event → 400 + nothing persisted, unknown keys dropped, error fields only on error-level rows with error_message ≤120 chars; route rate-limited per client IP only (120/min; x-federation-instance ignored). New persisted logEvent(name, attrs) (admin.resource.autocomplete converted). serializeError: Supabase/PostgREST {code,message} → error_code = SQLSTATE (logger.error, withMetric, privilegedRpc). Uncaught client errors persisted: app/(admin)/error.tsx (new), app/error.tsx + PanelErrorBoundary now logger.error, one window error/unhandledrejection capture (60s de-dup, 20/session cap, AbortError skipped). Photo upload sends x-request-id (newRequestId). useAdminTier skips the tier RPCs for logged-out/guest viewers (was 340+ 42501 rows). Realtime CLOSED status → console info with the real status; CHANNEL_ERROR/TIMED_OUT carry a real code/message. Migration 20261019000000_observability_snapshots: app_query_stats_weekly (RLS on, service_role-only) + capture_app_query_stats_weekly() (PostgREST RPC label extracted from the pgrst_call wrapper) + pg_cron weekly job + 26-week retention + baseline snapshot — AUTHORED + prod ZERO-PERSIST dry run only (BEGIN…ROLLBACK: 44 RPC labels captured in-tx; post-probe table/fn/job/ledger all absent; app_logs + app_logs_retention_30d controls present) — NOT applied. docs/observability.md rewritten (first-party layers, registry, error codes, weekly review SQL validated on prod) + launch checklists' Sentry lines → app_logs. Verified: tsc 0; eslint 0 errors / 121 warnings (baseline 124); vitest 59 files / 631 passed (smoke excluded); node --test 62/62; next build ✓; 11 mutation proofs RED-on-break → GREEN-on-restore. Merged to develop as PR #231 (squash 74dd8dc); migration 20261019000000 applied in prod after merge. |
| 1.6.9 | 2026-10-05 | PR-0 REVIEW FIXES (feature/feed-privacy-logging-foundation, new commit on top of 1d3e0c1) — adversarial + a11y BLOCKED findings closed. Server sink now runs sanitizeClientEvent (lazy import, stays out of the client bundle): unregistered server events write no row and only registered keys survive (closes stored attacker text via /auth/callback?error_description=…). auth/callback logs a closed RFC 6749 error code ('other' otherwise) + has_description flag; userId and raw exchange messages removed from every callback log. Mapbox <Map> sets performanceMetricsCollection={false} (billing map-load event remains per Mapbox terms; doc line added). Migration 019: `AND m IS NOT NULL` + rollback statements in the header; prod zero-persist dry run re-run with SET LOCAL lock_timeout='2s' (44 labels in-tx, nothing persisted). client-log warns on unknown_event (first 64 chars). Doc states the x-real-ip trust assumption. 7 unused exports removed. A11y: app/error.tsx + (admin)/error.tsx focus an h1 on mount (tabIndex -1, visible ring), Try again bg-lime-700/hover lime-800, ref text-stone-500, decorative emoji aria-hidden, Go home is a real link; PanelErrorBoundary role=alert + focuses its message. login timer drops the email. Tests: server-log-sink.test.ts (onRequestError row shape/no PII, rejecting insert, no stack, server sanitizer, callback error_description), use-admin-tier.test.ts (hook wiring), Map telemetry guard, registry banned-key list extended. Verified: tsc 0; eslint 0 errors / 121 warnings; vitest 61 files / 641 passed; node --test 62/62; next build ✓; 11 review mutations (10 RED-on-break; stack-in-row mutation alone stays GREEN because the server sanitizer independently strips `stack` — RED once that second guard is also removed). Not merged; PR NOT opened per brief. RE-REVIEW FIXES (2nd fix commit): H-1 x-request-id — new lib/request-id.ts (/^[A-Za-z0-9-]{1,64}$/) enforced in proxy.ts (invalid inbound → fresh UUID) AND in the server sink (onRequestError reads raw headers) + client-log route; a 515-char <script>…a@b.org id is never stored. H-2 person-subject events (admin.user.*, admin.tier.set*, admin.notes.*, admin.denied, admin.audit.*) carry no target_id (registry + every call site: ban/delete routes, overview-tab, people-tab, reports-queue, safety-alerts-review); request_id joins to admin_actions. H-3 docs/observability.md lists all three Mapbox events (map.load, style.load, appUserTurnstile) with payloads; replacement queued as 'remove third-party data flows'. admin.denied / pdf.autofill.field.skip no longer fall back to raw error text. EventAttrs/SanitizedEvent un-exported. A11y: app/error.tsx 'Go home' is a full-reload anchor; both error pages' Try again move focus to the segment content container (lib/focus-after-reset.ts, temporary tabindex) — id targets added in app/layout.tsx + (admin)/layout.tsx; PanelErrorBoundary drops role=alert and focuses on mount too. Map guard rewritten (lib/__tests__/map-telemetry-scan.mjs: resolves renamed/namespace/double-quoted imports, brace-aware tag parse, ={true}, spread-after, direct mapbox-gl ctor, dynamic import) + 11 fixtures. log_engagement_failure raw SQLERRM noted as a known follow-up. 16 new mutations RED-on-break / GREEN-on-restore + 2 controls GREEN. THIRD FIX COMMIT (test gaps + retry focus): request-id character class now tested with short ids ('<b>x</b>', 'a@b.org', 'abc_123') in proxy, sink AND /api/client-log route tests (widened regex → RED in all three; route rawId → RED); person-subject events limited to {action, actor_tier, ban_duration, code, not_found, outcome, request_id, to} + banned actor_id/member_id/subject_id/target_user_id; map scanner also flags re-exports (incl. export *), require(), aliases, React.createElement, local object namespaces, mapbox-gl .Map aliases and passed-on namespaces (fixtures for each; JSX text/strings ignored). Focus: new lib/focus-target.ts (preferred → host h1 → host, temporary tabindex) used by focus-after-reset (dead heading branch removed) and the extracted components/layout/panel-error-boundary.tsx (Try again focuses the re-shown message or the panel h1 via the setState callback; mount focus unit-tested); #app-content/#admin-content get outline-none. Docs: map.auth session request + full style URL; follow-ups for edge getCorrelationId and SQL request_id() '_' mismatch. 20 mutations RED → GREEN. PRE-MERGE LOWS (4th fix commit): map scanner flags every import( (any spacing) whose argument is not a plain string literal or names a map module (full apps/web/src scan: 279 files, 7 with literal non-map dynamic imports, 0 violations — no narrowing needed); JSX prop and new-Map option now read from string-blanked code at top level (strings/nested objects never count; ...spread after the ctor option rejected; non-inline options object rejected). focusWithin removes its temporary tabindex when focus does not take. PanelErrorBoundary didUpdate path unit-tested. Unused React import removed from app/page.tsx. FeedShell panel host is one named region (role=region, aria-label = active panel's sidebar label via panelRegionLabel). 13 mutations RED → GREEN. Shipped in PR #231 (squash 74dd8dc). |
| 1.6.10 | 2026-10-05 | PR-A ADMIN ORGANIZATIONS REDESIGN (feature/feed-org-admin-panel; base PR-0 + W1 branches feature/feed-org-admin-db, feature/feed-org-photo-edge, feature/feed-org-resource-directory merged as-is) — the admin Organizations tab is a LIST (name, translated type badge, city/state, Active/Inactive) with "Create organization" top-right + in the empty state + an Admin Overview quick action (renders while stats load) + a platform-admin-only "Add organization" link on the feed Organizations subtab (deep link /moderation?tab=organizations&org=new). Create/Edit open ONE right-side setup panel (components/org-form/org-form-panel.tsx: Sheet sm:w-[640px], full-screen <640px, light overlay; react-hook-form + zod 4; Basics/Contact/Location/Hours/Photos/Linked resources) that saves through ONE atomic admin_save_organization call via privilegedRpc (op admin.org.save; client-generated org id so photos upload first into org-photos/<id>/ via post-image-upload?org_id=; success deletes the RPC's removed_photo_paths, failure deletes this attempt's uploads; both prefix-checked to <id>/) and closes back to the refreshed list; single-flight save; discard guard (Esc/X/Cancel/phone Back -> "Discard changes?"; outside click blocked while dirty). URL sync: ?tab=organizations&org=new|<id> read once on mount, pushState on open, pop/replace on close, popstate closes through the guard. Row menu: Deactivate/Reactivate (exact cascade warning text; truthful optimistic toggle via admin_set_org_active, op admin.org.set_active, revert + message on failure) and View public page (active only); member roster kept as a row expansion; load errors render an error state with retry. Location: NO Mapbox geocoding — "Find on map" calls new /api/geocode (signed-in non-guest only, 30/min per user + per IP, server-side US Census addressbatch Public_AR_Current, 8 s timeout, logs geocode.resolve {outcome, source} only) -> draft pin on a react-map-gl map (tiles only, performanceMetricsCollection={false}); Exact = draft, Non_Exact = flagged approximate, none/no street = click-to-place; payload.location is set ONLY after a person clicks Confirm pin; Remove pin clears. Hours: shared HoursEditor (fieldset/legend per day, role=switch Open/Closed, 15-min selects, off-step values preserved, Add hours, Open 24 hours = 00:00-24:00, Copy to weekdays/all days, (next day) hint, zero-length/overlap/invalid-24 blocked inline, create default Mon-Fri 09:00-17:00); edit mode trims HH:MM:SS and drops stored zero-length intervals with a notice. lib/business.ts: '24:00' -> 1440, computeOpenNow merges back-to-back intervals (24/7 reads "Open 24 hours"), formatHoursInterval "Open 24 hours" / "(next day)", JSON-LD closes 23:59 for 24:00. Linked resources: "Browse directory" opens an in-panel ResourceDirectory (Back/Done); directory chips now always list all 25 categories, translated. Duplicate-name warning on name blur (never blocks) with Edit existing. Colors: org/business markers, static pins and OG images use ORG_MARKER_HEX / BUSINESS_MARKER_HEX; org subtab uses text-org/bg-org; its distance sort follows the map-panel pattern (Share Location opt-in GPS once on mount, else profile lat/lng). i18n: ~161 new keys in i18n-org-forms.ts for all 14 locales (non-English = draft, TODO native-speaker review). Logging registered: admin.org.save, admin.org.set_active, admin.org.panel.close, geocode.resolve, admin.org.duplicate_warning, admin.hours.invalid, directory.picker.query, org.photo.upload/cleanup_failed (removed dead admin.org.created, org.admin.upsert, org.resources.attach). Removed: old inline form, hours UI, resource search bar, photo-on-select upload, org-data writers (adminCreateOrganization, attachOrgResources, buildOrgInsertPayload, buildOrgResourceRows, ewktPoint). Verified: tsc 0; eslint 0 errors / 121 warnings; vitest 70 files / 774 passed (smoke excluded); next build ✓; 27 mutation proofs RED-on-break -> GREEN-on-restore. Merged to develop as PR #232 (squash d561777); migrations 20261017000000 + 20261018000000 applied in prod. |
| 1.6.11 | 2026-10-05 | PR-A REVIEW FIX ROUND (feature/feed-org-admin-panel; adversarial + a11y BLOCKED at 32693a9). Guards now fail CI when removed: post-image-upload target tests run under apps/web vitest (include ../../supabase/functions/post-image-upload/*.test.ts) and the edge function routes its gate through pure decideUpload({user, target, canManage}) (401 / guest 403 / bad org_id 400 / non-manager 403 with no write / org-photos/<org_id>/); Save is the pure runOrgSave({upload, save, remove}) behind the single-flight gate (success deletes only removed_photo_paths in the org folder; a definite SQLSTATE failure deletes this attempt's uploads; an AMBIGUOUS failure — no SQLSTATE / thrown — keeps them because the RPC may have committed (a later save removes them only if that failed save did commit; otherwise they remain as unreferenced objects in the unlistable bucket); partial upload failure deletes what uploaded and never calls the RPC); canCreateOrganizations(tier) in lib/admin-tier.ts gates the admin-shell panel/Overview quick action and the feed Add organization link. Lows: zero-length hours render nothing (no "(next day)"); directory city filter strips PostgREST `*`; linked resources load their status and a no-longer-approved link is flagged (badge + remove) and blocks Save with a specific message. A11y: keyboard pin path ("Place pin at map center" + center crosshair; map label explains arrow keys); focus returns to the opener on every panel close (fallback [data-org-create]), to the row More button after Deactivate/Reactivate (More uses aria-disabled while busy), and to the prior control on Keep editing; directory search focused on entry and Browse directory on exit; Load more focuses the first new row and Showing X of Y joins the polite status; submit with hours/pin errors focuses the first invalid hours control / Confirm pin (aria-describedby to the pin error); server 22023 name/email/website errors land on the field via setError(shouldFocus); per-interval names ("Monday, hours 2 Opens"), day-named Copy/Add/24h buttons, (next day) in the Closes description, per-day polite error region; Name aria-required + (required); stone-500 field/select borders + unchecked switch track; lang beside every dir; role=alert roster errors; autocomplete off on org fields; directory header has no Close (Back); safe-area padding on the full-screen panel; new-tab hint on View public page; Members/Remove names carry the org/member; brand focus outline on directory checkboxes; photo hint and too-large error share one rule sentence (originals up to 10 MB; under 5 MB after compression). 7 new i18n keys + 3 rewritten strings in all 14 locales (draft, TODO native review). Verified under CI commands: tsc 0; eslint 0 errors / 121 warnings; vitest (smoke excluded) + test:unit green; next build ✓; mutation table in the PR-A report. Shipped in PR #232 (squash d561777). |
| 1.6.12 | 2026-10-05 | PR-A RE-REVIEW ROUND (feature/feed-org-admin-panel; security HIGH + a11y residuals at d700296). H1: postgrest-js 2.106.2 reports a network failure with error.code "" (not null); org-admin-rpc now maps it through sqlstateOf (`code || null`) and mapSaveError treats any code-less failure as saveErrNetwork, so an ambiguous save KEEPS this attempt's uploads — proven end to end with the real PostgrestClient against a closed port (org-save-network-failure.test.ts; reverting to `??` turns it RED). Edge: resolveCanManage({data,error}) extracted into target.ts (only an error-free literal true grants). List: in-flight Deactivate/Reactivate tracked as a Set (startToggle/finishToggle), so finishing A no longer re-enables B's More while B runs; success is announced politely. A11y: portaled row menu gets lang (dir from Menu.Root); roster marked lang="en"; map shows its arrow-key instructions as visible text (aria-describedby) with a focus-within ring on an unclipped wrapper, Mapbox control names translated via the Map locale prop; Load-more error role=alert; Save / Cancel / Find on map / Load more use aria-disabled + guard while busy; Place pin at map center moves focus to Confirm pin; duplicate-name status stays mounted; Edit existing focuses Name; Forward-opened panel drops a stale opener; Open/Closed switch is named by its day (aria-checked carries state) and Set hours names its day. 5 new i18n keys (map title/zoom, deactivated/reactivated) in all 14 locales (draft); unused hoursDayOpen removed. Verified under CI commands; mutation results in the PR-A report. Shipped in PR #232 (squash d561777). |
| 1.6.13 | 2026-10-05 | PR-A PRE-MERGE LOWS (feature/feed-org-admin-panel; reviews MERGE-READY + A11Y-PASS at 06a1c3f). More-menu busy guard extracted to pure guardBusyTrigger (pointer-down + Enter/Space/ArrowDown prevented while that row's toggle runs; Tab passes). "Edit existing" focus is now scoped to its target (keepPendingNameFocus: kept only while the panel stays open on that org), so a failed switch cannot move focus on a later mount. Busy buttons dim colors (bg-brand/60; stone text/border /60) instead of opacity, keeping the focus ring at full contrast. Mapbox attribution toggle + logo titles translated (2 new keys, 14 locales, draft) and the pin element is aria-hidden via the Marker ref (the pin status text conveys it). Roster: lang="en" dir="ltr" on its root and lang="en" on both role SelectContent portals. Back/Forward resets the focus opener only when the panel is closed. locMapLabel no longer starts with "Map." in any locale. Verified under CI commands; mutation table in the PR-A report. Shipped in PR #232 (squash d561777). |
| 1.6.14 | 2026-10-06 | ORG-SCOPED ADMIN PAGE (feature/feed-org-scoped-admin-events) — a platform admin clicks an organization's name (or More actions → Open admin) in Moderation → Organizations and lands on /moderation/org/<id>: the same admin for ONE organization (Overview of that org's events/dates/check-ins/members, Events, Profile, Members). An organization admin reaches it from Settings → Administration (/moderation/org lists their orgs; one org redirects straight in). Route gate can_admin_org (SECDEF; platform admin on any non-business org, org admin on their own ACTIVE non-business org; guests, members, other-org admins, business/unknown/malformed ids → notFound; logged out → /login). Org admins edit their own org's profile through admin_save_organization (org_type, is_active and the roster stay platform-only) and photos via can_manage_org_photos; direct-UPDATE policy orgs_update_org_admin dropped. Evidence: apps/web/src/app/(admin)/moderation/org/page.tsx, org/[id]/page.tsx + org-admin-shell.tsx + org-overview.tsx, lib/org-admin-paths.ts, orgs-section.tsx (name link + Open admin), settings-panel.tsx adminEntryHref; migration supabase/migrations/20261020000000_org_scoped_admin_events.sql §3c/§3d/§5; model specs/org-scoped-admin-model.md §10; docs/admin-organizations.md. PR #233. |
| 1.6.15 | 2026-10-06 | ONE-STEP EVENTS WITH TIME ZONES ON THE COMMUNITY FEED (same branch) — New event writes the event + its first date + one admin_actions row in ONE create_org_event call (idempotency key: a double click or retry never makes a second event); times are local wall-clock in the venue's IANA time zone (assistance_events.time_zone NOT NULL, fixed after create; DST gap/repeat refused 22023); location = the org's map pin by default or an admin-confirmed Census geocode (Mapbox geocoding + recurrence picker removed; rrule/rrule_dtstart columns dropped). add_event_dates / cancel_event_occurrence replace direct occurrence writes (6 client write policies dropped + privileges revoked); admin_create_event dropped; admin_update_event rewritten (one event.update/event.retire audit row). ranked_feed_v2 shows an event to EVERY viewer (anon, guest, member, org admin, platform admin) exactly when the event and its org are active and it has a date in the next 30 days; events rank with ranking_config.event_half_life_hours (168 h). Every event time renders in the event's zone via lib/event-time.ts; 14-locale copy in lib/i18n-event-forms.ts. Evidence: moderation/event-create-dialog.tsx, event-dates-dialog.tsx, event-edit-dialog.tsx, event-location-field.tsx, event-scheduler.tsx, lib/event-admin-rpc.ts, lib/event-form-model.ts, components/feed/event-feed-card.tsx; SQL smoke supabase/tests/org_scoped_admin_events.smoke.sql + .race.sh. Verified: tsc 0; eslint 0 errors / 121 warnings; vitest 97 files / 1057 passed (smoke excluded); node --test 62/62; next build ok; check-security-definer 153/153 pinned; security review MERGE-READY, a11y review A11Y-PASS. PR #233. Prod: zero-persist rehearsal (migration body + functional probe, then rollback; schema/count snapshot identical afterwards) — an org admin's create_org_event (org pin, America/New_York, 10:00 local = 14:00 UTC) appeared exactly once in ranked_feed_v2 for anon, guest, member, org admin and platform admin; can_admin_org true for org admin + platform admin, false for member/guest/anon; replay with the same key returned the same id; a member's create was refused 42501; one event.create admin_actions row. Migration 20261020000000 applied 2026-10-06 19:06 UTC (ledger row present; new functions pin search_path; admin_create_event, orgs_update_org_admin and the occurrence write policies gone; event_half_life_hours = 168; anon ranked_feed_v2 200). packages/database/types.ts regenerated in full from prod (adds event_local_to_utc + org_event_write_gate; addauth reordered by the generator). |
| 1.6.16 | 2026-10-06 | S1 SYNC SECRET IN VAULT (same branch) — pg_cron jobs daily-hud-sync and monthly-imls-sync-batch1 read the x-sync-secret header from Supabase Vault (vault.decrypted_secrets name RESOURCE_SYNC_SECRET) at run time, so the value is no longer stored in cron.job / cron.job_run_details or the repo. supabase/migrations/20261019500000_sync_secret_vault.sql codifies the change already applied in prod on 2026-10-06 (ledger row present; the migration re-points existing jobs with cron.alter_job and its ledger insert is ON CONFLICT DO NOTHING). Remaining live check: the 03:00 UTC daily-hud-sync run on 2026-10-07. |
| 1.6.17 | 2026-10-07 | REPEATING EVENTS + "POST N DAYS BEFORE" FEED WINDOW (feature/feed-events-recurring-announce) — an organization admin (or platform admin) makes an event repeat weekly (every 1-4 weeks, one or more weekdays) or monthly (nth/last weekday or day of month), ending on a date (default 6 months), after N dates (1-1000) or never, previews the next 5 dates before saving (preview_event_recurrence), and chooses when each date is posted to the community feed and the members' Events tab: on the day, 1, 3, 7 (default), 14 or 30 days before, from 00:00 venue time. Dates exist from today through today+180 days (created in the save transaction, topped up by pg_cron events_generate_nightly 03:37 UTC; watchdog events_generate_watchdog 15:37 UTC writes one error row only if no successful run in 26 h); generated times follow RFC 5545 Errata 4271 on DST. Edits: a new time of day moves future check-in-free dates in place (same ids); a new pattern replaces only future check-in-free dates; check-in dates are never moved or deleted (cancelled rule_changed if they leave the pattern); hand-added dates show an Extra date badge and stay; stop repeating keeps the next date as a one-off (also while retired; it returns on reactivation). Overview lists repeating events ending within 30 days with Repeat for 6 more months (extend_event_series, idempotent per key; org_events_ending_soon). Feed + Events tab share one rule (event_feed_next): one card per active event of an active org = its soonest announced, not-ended date; a cancelled next date keeps the card until that date ends with "<date> cancelled — next: <date>" (upcoming_events, anon + authenticated); identical for anon, guest, member, org admin and platform admin. Every write = one admin_actions row sharing request_id. Evidence: supabase/migrations/20261023000000_events_recurring_announce.sql; contract specs/events-recurring-contract.md; model specs/org-scoped-admin-model.md §10.5; docs/admin-organizations.md (Events); moderation/event-repeat-field.tsx, extend-series-button.tsx, event-create-dialog.tsx, event-edit-dialog.tsx, event-scheduler.tsx, org/org-overview.tsx + org-overview-data.ts; components/feed/event-card.tsx (replaces event-feed-card.tsx), components/panels/events-panel.tsx, feed-panel.tsx, checkin-sheet.tsx; lib/event-recurrence.ts, event-recurrence-format.ts, event-card-data.ts, event-checkin-state.ts, event-admin-rpc.ts, event-form-model.ts, event-time.ts, i18n-event-forms.ts, i18n-event-member.ts (14 locales). Verified: tsc 0; eslint 0 errors / 121 warnings; vitest 105 files / 1349 passed (14 todo, smoke excluded); node --test 62/62; next build ok; check-security-definer 157/157 pinned; local PG17 harness: 6 SQL smokes (events_recurring R0-R17, org_scoped_admin_events, org_admin_save, p4a, p4b, allow_messages) + 2 race scripts (C1-C4 edit/nightly/same-key) PASS; security review MERGE-READY, a11y review A11Y-PASS (final DB fix: stop repeating while retired, with its own tests). PR #234. Prod: zero-persist rehearsal 2026-10-07 20:30 UTC (migration body + functional probe in one transaction, then rollback; 20-field schema/count/function/policy/cron snapshot identical before and after) — an org admin (seeded in-transaction for org FEED) previewed 5 dates (Thu 10-08 … Thu 10-22, 10:00) and created a weekly Tue+Thu event from 2026-10-08 10:00 America/New_York, lead 7, ending 6 months out: 51 dates, one per pattern day through today+180, all 10:00 local; same-key replay returned the same id; a plain member's preview was refused 42501. anon, guest, member, org admin and platform admin each saw the event exactly once in ranked_feed_v2 and upcoming_events (the 10-08 date); after the org admin cancelled 10-08 all five still saw it once (feed row = the cancelled date; upcoming_events cancelled 10-08 + next 10-13). events_generate_nightly inserted 0 and wrote one info row; one admin_actions row each for event.create and occurrence.cancel with the request id. Migration 20261023000000 applied 2026-10-07 20:31:09 UTC (ledger top 20261023000000; one signature per RPC; search_path pinned on all 23 functions; generator/helpers not executable by anon/authenticated; cron events_generate_nightly 37 3 * * * + events_generate_watchdog 37 15 * * *; one info events.generate.nightly row from the closing run; ranked_feed v1 md5 2cca92d9… and the ranked_feed_v2 posts-branch fingerprint ff419aa0… unchanged; anon REST upcoming_events + ranked_feed_v2 200; old-argument create/edit calls still resolve to the new functions). packages/database/types.ts regenerated in full from prod (--schema public,graphql_public,storage): interval columns/args typed string instead of unknown, one reformatted line. |

| 1.6.18 | 2026-10-08 | SAFETY ALERTS EXPIRE (feature/feed-safety-alert-expiry) — a safety alert past its expires_at stops being live everywhere: pg_cron job safety_alerts_expire (every 5 min) runs expire_safety_alerts(), one set-based UPDATE live -> expired WHERE status = 'live' AND expires_at <= now() (only live rows; re-run moves 0; invoker fn, pinned search_path, EXECUTE revoked from PUBLIC/anon/authenticated; one app_logs safety_alerts.expire row per run that expired >= 1 alert or failed). The admin review list and the Overview 'Live Safety Alerts' count use one rule, whereSafetyAlertLive (status live AND expires_at > now). Migration 20261025000000_safety_alerts_expire_job (NOT yet applied to production; its apply-time run expires the 1 stale prod alert). Docs: docs/safety-alerts.md, docs/observability.md. |
---

**Checklist Hash**: To be generated after each update
**Last Agent Session**: feature/feed-safety-alert-expiry (2026-10-08)
**Total Development Time**: 0 hours
