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
        // All routes EXCEPT the public embed widget.
        // Next.js header source uses path-to-regexp — a negative-lookahead
        // segment excludes /s/embed/* so that route can be iframed by 3rd parties.
        // X-Frame-Options: DENY and frame-ancestors 'none' remain on every other route.
        source: '/((?!s/embed/).*)',
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
          // Content-Security-Policy is owned per-request by the proxy
          // (apps/web/src/proxy.ts → buildCsp in src/lib/csp.ts) so each
          // response carries a fresh nonce + 'strict-dynamic' (Wave 6b). It is
          // intentionally NOT declared here — a static CSP here would conflict
          // with / override the per-request one.
        ],
      },
      {
        // Embed widget route: allow any site to iframe it.
        // - frame-ancestors * replaces 'none' so 3rd-party iframes are permitted.
        // - X-Frame-Options is intentionally OMITTED: there is no valid "allow all"
        //   value; modern browsers use frame-ancestors, legacy browsers accept the
        //   absence of X-Frame-Options as "allow". Setting SAMEORIGIN/DENY here
        //   would conflict with the permissive frame-ancestors in some older UAs.
        // - All other security headers (HSTS, nosniff, etc.) are retained.
        source: '/s/embed/:id',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          // Content-Security-Policy for the embed route is owned per-request by
          // the proxy (buildCsp({ embed: true })) — preserves frame-ancestors *
          // + form-action 'none' with a per-request nonce (Wave 6b).
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
