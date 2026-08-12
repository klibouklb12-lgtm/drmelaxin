"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useReveal — IntersectionObserver-based scroll reveal, HYDRATION-SAFE.
 *
 * Why this version is hydration-safe:
 *   • Initial state is `visible = false` on BOTH server and client first-render.
 *     → The first client render produces the SAME HTML the server did. No mismatch.
 *   • All client-only logic (matchMedia, IntersectionObserver, setTimeout fallback)
 *     runs INSIDE useEffect, which fires AFTER hydration completes.
 *   • No `typeof window` branches anywhere in render output.
 *
 * Pair with the `.reveal` CSS class — when `visible` flips true,
 * the parent CSS adds `.is-visible` and the transition fires.
 *
 * Bullet-proofing:
 *   1. prefers-reduced-motion → reveals immediately, no animation.
 *   2. IntersectionObserver missing (very old browser) → reveals immediately.
 *   3. IntersectionObserver never fires (screenshot tools, weird viewports,
 *      element taller than viewport) → hard 1.5s timeout reveals anyway.
 *   4. Cleanup on unmount prevents leaks.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { once?: boolean; threshold?: number; rootMargin?: string; timeoutMs?: number }
) {
  const {
    once = true,
    threshold = 0.12,
    rootMargin = "0px 0px -8% 0px",
    timeoutMs = 1500,
  } = options ?? {};
  const [visible, setVisible] = useState(false);
  const nodeRef = useRef<T | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    // 1. Respect prefers-reduced-motion: reveal immediately, no animation.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    // 2. No IntersectionObserver (very old browser) → reveal immediately.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    let cleared = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            if (cleared) return;
            cleared = true;
            setVisible(true);
            if (once) observer.disconnect();
            if (timeoutHandle) clearTimeout(timeoutHandle);
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);

    // 3. Hard timeout fallback — reveal even if IO never fires
    // (screenshot capture, weird viewport, slow CPU).
    const timeoutHandle = setTimeout(() => {
      if (!cleared) {
        cleared = true;
        setVisible(true);
        observer.disconnect();
      }
    }, timeoutMs);

    return () => {
      observer.disconnect();
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [once, threshold, rootMargin, timeoutMs]);

  return { ref: nodeRef, visible };
}
