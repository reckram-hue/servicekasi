import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB; job-site photos are resized to ~1600px before upload
    // but occasionally still land close to that, so give some headroom.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
