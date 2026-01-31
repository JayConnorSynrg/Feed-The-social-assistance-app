# Kibo Component Quick Reference

**Quick lookup table for FEED platform features and their Kibo equivalents.**

## Navigation & Buttons
| Use Case | Kibo Component | Install | Tier |
|---|---|---|---|
| Nav menu items | `Pill` | `npm install @kibocorp/ui-pill` | Phase 1 |
| Action buttons | Keep `Button` | - | N/A |
| Quick action pills | `Pill` | `npm install @kibocorp/ui-pill` | Phase 1 |
| Tabs/menu selector | `Pill` | `npm install @kibocorp/ui-pill` | Phase 1 |

## Alerts & Notifications
| Use Case | Kibo Component | Install | Tier |
|---|---|---|---|
| Crisis banner | `Banner` | `npm install @kibocorp/ui-banner` | Phase 1 |
| Announcements | `Announcement` | `npm install @kibocorp/ui-announcement` | Phase 3 |
| Status alerts | Keep custom | - | N/A |
| Notification list | `Reel` | `npm install @kibocorp/ui-reel` | Phase 2 |

## Modals & Dialogs
| Use Case | Kibo Component | Install | Tier |
|---|---|---|---|
| Modal forms | `Dialog Stack` | `npm install @kibocorp/ui-dialog-stack` | Phase 1 |
| User menu | `Dialog Stack` | `npm install @kibocorp/ui-dialog-stack` | Phase 1 |
| Document viewer | `Dialog Stack` | `npm install @kibocorp/ui-dialog-stack` | Phase 1 |
| Confirmation dialogs | `Dialog Stack` | `npm install @kibocorp/ui-dialog-stack` | Phase 1 |

## Forms & Inputs
| Use Case | Kibo Component | Install | Tier |
|---|---|---|---|
| Text input | Keep `Input` | - | N/A |
| Search input | `Combobox` | `npm install @kibocorp/ui-combobox` | Phase 3 |
| Select dropdown | `Combobox` | `npm install @kibocorp/ui-combobox` | Phase 3 |
| Checkbox field | `Choicebox` | `npm install @kibocorp/ui-choicebox` | Phase 3 |
| Radio buttons | `Choicebox` | `npm install @kibocorp/ui-choicebox` | Phase 3 |
| Multi-select tags | `Tags` | `npm install @kibocorp/ui-tags` | Phase 3 |
| Date picker | `Mini Calendar` | `npm install @kibocorp/ui-mini-calendar` | Phase 3 |
| File upload | `Dropzone` | `npm install @kibocorp/ui-dropzone` | Phase 3 |
| Rich text editor | `Editor` | `npm install @kibocorp/ui-editor` | Phase 4 |

## Content Display
| Use Case | Kibo Component | Install | Tier |
|---|---|---|---|
| Feed posts | `Reel` | `npm install @kibocorp/ui-reel` | Phase 2 |
| Card containers | Keep `Card` | - | N/A |
| List items | `List` | `npm install @kibocorp/ui-list` | Phase 2 |
| Data tables | `Table` | `npm install @kibocorp/ui-table` | Phase 4 |
| Timeline | Keep custom | - | N/A |

## Status & Indicators
| Use Case | Kibo Component | Install | Tier |
|---|---|---|---|
| Status badge | `Status` | `npm install @kibocorp/ui-status` | Phase 2 |
| Progress indicator | `Status` | `npm install @kibocorp/ui-status` | Phase 2 |
| Badge/count | Keep custom | - | N/A |
| Relative time | `Relative Time` | `npm install @kibocorp/ui-relative-time` | Phase 2 |
| Star rating | `Rating` | `npm install @kibocorp/ui-rating` | Phase 4 |

## User & Profile
| Use Case | Kibo Component | Install | Tier |
|---|---|---|---|
| Avatar display | `Avatar Stack` | `npm install @kibocorp/ui-avatar-stack` | Phase 2 |
| User group avatars | `Avatar Stack` | `npm install @kibocorp/ui-avatar-stack` | Phase 2 |
| Contribution graph | `Contribution Graph` | `npm install @kibocorp/ui-contribution-graph` | Phase 4 |

## Media & Files
| Use Case | Kibo Component | Install | Tier |
|---|---|---|---|
| Image preview/zoom | `Image Zoom` | `npm install @kibocorp/ui-image-zoom` | Phase 3 |
| Video player | `Video Player` | `npm install @kibocorp/ui-video-player` | Phase 4 |
| Code display | Keep custom | - | N/A |

## NOT Applicable to Kibo
These should remain as custom implementations:
- ❌ Mapbox map integration (external library)
- ❌ Signature canvas (native Canvas API)
- ❌ Chat streaming (server business logic)
- ❌ Real-time subscriptions (Supabase feature)
- ❌ Encryption utilities (crypto library)

---

## Installation by Phase

### Phase 1: Foundation
```bash
npm install @kibocorp/ui-pill @kibocorp/ui-banner @kibocorp/ui-dialog-stack
```
**Files to update**:
- `apps/web/src/components/dashboard/dashboard-layout.tsx` (NavItem → Pill)
- `apps/web/src/components/chat/chat-interface.tsx` (Banner for crisis)
- All modal implementations (→ Dialog Stack)

### Phase 2: Feature Enhancement
```bash
npm install @kibocorp/ui-status @kibocorp/ui-list @kibocorp/ui-reel @kibocorp/ui-avatar-stack @kibocorp/ui-relative-time
```
**Files to update**:
- `apps/web/src/components/feed/post-card.tsx` (→ Reel)
- `apps/web/src/components/dashboard/application-list.tsx` (Status)
- `apps/web/src/components/dashboard/stat-card.tsx` (Status)
- `apps/web/src/components/profile/avatar.tsx` (Avatar Stack)

### Phase 3: Form Enhancement
```bash
npm install @kibocorp/ui-combobox @kibocorp/ui-dropzone @kibocorp/ui-tags @kibocorp/ui-mini-calendar @kibocorp/ui-choicebox @kibocorp/ui-announcement @kibocorp/ui-image-zoom
```
**Files to update**:
- `apps/web/src/components/forms/dynamic-form-renderer.tsx` (all inputs)
- `apps/web/src/components/documents/document-upload.tsx` (Dropzone)
- `apps/web/src/components/forms/autofill-banner.tsx` (Announcement)
- `apps/web/src/components/documents/document-viewer.tsx` (Image Zoom)

### Phase 4: Advanced Features
```bash
npm install @kibocorp/ui-contribution-graph @kibocorp/ui-editor @kibocorp/ui-rating @kibocorp/ui-table
```
**Files to update**:
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` (Contribution Graph)
- `apps/web/src/components/forms/post-composer.tsx` (Editor)
- Dashboard stats views (Rating for user feedback)
- Data heavy pages (Table)

---

## Component Import Pattern

### Correct (Individual imports)
```typescript
import { Pill } from '@kibocorp/ui/pill'
import { Reel } from '@kibocorp/ui/reel'
import { Status } from '@kibocorp/ui/status'
```

### Avoid (Barrel imports)
```typescript
// ❌ This loads the whole library
import { Pill, Reel, Status } from '@kibocorp/ui'
```

---

## Testing Checklist

Before marking a component migration complete:

- [ ] Component renders correctly
- [ ] Responsive on mobile (640px, 768px, 1024px)
- [ ] Keyboard navigation works
- [ ] Screen reader announces content
- [ ] Touch targets are 44px minimum
- [ ] Color contrast meets WCAG AA
- [ ] Type checking passes: `npm run type-check`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors/warnings

---

## Common Gotchas

1. **Props Name Differences**
   - Kibo uses different prop names than shadcn/ui
   - Always check the Kibo docs before migrating

2. **Styling Conflicts**
   - Kibo components may have different default styles
   - Test with FEED's color tokens

3. **Dark Mode**
   - Verify Kibo component supports dark mode
   - Test with `prefers-color-scheme: dark`

4. **TypeScript**
   - Some Kibo components have strict type requirements
   - Run type-check after adding any Kibo component

5. **Bundle Size**
   - Individual component imports keep bundle small
   - Verify final bundle size: `npm run build && npm run analyze`

---

## Decision Matrix: Keep Custom vs Use Kibo

| Factor | Keep Custom | Use Kibo |
|---|---|---|
| **Domain-specific logic** | Complex state management | Simple display |
| **Integration needs** | External library integration | Standalone component |
| **Performance critical** | Custom optimization | Standard performance OK |
| **Design flexibility** | Highly custom design | Design system compliant |
| **Bundle impact** | Already included | Small (<5KB) |
| **Accessibility** | Custom ARIA needed | Built-in WCAG |

**Example Applications**:
- ✅ Keep custom: `MapView` (Mapbox specific), `SignatureCanvas` (Canvas API)
- ✅ Use Kibo: Navigation pills, status badges, search inputs
- 🤔 Decision needed: Form inputs (might keep custom for autofill)

---

**Last Updated**: 2026-01-30
**Quick Ref Version**: 1.0.0
