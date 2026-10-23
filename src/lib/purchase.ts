import crypto from 'node:crypto';
import { logEvent, one, q } from './db';
import { appUrl, dato, datoTid, fromLocalInput, kr } from './format';
import { sendMail } from './mail';

export const MOMS = 0.25;
export const incl = (ex: number) => Math.round(ex * (1 + MOMS));

export interface PriceGroup {
  id: number;
  value_kr: number;
  note: string | null;
}

export interface ShopSettings {
  homeFee: number;
  wrapFee: number;
  minQty: number;
  weekFrom: number;
  weekTo: number;
  closedWeeks: number[];
  chooseDaysBefore: number;
  dropoffDaysBefore: number;
}

export async function shopSettings(): Promise<ShopSettings> {
  const rows = await q<{ key: string; value: string }>('select key, value from settings');
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const n = (k: string, d: number) => (Number.isFinite(Number(s[k])) && s[k] !== '' ? Number(s[k]) : d);
  return {
    homeFee: n('gebyr_hjemlevering_kr', 75),
    wrapFee: n('indpakning_kr', 30),
    minQty: n('min_antal', 5),
    weekFrom: n('leveringsuge_fra', 46),
    weekTo: n('leveringsuge_til', 51),
    closedWeeks: (s.leveringsuger_lukket ?? '')
      .split(/[ ,;]+/)
      .map(Number)
      .filter((x) => x > 0),
    chooseDaysBefore: n('vaelgefrist_dage_foer', 19),
    dropoffDaysBefore: n('aflevering_dage_foer', 5),
  };
}

// ---------- Leveringsuger ----------

export interface Week {
  key: string; // fx 2026-W46
  week: number;
  year: number;
  deliveryDate: string; // fredag i ugen, yyyy-mm-dd
  chooseDeadline: string; // ISO
  available: boolean;
  closed: boolean;
}

function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return { year: y, week: w };
}

function mondayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1) + (week - 1) * 7);
  return monday;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function deliveryWeeks(s: ShopSettings, now = new Date()): Week[] {
  const cur = isoWeek(now);
  const year = cur.week > s.weekTo ? cur.year + 1 : cur.year;
  const weeks: Week[] = [];
  for (let w = s.weekFrom; w <= Math.max(s.weekTo, s.weekFrom); w++) {
    const friday = mondayOfIsoWeek(year, w);
    friday.setUTCDate(friday.getUTCDate() + 4);
    const choose = new Date(friday);
    choose.setUTCDate(choose.getUTCDate() - s.chooseDaysBefore);
    const deadline = fromLocalInput(`${ymd(choose)}T23:59`)!;
    const closed = s.closedWeeks.includes(w);
    // Virksomheden skal have mindst 3 dage til at dele koderne ud
    const available = !closed && deadline.getTime() - now.getTime() > 3 * 86400000;
    weeks.push({ key: `${year}-W${String(w).padStart(2, '0')}`, week: w, year, deliveryDate: ymd(friday), chooseDeadline: deadline.toISOString(), available, closed });
  }
  return weeks;
}

// ---------- Priser ----------

export interface CartLine {
  groupId: number;
  qty: number;
}

export interface Totals {
  qty: number;
  subtotal: number;
  deliveryFee: number;
  wrappingFee: number;
  moms: number;
  total: number;
}

export function calcTotals(lines: CartLine[], groups: PriceGroup[], mode: 'company' | 'home', wrapping: boolean, s: ShopSettings): Totals {
  let qty = 0;
  let subtotal = 0;
  for (const l of lines) {
    const g = groups.find((x) => x.id === l.groupId);
    if (!g || l.qty <= 0) continue;
    qty += l.qty;
    subtotal += l.qty * g.value_kr;
  }
  const deliveryFee = mode === 'home' ? qty * s.homeFee : 0;
  const wrappingFee = wrapping ? qty * s.wrapFee : 0;
  const ex = subtotal + deliveryFee + wrappingFee;
  const moms = Math.round(ex * MOMS);
  return { qty, subtotal, deliveryFee, wrappingFee, moms, total: ex + moms };
}

// ---------- Gavekoder ----------

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // uden 0/O og 1/I
export function newGiftCode(): string {
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeCode(input: string): string {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : input.trim().toUpperCase();
}

// ---------- Bestilling ----------

export interface Purchase {
  id: number;
  company_id: number;
  status: string;
  delivery_mode: 'company' | 'home';
  delivery_week: string;
  delivery_date: Date;
  choose_deadline: Date;
  wrapping: boolean;
  codes_delivery: 'email' | 'file';
  payment: string;
  ean: string | null;
  po_number: string | null;
  cvr: string | null;
  company_name: string;
  billing_address: string;
  billing_zip: string;
  billing_city: string;
  billing_country: string;
  billing_email: string;
  delivery_same: boolean;
  delivery_name: string | null;
  delivery_address: string | null;
  delivery_zip: string | null;
  delivery_city: string | null;
  delivery_att: string | null;
  contact_first: string;
  contact_last: string;
  contact_email: string;
  contact_phone: string;
  quantity: number;
  subtotal_ex: number;
  delivery_fee_ex: number;
  wrapping_fee_ex: number;
  moms: number;
  total_inc: number;
  invoiced_at: Date | null;
  created_at: Date;
}

export const weekLabel = (key: string) => `Uge ${Number(key.split('-W')[1])}`;

export function deliveryAddressText(p: Purchase): string {
  if (p.delivery_mode === 'home') return 'Til medarbejdernes hjemmeadresser';
  if (p.delivery_same || !p.delivery_address) return `${p.company_name}, ${p.billing_address}, ${p.billing_zip} ${p.billing_city}`;
  return [p.delivery_name || p.company_name, p.delivery_att ? `att. ${p.delivery_att}` : '', p.delivery_address, `${p.delivery_zip ?? ''} ${p.delivery_city ?? ''}`.trim()]
    .filter(Boolean)
    .join(', ');
}

export async function getPurchase(id: number) {
  return one<Purchase>('select * from purchases where id = $1', [id]);
}

export interface CodeRow {
  id: number;
  order_id: number;
  code: string;
  token: string;
  name: string | null;
  email: string | null;
  value_kr: number;
  invited_at: Date | null;
  opened_at: Date | null;
  chosen_at: Date | null;
  is_default: boolean;
  product_name: string | null;
  shop_name: string | null;
}

export async function purchaseCodes(purchaseId: number): Promise<CodeRow[]> {
  return q<CodeRow>(
    `select r.id, r.order_id, r.code, r.token, r.name, r.email, pc.value_kr, r.invited_at, r.opened_at, r.chosen_at, r.is_default,
            p.name as product_name, s.name as shop_name
       from recipients r join gift_orders o on o.id = r.order_id join price_categories pc on pc.id = o.price_category_id
       left join products p on p.id = r.chosen_product_id left join shops s on s.id = p.shop_id
      where o.purchase_id = $1 order by pc.value_kr, r.id`,
    [purchaseId],
  );
}

export function codeLink(token: string) {
  return `${appUrl()}/g/${token}`;
}

function linesText(codes: CodeRow[]) {
  const groups = [...new Set(codes.map((c) => c.value_kr))];
  return groups
    .map((v) => {
      const cs = codes.filter((c) => c.value_kr === v);
      return `Gavekort ${kr(v)} – ${cs.length} stk.\n` + cs.map((c) => `  ${c.code}   ${codeLink(c.token)}`).join('\n');
    })
    .join('\n\n');
}

export async function sendCodesMail(p: Purchase) {
  const codes = await purchaseCodes(p.id);
  await sendMail(
    p.contact_email,
    `Jeres gavekoder (${codes.length} stk.) – Gaver For Dig`,
    `Hej ${p.contact_first}\n\nHer er jeres ${codes.length} gavekoder. Giv én kode til hver medarbejder.\n\nMedarbejderen går ind på ${appUrl()}/gave og skriver koden – eller klikker direkte på sit personlige link – og vælger sin gave fra butikkerne i Vejen Kommune.\n\nVælg senest: ${datoTid(p.choose_deadline)}\nLevering: ${weekLabel(p.delivery_week)} (senest ${dato(p.delivery_date)})\n\n${linesText(codes)}\n\nI kan også printe koderne eller hente dem som en fil i jeres oversigt:\n${appUrl()}/virksomhed/bestilling/${p.id}\n\nVenlig hilsen\nGaver For Dig`,
  );
  await q(`update recipients set invited_at = coalesce(invited_at, now()) where order_id in (select id from gift_orders where purchase_id = $1)`, [p.id]);
}

export async function sendConfirmation(p: Purchase) {
  const lines = await q<{ value_kr: number; quantity: number }>(
    `select pc.value_kr, o.quantity from gift_orders o join price_categories pc on pc.id = o.price_category_id where o.purchase_id = $1 order by pc.value_kr`,
    [p.id],
  );
  const body = [
    `Hej ${p.contact_first}`,
    '',
    `Tak for jeres bestilling hos Gaver For Dig. Ordrenummer: ${p.id}`,
    '',
    ...lines.map((l) => `Gavekort ${kr(l.value_kr)} × ${l.quantity} = ${kr(l.value_kr * l.quantity)}`),
    p.delivery_fee_ex ? `Levering til hjemmeadresser: ${kr(p.delivery_fee_ex)}` : 'Levering til virksomheden: 0 kr.',
    p.wrapping_fee_ex ? `Gaveindpakning: ${kr(p.wrapping_fee_ex)}` : 'Indpakning: leveres i mulepose',
    `Moms 25 %: ${kr(p.moms)}`,
    `I alt inkl. moms: ${kr(p.total_inc)}`,
    '',
    `Medarbejderne vælger senest: ${datoTid(p.choose_deadline)}`,
    `Levering: ${weekLabel(p.delivery_week)}, senest ${dato(p.delivery_date)}`,
    `Leveres til: ${deliveryAddressText(p)}`,
    `Betaling: ${p.payment === 'ean' ? `EAN ${p.ean}` : 'Faktura'}${p.po_number ? ` · Rekv.nr. ${p.po_number}` : ''}`,
    '',
    p.codes_delivery === 'email'
      ? 'Gavekoderne kommer i en separat mail.'
      : 'I har valgt, at vi sender gavekoderne direkte til medarbejderne. Upload jeres medarbejderliste i oversigten, hvis I ikke allerede har gjort det.',
    `Oversigt: ${appUrl()}/virksomhed/bestilling/${p.id}`,
    '',
    'Venlig hilsen',
    'Gaver For Dig',
  ].join('\n');
  const to = new Set([p.contact_email, p.billing_email].map((e) => e.toLowerCase()));
  for (const e of to) await sendMail(e, `Ordrebekræftelse ${p.id} – Gaver For Dig`, body);
  const admins = await q<{ email: string }>(`select email from users where role = 'admin'`);
  for (const a of admins)
    await sendMail(
      a.email,
      `Ny bestilling ${p.id}: ${p.company_name} (${p.quantity} gaver)`,
      `${p.company_name} · CVR ${p.cvr ?? '–'}\n${p.quantity} gaver · ${kr(p.total_inc)} inkl. moms\n${weekLabel(p.delivery_week)} · ${p.delivery_mode === 'home' ? 'hjemmelevering' : 'til virksomheden'}${p.wrapping ? ' · indpakning' : ''}\nBetaling: ${p.payment}${p.ean ? ` EAN ${p.ean}` : ''}\n\n${appUrl()}/admin/afregning`,
    );
}

export function inviteMail(name: string, company: string, code: string, token: string, greeting: string | null, deadline: Date | null) {
  return [
    `Hej ${name}`,
    '',
    `${company} giver dig en julegave i år, og du vælger selv, hvad det skal være.`,
    greeting ? `\n${greeting}\n` : '',
    'Alle gaverne kommer fra lokale butikker i Vejen Kommune.',
    '',
    `Vælg din gave her: ${codeLink(token)}`,
    `Din gavekode: ${code}`,
    deadline ? `Vælg senest ${datoTid(deadline)}.` : '',
    '',
    'Venlig hilsen',
    'Gaver For Dig',
  ].join('\n');
}

// Medarbejderliste: én pr. linje: navn; e-mail; [prisgruppe]. Fordeles på ledige koder.
export async function assignRecipients(purchaseId: number, text: string, actor: string) {
  const p = await getPurchase(purchaseId);
  if (!p) return { assigned: 0, skipped: ['Bestillingen findes ikke'] };
  const codes = await q<{ id: number; value_kr: number; code: string; token: string; greeting: string | null }>(
    `select r.id, pc.value_kr, r.code, r.token, o.greeting from recipients r join gift_orders o on o.id = r.order_id
       join price_categories pc on pc.id = o.price_category_id
      where o.purchase_id = $1 and r.email is null and r.chosen_product_id is null order by pc.value_kr, r.id`,
    [purchaseId],
  );
  const free = [...codes];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const skipped: string[] = [];
  let assigned = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[;\t,]/).map((x) => x.trim().replace(/^"|"$/g, ''));
    const ei = parts.findIndex((x) => EMAIL.test(x));
    if (ei === -1) {
      if (!/navn|e-?mail/i.test(line)) skipped.push(`${line} (ingen gyldig e-mail)`);
      continue;
    }
    const email = parts[ei].toLowerCase();
    const rest = parts.filter((_, i) => i !== ei);
    const priceTxt = rest.find((x) => /^\d[\d.\s]*(kr\.?)?$/i.test(x));
    const name = rest.find((x) => x !== priceTxt) || email.split('@')[0];
    const price = priceTxt ? Number(priceTxt.replace(/[^\d]/g, '')) : null;
    const idx = free.findIndex((c) => price == null || c.value_kr === price);
    if (idx === -1) {
      skipped.push(`${name} (ingen ledig gavekode${price ? ` til ${kr(price)}` : ''})`);
      continue;
    }
    const c = free.splice(idx, 1)[0];
    await q('update recipients set name = $1, email = $2, invited_at = now() where id = $3', [name, email, c.id]);
    await sendMail(email, `Din julegave fra ${p.company_name}`, inviteMail(name, p.company_name, c.code, c.token, c.greeting, p.choose_deadline));
    assigned++;
  }
  await logEvent(actor, 'purchase', purchaseId, 'medarbejderliste uploadet', `${assigned} sendt, ${skipped.length} sprunget over`);
  return { assigned, skipped };
}
