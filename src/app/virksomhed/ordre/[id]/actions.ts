'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { newToken, requireRole, type User } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, kr, str } from '@/lib/format';
import { getOrder, getSetting, giftsFor, sendInvites, sendReminders, type Order } from '@/lib/gifts';
import { sendMail } from '@/lib/mail';

const EDITABLE = ['draft', 'confirmed', 'invited'];

async function own(fd: FormData): Promise<{ u: User; o: Order }> {
  const u = await requireRole('virksomhed');
  const o = await getOrder(Number(fd.get('order')));
  if (!o || (u.role !== 'admin' && o.company_id !== u.company_id)) redirect('/virksomhed');
  return { u, o };
}

function back(id: number, msg: string): never {
  revalidatePath(`/virksomhed/ordre/${id}`);
  redirect(`/virksomhed/ordre/${id}?m=${encodeURIComponent(msg)}`);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function insertRecipient(orderId: number, name: string, email: string, dept: string) {
  const exists = await one('select 1 from recipients where order_id = $1 and lower(email) = lower($2)', [orderId, email]);
  if (exists) return false;
  await q('insert into recipients (order_id, name, email, department, token) values ($1,$2,$3,$4,$5)', [orderId, name, email.toLowerCase(), dept || null, newToken()]);
  return true;
}

export async function addRecipient(fd: FormData) {
  const { u, o } = await own(fd);
  if (!EDITABLE.includes(o.status)) back(o.id, '!Ordren kan ikke længere ændres');
  const name = str(fd, 'name');
  const email = str(fd, 'email');
  if (!name || !EMAIL.test(email)) back(o.id, '!Skriv navn og en gyldig e-mail');
  const ok = await insertRecipient(o.id, name, email, str(fd, 'department'));
  await logEvent(u.email, 'order', o.id, 'modtager tilføjet', email);
  back(o.id, ok ? `${name} er tilføjet` : '!Den e-mail er allerede på listen');
}

// Indsæt fra Excel/CSV: én modtager pr. linje, "navn; e-mail; afdeling" (komma, semikolon eller tabulator)
export async function importRecipients(fd: FormData) {
  const { u, o } = await own(fd);
  if (!EDITABLE.includes(o.status)) back(o.id, '!Ordren kan ikke længere ændres');
  let text = str(fd, 'rows');
  const file = fd.get('file');
  if (file instanceof File && file.size > 0) text += '\n' + (await file.text());
  let added = 0;
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[;\t,]/).map((s) => s.trim().replace(/^"|"$/g, ''));
    const emailIdx = parts.findIndex((p) => EMAIL.test(p));
    if (emailIdx === -1) {
      if (!/navn|e-?mail/i.test(line)) bad.push(line); // spring overskriftslinje over
      continue;
    }
    const email = parts[emailIdx];
    const rest = parts.filter((_, i) => i !== emailIdx);
    const name = rest[0] || email.split('@')[0];
    if (await insertRecipient(o.id, name, email, rest[1] ?? '')) added++;
  }
  await logEvent(u.email, 'order', o.id, 'modtagere importeret', `${added} stk.`);
  back(o.id, bad.length ? `${added} tilføjet. ${bad.length === 1 ? "1 linje" : `${bad.length} linjer`} uden gyldig e-mail blev sprunget over.` : `${added} modtagere tilføjet`);
}

export async function removeRecipient(fd: FormData) {
  const { u, o } = await own(fd);
  if (!EDITABLE.includes(o.status)) back(o.id, '!Ordren kan ikke længere ændres');
  await q('delete from recipients where id = $1 and order_id = $2', [Number(fd.get('recipient')), o.id]);
  await logEvent(u.email, 'order', o.id, 'modtager fjernet', String(fd.get('recipient')));
  back(o.id, 'Modtageren er fjernet');
}

export async function saveDelivery(fd: FormData) {
  const { o } = await own(fd);
  await q('update gift_orders set delivery_address = $1, delivery_contact = $2, delivery_note = $3 where id = $4', [
    str(fd, 'address'),
    str(fd, 'contact'),
    str(fd, 'note'),
    o.id,
  ]);
  back(o.id, 'Leveringsoplysninger gemt');
}

export async function saveDetails(fd: FormData) {
  const { o } = await own(fd);
  if (!EDITABLE.includes(o.status)) back(o.id, '!Ordren kan ikke længere ændres');
  const def = Number(fd.get('default_product')) || null;
  if (def) {
    const ok = (await giftsFor(o.price_category_id, def)).some((p) => p.id === def);
    if (!ok) back(o.id, '!Standardgaven findes ikke i jeres priskategori');
  }
  await q('update gift_orders set greeting = $1, default_product_id = $2 where id = $3', [str(fd, 'greeting'), def, o.id]);
  back(o.id, 'Gemt');
}

export async function confirmOrder(fd: FormData) {
  const { u, o } = await own(fd);
  if (o.status !== 'draft') back(o.id, '!Ordren er allerede bekræftet');
  const n = (await one<{ n: number }>('select count(*)::int as n from recipients where order_id = $1', [o.id]))!.n;
  if (n === 0) back(o.id, '!Tilføj mindst én modtager før I bekræfter');
  if (!o.delivery_address) back(o.id, '!Udfyld leveringsadresse før I bekræfter');
  await q(`update gift_orders set status = 'confirmed', confirmed_at = now() where id = $1`, [o.id]);
  const fee = Number(await getSetting('gebyr_pr_modtager_kr')) || 0;
  const total = n * (o.value_kr + fee);
  const summary = `${o.title} · ${n} modtagere × ${kr(o.value_kr)}${fee ? ` + gebyr ${kr(fee)}` : ''} = ${kr(total)} inkl. moms`;
  await sendMail(u.email, `Ordrebekræftelse: ${o.title}`, `Tak for jeres bestilling.\n\n${summary}\n\nFakturaen sendes separat. Næste skridt: send invitationerne til jeres medarbejdere fra ordresiden.\n${appUrl()}/virksomhed/ordre/${o.id}\n\nVenlig hilsen\nGaver For Dig`);
  const admins = await q<{ email: string }>(`select email from users where role = 'admin'`);
  for (const a of admins) await sendMail(a.email, `Ny ordre til fakturering: ${o.company_name}`, `${o.company_name}\n${summary}\n\n${appUrl()}/admin`);
  await logEvent(u.email, 'order', o.id, 'bekræftet', summary);
  back(o.id, 'Ordren er bekræftet. I kan nu sende invitationerne.');
}

export async function invite(fd: FormData) {
  const { u, o } = await own(fd);
  if (!['confirmed', 'invited'].includes(o.status)) back(o.id, '!Bekræft ordren først');
  const n = await sendInvites(o.id, true);
  await logEvent(u.email, 'order', o.id, 'invitationer sendt', `${n} stk.`);
  back(o.id, n ? `${n} invitationer er sendt` : '!Alle modtagere har allerede fået en invitation');
}

export async function remind(fd: FormData) {
  const { u, o } = await own(fd);
  if (o.status !== 'invited') back(o.id, '!Send invitationerne først');
  const n = await sendReminders(o.id);
  await logEvent(u.email, 'order', o.id, 'påmindelse sendt', `${n} stk.`);
  back(o.id, n ? `Påmindelse sendt til ${n}` : 'Alle har valgt – ingen påmindelser sendt');
}
