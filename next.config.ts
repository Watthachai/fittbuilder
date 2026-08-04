import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (`.next/standalone/server.js` + only the traced
  // node_modules) so the Docker runtime image stays small and free of build deps.
  output: "standalone",
  // The agent registry reads agents/<slug>/SKILL.md from disk at runtime via
  // process.cwd(). Standalone tracing can't see those (they're loaded by string
  // path, not import), so bundle them into the standalone output explicitly or
  // /api/generate + /api/agent 500 in production.
  outputFileTracingIncludes: {
    "/api/generate": ["./agents/**/*"],
    "/api/agent": ["./agents/**/*"],
  },
  // Pin the workspace root (a stray lockfile in the home directory makes
  // Next.js guess wrong otherwise).
  turbopack: { root: __dirname },
  // WebContainers require cross-origin isolation.
  // `credentialless` (instead of `require-corp`) lets the Monaco CDN and
  // other third-party assets load without per-resource CORP headers.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      // A deploy is only visible once the document itself is re-fetched. Its
      // script tags are content-hashed, so a cached document keeps serving the
      // previous build's chunks and an ordinary refresh appears to do nothing —
      // which is what taught people to reach for hard-reload. Never store the
      // HTML; the hashed assets under /_next/static stay immutable.
      {
        source: "/((?!_next/static|_next/image).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
