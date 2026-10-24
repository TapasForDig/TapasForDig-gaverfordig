import { currentUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { getOrder } from '@/lib/gifts';

// Felter, der starter med = + - @, ville Excel ellers køre som formler
const cell = (v: unknown) => {
  const s = String(v ?? '');
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
};

// CSV (semikolon, til dansk Excel) over hvem der har valgt hvad
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  const { id } = await ctx.params;
  const o = await getOrder(Number(id));
  if (!u || !o || (u.role !== 'admin' && u.role !== 'logistik' && u.company_id !== o.company_id)) {
    return new Response('Ingen adgang', { status: 403 });
  }
  const rows = await q<Record<string, unknown>>(
    `select r.name, r.email, r.department, p.name || coalesce(' – ' || r.variant_label, '') as gave, s.name as butik, r.is_default, r.chosen_at
       from recipients r left join products p on p.id = r.chosen_product_id left join shops s on s.id = p.shop_id
      where r.order_id = $1 order by r.department, r.name`,
    [o.id],
  );
  const lines = [
    ['Navn', 'E-mail', 'Afdeling', 'Gave', 'Butik', 'Standardgave'].map(cell).join(';'),
    ...rows.map((r) => [r.name, r.email, r.department, r.gave, r.butik, r.is_default ? 'ja' : ''].map(cell).join(';')),
  ];
  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gaver-ordre-${o.id}.csv"`,
    },
  });
}
