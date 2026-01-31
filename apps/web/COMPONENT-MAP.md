# FEED Platform - Kibo UI Component Mapping

**Project**: FEED - Mutual Aid Resource Sharing Platform
**Version**: 1.0.0
**Date**: 2026-01-30
**Tech Stack**: Next.js + Capacitor + Supabase + shadcn/ui + OpenRouter

---

## Overview

This document maps FEED platform UI features to Kibo UI components, identifying optimal component matches and fallbacks for unsupported designs. The mapping is organized by feature area with installation commands for each Kibo component.

**Current Status**:
- shadcn/ui base components installed
- Custom components built for FEED-specific needs
- Kibo components recommended for enhanced UI/UX

---

## Component Mapping Matrix

### 1. AI Chat Interface

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Chat greeting | Message bubble | Custom ChatBubble | **Reel** (content display) | Keep current | N/A - not primary match |
| Quick action pills | Interactive buttons | Custom with Tailwind | **Pill** | Button component | `npm install @kibocorp/ui-pill` |
| Feature cards | Clickable cards | Card + Button | **Deck** | Keep current | `npm install @kibocorp/ui-deck` |
| Chat input with tags | Input + tag selector | Custom formik form | **Tags** + Input | Keep current | `npm install @kibocorp/ui-tags` |
| Streaming response | Message display | Custom SSE handler | **Spinner** (loading) | Keep current | `npm install @kibocorp/ui-spinner` |
| Crisis banner | Alert notification | Custom alert | **Announcement** or **Banner** | Keep current | `npm install @kibocorp/ui-banner` |
| Flow selector | Tab/dropdown | Custom component | **Pill** + modal | Keep current | N/A |
| Message history | Scrollable list | Custom MessageList | **Stories** (narrative) | Keep current | `npm install @kibocorp/ui-stories` |

**Installation Group 1 - Chat Interface**:
```bash
npm install @kibocorp/ui-pill @kibocorp/ui-tags @kibocorp/ui-banner
```

---

### 2. Resource Discovery Map

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Interactive map | Mapbox GL JS | @react-map-gl + mapbox-gl | *N/A - external* | Keep current | N/A |
| Resource markers | Map pins | Custom Mapbox layer | **Comparison** (visual) | Keep current | N/A |
| Marker clustering | Supercluster | Mapbox layer | *N/A - external* | Keep current | N/A |
| Resource search | Input + filters | Custom form | **Combobox** | Input + Select | `npm install @kibocorp/ui-combobox` |
| Location filter | Dropdown | Custom Select | **Combobox** | Keep current | `npm install @kibocorp/ui-combobox` |
| Category filter | Multi-select | Custom CheckboxGroup | **Tags** | Checkbox group | `npm install @kibocorp/ui-tags` |
| Search results list | Card list | Custom CardList | **List** or **Table** | Keep current | `npm install @kibocorp/ui-list` |
| Directions link | Action button | Custom Link | *N/A* | Keep current | N/A |
| Resource detail modal | Popup panel | Custom Modal | **Dialog Stack** | Keep current | `npm install @kibocorp/ui-dialog-stack` |

**Installation Group 2 - Resource Map**:
```bash
npm install @kibocorp/ui-combobox @kibocorp/ui-list @kibocorp/ui-dialog-stack
```

---

### 3. Community Feed

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Post card | Feed item | Custom PostCard | **Reel** or **Card** | Keep current | `npm install @kibocorp/ui-reel` |
| Author avatar | User image | Avatar (shadcn) | **Avatar Stack** | Keep current | `npm install @kibocorp/ui-avatar-stack` |
| Post content | Text display | Custom text | **Typography** | Keep current | `npm install @kibocorp/ui-typography` |
| Post timestamp | Relative time | Custom component | **Relative Time** | Keep current | `npm install @kibocorp/ui-relative-time` |
| Like button | Icon toggle | Custom Button | *N/A* | Keep current | N/A |
| Comment section | Nested comments | Custom CommentList | **Reel** (sequential) | Keep current | N/A |
| Post composer | Text input | Custom PostComposer | **Editor** | Keep current | `npm install @kibocorp/ui-editor` |
| Image upload | File input | Custom Dropzone | **Dropzone** | Keep current | `npm install @kibocorp/ui-dropzone` |
| Infinite scroll | Pagination | Custom usePagination | *N/A* | Keep current | N/A |

**Installation Group 3 - Community Feed**:
```bash
npm install @kibocorp/ui-reel @kibocorp/ui-avatar-stack @kibocorp/ui-relative-time @kibocorp/ui-editor @kibocorp/ui-dropzone
```

---

### 4. Applications Dashboard

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Application cards | Status display | Custom ApplicationCard | **Card** + **Status** | Keep current | `npm install @kibocorp/ui-status` |
| Status badge | State indicator | Custom Badge | **Status** | Keep current | `npm install @kibocorp/ui-status` |
| Progress ring | Circular progress | Custom SVG | **Status** (progress) | Keep current | N/A |
| Application list | Data display | Custom ApplicationList | **List** or **Table** | Keep current | `npm install @kibocorp/ui-list` |
| Deadline indicator | Date display | Custom DeadlineCard | **Relative Time** | Keep current | `npm install @kibocorp/ui-relative-time` |
| Status timeline | Vertical timeline | Custom Timeline | **Relative Time** + custom | Keep current | N/A |
| Action buttons | Update/edit | Custom Button group | *N/A* | Keep current | N/A |
| Modal forms | Update status | Custom Modal | **Dialog Stack** | Keep current | `npm install @kibocorp/ui-dialog-stack` |
| Notes section | Text area | Custom TextArea (shadcn) | **Editor** | Keep current | `npm install @kibocorp/ui-editor` |

**Installation Group 4 - Dashboard**:
```bash
npm install @kibocorp/ui-status @kibocorp/ui-list @kibocorp/ui-relative-time @kibocorp/ui-editor @kibocorp/ui-dialog-stack
```

---

### 5. Documents Manager

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Document upload | Drag-drop zone | Custom Dropzone | **Dropzone** | Keep current | `npm install @kibocorp/ui-dropzone` |
| File validation | Error display | Custom FormError | *N/A* | Keep current | N/A |
| Document card | File preview | Custom DocumentCard | **Reel** or **Card** | Keep current | `npm install @kibocorp/ui-reel` |
| Category filter | Dropdown | Custom Select | **Combobox** | Keep current | `npm install @kibocorp/ui-combobox` |
| Document list | Grid/list view | Custom DocumentList | **List** + **Grid** | Keep current | `npm install @kibocorp/ui-list` |
| Document viewer | PDF/image modal | Custom ViewerModal | **Dialog Stack** | Keep current | `npm install @kibocorp/ui-dialog-stack` |
| Download action | File download link | Custom Button | *N/A* | Keep current | N/A |
| Document preview | Thumbnail | Custom Image component | **Image Zoom** | Keep current | `npm install @kibocorp/ui-image-zoom` |

**Installation Group 5 - Documents**:
```bash
npm install @kibocorp/ui-dropzone @kibocorp/ui-reel @kibocorp/ui-combobox @kibocorp/ui-list @kibocorp/ui-dialog-stack @kibocorp/ui-image-zoom
```

---

### 6. Dynamic Forms System

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Text input | Form field | Input (shadcn) | *N/A* | Keep current | N/A |
| Select dropdown | Form field | Select (shadcn) | *N/A* | Keep current | N/A |
| Checkbox field | Toggle input | Checkbox (shadcn) | **Choicebox** | Keep current | `npm install @kibocorp/ui-choicebox` |
| Radio buttons | Single choice | Custom Radio | **Choicebox** | Keep current | `npm install @kibocorp/ui-choicebox` |
| Multi-select | Tag selection | Tags (shadcn) | **Tags** | Keep current | `npm install @kibocorp/ui-tags` |
| Date picker | Calendar input | Custom MiniCalendar | **Mini Calendar** | Keep current | `npm install @kibocorp/ui-mini-calendar` |
| Address field | Location input | Custom AddressField | **Combobox** (geo) | Keep current | `npm install @kibocorp/ui-combobox` |
| Signature field | Drawing canvas | Custom SignatureCanvas | *N/A* | Keep current | N/A |
| File upload | Document input | Custom FileUpload | **Dropzone** | Keep current | `npm install @kibocorp/ui-dropzone` |
| Conditional fields | Show/hide logic | Custom visibility handlers | *N/A* | Keep current | N/A |
| Field validation | Error display | Custom ErrorMessage | *N/A* | Keep current | N/A |
| Form sections | Grouped fields | Custom SectionHeader | **Typography** | Keep current | `npm install @kibocorp/ui-typography` |
| Autofill banner | Smart suggestions | Custom AutofillBanner | **Announcement** | Keep current | `npm install @kibocorp/ui-announcement` |

**Installation Group 6 - Forms**:
```bash
npm install @kibocorp/ui-choicebox @kibocorp/ui-tags @kibocorp/ui-mini-calendar @kibocorp/ui-combobox @kibocorp/ui-dropzone @kibocorp/ui-typography @kibocorp/ui-announcement
```

---

### 7. User Profile & Settings

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Profile form | Edit layout | Custom ProfileForm | **Editor** | Keep current | `npm install @kibocorp/ui-editor` |
| Avatar upload | Image picker | Custom AvatarUpload | **Dropzone** | Keep current | `npm install @kibocorp/ui-dropzone` |
| Avatar display | Profile image | Avatar (shadcn) | **Avatar Stack** | Keep current | `npm install @kibocorp/ui-avatar-stack` |
| Settings tabs | Option groups | Custom TabGroup | **Pill** (nav) | Keep current | `npm install @kibocorp/ui-pill` |
| Settings panel | Grouped options | Custom SettingPanel | **Card** + custom | Keep current | N/A |
| Public profile | View card | Custom PublicProfile | **Reel** or **Card** | Keep current | `npm install @kibocorp/ui-reel` |
| User stats | Metrics display | Custom StatsCard | **Status** (metrics) | Keep current | `npm install @kibocorp/ui-status` |
| Payment links | Action section | Custom PaymentLinks | **Pill** buttons | Keep current | N/A |

**Installation Group 7 - Profile**:
```bash
npm install @kibocorp/ui-editor @kibocorp/ui-dropzone @kibocorp/ui-avatar-stack @kibocorp/ui-pill @kibocorp/ui-reel @kibocorp/ui-status
```

---

### 8. Notifications & Reminders

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Notification list | Dropdown items | Custom NotificationList | **Reel** (sequential) | Keep current | `npm install @kibocorp/ui-reel` |
| Notification item | Single alert | Custom NotificationItem | **Banner** or **Card** | Keep current | `npm install @kibocorp/ui-banner` |
| Notification badge | Count indicator | Custom Badge | **Status** | Keep current | `npm install @kibocorp/ui-status` |
| Reminder form | Create reminder | Custom ReminderForm | **Mini Calendar** (date) | Keep current | `npm install @kibocorp/ui-mini-calendar` |
| Reminder list | Upcoming items | Custom ReminderList | **List** | Keep current | `npm install @kibocorp/ui-list` |
| Reminder item | Single reminder | Custom ReminderCard | **Card** + **Relative Time** | Keep current | `npm install @kibocorp/ui-relative-time` |
| Overdue indicator | Warning badge | Custom OverdueTag | **Status** | Keep current | `npm install @kibocorp/ui-status` |

**Installation Group 8 - Notifications**:
```bash
npm install @kibocorp/ui-reel @kibocorp/ui-banner @kibocorp/ui-status @kibocorp/ui-mini-calendar @kibocorp/ui-list @kibocorp/ui-relative-time
```

---

### 9. Navigation & Layout

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Top navbar | Header | Custom DashboardHeader | **Pill** (nav items) | Keep current | `npm install @kibocorp/ui-pill` |
| Logo area | Branding | Custom Logo | *N/A* | Keep current | N/A |
| Navigation items | Menu links | Custom NavItem | **Pill** | Keep current | `npm install @kibocorp/ui-pill` |
| User menu | Dropdown | Custom UserMenu | **Dialog Stack** | Keep current | `npm install @kibocorp/ui-dialog-stack` |
| Mobile nav | Bottom tabs | Custom MobileNav | **Pill** | Keep current | `npm install @kibocorp/ui-pill` |
| Sidebar | Left menu | Custom DashboardSidebar | *N/A* | Keep current | N/A |
| Footer | Bottom section | Custom Footer | **Typography** | Keep current | `npm install @kibocorp/ui-typography` |

**Installation Group 9 - Navigation**:
```bash
npm install @kibocorp/ui-pill @kibocorp/ui-dialog-stack @kibocorp/ui-typography
```

---

### 10. Data Display & Analytics

| FEED Feature | UI Element | Current Implementation | Kibo Component | Fallback | Install Command |
|---|---|---|---|---|---|
| Stat card | Metric display | Custom StatCard | **Status** or **Card** | Keep current | `npm install @kibocorp/ui-status` |
| Metric value | Number display | Custom text | **Typography** | Keep current | `npm install @kibocorp/ui-typography` |
| Metric trend | Up/down indicator | Custom TrendIcon | **Status** | Keep current | `npm install @kibocorp/ui-status` |
| Progress indicator | Status bar | Custom Progress | **Status** (progress) | Keep current | `npm install @kibocorp/ui-status` |
| Application table | Data grid | Custom ApplicationTable | **Table** | Keep current | `npm install @kibocorp/ui-table` |
| Contribution graph | Visual display | Custom Grid | **Contribution Graph** | Keep current | `npm install @kibocorp/ui-contribution-graph` |
| Rating display | Star display | Custom RatingComponent | **Rating** | Keep current | `npm install @kibocorp/ui-rating` |

**Installation Group 10 - Analytics**:
```bash
npm install @kibocorp/ui-status @kibocorp/ui-typography @kibocorp/ui-table @kibocorp/ui-contribution-graph @kibocorp/ui-rating
```

---

## Summary Installation Command

Install all recommended Kibo components:

```bash
# Core Kibo component library
npm install @kibocorp/ui

# Or install specific groups by feature:
npm install @kibocorp/ui-pill @kibocorp/ui-tags @kibocorp/ui-banner @kibocorp/ui-combobox @kibocorp/ui-list @kibocorp/ui-dialog-stack @kibocorp/ui-reel @kibocorp/ui-avatar-stack @kibocorp/ui-relative-time @kibocorp/ui-editor @kibocorp/ui-dropzone @kibocorp/ui-status @kibocorp/ui-choicebox @kibocorp/ui-mini-calendar @kibocorp/ui-announcement @kibocorp/ui-image-zoom @kibocorp/ui-typography @kibocorp/ui-table @kibocorp/ui-contribution-graph @kibocorp/ui-rating
```

---

## Integration Strategy

### Phase 1: Foundation (Current)
Focus on core navigation and layout with Kibo's basic components:
- **Pill** - Navigation items, quick actions
- **Banner** - Crisis alerts, announcements
- **Dialog Stack** - Modals and overlays

```bash
npm install @kibocorp/ui-pill @kibocorp/ui-banner @kibocorp/ui-dialog-stack
```

### Phase 2: Feature Enhancement
Add data visualization and content components:
- **Status** - Application status badges, progress indicators
- **List** - Resource and document listings
- **Reel** - Feed posts, notification cards
- **Avatar Stack** - User profiles and teams

```bash
npm install @kibocorp/ui-status @kibocorp/ui-list @kibocorp/ui-reel @kibocorp/ui-avatar-stack
```

### Phase 3: Form & Input Enhancement
Upgrade form components for better UX:
- **Combobox** - Smart search inputs
- **Dropzone** - File uploads
- **Tags** - Multi-select inputs
- **Mini Calendar** - Date picking
- **Choicebox** - Styled checkboxes/radios

```bash
npm install @kibocorp/ui-combobox @kibocorp/ui-dropzone @kibocorp/ui-tags @kibocorp/ui-mini-calendar @kibocorp/ui-choicebox
```

### Phase 4: Advanced Features
Add specialized components:
- **Contribution Graph** - Impact metrics
- **Editor** - Rich text editing
- **Image Zoom** - Document previews
- **Rating** - User feedback
- **Relative Time** - Smart timestamp display

```bash
npm install @kibocorp/ui-contribution-graph @kibocorp/ui-editor @kibocorp/ui-image-zoom @kibocorp/ui-rating @kibocorp/ui-relative-time
```

---

## Component Replacement Guide

### How to Replace shadcn Components with Kibo Equivalents

#### Example 1: Button → Pill Navigation
**Before (shadcn)**:
```tsx
import { Button } from '@/components/ui/button'

export function NavItems() {
  return (
    <div className="flex gap-2">
      <Button variant="ghost">Dashboard</Button>
      <Button variant="ghost">Resources</Button>
      <Button variant="ghost">Chat</Button>
    </div>
  )
}
```

**After (Kibo Pill)**:
```tsx
import { Pill } from '@kibocorp/ui/pill'

export function NavItems() {
  return (
    <div className="flex gap-2">
      <Pill selected={pathname === '/dashboard'}>Dashboard</Pill>
      <Pill selected={pathname === '/resources'}>Resources</Pill>
      <Pill selected={pathname === '/chat'}>Chat</Pill>
    </div>
  )
}
```

#### Example 2: Card → Reel (Feed Posts)
**Before (shadcn)**:
```tsx
import { Card, CardContent } from '@/components/ui/card'

export function PostCard({ post }) {
  return (
    <Card>
      <CardContent>
        <p>{post.content}</p>
      </CardContent>
    </Card>
  )
}
```

**After (Kibo Reel)**:
```tsx
import { Reel } from '@kibocorp/ui/reel'

export function PostCard({ post }) {
  return (
    <Reel variant="card" className="mb-4">
      <p>{post.content}</p>
    </Reel>
  )
}
```

#### Example 3: Form Input → Combobox (Search)
**Before (shadcn)**:
```tsx
import { Input } from '@/components/ui/input'

export function ResourceSearch() {
  return <Input placeholder="Search resources..." />
}
```

**After (Kibo Combobox)**:
```tsx
import { Combobox } from '@kibocorp/ui/combobox'

export function ResourceSearch() {
  return (
    <Combobox
      placeholder="Search resources..."
      items={resources}
      onSelect={handleSelect}
      searchable
    />
  )
}
```

---

## Current Implementation Status

### Fully Implemented (No Kibo needed)
- ✅ Custom PostCard with PostComposer
- ✅ Custom DashboardLayout with sidebar navigation
- ✅ Custom ApplicationCard and ApplicationList
- ✅ Custom ChatInterface with streaming support
- ✅ Custom MapView with Mapbox GL JS
- ✅ Custom DocumentCard and DocumentUpload
- ✅ Custom FormRenderer with dynamic fields
- ✅ Custom SignatureCanvas (Canvas API)
- ✅ Custom NotificationDropdown

### Can Be Enhanced with Kibo
- 🔄 Navigation items → Pill component
- 🔄 Status badges → Status component
- 🔄 Search inputs → Combobox component
- 🔄 File uploads → Dropzone component
- 🔄 Modal dialogs → Dialog Stack component
- 🔄 Feed content → Reel component

### Not Applicable to Kibo
- ❌ Mapbox integration (external library)
- ❌ Real-time subscriptions (business logic)
- ❌ Encryption utilities (zero-trust crypto)
- ❌ Chat streaming (server-side logic)
- ❌ Email authentication (Supabase feature)

---

## Migration Checklist

When implementing Kibo components:

- [ ] Install Kibo component package
- [ ] Review Kibo component API documentation
- [ ] Update component file imports
- [ ] Test responsive behavior
- [ ] Test accessibility (ARIA)
- [ ] Update TypeScript types if needed
- [ ] Test on mobile devices
- [ ] Verify styling matches design tokens
- [ ] Update component stories/docs
- [ ] Run type-check: `npm run type-check`
- [ ] Run build: `npm run build`

---

## Design Token Alignment

Kibo components should align with FEED's design tokens defined in:
- **Colors**: `packages/ui/tokens/colors.ts`
- **Typography**: `packages/ui/tokens/typography.ts`
- **Spacing**: Tailwind config in `apps/web/tailwind.config.ts`

Verify Kibo component theming supports:
- Primary color (FEED green)
- Secondary/accent colors
- Dark mode support
- Custom font families
- Spacing scale

---

## Performance Considerations

When adding Kibo components:

1. **Bundle Size**: Check each component's bundle impact
   ```bash
   npm run build && npm run analyze  # See bundle analysis
   ```

2. **Code Splitting**: Kibo components are tree-shakeable
   ```tsx
   // Good - individual imports
   import { Pill } from '@kibocorp/ui/pill'

   // Avoid - barrel imports that force full tree load
   import { Pill } from '@kibocorp/ui'
   ```

3. **Lazy Loading**: Consider lazy-loading heavy components
   ```tsx
   const Editor = dynamic(() => import('@kibocorp/ui/editor'), {
     loading: () => <div>Loading editor...</div>,
   })
   ```

---

## Accessibility Checklist

All Kibo components should support:
- ✅ Keyboard navigation
- ✅ Screen reader (ARIA labels)
- ✅ Color contrast (WCAG AA)
- ✅ Focus indicators
- ✅ Mobile touch targets (44×44px minimum)

Test with:
```bash
npx lighthouse https://localhost:3000 --view
# Expect Accessibility score > 90
```

---

## Version Compatibility

| Kibo Version | Next.js | React | Status |
|---|---|---|---|
| @kibocorp/ui@latest | 15.x | 19.x | ✅ Compatible |
| @kibocorp/ui@2.x | 14.x | 18.x | ✅ Compatible |
| @kibocorp/ui@1.x | 13.x | 18.x | ⚠️ Legacy |

Install Kibo components that match your Next.js version:
```bash
# For Next.js 15.x (Current)
npm install @kibocorp/ui@latest

# For Next.js 14.x
npm install @kibocorp/ui@2
```

---

## Documentation & Resources

- **Kibo UI Docs**: https://kibocorp.com/ui/docs
- **Component Storybook**: https://kibocorp.com/ui/storybook
- **API Reference**: https://kibocorp.com/ui/api
- **Design System**: https://kibocorp.com/design

---

## Notes & Best Practices

1. **Keep Custom Components When Needed**
   - Mapbox integration is already optimized
   - SignatureCanvas uses native Canvas API (lightweight)
   - Keep custom implementations for FEED-specific logic

2. **Use Kibo for UI Polish**
   - Navigation enhancements (Pill)
   - Status indicators (Status)
   - Search optimization (Combobox)
   - Modal management (Dialog Stack)

3. **Theming Strategy**
   - Kibo components inherit Tailwind theme
   - Override with CSS variables if needed
   - Test dark mode compatibility

4. **Testing Kibo Components**
   - Test keyboard navigation
   - Test screen reader output
   - Test touch interactions on mobile
   - Test with different viewport sizes

5. **Commit Strategy**
   - One Kibo component per commit
   - Include before/after screenshots in PR
   - Document any breaking changes
   - Update this mapping document

---

## Future Recommendations

### Short Term (Phase 6+)
- Replace basic buttons with Pill for navigation
- Upgrade status displays with Status component
- Enhance search with Combobox

### Medium Term (Ongoing)
- Implement Editor for rich text content
- Add Contribution Graph for impact metrics
- Use Dialog Stack for complex forms

### Long Term (Version 2.0)
- Consider comprehensive Kibo design system migration
- Evaluate Kibo's themed component library
- Assess custom theme development with Kibo

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-30
**Maintained By**: FEED Development Team
**Next Review**: 2026-02-28
