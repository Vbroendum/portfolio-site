import type { NextConfig } from "next";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // standalone keeps the production image small: `next build` emits a
  // self-contained server bundle that the Dockerfile copies on its own.
  output: "standalone",
  reactStrictMode: true,
  images: {
    // Uploaded media is served by the Go API (or a CDN in front of it).
    remotePatterns: [new URL(`${apiOrigin}/media/**`)],
  },
};

export default nextConfig;
