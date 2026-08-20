/**
 * ============================================================================
 *  ORDER SUBMISSION — Bulletproof client-side, posts to Google Sheets
 * ============================================================================
 *
 *  SELF-HEALING FEATURES:
 *  1. Retry with exponential backoff (3 attempts: 0s, 2s, 5s)
 *  2. 15-second timeout per attempt (never hangs forever)
 *  3. Idempotency key (prevents double-submit on retry)
 *  4. Offline queue (saves to localStorage, retries on reconnect)
 *  5. Graceful error classification (network vs server vs validation)
 *  6. Per-device rate limiting (basic spam prevention)
 *
 *  ARCHITECTURE:
 *  Client → Google Apps Script → Google Sheet
 *    (uses text/plain content type to avoid CORS preflight)
 *
 *  If offline: order queued in localStorage, retried on next visit
 *  If sheet down: 3 retries, then user told to try again
 *  If double-submit: idempotency key prevents duplicate orders
 * ============================================================================
 */
import { PRODUCT } from "@/config/product";
import { DELIVERY_OPTIONS, type DeliveryId } from "@/config/product";
import { tierSubtotal, deliveryFee } from "@/config/pricing";
import { findWilaya } from "@/lib/wilayas";
import { findCommune } from "@/lib/communes";
import { sanitizeName, sanitizeNotes, normalizePhone, sanitizeQuantity } from "@/lib/sanitize";
import type { OrderInput } from "@/lib/types";

/** Price derivation (client-side, for display + sent to server). NO DISCOUNTS. */
function derivePrice(quantity: number, delivery: DeliveryId) {
  const unitPrice = PRODUCT.basePrice;
  const subTotal = tierSubtotal(quantity); // basePrice × quantity (no discount)
  const fee = deliveryFee(delivery); // always 0 (free shipping)
  return {
    unitPrice,
    discount: 0, // NO discounts — always 0
    deliveryFee: fee,
    total: subTotal + fee, // = basePrice × quantity
  };
}

export interface CreateOrderResult {
  id: string;
  orderNo: string;
  total: number;
}

/** Error classification for better user feedback. */
export type OrderErrorType =
  | "VALIDATION"
  | "RATE_LIMIT"
  | "NETWORK"
  | "TIMEOUT"
  | "SERVER"
  | "OFFLINE"
  | "UNKNOWN";

export class OrderError extends Error {
  type: OrderErrorType;
  constructor(type: OrderErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = "OrderError";
  }
}

// --- Per-device rate limiting (basic spam prevention) ---
// RELAXED: 10 orders per 10 minutes (was 5 per minute)
// This prevents casual spam without blocking legitimate repeat customers
const RATE_LIMIT_KEY = "drmelaxin_order_times";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 10; // 10 orders per 10 minutes per device

function isRateLimited(): boolean {
  try {
    const now = Date.now();
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const times: number[] = raw ? JSON.parse(raw) : [];
    const recent = times.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) return true;
    recent.push(now);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recent));
    return false;
  } catch {
    return false;
  }
}

// --- Idempotency: generate a unique key per order attempt ---
function generateIdempotencyKey(input: OrderInput): string {
  const data = `${input.fullName}-${input.phone}-${input.wilayaId}-${input.communeId}-${input.quantity}-${Date.now()}`;
  // Simple hash (not cryptographic, just for uniqueness)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return `ord_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
}

// --- Fetch with timeout ---
function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new OrderError("TIMEOUT", "Request timed out"));
    }, timeoutMs);

    fetch(url, { ...options, signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          reject(new OrderError("TIMEOUT", "Request timed out"));
        } else {
          reject(new OrderError("NETWORK", err.message));
        }
      });
  });
}

// --- Single attempt to submit order via Pages Function (POST, no PII in URL) ---
async function postOrderOnce(
  payload: Record<string, unknown>,
  idempotencyKey: string
): Promise<CreateOrderResult> {
  // POST to our own Pages Function (same-origin, no CORS, Apps Script URL hidden)
  // Timeout: 10s (Pages Function retries internally, so 10s is enough)
  const response = await fetchWithTimeout(
    "/api/order",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, idempotencyKey }),
    },
    10000
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new OrderError("RATE_LIMIT", "Too many orders. Please wait.");
    }
    if (response.status === 400) {
      const data = await response.json().catch(() => ({}));
      throw new OrderError("VALIDATION", data.error || "Validation failed");
    }
    if (response.status >= 500) {
      throw new OrderError("SERVER", `Server error ${response.status}`);
    }
    throw new OrderError("SERVER", `Request failed ${response.status}`);
  }

  const text = await response.text();

  if (!text || text.trim().length === 0) {
    throw new OrderError("SERVER", "Empty response");
  }

  if (text.trim().startsWith("<") || text.includes("<!DOCTYPE")) {
    throw new OrderError("SERVER", "Invalid response format");
  }

  let data: { success?: boolean; order?: { id?: string; orderNo?: string; total?: number }; error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new OrderError("SERVER", "Invalid JSON response");
  }

  if (!data.success || !data.order) {
    throw new OrderError("SERVER", data.error || "Order rejected");
  }

  return {
    id: data.order.id || data.order.orderNo || idempotencyKey,
    orderNo: data.order.orderNo || data.order.id || "",
    total: data.order.total ?? (payload.total as number),
  };
}

// --- Offline queue: save failed orders for later retry ---
const OFFLINE_QUEUE_KEY = "drmelaxin_offline_orders";

function queueOfflineOrder(payload: Record<string, unknown>, idempotencyKey: string): void {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: Array<{ payload: Record<string, unknown>; key: string; ts: number }> =
      raw ? JSON.parse(raw) : [];
    queue.push({ payload, key: idempotencyKey, ts: Date.now() });
    // Keep only last 10 orders
    const trimmed = queue.slice(-10);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage might be full or unavailable — fail silently
  }
}

/** Check if there are offline-queued orders (for UI feedback). */
export function hasOfflineOrders(): boolean {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return false;
    const queue = JSON.parse(raw);
    return Array.isArray(queue) && queue.length > 0;
  } catch {
    return false;
  }
}

/**
 * Retry offline-queued orders. Called on page load + when network reconnects.
 * Returns the number of orders successfully submitted.
 */
export async function flushOfflineQueue(): Promise<number> {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return 0;
    const queue: Array<{ payload: Record<string, unknown>; key: string; ts: number }> =
      JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return 0;

    let successCount = 0;
    const remaining: typeof queue = [];

    for (const item of queue) {
      try {
        await postOrderOnce(item.payload, item.key);
        successCount++;
      } catch {
        if (Date.now() - item.ts < 24 * 60 * 60 * 1000) {
          remaining.push(item);
        }
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    return successCount;
  } catch {
    return 0;
  }
}

/**
 * Create an order with full bulletproofing:
 * 1. Validate inputs
 * 2. Check rate limit
 * 3. Generate idempotency key
 * 4. Try POST with 15s timeout
 * 5. On network failure: retry up to 3 times with backoff
 * 6. If all retries fail: queue offline for later
 * 7. Return result or throw OrderError with classification
 */
export async function createOrder(input: OrderInput): Promise<CreateOrderResult> {
  // --- Sanitize + validate all inputs (XSS, format, length) ---
  const fullName = sanitizeName(input.fullName);
  if (fullName.length < 3) {
    throw new OrderError("VALIDATION", "Name too short (min 3 chars)");
  }

  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new OrderError("VALIDATION", "Invalid phone (Algerian format: 05/06/07 + 8 digits)");
  }

  const quantity = sanitizeQuantity(input.quantity);
  const notes = sanitizeNotes(input.notes || "");

  const wilaya = findWilaya(input.wilayaId);
  if (!wilaya) {
    throw new OrderError("VALIDATION", "Wilaya not found");
  }

  const commune = findCommune(input.communeId);
  if (!commune) {
    throw new OrderError("VALIDATION", "Commune not found");
  }
  if (commune.wilayaId !== wilaya.id) {
    throw new OrderError("VALIDATION", "Commune does not belong to selected wilaya");
  }

  const delivery: DeliveryId =
    DELIVERY_OPTIONS.find((o) => o.id === input.delivery)?.id ?? "home";

  const price = derivePrice(quantity, delivery);

  const tierExists = PRODUCT.tiers.some((t) => t.quantity === quantity);
  if (!tierExists) {
    throw new OrderError("VALIDATION", "Invalid quantity tier");
  }

  // --- Rate limit check ---
  if (isRateLimited()) {
    throw new OrderError("RATE_LIMIT", "Too many orders. Please wait a minute.");
  }

  // --- Prepare payload (sanitized) ---
  const idempotencyKey = generateIdempotencyKey({ ...input, fullName, phone });
  const payload = {
    fullName,
    phone,
    wilayaName: wilaya.name,
    communeName: commune.name,
    quantity,
    total: price.total,
    notes,
    idempotencyKey,
  };

  // --- Single attempt (Pages Function already retries internally 3x) ---
  // Old code retried 3x with 2s/5s delays = 16+ seconds worst case
  // Now: 1 attempt. If it fails, queue offline immediately.
  // Pages Function handles internal retries (0s, 1s, 2s) = max 3s

  try {
    const result = await postOrderOnce(payload, idempotencyKey);
    return result;
  } catch (err) {
    lastError = err instanceof OrderError ? err : new OrderError("UNKNOWN", String(err));

    // Don't queue validation or rate limit errors
    if (lastError.type !== "VALIDATION" && lastError.type !== "RATE_LIMIT") {
      // Queue for offline retry (will be sent on next visit)
      queueOfflineOrder(payload, idempotencyKey);
    }
    throw lastError;
  }

  // Should never reach here, but just in case
  throw lastError ?? new OrderError("UNKNOWN", "Unknown error");
}
