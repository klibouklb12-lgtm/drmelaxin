"use client";

import Image from "next/image";
import { formatDZD } from "@/config/pricing";
import { t } from "@/lib/i18n";
import { cdn } from "@/lib/cdn";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const SPARKLES = [
  { emoji: "✨", className: "top-8 left-8 text-3xl opacity-25",  delay: "0.3s", dur: "3s"   },
  { emoji: "🌟", className: "top-20 right-12 text-2xl opacity-20", delay: "0.8s", dur: "3.5s" },
  { emoji: "💫", className: "bottom-16 left-16 text-2xl opacity-20", delay: "1.2s", dur: "4s" },
  { emoji: "✨", className: "bottom-28 right-8 text-3xl opacity-25",  delay: "0.5s", dur: "3.2s" },
  { emoji: "🌸", className: "top-40 left-16 text-xl opacity-15",  delay: "1.5s", dur: "4.5s" },
  { emoji: "💖", className: "bottom-40 right-16 text-xl opacity-15", delay: "2s", dur: "3.8s" },
] as const;

export function SuccessCard({
  order,
  onBack,
}: {
  order: { id: string; orderNo: string; total: number };
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-white to-cream p-4 relative overflow-hidden">
      {/* Floating sparkles + hearts */}
      {SPARKLES.map((s, i) => (
        <div
          key={i}
          className={`absolute ${s.className} animate-bounce`}
          style={{ animationDelay: s.delay, animationDuration: s.dur }}
          aria-hidden
        >
          {s.emoji}
        </div>
      ))}

      <div
        className="success-animate max-w-md w-full text-center space-y-4 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border-2 relative"
        style={{
          borderColor: "rgba(139, 21, 56, 0.08)",
          boxShadow: "0 24px 70px -12px rgba(139, 21, 56, 0.15), 0 0 0 1px rgba(255,255,255,0.9)",
        }}
      >
        {/* ParaPharma logo — present, elegant */}
        <div className="flex justify-center">
          <div
            className="logo-frame rounded-2xl p-2 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(247,245,242,0.5) 100%)",
              border: "1px solid rgba(16, 185, 129, 0.1)",
            }}
          >
            <Image
              src={cdn("/logo.webp")}
              alt="Dr.Melaxin — ParaPharma"
              width={120}
              height={107}
              quality={90}
              sizes="120px"
              className="object-contain image-blur-up"
              style={{ width: "auto", height: "75px" }}
            />
          </div>
        </div>

        {/* Animated check icon — bigger, more premium */}
        <div className="relative mx-auto w-24 h-24">
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{ background: "radial-gradient(circle, rgba(139,21,56,0.1) 0%, transparent 70%)" }}
          />
          <div
            className="absolute inset-2 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(240,216,154,0.4) 0%, rgba(255,255,255,0.8) 100%)",
              border: "1px solid rgba(212,175,55,0.2)",
            }}
          >
            <svg
              className="w-10 h-10 text-burgundy checkmark-animate"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Main thank you message — sincere, comforting, elegant */}
        <div className="space-y-2">
          <h2
            className="text-2xl font-bold leading-relaxed"
            style={{ fontFamily: "var(--font-arabic)", color: "var(--burgundy)" }}
          >
            تم تأكيد طلبكم بنجاح!
          </h2>
          <p
            className="text-base font-medium"
            style={{ fontFamily: "var(--font-arabic)", color: "var(--burgundy-light)" }}
          >
            شكراً لثقتكِ بنا 💝
          </p>
        </div>

        {/* Sincere comforting message body */}
        <div
          className="rounded-2xl p-4 space-y-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(240,216,154,0.1) 100%)",
            borderColor: "rgba(139, 21, 56, 0.06)",
          }}
        >
          <p
            className="text-sm leading-loose"
            style={{ fontFamily: "var(--font-arabic)", color: "var(--foreground)", opacity: 0.85, lineHeight: 2 }}
          >
            لقد تلقّينا طلبكِ، وسنتواصل معكِ قريباً جداً عبر الهاتف لتأكيد التفاصيل وتحديد موعد التوصيل.
          </p>
          <p
            className="text-sm leading-loose"
            style={{ fontFamily: "var(--font-arabic)", color: "var(--foreground)", opacity: 0.75, lineHeight: 2 }}
          >
            نقدّر ثقتكِ الغالية، ونعدكِ بأن تصلكِ تجربة العناية الفاخرة التي تستحقّها — لأن جمالكِ يستحق الأفضل دائماً. 🌸
          </p>

          <Separator className="my-2" style={{ background: "rgba(139, 21, 56, 0.08)" }} />

          {/* Order details */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <span
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{ fontFamily: "var(--font-display)", color: "var(--muted-foreground)" }}
            >
              رقم طلبكِ · N° de commande
            </span>
            <span
              className="text-xl font-bold tracking-wider"
              dir="ltr"
              style={{ fontFamily: "var(--font-display)", color: "var(--burgundy)" }}
            >
              {order.orderNo}
            </span>
            <span
              className="text-sm font-medium"
              style={{ fontFamily: "var(--font-sans)", color: "var(--foreground)" }}
            >
              {formatDZD(order.total)} {t("currency")} · {t("calc.free")}
            </span>
          </div>
        </div>

        {/* ParaPharma logo as sign-off */}
        <div className="flex justify-center pt-1">
          <Image
            src={cdn("/logo.jpg")}
            alt="ParaPharma"
            width={100}
            height={89}
            quality={90}
            sizes="100px"
            className="object-contain"
            style={{ width: "auto", height: "55px" }}
          />
        </div>

        <Button
          variant="ghost"
          onClick={onBack}
          className="text-burgundy hover:text-burgundy-dark hover:bg-champagne/20"
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          {t("success.back")}
        </Button>
      </div>
    </div>
  );
}
