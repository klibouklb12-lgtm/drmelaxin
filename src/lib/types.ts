/**
 * Shared types. Locale fixed to "ar" (integrated voice).
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

export interface OrderRecord extends OrderInput {
  id: string;
  orderNo: string;
  wilayaName: string;
  communeName: string;
  unitPrice: number;
  discount: number;
  deliveryFee: number;
  total: number;
  status: "new" | "called" | "confirmed" | "shipped" | "delivered" | "cancelled";
  locale: "ar";
  createdAt: string;
}

export interface ApiResponse {
  success: boolean;
  order?: Pick<OrderRecord, "id" | "orderNo" | "total">;
  error?: string;
  code?: "VALIDATION" | "RATE_LIMIT" | "SERVER_ERROR";
}
