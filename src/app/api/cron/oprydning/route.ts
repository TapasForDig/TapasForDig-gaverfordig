import { NextResponse } from 'next/server';
import { runAutoReminders } from '@/lib/reminders';
import { runCleanup } from '@/lib/retention';

// Kaldes dagligt af Vercel Cron (se vercel.json). Kræver CRON_SECRET i miljøvariablerne.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Ingen adgang', { status: 401 });
  const r = await runCleanup('cron');
  const reminders = await runAutoReminders();
  return NextResponse.json({ ...r, reminders });
}
