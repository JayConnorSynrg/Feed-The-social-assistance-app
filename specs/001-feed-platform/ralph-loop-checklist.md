---
feature: "FEED Platform"
version: "1.0.0"
created: "2026-01-19"
last_updated: "2026-01-19"
status: "IN_PROGRESS"
current_phase: 1
current_task: "P1-T23"
total_phases: 6
total_tasks: 87
completed_tasks: 25
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
| 1 | Foundation | 25 | 22 | IN_PROGRESS |
| 2 | Resource Discovery | 15 | 0 | NOT_STARTED |
| 3 | Form System | 16 | 0 | NOT_STARTED |
| 4 | AI Assistant | 11 | 0 | NOT_STARTED |
| 5 | Case Management | 12 | 0 | NOT_STARTED |
| 6 | Polish & Launch | 8 | 0 | NOT_STARTED |

**Overall Progress**: 25 / 87 tasks (29%)

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
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T9
- **Dependencies**: P1-T1
- **Description**: Enable Email, Google, and Apple OAuth
- **Manual Steps**:
  1. Supabase Dashboard > Authentication > Providers
  2. Enable Email (with confirm email)
  3. Enable Google OAuth (requires Google Cloud Console setup)
  4. Enable Apple OAuth (requires Apple Developer setup)
- **Acceptance Criteria**:
  - [ ] Email auth enabled
  - [ ] Google OAuth configured
  - [ ] Apple OAuth configured (optional for MVP)

#### P1-T10: Create Auth Middleware
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T10
- **Dependencies**: P1-T9
- **Description**: Create Next.js middleware for auth protection
- **File**: `apps/web/src/middleware.ts`
- **Acceptance Criteria**:
  - [ ] Middleware protects /dashboard/* routes
  - [ ] Redirects to /login if not authenticated
  - [ ] Passes through public routes

#### P1-T11: Create Login Page
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T11
- **Dependencies**: P1-T9, P1-T3
- **Description**: Build login UI with email and OAuth buttons
- **File**: `apps/web/src/app/(auth)/login/page.tsx`
- **Acceptance Criteria**:
  - [ ] Email/password form
  - [ ] Google sign-in button
  - [ ] Apple sign-in button
  - [ ] Link to signup page
  - [ ] Error handling UI

#### P1-T12: Create Signup Page
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T12
- **Dependencies**: P1-T11
- **Description**: Build signup UI
- **File**: `apps/web/src/app/(auth)/signup/page.tsx`
- **Acceptance Criteria**:
  - [ ] Email/password form with confirmation
  - [ ] OAuth buttons
  - [ ] Terms of service checkbox
  - [ ] Email verification flow

#### P1-T13: Create Auth Hooks
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T13
- **Dependencies**: P1-T10
- **Description**: Create useAuth, useUser, useSession hooks
- **File**: `apps/web/src/hooks/use-auth.ts`
- **Acceptance Criteria**:
  - [ ] useAuth hook returns auth state
  - [ ] useUser hook returns current user
  - [ ] useSession hook manages session
  - [ ] Handles loading and error states

#### P1-T14: Create Auth Context Provider
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T14
- **Dependencies**: P1-T13
- **Description**: Create AuthProvider for app-wide auth state
- **File**: `apps/web/src/providers/auth-provider.tsx`
- **Acceptance Criteria**:
  - [ ] AuthProvider wraps app
  - [ ] Syncs auth state with Supabase
  - [ ] Handles session refresh

### Section 1D: User Profiles

#### P1-T15: Create Profile Form Component
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T15
- **Dependencies**: P1-T5, P1-T13
- **Description**: Build profile edit form with Zod validation
- **File**: `apps/web/src/components/profile/profile-form.tsx`
- **Acceptance Criteria**:
  - [ ] Form with all profile fields
  - [ ] Zod schema validation
  - [ ] Real-time validation feedback
  - [ ] Submit to Supabase

#### P1-T16: Create Avatar Upload Component
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T16
- **Dependencies**: P1-T1, P1-T15
- **Description**: Build avatar upload with Supabase Storage
- **File**: `apps/web/src/components/profile/avatar-upload.tsx`
- **Acceptance Criteria**:
  - [ ] Image picker/dropzone
  - [ ] Preview before upload
  - [ ] Upload to Supabase Storage
  - [ ] Update profile with URL

#### P1-T17: Create Profile Settings Page
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T17
- **Dependencies**: P1-T15, P1-T16
- **Description**: Build settings page combining profile components
- **File**: `apps/web/src/app/(dashboard)/settings/page.tsx`
- **Acceptance Criteria**:
  - [ ] Profile form integrated
  - [ ] Avatar upload integrated
  - [ ] Payment links section
  - [ ] Save/cancel actions

#### P1-T18: Create Public Profile Page
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T18
- **Dependencies**: P1-T5
- **Description**: Build public profile view page
- **File**: `apps/web/src/app/profile/[username]/page.tsx`
- **Acceptance Criteria**:
  - [ ] Display user info
  - [ ] Show payment links
  - [ ] List user's posts
  - [ ] Handle 404 for unknown users

### Section 1E: Feed System

#### P1-T19: Create Post Card Component
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T19
- **Dependencies**: P1-T6, P1-T3
- **Description**: Build post display card
- **File**: `apps/web/src/components/feed/post-card.tsx`
- **Acceptance Criteria**:
  - [ ] Shows author avatar and name
  - [ ] Displays post content
  - [ ] Shows image if present
  - [ ] Timestamp display
  - [ ] Links to author profile

#### P1-T20: Create Post Composer Component
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T20
- **Dependencies**: P1-T6, P1-T13
- **Description**: Build post creation form
- **File**: `apps/web/src/components/feed/post-composer.tsx`
- **Acceptance Criteria**:
  - [ ] Text input for content
  - [ ] Image upload option
  - [ ] Character limit display
  - [ ] Submit action
  - [ ] Loading state

#### P1-T21: Create Feed List Component
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T21
- **Dependencies**: P1-T19
- **Description**: Build infinite scroll feed
- **File**: `apps/web/src/components/feed/feed-list.tsx`
- **Acceptance Criteria**:
  - [ ] Infinite scroll pagination
  - [ ] Loading skeleton
  - [ ] Empty state
  - [ ] Pull to refresh (mobile)

#### P1-T22: Create Feed Page
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T22
- **Dependencies**: P1-T20, P1-T21
- **Description**: Build main feed page
- **File**: `apps/web/src/app/(dashboard)/feed/page.tsx`
- **Acceptance Criteria**:
  - [ ] Post composer at top
  - [ ] Feed list below
  - [ ] Real-time updates

#### P1-T23: Setup Supabase Realtime for Feed
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T23
- **Dependencies**: P1-T21
- **Description**: Enable realtime updates for new posts
- **File**: `apps/web/src/hooks/use-realtime-feed.ts`
- **Acceptance Criteria**:
  - [ ] Subscribe to posts table changes
  - [ ] Add new posts to feed in realtime
  - [ ] Handle post updates
  - [ ] Clean up subscriptions

### Section 1F: Mobile Shell

#### P1-T24: Configure Capacitor Plugins
- [ ] **Status**: NOT_STARTED
- **ID**: P1-T24
- **Dependencies**: P1-T2
- **Description**: Add essential Capacitor plugins
- **Commands**:
  ```bash
  npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
  npm install @capacitor/push-notifications @capacitor/geolocation
  ```
- **Acceptance Criteria**:
  - [ ] Splash screen configured
  - [ ] Status bar plugin added
  - [ ] Keyboard plugin added
  - [ ] Push notifications plugin added
  - [ ] Geolocation plugin added

#### P1-T25: Build and Test Mobile Apps
- [ ] **Status**: NOT_STARTED
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
  - [ ] iOS app runs in simulator
  - [ ] Android app runs in emulator
  - [ ] Auth works on both platforms
  - [ ] Feed displays correctly

---

## PHASE 1 EXIT CRITERIA

Before proceeding to Phase 2, ALL must be true:

- [ ] `npm run build` passes without errors
- [ ] `npm run type-check` has 0 errors
- [ ] Auth flow works (email + Google)
- [ ] Profile CRUD operations work
- [ ] Feed shows posts with images
- [ ] iOS app runs in simulator
- [ ] Android app runs in emulator
- [ ] All P1 tasks marked [x]

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
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T1
- **Dependencies**: P1 Complete
- **Description**: Create Mapbox account and configure API
- **Acceptance Criteria**:
  - [ ] Mapbox account created
  - [ ] API key generated
  - [ ] Key added to environment variables

#### P2-T2: Create Map Component
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T2
- **Dependencies**: P2-T1
- **Description**: Build base map component with Mapbox GL JS
- **File**: `apps/web/src/components/map/map-view.tsx`
- **Acceptance Criteria**:
  - [ ] Map renders with default view
  - [ ] Zoom controls work
  - [ ] Location button shows user position
  - [ ] Responsive sizing

#### P2-T3: Create Resource Markers
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T3
- **Dependencies**: P2-T2, P1-T7
- **Description**: Display resources as map markers
- **File**: `apps/web/src/components/map/resource-marker.tsx`
- **Acceptance Criteria**:
  - [ ] Markers show for each resource
  - [ ] Click opens info popup
  - [ ] Different icons by category

#### P2-T4: Implement Marker Clustering
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T4
- **Dependencies**: P2-T3
- **Description**: Add supercluster for marker clustering
- **Acceptance Criteria**:
  - [ ] Markers cluster at zoom out
  - [ ] Cluster shows count
  - [ ] Click expands cluster

#### P2-T5: Create Viewport-Based Loading
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T5
- **Dependencies**: P2-T3
- **Description**: Load resources only within viewport
- **File**: `apps/web/src/hooks/use-viewport-resources.ts`
- **Acceptance Criteria**:
  - [ ] Resources load on map move
  - [ ] Debounced API calls
  - [ ] Loading indicator

#### P2-T6: Create Resource Search
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T6
- **Dependencies**: P2-T2
- **Description**: Add location/keyword search
- **File**: `apps/web/src/components/map/resource-search.tsx`
- **Acceptance Criteria**:
  - [ ] Search by keyword
  - [ ] Search by location
  - [ ] Filter by category
  - [ ] Results update map

#### P2-T7: Add Directions Integration
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T7
- **Dependencies**: P2-T3
- **Description**: Open directions in Maps app
- **Acceptance Criteria**:
  - [ ] Get Directions button on resource
  - [ ] Opens Apple/Google Maps
  - [ ] Falls back to web directions

### Section 2B: 211 API Integration

#### P2-T8: Create 211 API Client
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T8
- **Dependencies**: P1-T1
- **Description**: Build API client for 211 data
- **File**: `packages/shared/lib/211-client.ts`
- **Acceptance Criteria**:
  - [ ] API client with auth
  - [ ] Search endpoint wrapper
  - [ ] Error handling
  - [ ] Rate limiting

#### P2-T9: Create Data Transformation Layer
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T9
- **Dependencies**: P2-T8
- **Description**: Transform 211 data to our schema
- **File**: `packages/shared/lib/211-transformer.ts`
- **Acceptance Criteria**:
  - [ ] Transform location format
  - [ ] Map categories
  - [ ] Handle missing fields

#### P2-T10: Create Sync Edge Function
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T10
- **Dependencies**: P2-T9
- **Description**: Scheduled sync of 211 data
- **File**: `supabase/functions/sync-211/index.ts`
- **Acceptance Criteria**:
  - [ ] Scheduled trigger
  - [ ] Incremental sync
  - [ ] Error notifications

### Section 2C: User-Contributed Resources

#### P2-T11: Create Resource Submission Form
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T11
- **Dependencies**: P2-T2, P1-T7
- **Description**: Form for users to add resources
- **File**: `apps/web/src/components/resources/resource-form.tsx`
- **Acceptance Criteria**:
  - [ ] All resource fields
  - [ ] Location picker on map
  - [ ] Category selection
  - [ ] Validation

#### P2-T12: Create Moderation Queue
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T12
- **Dependencies**: P2-T11
- **Description**: Admin view for moderating submissions
- **File**: `apps/web/src/app/(admin)/moderation/page.tsx`
- **Acceptance Criteria**:
  - [ ] List pending submissions
  - [ ] Approve/reject actions
  - [ ] Edit before approval

#### P2-T13: Create Resources Page
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T13
- **Dependencies**: P2-T2, P2-T6
- **Description**: Main resources discovery page
- **File**: `apps/web/src/app/(dashboard)/resources/page.tsx`
- **Acceptance Criteria**:
  - [ ] Map view
  - [ ] Search panel
  - [ ] List view toggle
  - [ ] Add resource button

#### P2-T14: Mobile Geolocation Setup
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T14
- **Dependencies**: P1-T24, P2-T2
- **Description**: Configure Capacitor geolocation
- **File**: `apps/web/src/hooks/use-geolocation.ts`
- **Acceptance Criteria**:
  - [ ] Request permission
  - [ ] Get current location
  - [ ] Watch position updates
  - [ ] Handle permission denied

#### P2-T15: Mobile Map Testing
- [ ] **Status**: NOT_STARTED
- **ID**: P2-T15
- **Dependencies**: P2-T13, P2-T14
- **Description**: Test map on mobile devices
- **Validation**:
  - Test map gestures on iOS
  - Test map gestures on Android
  - Verify geolocation works
  - Check marker interactions
- **Acceptance Criteria**:
  - [ ] Map renders on mobile
  - [ ] Touch gestures work
  - [ ] Location button works
  - [ ] Markers clickable

---

## PHASE 2 EXIT CRITERIA

- [ ] Map renders with markers
- [ ] Location search works
- [ ] 211 data displays
- [ ] Directions open in Maps app
- [ ] User can submit resource
- [ ] All P2 tasks marked [x]

---

## PHASE 3: Form System (Weeks 9-12)

[Tasks P3-T1 through P3-T16 - Secure profile data, form templates, autofill, e-signature]

### P3-T1: Create Encryption Utilities
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T1
- **Dependencies**: P2 Complete
- **File**: `packages/shared/lib/crypto.ts`

### P3-T2: Create Secure Profile Storage
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T2
- **Dependencies**: P3-T1

### P3-T3: Create Secure Profile Form
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T3
- **Dependencies**: P3-T2

### P3-T4: Create Form Schema Definition (Zod)
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T4
- **Dependencies**: P3-T1

### P3-T5: Create Dynamic Form Renderer
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T5
- **Dependencies**: P3-T4

### P3-T6: Create Form Template CRUD
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T6
- **Dependencies**: P3-T4

### P3-T7: Create SNAP Application Template
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T7
- **Dependencies**: P3-T6

### P3-T8: Create Medicaid Application Template
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T8
- **Dependencies**: P3-T6

### P3-T9: Create Field Mapping Logic
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T9
- **Dependencies**: P3-T3, P3-T5

### P3-T10: Create Autofill UI Integration
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T10
- **Dependencies**: P3-T9

### P3-T11: Create Signature Canvas Component
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T11
- **Dependencies**: None

### P3-T12: Create Signature Storage
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T12
- **Dependencies**: P3-T11

### P3-T13: Create Form Submission Flow
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T13
- **Dependencies**: P3-T5, P3-T10, P3-T12

### P3-T14: Create Forms Page
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T14
- **Dependencies**: P3-T6, P3-T13

### P3-T15: Create Form Fill Page
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T15
- **Dependencies**: P3-T13

### P3-T16: Mobile Form Testing
- [ ] **Status**: NOT_STARTED
- **ID**: P3-T16
- **Dependencies**: P3-T15

---

## PHASE 3 EXIT CRITERIA

- [ ] Profile data encrypts/decrypts correctly
- [ ] Form autofill populates correctly
- [ ] Signature captures and stores
- [ ] Form submission tracks in database
- [ ] All P3 tasks marked [x]

---

## PHASE 4: AI Assistant (Weeks 13-16)

[Tasks P4-T1 through P4-T11 - OpenRouter setup, chat interface, guided flows]

### P4-T1: Create OpenRouter Edge Function
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T1
- **Dependencies**: P3 Complete

### P4-T2: Create Chat Interface Component
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T2
- **Dependencies**: P4-T1

### P4-T3: Create System Prompts
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T3
- **Dependencies**: P4-T1

### P4-T4: Create Streaming Response Handler
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T4
- **Dependencies**: P4-T2

### P4-T5: Create Resource Finder Flow
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T5
- **Dependencies**: P4-T3

### P4-T6: Create Eligibility Checker Flow
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T6
- **Dependencies**: P4-T3

### P4-T7: Create Form Help Flow
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T7
- **Dependencies**: P4-T3, P3-T5

### P4-T8: Create AI Chat Page
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T8
- **Dependencies**: P4-T2, P4-T4

### P4-T9: Create Model Fallback Chain
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T9
- **Dependencies**: P4-T1

### P4-T10: Create Rate Limiting
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T10
- **Dependencies**: P4-T1

### P4-T11: Mobile AI Chat Testing
- [ ] **Status**: NOT_STARTED
- **ID**: P4-T11
- **Dependencies**: P4-T8

---

## PHASE 4 EXIT CRITERIA

- [ ] AI chat responds correctly
- [ ] Resource finder flow works
- [ ] Form help flow works
- [ ] No API key exposure (verified)
- [ ] All P4 tasks marked [x]

---

## PHASE 5: Case Management (Weeks 17-20)

[Tasks P5-T1 through P5-T12 - Dashboard, documents, notifications]

### P5-T1: Create Dashboard Layout
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T1
- **Dependencies**: P4 Complete

### P5-T2: Create Application List View
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T2
- **Dependencies**: P5-T1

### P5-T3: Create Application Detail View
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T3
- **Dependencies**: P5-T2

### P5-T4: Create Status Update Flow
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T4
- **Dependencies**: P5-T3

### P5-T5: Create Document Upload Component
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T5
- **Dependencies**: P5-T1

### P5-T6: Create Document Viewer
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T6
- **Dependencies**: P5-T5

### P5-T7: Create Document Organization UI
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T7
- **Dependencies**: P5-T6

### P5-T8: Create Notification System
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T8
- **Dependencies**: P5-T1

### P5-T9: Create Push Notifications (Capacitor)
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T9
- **Dependencies**: P5-T8

### P5-T10: Create Reminder Scheduling
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T10
- **Dependencies**: P5-T8

### P5-T11: Create Case Management Page
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T11
- **Dependencies**: P5-T2, P5-T7

### P5-T12: Mobile Dashboard Testing
- [ ] **Status**: NOT_STARTED
- **ID**: P5-T12
- **Dependencies**: P5-T11

---

## PHASE 5 EXIT CRITERIA

- [ ] Dashboard shows all applications
- [ ] Status updates persist
- [ ] Documents upload and display
- [ ] Reminders trigger notifications
- [ ] All P5 tasks marked [x]

---

## PHASE 6: Polish & Launch (Weeks 21-24)

[Tasks P6-T1 through P6-T8 - Performance, security, app stores]

### P6-T1: Bundle Size Optimization
- [ ] **Status**: NOT_STARTED
- **ID**: P6-T1
- **Dependencies**: P5 Complete

### P6-T2: Image Optimization Pipeline
- [ ] **Status**: NOT_STARTED
- **ID**: P6-T2
- **Dependencies**: P5 Complete

### P6-T3: Database Query Optimization
- [ ] **Status**: NOT_STARTED
- **ID**: P6-T3
- **Dependencies**: P5 Complete

### P6-T4: Caching Strategy
- [ ] **Status**: NOT_STARTED
- **ID**: P6-T4
- **Dependencies**: P5 Complete

### P6-T5: Security Audit
- [ ] **Status**: NOT_STARTED
- **ID**: P6-T5
- **Dependencies**: P6-T1 through P6-T4

### P6-T6: iOS App Store Submission
- [ ] **Status**: NOT_STARTED
- **ID**: P6-T6
- **Dependencies**: P6-T5

### P6-T7: Google Play Store Submission
- [ ] **Status**: NOT_STARTED
- **ID**: P6-T7
- **Dependencies**: P6-T5

### P6-T8: Production Launch Verification
- [ ] **Status**: NOT_STARTED
- **ID**: P6-T8
- **Dependencies**: P6-T6, P6-T7

---

## PHASE 6 EXIT CRITERIA (Final)

- [ ] Lighthouse score > 90
- [ ] No critical vulnerabilities
- [ ] App Store approved
- [ ] Play Store approved
- [ ] Production deployment verified
- [ ] All P6 tasks marked [x]

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

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-19 | Initial checklist creation |

---

**Checklist Hash**: To be generated after each update
**Last Agent Session**: None
**Total Development Time**: 0 hours
