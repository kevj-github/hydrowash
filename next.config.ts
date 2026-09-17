import type { NextConfig } from "next";

// Content-Security-Policy.
//
// Scope note: script-src carries 'unsafe-inline'/'unsafe-eval' because Next.js App
// Router emits inline hydration scripts and the Google Maps JS loader injects its own
// script tags, neither of which carries a nonce today. That means this policy does NOT
// by itself stop script injection — the RouteMap InfoWindow XSS is fixed at the sink
// instead (components/admin/RouteMap.tsx). What this policy does buy is a hard ceiling
// on where injected script could send data (connect-src), a ban on plugins and framing
// (object-src / frame-ancestors), and protection of the document base URL and form
// targets. Tightening to a nonce-based policy is a follow-up that needs browser
// testing against the Maps loader. See docs/archive/security/2026-08-31-remediation.md.
//
// Hosts, verified against the codebase:
//   maps.googleapis.com  Maps JS API + Places (client) — script, connect
//   maps.gstatic.com     Maps static assets
//   *.googleapis.com     map tiles and Places photos
//   *.supabase.co        Postgres/Auth/Storage over REST + Realtime websocket
//   images.unsplash.com / images.pexels.com are proxied through next/image at
//   /_next/image, so they need no img-src entry; data: and blob: do (PayNow QR).
//   Fonts are self-hosted by next/font/google at build time — no fonts.googleapis.com.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://maps.googleapis.com https://*.googleapis.com https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
