/**
 * build-communes.ts — converts /upload/communes.json into a compact
 * TypeScript-friendly JSON module at src/lib/communes-data.json.
 *
 * Run: bun run scripts/build-communes.ts
 */
import { readFileSync, writeFileSync } from "fs";

const SRC = "/home/z/my-project/upload/communes.json";
const DST = "/home/z/my-project/src/lib/communes-data.json";

type RawCommune = {
  id: string;
  post_code: string;
  name: string;
  wilaya_id: string;
  ar_name: string;
  longitude: string;
  latitude: string;
};

const raw = JSON.parse(
  readFileSync(SRC, "utf-8").replace(/^\uFEFF/, "")
) as RawCommune[];

const compact = raw.map((c) => ({
  id: Number(c.id),
  wilayaId: Number(c.wilaya_id),
  name: c.name,
  arName: c.ar_name,
  postCode: c.post_code,
}));

writeFileSync(DST, JSON.stringify(compact));
console.log(`Wrote ${compact.length} communes to ${DST}`);
