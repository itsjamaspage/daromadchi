import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * The commit this bundle was built from.
 *
 * Read at BUILD time and inlined into the bundle via `env` below, which is the
 * whole point: a running process must report the commit of the build it is
 * actually serving, not whatever the working tree happens to be at now. Those
 * two disagree in exactly the case worth catching — a deploy that checked out
 * new code, built it, and then left the old process serving the old build.
 * Reading git at request time would report the new SHA and hide that.
 *
 * Never throws. next.config is also loaded when `next start` boots, and a boot
 * that dies because `git` is missing or the deploy is a tarball would be a far
 * worse failure than an unknown SHA.
 */
function buildSha(): string {
  if (process.env.BUILD_SHA) return process.env.BUILD_SHA
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim() || "unknown"
  } catch {
    return "unknown"
  }
}

const nextConfig: NextConfig = {
  // Inlined at build time — see buildSha() above. Surfaced by /api/health.
  env: {
    BUILD_SHA: buildSha(),
  },
  typescript: { ignoreBuildErrors: true },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ['recharts', 'date-fns', 'lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
