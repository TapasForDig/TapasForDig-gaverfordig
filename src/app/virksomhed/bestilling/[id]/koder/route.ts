import { currentUser } from '@/lib/auth';
import { codeLink, getPurchase, purchaseCodes } from '@/lib/purchase';

// Felter, der starter med = + - @, ville Excel ellers køre som formler
const cell = (v: unknown) => {
  const s = String(v ?? '');
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
};

// CSV til Excel med alle gavekoder og status
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [u, p] = await Promise.all([currentUser(), getPurchase(Number(id))]);
  if (!u || !p || (u.role !== 'admin' && u.role !== 'logistik' && u.company_id !== p.company_id)) return new Response('Ingen adgang', { status: 403 });
  if (p.hold && u.role !== 'admin') return new Response('Bestillingen afventer betaling', { status: 403 });
  const codes = await purchaseCodes(p.id);
  const lines = [
    ['Gavekode', 'Beløb ekskl. moms', 'Link', 'Navn', 'E-mail', 'Valgt gave', 'Butik'].map(cell).join(';'),
    ...codes.map((c) => [c.code, c.value_kr, codeLink(c.token), c.name, c.email, c.product_name, c.shop_name].map(cell).join(';')),
  ];
  return new Response('﻿' + lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="gavekoder-ordre-${p.id}.csv"` },
  });
}
