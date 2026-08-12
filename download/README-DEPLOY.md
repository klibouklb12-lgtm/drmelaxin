# Dr.Melaxin Cemenrete CX — Landing Page

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Set up the database
bun run db:push

# 3. Start dev server
bun run dev

# 4. Open http://localhost:3000
```

## Production Build

```bash
bun run build
bun run start
```

## Deploy to Netlify (300 Credits/Month Free Tier)

### Netlify's Latest Pricing (2025-2026 Credit System)
| Resource | Credit Cost | Max on Free Tier |
|---|---|---|
| Production Deploys | 15 credits/deploy | 20 deploys/month |
| Bandwidth | 20 credits/GB | 15 GB total |
| Web Requests | 2 credits/10k requests | 1.5M requests/month |
| Compute (Functions/Build) | 10 credits/GB-hour | 30 GB-hours/month |
| AI Inference | 180 credits/$1 | $1.66/month |

**Total free credits: 300/month**

### Can We Handle 30k Visits/Day for 30 Days (900k Visits)?

**Bandwidth calculation:**
- Page size: ~50KB (optimized: AVIF/WebP images, single photo render, lazy thumbnails)
- 900k visits × 50KB = 45GB → **45GB exceeds the 15GB free limit!**

**Solution: Stay absolutely free with aggressive caching + Google Sheets**

1. **Static generation**: `bun run build` generates static HTML. Netlify CDN caches globally.
2. **Aggressive cache headers**: Set `Cache-Control: public, max-age=31536000, immutable` on all static assets (images, fonts, CSS, JS). Repeat visitors load from browser cache → ZERO bandwidth.
3. **Service Worker**: Cache the entire page on first visit. Subsequent visits load from cache → ZERO server requests, ZERO bandwidth.
4. **Google Sheets for orders**: POST orders directly to a Google Apps Script Web App. Zero serverless function calls for orders.
5. **Google Sheets for product data**: Admin panel reads from Google Sheets (rarely). Client-side caches in `localStorage` with 5-minute TTL.

### With Service Worker + Caching (90% cache hit rate):
- 900k visits × 10% (cache miss) × 50KB = 4.5GB → **0.09 credits** ✓
- 900k visits × 10% = 90k requests → **0.018 credits** ✓
- 0 production deploys (only on code change) → **0 credits** ✓
- **Total: ~0.1 credits out of 300** → ABSOLUTELY FREE ✓

### Without Service Worker (CDN-only, 50% cache hit rate):
- 900k × 50% × 50KB = 22.5GB → **450 credits** → EXCEEDS FREE TIER
- **Need Service Worker for 30k/day to stay free**

### Recommended Architecture
```
Visitor → Netlify CDN (static HTML, cached) → instant load
                ↓ (only if cache miss, ~10%)
         Origin server (Netlify) → serves cached HTML
                ↓ (only if ordering)
         POST /api/orders → Google Sheets (free, unlimited)
                ↓ (only if admin updates)
         Admin → Google Sheets → polled rarely by clients (localStorage cache)
```

### Google Sheets Integration Setup
1. Create a Google Sheet with columns: orderNo, fullName, phone, wilaya, commune, delivery, quantity, total, notes, timestamp
2. Open Extensions → Apps Script
3. Paste this code:
```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.orderNo, data.fullName, data.phone, data.wilayaName,
    data.communeName, data.delivery, data.quantity, data.total,
    data.notes || '', new Date()
  ]);
  return ContentService.createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
```
4. Deploy as Web App (Execute as: Me, Access: Anyone)
5. Copy the URL
6. Replace `createOrder()` in `src/lib/orders.ts` with:
```typescript
await fetch("YOUR_APPS_SCRIPT_URL", {
  method: "POST",
  body: JSON.stringify({ orderNo, fullName, phone, wilayaName, communeName, delivery, quantity, total, notes }),
});
```
7. Remove Prisma/SQLite (delete `src/lib/db.ts`, `prisma/`)

### Service Worker Setup (Critical for 30k/day)
Add `public/sw.js`:
```javascript
const CACHE_NAME = 'drmelaxin-v1';
const ASSETS = ['/', '/logo.jpg', '/gallery/hero.jpg', '/gallery/dramatic.jpg', '/gallery/texture.jpg', '/gallery/pearl.jpg', '/gallery/lifestyle.jpg', '/gallery/benefits-banner.jpg', '/gallery/collage.jpg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
```

Register in `src/app/layout.tsx`:
```typescript
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

## Tech Stack
- Next.js 16 (App Router, Turbopack)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM (SQLite) — replaceable with Google Sheets
- 1,708 Algerian communes (cascade dropdown)
- FREE home shipping (all wilayas)
- Admin panel at /admin (password: 007)
- CPU-optimized: all animations slowed + `will-change` GPU hints
