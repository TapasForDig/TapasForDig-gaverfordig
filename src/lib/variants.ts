import { q } from './db';

// Varianter: op til 2 egenskaber (fx Størrelse og Farve), hver med op til 15 værdier.
// Hver kombination har sit eget lager. Etiketten er værdierne i rækkefølge, fx "Rød / M".
export interface VariantOption {
  name: string;
  values: string[];
}
export interface Variant {
  id: number;
  product_id: number;
  label: string;
  stock: number;
  chosen: number;
}

export const MAX_OPTIONS = 2;
export const MAX_VALUES = 15;

export function parseOptions(json: string | null | undefined): VariantOption[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return cleanOptions(raw);
  } catch {
    return [];
  }
}

export function cleanOptions(raw: unknown[]): VariantOption[] {
  const out: VariantOption[] = [];
  for (const o of raw.slice(0, MAX_OPTIONS)) {
    const name = String((o as VariantOption)?.name ?? '').trim().slice(0, 30);
    const vals = Array.isArray((o as VariantOption)?.values) ? (o as VariantOption).values : [];
    const values = [...new Set(vals.map((v) => String(v).replace(/\//g, '-').trim().slice(0, 30)).filter(Boolean))].slice(0, MAX_VALUES);
    if (name && values.length) out.push({ name, values });
  }
  return out;
}

// Alle kombinationer som etiketter, fx ["Rød / S", "Rød / M", …]
export function combos(options: VariantOption[]): string[] {
  if (!options.length) return [];
  return options.reduce<string[]>((acc, o) => (acc.length ? acc.flatMap((a) => o.values.map((v) => `${a} / ${v}`)) : [...o.values]), []);
}

export async function variantsFor(productIds: number[]): Promise<Map<number, Variant[]>> {
  const map = new Map<number, Variant[]>();
  if (!productIds.length) return map;
  const rows = await q<Variant>(
    `select v.id, v.product_id, v.label, v.stock,
            (select count(*)::int from recipients r where r.variant_id = v.id) as chosen
       from product_variants v where v.product_id = any($1::int[]) order by v.product_id, v.sort, v.id`,
    [productIds],
  );
  for (const r of rows) map.set(r.product_id, [...(map.get(r.product_id) ?? []), r]);
  return map;
}
