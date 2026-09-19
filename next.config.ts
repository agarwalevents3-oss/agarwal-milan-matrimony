import type { NextConfig } from "next";

/**
 * Security headers (PRD §18).
 *
 * Applied to every response. The CSP allows Supabase (the browser talks to it
 * directly for auth, storage and realtime) and nothing else, which is what
 * makes an injected script unable to exfiltrate anywhere useful.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseOrigin.replace(/^https/, "wss");

// React's Fast Refresh / dev-mode error overlay uses eval() to reconstruct
// stack traces across the dev server boundary — harmless and dev-only. "React
// will never use eval() in production mode" per its own warning, so
// 'unsafe-eval' is added ONLY outside production rather than loosened for
// everyone.
const scriptSrc = process.env.NODE_ENV === "production"
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts; 'unsafe-inline' is required for them.
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Next 16 otherwise appends an "agent rules" block to AGENTS.md on every
  // `next dev` run, which would fight our own hand-written conventions there.
  agentRules: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
