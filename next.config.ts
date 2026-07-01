import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable compression — it buffers SSE/streaming responses and causes gateway timeouts
  compress: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
