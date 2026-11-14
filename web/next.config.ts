import type { NextConfig } from "next";

/**
 * The browser-facing API origin. `??` is not enough here: a build arg that is
 * passed but empty (CI without the variable set, say) produces "", which is not
 * null, and then `new URL("/media/**")` throws a bare "Invalid URL" halfway
 * through the Docker build. Treat blank as absent, and fail with a sentence
 * that says what to fix.
 */
function apiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  const value = raw || "http://localhost:8080";
  try {
    new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_URL is not a valid absolute URL: ${JSON.stringify(value)}. ` +
        `Expected something like https://api.example.com. It is a build-time ` +
        `value, so set it as a build arg, not only at runtime.`,
    );
  }
  return value.replace(/\/+$/, "");
}

const nextConfig: NextConfig = {
  // standalone keeps the production image small: `next build` emits a
  // self-contained server bundle that the Dockerfile copies on its own.
  output: "standalone",
  reactStrictMode: true,
  images: {
    // Uploaded media is served by the Go API (or a CDN in front of it).
    remotePatterns: [new URL(`${apiOrigin()}/media/**`)],
  },
};

export default nextConfig;
