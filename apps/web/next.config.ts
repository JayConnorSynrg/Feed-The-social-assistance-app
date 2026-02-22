import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Enable static export for Capacitor builds
  // Note: Dynamic routes will need to be handled differently
  ...(process.env.CAPACITOR_BUILD === 'true' && {
    output: 'export',
    distDir: 'out',
    images: {
      unoptimized: true,
    },
  }),

  // Image optimization settings
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
    // Optimize images with modern formats
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Transpile packages that need it
  transpilePackages: ['react-map-gl', 'mapbox-gl', '@vis.gl/react-mapbox'],

  // Performance optimizations
  experimental: {
    // Optimize package imports for smaller bundles
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
    ],
  },

  // Compress responses
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // Powered by header (disable for security)
  poweredByHeader: false,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // REMOVED 2026-02-20 (Security Fix #3):
          // X-XSS-Protection is deprecated (ignored by Chrome/Firefox/Safari since 2019)
          // and actively harmful in IE where it can be exploited to inject scripts.
          // Modern browsers rely on CSP instead. Header removed entirely.
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            // SECURITY FIX #3 — Applied 2026-02-20
            //
            // CHANGED: script-src
            //   BEFORE: "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
            //   AFTER:  "script-src 'self' 'unsafe-inline'"
            //
            //   REMOVED 'unsafe-eval':
            //     Eliminates eval(), new Function(), setTimeout(string), and
            //     WebAssembly.instantiate() from untrusted strings. This blocks
            //     the primary path by which an XSS payload could dynamically
            //     execute stolen encryption key material (DEK exfiltration).
            //     FTC "reasonable security" and SOC 2 require eval() to be
            //     disabled when handling PII/encrypted data.
            //
            //   RETAINED 'unsafe-inline':
            //     Next.js 14/15 injects inline <script> tags during SSR hydration
            //     (__NEXT_DATA__, chunk manifests). Removing unsafe-inline without
            //     a nonce pipeline (middleware → generateBuildId → _document) breaks
            //     the application. Full nonce-based CSP requires dedicated
            //     implementation work.
            //     TODO: Migrate to nonce-based CSP. See docs/csp-nonce-migration.md
            //     Track as: SECURITY-TODO-CSP-NONCE
            //
            // UNCHANGED: style-src 'unsafe-inline'
            //   Required by Tailwind CSS utility classes injected at runtime and
            //   any CSS-in-JS. This is an accepted trade-off; style injection
            //   cannot execute JavaScript in modern browsers (no script-via-style
            //   attacks in compliant browsers).
            //
            // REMOVED: X-XSS-Protection header (see comment above)
            //   Replaced entirely by CSP, which is the correct modern mechanism.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.mapbox.com",
              "worker-src blob:",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/(.*)\\.(js|css|woff|woff2|png|jpg|jpeg|gif|ico|svg)$',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
