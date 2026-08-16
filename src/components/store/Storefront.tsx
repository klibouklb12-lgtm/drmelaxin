"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { OrderForm } from "./OrderForm";
import { SuccessCard } from "./SuccessCard";
import { PRODUCT } from "@/config/product";
import { formatDZD } from "@/config/pricing";
import { t } from "@/lib/i18n";
import { cdn } from "@/lib/cdn";
import { flushOfflineQueue } from "@/lib/orders";
import { useReveal } from "@/hooks/use-reveal";

/**
 * ============================================================================
 *  Storefront — pure white, elegant, pill price, text in transparent frames
 * ============================================================================
 *  Structure (tighter spacing, no big gaps):
 *    1. TITLE at top
 *    2. PHOTO CAROUSEL — badge = "مضاد للتجاعيد"
 *    3. DESCRIPTION — in transparent frame, original Arabic (not elongated)
 *    4. PRICE — pill-shaped burgundy button (✨ 3800 ✨) + old price 5800 struck
 *    5. ORDER FORM
 * ============================================================================
 */
type View = "landing" | "success";
type StoredOrder = { id: string; orderNo: string; total: number };

const CAROUSEL_INTERVAL = 5000;

export function Storefront() {
  const [view, setView] = useState<View>("landing");
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [stock, setStock] = useState<number | null>(null);
  const [lowStock, setLowStock] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);

  // STOCK CHECKING — real-time via Cloudflare Pages Function (KV-cached)
  // Client fetches /api/stock → Pages Function checks KV → falls back to Apps Script
  // Result: 50ms response time (KV cache hit), Apps Script only hit 288 times/day
  useEffect(() => {
    const STOCK_CACHE_KEY = "drmelaxin_stock";
    const FETCH_TIMEOUT_MS = 8000;

    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const checkStock = () => {
      // Step 1: Show cached value instantly (for UX)
      try {
        const cached = localStorage.getItem(STOCK_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (isMounted) {
            setStock(parsed.stock);
            setLowStock(parsed.lowStock);
            setOutOfStock(parsed.outOfStock);
          }
        }
      } catch {}

      // Step 2: Fetch fresh stock via Pages Function (KV-cached, 50ms)
      fetch(`/api/stock?_t=${Date.now()}`, { signal: controller.signal })
        .then(r => r.text())
        .then(text => {
          if (!isMounted) return;
          clearTimeout(timeoutId);
          if (!text || !text.trim().startsWith("{")) return;
          try {
            const data = JSON.parse(text);
            // Sanitize stock value: must be a non-negative number
            let stockVal = typeof data.stock === "number" ? data.stock : parseInt(String(data.stock), 10);
            if (isNaN(stockVal) || stockVal < 0) stockVal = 0;

            // Derive lowStock/outOfStock safely (don't trust server booleans)
            const low = stockVal > 0 && stockVal <= 3;
            const out = stockVal <= 0;

            setStock(stockVal);
            setLowStock(low);
            setOutOfStock(out);

            try {
              localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify({
                stock: stockVal,
                lowStock: low,
                outOfStock: out,
                timestamp: Date.now()
              }));
            } catch {}
          } catch {}
        })
        .catch(() => {
          if (!isMounted) return;
          clearTimeout(timeoutId);
          try {
            const cached = localStorage.getItem(STOCK_CACHE_KEY);
            if (!cached) {
              setOutOfStock(false);
              setLowStock(false);
            }
          } catch {}
        });
    };

    checkStock();

    // Flush any offline-queued orders
    flushOfflineQueue().catch(() => {});

    const handleOnline = () => { flushOfflineQueue().catch(() => {}); };
    window.addEventListener("online", handleOnline);

    // Cleanup: abort fetch + remove listener + mark unmounted
    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // --- bfcache restore: if user navigates back to success page, stay on landing ---
  // Prevents accidental re-submit when user hits browser back after ordering
  useEffect(() => {
    const handlePageshow = (e: PageTransitionEvent) => {
      if (e.persisted && view === "success") {
        // bfcache restore — go back to landing to prevent re-submit
        setView("landing");
        setOrder(null);
      }
    };
    window.addEventListener("pageshow", handlePageshow);
    return () => window.removeEventListener("pageshow", handlePageshow);
  }, [view]);

  if (view === "success" && order) {
    return (
      <SuccessCard
        order={order}
        onBack={() => {
          setOrder(null);
          setView("landing");
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
      />
    );
  }

  const scrollToOrder = () => {
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white">
      <TitleHeader />
      <PhotoCarousel />
      <DescriptionSection />
      <PriceBox onOrder={scrollToOrder} />

      {/* Stock warning — shown when low (<=3) or out (0) */}
      {lowStock && !outOfStock && (
        <div className="px-4 py-2 text-center">
          <div className="inline-block rounded-full px-5 py-2 text-sm font-bold"
            style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#92400e", fontFamily: "var(--font-arabic)" }}>
            {t("stock.low")}
          </div>
        </div>
      )}
      {outOfStock && (
        <div className="px-4 py-3 text-center">
          <div className="inline-block rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#991b1b", fontFamily: "var(--font-arabic)" }}>
            {t("stock.out")}
          </div>
          <p className="text-xs italic mt-1" dir="ltr" style={{ fontFamily: "var(--font-display)", color: "var(--muted-foreground)" }}>
            {t("stock.outFrench")}
          </p>
        </div>
      )}

      <OrderForm
        onSubmitted={(o) => {
          setOrder(o);
          setView("success");
        }}
        disabled={outOfStock}
      />
      <footer className="text-center py-5 px-4 border-t border-burgundy/8">
        <p className="text-[11px] text-muted-foreground/70" style={{ fontFamily: "var(--font-arabic)" }}>
          {t("footer.copyright")}
        </p>
      </footer>
    </div>
  );
}

/* ============================================================================
 *  TITLE HEADER — at the very top, with elegant logo (full visible, special frame)
 * ============================================================================ */
function TitleHeader() {
  return (
    <header className="pt-6 pb-3 px-4 text-center">
      <div className="max-w-sm mx-auto">
        {/* Logo — full visible, NOT round, in a special frame with animated green/blue glow */}
        <div className="flex justify-center mb-2">
          <div
            className="logo-frame rounded-2xl p-2 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(247,245,242,0.5) 100%)",
              border: "1px solid rgba(16, 185, 129, 0.1)",
            }}
          >
            <Image
              src={cdn("/logo.jpg")}
              alt="Dr.Melaxin — ParaPharma"
              width={140}
              height={125}
              priority
              quality={90}
              sizes="140px"
              className="object-contain image-blur-up"
              style={{ width: "auto", height: "90px" }}
            />
          </div>
        </div>

        {/* Brand name */}
        <h1
          className="leading-none"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(1.6rem, 6.5vw, 2rem)",
            color: "var(--burgundy)",
            letterSpacing: "0.06em",
          }}
        >
          {PRODUCT.brandName}
        </h1>

        {/* Line name */}
        <p
          className="italic mt-1"
          dir="ltr"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.15rem, 4.5vw, 1.4rem)",
            color: "var(--burgundy-light)",
          }}
        >
          {PRODUCT.lineName}
        </p>
        {/* Subtitle */}
        <p
          className="mt-0.5"
          dir="ltr"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(0.9rem, 3.2vw, 1rem)",
            color: "var(--muted-foreground)",
          }}
        >
          {PRODUCT.subtitle}
        </p>
        {/* Hairline */}
        <div
          aria-hidden
          className="mx-auto mt-2 h-px"
          style={{
            width: "45%",
            background: "linear-gradient(90deg, transparent, var(--burgundy) 30%, var(--burgundy-light) 50%, var(--burgundy) 70%, transparent)",
          }}
        />
      </div>
    </header>
  );
}

/* ============================================================================
 *  PHOTO CAROUSEL — badge = "مضاد للتجاعيد"
 * ============================================================================ */
function PhotoCarousel() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const photos = PRODUCT.photos;
  const total = photos.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard against empty photos array (would cause modulo by zero / undefined access)
  const safeIndex = total > 0 ? index % total : 0;
  const currentPhoto = photos[safeIndex] || photos[0];

  const next = useCallback(() => {
    setIndex((i) => total > 0 ? (i + 1) % total : 0);
  }, [total]);
  const goTo = useCallback((i: number) => setIndex(total > 0 ? i % total : 0), [total]);

  useEffect(() => {
    if (isPaused) return;
    // Pause carousel when tab is hidden (saves CPU/battery on mobile)
    if (document.hidden) return;
    timerRef.current = setInterval(next, CAROUSEL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [next, isPaused]);

  // Pause when tab hidden, resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (!isPaused) {
        timerRef.current = setInterval(next, CAROUSEL_INTERVAL);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [next, isPaused]);

  // Don't render carousel at all if no photos (prevents crash)
  if (total === 0 || !currentPhoto) {
    return (
      <section className="relative w-full px-4 pt-1 pb-3">
        <div className="relative max-w-sm mx-auto">
          <div className="relative aspect-square rounded-[1.75rem] overflow-hidden bg-cream flex items-center justify-center"
            style={{ border: "3px solid rgba(255, 255, 255, 1)" }}>
            <span className="text-muted-foreground text-sm" style={{ fontFamily: "var(--font-arabic)" }}>
              صورة المنتج · Image
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative w-full px-4 pt-1 pb-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative max-w-sm mx-auto">
        <div
          className="relative aspect-square rounded-[1.75rem] overflow-hidden bg-white gloss-sheen white-frame-static"
          style={{ border: "3px solid rgba(255, 255, 255, 1)" }}
        >
          {/* Only render the current photo — with blur-up + scale-in transition */}
          <Image
            key={safeIndex}
            src={currentPhoto.src}
            alt={currentPhoto.alt}
            fill
            priority={safeIndex <= 1}
            quality={85}
            sizes="(max-width: 768px) 100vw, 384px"
            className="object-cover carousel-image-in"
            onError={(e) => {
              // Hide broken image, show fallback
              (e.target as HTMLImageElement).style.opacity = "0";
            }}
          />

          {/* Badge — "مضاد للتجاعيد" */}
          <div className="absolute top-3 right-3 z-10">
            <span
              className="badge-shimmer inline-flex items-center gap-1 bg-gradient-to-l from-burgundy via-burgundy-light to-burgundy text-pearl px-3 py-1 rounded-full text-[11px] font-bold shadow-md shadow-burgundy/30 backdrop-blur-sm"
              style={{ fontFamily: "var(--font-arabic)" }}
            >
              ✨ {PRODUCT.badgeArabic}
            </span>
          </div>

          <div className="absolute top-3 left-3 z-10">
            <span className="inline-flex items-center bg-black/40 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
              {safeIndex + 1} / {total}
            </span>
          </div>

          <button
            type="button"
            onClick={() => goTo(safeIndex - 1)}
            aria-label="السابق"
            className="btn-elegant absolute top-1/2 left-2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center text-burgundy"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => goTo(safeIndex + 1)}
            aria-label="التالي"
            className="btn-elegant absolute top-1/2 right-2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center text-burgundy"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/15 z-10">
            <div
              key={index}
              className="h-full bg-gradient-to-r from-burgundy to-burgundy-light carousel-progress"
              style={{ animationDuration: `${CAROUSEL_INTERVAL}ms` }}
            />
          </div>
        </div>

        <div className="mt-3 flex gap-1.5 justify-center overflow-x-auto scrollbar-thin pb-1">
          {photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`صورة ${i + 1}`}
              className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === index
                  ? "border-burgundy scale-110"
                  : "border-burgundy/15 opacity-55 hover:opacity-100"
              }`}
            >
              <Image src={photo.src} alt={photo.alt} fill sizes="48px" quality={60} loading="lazy" className="object-cover image-blur-up" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
 *  DESCRIPTION — in transparent frame, original Arabic, tighter spacing
 * ============================================================================ */
function DescriptionSection() {
  const reveal = useReveal<HTMLDivElement>();
  return (
    <section className="px-4 py-3">
      <div
        ref={reveal.ref}
        className={`reveal max-w-sm mx-auto text-frame px-5 py-4 text-center ${reveal.visible ? "is-visible" : ""}`}
      >
        {/* Arabic tagline */}
        <p
          className="text-foreground leading-relaxed"
          style={{
            fontFamily: "var(--font-arabic)",
            fontWeight: 700,
            fontSize: "clamp(1.15rem, 4.5vw, 1.35rem)",
            lineHeight: 1.7,
          }}
        >
          {PRODUCT.taglineArabic}
        </p>

        {/* Arabic description — original (not elongated) */}
        <p
          className="mt-2.5 text-foreground/85 leading-loose"
          style={{ fontFamily: "var(--font-arabic)", fontSize: "clamp(1.08rem, 4vw, 1.18rem)", lineHeight: 1.9 }}
        >
          {PRODUCT.descriptionArabic}
        </p>

        {/* Benefits — Arabic (integrated line) */}
        <p
          className="mt-3 font-bold"
          style={{ fontFamily: "var(--font-arabic)", fontSize: "clamp(1rem, 3.6vw, 1.1rem)", color: "var(--burgundy)" }}
        >
          {PRODUCT.benefitsArabic}
        </p>

        {/* Subtle divider */}
        <div className="my-3 flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-burgundy/20" />
          <span className="text-burgundy/60 text-xs">✦</span>
          <div className="h-px w-10 bg-burgundy/20" />
        </div>

        {/* French tagline */}
        <p
          className="italic leading-relaxed"
          dir="ltr"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.05rem, 3.6vw, 1.15rem)", color: "var(--burgundy-light)" }}
        >
          {PRODUCT.taglineFrench}
        </p>

        {/* French description */}
        <p
          className="mt-2 italic text-muted-foreground leading-relaxed"
          dir="ltr"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(0.98rem, 3.2vw, 1.05rem)" }}
        >
          {PRODUCT.descriptionFrench}
        </p>

        {/* Benefits — French */}
        <p
          className="mt-2 italic font-medium"
          dir="ltr"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(0.92rem, 3.2vw, 1rem)", color: "var(--burgundy-light)" }}
        >
          {PRODUCT.benefitsFrench}
        </p>
      </div>
    </section>
  );
}

/* ============================================================================
 *  PRICE BOX — 5800 struck above, 3900 in burgundy pill + FREE shipping banner below
 * ============================================================================ */
function PriceBox({ onOrder }: { onOrder: () => void }) {
  const reveal = useReveal<HTMLDivElement>();
  return (
    <section className="px-4 py-4">
      <div
        ref={reveal.ref}
        className={`reveal max-w-sm mx-auto flex flex-col items-center gap-3 ${reveal.visible ? "is-visible" : ""}`}
      >
        {/* Old price — elegant gray, struck through, "دج" */}
        <span
          className="relative inline-block text-foreground/50 strike-through price-fade-in"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: "clamp(1.05rem, 3.8vw, 1.3rem)",
            lineHeight: 1,
            letterSpacing: "0.01em",
          }}
        >
          {formatDZD(PRODUCT.oldPrice)} دج
        </span>

        {/* New price — burgundy pill (exactly like screenshot) */}
        <button
          type="button"
          onClick={onOrder}
          className="price-reveal pill-price-glow inline-flex items-center gap-1.5 px-5 py-2.5 transition-all btn-elegant"
          aria-label={`سعر المنتج ${formatDZD(PRODUCT.basePrice)} دج`}
        >
          <span
            className="fancy-price-text"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: "clamp(1.2rem, 5vw, 1.6rem)",
              lineHeight: 1,
              color: "var(--pearl)",
            }}
          >
            {formatDZD(PRODUCT.basePrice)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: "clamp(0.75rem, 2.8vw, 0.9rem)",
              color: "var(--pearl)",
            }}
          >
            دج
          </span>
          <span className="text-base leading-none">✨</span>
        </button>

        {/* FREE SHIPPING banner — BELOW the price, big, elegant, convincing */}
        <div className="free-ship-big price-fade-in w-full max-w-xs rounded-2xl px-5 py-4 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(255,255,255,0.95) 50%, rgba(16,185,129,0.04) 100%)",
            border: "1.5px solid rgba(16,185,129,0.2)",
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold flex items-center gap-1.5" style={{ fontFamily: "var(--font-arabic)", color: "var(--burgundy)" }}>
              🚚 توصيل مجاني للمنزل
            </span>
            <span className="text-sm italic" dir="ltr" style={{ fontFamily: "var(--font-display)", color: "var(--muted-foreground)" }}>
              Livraison à domicile GRATUITE
            </span>
            <span className="text-xs font-medium" style={{ fontFamily: "var(--font-arabic)", color: "var(--muted-foreground)" }}>
              لكل الولايات · Toutes wilayas
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
