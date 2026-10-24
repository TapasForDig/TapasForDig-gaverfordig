import { currentUser } from '@/lib/auth';
import { q } from '@/lib/db';

const cell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : String(v ?? '');
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
};

export async function GET() {
  const u = await currentUser();
  if (!u || u.role !== 'admin') return new Response('Ingen adgang', { status: 403 });
  const rows = await q<Record<string, unknown>>('select * from leads order by id desc');
  const cols = ['created_at', 'kind', 'status', 'name', 'company', 'email', 'phone', 'employees', 'town', 'message', 'consent', 'klaviyo', 'source'];
  const head = ['Oprettet', 'Type', 'Status', 'Navn', 'Firma/butik', 'E-mail', 'Telefon', 'Medarbejdere', 'By', 'Besked', 'Samtykke', 'Klaviyo', 'Kilde'];
  const lines = [head.map(cell).join(';'), ...rows.map((r) => cols.map((c) => (c === 'consent' ? (r[c] ? 'ja' : 'nej') : r[c])).map(cell).join(';'))];
  return new Response('﻿' + lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads-gaverfordig.csv"' },
  });
}
