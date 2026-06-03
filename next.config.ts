import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
  // Tree-shake large named-export libraries so only the used modules ship.
  // lucide-react is auto-optimized by Next.js; recharts/date-fns are not.
  experimental: {
    optimizePackageImports: ['recharts', 'date-fns', 'lucide-react'],
  },
};

export default nextConfig;
