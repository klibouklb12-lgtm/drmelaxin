/**
 * ============================================================================
 *  ORDER SUBMISSION — Client-side, posts directly to Google Sheets
 * ============================================================================
 *
 *  WHY CLIENT-SIDE?
 *  - Static export (GitHub Pages / Cloudflare Pages) has no server
 *  - Google Apps Script handles order number generation + row append
 *  - No serverless functions = no compute costs = truly free
 *
 *  SECURITY:
 *  - Price is re-derived client-side (for display) but the Apps Script
 *    should also validate/re-derive on receive (see google-apps-script.gs)
 *  - Basic rate limiting via localStorage (per-device, not real rate limiting)
 *  - Zod validation happens in OrderForm before calling this function
 *
 *  ARCHITECTURE:
 *  Client (browser) → Google Apps Script → Google Sheet
 *    (uses text/plain content type to avoid CORS preflight)
 * ============================================================================
 */
import { PRODUCT } from "@/config/product";
import { DELIVERY_OPTIONS, type DeliveryId } from "@/config/product";
import { tierSubtotal, deliveryFee } from "@/config/pricing";
import { findWilaya } from "@/lib/wilayas";
import { findCommune } from "@/lib/communes";
import type { OrderInput } from "@/lib/types";

/**
 * Google Sheets URL (exposed to client — same as stock checking URL).
 * The Apps Script is deployed with "Access: Anyone" so it works from browser.
 */
function getSheetUrl(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || "";
}

/**
 * Price derivation (client-side, for display + sent to sheet).
 * The Apps Script can also re-derive server-side if needed.
 */
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

/**
 * Simple per-device rate limiting (basic abuse prevention).
 * Real rate limiting would need a server, but this stops casual spam.
 */
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

/**
 * Create an order by posting to Google Sheets (via Apps Script).
 * Works client-side — no server needed.
 */
export async function createOrder(input: OrderInput): Promise<CreateOrderResult> {
  const wilaya = findWilaya(input.wilayaId);
  if (!wilaya) {
    throw new Error("Wilaya not found");
  }

  const commune = findCommune(input.communeId);
  if (!commune) {
    throw new Error("Commune not found");
  }
  if (commune.wilayaId !== wilaya.id) {
    throw new Error("Commune does not belong to selected wilaya");
  }

  const delivery: DeliveryId =
    DELIVERY_OPTIONS.find((o) => o.id === input.delivery)?.id ?? "home";

  const price = derivePrice(input.quantity, delivery);

  // Validate quantity is one of the configured tiers
  const tierExists = PRODUCT.tiers.some((t) => t.quantity === input.quantity);
  if (!tierExists) {
    throw new Error("Invalid quantity tier");
  }

  // Per-device rate limit check
  if (isRateLimited()) {
    throw new Error("RATE_LIMIT");
  }

  const sheetUrl = getSheetUrl();
  if (!sheetUrl) {
    throw new Error("GOOGLE_SHEET_URL not configured");
  }

  // Post to Google Apps Script
  // Uses text/plain content type to avoid CORS preflight (Apps Script doesn't support OPTIONS)
  const response = await fetch(sheetUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      wilayaName: wilaya.name,
      communeName: commune.name,
      quantity: input.quantity,
      total: price.total,
      notes: input.notes?.trim() || "",
    }),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Google Sheets responded ${response.status}`);
  }

  const text = await response.text();
  let data: { success?: boolean; order?: { id?: string; orderNo?: string; total?: number } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid response from Google Sheets");
  }

  if (!data.success || !data.order) {
    throw new Error("Google Sheets rejected order");
  }

  return {
    id: data.order.id || data.order.orderNo || "",
    orderNo: data.order.orderNo || data.order.id || "",
    total: data.order.total ?? price.total,
  };
}
