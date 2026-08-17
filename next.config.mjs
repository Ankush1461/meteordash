/** @type {import('next').NextConfig} */

// Strict Content-Security-Policy, applied only in production builds.
// Next.js dev mode (HMR, the dev-tools overlay) relies on inline scripts and
// eval-style module loading, so relaxing dev would mean weakening prod — we
// don't. `npm run build && npm start` gets the hardened headers.
//
// The policy blocks every external script and connection except the two
// MediaPipe/CDN hosts the hand-tracking model needs, so no third-party
// script can ever load on the page and rewrite the UPI payment QR/link —
// the only realistic tampering vector on a self-hosted, HTTPS site.
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required by Next.js's inline RSC bootstrap scripts
  // (and React's inline style attributes below). jsdelivr is in script-src
  // because MediaPipe injects vision_wasm_internal.js as a <script> tag.
  // 'wasm-unsafe-eval' is required to compile the MediaPipe WebAssembly
  // module — the minimal allowance that permits wasm without enabling
  // eval-based JavaScript. Everything else external is blocked, which is
  // the vector that matters for the UPI QR.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = isProd
  ? {
      async headers() {
        return [
          {
            source: "/:path*",
            headers: [
              { key: "Content-Security-Policy", value: csp },
              { key: "X-Content-Type-Options", value: "nosniff" },
              { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
              { key: "X-Frame-Options", value: "SAMEORIGIN" },
            ],
          },
        ];
      },
    }
  : {};

export default nextConfig;
