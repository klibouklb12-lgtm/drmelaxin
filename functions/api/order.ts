/**
 * ============================================================================
 *  /api/order — Cloudflare Pages Function (POST order to Apps Script)
 * ============================================================================
 *
 *  ARCHITECTURE:
 *  Client POSTs JSON to /api/order → this function forwards to Apps Script
 *
 *  WHY THIS APPROACH:
 *  1. Apps Script URL hidden from client (server-side only)
 *  2. POST with JSON body (no PII in URL — privacy)
 *  3. No CORS issues (same-origin /api/*)
 *  4. Server-side rate limiting via KV (per phone + per IP)
 *  5. Server-side input validation (don't trust client)
 *
 *  SECURITY:
 *  - Rate limit: 3 orders/hour per phone + 5 orders/hour per IP
 *  - Input validation: name, phone regex, quantity 1-4, total minimum
 *  - XSS sanitization: strip HTML tags from all inputs
 *  - Idempotency: forward client's idempotency key to Apps Script
 *
 *  RESULT AT 1M visits/month:
 *  - If 5% conversion: 50K orders/month = ~1666/day
 *  - Each order = 1 Apps Script call (well within 90 min/day limit)
 * ============================================================================
 */

interface Env {
  DRMELAXIN_CACHE: KVNamespace;
  APPS_SCRIPT_URL: string;
}

const FETCH_TIMEOUT_MS = 10000; // 10s (was 15s — too long for users to wait)
const RATE_LIMIT_WINDOW = 3600; // 1 hour
const RATE_LIMIT_PHONE = 20; // 20 orders/hour per phone (was 3 — too strict)
const RATE_LIMIT_IP = 30; // 30 orders/hour per IP (was 5)

// Algerian phone: 05/06/07 + 8 digits
const PHONE_REGEX = /^0[567]\d{8}$/;

interface OrderPayload {
  fullName?: string;
  phone?: string;
  wilayaName?: string;
  communeName?: string;
  quantity?: number;
  total?: number;
  notes?: string;
  idempotencyKey?: string;
}

/** Strip HTML tags + control chars (XSS prevention). */
function sanitize(input: string): string {
  if (!input) return "";
  return String(input)
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/** Get client IP from Cloudflare headers. */
function getClientIP(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Check rate limit in KV (read-only). Returns true if under limit. */
async function checkRateLimit(
  env: Env,
  key: string,
  limit: number
): Promise<boolean> {
  if (!env.DRMELAXIN_CACHE) return true;

  try {
    const current = await env.DRMELAXIN_CACHE.get(key);
    const count = current ? parseInt(current, 10) : 0;
    return count < limit;
  } catch {
    return true; // KV error — allow
  }
}

/** Increment rate limit counter (called only AFTER successful order). */
async function incrementRateLimit(env: Env, key: string): Promise<void> {
  if (!env.DRMELAXIN_CACHE) return;

  try {
    const current = await env.DRMELAXIN_CACHE.get(key);
    const count = current ? parseInt(current, 10) : 0;
    await env.DRMELAXIN_CACHE.put(key, String(count + 1), {
      expirationTtl: RATE_LIMIT_WINDOW,
    });
  } catch {
    // Silent fail — don't block on KV errors
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const env = context.env;
  const request = context.request;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store", // Never cache POST responses
  };

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sheetUrl = env.APPS_SCRIPT_URL || "";

  if (!sheetUrl) {
    return new Response(
      JSON.stringify({ success: false, error: "Backend not configured" }),
      { headers: corsHeaders, status: 500 }
    );
  }

  // Step 1: Parse + validate request body
  let payload: OrderPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON" }),
      { headers: corsHeaders, status: 400 }
    );
  }

  // Step 2: Sanitize + validate all fields
  const fullName = sanitize(payload.fullName || "").slice(0, 80);
  const phone = sanitize(payload.phone || "");
  const wilayaName = sanitize(payload.wilayaName || "");
  const communeName = sanitize(payload.communeName || "");
  const quantity = parseInt(String(payload.quantity || "0"), 10);
  const total = parseInt(String(payload.total || "0"), 10);
  const notes = sanitize(payload.notes || "").slice(0, 300);
  const idempotencyKey = sanitize(payload.idempotencyKey || "");

  if (fullName.length < 3) {
    return new Response(
      JSON.stringify({ success: false, error: "Name too short" }),
      { headers: corsHeaders, status: 400 }
    );
  }

  if (!PHONE_REGEX.test(phone)) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid phone" }),
      { headers: corsHeaders, status: 400 }
    );
  }

  if (!wilayaName || !communeName) {
    return new Response(
      JSON.stringify({ success: false, error: "Wilaya and commune required" }),
      { headers: corsHeaders, status: 400 }
    );
  }

  if (isNaN(quantity) || quantity < 1 || quantity > 4) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid quantity" }),
      { headers: corsHeaders, status: 400 }
    );
  }

  if (isNaN(total) || total < 3900) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid total" }),
      { headers: corsHeaders, status: 400 }
    );
  }

  // Step 3: Rate limiting (per phone + per IP) — CHECK ONLY, don't increment yet
  // We increment AFTER successful order to avoid blocking retries
  const clientIP = getClientIP(request);
  const phoneKey = `rate:phone:${phone}`;
  const ipKey = `rate:ip:${clientIP}`;

  const [phoneAllowed, ipAllowed] = await Promise.all([
    checkRateLimit(env, phoneKey, RATE_LIMIT_PHONE),
    checkRateLimit(env, ipKey, RATE_LIMIT_IP),
  ]);

  if (!phoneAllowed || !ipAllowed) {
    return new Response(
      JSON.stringify({ success: false, error: "RATE_LIMIT" }),
      { headers: corsHeaders, status: 429 }
    );
  }

  // Step 4: Forward to Apps Script via GET
  // Build GET URL with query params
  const params = new URLSearchParams();
  params.set("action", "order");
  params.set("fullName", fullName);
  params.set("phone", phone);
  params.set("wilayaName", wilayaName);
  params.set("communeName", communeName);
  params.set("quantity", String(quantity));
  params.set("total", String(total));
  params.set("notes", notes);
  params.set("idempotencyKey", idempotencyKey);
  params.set("_t", Date.now().toString());

  // INTERNAL RETRY: Try Apps Script up to 3 times
  // Fast retries: 0ms, 500ms, 1s (total max ~1.5s overhead)
  const MAX_INTERNAL_RETRIES = 3;
  const RETRY_DELAYS = [0, 500, 1000]; // 0ms, 500ms, 1s

  let lastError: string = "Unknown error";

  for (let attempt = 0; attempt < MAX_INTERNAL_RETRIES; attempt++) {
    if (RETRY_DELAYS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(`${sheetUrl}?${params.toString()}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        lastError = `Apps Script HTTP ${response.status}`;
        continue; // retry
      }

      const text = await response.text();

      // Check for HTML response (broken deployment)
      if (!text || !text.trim().startsWith("{")) {
        lastError = "Apps Script returned non-JSON (deployment may be broken)";
        continue; // retry
      }

      const data = JSON.parse(text);

      // If success → return immediately
      if (data.success && data.order) {
        // Invalidate stock cache
        try {
          if (env.DRMELAXIN_CACHE) {
            await env.DRMELAXIN_CACHE.delete("stock:current");
          }
        } catch {}

        // Increment rate limit
        try {
          await Promise.all([
            incrementRateLimit(env, phoneKey),
            incrementRateLimit(env, ipKey),
          ]);
        } catch {}

        return new Response(JSON.stringify(data), {
          headers: corsHeaders,
          status: 200,
        });
      }

      // If validation error (client mistake) → don't retry, return 400
      const errStr = String(data.error || "").toLowerCase();
      const isValidation =
        errStr.includes("invalid name") ||
        errStr.includes("invalid phone") ||
        errStr.includes("invalid quantity") ||
        errStr.includes("invalid total") ||
        errStr.includes("wilaya and commune") ||
        errStr.includes("out of stock");

      if (isValidation) {
        return new Response(JSON.stringify(data), {
          headers: corsHeaders,
          status: 400,
        });
      }

      // Server error (lock timeout, sheet error, etc.) → retry
      lastError = data.error || "Server error";
      // continue to next attempt
    } catch (fetchErr) {
      lastError = `Network error: ${String(fetchErr)}`;
      // continue to next attempt
    }
  }

  // All retries exhausted → return 500 so client queues offline
  return new Response(
    JSON.stringify({
      success: false,
      error: "Backend unavailable after retries: " + lastError,
      type: "SERVER",
    }),
    { headers: corsHeaders, status: 500 }
  );
};

// Handle OPTIONS for preflight
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
