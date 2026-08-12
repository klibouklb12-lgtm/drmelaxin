import type { NextConfig } from "next";

/**
 * When NEXT_PUBLIC_CDN_BASE is set (e.g. jsDelivr), we serve pre-optimized
 * images directly from the CDN — no need for Next.js image optimization.
 */
const CDN_ACTIVE = !!process.env.NEXT_PUBLIC_CDN_BASE;

/**
 * Base path for GitHub Pages (username.github.io/repo-name/).
 * Empty string for custom domains or Cloudflare Pages.
 * Set via NEXT_PUBLIC_BASE_PATH env var.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Static export — outputs to ./out/ folder
  // Works on GitHub Pages, Cloudflare Pages, Netlify (static), any CDN
  output: "export",

  // Next.js Image optimization doesn't work with static export
  // (and we serve pre-optimized images from jsDelivr CDN anyway)
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
    ...(CDN_ACTIVE
      ? {
          remotePatterns: [
            { protocol: "https" as const, hostname: "cdn.jsdelivr.net" },
            { protocol: "https" as const, hostname: "fastly.jsdelivr.net" },
          ],
        }
      : {}),
  },

  // GitHub Pages serves from /repo-name/ unless using a custom domain
  // Empty for custom domain or Cloudflare Pages
  ...(BASE_PATH ? { basePath: BASE_PATH } : {}),

  // Add trailing slash to all routes (recommended for static export)
  // Ensures relative paths work correctly on GitHub Pages
  trailingSlash: true,

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
