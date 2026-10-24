import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, q } from './db';

export type Role = 'admin' | 'butik' | 'virksomhed' | 'logistik';

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  shop_id: number | null;
  company_id: number | null;
}

export interface Recipient {
  id: number;
  order_id: number;
  name: string | null;
  email: string | null;
  code: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
  phone: string | null;
  token: string;
  opened_at: Date | null;
  age_confirmed: boolean;
  chosen_product_id: number | null;
  variant_id: number | null;
  variant_label: string | null;
  chosen_at: Date | null;
  is_default: boolean;
  donation_to: string | null;
  donation_town: string | null;
}

const USER_COOKIE = 'gfd_s';
const RECIPIENT_COOKIE = 'gfd_r';

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

export function newToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function homeFor(role: Role): string {
  return { admin: '/admin', butik: '/butik/produkter', virksomhed: '/virksomhed', logistik: '/logistik' }[role];
}

export async function startSession(userId: number) {
  const token = newToken(32);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await q('insert into sessions (token, user_id, expires_at) values ($1,$2,$3)', [token, userId, expires]);
  const jar = await cookies();
  jar.set(USER_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires, path: '/' });
}

export async function endSession() {
  const jar = await cookies();
  const t = jar.get(USER_COOKIE)?.value;
  if (t) await q('delete from sessions where token = $1', [t]);
  jar.delete(USER_COOKIE);
  jar.delete(RECIPIENT_COOKIE);
}

// Logger brugeren ud alle andre steder end her (fx efter skift af adgangskode)
export async function endOtherSessions(userId: number) {
  const jar = await cookies();
  await q('delete from sessions where user_id = $1 and token <> $2', [userId, jar.get(USER_COOKIE)?.value ?? '']);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const t = jar.get(USER_COOKIE)?.value;
  if (!t) return null;
  const u = await one<User>(
    `select u.id, u.email, u.name, u.role, u.shop_id, u.company_id
       from sessions s join users u on u.id = s.user_id
      where s.token = $1 and s.expires_at > now()`,
    [t],
  );
  return u ?? null;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  // Admin må se alle portaler
  if (!roles.includes(u.role) && u.role !== 'admin') redirect(homeFor(u.role));
  return u;
}

export const RECIPIENT_COOKIE_NAME = RECIPIENT_COOKIE;

export async function currentRecipient(): Promise<Recipient | null> {
  const jar = await cookies();
  const t = jar.get(RECIPIENT_COOKIE)?.value;
  if (!t) return null;
  const r = await one<Recipient>(`select * from recipients where token = $1 and anonymized_at is null and not exists (select 1 from gift_orders ho join purchases hp on hp.id = ho.purchase_id where ho.id = recipients.order_id and hp.hold)`, [t]);
  return r ?? null;
}
