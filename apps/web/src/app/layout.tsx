import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
