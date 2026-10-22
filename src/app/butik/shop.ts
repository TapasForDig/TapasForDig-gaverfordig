import { redirect } from 'next/navigation';
import { requireRole, type User } from '@/lib/auth';
import { one, q } from '@/lib/db';

export interface Shop {
  id: number;
  name: string;
  town: string | null;
  status: string;
  email: string | null;
}

// Butiksbrugeren ser sin egen butik. Admin kan se en hvilken som helst via ?butik=<id>.
export async function myShop(butik?: string): Promise<{ u: User; shop: Shop; shops?: Shop[] }> {
  const u = await requireRole('butik');
  if (u.role === 'butik') {
    const shop = await one<Shop>('select id, name, town, status, email from shops where id = $1', [u.shop_id]);
    if (!shop) redirect('/login');
    return { u, shop };
  }
  const shops = await q<Shop>('select id, name, town, status, email from shops order by name');
  const shop = shops.find((s) => String(s.id) === butik) ?? shops[0];
  if (!shop) redirect('/admin');
  return { u, shop, shops };
}
