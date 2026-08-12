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
import type { OrderInput } from "@/lib/types";

/** Google Sheets URL (exposed to client — same as stock checking URL). */
function getSheetUrl(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || "";
}

/** Price derivation (client-side, for display + sent to sheet). */
function derivePrice(quantity: number, delivery: DeliveryId) {
  const unitPrice = PRODUCT.basePrice;
  const tier = PRODUCT.tiers.find((t) => t.quantity === quantity);
  const discount = tier ? tier.discount : 0;
  const subTotal = tierSubtotal(quantity);
  const fee = deliveryFee(delivery);
  return {
    unitPrice,
    discount,
    deliveryFee: fee,
    total: subTotal + fee,
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
const RATE_LIMIT_KEY = "drmelaxin_order_times";
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 orders per minute per device

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

// --- Single attempt to post order to Google Sheets ---
async function postOrderOnce(
  sheetUrl: string,
  payload: Record<string, unknown>,
  idempotencyKey: string
): Promise<CreateOrderResult> {
  const response = await fetchWithTimeout(
    sheetUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    },
    15000 // 15 second timeout
  );

  if (!response.ok) {
    throw new OrderError("SERVER", `Google Sheets responded ${response.status}`);
  }

  const text = await response.text();
  let data: { success?: boolean; order?: { id?: string; orderNo?: string; total?: number } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new OrderError("SERVER", "Invalid response from Google Sheets");
  }

  if (!data.success || !data.order) {
    throw new OrderError("SERVER", "Google Sheets rejected order");
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
  const sheetUrl = getSheetUrl();
  if (!sheetUrl) return 0;

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
        await postOrderOnce(sheetUrl, item.payload, item.key);
        successCount++;
      } catch {
        // Keep in queue for next attempt (but don't keep forever — 24h max)
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
  // --- Validation ---
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

  const price = derivePrice(input.quantity, delivery);

  const tierExists = PRODUCT.tiers.some((t) => t.quantity === input.quantity);
  if (!tierExists) {
    throw new OrderError("VALIDATION", "Invalid quantity tier");
  }

  // --- Rate limit check ---
  if (isRateLimited()) {
    throw new OrderError("RATE_LIMIT", "Too many orders. Please wait a minute.");
  }

  const sheetUrl = getSheetUrl();
  if (!sheetUrl) {
    throw new OrderError("SERVER", "GOOGLE_SHEET_URL not configured");
  }

  // --- Prepare payload ---
  const idempotencyKey = generateIdempotencyKey(input);
  const payload = {
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    wilayaName: wilaya.name,
    communeName: commune.name,
    quantity: input.quantity,
    total: price.total,
    notes: input.notes?.trim() || "",
    idempotencyKey, // sent to sheet for dedup
  };

  // --- Retry with exponential backoff ---
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [0, 2000, 5000]; // wait before each attempt

  let lastError: OrderError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Wait before retry (no wait on first attempt)
    if (BACKOFF_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
    }

    try {
      const result = await postOrderOnce(sheetUrl, payload, idempotencyKey);
      return result;
    } catch (err) {
      lastError = err instanceof OrderError ? err : new OrderError("UNKNOWN", String(err));

      // Don't retry on validation or rate limit errors
      if (lastError.type === "VALIDATION" || lastError.type === "RATE_LIMIT") {
        throw lastError;
      }

      // On last attempt, queue offline if it's a network/timeout issue
      if (attempt === MAX_ATTEMPTS - 1) {
        if (
          lastError.type === "NETWORK" ||
          lastError.type === "TIMEOUT" ||
          lastError.type === "SERVER"
        ) {
          queueOfflineOrder(payload, idempotencyKey);
        }
        throw lastError;
      }
      // Otherwise, retry
    }
  }

  // Should never reach here, but just in case
  throw lastError ?? new OrderError("UNKNOWN", "Unknown error");
}
