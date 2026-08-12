/**
 * ============================================================================
 *  Shipping Prices — per-wilaya rates (from founder's Yalidine price table)
 * ============================================================================
 *  Source: photo_2026-08-12_12-17-09.jpg (Yalidine Express pricing)
 *
 *  Each wilaya has:
 *    home: home delivery price (DA)
 *    desk: desk/office pickup price (DA)
 *    duration: estimated delivery time (days, as a range string)
 *
 *  Duration is intentionally phrased as an estimate — "2-3 أيام" etc.
 * ============================================================================
 */

export interface ShippingPrice {
  home: number;   // DA
  desk: number;   // DA
  duration: string; // e.g. "1-2", "2-3", "3-5", "5-7"
}

/**
 * Pricing tiers from the Yalidine table:
 *   Tier 1: 400/540   — Algiers center (1 day)
 *   Tier 2: 500/650   — Near north (1-2 days)
 *   Tier 3: 600/750   — Center / medium (2-3 days)
 *   Tier 4: 700/850   — East / further (2-3 days)
 *   Tier 5: 900/1100  — Far / south (3-5 days)
 *   Tier 6: 1400/1600 — Deep south (5-7 days)
 */
const T1: ShippingPrice = { home: 400,  desk: 540,  duration: "1-2" };
const T2: ShippingPrice = { home: 500,  desk: 650,  duration: "1-2" };
const T3: ShippingPrice = { home: 600,  desk: 750,  duration: "2-3" };
const T4: ShippingPrice = { home: 700,  desk: 850,  duration: "2-3" };
const T5: ShippingPrice = { home: 900,  desk: 1100, duration: "3-5" };
const T6: ShippingPrice = { home: 1400, desk: 1600, duration: "5-7" };

/** Map: wilayaId → shipping price. */
export const SHIPPING_PRICES: Record<number, ShippingPrice> = {
  1:  T6,  // Adrar
  2:  T2,  // Chlef
  3:  T3,  // Laghouat
  4:  T4,  // Oum El Bouaghi
  5:  T4,  // Batna
  6:  T2,  // Béjaïa
  7:  T2,  // Biskra
  8:  T2,  // Béchar
  9:  T2,  // Blida
  10: T2,  // Bouira
  11: T6,  // Tamanrasset
  12: T2,  // Tébessa
  13: T2,  // Tlemcen
  14: T3,  // Tiaret
  15: T3,  // Tizi Ouzou
  16: T1,  // Alger
  17: T3,  // Djelfa
  18: T3,  // Jijel
  19: T3,  // Sétif
  20: T3,  // Saïda
  21: T3,  // Skikda
  22: T3,  // Sidi Bel Abbès
  23: T3,  // Annaba
  24: T3,  // Guelma
  25: T3,  // Constantine
  26: T3,  // Médéa
  27: T3,  // Mostaganem
  28: T3,  // M'Sila
  29: T3,  // Mascara
  30: T3,  // Ouargla
  31: T3,  // Oran
  32: T5,  // El Bayadh
  33: T4,  // Illizi
  34: T4,  // Bordj Bou Arréridj
  35: T4,  // Boumerdès
  36: T5,  // El Tarf
  37: T5,  // Tindouf
  38: T5,  // Tissemsilt
  39: T3,  // El Oued
  40: T5,  // Khenchela
  41: T5,  // Souk Ahras
  42: T5,  // Tipaza
  43: T5,  // Mila
  44: T5,  // Aïn Defla
  45: T5,  // Naâma
  46: T5,  // Aïn Témouchent
  47: T3,  // Ghardaïa
  48: T5,  // Relizane
  49: T3,  // El M'Ghair
  50: T6,  // El Menia
  51: T3,  // Ouled Djellal
  52: T6,  // Bordj Badji Mokhtar
  53: T5,  // Béni Abbès
  54: T6,  // Timimoun
  55: T3,  // Touggourt
  56: T6,  // Djanet
  57: T6,  // In Salah
  58: T6,  // In Guezzam
  59: T3,  // Aflou
  60: T3,  // Barika
  61: T3,  // El Kantara
  62: T3,  // Bir El Ater
  63: T3,  // El Aricha
  64: T3,  // Ksar Chellala
  65: T3,  // Aïn Oussera
  66: T3,  // Messad
  67: T3,  // Ksar El Boukhari
  68: T3,  // Bou Saada
  69: T5,  // El Abiodh Sidi Cheikh
};

/** Get shipping price for a wilaya. Falls back to T3 if not found. */
export function getShippingPrice(wilayaId: number): ShippingPrice {
  return SHIPPING_PRICES[wilayaId] ?? T3;
}

/** Get delivery fee based on wilaya + delivery type. */
export function getDeliveryFee(wilayaId: number, deliveryType: "home" | "stop"): number {
  const price = getShippingPrice(wilayaId);
  return deliveryType === "home" ? price.home : price.desk;
}
