/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_OAUTH_URL: process.env.NEXT_PUBLIC_OAUTH_URL || "http://localhost:8080",
  },
  output: "standalone",
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Block framing (clickjacking protection)
          { key: "X-Frame-Options", value: "DENY" },
          // Control referrer info sent on navigation
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict access to browser features not used by the app
          { key: "Permissions-Policy", value: "camera=self, microphone=self, geolocation=()" },
          // Force HTTPS for 1 year (production only — harmless in dev)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Content Security Policy — restricts origins for every resource type
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",   // Next.js App Router requires unsafe-inline
              "style-src 'self' 'unsafe-inline'",    // Tailwind inline styles
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "media-src 'self' blob:",              // Audio recording playback
              // All API calls go through the Next.js proxy — browser only needs 'self'
              "connect-src 'self'",
              "object-src 'none'",                   // Block Flash/plugins
              "base-uri 'self'",                     // Prevent base-tag injection
              "form-action 'self'",                  // Forms can only submit to same origin
              "frame-ancestors 'none'",              // Stronger clickjacking protection
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
