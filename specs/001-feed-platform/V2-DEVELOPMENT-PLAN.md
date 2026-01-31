# FEED Platform V2 Development Plan
## Full UI/UX Build with Backend Integration & LLM Weaving

**Version**: 2.0.0
**Started**: 2026-01-30
**Status**: Planning Complete

---

## Executive Summary

This plan outlines the complete development of FEED Platform V2, building upon the V1.0.0 foundation with:

1. **Complete UI/UX Implementation** - All panels fully functional with Kibo UI components
2. **Backend Integration** - Supabase real-time, Edge Functions, RLS policies
3. **LLM Weaving** - AI assistant deeply integrated across every panel
4. **Design System** - Light cream theme (as per concept) consistently applied

---

## Design System: Light Theme Palette

Based on the concept design with light cream tones:

```css
/* Primary Colors */
--bg-card: #ffffff;           /* Main card background */
--bg-content: #faf9f6;        /* Content area background */
--bg-input: #f8f6f1;          /* Input fields */
--bg-tag: #f0ede6;            /* Quick tags, chips */
--bg-tag-hover: #e8e4db;      /* Tag hover state */
--bg-stats: #f8f6f1;          /* Stats cards */

/* Accent Colors */
--primary: #4a5d23;           /* Green primary (wheat field inspired) */
--primary-hover: #3d4d1c;     /* Primary hover */
--accent-yellow: #fef3c7;     /* Find Resources card */
--accent-blue: #dbeafe;       /* Connect & Share card */
--accent-green: #dcfce7;      /* Apply for Benefits card */

/* Borders */
--border-light: rgba(214, 211, 200, 0.5);  /* stone-200/50 */
--border-card: #e5e2db;       /* Card borders */

/* Text */
--text-primary: #1c1917;      /* stone-900 */
--text-secondary: #57534e;    /* stone-600 */
--text-muted: #a8a29e;        /* stone-400 */
```

---

## Phase Structure

### Phase A: Panel Completion (UI/UX Focus)
Complete all 8 panels with full functionality.

### Phase B: Backend Wiring
Connect all panels to Supabase with real-time updates.

### Phase C: LLM Integration
Weave AI assistant throughout every panel.

### Phase D: Polish & Launch
Performance optimization, accessibility, final testing.

---

## Phase A: Panel Completion

### A1: Overview Panel (Dashboard)
**File**: `apps/web/src/components/panels/overview-panel.tsx`

**UI Components**:
- Welcome greeting with user name and date
- Community impact gauge (48% with trend line)
- Impact overview metrics grid
- CO2 emissions ring chart
- Single-use plastic progress bar
- Your contribution stats
- Quick action buttons

**Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  Welcome back, {userName}!          │ Impact overview      │
│  {date}                             │ - Trees planted      │
│                                     │ - Waste reduced      │
│  Our community impact  [trend]      │ - Active volunteers  │
│  ┌────────────────────┐             │ - Projects supported │
│  │       48%          │             ├─────────────────────│
│  │  [line chart]      │             │ CO2 emissions trends│
│  │  [High] ────── 60  │             │    ╭──╮  33%        │
│  └────────────────────┘             │    │  │  saved      │
├─────────────────────────────────────┴─────────────────────│
│ Single-use plastic reduce          │ Your contribution    │
│ ████████░░░░░░░ 7%                 │ Events joined: 12    │
│ this week                           │ Articles: 6         │
│                                     │ Actions: 83         │
└─────────────────────────────────────────────────────────────┘
```

**Backend Integration**:
- `useProfile()` - User data
- `useImpactMetrics()` - Community stats
- `useUserContributions()` - Personal stats
- Real-time subscription for live updates

**LLM Integration**:
- Personalized greeting based on time and activity
- Smart suggestions based on recent actions
- "Ask about your impact" quick action

---

### A2: Chat Panel Enhancement
**File**: `apps/web/src/components/panels/chat-panel.tsx`

**Current State**: Greeting + basic conversation

**Enhancements Needed**:
- Streaming responses with typewriter effect
- Message persistence (Supabase)
- Context-aware responses (knows user profile)
- Guided flow integration
- Rich message types (cards, buttons, resources)

**Message Types**:
```typescript
type MessageType =
  | 'text'           // Plain text
  | 'resource-card'  // Resource suggestion
  | 'form-prompt'    // Start form action
  | 'eligibility'    // Eligibility result
  | 'map-preview'    // Map embed
  | 'quick-actions'  // Action buttons
```

**Backend Integration**:
- `useChat()` hook with streaming
- Message history in Supabase
- Edge Function: `/functions/chat`
- OpenRouter API for LLM

**LLM Integration**:
- System prompt with FEED context
- User profile injection
- Resource database context
- Eligibility checking tools

---

### A3: Map Panel Enhancement
**File**: `apps/web/src/components/panels/map-panel.tsx`

**Current State**: Three-column layout with mock data

**Enhancements Needed**:
- Real Mapbox integration
- Cluster markers with SuperCluster
- Real resource data from Supabase
- Filter by category, distance, hours
- Directions integration
- Save/favorite resources

**Layout**:
```
┌─────────────┬─────────────────────────────────┬─────────────┐
│ Search      │                                 │ Resource    │
│ [input]     │                                 │ Name        │
│             │                                 │ ───────────│
│ Filters     │       [INTERACTIVE MAP]        │ Address     │
│ [dropdown]  │                                 │ Phone       │
│             │         [markers]               │ Hours       │
│ Results     │         [clusters]              │             │
│ ─────────── │                                 │ [Directions]│
│ • Food Bank │                                 │ [Save]      │
│ • Shelter   │                                 │ [Call]      │
│ • Clinic    │                                 │             │
└─────────────┴─────────────────────────────────┴─────────────┘
```

**Backend Integration**:
- `useResources()` with geo queries
- `useViewportResources()` for map bounds
- 211 API sync via Edge Function
- User favorites in Supabase

**LLM Integration**:
- "Find resources for me" chat shortcut
- Natural language search ("food near me")
- AI-suggested resources based on profile
- Directions narration

---

### A4: Feed Panel (Community)
**File**: `apps/web/src/components/panels/feed-panel.tsx`

**UI Components**:
- Post composer with rich text
- Infinite scroll feed
- Post card (avatar, content, actions)
- Comment threads
- Pinned posts section
- Community guidelines banner

**Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [avatar] What's on your mind?                   [📷] │   │
│  │          [Post]                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [avatar] Jane Smith · 2 hours ago                    │   │
│  │                                                       │   │
│  │ Just got approved for SNAP benefits! The AI          │   │
│  │ assistant helped me fill out the application...      │   │
│  │                                                       │   │
│  │ ♡ 24 likes  💬 8 comments  ↗ Share                   │   │
│  └─────────────────────────────────────────────────────┘   │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**Backend Integration**:
- `useRealtimeFeed()` with subscriptions
- `usePosts()` CRUD operations
- `useComments()` thread management
- Image uploads to Supabase Storage
- Content moderation queue

**LLM Integration**:
- AI-assisted post composition
- Automatic content moderation
- Suggested posts based on interests
- Translation assistance

---

### A5: Applications Panel
**File**: `apps/web/src/components/panels/applications-panel.tsx`

**UI Components**:
- Status filter tabs (All, Draft, Submitted, Under Review, Approved)
- Application cards with progress
- Status timeline
- Required documents checklist
- Deadline alerts

**Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  [All] [Draft] [Submitted] [Under Review] [Approved]        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📋 SNAP Application                                  │   │
│  │    ████████████░░░░░░ 75%                           │   │
│  │                                                       │   │
│  │    Status: Under Review  ·  Due: Feb 15, 2026        │   │
│  │    Last updated: Jan 28, 2026                        │   │
│  │                                           [Continue →]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🏥 Medicaid Application                              │   │
│  │    ████░░░░░░░░░░░░░░ 25% Draft                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Backend Integration**:
- `useApplications()` hook
- Real-time status updates
- Document upload integration
- Notification triggers

**LLM Integration**:
- Status explanations
- Next step suggestions
- Document requirement help
- Appeal assistance

---

### A6: Documents Panel
**File**: `apps/web/src/components/panels/documents-panel.tsx`

**UI Components**:
- Upload zone (drag & drop)
- Document grid/list toggle
- Category filters
- Document preview modal
- Sharing controls

**Categories**:
- Identity (ID, SSN, birth certificate)
- Income (pay stubs, tax returns)
- Residence (lease, utility bills)
- Medical (records, prescriptions)
- Other

**Backend Integration**:
- `useDocuments()` hook
- Supabase Storage uploads
- Encryption at rest
- Sharing permissions

**LLM Integration**:
- Document type detection (OCR)
- Auto-categorization
- Extraction of key info
- Form autofill from documents

---

### A7: Forms Panel
**File**: `apps/web/src/components/panels/forms-panel.tsx`

**UI Components**:
- Available forms list
- Form card with requirements
- In-progress section
- Completed forms section
- Template browser

**Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  Available Forms                                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🍎 SNAP Application                                  │   │
│  │    Food assistance program                           │   │
│  │    Est. time: 20 min  ·  Required docs: 3            │   │
│  │                                         [Start →]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  In Progress (2)                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Medicaid · 45% complete · Continue →                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Completed (5)                                             │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**Backend Integration**:
- `useFormTemplates()` hook
- `useFormSubmissions()` hook
- Auto-save drafts
- E-signature storage

**LLM Integration**:
- Guided form filling
- Field explanation tooltips
- Eligibility pre-check
- Error correction suggestions

---

### A8: Settings Panel
**File**: `apps/web/src/components/panels/settings-panel.tsx`

**Sections**:
1. Profile (name, email, avatar, bio)
2. Notifications (email, push, SMS)
3. Privacy (data sharing, visibility)
4. Security (password, 2FA)
5. Theme (light/dark/system)
6. Language
7. Help & Support

**Backend Integration**:
- `useSettings()` hook
- Profile updates
- Notification preferences
- Privacy settings

**LLM Integration**:
- Help bot for settings
- Privacy recommendations
- Security suggestions

---

## Phase B: Backend Wiring

### B1: Supabase Schema Completion

**Tables Required**:
```sql
-- User Impact Metrics
CREATE TABLE impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  trees_planted INT DEFAULT 0,
  waste_reduced_kg DECIMAL DEFAULT 0,
  co2_saved_kg DECIMAL DEFAULT 0,
  events_joined INT DEFAULT 0,
  actions_completed INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community Stats (aggregate)
CREATE TABLE community_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date DATE UNIQUE,
  active_users INT,
  resources_accessed INT,
  applications_submitted INT,
  posts_created INT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Favorites
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  resource_id UUID REFERENCES resources,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);
```

### B2: Real-time Subscriptions

**Subscription Channels**:
```typescript
// Feed posts
supabase
  .channel('feed-posts')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, handlePostChange)
  .subscribe()

// Application status
supabase
  .channel('my-applications')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications', filter: `user_id=eq.${userId}` }, handleStatusChange)
  .subscribe()

// Notifications
supabase
  .channel('notifications')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, handleNotification)
  .subscribe()
```

### B3: Edge Functions

**Functions to Implement**:

1. **`/functions/chat`** - AI chat endpoint
   - OpenRouter proxy
   - Context injection
   - Tool calling (eligibility, resources)

2. **`/functions/sync-211`** - Resource sync
   - 211 API fetch
   - Data transformation
   - Upsert to resources table

3. **`/functions/analyze-document`** - OCR
   - Document upload
   - Text extraction
   - Auto-categorization

4. **`/functions/check-eligibility`** - Benefits check
   - Profile data input
   - Rules evaluation
   - Eligibility result

5. **`/functions/send-notification`** - Push notifications
   - Email via Resend
   - Push via web-push
   - SMS via Twilio

---

## Phase C: LLM Integration

### C1: System Prompts

**Main Assistant Prompt**:
```
You are FEED, a compassionate AI assistant helping people access
mutual aid resources and benefits. You are integrated into every
part of the FEED platform.

CAPABILITIES:
- Search local resources (food, housing, healthcare, etc.)
- Check eligibility for benefits (SNAP, Medicaid, housing assistance)
- Guide users through application forms
- Answer questions about programs and requirements
- Provide emotional support and encouragement

CONTEXT:
- User Name: {userName}
- Location: {userCity}, {userState}
- Active Applications: {applicationsList}
- Saved Resources: {favoritesList}
- Recent Activity: {recentActions}

GUIDELINES:
- Be warm, supportive, and non-judgmental
- Use simple, clear language
- Always verify eligibility before recommending programs
- Protect user privacy - never share personal information
- Offer to help with next steps proactively
```

### C2: Tool Definitions

**LLM Tools**:
```typescript
const tools = [
  {
    name: 'search_resources',
    description: 'Search for local resources by category and location',
    parameters: {
      category: 'string (food, housing, healthcare, etc.)',
      location: 'string (address or zip code)',
      radius_miles: 'number (default 10)'
    }
  },
  {
    name: 'check_eligibility',
    description: 'Check user eligibility for a specific benefit program',
    parameters: {
      program: 'string (snap, medicaid, housing, etc.)',
      household_size: 'number',
      monthly_income: 'number'
    }
  },
  {
    name: 'start_application',
    description: 'Begin a new benefit application',
    parameters: {
      form_template_id: 'string'
    }
  },
  {
    name: 'get_directions',
    description: 'Get directions to a resource location',
    parameters: {
      resource_id: 'string',
      mode: 'string (driving, walking, transit)'
    }
  }
]
```

### C3: Context Injection Points

**Per-Panel Context**:

| Panel | Context Injected |
|-------|------------------|
| Overview | User stats, recent activity, suggestions |
| Chat | Full profile, conversation history, available tools |
| Map | Current location, search history, favorites |
| Feed | User interests, community guidelines |
| Applications | Active apps, deadlines, required docs |
| Documents | Uploaded docs, missing requirements |
| Forms | Profile autofill data, eligibility status |
| Settings | Current preferences, security status |

---

## Phase D: Polish & Launch

### D1: Performance Optimization

- [ ] Image optimization (next/image)
- [ ] Code splitting by panel
- [ ] Lazy loading for heavy components
- [ ] Service worker for offline
- [ ] Bundle analysis and reduction

### D2: Accessibility

- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation complete
- [ ] Screen reader testing
- [ ] Color contrast verification
- [ ] Focus management

### D3: Testing

- [ ] Unit tests for hooks
- [ ] Integration tests for panels
- [ ] E2E tests for critical flows
- [ ] Load testing for real-time features
- [ ] Security penetration testing

### D4: Launch Checklist

- [ ] All RLS policies verified
- [ ] Edge Functions deployed
- [ ] Mapbox API key configured
- [ ] OpenRouter API key in secrets
- [ ] Domain DNS configured
- [ ] SSL certificate active
- [ ] Error tracking enabled
- [ ] Analytics configured

---

## Implementation Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| A (UI) | 2 weeks | All 8 panels complete |
| B (Backend) | 2 weeks | All hooks, real-time, functions |
| C (LLM) | 1 week | AI integration in all panels |
| D (Polish) | 1 week | Performance, a11y, testing |

**Total**: 6 weeks to V2.0.0 launch

---

## Next Immediate Tasks

1. [ ] Complete Overview Panel with all stat cards
2. [ ] Enhance Chat Panel with streaming
3. [ ] Integrate Mapbox in Map Panel
4. [ ] Build Feed Panel with real-time
5. [ ] Complete Applications Panel with status
6. [ ] Build Documents Panel with upload
7. [ ] Enhance Forms Panel with templates
8. [ ] Build Settings Panel

---

*Generated by SYNRG-COMMIT Orchestrator*
*Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>*
