/**
 * PRICING — Flat price, NO discounts. Shipping is FREE.
 *
 * Calculation:
 *   Total = basePrice × quantity
 *   No tier discounts, no markdowns, no hidden fees.
 *
 * Example:
 *   qty 1 → 3900
 *   qty 2 → 7800
 *   qty 3 → 11700
 *   qty 4 → 15600
 */
import { PRODUCT } from "@/config/product";
import type { DeliveryId } from "@/config/product";

/**
 * Calculate subtotal = basePrice × quantity.
 * No discounts applied. Quantity must be 1-4.
 */
export function tierSubtotal(quantity: number): number {
  // Validate quantity is in allowed range (1-4)
  const validQty = PRODUCT.tiers.some((t) => t.quantity === quantity)
    ? quantity
    : 1;
  return PRODUCT.basePrice * validQty;
}

/** Delivery fee — always 0 (FREE HOME SHIPPING). */
export function deliveryFee(_delivery: DeliveryId): number {
  return 0;
}

/** Grand total = subtotal + 0 (free shipping). */
export function grandTotal(quantity: number, _delivery: DeliveryId): number {
  return tierSubtotal(quantity);
}

/** Format DZD with dot as thousands separator (e.g., 3900 → "3.900"). */
export function formatDZD(amount: number): string {
  if (typeof amount !== "number" || isNaN(amount)) return "0";
  return amount.toLocaleString("fr-DZ").replace(/[\u202f\s]/g, ".");
}
