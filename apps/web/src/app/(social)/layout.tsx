import type { Metadata } from 'next'
import { shareT } from '@/lib/i18n-share'
import { requestPageLocale } from '@/lib/request-locale-server'

// The site's title and description in the visitor's language (the root layout's rule). Each page
// sets its own lang/dir on its root: this wrapper holds no text.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestPageLocale()
  return { title: shareT(locale, 'siteTitle'), description: shareT(locale, 'siteDescription') }
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
