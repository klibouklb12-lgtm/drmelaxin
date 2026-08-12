/**
 * Shared types. Locale fixed to "ar" (integrated voice).
 * Static export — no server types needed.
 */
import type { DeliveryId } from "@/config/product";

export interface OrderInput {
  product: string;
  fullName: string;
  phone: string;
  wilayaId: number;
  communeId: number;
  delivery: DeliveryId;
  quantity: number;
  notes?: string;
}
