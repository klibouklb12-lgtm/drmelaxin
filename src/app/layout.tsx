import type { Metadata } from "next";
import { Noto_Sans_Arabic, Cormorant_Garamond, Amiri } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "sonner";
import { ThemeProvider } from "next-themes";
import { BRAND } from "@/config/brand";
import { PRODUCT } from "@/config/product";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Script from "next/script";

/**
 * Masterpiece typography stack — three-font system for elegance:
 *   • Cormorant Garamond  — Latin display (brand mark, French accents)
 *   • Amiri               — Arabic display (elegant naskh serif)
 *   • Noto Sans Arabic    — Arabic body (clean, readable)
 *
 * Together they create the "novel of elegance" voice:
 *   classical Arabic narrative (Amiri serif) flows into Latin luxury
 *   typography (Cormorant serif) — both serifs harmonize visually.
 */
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "700"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "600"],
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://drmelaxin.space-z.ai"),
  title: `${BRAND.name} ${PRODUCT.lineName} — ${PRODUCT.subtitle}`,
  description: PRODUCT.descriptionFrench,
  icons: { icon: "/logo.svg" },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${BRAND.name} ${PRODUCT.lineName}`,
    description: PRODUCT.taglineFrench,
    type: "website",
    locale: "ar_DZ",
    images: [{ url: PRODUCT.photos[0].src }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} ${PRODUCT.lineName}`,
    description: PRODUCT.taglineFrench,
    images: [PRODUCT.photos[0].src],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/** JSON-LD structured data for SEO (Google rich results). */
const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: `${BRAND.name} ${PRODUCT.lineName}`,
  description: PRODUCT.descriptionFrench,
  brand: {
    "@type": "Brand",
    name: BRAND.name,
  },
  offers: {
    "@type": "Offer",
    price: PRODUCT.basePrice,
    priceCurrency: "DZD",
    availability: "https://schema.org/InStock",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Preconnect to external origins for faster first load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        {/* JSON-LD structured data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${notoSansArabic.variable} ${cormorant.variable} ${amiri.variable} font-sans antialiased bg-cream text-foreground`}
      >
        {/* <noscript> fallback — users with JS disabled still see something */}
        <noscript>
          <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
            <h1>Dr.Melaxin</h1>
            <p>This store requires JavaScript to be enabled for ordering.</p>
            <p>Please enable JavaScript in your browser settings, or call us directly.</p>
          </div>
        </noscript>

        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Sonner
            position="top-center"
            richColors
            dir="rtl"
            toastOptions={{ className: "font-sans" }}
          />
        </ThemeProvider>
      </body>
      {/* Service Worker — caches entire site for 1 year. Zero bandwidth on repeat visits. */}
      <Script id="sw-register" strategy="afterInteractive">
        {`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(registration) {
                console.log('SW registered');
              }, function(err) {
                console.log('SW registration failed', err);
              });
            });
          }
        `}
      </Script>
    </html>
  );
}
