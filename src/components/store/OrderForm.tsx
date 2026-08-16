"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PRODUCT, DELIVERY_OPTIONS } from "@/config/product";
import { tierSubtotal, formatDZD } from "@/config/pricing";
import { WILAYAS } from "@/lib/wilayas";
import { communesForWilaya } from "@/lib/communes";
import { createOrder, OrderError } from "@/lib/orders";
import { normalizePhone } from "@/lib/sanitize";
import { t } from "@/lib/i18n";
import type { DeliveryId } from "@/config/product";
import { useReveal } from "@/hooks/use-reveal";
import { useOnlineStatus } from "@/hooks/use-online-status";

// Client-side validation: raw phone input → normalized → validated
const ALGERIAN_PHONE = /^(0)(5|6|7)\d{8}$/;

const AUTOSAVE_KEY = "drmelaxin_form_draft";

export function OrderForm({
  onSubmitted,
  disabled = false,
}: {
  onSubmitted: (order: { id: string; orderNo: string; total: number }) => void;
  disabled?: boolean;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaId, setWilayaId] = useState<number | null>(null);
  const [communeId, setCommuneId] = useState<number | null>(null);
  const [delivery] = useState<DeliveryId>("home");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isOnline = useOnlineStatus();
  const submittedRef = useRef(false); // double-submit prevention

  // Phone validation via normalizePhone (handles +213, spaces, dashes)
  const phoneValid = !!normalizePhone(phone);
  const formValid = !disabled && fullName.trim().length >= 3 && phoneValid && wilayaId !== null && communeId !== null && isOnline;

  const communes = useMemo(() => (wilayaId !== null ? communesForWilaya(wilayaId) : []), [wilayaId]);

  const subtotal = tierSubtotal(quantity);
  const total = subtotal; // shipping is FREE

  const reveal = useReveal<HTMLDivElement>();

  // --- Autosave form draft to localStorage ---
  useEffect(() => {
    const draft = { fullName, phone, wilayaId, communeId, quantity, notes, ts: Date.now() };
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
    } catch {}
  }, [fullName, phone, wilayaId, communeId, quantity, notes]);

  // --- Restore draft on mount (if less than 1 hour old) ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft.ts !== "number") return;
      if (Date.now() - draft.ts > 60 * 60 * 1000) {
        localStorage.removeItem(AUTOSAVE_KEY);
        return;
      }
      if (typeof draft.fullName === "string") setFullName(draft.fullName);
      if (typeof draft.phone === "string") setPhone(draft.phone);
      if (typeof draft.wilayaId === "number") setWilayaId(draft.wilayaId);
      if (typeof draft.communeId === "number") setCommuneId(draft.communeId);
      if (typeof draft.quantity === "number" && draft.quantity >= 1 && draft.quantity <= 4) setQuantity(draft.quantity);
      if (typeof draft.notes === "string") setNotes(draft.notes);
    } catch {}
  }, []);

  function handleWilayaChange(id: number) { setWilayaId(id); setCommuneId(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Triple-check: prevent double-submit
    if (!formValid || submitting || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const order = await createOrder({
        product: PRODUCT.slug,
        fullName,
        phone,
        wilayaId: wilayaId!,
        communeId: communeId!,
        delivery,
        quantity,
        notes,
      });
      toast.success(t("toast.success"));
      // Clear autosaved draft on success
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
      onSubmitted(order);
    } catch (err) {
      // Reset submit flag so user can retry
      submittedRef.current = false;
      if (err instanceof OrderError) {
        if (err.type === "RATE_LIMIT") {
          toast.error(t("toast.rate.limit"));
        } else if (err.type === "NETWORK" || err.type === "TIMEOUT") {
          toast.error("تعذّر الاتصال. سيتم إرسال طلبك تلقائياً عند عودة الاتصال.", { duration: 6000 });
        } else if (err.type === "VALIDATION") {
          toast.error("تحققي من البيانات المدخلة");
        } else {
          toast.error(t("toast.error"));
        }
      } else {
        toast.error(t("toast.error"));
      }
    }
    finally { setSubmitting(false); }
  }

  return (
    <section id="order" className="px-4 py-8 bg-white/40">
      <div ref={reveal.ref} className={`reveal max-w-sm mx-auto ${reveal.visible ? "is-visible" : ""}`}>
        <h2 className="text-center mb-4 rounded-2xl py-3 px-4 gloss-sheen"
          style={{ fontFamily: "var(--font-arabic)", fontWeight: 700, fontSize: "clamp(1.35rem, 5.5vw, 1.65rem)", color: "var(--burgundy)",
            background: "linear-gradient(135deg, #ffffff 0%, var(--white-soft) 50%, var(--white-shadow) 100%)",
            border: "1px solid rgba(139, 21, 56, 0.12)", boxShadow: "0 4px 16px -6px rgba(139, 21, 56, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.95)" }}>
          {t("form.title")}
        </h2>

        {/* Yalidine Express badge — simple */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 border border-burgundy/10 shadow-sm">
            <span className="text-sm font-bold" style={{ fontFamily: "var(--font-sans)", color: "var(--burgundy)" }}>
              🚚 {t("yalidine.badge")}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={`space-y-4 bg-white rounded-3xl p-5 shadow-lg border-2 gloss-sheen ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          style={{ borderColor: "rgba(139, 21, 56, 0.15)", boxShadow: "0 12px 32px -8px rgba(139, 21, 56, 0.12), 0 0 0 1px rgba(255, 255, 255, 1), inset 0 1px 0 rgba(255, 255, 255, 0.95)" }}>

          {/* 1. Full name */}
          <div className="space-y-1">
            <Label htmlFor="fullName" className="text-xs font-semibold" style={{ fontFamily: "var(--font-arabic)", color: "var(--foreground)" }}>{t("form.fullName")} *</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("form.fullName.placeholder")} maxLength={80} autoComplete="name" dir="rtl"
              className="bg-white border-burgundy/15 focus-visible:ring-burgundy/25 h-11" />
          </div>

          {/* 2. Phone */}
          <div className="space-y-1">
            <Label htmlFor="phone" className="text-xs font-semibold" style={{ fontFamily: "var(--font-arabic)", color: "var(--foreground)" }}>{t("form.phone")} *</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("form.phone.placeholder")} inputMode="tel" autoComplete="tel" dir="ltr"
              className={`text-right bg-white border-burgundy/15 focus-visible:ring-burgundy/25 h-11 ${phone && !phoneValid ? "border-destructive" : ""}`} />
            {phone && !phoneValid && <p className="text-[10px] text-destructive" style={{ fontFamily: "var(--font-arabic)" }}>{t("form.phone.invalid")}</p>}
          </div>

          {/* 3. Wilaya */}
          <div className="space-y-1">
            <Label htmlFor="wilaya" className="text-xs font-semibold" style={{ fontFamily: "var(--font-arabic)", color: "var(--foreground)" }}>{t("form.wilaya")} *</Label>
            <Select value={wilayaId ? String(wilayaId) : ""} onValueChange={(v) => handleWilayaChange(Number(v))}>
              <SelectTrigger id="wilaya" suppressHydrationWarning className="w-full bg-white border-burgundy/15 focus-visible:ring-burgundy/25 h-11">
                <SelectValue placeholder={t("form.wilaya.placeholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-72"><SelectGroup>
                {WILAYAS.map((w) => (<SelectItem key={w.id} value={String(w.id)}>
                  <span className="text-muted-foreground text-[10px] ml-1.5">{w.code} -</span>
                  <span className="ml-1">{w.name}</span>
                  <span className="text-muted-foreground text-xs mr-2">({w.arName})</span>
                </SelectItem>))}
              </SelectGroup></SelectContent>
            </Select>
          </div>

          {/* 4. Commune */}
          <div className="space-y-1">
            <Label htmlFor="commune" className="text-xs font-semibold" style={{ fontFamily: "var(--font-arabic)", color: "var(--foreground)" }}>{t("form.commune")} *</Label>
            <Select value={communeId ? String(communeId) : ""} onValueChange={(v) => setCommuneId(Number(v))} disabled={wilayaId === null}>
              <SelectTrigger id="commune" suppressHydrationWarning className="w-full bg-white border-burgundy/15 focus-visible:ring-burgundy/25 h-11 disabled:opacity-60">
                <SelectValue placeholder={wilayaId === null ? t("form.commune.disabled") : t("form.commune.placeholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-72"><SelectGroup>
                {communes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>
                  <span className="ml-1">{c.arName}</span>
                  <span className="text-muted-foreground text-xs mr-2 italic">({c.name})</span>
                </SelectItem>))}
              </SelectGroup></SelectContent>
            </Select>
          </div>

          {/* 5. Quantity */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold" style={{ fontFamily: "var(--font-arabic)", color: "var(--foreground)" }}>{t("form.quantity")}</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRODUCT.tiers.map((tier) => {
                const isSelected = quantity === tier.quantity;
                return (
                  <button key={tier.quantity} type="button" onClick={() => setQuantity(tier.quantity)} aria-pressed={isSelected}
                    className={`btn-elegant rounded-xl py-2.5 text-base font-bold border-2 transition-all bg-white ${isSelected ? "border-burgundy selected-glow" : "border-burgundy/15 hover:border-burgundy/40"}`}
                    style={{ color: isSelected ? "var(--burgundy)" : "var(--foreground)" }}>{tier.quantity}</button>
                );
              })}
            </div>
          </div>

          {/* 6. Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs font-semibold" style={{ fontFamily: "var(--font-arabic)", color: "var(--foreground)" }}>{t("form.notes")}</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("form.notes.placeholder")} rows={2} maxLength={500} dir="rtl"
              className="bg-white border-burgundy/15 focus-visible:ring-burgundy/25" />
          </div>

          <Separator className="bg-burgundy/10" />

          {/* CALCULATION SECTION — elegant, with FREE shipping glowing */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(247,245,242,0.5) 100%)", border: "1px solid rgba(139, 21, 56, 0.08)" }}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground" style={{ fontFamily: "var(--font-arabic)" }}>{t("calc.price")}</span>
              <span className="font-medium" style={{ fontFamily: "var(--font-sans)" }}>{formatDZD(subtotal)} {t("currency")}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground" style={{ fontFamily: "var(--font-arabic)" }}>{t("calc.shipping")}</span>
              <span className="free-text-glow font-bold" style={{ fontFamily: "var(--font-sans)", color: "var(--gold-dark)" }}>
                {t("calc.free")}
              </span>
            </div>
            <Separator className="bg-burgundy/10 my-1" />
            <div className="flex items-center justify-between text-lg font-bold pt-1">
              <span style={{ fontFamily: "var(--font-arabic)" }}>{t("calc.total")}</span>
              <span style={{ fontFamily: "var(--font-sans)", color: "var(--burgundy)" }}>
                {formatDZD(total)} {t("currency")}
              </span>
            </div>
          </div>

          {/* Offline notice */}
          {!isOnline && (
            <div className="rounded-xl p-3 text-center text-sm" style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#991b1b", fontFamily: "var(--font-arabic)" }}>
              ⚠️ لا يوجد اتصال بالإنترنت — أكملي البيانات وسنرسل الطلب تلقائياً عند عودة الاتصال
            </div>
          )}

          {/* Submit */}
          <Button type="submit" disabled={!formValid || submitting || !isOnline}
            className="btn-elegant w-full h-auto py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: formValid && isOnline ? "linear-gradient(135deg, var(--burgundy) 0%, var(--burgundy-dark) 100%)" : "var(--muted)", color: "var(--pearl)", border: formValid && isOnline ? "1px solid var(--gold)" : "1px solid transparent" }}>
            <span style={{ fontFamily: "var(--font-arabic)", fontSize: "1.1rem" }}>{submitting ? t("form.submit.loading") : isOnline ? t("form.submit") : "في انتظار الاتصال…"}</span>
          </Button>
        </form>
      </div>
    </section>
  );
}
