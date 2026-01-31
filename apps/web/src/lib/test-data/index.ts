// apps/web/src/lib/test-data/index.ts
// Central export for all mock data and test utilities

export * from './mock-users'
export * from './mock-resources'
export * from './mock-posts'
export * from './mock-applications'

// Test mode detection
export function isTestMode(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_TEST_MODE === 'true'
  }
  return window.localStorage.getItem('FEED_TEST_MODE') === 'true'
}

// Enable/disable test mode
export function setTestMode(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    if (enabled) {
      window.localStorage.setItem('FEED_TEST_MODE', 'true')
    } else {
      window.localStorage.removeItem('FEED_TEST_MODE')
    }
  }
}

// Test session management
export interface TestSession {
  userId: string
  scenario: string
  startedAt: string
  currentStep: number
  completedSteps: string[]
}

export function getTestSession(): TestSession | null {
  if (typeof window === 'undefined') return null
  const session = window.localStorage.getItem('FEED_TEST_SESSION')
  return session ? JSON.parse(session) : null
}

export function setTestSession(session: TestSession): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('FEED_TEST_SESSION', JSON.stringify(session))
  }
}

export function clearTestSession(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('FEED_TEST_SESSION')
  }
}

// Quick data access functions
import { MOCK_USERS, MOCK_RESOURCES, MOCK_POSTS, MOCK_APPLICATIONS, MOCK_DOCUMENTS, MOCK_REMINDERS } from './index'

export function getAllMockData() {
  return {
    users: MOCK_USERS,
    resources: MOCK_RESOURCES,
    posts: MOCK_POSTS,
    applications: MOCK_APPLICATIONS,
    documents: MOCK_DOCUMENTS,
    reminders: MOCK_REMINDERS,
  }
}

export function getMockDataStats() {
  return {
    users: MOCK_USERS.length,
    resources: MOCK_RESOURCES.length,
    posts: MOCK_POSTS.length,
    applications: MOCK_APPLICATIONS.length,
    documents: MOCK_DOCUMENTS.length,
    reminders: MOCK_REMINDERS.length,
  }
}
