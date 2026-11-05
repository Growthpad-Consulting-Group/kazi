import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    // React's development error overlays use eval to reconstruct stack traces.
    // Keep it local-only: production never needs or receives unsafe-eval.
    const scriptSource = isProduction
      ? "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com";
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      scriptSource,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google.com https://api.iconify.design",
      "frame-src 'self' https://www.google.com",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
      // The authenticated CV preview is embedded only inside Kazi candidate
      // pages. It must be frameable by the same origin, unlike every other
      // application route.
      {
        source: "/api/hire/candidates/:id/cv-preview",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; frame-ancestors 'self'",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/extensions/kazi-timer/updates.xml",
        headers: [
          { key: "Content-Type", value: "application/xml; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/extensions/kazi-timer/kazi-timer.crx",
        headers: [
          { key: "Content-Type", value: "application/x-chrome-extension" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Firefox self-distributed updates require a signed XPI served with the
      // installable add-on content type; the JSON manifest stays revalidatable.
      {
        source: "/extensions/kazi-timer/firefox/updates.json",
        headers: [
          { key: "Content-Type", value: "application/json; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/extensions/kazi-timer/firefox/:path*.xpi",
        headers: [
          { key: "Content-Type", value: "application/x-xpinstall" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-9ee2a5bfc0d64d37ac53bb0000672438.r2.dev",
      },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "kazi.growthpad.africa" },
      // Google profile photos imported from Google Workspace accounts.
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
