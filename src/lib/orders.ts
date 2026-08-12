/**
 * ============================================================================
 *  ORDER PERSISTENCE — Google Sheets backend (works on Netlify/Vercel/anywhere)
 * ============================================================================
 *
 *  WHY GOOGLE SHEETS?
 *  - Free, unlimited (no 100GB bandwidth limit, no function invocation limit)
 *  - Already set up (NEXT_PUBLIC_GOOGLE_SHEET_URL in .env)
 *  - Works on Netlify's serverless functions (no filesystem needed)
 *  - You can view/edit orders directly in the Sheet
 *  - Stock auto-reduces when you mark an order "Confirmed" in the Sheet
 *
 *  ARCHITECTURE:
 *  Client → POST /api/orders → Google Apps Script → Google Sheet
 *                              (server-side fetch, CORS-safe)
 *
 *  The /api/orders route is a thin proxy that:
 *  1. Validates input (Zod)
 *  2. Re-derives price server-side (never trusts client)
 *  3. Forwards to Google Sheets
 *  4. Returns the order number
 *
 *  Rate limiting: simple IP-based, in-memory (per serverless instance).
 *  For production-scale, upgrade to Upstash Redis (free 10k/day).
 * ============================================================================
 */
import { PRODUCT } from "@/config/product";
import { DELIVERY_OPTIONS, type DeliveryId } from "@/config/product";
import { tierSubtotal, deliveryFee } from "@/config/pricing";
import { findWilaya } from "@/lib/wilayas";
import { findCommune } from "@/lib/communes";
import type { OrderInput } from "@/lib/types";

/**
 * Server-side Google Sheets URL (NOT exposed to client).
 * Falls back to the public URL if server var not set.
 */
function getSheetUrl(): string {
  return (
    process.env.GOOGLE_SHEET_URL || // server-only (preferred)
    process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || // public (fallback)
    ""
  );
}

/**
 * Server-authoritative price derivation.
 * NEVER trust the client's quantity/discount/total — always re-derive
 * from the validated quantity and delivery id.
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
 * Create an order by posting to Google Sheets (via Apps Script).
 * The Apps Script handles order number generation and appends a row.
 */
export async function createOrder(
  input: OrderInput,
  _ip: string | null
): Promise<CreateOrderResult> {
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

  const sheetUrl = getSheetUrl();
  if (!sheetUrl) {
    throw new Error("GOOGLE_SHEET_URL not configured");
  }

  // Post to Google Apps Script (it handles order number generation + row append)
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
    // Apps Script doesn't need redirects followed manually — fetch handles it
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
    throw new Error(data.order ? "Unknown error" : "Google Sheets rejected order");
  }

  return {
    id: data.order.id || data.order.orderNo || "",
    orderNo: data.order.orderNo || data.order.id || "",
    total: data.order.total ?? price.total,
  };
}

/**
 * Simple in-memory rate limiter (per serverless instance).
 * For production scale, upgrade to Upstash Redis (free 10k commands/day).
 *
 * On Netlify, each function instance has its own memory, so this provides
 * approximate (not exact) rate limiting — sufficient for basic abuse prevention.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function isRateLimited(
  ip: string | null,
  windowMinutes = 1,
  maxOrders = 5
): Promise<boolean> {
  if (!ip) return false;
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > maxOrders;
}
