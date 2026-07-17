import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * YouTube embed iframes often redirect or nest to apex youtube.com and
 * www.google.com (consent / account). Those must be listed explicitly —
 * `www.youtube.com` does not match `youtube.com` in CSP host sources.
 * Wildcards do not match the apex host either.
 */
const mediaEmbedFrameSrc = [
  "'self'",
  "https://www.youtube.com",
  "https://youtube.com",
  "https://*.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://youtube-nocookie.com",
  "https://*.youtube-nocookie.com",
  "https://www.google.com",
  "https://player.vimeo.com",
].join(" ");

// Omit upgrade-insecure-requests in local HTTP/Turbopack — it can force
// RSC/HMR fetches onto https://127.0.0.1 and corrupt Flight payloads
// (resolveModelChunk → enqueueModel on null).
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https: http:",
  "worker-src 'self' blob:",
  // YouTube / Vimeo My Links embeds; same-origin for /games iframes.
  `frame-src ${mediaEmbedFrameSrc}`,
  // Dev: allow ws: for Turbopack HMR; http: for local API/proxy debugging.
  `connect-src 'self' https: wss:${isDev ? " ws: http:" : ""}`,
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");
const embeddedGameContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https: http:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  `connect-src 'self' https: wss:${isDev ? " ws: http:" : ""}`,
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // Allow fullscreen inside YouTube/Vimeo embeds; keep sensors locked down.
    value:
      'camera=(), microphone=(), geolocation=(), fullscreen=(self "https://www.youtube.com" "https://www.youtube-nocookie.com" "https://player.vimeo.com")',
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "peach.blender.org" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commondatastorage.googleapis.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "images.pluto.tv" },
      { protocol: "https", hostname: "image.tmdb.org" },
    ],
  },
  async headers() {
    const siteHeaders = [
      ...securityHeaders,
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
    ];
    const gameShellHeaders = [
      ...securityHeaders,
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Content-Security-Policy",
        value: embeddedGameContentSecurityPolicy,
      },
    ];

    return [
      // Static game HTML only — single CSP with frame-ancestors 'self'.
      {
        source: "/games/:gameId/index.html",
        headers: gameShellHeaders,
      },
      // App Router game pages (hub + detail) use the site CSP.
      {
        source: "/games",
        headers: siteHeaders,
      },
      {
        source: "/games/:slug",
        headers: siteHeaders,
      },
      // Everything else except /games/* (covered above).
      {
        source: "/((?!games/).*)",
        headers: siteHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
