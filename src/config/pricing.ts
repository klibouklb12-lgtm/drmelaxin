/**
 * PRICING — server-authoritative. Shipping is FREE.
 */
import { PRODUCT } from "@/config/product";
import type { DeliveryId } from "@/config/product";

export function tierSubtotal(quantity: number): number {
  const tier = PRODUCT.tiers.find((t) => t.quantity === quantity)
    ?? PRODUCT.tiers[PRODUCT.tiers.length - 1];
  return Math.round(PRODUCT.basePrice * tier.quantity * (1 - tier.discount));
}

/** Delivery fee — always 0 (FREE HOME SHIPPING). */
export function deliveryFee(_delivery: DeliveryId): number {
  return 0;
}

/** Grand total (subtotal + free shipping). */
export function grandTotal(quantity: number, _delivery: DeliveryId): number {
  return tierSubtotal(quantity);
}

/** Format DZD with dot as thousands separator. */
export function formatDZD(amount: number): string {
  return amount.toLocaleString("fr-DZ").replace(/[\u202f\s]/g, ".");
}
