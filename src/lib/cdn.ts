/**
 * ============================================================================
 *  CDN HELPER — Free unlimited bandwidth via jsDelivr (or any CDN)
 * ============================================================================
 *
 *  HOW IT WORKS:
 *  - Set NEXT_PUBLIC_CDN_BASE in your hosting env vars, e.g.:
 *      NEXT_PUBLIC_CDN_BASE=https://cdn.jsdelivr.net/gh/USER/REPO@main
 *  - All asset paths (/gallery/hero.jpg, /logo.svg, etc.) are prefixed with it
 *  - If not set, assets load from origin (current behavior — zero breaking changes)
 *
 *  WHY jsDelivr?
 *  - Free, unlimited bandwidth (backed by Cloudflare + Fastly + Quantil)
 *  - Serves files directly from your GitHub repo
 *  - Zero configuration: just push assets to a public repo, set the env var
 *  - No DNS changes, no buckets, no manual setup
 *
 *  BANDWIDTH IMPACT:
 *  - Without CDN: 100% of asset bandwidth hits Netlify (images ≈ 488KB/visit)
 *  - With CDN:    ~0% of asset bandwidth hits Netlify (images served by jsDelivr)
 *  - Netlify only serves HTML (~30KB) + JS/CSS (~300KB, cached 1 year after first hit)
 *
 *  FALLBACK:
 *  - If the CDN fails, the Service Worker falls back to origin automatically
 *  - The <Image> components also have onError fallback (handled by SW)
 * ============================================================================
 */

/**
 * Base URL of the CDN. When set, all asset paths are prefixed with this.
 * Example: https://cdn.jsdelivr.net/gh/USER/REPO@main
 *
 * Set via NEXT_PUBLIC_CDN_BASE environment variable (available in the browser).
 */
export const CDN_BASE = process.env.NEXT_PUBLIC_CDN_BASE || "";

/**
 * Is a CDN configured? (Used by next.config.ts to disable image optimization
 * when serving pre-optimized assets from CDN.)
 */
export const CDN_ACTIVE = CDN_BASE.length > 0;

/**
 * Resolve a local asset path to a CDN URL (if configured) or leave as-is.
 *
 * @example
 * cdn("/gallery/hero.jpg")
 * // → "https://cdn.jsdelivr.net/gh/USER/REPO@main/gallery/hero.jpg"
 * //   (when NEXT_PUBLIC_CDN_BASE is set)
 * // → "/gallery/hero.jpg"
 * //   (when not set — loads from origin)
 */
export function cdn(path: string): string {
  // Don't touch already-absolute URLs (http://, https://, //, data:)
  if (!path.startsWith("/")) return path;
  // Don't touch API routes
  if (path.startsWith("/api/")) return path;
  return CDN_BASE ? `${CDN_BASE}${path}` : path;
}
