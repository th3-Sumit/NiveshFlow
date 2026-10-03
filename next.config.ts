import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
    // Netlify scans build artifacts; compiler caches can retain build-time secrets.
    turbopackFileSystemCacheForBuild: process.env.NETLIFY !== "true",
  },
};

export default nextConfig;
