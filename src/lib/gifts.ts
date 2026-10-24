import crypto from 'node:crypto';
import { logEvent, one, q } from './db';
import { appUrl, dato, datoTid } from './format';
import { sendMail } from './mail';

export interface Product {
  id: number;
  shop_id: number;
  shop_name: string;
  shop_town: string | null;
  name: string;
  description: string;
  kind: string;
  price_category_id: number | null;
  normal_price_kr: number | null;
  stock: number;
  alcohol: boolean;
  images: string;
  status: string;
  review_note: string | null;
  cost_kr: number | null;
  ingredients: string | null;
  net_content: string | null;
  wrap_ok: boolean;
  shelf_ok: boolean;
  variant_options: string | null;
  chosen: number;
}

export interface Season {
  id: number;
  name: string;
  order_deadline: Date | null;
  choose_deadline: Date | null;
  dropoff_deadline: Date | null;
  delivery_from: Date | null;
  active: boolean;
  closed_at: Date | null;
}

export interface Category {
  id: number;
  name: string;
  value_kr: number;
  note: string | null;
}

export interface Order {
  id: number;
  company_id: number;
  company_name: string;
  company_logo?: string | null;
  season_id: number;
  price_category_id: number;
  category_name: string;
  value_kr: number;
  title: string;
  greeting: string | null;
  default_product_id: number | null;
  status: string;
  delivery_address: string | null;
  delivery_contact: string | null;
  delivery_note: string | null;
  confirmed_at: Date | null;
  invited_at: Date | null;
  packed_at: Date | null;
  delivered_at: Date | null;
  delivered_to: string | null;
  purchase_id: number | null;
  quantity: number | null;
  choose_deadline: Date | null;
  delivery_date: Date | null;
  delivery_mode: 'company' | 'home';
  wrapping: boolean;
}

export const ORDER_STATUS: Record<string, string> = {
  draft: 'Kladde',
  confirmed: 'Bekræftet',
  invited: 'Invitationer sendt',
  closed: 'Vælgeperiode slut',
  packed: 'Pakket',
  delivered: 'Leveret',
};

export const PRODUCT_STATUS: Record<string, string> = {
  draft: 'Kladde',
  pending: 'Afventer godkendelse',
  approved: 'Godkendt',
  rejected: 'Skal rettes',
  paused: 'På pause',
};

const PRODUCT_SELECT = `
  select p.*, s.name as shop_name, s.town as shop_town,
         (select count(*)::int from recipients r where r.chosen_product_id = p.id) as chosen
    from products p join shops s on s.id = p.shop_id`;

export async function activeSeason(): Promise<Season | undefined> {
  const s = await one<Season>('select * from seasons where active order by id desc limit 1');
  if (s) return s;
  // Ingen sæson endnu (fx en ny database uden demodata): opret årets julesæson.
  // Frister styres pr. bestilling ud fra leveringsugen, så sæsonen behøver ingen datoer.
  const year = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Copenhagen', year: 'numeric' }));
  return one<Season>(`insert into seasons (name) values ($1) returning *`, [`Jul ${year}`]);
}

export async function categories(): Promise<Category[]> {
  return q<Category>('select * from price_categories order by sort, value_kr');
}

export async function getProduct(id: number): Promise<Product | undefined> {
  return one<Product>(`${PRODUCT_SELECT} where p.id = $1`, [id]);
}

export async function productsForShop(shopId: number): Promise<Product[]> {
  return q<Product>(`${PRODUCT_SELECT} where p.shop_id = $1 order by p.created_at desc`, [shopId]);
}

export async function productsByStatus(status: string): Promise<Product[]> {
  return q<Product>(`${PRODUCT_SELECT} where p.status = $1 order by p.updated_at`, [status]);
}

// Gaver en modtager kan vælge: godkendte, i den rigtige kategori, fra en godkendt butik, ikke udsolgt
export async function giftsFor(categoryId: number, includeProductId: number | null): Promise<Product[]> {
  const rows = await q<Product>(
    `${PRODUCT_SELECT}
      where p.status = 'approved' and s.status = 'approved' and p.price_category_id = $1
      order by s.name, p.name`,
    [categoryId],
  );
  return rows.filter((p) => p.chosen < p.stock || p.id === includeProductId);
}

export async function getOrder(id: number): Promise<Order | undefined> {
  return one<Order>(
    `select o.*, c.name as company_name, c.logo as company_logo, pc.name as category_name, pc.value_kr
       from gift_orders o join companies c on c.id = o.company_id
       join price_categories pc on pc.id = o.price_category_id
      where o.id = $1`,
    [id],
  );
}

export interface OrderStats {
  total: number;
  chosen: number;
  opened: number;
  not_opened: number;
  received: number;
}

export async function orderStats(orderId: number): Promise<OrderStats> {
  const s = await one<OrderStats>(
    `select count(*)::int as total,
            count(*) filter (where chosen_product_id is not null or donation_to is not null)::int as chosen,
            count(*) filter (where opened_at is not null and chosen_product_id is null and donation_to is null)::int as opened,
            count(*) filter (where opened_at is null and chosen_product_id is null and donation_to is null)::int as not_opened,
            count(received_at)::int as received
       from recipients where order_id = $1`,
    [orderId],
  );
  return s ?? { total: 0, chosen: 0, opened: 0, not_opened: 0, received: 0 };
}

export function inviteText(name: string, company: string, greeting: string | null, link: string, deadline: Date | null) {
  return [
    `Hej ${name}`,
    '',
    `${company} giver dig en gave i år, og du vælger selv, hvad det skal være.`,
    greeting ? `\n${greeting}\n` : '',
    'Alle gaverne kommer fra lokale butikker i Vejen Kommune. Din gave pakkes med dit navn og leveres til din arbejdsplads.',
    '',
    `Vælg din gave her: ${link}`,
    deadline ? `Vælg senest ${dato(deadline)}.` : '',
    '',
    'Venlig hilsen',
    'Gaver For Dig',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export async function sendInvites(orderId: number, onlyNotInvited = true) {
  const o = await getOrder(orderId);
  if (!o) return 0;
  const season = await one<Season>('select * from seasons where id = $1', [o.season_id]);
  const rows = await q<{ id: number; name: string; email: string; token: string }>(
    `select id, name, email, token from recipients where order_id = $1 ${onlyNotInvited ? 'and invited_at is null' : ''}`,
    [orderId],
  );
  for (const r of rows) {
    const link = `${appUrl()}/g/${r.token}`;
    await sendMail(r.email, `Din gave fra ${o.company_name}`, inviteText(r.name, o.company_name, o.greeting, link, season?.choose_deadline ?? null));
    await q('update recipients set invited_at = now() where id = $1', [r.id]);
  }
  await q(`update gift_orders set status = case when status in ('draft','confirmed') then 'invited' else status end, invited_at = coalesce(invited_at, now()) where id = $1`, [orderId]);
  return rows.length;
}

export async function sendReminders(orderId: number) {
  const o = await getOrder(orderId);
  if (!o) return 0;
  const season = await one<Season>('select * from seasons where id = $1', [o.season_id]);
  const rows = await q<{ id: number; name: string; email: string; token: string }>(
    `select id, name, email, token from recipients where order_id = $1 and invited_at is not null and chosen_product_id is null and donation_to is null`,
    [orderId],
  );
  for (const r of rows) {
    const link = `${appUrl()}/g/${r.token}`;
    await sendMail(
      r.email,
      `Husk at vælge din gave fra ${o.company_name}`,
      `Hej ${r.name}\n\nDu har endnu ikke valgt din gave fra ${o.company_name}.\n\nVælg her: ${link}\n${season?.choose_deadline ? `Fristen er ${dato(season.choose_deadline)}.` : ''}\n\nVenlig hilsen\nGaver For Dig`,
    );
    await q('update recipients set reminded_at = now() where id = $1', [r.id]);
  }
  return rows.length;
}

function handoffCode() {
  return 'GFD-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Lukker vælgeperioden for alle ordrer, hvis frist er udløbet (eller alle ordrer i sæsonen med force):
// tildeler standardgave til dem der ikke har valgt, og laver én afleveringsseddel pr. butik.
export async function closeChoosing(seasonId: number, actor: string, force = false) {
  const due = await q<{ id: number }>(
    `select o.id from gift_orders o join seasons s on s.id = o.season_id
      where o.season_id = $1 and o.status in ('confirmed','invited')
        and not exists (select 1 from purchases hp where hp.id = o.purchase_id and hp.hold)
        and ($2 or coalesce(o.choose_deadline, s.choose_deadline) < now())`,
    [seasonId, force],
  );
  const ids = due.map((d) => d.id);
  if (ids.length === 0) return { orders: 0, defaults: 0, handoffs: 0, noDefault: 0 };
  const defaults = await q<{ id: number }>(
    `update recipients r set chosen_product_id = o.default_product_id, chosen_at = now(), is_default = true
       from gift_orders o
      where r.order_id = o.id and o.id = any($1::int[]) and r.chosen_product_id is null and r.donation_to is null and o.default_product_id is not null
      returning r.id`,
    [ids],
  );
  const noDefault = (await one<{ n: number }>('select count(*)::int as n from recipients where order_id = any($1::int[]) and chosen_product_id is null and donation_to is null', [ids]))!.n;
  await q(`update gift_orders set status = 'closed' where id = any($1::int[])`, [ids]);

  const dropDays = Number(await getSetting('aflevering_dage_foer')) || 5;
  const shops = await q<{ shop_id: number; name: string; email: string | null; n: number; first_delivery: Date | null }>(
    `select p.shop_id, s.name, s.email, count(*)::int as n, min(o.delivery_date) as first_delivery
       from recipients r join products p on p.id = r.chosen_product_id
       join gift_orders o on o.id = r.order_id join shops s on s.id = p.shop_id
      where o.id = any($1::int[]) and r.handoff_id is null
      group by p.shop_id, s.name, s.email`,
    [ids],
  );
  const season = await one<Season>('select * from seasons where id = $1', [seasonId]);
  for (const s of shops) {
    let dropoff: Date | null = season?.dropoff_deadline ? new Date(season.dropoff_deadline) : null;
    if (s.first_delivery) {
      dropoff = new Date(s.first_delivery);
      dropoff.setUTCDate(dropoff.getUTCDate() - dropDays);
      dropoff.setUTCHours(14, 0, 0, 0); // kl. 16 dansk vintertid
    }
    const h = await one<{ id: number; code: string }>(
      'insert into handoffs (shop_id, season_id, code, dropoff_deadline) values ($1,$2,$3,$4) returning id, code',
      [s.shop_id, seasonId, handoffCode(), dropoff],
    );
    await q(
      `update recipients r set handoff_id = $1 from products p
        where p.id = r.chosen_product_id and p.shop_id = $2 and r.order_id = any($3::int[]) and r.handoff_id is null`,
      [h!.id, s.shop_id, ids],
    );
    if (s.email) {
      await sendMail(
        s.email,
        `Gaver til aflevering: ${s.n} stk.`,
        `Hej ${s.name}\n\nMedarbejderne har valgt, og I skal levere ${s.n} gaver til logistikcentralen.\nAfleveringsfrist: ${datoTid(dropoff)}\n\nSe listen og print afleveringssedlen i butiksportalen: ${appUrl()}/butik\n\nVenlig hilsen\nGaver For Dig`,
      );
    }
  }
  await logEvent(actor, 'season', seasonId, 'vælgeperiode lukket', `${ids.length} ordrer, ${defaults.length} standardgaver, ${shops.length} afleveringssedler, ${noDefault} uden gave`);
  return { orders: ids.length, defaults: defaults.length, handoffs: shops.length, noDefault };
}

export async function getSetting(key: string): Promise<string> {
  return (await one<{ value: string }>('select value from settings where key = $1', [key]))?.value ?? '';
}
