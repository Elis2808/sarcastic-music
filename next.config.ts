import type { NextConfig } from "next";
import CopyPlugin from "copy-webpack-plugin";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
              to: "../public/pdf.worker.min.mjs",
            },
          ],
        })
      );
    }
    return config;
  },
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
