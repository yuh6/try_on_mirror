import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许外部图片域名（CogView 生成的图片）
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // 增大 API 请求体限制（两张图片的 base64 可能很大）
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
