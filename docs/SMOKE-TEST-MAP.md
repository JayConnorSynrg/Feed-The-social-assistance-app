# FEED Smoke Test Map

Generated: 2026-05-29  
Branch: feature/smoke-suite  
Prod: https://www.sourcetofeed.com  
Supabase: ndtpovonpadugthmcntl

---

## Feature Coverage Table

| Feature | User Surface (panel + element) | Interaction | Backend (edge fn / table / RPC / API route) | Hook | Smoke test name |
|---|---|---|---|---|---|
| **Login** | `(auth)/login/page.tsx` — `#email` + `#password` + `button[type=submit]` | Fill creds → submit → redirect to `/` | Supabase `auth.signInWithPassword` → `profiles` table via `auth-provider.tsx` | `use-auth.ts` | `auth.spec: login succeeds` |
| **Logout** | `feed-shell.tsx:177` — sign-out button in top nav dropdown | Click sign-out → router.push('/login') | Supabase `auth.signOut()` | `auth-provider.tsx signOut()` | `auth.spec: logout redirects to /login` |
| **Signup** | `(auth)/signup/page.tsx` — email + password fields + submit | Fill → submit → email confirm (bypassed via service role) | Supabase `auth.signUp` → profile trigger `20260219000000_create_profile_trigger.sql` | `auth-provider.tsx` | `auth.spec` fixture (ephemeral user creation) |
| **Delete Account** | `settings-panel.tsx:718` — "Delete Account" button → confirm "Yes, delete everything" | Click → confirm → edge fn call → sign-out | `supabase/functions/delete-account/index.ts` | `settings-panel.tsx handleDeleteAccount` | `delete-account.spec` |
| **Overview** | `overview-panel.tsx` — panel renders welcome card + profile stats | Navigate to `/#overview` → panel content visible | `profiles` table (read via AuthProvider) | `use-auth.ts` | `overview.spec` |
| **AI Chat (send message)** | `chat-panel.tsx` — message input + send button | Type message → submit → streaming response appears | `supabase/functions/chat/index.ts` (OpenRouter proxy) — POST via fetch SSE | `use-chat.ts` | `chat.spec` |
| **Map (resources_in_bounds)** | `map-panel.tsx:284` — map canvas + resource list tiles | Load map panel → bounds set → markers/tiles appear or empty-state | `supabase/functions/` (none — direct RPC) → `resources_in_bounds` RPC `20260529000001_add_resources_in_bounds_rpc.sql` | `use-viewport-resources.ts:120` | `map.spec` |
| **Programs browse** | `programs-panel.tsx` — program cards + category filter | Load panel → programs list renders or empty-state | `programs` table `20260527000005_seed_rutland_programs.sql` + `idx_resources_browse` index | `use-program-browser.ts` | `programs.spec` |
| **Community Feed (view posts)** | `feed-panel.tsx` — post cards or empty-state | Navigate to `/#feed` → feed tab active → content visible | `posts` table `20260220200000_add_community_feed_tables.sql` + realtime channel | `use-realtime-feed.ts` | `feed.spec` |
| **Community Feed (create post)** | `feed-panel.tsx` — post composer textarea + submit button | Type post content → submit → post appears in feed | `posts` table INSERT via Supabase client | `use-realtime-feed.ts` | `feed.spec` |
| **Messages tab (nav-nest)** | `feed-panel.tsx:282` — "Messages" tab inside Community Feed panel | Click Messages tab from sidebar OR via panel alias | `conversations` + `messages` tables `20260527000001_add_volunteer_messaging.sql` | `use-conversations.ts` | `nav.spec` |
| **Documents & Forms (nav-nest)** | `documents-panel.tsx` — sidebar shows "Documents & Forms"; Forms tab inside | Click Documents & Forms sidebar item → panel opens; click Forms tab | `form_submissions` table (forms tab) / Supabase Storage `user_documents` (docs tab) | `use-documents.ts` / `use-form-templates.ts` | `nav.spec` |
| **Documents (upload)** | `documents-panel.tsx:544` — upload button → file picker → encrypt → Supabase Storage | Click upload → select file → confirm → document appears | Supabase Storage `user_documents` bucket + `user_documents` table | `use-encrypted-upload.ts` | `documents.spec` |
| **Forms (list)** | `forms-panel.tsx` — form template cards | Navigate to Forms tab → templates visible | `form_templates` table `20260119000004_form_tables.sql` | `use-form-templates.ts` | `forms.spec` |
| **Applications (list)** | `applications-panel.tsx` — application cards or empty-state | Navigate to `/#applications` → panel loads | `form_submissions` table (status filter) | `use-applications.ts` | `applications.spec` |
| **Settings (profile save)** | `settings-panel.tsx` — profile form + save button | Load settings → edit display name → save | `profiles` table UPDATE via `auth-provider.tsx updateProfile` | `use-secure-profile.ts` | `settings.spec` |
| **Volunteer FAB** | `map-panel.tsx` (bottom-right FAB, scope: map) | Load map → FAB visible with aria-label | No backend call on render — opens speed-dial | `use-volunteer-resource.ts` | `map.spec` |

---

## File:line Citations

| Feature | Panel file:line | Backend file |
|---|---|---|
| Login form | `apps/web/src/app/(auth)/login/page.tsx:241` | Supabase auth.signInWithPassword |
| Logout button | `apps/web/src/components/layout/feed-shell.tsx:177` | `auth-provider.tsx:152` |
| Delete Account | `apps/web/src/components/panels/settings-panel.tsx:557` | `supabase/functions/delete-account/index.ts` |
| Map RPC | `apps/web/src/hooks/use-viewport-resources.ts:120` | `supabase/migrations/20260529000001_add_resources_in_bounds_rpc.sql` |
| Chat edge fn | `apps/web/src/hooks/use-chat.ts:57` | `supabase/functions/chat/index.ts:13` |
| Feed realtime | `apps/web/src/hooks/use-realtime-feed.ts:60` | `supabase/migrations/20260220200000_add_community_feed_tables.sql` |
| Documents upload | `apps/web/src/hooks/use-encrypted-upload.ts` | Supabase Storage bucket: user_documents |
| Forms list | `apps/web/src/hooks/use-form-templates.ts` | `form_templates` table |
| Applications | `apps/web/src/hooks/use-applications.ts:115` | `form_submissions` table |
| Messages nav-nest | `apps/web/src/components/panels/feed-panel.tsx:282` | `conversations` table |
| Forms nav-nest | `apps/web/src/components/panels/documents-panel.tsx:598` | `form_submissions` table |
| Volunteer FAB | `apps/web/src/components/panels/map-panel.tsx` | `use-volunteer-resource.ts` |
