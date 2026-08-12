import type { NextConfig } from "next";

/**
 * When NEXT_PUBLIC_CDN_BASE is set (e.g. jsDelivr), we serve pre-optimized
 * images directly from the CDN — no need for Next.js image optimization
 * (which would proxy through origin and consume bandwidth).
 */
const CDN_ACTIVE = !!process.env.NEXT_PUBLIC_CDN_BASE;

const nextConfig: NextConfig = {
  // Note: output: "standalone" removed — Netlify handles Next.js natively
  // via its Next.js runtime plugin. For self-hosted (Caddy/Docker), re-add it.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
  images: {
    // When CDN is active: serve images as-is (already optimized, served from CDN)
    // When no CDN: use Next.js optimization (AVIF/WebP)
    unoptimized: CDN_ACTIVE,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 days
    // Allow external image domains (for CDN-hosted images)
    ...(CDN_ACTIVE
      ? {
          remotePatterns: [
            { protocol: "https" as const, hostname: "cdn.jsdelivr.net" },
            { protocol: "https" as const, hostname: "fastly.jsdelivr.net" },
          ],
        }
      : {}),
  },
  // Aggressive static caching headers
  async headers() {
    return [
      {
        source: "/gallery/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/logo.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/logo.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // HTML: cache for 7 days (content rarely changes), allow stale-while-revalidate
        // This lets browsers + CDNs serve cached HTML → near-zero origin bandwidth
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
