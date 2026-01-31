// apps/web/src/app/(app)/layout.tsx
// Layout for the main FEED app (authenticated area)

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FEED - Mutual Aid Resource Platform',
  description: 'Find resources, apply for benefits, and connect with your community.',
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
