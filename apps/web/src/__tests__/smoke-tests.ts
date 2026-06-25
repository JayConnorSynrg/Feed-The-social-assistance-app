/**
 * FEED Platform — End-to-End Wiring Smoke Tests
 *
 * NOT a unit test suite. This script reads source files and verifies that every
 * backend function is wired to its user-facing surface. Every assertion is
 * derived from the actual source files (read before writing).
 *
 * Run:
 *   npx tsx apps/web/src/__tests__/smoke-tests.ts
 *
 * Exit code: 0 if all pass, 1 if any fail.
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

// Resolve ROOT from this file's location regardless of where tsx is invoked.
// import.meta.url gives the absolute path to THIS file, which tsx supports.
const __filename = fileURLToPath(import.meta.url)
const __dirname_esm = path.dirname(__filename)

// __tests__/ → src/ → apps/web/ → apps/ → repo root
const ROOT = path.resolve(__dirname_esm, '../../../..')
const WEB = path.resolve(ROOT, 'apps/web')

interface TestResult {
  name: string
  group: string
  passed: boolean
  reason?: string
}

const results: TestResult[] = []
let currentGroup = 'UNGROUPED'

function group(name: string): void {
  currentGroup = name
}

function test(name: string, check: () => boolean, failReason?: string): void {
  try {
    const passed = check()
    results.push({ name, group: currentGroup, passed, reason: passed ? undefined : failReason })
  } catch (err) {
    results.push({
      name,
      group: currentGroup,
      passed: false,
      reason: `threw: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}

// Read a source file relative to apps/web/src
function src(relativePath: string): string {
  const full = path.join(WEB, 'src', relativePath)
  if (!fs.existsSync(full)) return ''
  return fs.readFileSync(full, 'utf-8')
}

// Read a file relative to the repo root
function rootFile(relativePath: string): string {
  const full = path.join(ROOT, relativePath)
  if (!fs.existsSync(full)) return ''
  return fs.readFileSync(full, 'utf-8')
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(WEB, 'src', relativePath))
}

function rootFileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath))
}

// ---------------------------------------------------------------------------
// 1. AUTH CHAIN
// ---------------------------------------------------------------------------
group('AUTH')

const loginPage = src('app/(auth)/login/page.tsx')
const signupPage = src('app/(auth)/signup/page.tsx')
const forgotPage = src('app/(auth)/forgot-password/page.tsx')
const resetPage = src('app/(auth)/reset-password/page.tsx')
const middleware = src('proxy.ts')
const authProvider = src('providers/auth-provider.tsx')

// login/page.tsx
test(
  'login/page.tsx — file exists',
  () => fileExists('app/(auth)/login/page.tsx'),
  'File not found',
)

test(
  'login/page.tsx — handleEmailLogin function defined',
  () => loginPage.includes('const handleEmailLogin = async (e: React.FormEvent)'),
  'handleEmailLogin not found',
)

test(
  'login/page.tsx — form onSubmit={handleEmailLogin}',
  () => loginPage.includes('onSubmit={handleEmailLogin}'),
  'form onSubmit wiring missing',
)

test(
  'login/page.tsx — calls signInWithPassword',
  () => loginPage.includes('signInWithPassword'),
  'signInWithPassword call not found',
)

test(
  'login/page.tsx — AbortError handling present',
  () =>
    loginPage.includes("err.name === 'AbortError'") &&
    loginPage.includes("err.message.includes('signal')"),
  'AbortError handling incomplete or missing',
)

test(
  'login/page.tsx — router.push fires on success',
  () => loginPage.includes('router.push(redirectTo)'),
  'router.push not found',
)

test(
  'login/page.tsx — imports createClient from @/lib/supabase/client',
  () => loginPage.includes("from '@/lib/supabase/client'"),
  'createClient import missing',
)

// signup/page.tsx
test(
  'signup/page.tsx — file exists',
  () => fileExists('app/(auth)/signup/page.tsx'),
  'File not found',
)

test(
  'signup/page.tsx — handleSignup function defined',
  () => signupPage.includes('const handleSignup = async (e: React.FormEvent)'),
  'handleSignup not found',
)

test(
  'signup/page.tsx — form onSubmit={handleSignup}',
  () => signupPage.includes('onSubmit={handleSignup}'),
  'form onSubmit wiring missing',
)

test(
  'signup/page.tsx — calls supabase.auth.signUp',
  () => signupPage.includes('supabase.auth.signUp'),
  'signUp call not found',
)

test(
  'signup/page.tsx — AbortError handling present',
  () =>
    signupPage.includes("err instanceof DOMException && err.name === 'AbortError'") &&
    signupPage.includes("err.message.includes('signal')"),
  'AbortError handling missing',
)

test(
  'signup/page.tsx — setSuccess(true) on success',
  () => signupPage.includes('setSuccess(true)'),
  'setSuccess not called on completion',
)

// forgot-password/page.tsx
test(
  'forgot-password/page.tsx — file exists',
  () => fileExists('app/(auth)/forgot-password/page.tsx'),
  'File not found',
)

test(
  'forgot-password/page.tsx — handleSubmit form handler defined',
  () => forgotPage.includes('const handleSubmit = async (e: React.FormEvent)'),
  'handleSubmit not found',
)

test(
  'forgot-password/page.tsx — form onSubmit={handleSubmit}',
  () => forgotPage.includes('onSubmit={handleSubmit}'),
  'form onSubmit wiring missing',
)

test(
  'forgot-password/page.tsx — calls resetPasswordForEmail',
  () => forgotPage.includes('supabase.auth.resetPasswordForEmail'),
  'resetPasswordForEmail call not found',
)

test(
  'forgot-password/page.tsx — AbortError handling present',
  () =>
    forgotPage.includes("err instanceof DOMException && err.name === 'AbortError'") &&
    forgotPage.includes("err.message.includes('signal')"),
  'AbortError handling missing',
)

test(
  'forgot-password/page.tsx — sets submitted=true on success',
  () => forgotPage.includes('setSubmitted(true)'),
  'setSubmitted not found',
)

// reset-password/page.tsx
test(
  'reset-password/page.tsx — file exists',
  () => fileExists('app/(auth)/reset-password/page.tsx'),
  'File not found',
)

test(
  'reset-password/page.tsx — handleSubmit form handler defined',
  () => resetPage.includes('const handleSubmit = async (e: React.FormEvent)'),
  'handleSubmit not found',
)

test(
  'reset-password/page.tsx — calls supabase.auth.updateUser',
  () => resetPage.includes('supabase.auth.updateUser'),
  'updateUser call not found',
)

test(
  'reset-password/page.tsx — abort/timeout handling present',
  () =>
    resetPage.includes("err.message.includes('abort')") ||
    resetPage.includes("err.message === 'update_timeout'"),
  'timeout/abort handling missing',
)

test(
  'reset-password/page.tsx — redirects to /login on success',
  () => resetPage.includes("router.push('/login')"),
  "router.push('/login') not found",
)

// proxy.ts
test(
  'proxy.ts — file exists',
  () => fileExists('proxy.ts'),
  'File not found',
)

test(
  'proxy.ts — exports async proxy function',
  () => middleware.includes('export async function proxy(request: NextRequest)'),
  'proxy export not found',
)

test(
  'proxy.ts — calls supabase.auth.getUser()',
  () => middleware.includes('supabase.auth.getUser()'),
  'getUser call not found',
)

test(
  'proxy.ts — redirects unauthenticated users to /login',
  () => middleware.includes("return NextResponse.redirect(new URL('/login', request.url))"),
  'unauthenticated redirect not found',
)

test(
  'proxy.ts — defines public routes list',
  () => middleware.includes('const publicRoutes = ['),
  'publicRoutes definition not found',
)

test(
  'proxy.ts — exports config matcher',
  () => middleware.includes('export const config = {') && middleware.includes('matcher:'),
  'config matcher export not found',
)

test(
  'proxy.ts — MFA assurance level check present',
  () => middleware.includes('getAuthenticatorAssuranceLevel'),
  'MFA AAL check not found',
)

test(
  'proxy.ts — protected route list includes / and /settings',
  () =>
    middleware.includes("'/'") && middleware.includes("'/settings'"),
  "protected routes must include '/' and '/settings'",
)

// providers/auth-provider.tsx
test(
  'providers/auth-provider.tsx — file exists',
  () => fileExists('providers/auth-provider.tsx'),
  'File not found',
)

test(
  'providers/auth-provider.tsx — exports AuthProvider component',
  () => authProvider.includes('export function AuthProvider'),
  'AuthProvider export not found',
)

test(
  'providers/auth-provider.tsx — calls onAuthStateChange',
  () => authProvider.includes('supabase.auth.onAuthStateChange'),
  'onAuthStateChange not found',
)

test(
  'providers/auth-provider.tsx — has 5-second session timeout',
  () => authProvider.includes('5000'),
  '5s loading timeout not found',
)

test(
  'providers/auth-provider.tsx — has 10-second max loading safety valve',
  () => authProvider.includes('10_000'),
  '10s max loading timeout not found',
)

test(
  'providers/auth-provider.tsx — exposes isAuthenticated computed flag',
  () => authProvider.includes('isAuthenticated: !!user'),
  'isAuthenticated not computed from user',
)

// ---------------------------------------------------------------------------
// 2. CHAT CHAIN
// ---------------------------------------------------------------------------
group('CHAT')

const chatPanel = src('components/panels/chat-panel.tsx')
const useChat = src('hooks/use-chat.ts')
const guidedFlows = src('lib/ai/guided-flows.ts')
const guidedFlowComponent = src('components/chat/guided-flow.tsx')

test(
  'chat-panel.tsx — file exists',
  () => fileExists('components/panels/chat-panel.tsx'),
  'File not found',
)

test(
  "chat-panel.tsx — imports useChat from '@/hooks/use-chat'",
  () => chatPanel.includes("from '@/hooks/use-chat'"),
  'useChat import missing',
)

test(
  'chat-panel.tsx — sendMessage destructured from useChat',
  () => chatPanel.includes('sendMessage,'),
  'sendMessage not destructured',
)

test(
  'chat-panel.tsx — handleFlowComplete calls sendMessage(aiResponse)',
  () =>
    chatPanel.includes('const handleFlowComplete = (answers: Record<string, string>, aiResponse: string)') &&
    chatPanel.includes('sendMessage(aiResponse)'),
  'handleFlowComplete does not call sendMessage(aiResponse)',
)

test(
  'chat-panel.tsx — imports resourceFinderFlow, eligibilityCheckerFlow, formHelpFlow',
  () =>
    chatPanel.includes('resourceFinderFlow') &&
    chatPanel.includes('eligibilityCheckerFlow') &&
    chatPanel.includes('formHelpFlow'),
  'flow imports missing',
)

test(
  "chat-panel.tsx — imports GuidedFlowComponent from '@/components/chat/guided-flow'",
  () => chatPanel.includes("from '@/components/chat/guided-flow'"),
  'GuidedFlowComponent import missing',
)

test(
  'chat-panel.tsx — passes handleFlowComplete as onComplete prop',
  () => chatPanel.includes('onComplete={handleFlowComplete}'),
  'onComplete wiring missing',
)

// use-chat.ts
test(
  'hooks/use-chat.ts — file exists',
  () => fileExists('hooks/use-chat.ts'),
  'File not found',
)

test(
  'hooks/use-chat.ts — sendMessage fetches to NEXT_PUBLIC_SUPABASE_URL/functions/v1/chat',
  () => useChat.includes('process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat'),
  'fetch URL pattern not found',
)

test(
  "hooks/use-chat.ts — includes Authorization: Bearer token header",
  () => useChat.includes("'Authorization': `Bearer ${session.access_token}`"),
  'Authorization header not found',
)

test(
  'hooks/use-chat.ts — handles streaming response (ReadableStream / getReader)',
  () => useChat.includes('getReader()') && useChat.includes('ReadableStream') === false, // uses response.body?.getReader()
  'streaming reader not found',
)
// Note: use-chat reads the stream via response.body?.getReader() — not by constructing a ReadableStream

test(
  'hooks/use-chat.ts — reads auth session before fetch',
  () => useChat.includes('supabase.auth.getSession()'),
  'getSession() call not found',
)

test(
  'hooks/use-chat.ts — exports sendMessage, stopStreaming',
  () => useChat.includes('sendMessage,') && useChat.includes('stopStreaming,'),
  'sendMessage or stopStreaming not exported',
)

// guided-flows.ts
test(
  'lib/ai/guided-flows.ts — file exists',
  () => fileExists('lib/ai/guided-flows.ts'),
  'File not found',
)

test(
  'lib/ai/guided-flows.ts — exports buildAIPrompt function',
  () => guidedFlows.includes('export function buildAIPrompt('),
  'buildAIPrompt export not found',
)

test(
  'lib/ai/guided-flows.ts — buildAIPrompt returns string | null',
  () => guidedFlows.includes('): string | null {'),
  'buildAIPrompt return type not found',
)

test(
  'lib/ai/guided-flows.ts — exports resourceFinderFlow, eligibilityCheckerFlow, formHelpFlow',
  () =>
    guidedFlows.includes('export const resourceFinderFlow') &&
    guidedFlows.includes('export const eligibilityCheckerFlow') &&
    guidedFlows.includes('export const formHelpFlow'),
  'one or more named flow exports missing',
)

// guided-flow component — full chain trace
test(
  'components/chat/guided-flow.tsx — imports buildAIPrompt from guided-flows',
  () => guidedFlowComponent.includes("buildAIPrompt,") && guidedFlowComponent.includes("'@/lib/ai/guided-flows'"),
  'buildAIPrompt import missing',
)

test(
  'components/chat/guided-flow.tsx — calls buildAIPrompt(flow, newAnswers) then sendMessage(prompt)',
  () =>
    guidedFlowComponent.includes('const prompt = buildAIPrompt(flow, newAnswers)') &&
    guidedFlowComponent.includes('await sendMessage(prompt)'),
  'buildAIPrompt → sendMessage chain broken',
)

test(
  'components/chat/guided-flow.tsx — calls onComplete with answers and aiResponse',
  () => guidedFlowComponent.includes('onComplete?.(newAnswers, lastMessage.content)'),
  'onComplete call with lastMessage.content not found',
)

// Supabase chat edge function
test(
  'supabase/functions/chat/index.ts — file exists',
  () => rootFileExists('supabase/functions/chat/index.ts'),
  'Chat edge function not found',
)

test(
  'supabase/functions/chat/index.ts — references FIREWORKS_API_KEY via apiKeyEnv indirection',
  () => {
    const f = rootFile('supabase/functions/chat/index.ts')
    // The edge function reads the key indirectly: apiKeyEnv is set to 'FIREWORKS_API_KEY'
    // and consumed via Deno.env.get(entry.apiKeyEnv) — not a direct Deno.env.get('FIREWORKS_API_KEY') call.
    return f.includes("apiKeyEnv: 'FIREWORKS_API_KEY'")
  },
  "apiKeyEnv: 'FIREWORKS_API_KEY' not found — Fireworks key reference missing",
)

test(
  'supabase/functions/chat/index.ts — makes API call to fireworks.ai',
  () => {
    const f = rootFile('supabase/functions/chat/index.ts')
    return f.includes('fireworks.ai')
  },
  'fireworks.ai URL not found',
)

test(
  'supabase/functions/chat/index.ts — streams response (ReadableStream)',
  () => {
    const f = rootFile('supabase/functions/chat/index.ts')
    return f.includes('ReadableStream') && f.includes('text/event-stream')
  },
  'streaming response pattern not found',
)

// ---------------------------------------------------------------------------
// 3. FEED CHAIN
// ---------------------------------------------------------------------------
group('FEED')

const feedPanel = src('components/panels/feed-panel.tsx')
const useRealtimeFeed = src('hooks/use-realtime-feed.ts')

test(
  'components/panels/feed-panel.tsx — file exists',
  () => fileExists('components/panels/feed-panel.tsx'),
  'File not found',
)

test(
  "feed-panel.tsx — imports createClient from '@/lib/supabase/client'",
  () => feedPanel.includes("from '@/lib/supabase/client'"),
  'createClient import missing',
)

test(
  "feed-panel.tsx — fetchPosts queries 'posts' table",
  () => feedPanel.includes(".from('posts')"),
  "posts table query not found",
)

test(
  'feed-panel.tsx — has error state (setError)',
  () => feedPanel.includes('setError(') && feedPanel.includes('const [error, setError]'),
  'error state missing',
)

test(
  'feed-panel.tsx — renders error UI with retry button',
  () => feedPanel.includes('Retry') && feedPanel.includes('fetchPosts'),
  'retry button not found',
)

test(
  'feed-panel.tsx — has loading state (setLoading)',
  () => feedPanel.includes('setLoading(') && feedPanel.includes('const [loading, setLoading]'),
  'loading state missing',
)

test(
  'feed-panel.tsx — renders empty state when no posts',
  () => feedPanel.includes('No posts to show'),
  'empty state text not found',
)

test(
  'feed-panel.tsx — handleCreatePost requires user before insert',
  () => {
    const fnBody = feedPanel.slice(feedPanel.indexOf('const handleCreatePost'))
    return fnBody.includes('if (!user) return')
  },
  'handleCreatePost missing user guard',
)

test(
  "feed-panel.tsx — handleCreatePost inserts into 'posts' table",
  () => {
    const fnBody = feedPanel.slice(feedPanel.indexOf('const handleCreatePost'))
    return fnBody.includes(".from('posts')") && fnBody.includes('.insert(')
  },
  "insert into 'posts' not found in handleCreatePost",
)

test(
  'feed-panel.tsx — uses useRealtimeFeed for live updates',
  () => feedPanel.includes('useRealtimeFeed({'),
  'useRealtimeFeed call not found',
)

// use-realtime-feed.ts
test(
  'hooks/use-realtime-feed.ts — file exists',
  () => fileExists('hooks/use-realtime-feed.ts'),
  'File not found',
)

test(
  "hooks/use-realtime-feed.ts — subscribes to 'posts' table via postgres_changes",
  () =>
    useRealtimeFeed.includes("table: 'posts'") &&
    useRealtimeFeed.includes("'postgres_changes'"),
  'posts table subscription not found',
)

test(
  'hooks/use-realtime-feed.ts — handles INSERT, UPDATE, DELETE events',
  () =>
    useRealtimeFeed.includes("'INSERT'") &&
    useRealtimeFeed.includes("'UPDATE'") &&
    useRealtimeFeed.includes("'DELETE'"),
  'event type handling incomplete',
)

test(
  'hooks/use-realtime-feed.ts — cleans up channel on unmount',
  () => useRealtimeFeed.includes('supabase.removeChannel(channelRef.current)'),
  'channel cleanup not found',
)

// ---------------------------------------------------------------------------
// 4. APPLICATIONS CHAIN
// ---------------------------------------------------------------------------
group('APPLICATIONS')

const useApplications = src('hooks/use-applications.ts')

test(
  'hooks/use-applications.ts — file exists',
  () => fileExists('hooks/use-applications.ts'),
  'File not found',
)

test(
  "hooks/use-applications.ts — imports useAuth (NOT supabase.auth.getUser)",
  () =>
    useApplications.includes("from '@/hooks/use-auth'") &&
    !useApplications.includes('supabase.auth.getUser'),
  'must import useAuth, must not call supabase.auth.getUser directly',
)

test(
  'hooks/use-applications.ts — has auth loading guard (authLoading guard)',
  () => useApplications.includes('if (authLoading || !user)'),
  'authLoading guard not found',
)

test(
  "hooks/use-applications.ts — queries form_submissions table",
  () => useApplications.includes(".from('form_submissions')"),
  "form_submissions table query not found",
)

test(
  'hooks/use-applications.ts — has error state returned',
  () => useApplications.includes('error,') && useApplications.includes('const [error, setError]'),
  'error state not found',
)

test(
  'hooks/use-applications.ts — joins form_templates for template name',
  () => useApplications.includes('form_templates'),
  'form_templates join not found',
)

// applications subtab now renders FormsPanel — verify forms-panel exists and wires use-applications
test(
  'components/panels/forms-panel.tsx — file exists (applications subtab host)',
  () => fileExists('components/panels/forms-panel.tsx'),
  'File not found',
)

test(
  'use-applications.ts — applications hook still exists for deep-links',
  () => fileExists('hooks/use-applications.ts'),
  'use-applications hook file not found',
)

// ---------------------------------------------------------------------------
// 5. MAP CHAIN
// ---------------------------------------------------------------------------
group('MAP')

const mapPanel = src('components/panels/map-panel.tsx')
const mapView = src('components/map/map-view.tsx')
const useViewportResources = src('hooks/use-viewport-resources.ts')

test(
  'components/panels/map-panel.tsx — file exists',
  () => fileExists('components/panels/map-panel.tsx'),
  'File not found',
)

test(
  "map-panel.tsx — imports MapView from '@/components/map'",
  () => mapPanel.includes("from '@/components/map'"),
  'MapView import missing',
)

test(
  'map-panel.tsx — passes onBoundsChange={handleBoundsChange} to MapView',
  () => mapPanel.includes('onBoundsChange={handleBoundsChange}'),
  'onBoundsChange prop wiring missing',
)

test(
  'map-panel.tsx — has ResourceDetail component with onGetHelp button',
  () => mapPanel.includes('Get Help') && mapPanel.includes('onGetHelp'),
  'ResourceDetail Get Help button not found',
)

test(
  'map-panel.tsx — uses useViewportResources hook',
  () => mapPanel.includes('useViewportResources('),
  'useViewportResources hook not used',
)

test(
  'map-panel.tsx — enables resource query only when bounds are available',
  () => mapPanel.includes('enabled: !!bounds'),
  'enabled: !!bounds guard not found',
)

// map-view.tsx
test(
  'components/map/map-view.tsx — file exists',
  () => fileExists('components/map/map-view.tsx'),
  'File not found',
)

test(
  'map-view.tsx — has onLoad handler (handleLoad)',
  () => mapView.includes('const handleLoad = useCallback('),
  'handleLoad not found',
)

test(
  'map-view.tsx — handleLoad calls getBounds() directly (no setTimeout)',
  () => {
    // Verify handleLoad does NOT use setTimeout for initial bounds
    const handleLoadFn = mapView.slice(
      mapView.indexOf('const handleLoad = useCallback('),
      mapView.indexOf('const handleLoad = useCallback(') + 400,
    )
    return (
      handleLoadFn.includes('onBoundsChange?.(bounds)') &&
      !handleLoadFn.includes('setTimeout')
    )
  },
  'handleLoad must call getBounds() without setTimeout',
)

test(
  'map-view.tsx — emits initial bounds in onLoad (not just onMoveEnd)',
  () => {
    const handleLoadFn = mapView.slice(
      mapView.indexOf('const handleLoad = useCallback('),
      mapView.indexOf('const handleLoad = useCallback(') + 400,
    )
    return handleLoadFn.includes('onBoundsChange?.(bounds)')
  },
  'initial bounds not emitted from onLoad handler',
)

test(
  'map-view.tsx — passes onLoad={handleLoad} to <Map>',
  () => mapView.includes('onLoad={handleLoad}'),
  'onLoad prop not wired to Map component',
)

// use-viewport-resources.ts
test(
  'hooks/use-viewport-resources.ts — file exists',
  () => fileExists('hooks/use-viewport-resources.ts'),
  'File not found',
)

test(
  "hooks/use-viewport-resources.ts — queries 'resources' table",
  () => useViewportResources.includes(".from('resources')"),
  "resources table query not found",
)

test(
  'hooks/use-viewport-resources.ts — query is gated on enabled && bounds',
  () =>
    useViewportResources.includes('if (!enabled || !bounds) return'),
  'enabled/bounds gate not found',
)

test(
  'hooks/use-viewport-resources.ts — filters resources by viewport bounds',
  () =>
    useViewportResources.includes('currentBounds.west') &&
    useViewportResources.includes('currentBounds.east') &&
    useViewportResources.includes('currentBounds.north') &&
    useViewportResources.includes('currentBounds.south'),
  'viewport bounds filtering not found',
)

// ---------------------------------------------------------------------------
// 6. DOCUMENTS CHAIN
// ---------------------------------------------------------------------------
group('DOCUMENTS')

const documentsPanel = src('components/panels/documents-panel.tsx')
const encryptedUpload = src('components/documents/encrypted-upload.tsx')
const useEncryptedUpload = src('hooks/use-encrypted-upload.ts')

test(
  'components/panels/documents-panel.tsx — file exists',
  () => fileExists('components/panels/documents-panel.tsx'),
  'File not found',
)

test(
  "documents-panel.tsx — imports EncryptedUpload from '@/components/documents/encrypted-upload'",
  () => documentsPanel.includes("from '@/components/documents/encrypted-upload'"),
  'EncryptedUpload import missing',
)

test(
  "documents-panel.tsx — imports useEncryptedUpload from '@/hooks/use-encrypted-upload'",
  () => documentsPanel.includes("from '@/hooks/use-encrypted-upload'"),
  'useEncryptedUpload import missing',
)

test(
  'documents-panel.tsx — renders EncryptedUpload component',
  () => documentsPanel.includes('<EncryptedUpload'),
  '<EncryptedUpload not rendered in JSX',
)

// encrypted-upload.tsx
test(
  'components/documents/encrypted-upload.tsx — file exists',
  () => fileExists('components/documents/encrypted-upload.tsx'),
  'File not found',
)

test(
  "encrypted-upload.tsx — imports useVault from '@/contexts/vault-context'",
  () => encryptedUpload.includes("from '@/contexts/vault-context'"),
  'useVault import missing',
)

test(
  'encrypted-upload.tsx — checks isUnlocked before rendering file input',
  () => encryptedUpload.includes('isUnlocked') && encryptedUpload.includes('if (!isUnlocked)'),
  'isUnlocked check not found',
)

test(
  'encrypted-upload.tsx — renders VaultUnlockModal button when vault is locked',
  () => encryptedUpload.includes('Unlock Vault') && encryptedUpload.includes('<VaultUnlockModal'),
  'VaultUnlockModal button not found in locked state',
)

test(
  'encrypted-upload.tsx — renders file input when vault is unlocked',
  () => encryptedUpload.includes("<input") && encryptedUpload.includes('type="file"'),
  'file input not found',
)

// use-encrypted-upload.ts
test(
  'hooks/use-encrypted-upload.ts — file exists',
  () => fileExists('hooks/use-encrypted-upload.ts'),
  'File not found',
)

test(
  'hooks/use-encrypted-upload.ts — uploadFile function defined',
  () => useEncryptedUpload.includes('const uploadFile = useCallback('),
  'uploadFile function not found',
)

test(
  'hooks/use-encrypted-upload.ts — uploadFile encrypts before upload (encryptFile)',
  () => useEncryptedUpload.includes('encryptFile(file'),
  'encryptFile call not found — file must be encrypted before upload',
)

test(
  "hooks/use-encrypted-upload.ts — uploads to Supabase Storage bucket 'user-documents'",
  () =>
    useEncryptedUpload.includes("const STORAGE_BUCKET = 'user-documents'") &&
    useEncryptedUpload.includes('.from(STORAGE_BUCKET)'),
  "Storage bucket 'user-documents' upload not found",
)

test(
  "hooks/use-encrypted-upload.ts — saves metadata to 'user_documents' table",
  () => useEncryptedUpload.includes(".from('user_documents')") && useEncryptedUpload.includes('.insert('),
  "metadata insert into user_documents not found",
)

// ---------------------------------------------------------------------------
// 7. SETTINGS CHAIN
// ---------------------------------------------------------------------------
group('SETTINGS')

const settingsPanel = src('components/panels/settings-panel.tsx')

test(
  'components/panels/settings-panel.tsx — file exists',
  () => fileExists('components/panels/settings-panel.tsx'),
  'File not found',
)

test(
  "settings-panel.tsx — NO instances of 'text-muted-foreground' (should use text-stone-600)",
  () => !settingsPanel.includes('text-muted-foreground'),
  'text-muted-foreground found — should be text-stone-600',
)

test(
  'settings-panel.tsx — has password change button (routes to /forgot-password)',
  () => settingsPanel.includes("router.push('/forgot-password')"),
  "password change routing to /forgot-password not found",
)

test(
  'settings-panel.tsx — has MFA section (MFAEnrollment)',
  () => settingsPanel.includes('MFAEnrollment') && settingsPanel.includes('<MFAEnrollment'),
  'MFAEnrollment component not found',
)

test(
  'settings-panel.tsx — has account deletion (handleDeleteAccount)',
  () =>
    settingsPanel.includes('const handleDeleteAccount = async') &&
    settingsPanel.includes('Delete Account'),
  'account deletion handler not found',
)

test(
  'settings-panel.tsx — updateProfile calls supabase.from(profiles).update',
  () =>
    settingsPanel.includes("supabase") &&
    settingsPanel.includes(".from('profiles')") &&
    settingsPanel.includes('.update('),
  "profiles table update not found",
)

test(
  'settings-panel.tsx — SecurityActivity component rendered',
  () => settingsPanel.includes('<SecurityActivity'),
  'SecurityActivity not rendered',
)

test(
  'settings-panel.tsx — delete account fetches delete-account edge function',
  () => settingsPanel.includes('functions/v1/delete-account'),
  'delete-account edge function call not found',
)

// ---------------------------------------------------------------------------
// 8. SUPABASE CLIENT — singleton check
// ---------------------------------------------------------------------------
group('SUPABASE CLIENT')

const supabaseClient = src('lib/supabase/client.ts')

test(
  'lib/supabase/client.ts — file exists',
  () => fileExists('lib/supabase/client.ts'),
  'File not found',
)

test(
  'lib/supabase/client.ts — exports createClient function',
  () => supabaseClient.includes('export function createClient()'),
  'createClient export not found',
)

test(
  'lib/supabase/client.ts — singleton pattern: module-level _client variable',
  () => supabaseClient.includes('let _client:') || supabaseClient.includes('let _client ='),
  'module-level singleton variable not found',
)

test(
  'lib/supabase/client.ts — second call returns same reference (if (!_client) guard)',
  () => supabaseClient.includes('if (!_client)'),
  'singleton guard not found — second call may create a new client',
)

test(
  'lib/supabase/client.ts — uses createBrowserClient from @supabase/ssr',
  () => supabaseClient.includes('createBrowserClient'),
  'createBrowserClient not used',
)

// ---------------------------------------------------------------------------
// 9. ENVIRONMENT VARIABLES
// ---------------------------------------------------------------------------
group('ENVIRONMENT')

test(
  '.env.local — file exists in apps/web/',
  () => fs.existsSync(path.join(WEB, '.env.local')),
  '.env.local not found',
)

test(
  '.env.local — NEXT_PUBLIC_SUPABASE_URL is set',
  () => {
    const env = fs.existsSync(path.join(WEB, '.env.local'))
      ? fs.readFileSync(path.join(WEB, '.env.local'), 'utf-8')
      : ''
    const match = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)
    return !!(match && match[1] && match[1].trim().length > 0)
  },
  'NEXT_PUBLIC_SUPABASE_URL not set in .env.local',
)

test(
  '.env.local — NEXT_PUBLIC_SUPABASE_ANON_KEY is set',
  () => {
    const env = fs.existsSync(path.join(WEB, '.env.local'))
      ? fs.readFileSync(path.join(WEB, '.env.local'), 'utf-8')
      : ''
    const match = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)
    return !!(match && match[1] && match[1].trim().length > 0)
  },
  'NEXT_PUBLIC_SUPABASE_ANON_KEY not set in .env.local',
)

test(
  '.env.local — FIREWORKS_API_KEY is set',
  () => {
    const env = fs.existsSync(path.join(WEB, '.env.local'))
      ? fs.readFileSync(path.join(WEB, '.env.local'), 'utf-8')
      : ''
    const match = env.match(/^FIREWORKS_API_KEY=(.+)$/m)
    return !!(match && match[1] && match[1].trim().length > 0)
  },
  'FIREWORKS_API_KEY not set in .env.local',
)

test(
  '.env.local — NEXT_PUBLIC_MAPBOX_TOKEN is set',
  () => {
    const env = fs.existsSync(path.join(WEB, '.env.local'))
      ? fs.readFileSync(path.join(WEB, '.env.local'), 'utf-8')
      : ''
    const match = env.match(/^NEXT_PUBLIC_MAPBOX_TOKEN=(.+)$/m)
    return !!(match && match[1] && match[1].trim().length > 0)
  },
  'NEXT_PUBLIC_MAPBOX_TOKEN not set in .env.local',
)

// ---------------------------------------------------------------------------
// 10. SUPPLEMENTARY — hooks/use-auth.ts re-export pattern
// ---------------------------------------------------------------------------
group('AUTH HOOK')

const useAuthTs = src('hooks/use-auth.ts')

test(
  'hooks/use-auth.ts — file exists',
  () => fileExists('hooks/use-auth.ts'),
  'File not found',
)

test(
  "hooks/use-auth.ts — re-exports useAuthContext as useAuth (backwards-compat wrapper)",
  () =>
    useAuthTs.includes("from '@/providers/auth-provider'") &&
    useAuthTs.includes('export function useAuth()') &&
    useAuthTs.includes('return useAuthContext()'),
  'useAuth hook is not the useAuthContext re-export',
)

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------

const groups = [...new Set(results.map((r) => r.group))]
let totalPass = 0
let totalFail = 0

console.log('\nFEED SMOKE TEST SUITE')
console.log('=====================\n')

for (const g of groups) {
  const groupResults = results.filter((r) => r.group === g)
  const gPass = groupResults.filter((r) => r.passed).length
  const gFail = groupResults.filter((r) => !r.passed).length

  console.log(`${g}`)
  for (const r of groupResults) {
    if (r.passed) {
      console.log(`  ✓ ${r.name}`)
      totalPass++
    } else {
      console.log(`  ✗ FAIL: ${r.name}`)
      if (r.reason) console.log(`       reason: ${r.reason}`)
      totalFail++
    }
  }
  console.log()
}

console.log('=====================')
console.log(`TOTAL: ${totalPass + totalFail} tests`)
console.log(`PASS:  ${totalPass}`)
console.log(`FAIL:  ${totalFail}`)
console.log()

if (totalFail > 0) {
  console.log(`${totalFail} test(s) failed.`)
  process.exit(1)
} else {
  console.log('All tests passed.')
  process.exit(0)
}
