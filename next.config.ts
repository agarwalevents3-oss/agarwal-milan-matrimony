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

// Razorpay Checkout (Website Improvements §6.3) loads its script from
// checkout.razorpay.com and runs the payment form in an iframe on
// api.razorpay.com. Those origins are allowed ONLY when Razorpay is the active
// gateway, so the policy stays as tight as before until it is switched on.
const razorpay = process.env.PAYMENT_MODE === "razorpay"
  ? {
      script: " https://checkout.razorpay.com",
      frame: "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      connect: " https://api.razorpay.com https://lumberjack.razorpay.com",
      img: " https://cdn.razorpay.com",
    }
  : { script: "", frame: "", connect: "", img: "" };

const csp = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts; 'unsafe-inline' is required for them.
  scriptSrc + razorpay.script,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}  https://images.unsplash.com https://images.pexels.com https://res.cloudinary.com${razorpay.img}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${razorpay.connect}`,
  ...(razorpay.frame ? [razorpay.frame] : []),
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
