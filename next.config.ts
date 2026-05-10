import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Allow ngrok and all external hosts
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.io", 
    "*.ngrok.app",
    "*.localhost",
    "127.0.0.1"
  ],
  // Disable strict mode for external access
  devIndicators: false,
  // Trust proxy headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
