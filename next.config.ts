import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      "/login", "/login-otp", "/signup", "/forgot-password", "/accept-invitation",
      "/dashboard/:path*", "/accounts/:path*", "/transactions/:path*", "/debts/:path*",
      "/planning/:path*", "/profile/:path*", "/documentation/:path*", "/admin/:path*", "/api/:path*",
    ].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
    }));
  },
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
    // Netlify scans build artifacts; compiler caches can retain build-time secrets.
    turbopackFileSystemCacheForBuild: process.env.NETLIFY !== "true",
  },
};

export default nextConfig;
