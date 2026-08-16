/**
 * PRODUCT — Dr.Melaxin Cemenrete CX
 * Price: 5800 → 3900 DA. FREE HOME SHIPPING.
 */
import { cdn } from "@/lib/cdn";

export interface ProductTier {
  quantity: number;
  discount: number;
}

export interface ProductConfig {
  slug: string;
  brandName: string;
  lineName: string;
  subtitle: string;

  taglineArabic: string;
  descriptionArabic: string;
  benefitsArabic: string;
  badgeArabic: string;

  taglineFrench: string;
  descriptionFrench: string;
  benefitsFrench: string;

  photos: { src: string; alt: string }[];
  imageAlt: string;

  oldPrice: number;
  basePrice: number;
  tiers: ProductTier[];
}

export const PRODUCT: ProductConfig = {
  slug: "cemenrete-cx",
  brandName: "Dr.Melaxin",
  lineName: "Cemenrete CX",
  subtitle: "Calcium Volume Multi Balm",

  taglineArabic: "✨ ستيك للعناية بالتجاعيد لبشرة أكثر نعومة وتماسكاً.",
  descriptionArabic:
    "تساعد تركيبته على تقليل مظهر التجاعيد والخطوط الدقيقة، مع ترطيب البشرة ومنحها مظهراً أكثر إشراقاً ونعومة.",
  benefitsArabic: "مضاد للتجاعيد • تماسك • ترطيب • إشراقة",
  badgeArabic: "مضاد للتجاعيد",

  taglineFrench:
    "✨ Le stick anti-ridules pour une peau visiblement plus lisse et plus ferme.",
  descriptionFrench:
    "Sa formule aide à réduire l'apparence des rides et ridules, tout en apportant hydratation, confort et éclat à la peau.",
  benefitsFrench: "Anti-ridules • Fermeté • Hydratation • Éclat",

  photos: [
    { src: cdn("/gallery/hero.webp"),            alt: "Dr.Melaxin Cemenrete CX" },
    { src: cdn("/gallery/dramatic.webp"),        alt: "Dr.Melaxin Cemenrete CX" },
    { src: cdn("/gallery/texture.webp"),         alt: "Dr.Melaxin Cemenrete CX" },
    { src: cdn("/gallery/pearl.webp"),           alt: "Dr.Melaxin Cemenrete CX" },
    { src: cdn("/gallery/lifestyle.webp"),       alt: "Dr.Melaxin Cemenrete CX" },
    { src: cdn("/gallery/benefits-banner.webp"), alt: "Dr.Melaxin Cemenrete CX" },
    { src: cdn("/gallery/collage.webp"),         alt: "Dr.Melaxin Cemenrete CX" },
  ],
  imageAlt: "Dr.Melaxin Cemenrete CX — Calcium Volume Multi Balm",

  oldPrice: 5800,
  basePrice: 3900,

  tiers: [
    { quantity: 1, discount: 0    },
    { quantity: 2, discount: 0.10 },
    { quantity: 3, discount: 0.15 },
    { quantity: 4, discount: 0.20 },
  ],
}

/**
 * DELIVERY — FREE HOME SHIPPING. No stop desk option.
 */
export const DELIVERY_OPTIONS = [
  {
    id: "home" as const,
    labelArabic: "توصيل للمنزل",
    labelFrench: "Livraison à domicile",
    fee: 0, // FREE
  },
] as const;

export type DeliveryId = (typeof DELIVERY_OPTIONS)[number]["id"];
