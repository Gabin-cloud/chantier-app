import type { NextConfig } from "next";

const isDesktopBuild = process.env.BUILD_DESKTOP === "1";

const nextConfig: NextConfig = {
  output: isDesktopBuild ? "standalone" : undefined,
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/outlook/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://outlook.office.com https://outlook.office365.com https://outlook.live.com https://*.officeapps.live.com",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
