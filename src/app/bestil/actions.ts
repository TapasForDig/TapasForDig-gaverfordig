'use server';

import { redirect } from 'next/navigation';
import { currentUser, hashPassword, newToken, startSession } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, str } from '@/lib/format';
import { activeSeason, categories } from '@/lib/gifts';
import { sendMail } from '@/lib/mail';
import { clientIp, tooMany } from '@/lib/ratelimit';
import {
  assignRecipients,
  calcTotals,
  deliveryWeeks,
  getPurchase,
  newGiftCode,
  needsPrepayment,
  sendCodesMail,
  sendConfirmation,
  shopSettings,
  type CartLine,
} from '@/lib/purchase';

export interface OrderState {
  error?: string;
  values?: Record<string, string>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QTY = 2000; // pr. bestilling – større ordrer aftales direkte

export async function placeOrder(_prev: OrderState, fd: FormData): Promise<OrderState> {
  const v: Record<string, string> = {};
  for (const [k, val] of fd.entries()) if (typeof val === 'string') v[k] = val.trim();
  const fail = (error: string): OrderState => ({ error, values: v });

  const [groups, s, season] = await Promise.all([categories(), shopSettings(), activeSeason()]);
  if (!season) return fail('Der er ikke åbnet for bestillinger endnu. Kontakt os.');

  // Kurv
  let lines: CartLine[] = [];
  try {
    lines = (JSON.parse(v.lines || '[]') as CartLine[]).map((l) => ({ groupId: Number(l.groupId), qty: Math.max(0, Math.floor(Number(l.qty))) }));
  } catch {
    return fail('Kurven kunne ikke læses. Prøv igen.');
  }
  lines = lines.filter((l) => l.qty > 0 && groups.some((g) => g.id === l.groupId));
  if (lines.reduce((s, l) => s + l.qty, 0) > MAX_QTY) return fail(`Bestillinger på mere end ${MAX_QTY} gaver aftales direkte med os. Kontakt os, så hjælper vi.`);
  // Samme indsendelse to gange (dobbeltklik) → vis den bestilling, der allerede er lavet
  const submitKey = (v.submit_key || '').slice(0, 64) || null;
  if (submitKey) {
    const dup = await one<{ id: number }>('select id from purchases where submit_key = $1', [submitKey]);
    if (dup) redirect(`/bestil/tak/${dup.id}`);
  }
  if (await tooMany(`bestil:${await clientIp()}`, 10, 3600)) return fail('For mange bestillinger fra samme sted på kort tid. Prøv igen senere, eller kontakt os.');
  const mode = v.mode === 'home' ? 'home' : 'company';
  const wrapping = v.wrapping === '1';
  const codesDelivery = v.codes === 'file' ? 'file' : 'email';
  const totals = calcTotals(lines, groups, mode, wrapping, s);
  if (totals.qty < s.minQty) return fail(`Minimumskøb er ${s.minQty} gaver.`);
  const week = deliveryWeeks(s).find((w) => w.key === v.week && w.available);
  if (!week) return fail('Vælg en leveringsuge, der stadig er åben.');

  // Firma og kontakt
  const required: [string, string][] = [
    ['company_name', 'firmanavn'],
    ['billing_address', 'fakturaadresse'],
    ['billing_zip', 'postnummer'],
    ['billing_city', 'by'],
    ['billing_email', 'faktureringsemail'],
    ['contact_first', 'kontaktpersonens fornavn'],
    ['contact_last', 'kontaktpersonens efternavn'],
    ['contact_email', 'kontaktpersonens e-mail'],
    ['contact_phone', 'telefonnummer'],
  ];
  const missing = required.filter(([k]) => !v[k]).map(([, l]) => l);
  if (missing.length) return fail('Udfyld ' + missing.join(', ') + '.');
  if (!EMAIL.test(v.billing_email) || v.billing_email.toLowerCase() !== (v.billing_email2 ?? '').toLowerCase())
    return fail('Faktureringsemail er ikke gyldig, eller de to felter er ikke ens.');
  if (!EMAIL.test(v.contact_email) || v.contact_email.toLowerCase() !== (v.contact_email2 ?? '').toLowerCase())
    return fail('Kontaktpersonens e-mail er ikke gyldig, eller de to felter er ikke ens.');
  const cvr = (v.cvr || '').replace(/\D/g, '');
  if (v.billing_country === 'Danmark' && cvr.length !== 8) return fail('Skriv et gyldigt CVR-nummer (8 cifre).');
  const payment = v.payment === 'ean' ? 'ean' : 'faktura';
  const ean = (v.ean || '').replace(/\D/g, '');
  if (payment === 'ean' && ean.length !== 13) return fail('EAN-nummeret skal være 13 cifre.');
  if (v.terms !== '1') return fail('Accepter handelsbetingelserne og databehandleraftalen for at bestille.');
  if (ean && ean.length !== 13) return fail('EAN-nummeret skal være 13 cifre.');
  const deliverySame = mode === 'home' || v.delivery_same === '1';
  if (!deliverySame && (!v.delivery_address || !v.delivery_zip || !v.delivery_city)) return fail('Udfyld leveringsadressen.');
  if (v.terms !== '1') return fail('Accepter handelsbetingelserne for at gennemføre bestillingen.');

  // Virksomhed og bruger
  const me = await currentUser();
  const contactEmail = v.contact_email.toLowerCase();
  let companyId: number | null = me?.role === 'virksomhed' ? me.company_id : null;
  let newUserId: number | null = null;
  if (!companyId) {
    // En bestilling må aldrig lægges på en eksisterende konto uden login – ellers kan andre se eller bestille i jeres navn
    if (await one('select 1 from users where email = $1', [contactEmail])) {
      return fail(`Der findes allerede en konto med ${contactEmail}. Log ind for at bestille på jeres konto (kurven bliver gemt), eller brug en anden e-mail.`);
    }
  }
  if (!companyId) {
    const c = await one<{ id: number }>(
      `insert into companies (name, cvr, address, town, contact_name, phone, email) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [v.company_name, cvr || null, `${v.billing_address}, ${v.billing_zip}`, v.billing_city, `${v.contact_first} ${v.contact_last}`, v.contact_phone, contactEmail],
    );
    companyId = c!.id;
    const exists = await one('select 1 from users where email = $1', [contactEmail]);
    if (!exists) {
      const u = await one<{ id: number }>(
        `insert into users (email, password_hash, name, role, company_id) values ($1,$2,$3,'virksomhed',$4) returning id`,
        [contactEmail, hashPassword(newToken(18)), `${v.contact_first} ${v.contact_last}`, companyId],
      );
      newUserId = u!.id;
    }
  } else {
    // Kun en indlogget virksomhed må opdatere sine egne stamdata
    await q('update companies set name = $1, cvr = coalesce($2, cvr), phone = $3 where id = $4', [v.company_name, cvr || null, v.contact_phone, companyId]);
  }

  // Bestilling
  const p = await one<{ id: number }>(
    `insert into purchases (company_id, delivery_mode, delivery_week, delivery_date, choose_deadline, wrapping, codes_delivery, payment, ean, po_number,
        cvr, company_name, billing_address, billing_zip, billing_city, billing_country, billing_email,
        delivery_same, delivery_name, delivery_address, delivery_zip, delivery_city, delivery_att,
        contact_first, contact_last, contact_email, contact_phone, newsletter,
        quantity, subtotal_ex, delivery_fee_ex, wrapping_fee_ex, moms, total_inc, submit_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
     on conflict (submit_key) do nothing
     returning id`,
    [
      companyId, mode, week.key, week.deliveryDate, week.chooseDeadline, wrapping, codesDelivery, payment, ean || null, v.po_number || null,
      cvr || null, v.company_name, v.billing_address, v.billing_zip, v.billing_city, v.billing_country || 'Danmark', v.billing_email.toLowerCase(),
      deliverySame, deliverySame ? null : v.delivery_name || v.company_name, deliverySame ? null : v.delivery_address, deliverySame ? null : v.delivery_zip,
      deliverySame ? null : v.delivery_city, deliverySame ? null : v.delivery_att || null,
      v.contact_first, v.contact_last, contactEmail, v.contact_phone, v.newsletter === '1',
      totals.qty, totals.subtotal, totals.deliveryFee, totals.wrappingFee, totals.moms, totals.total, submitKey,
    ],
  );
  if (!p) {
    const dup = await one<{ id: number }>('select id from purchases where submit_key = $1', [submitKey]);
    redirect(`/bestil/tak/${dup?.id ?? ''}`);
  }
  const purchaseId = p.id;
  const deliveryText = deliverySame
    ? `${v.company_name}, ${v.billing_address}, ${v.billing_zip} ${v.billing_city}`
    : `${v.delivery_name || v.company_name}, ${v.delivery_address}, ${v.delivery_zip} ${v.delivery_city}`;
  for (const l of lines) {
    const g = groups.find((x) => x.id === l.groupId)!;
    const o = await one<{ id: number }>(
      `insert into gift_orders (company_id, season_id, price_category_id, title, status, purchase_id, quantity, choose_deadline, delivery_date, delivery_mode, wrapping,
          delivery_address, delivery_contact, confirmed_at)
       values ($1,$2,$3,$4,'confirmed',$5,$6,$7,$8,$9,$10,$11,$12, now()) returning id`,
      [
        companyId, season.id, g.id, `Julegave ${new Date(week.deliveryDate).getFullYear()}`, purchaseId, l.qty, week.chooseDeadline, week.deliveryDate, mode, wrapping,
        mode === 'home' ? 'Hjemmeadresser' : deliveryText, `${v.contact_first} ${v.contact_last}, ${v.contact_phone}`,
      ],
    );
    for (let i = 0; i < l.qty; i++) {
      // Sjælden kollision på koden → prøv igen
      for (let attempt = 0; attempt < 5; attempt++) {
        const r = await q(`insert into recipients (order_id, token, code) values ($1,$2,$3) on conflict do nothing returning id`, [o!.id, newToken(), newGiftCode()]);
        if (r.length) break;
      }
    }
  }
  await logEvent(contactEmail, 'purchase', purchaseId, 'bestilt', `${totals.qty} gaver, ${totals.total} kr. inkl. moms`);

  if (await needsPrepayment(companyId, totals.total, purchaseId, cvr || null)) {
    await q('update purchases set hold = true where id = $1', [purchaseId]);
    await logEvent('system', 'purchase', purchaseId, 'afventer betaling', 'ny kunde over grænsen for forudbetaling');
  }
  const purchase = (await getPurchase(purchaseId))!;
  await sendConfirmation(purchase);
  if (codesDelivery === 'email') {
    if (!purchase.hold) await sendCodesMail(purchase);
  } else {
    let text = v.recipients_text || '';
    const file = fd.get('recipients_file');
    if (file instanceof File && file.size > 0 && file.size < 2_000_000) text += '\n' + (await file.text());
    if (text.trim()) await assignRecipients(purchaseId, text, contactEmail);
  }

  // Konto til oversigten
  if (newUserId) {
    const token = newToken(32);
    await q(`insert into password_resets (token, user_id, expires_at) values ($1,$2, now() + interval '14 days')`, [token, newUserId]);
    await sendMail(
      contactEmail,
      'Jeres konto hos Gaver For Dig',
      `Hej ${v.contact_first}\n\nVi har oprettet en konto til jer, så I kan følge med i, hvem der har valgt gave.\nVælg en adgangskode her (linket virker i 14 dage):\n${appUrl()}/login/nulstil/${token}\n\nVenlig hilsen\nGaver For Dig`,
    );
    await startSession(newUserId);
  }
  redirect(`/bestil/tak/${purchaseId}`);
}
