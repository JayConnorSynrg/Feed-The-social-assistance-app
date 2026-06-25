# FEED Platform - Complete Sitemap

## Architecture Overview

FEED uses a **Single-Page App (SPA) architecture** with a persistent shell and dynamic content panels.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TOP NAVIGATION BAR                          │
│  [Logo] Home | About us | Our Mission ▼ | Blog | Resources  [Login][Sign Up]  │
├────┬────────────────────────────────────────────────────────────────┤
│    │                                                                │
│ I  │                                                                │
│ C  │                    DYNAMIC CONTENT PANEL                       │
│ O  │                                                                │
│ N  │           (Changes based on sidebar selection)                 │
│    │                                                                │
│ S  │     Chat | Map | Feed | Applications | Documents | Forms       │
│ I  │                                                                │
│ D  │                                                                │
│ E  │                                                                │
│ B  │                                                                │
│ A  │                                                                │
│ R  │                                                                │
├────┴────────────────────────────────────────────────────────────────┤
│                      BOTTOM STATS ROW                              │
│  [Impact Graph] [Community Stats] [Progress Ring] [Contributions]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Route Structure

### Public Routes (No Authentication Required)

| Route | Panel | Description |
|-------|-------|-------------|
| `/` | Chat | Landing page with AI assistant greeting |
| `/about` | Static | About FEED platform |
| `/mission` | Static | Our mission and values |
| `/blog` | Static | Community blog/news |
| `/login` | Auth | User login |
| `/signup` | Auth | New user registration |
| `/profile/[username]` | Public Profile | View user profiles |

### Dashboard Routes (Authentication Required)

| Route | Panel | Sidebar Icon | Description |
|-------|-------|--------------|-------------|
| `/` | Chat | 💬 MessageSquare | AI assistant (default view) |
| `/?panel=overview` | Overview | 🏠 Home | Dashboard overview |
| `/?panel=chat` | Chat | 💬 MessageSquare | AI assistant |
| `/?panel=map` | Map | 🗺️ Map | Resource finder map |
| `/?panel=feed` | Feed | 📰 Newspaper | Community posts |
| `/?panel=applications` | Applications | 📋 ClipboardList | Benefit applications |
| `/?panel=documents` | Documents | 📁 FolderOpen | Document management |
| `/?panel=forms` | Forms | 📝 FileText | Form filling |
| `/?panel=settings` | Settings | ⚙️ Settings | User preferences |

### Admin Routes (Admin Role Required)

| Route | Description |
|-------|-------------|
| `/moderation` | Content moderation queue |

---

## Sidebar Icon Mapping

| Icon | Panel ID | Label | Priority |
|------|----------|-------|----------|
| 🏠 Home | `overview` | Overview | 1 |
| 💬 MessageSquare | `chat` | AI Assistant | 2 |
| 🗺️ Map | `map` | Resource Map | 3 |
| 📰 Newspaper | `feed` | Community Feed | 4 |
| 📋 ClipboardList | `applications` | Applications | 5 |
| 📁 FolderOpen | `documents` | Documents | 6 |
| 📝 FileText | `forms` | Forms | 7 |
| ⚙️ Settings | `settings` | Settings | 8 |

---

## Panel Specifications

### 1. Chat Panel (AI Assistant)

**Initial State (Greeting):**
- Header: "Hi, This is Feed. What can we help you gather today?"
- 3 Feature Cards:
  1. Find Resources (yellow) - navigates to Map
  2. Connect & Share (blue) - navigates to Feed
  3. Apply for Benefits (green) - navigates to Forms
- Chat input with quick tags: Find resources, Program Eligibility, Food, Social Services, Healthcare
- Send button

**Conversation State:**
- Scrollable message thread
- User messages (right-aligned, primary color)
- Assistant messages (left-aligned, muted background)
- Typing indicator
- Sticky input at bottom
- Quick tags for common queries

### 2. Map Panel (Resource Finder)

**Three-Column Layout:**

| Left (280px) | Center (Flex) | Right (280px, conditional) |
|--------------|---------------|---------------------------|
| Search input | Interactive Map | Selected resource details |
| Filter button | Resource markers | Contact info |
| Resource list | Clustering | Hours, directions |
| Scroll area | Zoom controls | Save button |

**Resource List Item:**
- Name with verified badge
- Category pill (colored by type)
- Open/Closed status
- Distance
- Rating stars

**Resource Categories:**
- 🍎 Food (orange)
- 🏠 Housing (blue)
- 🏥 Healthcare (red)
- 💼 Employment (green)
- 📚 Education (purple)
- ⚖️ Legal (yellow)
- 🚌 Transportation (teal)
- ⚡ Utilities (gray)

### 3. Feed Panel (Community)

- Post composer at top
- Infinite scroll feed
- Post card:
  - Author avatar + name + timestamp
  - Content text
  - Like, Comment, Share buttons
  - Comment thread (expandable)
- Pinned posts section

### 4. Applications Panel

- Status filter tabs: All, Draft, Submitted, Under Review, Approved
- Application cards:
  - Form type icon
  - Application name
  - Status badge
  - Progress percentage
  - Deadline (if any)
  - Last updated
- Click to view details/continue

### 5. Documents Panel

- Upload zone (drag & drop)
- Document grid/list toggle
- Document card:
  - File type icon
  - Name
  - Category
  - Size
  - Upload date
  - Actions (view, download, delete)
- Category filters: Identity, Income, Residence, Medical, Other

### 6. Forms Panel

- Available forms list
- Form card:
  - Form name
  - Agency
  - Estimated time
  - Required documents
  - Start button
- In-progress forms section
- Completed forms section

### 7. Settings Panel

**Sections:**
- Profile (name, email, avatar, bio)
- Notifications (email, push, SMS preferences)
- Privacy (data sharing, visibility)
- Security (password, 2FA)
- Theme (light/dark/system)
- Language
- Help & Support

---

## Navigation Flows

### New User Onboarding
```
Landing (Chat) → Sign Up → Profile Setup → Chat (personalized greeting)
```

### Benefits Application Flow
```
Chat → "Apply for benefits" → Forms Panel → Select Form → Fill Form → Upload Docs → Sign → Submit → Applications Panel
```

### Resource Discovery Flow
```
Chat → "Find resources" → Map Panel → Search/Filter → Select Resource → View Details → Get Directions / Save
```

### Document Management Flow
```
Applications Panel → View Application → Upload Required Docs → Documents Panel → Organize by Category
```

---

## State Management

### Persistent Shell State (Context)
```typescript
interface ShellState {
  activePanel: PanelType
  isAuthenticated: boolean
  user: User | null
  notifications: Notification[]
  impactStats: ImpactStats
}
```

### Panel-Specific State
Each panel manages its own local state:
- Chat: messages[], isTyping
- Map: selectedResource, filters, viewport
- Feed: posts[], hasMore
- Applications: applications[], filter
- Documents: documents[], view
- Forms: templates[], inProgress[]
- Settings: preferences

---

## URL Structure (Deep Linking)

```
# Main app with panel selection
/?panel=chat
/?panel=map
/?panel=map&resource=abc123  # Pre-select resource
/?panel=feed
/?panel=feed&post=xyz789     # Highlight specific post
/?panel=applications
/?panel=applications&id=app1 # View specific application
/?panel=documents
/?panel=forms
/?panel=forms&template=snap  # Start specific form
/?panel=settings
/?panel=settings&section=privacy

# Auth routes
/login
/login?redirect=/forms
/signup

# Public routes
/about
/mission
/blog
/profile/[username]

# Admin routes
/moderation
```

---

## Mobile Considerations

### Bottom Navigation (5 items)
| Position | Icon | Panel |
|----------|------|-------|
| 1 | 🏠 | Overview |
| 2 | 💬 | Chat |
| 3 | 🗺️ | Map |
| 4 | 📰 | Feed |
| 5 | 📋 | Applications |

*Additional items (Documents, Forms, Settings) accessible via overflow menu or Settings panel*

### Mobile-Specific Behaviors
- Bottom stats row hidden on mobile (save space)
- Swipe gestures for panel navigation
- Pull-to-refresh on scrollable panels
- Full-screen map mode
- Sheet-based resource details

---

## Component Hierarchy

```
<FeedShell>
  ├── <TopNav />
  │   ├── Logo
  │   ├── NavLinks
  │   └── AuthButtons
  │
  ├── <IconSidebar /> (desktop)
  │   └── <IconButton /> × 8
  │
  ├── <ContentPanel>
  │   └── {activePanel component}
  │
  ├── <BottomStatsRow /> (desktop)
  │   └── <StatCard /> × 4
  │
  └── <MobileBottomNav /> (mobile)
      └── <NavButton /> × 5
</FeedShell>
```

---

## Data Sources

### Supabase (Primary Database)
- Users, Profiles
- Posts, Comments
- Resources
- Applications, Submissions
- Documents
- Form Templates

### External APIs
- **Fireworks** - AI chat completions
- **211 API** - Resource data sync
- **Mapbox** - Map tiles and geocoding

### Client-Side Hooks
- `useAuth()` - Authentication state
- `usePanelContext()` - Active panel
- `useRealtimeFeed()` - Live feed updates
- `useResources()` - Resource queries
- `useApplications()` - Application tracking
- `useDocuments()` - Document management

---

## SEO & Metadata

| Route | Title | Description |
|-------|-------|-------------|
| `/` | FEED - Mutual Aid Platform | Find resources, apply for benefits, connect with your community |
| `/about` | About FEED | Learn about our mission to help people access resources |
| `/login` | Sign In - FEED | Access your FEED account |
| `/signup` | Create Account - FEED | Join FEED to find resources and benefits |

---

## Future Enhancements

- [ ] `/messages` - Direct messaging between users
- [ ] `/community` - Community forums/groups
- [ ] `/events` - Local events calendar
- [ ] `/analytics` - Admin analytics dashboard
- [ ] `/api/v1/*` - Public API for integrations

---

*Last Updated: January 30, 2026*
*Version: 2.0.0 - SPA Architecture*
