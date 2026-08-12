# Dr.Melaxin — GitHub Pages Deployment Guide

## Overview

Deploy the Dr.Melaxin storefront to **GitHub Pages** (free, 100GB bandwidth/month).

**Architecture (100% free, no server):**
```
Visitor → GitHub Pages (HTML + JS + CSS)
                ↓ (images)
         jsDelivr CDN (free, unlimited)
                ↓ (orders)
         Google Sheets (free, unlimited)
                ↓ (stock check)
         Google Sheets (cached 7 days in browser)
```

**Bandwidth estimate (500k visits/month):**
- Per first visit: ~200KB (HTML 8KB + JS 150KB + CSS 20KB, gzipped)
- Repeat visit (7-day SW cache): ~4KB
- 500k visits with 15% repeat ≈ 85GB → fits 100GB limit
- Images: 0 (served from jsDelivr CDN)

---

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Dr.Melaxin — GitHub Pages ready"
git branch -M main
git remote add origin https://github.com/YOUR_USER/drmelaxin.git
git push -u origin main
```

**Repo MUST be public** (required for GitHub Pages free tier + jsDelivr CDN).

---

## Step 2: Set Environment Variables

In GitHub: **Settings → Secrets and variables → Actions → Variables** (not Secrets — these need to be visible at build time):

Add these as **Variables** (not Secrets):

| Name | Value | Required? |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_SHEET_URL` | `https://script.google.com/macros/s/AKfycbyDcvKb2USPkCqZf9PqX-yxPvfo5rZ0IFGi98-syk5kU09l0q6ZazmFQ883BPoXCXiS/exec` | ✅ YES |
| `NEXT_PUBLIC_CDN_BASE` | `https://cdn.jsdelivr.net/gh/YOUR_USER/drmelaxin@main` | ✅ YES (saves bandwidth) |
| `NEXT_PUBLIC_BASE_PATH` | `/drmelaxin` (your repo name) | ⚠️ If NOT using custom domain |

**Important:** Set `NEXT_PUBLIC_BASE_PATH` to `/{repo-name}` if using the default `username.github.io/repo-name/` URL. Leave empty if using a custom domain.

---

## Step 3: Enable GitHub Pages

1. Go to: **Settings → Pages**
2. Under "Build and deployment":
   - **Source:** GitHub Actions
3. The workflow in `.github/workflows/deploy.yml` handles everything automatically.

---

## Step 4: Trigger First Deploy

Push any commit to `main`:
```bash
git commit --allow-empty -m "trigger deploy" && git push
```

Or go to: **Actions tab → "Deploy to GitHub Pages" → Run workflow**

The deploy takes ~2 minutes. Your site will be at:
```
https://YOUR_USER.github.io/drmelaxin/
```

---

## Step 5: (Optional) Custom Domain

To use `drmelaxin.com` instead of `username.github.io/drmelaxin/`:

1. Buy a domain (~$10/year from Namecheap, Cloudflare, etc.)
2. In GitHub: **Settings → Pages → Custom domain → enter your domain**
3. At your domain registrar, set DNS:
   - `A` record → `185.199.108.153`
   - `A` record → `185.199.109.153`
   - `A` record → `185.199.110.153`
   - `A` record → `185.199.111.153`
   - Or `CNAME` record → `YOUR_USER.github.io`
4. Remove `NEXT_PUBLIC_BASE_PATH` from env vars (leave empty)
5. Push to trigger redeploy

With a custom domain, GitHub Pages still gives 100GB/month free. For truly unlimited, deploy the same repo to **Cloudflare Pages** (zero code changes).

---

## How the Free Stack Works

| Component | Service | Free Tier | Purpose |
|---|---|---|---|
| Hosting | GitHub Pages | 100 GB bandwidth/month | HTML + JS + CSS |
| Images | jsDelivr CDN | Unlimited | Gallery + logo images |
| Orders | Google Sheets | Unlimited | Order storage |
| Stock | Google Sheets | Unlimited | Live stock updates |
| Admin | Google Sheets | Unlimited | Product + stock management |
| Fonts | Google Fonts | Unlimited | Noto Sans Arabic + Cormorant |
| Auto-deploy | GitHub Actions | 2000 min/month | CI/CD pipeline |

**Total monthly cost: $0**

---

## Bandwidth Math (500k visits/month)

| Scenario | GitHub Pages bandwidth | Fits 100GB? |
|---|---|---|
| No CDN (images from GitHub) | 500k × 688KB = 344GB | ❌ No |
| CDN active, no SW | 500k × 200KB = 100GB | ⚠️ At limit |
| CDN + SW, 15% repeat | 425k × 200KB + 75k × 4KB = 85GB | ✅ Yes |
| CDN + SW, 30% repeat | 350k × 200KB + 150k × 4KB = 70GB | ✅ Yes |

**Required for 500k visits:**
- ✅ `NEXT_PUBLIC_CDN_BASE` must be set (images offloaded to jsDelivr)
- ✅ Service Worker caches repeat visitors (7-day cache)
- ✅ Repo must be public

---

## Admin Panel

- URL: `https://your-site.github.io/drmelaxin/admin/`
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
7. Copy URL → update `NEXT_PUBLIC_GOOGLE_SHEET_URL` in GitHub Variables

---

## Safety Net: Cloudflare Pages

If you ever hit GitHub's 100GB limit:

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect your GitHub repo
3. Build settings: Framework = Next.js, Build command = `npm run build`, Output = `out`
4. Set the same env vars
5. Deploy

**Same code, same repo, zero changes.** Cloudflare Pages = unlimited bandwidth, unlimited requests, free forever.

---

## Troubleshooting

**Images not loading:**
- Check repo is PUBLIC
- Check `NEXT_PUBLIC_CDN_BASE` matches your GitHub repo URL
- Wait 5 min for jsDelivr to cache after first deploy

**Orders not submitting:**
- Check `NEXT_PUBLIC_GOOGLE_SHEET_URL` is set in GitHub Variables
- Check Apps Script deployment access is "Anyone"
- Check browser console for errors

**Assets 404 on `username.github.io/repo/`:**
- Set `NEXT_PUBLIC_BASE_PATH` to `/repo-name`
- Push to trigger rebuild

**Build fails in GitHub Actions:**
- Check Actions tab → click the failed run → read the log
- Most common: missing env vars (Step 2)

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
# GitHub Actions auto-deploys in ~2 min
```
