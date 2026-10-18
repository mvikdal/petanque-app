import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Admin lå på /admin før klubbskillet (2026-10-18). Alt som fantes da
  // hørte til Sinsen. Gamle /serie/...-lenker sendes videre i
  // app/serie/, siden de må slå opp riktig klubb.
  async redirects() {
    return [
      { source: "/admin", destination: "/sinsen/admin", permanent: true },
      { source: "/admin/:path*", destination: "/sinsen/admin/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
