import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getPurchase } from '@/lib/purchase';

export async function ownPurchase(id: number) {
  const u = await requireRole('virksomhed');
  const p = await getPurchase(id);
  if (!p || (u.role !== 'admin' && p.company_id !== u.company_id)) notFound();
  return { u, p };
}
