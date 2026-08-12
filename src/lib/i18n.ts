/**
 * I18N — bilingual AR + FR labels.
 */

export const DICT = {
  // Form
  "form.title": "أكملي طلبك · Commandez",
  "form.fullName": "الاسم الكامل · Nom complet",
  "form.fullName.placeholder": "الاسم الكامل *",
  "form.phone": "رقم الهاتف · Téléphone",
  "form.phone.placeholder": "0555 12 34 56",
  "form.wilaya": "الولاية · Wilaya",
  "form.wilaya.placeholder": "اختاري الولاية",
  "form.commune": "البلدية · Commune",
  "form.commune.placeholder": "اختاري البلدية",
  "form.commune.disabled": "اختاري الولاية أولاً",
  "form.delivery": "طريقة التوصيل · Livraison",
  "form.quantity": "الكمية · Quantité",
  "form.notes": "ملاحظات · Notes",
  "form.notes.placeholder": "ملاحظات إضافية (اختياري)",
  "form.submit": "اطلبي بكل ثقة يا عزيزتي",
  "form.submit.loading": "جارٍ الإرسال…",
  "form.phone.invalid": "رقم الهاتف غير صحيح (مثال: 0555123456)",

  // Calculation section
  "calc.price": "السعر · Prix",
  "calc.shipping": "التوصيل · Livraison",
  "calc.total": "الإجمالي · Total",
  "calc.free": "مجاني · GRATUIT",

  // Free shipping banner
  "freeship.badge": "🚚 توصيل مجاني للمنزل",
  "freeship.french": "Livraison à domicile GRATUITE",
  "freeship.note": "لكل الولايات · Toutes wilayas",

  // Yalidine
  "yalidine.badge": "Yalidine Express",
  "yalidine.text": "نُوصل عبر Yalidine Express",
  "yalidine.note": "(المدة تقديرية وقد تختلف حسب المنطقة)",

  // Stock
  "stock.low": "⚠️ الكمية المتبقية محدودة — اطلبي قبل النفاد",
  "stock.out": "⛔ نفدت الكمية مؤقتاً — سنعود قريباً",
  "stock.outFrench": "Rupture de stock — de retour bientôt",

  // Toasts
  "toast.success": "تم تأكيد طلبكم بنجاح!",
  "toast.error": "تعذّر إرسال الطلب. حاولي مرة أخرى.",
  "toast.rate.limit": "أرسلتم طلبات كثيرة. انتظري دقيقة.",

  // Success
  "success.title": "تم تأكيد طلبكم بنجاح!",
  "success.subtitle": "شكراً لثقتكم بنا",
  "success.body": "لقد تلقّينا طلبكم وسنتواصل معكم قريباً جداً عبر الهاتف لتأكيد الطلب وتحديد موعد التوصيل.",
  "success.orderNo": "رقم الطلب · N° de commande",
  "success.back": "العودة للصفحة الرئيسية",

  currency: "دج",
  "footer.copyright": "© 2026 Dr.Melaxin — جميع الحقوق محفوظة",
} as const;

export type DictKey = keyof typeof DICT;
export function t(key: DictKey): string {
  return DICT[key] ?? key;
}
