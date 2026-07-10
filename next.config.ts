import type { NextConfig } from "next";

const isDesktopBuild = process.env.BUILD_DESKTOP === "1";

const nextConfig: NextConfig = {
  output: isDesktopBuild ? "standalone" : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
