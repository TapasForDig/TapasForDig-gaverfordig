import { currentUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { getOrder } from '@/lib/gifts';

// Felter, der starter med = + - @, ville Excel ellers køre som formler
const cell = (v: unknown) => {
  const s = String(v ?? '');
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
};

// Fil med modtageradresser til import i Shipmondo (Forsendelser → Importér).
// Kolonnenavnene matches i Shipmondos importguide første gang; derefter huskes opsætningen.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u || !['admin', 'logistik'].includes(u.role)) return new Response('Ingen adgang', { status: 403 });
  const { id } = await ctx.params;
  const o = await getOrder(Number(id));
  if (!o) return new Response('Ikke fundet', { status: 404 });
  const rows = await q<Record<string, string | null>>(
    `select r.code, r.name, r.address, r.zip, r.city, r.phone, r.email, p.name as product
       from recipients r join products p on p.id = r.chosen_product_id
      where r.order_id = $1 order by r.name`,
    [o.id],
  );
  const lines = [
    ['Reference', 'Navn', 'Adresse', 'Postnr', 'By', 'Land', 'Telefon', 'Email', 'Indhold', 'Vægt (kg)'].map(cell).join(';'),
    ...rows.map((r) => [`GFD-${o.id}-${r.code}`, r.name, r.address, r.zip, r.city, 'DK', r.phone, r.email, r.product, '1'].map(cell).join(';')),
  ];
  return new Response('﻿' + lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="shipmondo-ordre-${o.id}.csv"` },
  });
}
