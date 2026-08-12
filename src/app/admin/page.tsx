"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT } from "@/config/product";

const SHEET_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || "";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"product" | "stock" | "stats">("product");
  const [saved, setSaved] = useState(false);

  // Product fields
  const [basePrice, setBasePrice] = useState(PRODUCT.basePrice);
  const [oldPrice, setOldPrice] = useState(PRODUCT.oldPrice);
  const [brandName, setBrandName] = useState(PRODUCT.brandName);
  const [lineName, setLineName] = useState(PRODUCT.lineName);
  const [taglineArabic, setTaglineArabic] = useState(PRODUCT.taglineArabic);
  const [descriptionArabic, setDescriptionArabic] = useState(PRODUCT.descriptionArabic);

  // Stock
  const [stock, setStock] = useState<number>(100);
  const [stockSaved, setStockSaved] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Load product + stock from sheet on auth
  useEffect(() => {
    if (!authed || !SHEET_URL) return;
    fetch(`${SHEET_URL}?action=product`)
      .then(r => r.text())
      .then(text => {
        if (!text.trim().startsWith("{")) return;
        const data = JSON.parse(text);
        if (data.basePrice) setBasePrice(Number(data.basePrice));
        if (data.oldPrice) setOldPrice(Number(data.oldPrice));
        if (data.brandName) setBrandName(data.brandName);
        if (data.lineName) setLineName(data.lineName);
        if (data.taglineArabic) setTaglineArabic(data.taglineArabic);
        if (data.descriptionArabic) setDescriptionArabic(data.descriptionArabic);
        if (data.stock !== undefined) setStock(Number(data.stock));
      })
      .catch(() => {});
  }, [authed]);

  // Load stats when tab switched
  useEffect(() => {
    if (tab === "stats" && SHEET_URL && !stats) {
      fetch(`${SHEET_URL}?action=stats`)
        .then(r => r.text())
        .then(text => {
          if (text.trim().startsWith("{")) {
            setStats(JSON.parse(text));
          }
        })
        .catch(() => {});
    }
  }, [tab, stats]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === "007") { setAuthed(true); setError(""); }
    else setError("كلمة المرور غير صحيحة");
  }

  function handleSaveProduct() {
    if (!SHEET_URL) { setSaved(true); setTimeout(() => setSaved(false), 3000); return; }
    fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateProduct",
        product: { basePrice, oldPrice, brandName, lineName, taglineArabic, descriptionArabic }
      }),
    }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 3000); });
  }

  function handleSaveStock() {
    if (!SHEET_URL) { setStockSaved(true); setTimeout(() => setStockSaved(false), 3000); return; }
    fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({ action: "updateStock", stock }),
    }).then(() => { setStockSaved(true); setTimeout(() => setStockSaved(false), 3000); });
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-sm w-full space-y-4 bg-white rounded-3xl p-8 shadow-lg border-2" style={{ borderColor: "rgba(139, 21, 56, 0.15)" }}>
          <h1 className="text-center text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--burgundy)" }}>Admin Panel</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1">
              <Label style={{ fontFamily: "var(--font-arabic)" }}>كلمة المرور · Mot de passe</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="•••" dir="ltr" className="bg-white border-burgundy/15 focus-visible:ring-burgundy/25 h-11" />
            </div>
            {error && <p className="text-sm text-destructive text-center" style={{ fontFamily: "var(--font-arabic)" }}>{error}</p>}
            <Button type="submit" className="w-full h-11 rounded-2xl" style={{ background: "var(--burgundy)", color: "var(--pearl)" }}>دخول · Entrer</Button>
          </form>
          <a href="/" className="block text-center text-sm text-muted-foreground hover:text-burgundy" style={{ fontFamily: "var(--font-arabic)" }}>← العودة للموقع</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--burgundy)" }}>Admin Panel</h1>
          <a href="/" className="text-sm text-muted-foreground hover:text-burgundy" style={{ fontFamily: "var(--font-arabic)" }}>← الموقع</a>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["product", "stock", "stats"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === t ? "text-white" : "bg-white text-burgundy border border-burgundy/15"}`}
              style={tab === t ? { background: "var(--burgundy)" } : {}}>
              {t === "product" ? "المنتج" : t === "stock" ? "المخزون" : "الإحصائيات"}
            </button>
          ))}
        </div>

        {/* Product Tab */}
        {tab === "product" && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border-2 space-y-4" style={{ borderColor: "rgba(139, 21, 56, 0.15)" }}>
            <div className="space-y-1">
              <Label style={{ fontFamily: "var(--font-arabic)" }}>اسم العلامة · Marque</Label>
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="bg-white border-burgundy/15" />
            </div>
            <div className="space-y-1">
              <Label style={{ fontFamily: "var(--font-arabic)" }}>اسم المنتج · Produit</Label>
              <Input value={lineName} onChange={(e) => setLineName(e.target.value)} className="bg-white border-burgundy/15" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label style={{ fontFamily: "var(--font-arabic)" }}>السعر القديم · Ancien</Label>
                <Input type="number" value={oldPrice} onChange={(e) => setOldPrice(Number(e.target.value))} className="bg-white border-burgundy/15" />
              </div>
              <div className="space-y-1">
                <Label style={{ fontFamily: "var(--font-arabic)" }}>السعر · Prix</Label>
                <Input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className="bg-white border-burgundy/15" />
              </div>
            </div>
            <div className="space-y-1">
              <Label style={{ fontFamily: "var(--font-arabic)" }}>العنوان · Slogan</Label>
              <Textarea value={taglineArabic} onChange={(e) => setTaglineArabic(e.target.value)} rows={2} className="bg-white border-burgundy/15" dir="rtl" />
            </div>
            <div className="space-y-1">
              <Label style={{ fontFamily: "var(--font-arabic)" }}>الوصف · Description</Label>
              <Textarea value={descriptionArabic} onChange={(e) => setDescriptionArabic(e.target.value)} rows={4} className="bg-white border-burgundy/15" dir="rtl" />
            </div>
            <Button onClick={handleSaveProduct} className="w-full h-11 rounded-2xl" style={{ background: "var(--burgundy)", color: "var(--pearl)" }}>حفظ · Enregistrer</Button>
            {saved && <p className="text-center text-sm text-emerald-600" style={{ fontFamily: "var(--font-arabic)" }}>✓ تم الحفظ في Google Sheet</p>}
            <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-arabic)" }}>
              💡 لتبديل الصور، ضعي ملفات في public/gallery/ بنفس الأسماء وأعدي النشر.
            </p>
          </div>
        )}

        {/* Stock Tab */}
        {tab === "stock" && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border-2 space-y-4" style={{ borderColor: "rgba(139, 21, 56, 0.15)" }}>
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-arabic)", color: "var(--burgundy)" }}>المخزون · Stock</h2>
            <div className="space-y-1">
              <Label style={{ fontFamily: "var(--font-arabic)" }}>عدد القطع المتوفرة · Quantité en stock</Label>
              <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} className="bg-white border-burgundy/15 text-lg font-bold" style={{ fontSize: "1.5rem" }} />
            </div>
            <Button onClick={handleSaveStock} className="w-full h-11 rounded-2xl" style={{ background: "var(--burgundy)", color: "var(--pearl)" }}>حفظ المخزون · Enregistrer</Button>
            {stockSaved && <p className="text-center text-sm text-emerald-600" style={{ fontFamily: "var(--font-arabic)" }}>✓ تم تحديث المخزون</p>}
            <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
              <p className="text-sm" style={{ fontFamily: "var(--font-arabic)" }}>
                💡 المخزون يقل تلقائياً عند تأكيد طلب في Google Sheet (Status = confirmed).
                عند وصول المخزون لـ 3 أو أقل، يظهر تنبيه في الموقع. عند 0، يتعطل الطلب.
              </p>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {tab === "stats" && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border-2 space-y-3" style={{ borderColor: "rgba(139, 21, 56, 0.15)" }}>
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-arabic)", color: "var(--burgundy)" }}>الإحصائيات · Statistiques</h2>
            {stats ? (
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-burgundy/10">
                  <span style={{ fontFamily: "var(--font-arabic)" }}>إجمالي الطلبات</span>
                  <span className="font-bold">{stats.totalOrders}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-burgundy/10">
                  <span style={{ fontFamily: "var(--font-arabic)" }}>إجمالي الإيرادات (دج)</span>
                  <span className="font-bold">{stats.totalRevenue?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-burgundy/10">
                  <span style={{ fontFamily: "var(--font-arabic)" }}>متوسط قيمة الطلب</span>
                  <span className="font-bold">{stats.averageOrderValue?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-burgundy/10">
                  <span style={{ fontFamily: "var(--font-arabic)" }}>المخزون الحالي</span>
                  <span className="font-bold" style={{ color: stats.lowStock ? "#f59e0b" : "#10b981" }}>{stats.stock}</span>
                </div>
                {stats.topWilayas && stats.topWilayas.length > 0 && (
                  <div className="pt-2">
                    <p className="font-bold mb-2" style={{ fontFamily: "var(--font-arabic)" }}>أعلى الولايات:</p>
                    {stats.topWilayas.slice(0, 5).map((w: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span>{w.wilaya}</span>
                        <span className="font-bold">{w.count} طلب</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={() => { setStats(null); }} variant="ghost" className="w-full text-burgundy" style={{ fontFamily: "var(--font-arabic)" }}>تحديث · Actualiser</Button>
              </div>
            ) : (
              <p className="text-center text-muted-foreground" style={{ fontFamily: "var(--font-arabic)" }}>جارٍ التحميل...</p>
            )}
            <p className="text-xs text-muted-foreground text-center" style={{ fontFamily: "var(--font-arabic)" }}>
              💡 افتح Google Sheet لمزيد من التفاصيل والرسوم البيانية.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
