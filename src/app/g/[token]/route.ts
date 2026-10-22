import { NextResponse } from 'next/server';
import { RECIPIENT_COOKIE_NAME } from '@/lib/auth';
import { one, q } from '@/lib/db';

// Personligt link fra invitationsmailen: logger modtageren ind uden adgangskode
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const r = await one<{ id: number }>('select id from recipients where token = $1', [token]);
  if (!r) return NextResponse.redirect(new URL('/gave?ugyldig=1', req.url));
  await q('update recipients set opened_at = coalesce(opened_at, now()) where id = $1', [r.id]);
  const res = NextResponse.redirect(new URL('/gave', req.url));
  res.cookies.set(RECIPIENT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  });
  return res;
}
