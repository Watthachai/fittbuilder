import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
