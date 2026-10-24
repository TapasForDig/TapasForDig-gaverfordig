'use server';

import { redirect } from 'next/navigation';
import { logEvent, one } from '@/lib/db';
import { appUrl, str } from '@/lib/format';
import { CONSENT_TEXT, subscribeLead } from '@/lib/klaviyo';
import { contact } from '@/lib/legal';
import { sendMail } from '@/lib/mail';
import { clientIp, tooMany } from '@/lib/ratelimit';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_RETURN = /^\/[a-z0-9/_-]*$/i;

export async function saveLead(fd: FormData) {
  const ret = SAFE_RETURN.test(str(fd, 'return')) ? str(fd, 'return') : '/';
  const back = (m: string): never => redirect(`${ret}?lead=${encodeURIComponent(m)}#lead`);
  if (str(fd, 'website')) back('ok'); // fælde for robotter
  const kind = str(fd, 'kind') === 'butik' ? 'butik' : 'virksomhed';
  const name = str(fd, 'name').slice(0, 120);
  const email = str(fd, 'email').toLowerCase().slice(0, 200);
  const company = str(fd, 'company').slice(0, 160) || null;
  const phone = str(fd, 'phone').slice(0, 40) || null;
  const employees = Math.max(0, Math.min(100000, Number(str(fd, 'employees')) || 0)) || null;
  const town = str(fd, 'town').slice(0, 80) || null;
  const message = str(fd, 'message').slice(0, 2000) || null;
  const consent = fd.get('consent') === 'ja';
  if (!name || !EMAIL.test(email)) back('!Skriv dit navn og en gyldig e-mail.');
  if (await tooMany(`lead:${await clientIp()}`, 5, 3600)) back('!Du har sendt flere henvendelser på kort tid. Skriv eller ring direkte til os i stedet.');

  const lead = await one<{ id: number }>(
    `insert into leads (kind, name, company, email, phone, employees, town, message, consent, consent_text, source)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
    [kind, name, company, email, phone, employees, town, message, consent, consent ? CONSENT_TEXT : null, ret],
  );
  // Kun leads med samtykke kommer på en markedsføringsliste i Klaviyo
  const k = consent
    ? await subscribeLead(kind, { email, name, company, phone, properties: { antal_medarbejdere: employees, by: town } })
    : 'intet samtykke';
  await one('update leads set klaviyo = $1 where id = $2 returning id', [k, lead!.id]);
  const c = await contact();
  await sendMail(
    c.email,
    `Nyt lead (${kind}): ${company ?? name}`,
    [
      `${kind === 'butik' ? 'Butik' : 'Virksomhed'}: ${company ?? '–'}`,
      `Navn: ${name}`,
      `E-mail: ${email}`,
      `Telefon: ${phone ?? '–'}`,
      employees ? `Antal medarbejdere: ${employees}` : '',
      town ? `By: ${town}` : '',
      message ? `\nBesked:\n${message}` : '',
      `\nSamtykke til nyhedsmails: ${consent ? 'ja' : 'nej'} · Klaviyo: ${k}`,
      `\nAlle leads: ${appUrl()}/admin/leads`,
    ]
      .filter(Boolean)
      .join('\n'),
    email,
  );
  await logEvent(email, 'lead', lead!.id, 'nyt lead', kind);
  back('ok');
}
