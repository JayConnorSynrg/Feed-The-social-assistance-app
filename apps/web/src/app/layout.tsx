import type { Metadata } from "next";
import { connection } from "next/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import "./globals.css";

// metadataBase resolves relative og:image / twitter:image URLs to absolute.
// Priority: NEXT_PUBLIC_APP_URL (set in .env.local) → VERCEL_URL → prod canonical.
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "https://www.sourcetofeed.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FEED - Mutual Aid Resource Sharing",
    template: "%s | FEED",
  },
  description: "Community-powered mutual aid. Share resources, find help, support your neighbors.",
  openGraph: {
    type: "website",
    siteName: "FEED",
    title: "FEED - Mutual Aid Resource Sharing",
    description: "Community-powered mutual aid. Share resources, find help, support your neighbors.",
  },
  twitter: {
    card: "summary",
    title: "FEED - Mutual Aid Resource Sharing",
    description: "Community-powered mutual aid. Share resources, find help, support your neighbors.",
  },
  other: {
    "theme-color": "#65a30d",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Wave 6b: force dynamic rendering of the entire app so Next injects the
  // per-request CSP nonce (from the proxy's request CSP header) into every
  // hydration/framework <script>. Static pages are built without a request, so
  // no nonce can be applied — connection() ties rendering to the incoming
  // request (the Next 16 replacement for `export const dynamic = 'force-dynamic'`).
  // ACCEPTED COST: disables static optimization / ISR / PPR (inherent to
  // nonce-based CSP). See src/lib/csp.ts and src/proxy.ts.
  await connection();

  return (
    <html lang="en" className="light">
      <body
        className="antialiased"
      >
        <Providers>{children}</Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
