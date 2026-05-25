import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FEED - Mutual Aid Resource Sharing',
  description: 'Community-powered mutual aid. Share resources, find help, support your neighbors.',
}

export default function SocialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-gradient-to-b from-stone-50 to-lime-50 min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {children}
      </div>
    </div>
  )
}
