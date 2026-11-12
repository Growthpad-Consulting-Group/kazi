import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Extension update checks must keep their stable Kazi URL so managed
    // browsers and existing Firefox installs continue to update. Redirecting
    // before the public filesystem hands the signed packages to R2, rather
    // than making Vercel serve or rebuild a binary for every release.
    const extensionPublicUrl = (
      process.env.R2_PUBLIC_URL ??
      "https://pub-9ee2a5bfc0d64d37ac53bb0000672438.r2.dev"
    ).replace(/\/$/, "");

    return [
      {
        source: "/extensions/kazi-timer/:path*",
        destination: `${extensionPublicUrl}/extensions/kazi-timer/:path*`,
        permanent: false,
      },
    ];
  },
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
