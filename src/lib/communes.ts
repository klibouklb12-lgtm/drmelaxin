/**
 * ============================================================================
 *  Communes dataset — 1,708 communes, each linked to a wilaya.
 *  Source: /upload/communes.json (founder-provided)
 *
 *  Display contract:
 *    - UI uses Arabic names (arName) for the integrated voice
 *    - Latin `name` kept for server storage + delivery API integrations
 * ============================================================================
 */

export interface Commune {
  id: number;
  wilayaId: number;
  name: string; // Latin
  arName: string; // Arabic
  postCode: string;
}

// Auto-generated from /upload/communes.json — DO NOT EDIT MANUALLY.
// To regenerate: bun run scripts/build-communes.ts
import data from "./communes-data.json";
export const COMMUNES: Commune[] = data as Commune[];

/** Get all communes for a given wilaya (cascade from wilaya selection). */
export function communesForWilaya(wilayaId: number): Commune[] {
  return COMMUNES.filter((c) => c.wilayaId === wilayaId);
}

/** Find a commune by id. */
export function findCommune(id: number): Commune | undefined {
  return COMMUNES.find((c) => c.id === id);
}
