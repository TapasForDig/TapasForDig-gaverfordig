'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FoodInfo } from '@/components/FoodInfo';

interface Props {
  action: (fd: FormData) => Promise<void>;
  id: string;
  butik: number;
  shopName: string;
  shopTown: string | null;
  kinds: readonly string[];
  groups: { id: number; value: number }[];
  backHref: string;
  contact: { phone: string; email: string };
  product?: {
    ingredients: string | null;
    net_content: string | null;
    name: string;
    description: string;
    kind: string;
    price_category_id: number | null;
    normal_price_kr: number | null;
    stock: number;
    alcohol: boolean;
    images: string[];
    wrap_ok: boolean;
    shelf_ok: boolean;
  };
}

interface Item {
  src: string; // eksisterende URL eller lokal forhåndsvisning
  file?: File; // kun nye billeder
  small?: boolean;
}

const MAX_SIDE = 1600;
const incl = (v: number) => Math.round(v * 1.25);
const kr = (n: number) => `${n.toLocaleString('da-DK')} kr.`;

// Gør telefonbilleder mindre i browseren, så upload ikke rammer Vercels grænse på 4,5 MB
async function shrink(file: File): Promise<Item> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Billedet kunne ikke læses'))), 'image/jpeg', 0.85));
  const out = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  return { file: out, src: URL.createObjectURL(blob), small: Math.min(bmp.width, bmp.height) < 1200 };
}

export default function ProductForm(props: Props) {
  const p = props.product;
  const [name, setName] = useState(p?.name ?? '');
  const [desc, setDesc] = useState(p?.description ?? '');
  const [kind, setKind] = useState(p?.kind && props.kinds.includes(p.kind) ? p.kind : '');
  const [cat, setCat] = useState<number | null>(p?.price_category_id ?? null);
  const [price, setPrice] = useState(p?.normal_price_kr ? String(p.normal_price_kr) : '');
  const [ingredients, setIngredients] = useState(p?.ingredients ?? '');
  const [netContent, setNetContent] = useState(p?.net_content ?? '');
  const food = kind === 'Mad og drikke';
  const [items, setItems] = useState<Item[]>((p?.images ?? []).map((src) => ({ src })));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const fileField = useRef<HTMLInputElement>(null);

  // Hold det skjulte filfelt (det der sendes med formularen) i takt med de valgte billeder
  useEffect(() => {
    if (!fileField.current) return;
    const dt = new DataTransfer();
    items.forEach((it) => it.file && dt.items.add(it.file));
    fileField.current.files = dt.files;
  }, [items]);

  const total = items.length;
  const main = items[0]?.src;
  // Rækkefølge til serveren: eksisterende URL'er og "#n" for det n'te nye billede
  let n = 0;
  const order = items.map((it) => (it.file ? `#${n++}` : it.src));

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    const room = 5 - total;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setErr(`Du kan højst have 5 billeder – ${files.length - room} blev ikke tilføjet.`);
    setBusy('Gør billederne klar …');
    try {
      const done: Item[] = [];
      for (const f of list) {
        if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) && !/\.(jpe?g|png|webp|heic)$/i.test(f.name)) {
          setErr('Kun billeder (JPG, PNG eller WEBP).');
          continue;
        }
        done.push(await shrink(f));
      }
      setItems((a) => [...a, ...done]);
    } catch {
      setErr('Et af billederne kunne ikke læses. Prøv at gemme det som JPG og vælg det igen.');
    } finally {
      setBusy('');
    }
  };

  const makeMain = (src: string) => setItems((a) => [a.find((x) => x.src === src)!, ...a.filter((x) => x.src !== src)]);
  const remove = (src: string) => setItems((a) => a.filter((x) => x.src !== src));

  const priceNum = Number(price) || 0;
  const suggestion = useMemo(() => [...props.groups].filter((g) => incl(g.value) <= priceNum).sort((a, b) => b.value - a.value)[0], [props.groups, priceNum]);
  const chosen = props.groups.find((g) => g.id === cat);
  const priceWarn = chosen && priceNum > 0 && priceNum < incl(chosen.value);
  useEffect(() => {
    if (cat == null && suggestion) setCat(suggestion.id);
  }, [suggestion, cat]);

  const checks = [
    [total > 0, 'Mindst ét billede'],
    [name.trim().length > 0, 'Produktnavn'],
    [desc.trim().length >= 120, `Beskrivelse på mindst 120 tegn (${desc.trim().length})`],
    [!!kind, 'Kategori'],
    [!!chosen && !priceWarn && priceNum > 0, 'Prisgruppe og udsalgspris'],
  ] as const;

  return (
    <div className="split">
      <form action={props.action} className="main card form" onSubmit={() => setBusy('Gemmer …')}>
        <input type="hidden" name="id" value={props.id} />
        <input type="hidden" name="butik" value={props.butik} />
        <input type="hidden" name="order" value={JSON.stringify(order)} />
        <input ref={fileField} type="file" name="images" multiple hidden tabIndex={-1} aria-hidden="true" />

        <section className="section" style={{ borderTop: 0, paddingTop: 0 }}>
          <h2>1 · Billeder</h2>
          <div className="req">
            Kvadratiske billeder, gerne 1600 × 1600 px (mindst 1200 × 1200), på lys, rolig baggrund, hvor hele gaven kan ses. Tag dem gerne med telefonen – vi gør dem klar
            automatisk. Det første billede er hovedbilledet.{' '}
            <a href="/billedguide" target="_blank">
              Se billedguiden
            </a>
          </div>
          <div className="img-grid">
            {items.map(({ src, small }, i) => (
              <figure key={src} className={`img-tile ${i === 0 ? 'main' : ''}`}>
                <img src={src} alt={`Billede ${i + 1}`} />
                {i === 0 && <span className="badge wine">Hovedbillede</span>}
                {small && <span className="badge warn small-warn">Lille billede</span>}
                <figcaption>
                  {i > 0 && (
                    <button type="button" className="linkbtn small" onClick={() => makeMain(src)}>
                      Gør til hovedbillede
                    </button>
                  )}
                  <button type="button" className="linkbtn small" style={{ color: 'var(--bad)' }} onClick={() => remove(src)}>
                    Fjern
                  </button>
                </figcaption>
              </figure>
            ))}
            {total < 5 && (
              <label className="img-add">
                <input type="file" accept="image/*" multiple onChange={(e) => (pick(e.target.files), (e.target.value = ''))} className="sr-only" />
                <span style={{ fontSize: 32, lineHeight: 1 }}>+</span>
                <span className="small">{total === 0 ? 'Tilføj billeder' : 'Tilføj flere'}</span>
              </label>
            )}
          </div>
          {busy && <p className="small muted">{busy}</p>}
          {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
        </section>

        <section className="section">
          <h2>2 · Tekst</h2>
          <div className="field">
            <label htmlFor="name">Produktnavn</label>
            <input id="name" name="name" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Fx Kande i stentøj fra lokal keramiker" />
            <span className="hint">
              {name.length}/60 tegn. Beskrivende, uden pris og uden ordet &quot;tilbud&quot;.
            </span>
          </div>
          <div className="field">
            <label htmlFor="description">Beskrivelse</label>
            <textarea id="description" name="description" maxLength={1000} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ minHeight: 160 }} />
            <span className="hint">
              <b style={{ color: desc.trim().length >= 120 ? 'var(--ok)' : 'var(--warn)' }}>{desc.trim().length} tegn</b> – mindst 120, gerne 300–800. Skriv tre korte afsnit: Hvad er det? Hvorfor er det
              godt? Hvad er der i pakken?
            </span>
          </div>
          <div className="field">
            <label htmlFor="kind">Kategori</label>
            <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Vælg kategori</option>
              {props.kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          {food && (
            <div className="stack-s food-fields">
              <div className="alert warn">
                Mad og drikke: Hos medarbejderen står der, at gaven pakkes først ved bestilling, og at man kan kontakte Gaver For Dig om allergener. Har du ingrediensliste og
                allergener ved hånden, så skriv dem gerne – men det er ikke et krav.
              </div>
              <div className="field">
                <label htmlFor="ingredients">Ingredienser og allergener (valgfrit)</label>
                <textarea
                  id="ingredients"
                  name="ingredients"
                  maxLength={2000}
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder={'Fx: Pesto: basilikum, olivenolie, PINJEKERNER, PARMESAN (MÆLK), hvidløg, salt.\nOliven: grønne oliven, vand, salt.'}
                  style={{ minHeight: 120 }}
                />
                <span className="hint">Fx de vigtigste allergener i gavekurven. Skriv allergener med STORE BOGSTAVER.</span>
              </div>
              <div className="field">
                <label htmlFor="net_content">Nettoindhold (valgfrit)</label>
                <input id="net_content" name="net_content" type="text" maxLength={60} value={netContent} onChange={(e) => setNetContent(e.target.value)} placeholder="Fx 2 × 75 cl eller 450 g" style={{ maxWidth: 320 }} />
              </div>
            </div>
          )}
        </section>

        <section className="section">
          <h2>3 · Pris</h2>
          <div className="field">
            <label htmlFor="normal_price">Hvad koster varen normalt i din butik? (kr. inkl. moms)</label>
            <input id="normal_price" name="normal_price" type="number" min={0} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} style={{ maxWidth: 220 }} />
            {priceNum > 0 && (
              <span className="hint">
                {suggestion ? (
                  <>
                    Forslag: prisgruppe <b>{kr(suggestion.value)}</b> ekskl. moms ({kr(incl(suggestion.value))} inkl.)
                  </>
                ) : (
                  `Varen skal koste mindst ${kr(incl(Math.min(...props.groups.map((g) => g.value))))} inkl. moms for at passe i en prisgruppe.`
                )}
              </span>
            )}
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 6 }}>
              Prisgruppe
            </legend>
            <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {props.groups.map((g) => (
                <label key={g.id} className={`check card ${cat === g.id ? 'picked' : ''}`} style={{ padding: 12 }}>
                  <input type="radio" name="category" value={g.id} checked={cat === g.id} onChange={() => setCat(g.id)} />
                  <span>
                    <b>{kr(g.value)}</b>
                    <span className="hint" style={{ display: 'block' }}>
                      {kr(incl(g.value))} inkl. moms
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {priceWarn && (
              <span className="hint" style={{ color: 'var(--bad)' }}>
                Udsalgsprisen skal være mindst {kr(incl(chosen!.value))} inkl. moms for denne prisgruppe.
              </span>
            )}
            <span className="hint">Medarbejderne ser ingen priser. Vælg den gruppe, der passer til varens normale pris i butikken.</span>
          </fieldset>
        </section>

        <section className="section">
          <h2>4 · Antal og levering</h2>
          <div className="field">
            <label htmlFor="stock">Hvor mange kan du levere i sæsonen?</label>
            <input id="stock" name="stock" type="number" min={0} inputMode="numeric" defaultValue={p?.stock ?? ''} style={{ maxWidth: 220 }} />
            <span className="hint">Gaven skjules automatisk for medarbejderne, når antallet er valgt.</span>
          </div>
          <label className="check">
            <input type="checkbox" name="alcohol" value="ja" defaultChecked={p?.alcohol} />
            <span>Varen indeholder alkohol (vises kun for medarbejdere, der bekræfter at være fyldt 18 år)</span>
          </label>
          <label className="check">
            <input type="checkbox" name="wrapped" value="ja" defaultChecked={p?.wrap_ok} />
            <span>Varen kan gaveindpakkes. Når kunden har valgt indpakning, pakker du selv ind og får 30 kr. ekstra pr. stk. Ellers afleveres den i egen emballage, så den kan ligge i en mulepose</span>
          </label>
          {kind === 'Mad og drikke' && (
            <label className="check">
              <input type="checkbox" name="shelf" value="ja" defaultChecked={p?.shelf_ok} />
              <span>Varen holder mindst 3 måneder ved aflevering og skal ikke på køl</span>
            </label>
          )}
        </section>

        <div className="row">
          <button className="btn" type="submit" name="intent" value="submit" disabled={!!busy}>
            Send til godkendelse
          </button>
          <button className="btn outline" type="submit" name="intent" value="draft" disabled={!!busy}>
            Gem kladde
          </button>
          <Link href={props.backHref}>Annullér</Link>
        </div>
      </form>

      <aside className="side">
        <div className="card stack-s summary">
          <div className="eyebrow">Sådan ser medarbejderen din gave</div>
          <article className="product" style={{ border: '1px solid var(--line)' }}>
            <div className="img">{main ? <img src={main} alt="" /> : <span>Hovedbillede</span>}</div>
            <div className="body">
              <div className="eyebrow">
                {props.shopName}
                {props.shopTown ? ` · ${props.shopTown}` : ''}
              </div>
              <h3>{name || 'Produktnavn'}</h3>
              <p className="desc">{desc ? (desc.length > 180 ? desc.slice(0, 180) + ' …' : desc) : 'Beskrivelsen vises her.'}</p>
              {food && <FoodInfo ingredients={ingredients || null} netContent={netContent || null} contact={props.contact} compact />}
              <span className="btn outline block" aria-hidden="true">
                Vælg denne gave
              </span>
            </div>
          </article>
          <ul className="checklist">
            {checks.map(([ok, label]) => (
              <li key={label} className={ok ? 'ok' : ''}>
                {label}
              </li>
            ))}
          </ul>
          <p className="small muted">Vi godkender inden for 2 hverdage. Afviser vi, får du en konkret besked om, hvad der skal rettes.</p>
        </div>
      </aside>
    </div>
  );
}
