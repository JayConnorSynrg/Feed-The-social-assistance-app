import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '../globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-b from-stone-50 to-lime-50 min-h-screen`}
      >
        <div className="mx-auto max-w-2xl px-4 py-8">
          {children}
        </div>
      </body>
    </html>
  )
}
