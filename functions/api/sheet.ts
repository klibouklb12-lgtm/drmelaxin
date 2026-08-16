/**
 * ============================================================================
 *  /api/sheet — Cloudflare Pages Function (admin panel proxy)
 * ============================================================================
 *
 *  PURPOSE: Lets the admin panel call Apps Script without exposing the URL.
 *  Supports GET (product, stats) and POST (updateProduct, updateStock).
 *
 *  USAGE: Client fetches /api/sheet?action=product instead of Apps Script directly
 *  Admin panel UX stays EXACTLY the same — just the URL changes.
 * ============================================================================
 */

interface Env {
  DRMELAXIN_CACHE: KVNamespace;
  APPS_SCRIPT_URL: string;
}

const FETCH_TIMEOUT_MS = 10000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const env = context.env;
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sheetUrl = env.APPS_SCRIPT_URL || "";

  if (!sheetUrl) {
    return new Response(
      JSON.stringify({ error: "Backend not configured" }),
      { headers: corsHeaders, status: 500 }
    );
  }

  try {
    let targetUrl: string;

    if (request.method === "GET") {
      // Forward query params (action=product, action=stats, etc.)
      const action = url.searchParams.get("action") || "product";
      targetUrl = `${sheetUrl}?action=${encodeURIComponent(action)}&_t=${Date.now()}`;
    } else {
      // POST: read body, convert to GET params for Apps Script
      const body = await request.json().catch(() => ({}));
      const params = new URLSearchParams();

      if (body.action) {
        params.set("action", body.action);
      }

      // Convert product/stock updates to query params
      if (body.action === "updateProduct" && body.product) {
        for (const [k, v] of Object.entries(body.product)) {
          params.set(k, String(v));
        }
      } else if (body.action === "updateStock" && body.stock !== undefined) {
        params.set("stock", String(body.stock));
      }
      // Default: pass through all body fields as query params
      else {
        for (const [k, v] of Object.entries(body)) {
          if (k !== "action") params.set(k, String(v));
        }
      }

      targetUrl = `${sheetUrl}?${params.toString()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    const text = await response.text();

    // If updating stock, invalidate the stock cache
    if (request.method === "POST" && env.DRMELAXIN_CACHE) {
      try {
        await env.DRMELAXIN_CACHE.delete("stock:current");
      } catch {}
    }

    return new Response(text, {
      headers: corsHeaders,
      status: response.status,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Backend unavailable", details: String(err) }),
      { headers: corsHeaders, status: 502 }
    );
  }
};
