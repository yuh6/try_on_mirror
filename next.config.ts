import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许外部图片域名（落地页的 Unsplash 图片等）
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
