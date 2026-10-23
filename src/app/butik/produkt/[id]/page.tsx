import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Notice, Shell } from '@/components/ui';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, images, int, kr, KINDS, str } from '@/lib/format';
import { categories, getProduct, PRODUCT_STATUS } from '@/lib/gifts';
import { sendMail } from '@/lib/mail';
import { saveImage } from '@/lib/storage';
import { shopNav } from '../../nav';
import { myShop } from '../../shop';

async function save(fd: FormData) {
  'use server';
  const { u, shop } = await myShop(String(fd.get('butik') ?? ''));
  const id = String(fd.get('id'));
  const isNew = id === 'ny';
  const existing = isNew ? undefined : await getProduct(Number(id));
  if (!isNew && (!existing || existing.shop_id !== shop.id)) redirect('/butik/produkter');
  const intent = String(fd.get('intent'));
  const back = (msg: string) => redirect(`/butik/produkt/${isNew ? 'ny' : id}?butik=${shop.id}&m=${encodeURIComponent(msg)}`);

  // Billeder: behold dem der ikke er markeret til sletning, tilføj nye
  let imgs = images(existing?.images).filter((src) => !fd.getAll('remove').includes(src));
  for (const f of fd.getAll('images')) {
    if (f instanceof File && f.size > 0) {
      try {
        imgs.push(await saveImage(f));
      } catch (e) {
        back('!' + (e as Error).message);
      }
    }
  }
  imgs = imgs.slice(0, 5);

  const name = str(fd, 'name').slice(0, 60);
  const description = str(fd, 'description').slice(0, 1000);
  const kind = str(fd, 'kind');
  const catId = int(fd, 'category');
  const normal = int(fd, 'normal_price');
  const stock = Math.max(0, int(fd, 'stock') ?? 0);
  const alcohol = fd.get('alcohol') === 'ja';
  if (!name) back('!Produktet skal have et navn');

  let status = existing?.status ?? 'draft';
  if (intent === 'submit') {
    const cats = await categories();
    const cat = cats.find((c) => c.id === catId);
    const problems: string[] = [];
    if (imgs.length === 0) problems.push('mindst ét billede');
    if (description.length < 120) problems.push('en beskrivelse på mindst 120 tegn');
    if (!(KINDS as readonly string[]).includes(kind)) problems.push('en kategori');
    if (!cat) problems.push('en priskategori');
    if (cat && (normal == null || normal < Math.round(cat.value_kr * 1.25))) problems.push(`en normal udsalgspris på mindst ${kr(Math.round(cat.value_kr * 1.25))} inkl. moms`);
    if (stock < 1) problems.push('et lager på mindst 1');
    if (fd.get('wrapped') !== 'ja') problems.push('bekræftelse af gaveindpakning');
    if (kind === 'Mad og drikke' && fd.get('shelf') !== 'ja') problems.push('bekræftelse af holdbarhed');
    if (problems.length) {
      // Gem alligevel som kladde, så intet går tabt
      status = existing?.status === 'approved' ? 'pending' : 'draft';
      const pid = await persist();
      redirect(
        `/butik/produkt/${pid}?butik=${shop.id}&m=${encodeURIComponent('!Gemt som kladde. Før produktet kan sendes til godkendelse mangler: ' + problems.join(', ') + '.')}`,
      );
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
  redirect(`/butik/produkter?butik=${shop.id}&m=${encodeURIComponent(status === 'pending' ? `${name} er sendt til godkendelse. Vi svarer inden for 2 hverdage.` : `${name} er gemt som kladde.`)}`);

  async function persist(): Promise<number> {
    if (isNew) {
      const r = await one<{ id: number }>(
        `insert into products (shop_id, name, description, kind, price_category_id, normal_price_kr, stock, alcohol, images, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [shop.id, name, description, kind || KINDS[0], catId, normal, stock, alcohol, JSON.stringify(imgs), status],
      );
      return r!.id;
    }
    await q(
      `update products set name=$1, description=$2, kind=$3, price_category_id=$4, normal_price_kr=$5, stock=$6, alcohol=$7, images=$8,
              status=$9, review_note = case when $9 = 'pending' then null else review_note end, updated_at = now()
        where id = $10`,
      [name, description, kind || KINDS[0], catId, normal, stock, alcohol, JSON.stringify(imgs), status, Number(id)],
    );
    return Number(id);
  }
}

export default async function ProductGuide({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ butik?: string; m?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { shop, shops } = await myShop(sp.butik);
  const p = id === 'ny' ? undefined : await getProduct(Number(id));
  if (id !== 'ny' && (!p || p.shop_id !== shop.id)) notFound();
  const cats = await categories();
  const q0 = shops ? `?butik=${shop.id}` : '';
  const imgs = images(p?.images);

  return (
    <Shell area={`Butik · ${shop.name}`} nav={shopNav.map((n) => ({ ...n, href: n.href + q0 }))}>
      <div className="split">
        <div className="main card">
          <form action={save} className="form">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="butik" value={shop.id} />
            <div className="row between">
              <div>
                <div className="eyebrow">{p ? 'Ret produkt' : 'Opret produkt'} · ca. 10 minutter</div>
                <h1 style={{ fontSize: 28 }}>{p?.name ?? 'Nyt produkt'}</h1>
              </div>
              {p && <Badge tone={p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'bad' : 'warn'}>{PRODUCT_STATUS[p.status]}</Badge>}
            </div>
            <Notice msg={sp.m} />
            {p?.status === 'rejected' && p.review_note && <div className="alert bad">Besked fra Gaver For Dig: {p.review_note}</div>}
            {p?.status === 'approved' && <div className="alert warn">Produktet er godkendt. Gemmer du ændringer, skal det godkendes igen.</div>}
            <ol className="steps" aria-label="Trin">
              <li className="on">1 · Billeder</li>
              <li className="on">2 · Tekst</li>
              <li className="on">3 · Priskategori</li>
              <li className="on">4 · Lager og levering</li>
            </ol>

            <section className="section">
              <h2>1 · Billeder</h2>
              <div className="req">
                <b>Krav</b>
                <ul>
                  <li>1–5 billeder, mindst 1200 × 1200 px, JPG eller PNG</li>
                  <li>Lys, rolig baggrund, og hele produktet skal kunne ses</li>
                  <li>Første billede bliver hovedbillede</li>
                </ul>
              </div>
              {imgs.length > 0 && (
                <div className="row">
                  {imgs.map((src, i) => (
                    <label key={src} className="stack-s small" style={{ width: 120 }}>
                      <img src={src} alt={`Billede ${i + 1}`} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                      <span className="check">
                        <input type="checkbox" name="remove" value={src} /> Fjern
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="field">
                <label htmlFor="images">Tilføj billeder</label>
                <input id="images" name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple />
              </div>
            </section>

            <section className="section">
              <h2>2 · Tekst</h2>
              <div className="field">
                <label htmlFor="name">Produktnavn</label>
                <input id="name" name="name" type="text" maxLength={60} defaultValue={p?.name} required placeholder="Fx Trækasse med tre italienske vine" />
                <span className="hint">Maks. 60 tegn. Beskrivende, uden pris og uden ordet &quot;tilbud&quot;.</span>
              </div>
              <div className="field">
                <label htmlFor="description">Beskrivelse</label>
                <textarea id="description" name="description" maxLength={1000} defaultValue={p?.description} style={{ minHeight: 160 }} />
                <span className="hint">Mindst 120, gerne 300–800 tegn. Skriv tre korte afsnit: Hvad er det? Hvorfor er det godt? Hvad er der i pakken?</span>
              </div>
              <div className="field">
                <label htmlFor="kind">Kategori</label>
                <select id="kind" name="kind" defaultValue={p?.kind ?? KINDS[0]}>
                  {KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className="section">
              <h2>3 · Priskategori</h2>
              <div className="req">Vælg den prisgruppe, der passer til varens normale udsalgspris i din butik (inkl. moms). Medarbejderne ser ingen priser.</div>
              <div className="grid-2">
                {cats.map((c) => (
                  <label key={c.id} className="check card" style={{ padding: 12 }}>
                    <input type="radio" name="category" value={c.id} defaultChecked={p?.price_category_id === c.id} />
                    <span>
                      <b>{kr(c.value_kr)}</b> ekskl. moms · {kr(Math.round(c.value_kr * 1.25))} inkl.
                    </span>
                  </label>
                ))}
              </div>
              <div className="field">
                <label htmlFor="normal_price">Normal udsalgspris i butikken (kr. inkl. moms)</label>
                <input id="normal_price" name="normal_price" type="number" min={0} defaultValue={p?.normal_price_kr ?? ''} />
                <span className="hint">Skal være mindst kategoriens beløb inkl. moms.</span>
              </div>
            </section>

            <section className="section">
              <h2>4 · Lager og levering</h2>
              <div className="field">
                <label htmlFor="stock">Hvor mange kan du levere i sæsonen?</label>
                <input id="stock" name="stock" type="number" min={0} defaultValue={p?.stock ?? ''} />
                <span className="hint">Produktet skjules automatisk for medarbejderne, når antallet er valgt.</span>
              </div>
              <label className="check">
                <input type="checkbox" name="alcohol" value="ja" defaultChecked={p?.alcohol} />
                <span>Varen indeholder alkohol (vises kun for medarbejdere, der bekræfter at være fyldt 18 år)</span>
              </label>
              <label className="check">
                <input type="checkbox" name="wrapped" value="ja" defaultChecked={!!p && p.status !== 'draft'} />
                <span>Jeg afleverer varen gaveindpakket eller i gaveemballage, klar til navnemærkat</span>
              </label>
              <label className="check">
                <input type="checkbox" name="shelf" value="ja" defaultChecked={!!p && p.status !== 'draft'} />
                <span>Mad og drikke: varen holder mindst 3 måneder ved aflevering og skal ikke på køl</span>
              </label>
            </section>

            <div className="row">
              <button className="btn" type="submit" name="intent" value="submit">
                Send til godkendelse
              </button>
              <button className="btn outline" type="submit" name="intent" value="draft">
                Gem kladde
              </button>
              <Link href={`/butik/produkter${q0}`}>Annullér</Link>
            </div>
          </form>
        </div>
        <aside className="side">
          <div className="card stack-s">
            <h2>Godt at vide</h2>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Vi godkender inden for 2 hverdage.</li>
              <li>Afviser vi et produkt, får du en konkret besked om, hvad der skal rettes.</li>
              <li>Du afleverer kun det, der rent faktisk er valgt.</li>
              <li>Oplevelser leveres som fysisk gavebevis med navn, gyldigt i mindst 12 måneder.</li>
            </ul>
            <Link href={`/butik/hjaelp${q0}`} className="small">
              Se guiden til gode produktbilleder
            </Link>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
