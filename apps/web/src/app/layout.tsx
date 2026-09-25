import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import { createClient } from "@/lib/supabase/server";
import type { InitialUser } from "@/providers/auth-provider";
import { A11Y_PREPAINT_SCRIPT } from "@/lib/accessibility-prefs";
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
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'FEED',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#65a30d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
  //
  // Capacitor builds export static HTML (output:'export' in next.config.ts,
  // gated on CAPACITOR_BUILD==='true'). connection() is incompatible with
  // output:'export' (there is no request at build time). Mobile is served as
  // static files inside a native webview — no Next server / proxy runs there,
  // so the per-request nonce CSP does not apply (mobile CSP is a separate
  // native concern). Skip force-dynamic for the Capacitor build so the static
  // export still compiles.
  //
  // Server-trusted identity: read the JWT-verified claims from the request
  // cookie via the server Supabase client. getClaims() verifies the token, so
  // this is the authoritative identity the browser client must reconcile to.
  // Passing it into Providers → AuthProvider lets a server-authenticated user
  // render authenticated on the first paint (no client getSession race) and
  // gives the client the server sub/anon flag to detect a stale guest session.
  let initialUser: InitialUser | null = null;
  if (process.env.CAPACITOR_BUILD !== 'true') {
    await connection();
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims;
      if (claims?.sub) {
        initialUser = {
          id: claims.sub,
          email: claims.email ?? null,
          is_anonymous: claims.is_anonymous ?? false,
        };
      }
    } catch {
      // No verified session on this request — render unauthenticated and let
      // the browser client resolve auth from the cookie on mount.
      initialUser = null;
    }
  }

  // Per-request CSP nonce (stamped by proxy.ts, forwarded as x-nonce). The
  // pre-paint accessibility script is hand-written inline, so — unlike Next's
  // own hydration scripts — it must carry the nonce explicitly to run under the
  // strict CSP. On the Capacitor static build there is no request/nonce.
  let nonce: string | undefined;
  if (process.env.CAPACITOR_BUILD !== 'true') {
    try {
      nonce = (await headers()).get('x-nonce') ?? undefined;
    } catch {
      nonce = undefined;
    }
  }

  return (
    <html lang="en" className="light">
      <body
        className="antialiased"
      >
        {/* Apply stored accessibility overrides before hydration to avoid a
            flash of the un-adjusted UI. Mirrors applyA11yAttributes(). */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: A11Y_PREPAINT_SCRIPT }}
        />
        <Providers initialUser={initialUser}>{children}</Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
