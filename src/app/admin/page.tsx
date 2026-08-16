"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT } from "@/config/product";

// Admin uses /api/sheet proxy (Pages Function) — Apps Script URL hidden
const API_URL = "/api/sheet";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"product" | "stock" | "stats" | "health">("product");
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

  // Load product + stock via Pages Function proxy
  useEffect(() => {
    if (!authed) return;
    fetch(`${API_URL}?action=product`)
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
    if (tab === "stats" && !stats) {
      fetch(`${API_URL}?action=stats`)
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
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateProduct",
        product: { basePrice, oldPrice, brandName, lineName, taglineArabic, descriptionArabic }
      }),
    }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 3000); });
  }

  function handleSaveStock() {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        <div className="flex gap-2 flex-wrap">
          {(["product", "stock", "stats", "health"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 min-w-[80px] py-2 rounded-xl text-sm font-bold transition-all ${tab === t ? "text-white" : "bg-white text-burgundy border border-burgundy/15"}`}
              style={tab === t ? { background: "var(--burgundy)" } : {}}>
              {t === "product" ? "المنتج" : t === "stock" ? "المخزون" : t === "stats" ? "الإحصائيات" : "الحالة"}
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

        {/* Health Tab — diagnose sheet connection + offline orders */}
        {tab === "health" && (
          <HealthTab />
        )}
      </div>
    </div>
  );
}

/**
 * Health Tab — shows sheet connection status + offline-queued orders.
 * Lets admin diagnose why orders might be failing.
 */
function HealthTab() {
  const [sheetStatus, setSheetStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [sheetMessage, setSheetMessage] = useState("");
  const [offlineCount, setOfflineCount] = useState(0);
  const [offlineOrders, setOfflineOrders] = useState<Array<Record<string, unknown>>>([]);

  // Check sheet health via /api/stock (Pages Function)
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch(`/api/stock?_t=${Date.now()}`, { signal: controller.signal })
      .then(r => {
        clearTimeout(timeoutId);
        if (!r.ok) {
          setSheetStatus("fail");
          setSheetMessage(`HTTP ${r.status} — sheet returned error`);
          return;
        }
        return r.text();
      })
      .then(text => {
        if (!text) return;
        if (text.trim().startsWith("{")) {
          try {
            const data = JSON.parse(text);
            if (data.stock !== undefined) {
              setSheetStatus("ok");
              setSheetMessage(`Connected. Stock: ${data.stock}`);
            } else {
              setSheetStatus("fail");
              setSheetMessage("Sheet responded but missing stock field");
            }
          } catch {
            setSheetStatus("fail");
            setSheetMessage("Invalid JSON response from sheet");
          }
        } else {
          setSheetStatus("fail");
          setSheetMessage("Sheet returned HTML (not JSON) — deployment may be broken");
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        setSheetStatus("fail");
        setSheetMessage(err.name === "AbortError" ? "Timeout (10s)" : err.message);
      });
  }, []);

  // Check offline-queued orders
  useEffect(() => {
    try {
      const raw = localStorage.getItem("drmelaxin_offline_orders");
      if (raw) {
        const queue = JSON.parse(raw);
        if (Array.isArray(queue)) {
          setOfflineCount(queue.length);
          setOfflineOrders(queue.map((item: { payload: Record<string, unknown>; ts: number }) => ({
            ...item.payload,
            timestamp: new Date(item.ts).toLocaleString(),
          })));
        }
      }
    } catch {}
  }, []);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-lg border-2 space-y-4" style={{ borderColor: "rgba(139, 21, 56, 0.15)" }}>
      <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-arabic)", color: "var(--burgundy)" }}>الحالة · Santé</h2>

      {/* Sheet connection status */}
      <div className="rounded-xl p-4 border" style={{
        background: sheetStatus === "ok" ? "rgba(16, 185, 129, 0.05)" : sheetStatus === "fail" ? "rgba(239, 68, 68, 0.05)" : "rgba(245, 158, 11, 0.05)",
        borderColor: sheetStatus === "ok" ? "rgba(16, 185, 129, 0.2)" : sheetStatus === "fail" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
      }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{sheetStatus === "ok" ? "✅" : sheetStatus === "fail" ? "❌" : "⏳"}</span>
          <span className="font-bold" style={{ fontFamily: "var(--font-arabic)" }}>
            Google Sheet: {sheetStatus === "ok" ? "متصل" : sheetStatus === "fail" ? "غير متصل" : "جارٍ الفحص..."}
          </span>
        </div>
        <p className="text-xs text-muted-foreground break-all" dir="ltr">{sheetMessage || "Checking..."}</p>
      </div>

      {/* Offline queue */}
      <div className="rounded-xl p-4 border" style={{ background: "rgba(139, 21, 56, 0.03)", borderColor: "rgba(139, 21, 56, 0.1)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold" style={{ fontFamily: "var(--font-arabic)" }}>طلبات في الانتظار</span>
          <span className="text-lg font-bold" style={{ color: offlineCount > 0 ? "#f59e0b" : "#10b981" }}>{offlineCount}</span>
        </div>
        <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-arabic)" }}>
          طلبات فشل إرسالها وتنتظر إعادة المحاولة تلقائياً عند عودة الاتصال.
        </p>
        {offlineOrders.length > 0 && (
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {offlineOrders.map((o, i) => (
              <div key={i} className="text-xs p-2 rounded bg-white/50 border border-burgundy/10">
                <div className="font-bold">{String(o.fullName || "")} — {String(o.phone || "")}</div>
                <div className="text-muted-foreground">{String(o.wilayaName || "")} / {String(o.communeName || "")}</div>
                <div className="text-muted-foreground">Qty: {String(o.quantity)} · Total: {String(o.total)} DA</div>
                <div className="text-[10px] text-muted-foreground/70" dir="ltr">{String(o.timestamp || "")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sheet URL (for verification) */}
      <div className="rounded-xl p-3 bg-gray-50 border border-gray-200">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Sheet URL</p>
        <p className="text-xs text-muted-foreground break-all" dir="ltr">{API_URL} (proxy → Apps Script hidden)</p>
      </div>

      {/* Help */}
      <div className="rounded-xl p-3 bg-amber-50 border border-amber-200">
        <p className="text-xs" style={{ fontFamily: "var(--font-arabic)" }}>
          💡 إذا كانت الحالة "غير متصل":
          <br />1. تأكدي من نشر Apps Script كـ Web app
          <br />2. تأكدي من ضبط Access على "Anyone"
          <br />3. أعدي النشر بالكود الجديد من download/google-apps-script.gs
        </p>
      </div>
    </div>
  );
}
