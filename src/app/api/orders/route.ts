/**
 * ============================================================================
 *  POST /api/orders — Order creation endpoint
 *  Hardened: Zod validation, Algerian phone regex, server-side price
 *  re-derivation, IP rate-limiting (5/min), returns orderNo.
 * ============================================================================
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, isRateLimited } from "@/lib/orders";
import { WILAYAS } from "@/lib/wilayas";
import { COMMUNES } from "@/lib/communes";
import { PRODUCT, DELIVERY_OPTIONS, type DeliveryId } from "@/config/product";

const ALGERIAN_PHONE = /^(0)(5|6|7)\d{8}$/;

const OrderSchema = z.object({
  product: z.literal(PRODUCT.slug),
  fullName: z.string().trim().min(3).max(80),
  phone: z.string().trim().regex(ALGERIAN_PHONE, "invalid phone"),
  wilayaId: z.number().int().refine(
    (id) => WILAYAS.some((w) => w.id === id),
    "wilaya not found"
  ),
  communeId: z.number().int().refine(
    (id) => COMMUNES.some((c) => c.id === id),
    "commune not found"
  ),
  delivery: z.enum(
    DELIVERY_OPTIONS.map((o) => o.id) as [DeliveryId, ...DeliveryId[]]
  ),
  quantity: z.number().int().refine(
    (q) => PRODUCT.tiers.some((t) => t.quantity === q),
    "invalid tier"
  ),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

function getIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, code: "VALIDATION", error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = OrderSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        success: false,
        code: "VALIDATION",
        error: first?.message ?? "Validation failed",
      },
      { status: 400 }
    );
  }

  const ip = getIp(req);
  if (await isRateLimited(ip, 1, 5)) {
    return NextResponse.json(
      {
        success: false,
        code: "RATE_LIMIT",
        error: "Too many orders. Please wait a minute.",
      },
      { status: 429 }
    );
  }

  try {
    const result = await createOrder(parsed.data, ip);
    return NextResponse.json({ success: true, order: result });
  } catch (err) {
    console.error("[/api/orders] createOrder failed:", err);
    return NextResponse.json(
      {
        success: false,
        code: "SERVER_ERROR",
        error: "Failed to create order",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    { status: 405 }
  );
}
