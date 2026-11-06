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
  /**
   * Where the build output goes. Normally `.next`; the deploy overrides it so a
   * production build can be assembled OUT OF THE WAY and then swapped in.
   *
   * WHY: the deploy used to `rm -rf .next && npm run build` in the same tree the
   * live process is serving from. Chunk filenames are content-hashed, so for the
   * ~60s that build ran, every page already open (and every new request) asked
   * for `/_next/static/css/<old-hash>.css` and got a 404 — the HTML rendered,
   * the stylesheet did not. That is why the landing page intermittently appeared
   * with no Tailwind at all: the mobile-only bottom nav showed on desktop
   * (`md:hidden` never applied), every responsive grid collapsed to one column
   * so sections looked endless, and the pricing tabs lost their styling.
   *
   * With this, the deploy builds into `.next-build` while `.next` stays intact
   * and serving, then renames the directories and restarts — turning a minutes-
   * long window of unstyled pages into a sub-second one. `next start` reads this
   * same value, so the running process still serves from `.next`.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
  async rewrites() {
    return [
      {
        source: '/_tasnif/:path*',
        destination: 'https://tasnif.soliq.uz/api/cls-api/:path*',
      },
    ]
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
