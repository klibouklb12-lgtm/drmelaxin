# Dr.Melaxin — Netlify Deployment Guide

## Overview

This guide deploys the Dr.Melaxin storefront to Netlify via GitHub integration.

**Architecture:**
```
Visitor → Netlify (HTML + JS/CSS) → instant load
                ↓ (when ordering)
         POST /api/orders → Google Sheets (free, unlimited)
                ↓ (stock check)
         Google Sheets → cached 7 days in browser
```

**Bandwidth estimate (with CDN active):**
- First-time visitor: ~330KB from Netlify
- Repeat visitor (7-day SW cache): ~4KB
- 500k visits/month with 50% repeat ≈ 84GB (fits Netlify's 100GB free tier)

---

## Step 1: Push to GitHub

```bash
# In the project root:
git init
git add .
git commit -m "Dr.Melaxin — Netlify-ready"
git branch -M main
git remote add origin https://github.com/YOUR_USER/drmelaxin.git
git push -u origin main
```

**Important:** Make the repo PUBLIC if you want to use the jsDelivr CDN (free unlimited image bandwidth). If private, images load from Netlify (counts toward bandwidth).

---

## Step 2: Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → "Add new site" → "Import an existing project"
2. Connect your GitHub account
3. Select the `drmelaxin` repo
4. Build settings (auto-detected from `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Node version:** 20
5. Click "Deploy site"

---

## Step 3: Set Environment Variables

**CRITICAL — do this before the first deploy succeeds (or trigger a redeploy after):**

1. Netlify dashboard → your site → **Site Settings** → **Environment Variables**
2. Add each variable:

| Key | Value | Required? |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_SHEET_URL` | `https://script.google.com/macros/s/AKfycbyDcvKb2USPkCqZf9PqX-yxPvfo5rZ0IFGi98-syk5kU09l0q6ZazmFQ883BPoXCXiS/exec` | ✅ YES |
| `NEXT_PUBLIC_CDN_BASE` | `https://cdn.jsdelivr.net/gh/YOUR_USER/drmelaxin@main` | ⚠️ Optional (recommended) |

3. After adding, go to **Deploys** → **Trigger deploy** → **Deploy site**

---

## Step 4: Verify Deployment

1. Visit your Netlify URL (e.g. `https://drmelaxin.netlify.app`)
2. Check:
   - Homepage loads with all images
   - Carousel works
   - Order form accepts input
   - Submit creates an order (check Google Sheet → "Orders" tab)
   - Stock warning appears if stock ≤ 3

---

## Optional: Activate jsDelivr CDN (Free Unlimited Image Bandwidth)

**Why?** Offloads ~488KB of images per visit to jsDelivr (free, unlimited). Netlify only serves HTML + JS/CSS (~330KB).

**Setup:**
1. Make sure your GitHub repo is PUBLIC
2. In Netlify → Site Settings → Environment Variables:
   - Key: `NEXT_PUBLIC_CDN_BASE`
   - Value: `https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USER/YOUR_REPO@main`
3. Trigger redeploy
4. Wait ~5 minutes for jsDelivr to cache the assets
5. Verify: open browser DevTools → Network → images should load from `cdn.jsdelivr.net`

**Fallback:** If jsDelivr is down, the Service Worker automatically falls back to your Netlify origin. No manual intervention needed.

---

## How the Free Stack Works

| Component | Service | Free Tier | Purpose |
|---|---|---|---|
| Hosting | Netlify | 100GB bandwidth/month | HTML + JS/CSS |
| Images (optional) | jsDelivr CDN | Unlimited | Gallery + logo images |
| Orders backend | Google Sheets | Unlimited | Order storage + admin |
| Stock management | Google Sheets | Unlimited | Live stock updates |
| Fonts | Google Fonts | Unlimited | Noto Sans Arabic + Cormorant |
| Rate limiting | In-memory | Per-instance | Basic abuse prevention |

**Total monthly cost: $0**

---

## Bandwidth Math (500k visits/month)

| Scenario | Netlify bandwidth | Fits 100GB free? |
|---|---|---|
| No CDN, no SW (worst case) | 500k × 830KB = 415GB | ❌ No |
| CDN active, no SW | 500k × 330KB = 165GB | ❌ No |
| CDN + SW, 50% repeat | 250k × 330KB + 250k × 4KB = 84GB | ✅ Yes |
| CDN + SW, 70% repeat | 150k × 330KB + 350k × 4KB = 51GB | ✅ Yes |
| CDN + SW, 90% repeat | 50k × 330KB + 450k × 4KB = 18GB | ✅ Yes |

**Conclusion:** 500k visits/month fits Netlify free IF:
- ✅ CDN is active (images offloaded)
- ✅ Service Worker is caching (repeat visitors = ~4KB)
- ✅ ~50%+ of visitors are repeat (within 7 days)

For pure ad traffic (mostly unique visitors), consider **Cloudflare Pages** (unlimited bandwidth) — same repo, same code, just connect GitHub there instead.

---

## Admin Panel

- URL: `https://your-site.netlify.app/admin`
- Password: `007`
- Features: edit product info, update stock, view stats
- All changes saved to Google Sheets (live, no redeploy needed)

---

## Google Sheets Setup (Already Done)

The Google Apps Script is already deployed at:
```
https://script.google.com/macros/s/AKfycbyDcvKb2USPkCqZf9PqX-yxPvfo5rZ0IFGi98-syk5kU09l0q6ZazmFQ883BPoXCXiS/exec
```

If you need to redeploy it (new sheet, different account):
1. Create empty Google Sheet
2. Extensions → Apps Script
3. Paste contents of `download/google-apps-script.gs`
4. Run `setup()` function (authorize when prompted)
5. Set up the `onEditTrigger` trigger manually (see top of the script file)
6. Deploy → New deployment → Web app → Execute as: Me → Access: Anyone
7. Copy the URL → update `NEXT_PUBLIC_GOOGLE_SHEET_URL` in Netlify

---

## Troubleshooting

**Images not loading:**
- If CDN active: check repo is PUBLIC, check `NEXT_PUBLIC_CDN_BASE` is correct
- If no CDN: check `public/gallery/` folder is in the repo

**Orders not submitting:**
- Check `NEXT_PUBLIC_GOOGLE_SHEET_URL` is set in Netlify env vars
- Check Google Apps Script deployment access is "Anyone"
- Check browser console for CORS errors

**Stock not updating:**
- Make sure `onEditTrigger` is set up in Apps Script (clock icon → Add Trigger)

**Bandwidth exceeded:**
- Activate the CDN (Step 4 above)
- Or migrate to Cloudflare Pages (unlimited bandwidth, same code)

---

## Quick Commands

```bash
# Local development
bun run dev

# Production build (test locally)
bun run build && bun run start

# Deploy to Netlify (via GitHub push)
git add . && git commit -m "update" && git push
# Netlify auto-deploys on push
```
