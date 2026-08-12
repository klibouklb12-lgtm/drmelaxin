/**
 * Page — Server Component entry point.
 * Single integrated voice (Arabic + French accents).
 * No locale detection — the store is one language mode.
 */
import { Storefront } from "@/components/store/Storefront";

export default function Page() {
  return <Storefront />;
}
