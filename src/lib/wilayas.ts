/**
 * Wilayas dataset — migrated from /upload/wilayas.json
 * 69 wilayas (58 original + 10 post-2019 districts + Aflou).
 *
 * Display contract:
 *   The store uses Arabic names in the UI (classical Arabic voice).
 *   The Latin `name` is kept for server-side storage + delivery API
 *   integrations (e.g. Yalidine) that require Latin wilaya names.
 *
 * COMMUNES: not included in the source file. The order form uses a
 * free-form Address text field instead. When you provide a communes
 * dataset, drop it in here and OrderForm will pick it up — see the
 * `getCommunes(wilayaId)` stub at the bottom of this file.
 */

export interface Wilaya {
  id: number;
  code: string;
  name: string; // Latin (server / API use)
  arName: string; // Arabic (UI display)
  longitude: number;
  latitude: number;
}

export const WILAYAS: Wilaya[] = [
  { id: 1, code: "1", name: "Adrar", arName: "أدرار", longitude: 27.9766155, latitude: -0.20396 },
  { id: 2, code: "2", name: "Chlef", arName: "الشلف", longitude: 36.1691245, latitude: 1.3539002 },
  { id: 3, code: "3", name: "Laghouat", arName: "الأغواط", longitude: 33.7873735, latitude: 2.8829115 },
  { id: 4, code: "4", name: "Oum El Bouaghi", arName: "أم البواقي", longitude: 35.8726014, latitude: 7.1180248 },
  { id: 5, code: "5", name: "Batna", arName: "باتنة", longitude: 35.32147, latitude: 3.1066502 },
  { id: 6, code: "6", name: "Béjaïa", arName: "بجاية", longitude: 36.7695969, latitude: 5.0085855 },
  { id: 7, code: "7", name: "Biskra", arName: "بسكرة", longitude: 34.8515041, latitude: 5.7246709 },
  { id: 8, code: "8", name: "Bechar", arName: "بشار", longitude: 31.5977602, latitude: -1.8540446 },
  { id: 9, code: "9", name: "Blida", arName: "البليدة", longitude: 36.4803023, latitude: 2.8009379 },
  { id: 10, code: "10", name: "Bouira", arName: "البويرة", longitude: 36.2084234, latitude: 3.925049 },
  { id: 11, code: "11", name: "Tamanrasset", arName: "تمنراست", longitude: 22.2746227, latitude: 5.6754684 },
  { id: 12, code: "12", name: "Tbessa", arName: "تبسة", longitude: 35.4117259, latitude: 8.110545 },
  { id: 13, code: "13", name: "Tlemcen", arName: "تلمسان", longitude: 34.8959541, latitude: -1.3150979 },
  { id: 14, code: "14", name: "Tiaret", arName: "تيارت", longitude: 35.3599899, latitude: 1.3916159 },
  { id: 15, code: "15", name: "Tizi Ouzou", arName: "تيزي وزو", longitude: 36.7002068, latitude: 4.075957 },
  { id: 16, code: "16", name: "Alger", arName: "الجزائر", longitude: 36.7538259, latitude: 3.057841 },
  { id: 17, code: "17", name: "Djelfa", arName: "الجلفة", longitude: 34.6672467, latitude: 3.2993118 },
  { id: 18, code: "18", name: "Jijel", arName: "جيجل", longitude: 36.7962714, latitude: 5.7504845 },
  { id: 19, code: "19", name: "Setif", arName: "سطيف", longitude: 36.1905173, latitude: 5.4202134 },
  { id: 20, code: "20", name: "Saida", arName: "سعيدة", longitude: 34.841945, latitude: 0.1483583 },
  { id: 21, code: "21", name: "Skikda", arName: "سكيكدة", longitude: 36.8777912, latitude: 6.9357204 },
  { id: 22, code: "22", name: "Sidi Bel Abbes", arName: "سيدي بلعباس", longitude: 35.206334, latitude: -0.6301368 },
  { id: 23, code: "23", name: "Annaba", arName: "عنابة", longitude: 36.9184345, latitude: 7.7452755 },
  { id: 24, code: "24", name: "Guelma", arName: "قالمة", longitude: 36.4569088, latitude: 7.4334312 },
  { id: 25, code: "25", name: "Constantine", arName: "قسنطينة", longitude: 36.319475, latitude: 6.7370571 },
  { id: 26, code: "26", name: "Medea", arName: "المدية", longitude: 36.2838408, latitude: 2.7728462 },
  { id: 27, code: "27", name: "Mostaganem", arName: "مستغانم", longitude: 35.9751841, latitude: 0.1149273 },
  { id: 28, code: "28", name: "M'Sila", arName: "المسيلة", longitude: 35.7211476, latitude: 4.5187283 },
  { id: 29, code: "29", name: "Mascara", arName: "معسكر", longitude: 35.382998, latitude: 0.1542592 },
  { id: 30, code: "30", name: "Ouargla", arName: "ورقلة", longitude: 32.1961967, latitude: 4.9634113 },
  { id: 31, code: "31", name: "Oran", arName: "وهران", longitude: 35.7066928, latitude: -0.6405861 },
  { id: 32, code: "32", name: "El Bayadh", arName: "البيض", longitude: 32.5722756, latitude: 0.950011 },
  { id: 33, code: "33", name: "Illizi", arName: "إليزي", longitude: 26.5065999, latitude: 8.480587 },
  { id: 34, code: "34", name: "Bordj Bou Arreridj", arName: "برج بوعريريج", longitude: 36.0686488, latitude: 4.7691823 },
  { id: 35, code: "35", name: "Boumerdes", arName: "بومرداس", longitude: 36.7564181, latitude: 3.4917212 },
  { id: 36, code: "36", name: "El Tarf", arName: "الطارف", longitude: 36.7534258, latitude: 8.2984543 },
  { id: 37, code: "37", name: "Tindouf", arName: "تندوف", longitude: 27.2460501, latitude: -6.3252899 },
  { id: 38, code: "38", name: "Tissemsilt", arName: "تيسمسيلت", longitude: 35.6021906, latitude: 1.802187 },
  { id: 39, code: "39", name: "El Oued", arName: "الوادي", longitude: 33.3714492, latitude: 6.8573436 },
  { id: 40, code: "40", name: "Khenchela", arName: "خنشلة", longitude: 35.4263293, latitude: 7.1414137 },
  { id: 41, code: "41", name: "Souk Ahras", arName: "سوق أهراس", longitude: 36.277849, latitude: 7.9592299 },
  { id: 42, code: "42", name: "Tipaza", arName: "تيبازة", longitude: 36.5980966, latitude: 2.4085379 },
  { id: 43, code: "43", name: "Mila", arName: "ميلة", longitude: 36.4514882, latitude: 6.2487316 },
  { id: 44, code: "44", name: "Ain Defla", arName: "عين الدفلى", longitude: 36.1283915, latitude: 2.1772514 },
  { id: 45, code: "45", name: "Naama", arName: "النعامة", longitude: 33.1995605, latitude: -0.8021968 },
  { id: 46, code: "46", name: "Ain Temouchent", arName: "عين تموشنت", longitude: 35.404044, latitude: -1.0580975 },
  { id: 47, code: "47", name: "Ghardaia", arName: "غرداية", longitude: 32.5891743, latitude: 3.7455655 },
  { id: 48, code: "48", name: "Relizane", arName: "غليزان", longitude: 35.8050195, latitude: 0.867381 },
  { id: 49, code: "49", name: "El M'ghair", arName: "المغير", longitude: 33.947222, latitude: 5.922222 },
  { id: 50, code: "50", name: "El Menia", arName: "المنيعة", longitude: 30.579167, latitude: 2.879167 },
  { id: 51, code: "51", name: "Ouled Djellal", arName: "أولاد جلال", longitude: 34.433333, latitude: 5.066667 },
  { id: 52, code: "52", name: "Bordj Baji Mokhtar", arName: "برج باجي مختار", longitude: 21.327778, latitude: 0.955556 },
  { id: 53, code: "53", name: "Béni Abbès", arName: "بني عباس", longitude: 30.133333, latitude: -2.166667 },
  { id: 54, code: "54", name: "Timimoun", arName: "تيميمون", longitude: 29.258333, latitude: 0.230556 },
  { id: 55, code: "55", name: "Touggourt", arName: "تقرت", longitude: 33.108333, latitude: 6.063889 },
  { id: 56, code: "56", name: "Djanet", arName: "جانت", longitude: 24.554167, latitude: 9.484722 },
  { id: 57, code: "57", name: "In Salah", arName: "عين صالح", longitude: 27.197222, latitude: 2.483333 },
  { id: 58, code: "58", name: "In Guezzam", arName: "عين قزام", longitude: 19.572222, latitude: 5.769444 },
  { id: 59, code: "59", name: "Aflou", arName: "آفلو", longitude: 34.1167, latitude: 2.1 },
  { id: 60, code: "60", name: "Barika", arName: "بريكة", longitude: 35.3833, latitude: 5.3667 },
  { id: 61, code: "61", name: "El Kantara", arName: "القنطرة", longitude: 35.2167, latitude: 5.7 },
  { id: 62, code: "62", name: "Bir El Ater", arName: "بئر العاتر", longitude: 34.75, latitude: 8.05 },
  { id: 63, code: "63", name: "El Aricha", arName: "العريشة", longitude: 34.25, latitude: -1.35 },
  { id: 64, code: "64", name: "Ksar Chellala", arName: "قصر الشلالة", longitude: 35.1667, latitude: 2.3167 },
  { id: 65, code: "65", name: "Ain Oussera", arName: "عين وسارة", longitude: 35.45, latitude: 2.9 },
  { id: 66, code: "66", name: "Messad", arName: "مسعد", longitude: 34.1667, latitude: 3.5 },
  { id: 67, code: "67", name: "Ksar El Boukhari", arName: "قصر البخاري", longitude: 35.8833, latitude: 2.75 },
  { id: 68, code: "68", name: "Bou Saada", arName: "بوسعادة", longitude: 35.2167, latitude: 4.1833 },
  { id: 69, code: "69", name: "El Abiodh Sidi Cheikh", arName: "الأبيض سيدي الشيخ", longitude: 32.9, latitude: 0.5333 },
];

/** Display name for a wilaya in the UI (always Arabic — integrated voice). */
export function wilayaName(w: Wilaya): string {
  return w.arName;
}

/** Find a wilaya by its numeric id. */
export function findWilaya(id: number): Wilaya | undefined {
  return WILAYAS.find((w) => w.id === id);
}

/**
 * COMMUNES STUB — Phase 2 ships without communes (your file has none).
 * When you provide a communes dataset, drop a `communes` table here and
 * OrderForm will start cascading automatically. Until then, the form uses
 * a free-form Address text field.
 */
export function getCommunes(_wilayaId: number): string[] {
  return [];
}
