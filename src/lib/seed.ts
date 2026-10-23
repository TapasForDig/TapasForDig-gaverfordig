import crypto from 'node:crypto';
import type { Driver } from './db';

function hash(pw: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
const tok = () => crypto.randomBytes(24).toString('base64url');
const inDays = (n: number) => new Date(Date.now() + n * 86400000);

// Fylder en tom database med demo-data, så alle portaler kan prøves med det samme.
// Slås fra med NO_DEMO=1 (så oprettes kun en admin ud fra ADMIN_EMAIL / ADMIN_PASSWORD).
// Opretter admin fra ADMIN_EMAIL / ADMIN_PASSWORD, hvis den ikke findes
async function ensureAdmin(d: Driver) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD?.trim();
  if (!email || !pw) return;
  const u = (await d.query<{ id: number; password_hash: string }>('select id, password_hash from users where email = $1', [email])).rows[0];
  // Kun oprettelse her (billigt). Passer koden ikke, retter login-siden den, når man logger ind med koden fra Vercel.
  if (!u) {
    await d.query(`insert into users (email, password_hash, name, role) values ($1,$2,'Admin','admin') on conflict (email) do nothing`, [email, hash(pw)]);
  }
}

// Prisgrupper 2026: pris pr. medarbejder ekskl. moms
const PRICE_GROUPS: [number, string][] = [
  [300, 'Skattefri julegave'],
  [500, 'Skattefri julegave'],
  [600, 'Skattefri julegave'],
  [800, 'Højeste skattefri julegave (1.000 kr. inkl. moms)'],
  [1100, 'Kun skattefri, hvis medarbejderen ikke får andre gaver i året (1.375 kr. inkl. moms)'],
];

const DEFAULT_SETTINGS: [string, string][] = [
  ['indkoebsrabat_pct', ''],
  ['forudbetaling_graense_kr', '10000'],
  ['logistik_adresse', '[Adresse på logistikcentralen], Brørup'],
  ['gebyr_hjemlevering_kr', '75'],
  ['indpakning_kr', '30'],
  ['min_antal', '5'],
  ['leveringsuge_fra', '46'],
  ['leveringsuge_til', '51'],
  ['leveringsuger_lukket', '52,53'],
  ['vaelgefrist_dage_foer', '19'],
  ['aflevering_dage_foer', '5'],
];

// Engangsændringer på eksisterende databaser
export async function migrate(d: Driver) {
  await d.query(
    `insert into settings (key, value) values ${DEFAULT_SETTINGS.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',')} on conflict do nothing`,
    DEFAULT_SETTINGS.flat(),
  );
  // Prisgrupper v2: 300/500/600/800/1100 ekskl. moms (tidligere 300/500/750/1000/1400 inkl. moms)
  const claim = await d.query(`insert into settings (key, value) values ('prisgrupper_v2', now()::text) on conflict (key) do nothing returning key`);
  if (claim.rows.length === 0) return;
  const old = (await d.query<{ id: number }>('select id from price_categories order by sort, value_kr')).rows;
  for (let i = 0; i < PRICE_GROUPS.length; i++) {
    const [value, note] = PRICE_GROUPS[i];
    if (old[i]) {
      await d.query('update price_categories set name = $1, value_kr = $2, note = $3, sort = $4 where id = $5', [`${value} kr.`, value, note, i, old[i].id]);
    } else {
      await d.query('insert into price_categories (name, value_kr, note, sort) values ($1,$2,$3,$4)', [`${value} kr.`, value, note, i]);
    }
  }
}

export async function seedIfEmpty(d: Driver) {
  await ensureAdmin(d);

  // Kun én server må lave grunddata, og kun én gang (flere Vercel-instanser kan starte samtidig)
  const claim = await d.query(`insert into settings (key, value) values ('seeded', now()::text) on conflict (key) do nothing returning key`);
  if (claim.rows.length === 0) return;
  // Databaser fra før denne markør, der allerede er i brug → spring over
  const existing = await d.query<{ n: number }>('select (select count(*) from shops) + (select count(*) from companies) as n');
  if (Number(existing.rows[0].n) > 0) return;

  const ins = async <T = { id: number }>(sql: string, p: unknown[]) => (await d.query<T>(sql, p)).rows[0];

  if (process.env.NO_DEMO === '1') {
    await seedCategories(d);
    return;
  }

  const season = await ins(
    `insert into seasons (name, order_deadline, choose_deadline, dropoff_deadline, delivery_from)
     values ('Jul 2026', $1, $2, $3, $4) returning id`,
    [inDays(28), inDays(40), inDays(44), inDays(47)],
  );
  const cats = await seedCategories(d);

  const shop = (name: string, town: string, story: string, status = 'approved') =>
    ins(`insert into shops (name, town, address, story, status, contact_name, email, phone) values ($1,$2,$3,$4,$5,'[Kontaktperson]',$6,'[Telefon]') returning id`, [
      name,
      town,
      `[Adresse], ${town}`,
      story,
      status,
      `kontakt@${name.toLowerCase().replace(/[^a-z]/g, '')}.dk`,
    ]);
  const vfd = await shop('Vin For Dig', 'Brørup', 'Vinhandel i Brørup siden 2014. Egenimport fra Italien, Frankrig og Spanien.');
  const tfd = await shop('Tapas For Dig', 'Brørup', 'Tapas og delikatesser fra små producenter i Sydeuropa.');
  const inter = await shop('Demobutik Interiør', 'Vejen', 'Eksempelbutik til test af portalen.');
  const blom = await shop('Demobutik Blomster', 'Rødding', 'Eksempelbutik til test af portalen.');
  const wel = await shop('Demobutik Velvære', 'Holsted', 'Eksempelbutik til test af portalen.');
  await shop('Ny butik (afventer godkendelse)', 'Vejen', 'Eksempel på en butik, der har søgt om at blive med.', 'pending');

  const prod = (shopId: number, name: string, desc: string, kind: string, cat: number, stock: number, alcohol = false, status = 'approved') =>
    ins(
      `insert into products (shop_id, name, description, kind, price_category_id, stock, alcohol, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [shopId, name, desc, kind, cat, stock, alcohol, status],
    );
  const p1 = await prod(vfd.id, 'Trækasse med tre italienske vine', 'Egenimporteret rødvin, hvidvin og bobler, udvalgt til julebordet. Leveres i trækasse med gavebånd.', 'Mad og drikke', cats[800], 60, true);
  const p2 = await prod(tfd.id, 'Delikatessekurv med tapas-favoritter', 'Charcuteri, oste, oliven og pesto fra små producenter i Sydeuropa. Holdbar i mindst 3 måneder.', 'Mad og drikke', cats[800], 50);
  const p3 = await prod(inter.id, 'Lysestager i messing (demo)', 'Eksempelprodukt. Butikken skriver selv 2–3 linjer om varen her.', 'Bolig', cats[800], 20);
  const p4 = await prod(blom.id, 'Juledekoration med gavekort til påfyld (demo)', 'Eksempelprodukt. Butikken skriver selv 2–3 linjer om varen her.', 'Bolig', cats[800], 25);
  const p5 = await prod(wel.id, 'Gavebevis på behandling (demo)', 'Eksempelprodukt. Leveres som fysisk gavebevis med navn, gyldigt i 12 måneder.', 'Oplevelser', cats[800], 15);
  await prod(vfd.id, 'To flasker rødvin i gaveæske', 'To fyldige rødvine fra Sydeuropa i gaveæske.', 'Mad og drikke', cats[500], 80, true);
  await prod(tfd.id, 'Lille delikatessegave', 'Pesto, oliven og kiks fra vores egenimport.', 'Mad og drikke', cats[300], 80);
  await prod(inter.id, 'Plaid i uld (demo)', 'Eksempelprodukt. Venter på godkendelse.', 'Bolig', cats[800], 10, false, 'pending');

  // Demo: fødevareoplysninger på mad og drikke
  await d.query(
    `update products set ingredients = case when alcohol then 'Vin: druer, SULFITTER.' else 'Pesto: basilikum, olivenolie, PINJEKERNER, PARMESAN (MÆLK), hvidløg, salt. Oliven: grønne oliven, vand, salt. Kiks: HVEDEMEL, smør (MÆLK), sukker, salt.' end,
            net_content = case when alcohol then '3 × 75 cl' else 'ca. 600 g' end
      where kind = 'Mad og drikke'`,
  );

  const company = await ins(
    `insert into companies (name, cvr, address, town, contact_name, phone, email) values
     ('Demovirksomhed A/S','[CVR]','[Adresse]','Vejen','[Kontaktperson]','[Telefon]','virksomhed@demo.dk') returning id`,
    [],
  );
  const order = await ins(
    `insert into gift_orders (company_id, season_id, price_category_id, title, greeting, default_product_id, status,
       delivery_address, delivery_contact, confirmed_at, invited_at)
     values ($1,$2,$3,'Julegave 2026','Tak for en stærk indsats i år. Vælg den gave, der passer dig bedst – glædelig jul!',$4,'invited',
       '[Leveringsadresse], Vejen','[Kontaktperson, telefon]', now(), now()) returning id`,
    [company.id, season.id, cats[800], p1.id],
  );
  const depts = ['Salg', 'Lager', 'Administration', 'Produktion'];
  const picks = [p1.id, p2.id, p3.id, p1.id, p4.id, p5.id, p2.id];
  for (let i = 1; i <= 12; i++) {
    const chosen = i <= picks.length ? picks[i - 1] : null;
    await d.query(
      `insert into recipients (order_id, name, email, department, token, invited_at, opened_at, chosen_product_id, chosen_at, age_confirmed)
       values ($1,$2,$3,$4,$5, now(), $6, $7, $8, $9)`,
      [order.id, `Medarbejder ${i}`, `medarbejder${i}@demo.dk`, depts[i % 4], tok(), i <= 10 ? new Date() : null, chosen, chosen ? new Date() : null, chosen === p1.id],
    );
  }

  const user = (email: string, name: string, role: string, shopId: number | null, companyId: number | null) =>
    d.query(`insert into users (email, password_hash, name, role, shop_id, company_id) values ($1,$2,$3,$4,$5,$6)`, [
      email,
      hash('demo1234'),
      name,
      role,
      shopId,
      companyId,
    ]);
  await user('admin@demo.dk', 'Admin', 'admin', null, null);
  await user('butik@demo.dk', 'Vin For Dig', 'butik', vfd.id, null);
  await user('interior@demo.dk', 'Demobutik Interiør', 'butik', inter.id, null);
  await user('virksomhed@demo.dk', 'Demovirksomhed A/S', 'virksomhed', null, company.id);
  await user('logistik@demo.dk', 'Logistikcentral', 'logistik', null, null);
}

async function seedCategories(d: Driver): Promise<Record<number, number>> {
  const map: Record<number, number> = {};
  const existing = (await d.query<{ id: number; value_kr: number }>('select id, value_kr from price_categories')).rows;
  if (existing.length) {
    for (const c of existing) map[c.value_kr] = c.id;
    return map;
  }
  let sort = 0;
  for (const [value, note] of PRICE_GROUPS) {
    const r = await d.query<{ id: number }>('insert into price_categories (name, value_kr, note, sort) values ($1,$2,$3,$4) returning id', [
      `${value} kr.`,
      value,
      note,
      sort++,
    ]);
    map[value] = r.rows[0].id;
  }
  return map;
}
