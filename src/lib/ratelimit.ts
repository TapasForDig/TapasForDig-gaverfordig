import { headers } from 'next/headers';
import { one, q } from './db';

// Enkel begrænsning af forsøg pr. nøgle (fx IP eller e-mail) i databasen.
// Returnerer true, hvis grænsen er overskredet.
export async function tooMany(key: string, max: number, windowSec: number): Promise<boolean> {
  await q('insert into rate_hits (key) values ($1)', [key]);
  const r = await one<{ n: number }>(`select count(*)::int as n from rate_hits where key = $1 and at > now() - make_interval(secs => $2)`, [key, windowSec]);
  return (r?.n ?? 0) > max;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'ukendt').trim();
}
