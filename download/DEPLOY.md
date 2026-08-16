# Dr.Melaxin — Cloudflare Pages Deployment Guide

## Overview

Deploy the Dr.Melaxin storefront to **Cloudflare Pages** (free, unlimited bandwidth, commercial use allowed).

**Why Cloudflare Pages?**
- ✅ **Unlimited bandwidth** (not 100GB like GitHub Pages, not 15GB like Netlify)
- ✅ **Commercial use explicitly allowed** (unlike GitHub Pages which prohibits e-commerce)
- ✅ **Unlimited static requests** (400k visits/month? No problem)
- ✅ **Free forever** — no credit card, no trial expiry
- ✅ **Global CDN** — 300+ edge locations, sub-50ms latency worldwide
- ✅ **Same GitHub-connect flow as Netlify** — push to deploy

**Architecture (100% free, no server, commercial-ready):**
```
Visitor → Cloudflare Pages CDN (HTML + JS + CSS, unlimited)
                ↓ (images)
         jsDelivr CDN (free, unlimited)
                ↓ (orders)
         Google Sheets (free, unlimited)
                ↓ (stock check)
         Google Sheets (cached 7 days in browser)
```

---

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Dr.Melaxin — Cloudflare Pages ready"
git branch -M main
git remote add origin https://github.com/YOUR_USER/drmelaxin.git
git push -u origin main
```

Repo can be **public OR private** (Cloudflare Pages supports both on free tier).

---

## Step 2: Connect to Cloudflare Pages

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) → Sign up (free, no credit card)
2. Click **"Create a project"** → **"Connect to Git"**
3. Authorize Cloudflare to access your GitHub account
4. Select the `drmelaxin` repo
5. Build settings:
   - **Framework preset:** Next.js
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
   - **Node version:** 20 (under "Environment variables" → add `NODE_VERSION = 20`)
6. Click **"Save and Deploy"**

First deploy takes ~3 minutes. Your site goes live at:
```
https://drmelaxin.pages.dev
```
(or whatever you name the project)

---

## Step 3: Set Environment Variables

**Before or after first deploy**, add these in Cloudflare Pages:

**Settings → Environment variables** (add each):

| Key | Value | Required? |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_SHEET_URL` | `https://script.google.com/macros/s/AKfycbyDcvKb2USPkCqZf9PqX-yxPvfo5rZ0IFGi98-syk5kU09l0q6ZazmFQ883BPoXCXiS/exec` | ✅ YES |
| `NEXT_PUBLIC_CDN_BASE` | `https://cdn.jsdelivr.net/gh/YOUR_USER/drmelaxin@main` | ⚠️ Optional (repo must be public for jsDelivr) |
| `NODE_VERSION` | `20` | ✅ YES |

**Note:** Do NOT set `NEXT_PUBLIC_BASE_PATH` — Cloudflare Pages serves from root (`/`), not a subpath.

After adding vars, trigger a redeploy: **Deployments → Retry deployment**.

---

## Step 4: Verify Deployment

1. Visit `https://your-project.pages.dev`
2. Check:
   - Homepage loads with all images
   - Carousel works
   - Order form accepts input → submit → success page
   - Check Google Sheet → "Orders" tab → new order appears
   - Stock warning shows if stock ≤ 3

---

## Step 5: (Optional) Custom Domain

To use `drmelaxin.com` instead of `*.pages.dev`:

1. Buy a domain (~$10/year from Namecheap, Cloudflare Registrar, etc.)
2. In Cloudflare Pages: **Custom domains → Set up a custom domain**
3. Cloudflare auto-configures DNS if your domain is on Cloudflare DNS (free)
4. If domain is elsewhere, add a `CNAME` record → `your-project.pages.dev`

Custom domains on Cloudflare Pages are **free** and include **free SSL**.

---

## Why Not GitHub Pages or Netlify?

| Platform | Bandwidth | Commercial Use? | Verdict |
|---|---|---|---|
| GitHub Pages | 100 GB/month | ❌ **Prohibited** (ToS: "not allowed for e-commerce") | Risk of takedown |
| Netlify Free | 15 GB/month | ✅ Allowed | Too tight for 400k visits |
| Vercel Hobby | 100 GB/month | ⚠️ "Hobby" tier (gray area for commercial) | Risk of upgrade pressure |
| **Cloudflare Pages** | **Unlimited** | ✅ **Explicitly allowed** | **Best choice** |

---

## How the Free Stack Works

| Component | Service | Free Tier | Purpose |
|---|---|---|---|
| Hosting | Cloudflare Pages | **Unlimited bandwidth** | HTML + JS + CSS |
| Images | jsDelivr CDN | Unlimited | Gallery + logo images |
| Orders | Google Sheets | Unlimited | Order storage |
| Stock | Google Sheets | Unlimited | Live stock updates |
| Admin | Google Sheets | Unlimited | Product + stock management |
| Fonts | Google Fonts | Unlimited | Noto Sans Arabic + Cormorant |
| CI/CD | Cloudflare Pages | 500 builds/month | Auto-deploy on push |

**Total monthly cost: $0** — even at 1M visits/month.

---

## Bandwidth Math (500k visits/month, all from ads = unique)

| Component | Per visit | Monthly (500k) | Source |
|---|---|---|---|
| HTML | 7.7 KB | 3.85 GB | Cloudflare Pages (unlimited) |
| JS + CSS | ~170 KB | 85 GB | Cloudflare Pages (unlimited) |
| Images | ~488 KB | 244 GB | jsDelivr CDN (unlimited) |
| Stock check | ~0.5 KB | 0.25 GB | Google Sheets (unlimited) |

**Total bandwidth used: 333 GB/month**
**Total cost: $0** (all on unlimited free tiers)

Even at **1M visits/month** (666 GB), you're still 100% free on Cloudflare Pages.

---

## Admin Panel

- URL: `https://your-project.pages.dev/admin/`
- Password: `007`
- All changes save to Google Sheets (live, no redeploy needed)

---

## Google Sheets Setup (Already Done)

The Google Apps Script is already deployed. If you need to redeploy:
1. Create empty Google Sheet
2. Extensions → Apps Script
3. Paste `download/google-apps-script.gs`
4. Run `setup()` → authorize
5. Set up `onEditTrigger` trigger manually (see script header)
6. Deploy → New deployment → Web app → Execute as: Me → Access: Anyone
7. Copy URL → update `NEXT_PUBLIC_GOOGLE_SHEET_URL` in Cloudflare Pages

---

## Troubleshooting

**Build fails on Cloudflare Pages:**
- Check `NODE_VERSION` env var is set to `20`
- Check build output directory is `out` (not `.next`)
- Check build logs in Cloudflare dashboard

**Images not loading:**
- If using jsDelivr CDN: repo must be PUBLIC, `NEXT_PUBLIC_CDN_BASE` must be correct
- If not using CDN: images load from Cloudflare Pages (still unlimited, just slightly more bandwidth)

**Orders not submitting:**
- Check `NEXT_PUBLIC_GOOGLE_SHEET_URL` is set in Cloudflare env vars
- Check Apps Script deployment access is "Anyone"
- Check browser console for errors

**404 on routes:**
- Ensure `trailingSlash: true` is set in next.config.ts (it is)
- Cloudflare Pages handles this automatically for static exports

---

## Quick Commands

```bash
# Local development
npm run dev

# Test static export locally
npm run build
npx serve out

# Deploy (just push to main)
git add . && git commit -m "update" && git push
# Cloudflare Pages auto-deploys in ~3 min
```
