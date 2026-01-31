# FEED Platform - Component Mapping Documentation Index

Welcome! This directory contains comprehensive documentation for mapping FEED platform UI features to Kibo UI components.

## Quick Navigation

### For Quick Lookups
**File**: `COMPONENT-MAP-QUICK-REF.md` (7.6 KB)
- Quick reference table by use case
- Phase-by-phase installation commands
- Decision matrix: Keep custom vs Use Kibo
- Common gotchas and solutions

**Read this if you**:
- Need to find a Kibo component for a specific UI element
- Want to know what to install next
- Are checking component compatibility

---

### For Detailed Implementation
**File**: `COMPONENT-MAP.md` (22 KB)
- Complete mapping matrix (10 feature areas)
- Installation commands for each component
- Component replacement guide with examples
- Performance considerations
- Accessibility checklist
- Version compatibility
- Testing strategy

**Read this if you**:
- Are implementing a Kibo component
- Need code examples
- Want to understand integration depth
- Are planning migration timing

---

### For Architecture Overview
**File**: `COMPONENT-ARCHITECTURE.txt` (16 KB)
- Visual project structure
- Component layers (UI, Feature, Page)
- Kibo integration map by phase
- File impact summary
- Data flow diagrams
- Build & performance optimization
- Migration workflow
- Decision tree

**Read this if you**:
- Want to understand the big picture
- Are planning a phase of development
- Need to see file relationships
- Are assessing impact of changes

---

## Quick Start (5 minutes)

1. **Read the Overview** (2 min)
   - See `/apps/web/COMPONENT-MAP.md` first ~100 lines

2. **Find Your Component** (2 min)
   - Use `COMPONENT-MAP-QUICK-REF.md` table
   - Match your UI element

3. **Install & Implement** (1 min)
   - Copy install command
   - Follow replacement guide

---

## Document Structure

```
COMPONENT-MAPPING-INDEX.md (this file)
├── Quick Navigation
├── Quick Start
├── Document Structure
├── Feature Area Guides
├── Installation Phases
├── Component Categories
└── Support & Maintenance

COMPONENT-MAP.md (detailed reference)
├── Overview
├── Mapping Matrix
│   ├── 1. AI Chat Interface
│   ├── 2. Resource Discovery Map
│   ├── 3. Community Feed
│   ├── 4. Applications Dashboard
│   ├── 5. Documents Manager
│   ├── 6. Dynamic Forms System
│   ├── 7. User Profile & Settings
│   ├── 8. Notifications & Reminders
│   ├── 9. Navigation & Layout
│   └── 10. Data Display & Analytics
├── Integration Strategy (4 phases)
├── Component Replacement Guide
├── Current Implementation Status
├── Migration Checklist
├── Design Token Alignment
├── Performance Considerations
├── Accessibility Checklist
├── Version Compatibility
├── Resources
└── Best Practices

COMPONENT-MAP-QUICK-REF.md (lookup table)
├── Quick Reference (by category)
├── Installation by Phase
├── Component Import Pattern
├── Testing Checklist
├── Common Gotchas
└── Decision Matrix

COMPONENT-ARCHITECTURE.txt (visual overview)
├── Project Structure
├── Component Layers
├── Kibo Integration Map
├── File Impact Summary
├── Data Flow Examples
├── Build & Performance
├── Migration Workflow
└── Decision Tree
```

---

## Feature Area Guides

### 1. Navigation & UI Shell
**Components**: Pill, Banner, Dialog Stack
**Phase**: 1 (Foundation)
**Files Affected**: `dashboard-layout.tsx`, modals
**Install**: `npm install @kibocorp/ui-{pill,banner,dialog-stack}`

Quick decisions:
- Use **Pill** for nav items, tabs, action buttons
- Use **Banner** for alerts, notifications, crisis warnings
- Use **Dialog Stack** for all modals, overlays, confirmation dialogs

---

### 2. Data Display & Content
**Components**: Reel, List, Status, Avatar Stack, Relative Time
**Phase**: 2 (Feature Enhancement)
**Files Affected**: Feed, Dashboard, Applications, Profiles
**Install**: `npm install @kibocorp/ui-{reel,list,status,avatar-stack,relative-time}`

Quick decisions:
- Use **Reel** for feed posts, comment threads, notification cards
- Use **Status** for badges, progress indicators, metrics
- Use **List** for data tables, document listings, application queues
- Use **Avatar Stack** for team/user displays, contributor lists
- Use **Relative Time** for timestamps, deadline displays

---

### 3. Forms & Input
**Components**: Combobox, Dropzone, Tags, Mini Calendar, Choicebox, Announcement
**Phase**: 3 (Form Enhancement)
**Files Affected**: Dynamic forms, file uploads, autofill system
**Install**: `npm install @kibocorp/ui-{combobox,dropzone,tags,mini-calendar,choicebox,announcement}`

Quick decisions:
- Use **Combobox** for searchable selects, location/resource search
- Use **Dropzone** for file uploads (documents, profile pics)
- Use **Tags** for multi-select inputs, tag fields
- Use **Mini Calendar** for date picking, deadline selection
- Use **Choicebox** for styled checkboxes and radio buttons
- Use **Announcement** for form alerts, validation messages, autofill suggestions

---

### 4. Advanced Features
**Components**: Contribution Graph, Editor, Rating, Table, Image Zoom
**Phase**: 4 (Advanced Features)
**Files Affected**: Dashboard analytics, rich content, data tables
**Install**: `npm install @kibocorp/ui-{contribution-graph,editor,rating,table,image-zoom}`

Quick decisions:
- Use **Contribution Graph** for impact metrics, user activity displays
- Use **Editor** for rich text composing (posts, notes, descriptions)
- Use **Rating** for user feedback, satisfaction surveys
- Use **Table** for complex data (applications table, resources grid)
- Use **Image Zoom** for document previews, gallery displays

---

## Installation Phases

### Phase 1: Foundation (Current + Immediate Next)
**Timeline**: Weeks 1-4
**Bundle Impact**: ~15-20KB
**Kibo Packages**: 3

```bash
npm install @kibocorp/ui-pill @kibocorp/ui-banner @kibocorp/ui-dialog-stack
```

**Components to Replace**:
1. Navigation buttons → Pill
2. Alert boxes → Banner
3. Modal implementations → Dialog Stack

**Files to Update**:
- Dashboard layout
- Chat interface
- All modal components

**Why this phase**: Foundation layer improves UX immediately, used everywhere

---

### Phase 2: Feature Enhancement
**Timeline**: Weeks 5-8
**Bundle Impact**: ~10-15KB additional
**Kibo Packages**: 5

```bash
npm install @kibocorp/ui-status @kibocorp/ui-list @kibocorp/ui-reel \
  @kibocorp/ui-avatar-stack @kibocorp/ui-relative-time
```

**Components to Replace**:
1. Post cards → Reel
2. Status indicators → Status
3. Data lists → List
4. User displays → Avatar Stack
5. Timestamps → Relative Time

**Files to Update**:
- Feed components
- Dashboard cards
- Application listings
- Profile pages

**Why this phase**: Enhances content display across app

---

### Phase 3: Form Enhancement
**Timeline**: Weeks 9-12
**Bundle Impact**: ~18-25KB additional
**Kibo Packages**: 7

```bash
npm install @kibocorp/ui-combobox @kibocorp/ui-dropzone @kibocorp/ui-tags \
  @kibocorp/ui-mini-calendar @kibocorp/ui-choicebox @kibocorp/ui-announcement \
  @kibocorp/ui-image-zoom
```

**Components to Replace**:
1. Search inputs → Combobox
2. File uploads → Dropzone
3. Tag selections → Tags
4. Date pickers → Mini Calendar
5. Check/radio → Choicebox
6. Form alerts → Announcement
7. Image previews → Image Zoom

**Files to Update**:
- Dynamic form renderer
- Document uploads
- Autofill system
- Document viewer

**Why this phase**: Core form experience matters for user retention

---

### Phase 4: Advanced Features
**Timeline**: Weeks 13-16
**Bundle Impact**: ~15-20KB additional
**Kibo Packages**: 5

```bash
npm install @kibocorp/ui-contribution-graph @kibocorp/ui-editor \
  @kibocorp/ui-rating @kibocorp/ui-table @kibocorp/ui-typography
```

**Components to Replace**:
1. Impact metrics → Contribution Graph
2. Rich text → Editor
3. Feedback → Rating
4. Data tables → Table
5. Headings/text → Typography

**Files to Update**:
- Dashboard page
- Post composer
- Analytics views
- Data tables

**Why this phase**: Polish and advanced features for engagement

---

## Component Categories Quick Reference

### Immediately Replace (Phase 1)
- Navigation items (any button list)
- Modal/overlay components
- Alert/banner notifications

### High Priority (Phase 2)
- Feed post cards
- Application status displays
- User avatars
- Date/time displays

### Medium Priority (Phase 3)
- Form search inputs
- File uploads
- Multi-select fields
- Date pickers

### Optional (Phase 4)
- Rich text editors
- Data analytics tables
- User ratings
- Contribution graphs

---

## Current Status by Feature

| Feature | Current | Kibo Ready | Phase |
|---|---|---|---|
| Chat Interface | Custom | Pill, Banner | 1 |
| Map View | Mapbox GL | N/A custom | - |
| Feed Posts | Custom Card | Reel | 2 |
| Applications | Custom Card | Status, List | 2 |
| Documents | Custom Upload | Dropzone | 3 |
| Forms | Custom Renderer | Combobox, etc | 3 |
| Dashboard | Custom Layout | Pill, Status | 1-2 |
| Notifications | Custom Dropdown | Reel | 2 |

---

## Decision Matrix: Know When to Replace

### Replace with Kibo if:
- ✅ Simple UI display (buttons, cards, lists)
- ✅ Standard form input (text, select, date)
- ✅ Status/indicator display
- ✅ No domain-specific logic
- ✅ Want WCAG accessibility built-in
- ✅ Want design system compliance

### Keep Custom if:
- ❌ Needs external library (Mapbox, Canvas)
- ❌ Complex state management
- ❌ FEED-specific logic
- ❌ Unique interaction pattern
- ❌ Performance critical hot path

---

## Testing Checklist for Kibo Integration

Before marking any Kibo component as "done":

```
Functionality:
- [ ] Component renders without errors
- [ ] Props work as documented
- [ ] Interactions work (click, input, etc)

Responsive Design:
- [ ] Works on mobile (640px)
- [ ] Works on tablet (768px)
- [ ] Works on desktop (1024px+)
- [ ] Touch targets are 44px+

Accessibility:
- [ ] Keyboard navigation works
- [ ] Screen reader announces content
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA

Performance:
- [ ] npm run build succeeds
- [ ] npm run type-check passes
- [ ] No console errors
- [ ] Bundle size acceptable

Styling:
- [ ] Matches design tokens
- [ ] Consistent with existing components
- [ ] Dark mode works
- [ ] Responsive typography

Documentation:
- [ ] Component MAP updated
- [ ] Props documented
- [ ] Examples provided
```

---

## Support & Maintenance

### Questions About Specific Components?
1. Check `COMPONENT-MAP-QUICK-REF.md` for quick answer
2. See `COMPONENT-MAP.md` for detailed examples
3. Review Kibo docs: https://kibocorp.com/ui/docs

### Planning a Phase?
1. Read `COMPONENT-ARCHITECTURE.txt` for impact
2. Check file list for what needs updating
3. Follow migration workflow

### Need to Update These Docs?
1. Edit the relevant file
2. Update date in header
3. Test links/examples
4. Commit with clear message

---

## Version Information

| Component | Version | Status |
|---|---|---|
| FEED Platform | Phase 6 | Active Development |
| Next.js | 15.x | Current |
| React | 19.x | Current |
| shadcn/ui | Latest | Installed |
| Kibo UI | Latest | Ready to install |

---

## File Locations

| Document | Path | Size | Type |
|---|---|---|---|
| Main Mapping | `/apps/web/COMPONENT-MAP.md` | 22 KB | Markdown |
| Quick Ref | `/apps/web/COMPONENT-MAP-QUICK-REF.md` | 7.6 KB | Markdown |
| Architecture | `/apps/web/COMPONENT-ARCHITECTURE.txt` | 16 KB | Text |
| This Index | `/apps/web/COMPONENT-MAPPING-INDEX.md` | This file | Markdown |

---

## Last Updated
**Date**: 2026-01-30
**Version**: 1.0.0
**Maintainer**: FEED Development Team

For questions or updates, refer to the main COMPONENT-MAP.md file or contact the development team.

---

## Next Steps

1. **Read** `COMPONENT-MAP-QUICK-REF.md` (5 min)
2. **Decide** what component to implement first
3. **Install** using Phase 1 command
4. **Test** following the checklist
5. **Update** docs when complete
6. **Proceed** to next component

Happy component mapping!
