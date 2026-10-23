'use server';

import { redirect } from 'next/navigation';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, images, int, kr, KINDS, str } from '@/lib/format';
import { categories, getProduct } from '@/lib/gifts';
import { sendMail } from '@/lib/mail';
import { saveImage } from '@/lib/storage';
import { myShop } from '../../shop';

export async function saveProduct(fd: FormData) {
  const { u, shop } = await myShop(String(fd.get('butik') ?? ''));
  const id = String(fd.get('id'));
  const isNew = id === 'ny';
  const existing = isNew ? undefined : await getProduct(Number(id));
  if (!isNew && (!existing || existing.shop_id !== shop.id)) redirect('/butik/produkter');
  const intent = String(fd.get('intent'));
  const back = (msg: string) => redirect(`/butik/produkt/${isNew ? 'ny' : id}?butik=${shop.id}&m=${encodeURIComponent(msg)}`);

  // Billeder i den rækkefølge, butikken har valgt: eksisterende URL'er og "#n" for det n'te nye billede
  const old = images(existing?.images);
  const uploaded: string[] = [];
  for (const f of fd.getAll('images')) {
    if (f instanceof File && f.size > 0) {
      try {
        uploaded.push(await saveImage(f));
      } catch (e) {
        back('!' + (e as Error).message);
      }
    }
  }
  let order: string[] = [];
  try {
    const o = JSON.parse(str(fd, 'order') || '[]');
    if (Array.isArray(o)) order = o.map(String);
  } catch {}
  const all = order
    .map((x) => (x.startsWith('#') ? uploaded[Number(x.slice(1))] : old.includes(x) ? x : undefined))
    .filter((x): x is string => !!x)
    .slice(0, 5);

  const name = str(fd, 'name').slice(0, 60);
  const description = str(fd, 'description').slice(0, 1000);
  const kind = str(fd, 'kind');
  const catId = int(fd, 'category');
  const normal = int(fd, 'normal_price');
  const stock = Math.max(0, int(fd, 'stock') ?? 0);
  const alcohol = fd.get('alcohol') === 'ja';
  const food = kind === 'Mad og drikke';
  const ingredients = food ? str(fd, 'ingredients').slice(0, 2000) || null : null;
  const netContent = food ? str(fd, 'net_content').slice(0, 60) || null : null;
  const wrapOk = fd.get('wrapped') === 'ja';
  const shelfOk = fd.get('shelf') === 'ja';
  if (!name) back('!Produktet skal have et navn');

  let status = existing?.status ?? 'draft';
  if (intent === 'submit') {
    const cats = await categories();
    const cat = cats.find((c) => c.id === catId);
    const problems: string[] = [];
    if (all.length === 0) problems.push('mindst ét billede');
    if (description.length < 120) problems.push('en beskrivelse på mindst 120 tegn');
    if (!(KINDS as readonly string[]).includes(kind)) problems.push('en kategori');
    if (!cat) problems.push('en prisgruppe');
    if (cat && (normal == null || normal < Math.round(cat.value_kr * 1.25))) problems.push(`en normal udsalgspris på mindst ${kr(Math.round(cat.value_kr * 1.25))} inkl. moms`);
    if (stock < 1) problems.push('et antal på mindst 1');
    if (!wrapOk) problems.push('bekræftelse af gaveemballage');
    if (food && !shelfOk) problems.push('bekræftelse af holdbarhed');
    if (problems.length) {
      // Gem alligevel som kladde, så intet går tabt
      status = existing?.status === 'approved' ? 'pending' : existing?.status === 'paused' ? 'paused' : 'draft';
      const pid = await persist();
      redirect(`/butik/produkt/${pid}?butik=${shop.id}&m=${encodeURIComponent('!Gemt som kladde. Før produktet kan sendes til godkendelse mangler: ' + problems.join(', ') + '.')}`);
    }
    status = 'pending';
  } else if (existing?.status === 'approved' || existing?.status === 'pending') {
    status = 'pending'; // ændringer på et godkendt produkt skal godkendes igen
  }
  const savedId = await persist();
  await logEvent(u.email, 'product', savedId, intent === 'submit' ? 'sendt til godkendelse' : 'gemt', name);
  if (status === 'pending' && existing?.status !== 'pending') {
    const admins = await q<{ email: string }>(`select email from users where role = 'admin'`);
    for (const a of admins) await sendMail(a.email, `Produkt til godkendelse: ${name}`, `${shop.name}: ${name}\n\nGodkend her: ${appUrl()}/admin/godkend`);
  }
  redirect(
    `/butik/produkter?butik=${shop.id}&m=${encodeURIComponent(status === 'pending' ? `${name} er sendt til godkendelse. Vi svarer inden for 2 hverdage.` : `${name} er gemt som kladde.`)}`,
  );

  async function persist(): Promise<number> {
    if (isNew) {
      const r = await one<{ id: number }>(
        `insert into products (shop_id, name, description, kind, price_category_id, normal_price_kr, stock, alcohol, images, status, ingredients, net_content, wrap_ok, shelf_ok)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
        [shop.id, name, description, kind, catId, normal, stock, alcohol, JSON.stringify(all), status, ingredients, netContent, wrapOk, shelfOk],
      );
      return r!.id;
    }
    await q(
      `update products set name=$1, description=$2, kind=$3, price_category_id=$4, normal_price_kr=$5, stock=$6, alcohol=$7, images=$8,
              status=$9, review_note = case when $9 = 'pending' then null else review_note end, updated_at = now(),
              ingredients=$11, net_content=$12, wrap_ok=$13, shelf_ok=$14
        where id = $10`,
      [name, description, kind, catId, normal, stock, alcohol, JSON.stringify(all), status, Number(id), ingredients, netContent, wrapOk, shelfOk],
    );
    return Number(id);
  }
}

// Pause, genaktivér, kopiér eller slet et produkt fra produktlisten
export async function productAction(fd: FormData) {
  const { u, shop } = await myShop(String(fd.get('butik') ?? ''));
  const p = await getProduct(Number(fd.get('id')));
  const back = (m: string) => redirect(`/butik/produkter?butik=${shop.id}&m=${encodeURIComponent(m)}`);
  if (!p || p.shop_id !== shop.id) back('!Produktet findes ikke');
  const what = String(fd.get('what'));
  if (what === 'pause' && p!.status === 'approved') {
    await q(`update products set status = 'paused', updated_at = now() where id = $1`, [p!.id]);
    await logEvent(u.email, 'product', p!.id, 'sat på pause');
    back(`${p!.name} er sat på pause og vises ikke for medarbejderne`);
  }
  if (what === 'resume' && p!.status === 'paused') {
    await q(`update products set status = 'approved', updated_at = now() where id = $1`, [p!.id]);
    await logEvent(u.email, 'product', p!.id, 'genaktiveret');
    back(`${p!.name} er aktiv igen`);
  }
  if (what === 'copy') {
    const r = await one<{ id: number }>(
      `insert into products (shop_id, name, description, kind, price_category_id, normal_price_kr, stock, alcohol, images, status, ingredients, net_content, wrap_ok, shelf_ok)
       select shop_id, left('Kopi af ' || name, 60), description, kind, price_category_id, normal_price_kr, stock, alcohol, images, 'draft', ingredients, net_content, wrap_ok, shelf_ok
         from products where id = $1
       returning id`,
      [p!.id],
    );
    redirect(`/butik/produkt/${r!.id}?butik=${shop.id}&m=${encodeURIComponent('Kopien er oprettet som kladde – ret den til og send den til godkendelse')}`);
  }
  if (what === 'delete') {
    if (p!.chosen > 0) back('!Produktet er allerede valgt af medarbejdere og kan ikke slettes. Sæt det på pause i stedet.');
    await q('delete from products where id = $1', [p!.id]);
    await logEvent(u.email, 'product', p!.id, 'slettet', p!.name);
    back(`${p!.name} er slettet`);
  }
  back('!Handlingen kunne ikke udføres');
}
