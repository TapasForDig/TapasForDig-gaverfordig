import Link from 'next/link';
import { BYTTEFRIST } from '@/lib/legal';
import { redirect } from 'next/navigation';
import { Badge, Notice, ProductImage, TopBar } from '@/components/ui';
import { cookies } from 'next/headers';
import { currentRecipient, RECIPIENT_COOKIE_NAME } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { datoTid, KINDS, str } from '@/lib/format';
import { normalizeCode } from '@/lib/purchase';
import { getOrder, getProduct, getSetting, giftsFor, type Season } from '@/lib/gifts';
import { FoodInfo } from '@/components/FoodInfo';
import { sendMail } from '@/lib/mail';
import { clientIp, tooMany } from '@/lib/ratelimit';
import { variantsFor } from '@/lib/variants';

const OPEN = ['confirmed', 'invited'];

async function deadlineFor(o: { choose_deadline: Date | null; season_id: number }) {
  if (o.choose_deadline) return new Date(o.choose_deadline);
  const s = await one<Season>('select * from seasons where id = $1', [o.season_id]);
  return s?.choose_deadline ? new Date(s.choose_deadline) : null;
}

async function redeem(fd: FormData) {
  'use server';
  const code = normalizeCode(str(fd, 'code'));
  if (await tooMany(`kode-ip:${await clientIp()}`, 20, 600)) redirect('/gave?m=' + encodeURIComponent('!For mange forsøg. Vent 10 minutter, og prøv igen.'));
  const r = await one<{ id: number; token: string; held: boolean }>(`select id, token, exists (select 1 from gift_orders ho join purchases hp on hp.id = ho.purchase_id where ho.id = recipients.order_id and hp.hold) as held from recipients where code = $1`, [code]);
  if (!r) redirect('/gave?m=' + encodeURIComponent('!Koden findes ikke. Tjek at du har skrevet den rigtigt – fx ABCD-EFGH.'));
  if (r.held) redirect('/gave?ikkeaktiv=1');
  await q('update recipients set opened_at = coalesce(opened_at, now()) where id = $1', [r.id]);
  const jar = await cookies();
  jar.set(RECIPIENT_COOKIE_NAME, r.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 90, path: '/' });
  redirect('/gave');
}

async function saveInfo(fd: FormData) {
  'use server';
  const r = await currentRecipient();
  if (!r) redirect('/gave');
  const o = await getOrder(r.order_id);
  if (!o) redirect('/gave');
  const dl = await deadlineFor(o);
  if (!OPEN.includes(o.status) || (dl && dl < new Date())) redirect('/gave?m=' + encodeURIComponent('!Vælgeperioden er slut – kontakt din arbejdsgiver, hvis adressen skal rettes'));
  const name = str(fd, 'name');
  const email = str(fd, 'email').toLowerCase();
  if (!name) redirect('/gave?ret=1&m=' + encodeURIComponent('!Skriv dit navn'));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect('/gave?ret=1&m=' + encodeURIComponent('!E-mailen er ikke gyldig'));
  if (o.delivery_mode === 'home' && (!str(fd, 'address') || !str(fd, 'zip') || !str(fd, 'city'))) {
    redirect('/gave?ret=1&m=' + encodeURIComponent('!Skriv den adresse, gaven skal sendes til'));
  }
  await q('update recipients set name = $1, email = coalesce(nullif($2, \'\'), email), address = $3, zip = $4, city = $5, phone = $6 where id = $7', [
    name,
    email,
    str(fd, 'address') || null,
    str(fd, 'zip') || null,
    str(fd, 'city') || null,
    str(fd, 'phone') || null,
    r.id,
  ]);
  redirect('/gave');
}

// "størrelse", "farve" eller "størrelse og farve" ud fra produktets egenskaber
function variantWord(json: string | null): string {
  try {
    const o = JSON.parse(json || '[]') as { name: string }[];
    return o.map((x) => x.name.toLowerCase()).join(' og ') || 'variant';
  } catch {
    return 'variant';
  }
}

async function choose(fd: FormData) {
  'use server';
  const r = await currentRecipient();
  if (!r) redirect('/gave');
  const productId = Number(fd.get('product'));
  const o = await getOrder(r.order_id);
  const deadline = o ? await deadlineFor(o) : null;
  if (!o || !OPEN.includes(o.status) || (deadline && deadline < new Date())) {
    redirect('/gave?m=' + encodeURIComponent('!Vælgeperioden er slut'));
  }
  const allowed = await giftsFor(o.price_category_id, r.chosen_product_id);
  const p = allowed.find((x) => x.id === productId);
  if (!p) redirect('/gave?m=' + encodeURIComponent('!Gaven er desværre ikke længere tilgængelig'));
  if (!r.name || (o.delivery_mode === 'home' && !r.address)) redirect('/gave?ret=1&m=' + encodeURIComponent('!Udfyld dine oplysninger først'));
  if (p.alcohol && !r.age_confirmed && fd.get('age') !== 'ja') {
    redirect('/gave?m=' + encodeURIComponent('!Bekræft at du er fyldt 18 år for at vælge en gave med alkohol'));
  }
  // Varianter: medarbejderen skal vælge fx størrelse/farve, og netop den variant skal være på lager
  let variant: { id: number; label: string } | null = null;
  if (p.variant_options) {
    const vs = (await variantsFor([p.id])).get(p.id) ?? [];
    const v = vs.find((x) => x.id === Number(fd.get('variant')));
    if (!v) redirect('/gave?m=' + encodeURIComponent(`!Vælg ${variantWord(p.variant_options)} for ${p.name}`));
    variant = { id: v.id, label: v.label };
  }
  // Opdatér kun, hvis der stadig er flere på lager (undgår oversalg, når to vælger samtidig)
  const done = await q<{ id: number }>(
    `update recipients set chosen_product_id = $1, chosen_at = now(), is_default = false, age_confirmed = age_confirmed or $2,
            variant_id = $5::int, variant_label = $6::text
      where id = $3
        and ($1 = $4::int or (select coalesce(stock, 2147483647) from products where id = $1) >
            (select count(*) from recipients where chosen_product_id = $1 and id <> $3))
        and ($5::int is null or (select stock from product_variants where id = $5::int) >
            (select count(*) from recipients where variant_id = $5::int and id <> $3))
      returning id`,
    [p.id, fd.get('age') === 'ja', r.id, r.chosen_product_id ?? 0, variant?.id ?? null, variant?.label ?? null],
  );
  if (!done.length) redirect('/gave?m=' + encodeURIComponent('!Gaven blev desværre valgt af andre lige før dig. Vælg en anden.'));
  const pname = variant ? `${p.name} (${variant.label})` : p.name;
  await logEvent(`modtager:${r.id}`, 'recipient', r.id, 'gave valgt', `${pname} – ${p.shop_name}`);
  if (r.email) {
    await sendMail(
      r.email,
      'Din gave er valgt',
      `Hej ${r.name}\n\nTak! Du har valgt: ${pname} fra ${p.shop_name}.\n${o.delivery_mode === 'home' ? `Gaven sendes til ${r.address}, ${r.zip} ${r.city}.` : 'Gaven pakkes med dit navn og leveres til din arbejdsplads.'}\n\nPasser gaven ikke, kan du bytte den hos ${p.shop_name} frem til ${BYTTEFRIST}. Husk navnemærkaten.\n\nDu kan ændre dit valg frem til ${datoTid(deadline)} med din gavekode ${r.code ?? ''}.\n\nVenlig hilsen\nGaver For Dig`,
    );
  }
  redirect('/gave?m=' + encodeURIComponent(`Du har valgt ${pname}. Du får en bekræftelse på mail.`));
}

export default async function GiftShop({ searchParams }: { searchParams: Promise<{ k?: string; m?: string; ugyldig?: string; ikkeaktiv?: string; ret?: string }> }) {
  const sp = await searchParams;
  const r = await currentRecipient();
  if (!r) {
    return (
      <>
        <TopBar />
        <main className="wrap">
          <div className="card stack-s" style={{ maxWidth: 560, margin: '40px auto' }}>
            <h1 style={{ fontSize: 28 }}>Vælg din gave</h1>
            {sp.ugyldig && <div className="alert bad">Linket er ikke gyldigt. Tjek at du har brugt hele linket fra mailen.</div>}
            {sp.ikkeaktiv && <div className="alert">Gavekoden er ikke aktiveret endnu. Prøv igen om lidt, eller spørg den, der har givet dig koden.</div>}
            <Notice msg={sp.m} />
            <p className="muted">Skriv den gavekode, du har fået fra din arbejdsplads. Har du fået et personligt link på mail, kan du også bare klikke på det.</p>
            <form action={redeem} className="form">
              <div className="field">
                <label htmlFor="code">Gavekode</label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="ABCD-EFGH"
                  style={{ fontSize: 22, letterSpacing: '.08em', textAlign: 'center', fontFamily: 'ui-monospace, monospace' }}
                />
              </div>
              <button className="btn block" type="submit">
                Gå til gaveshoppen
              </button>
            </form>
            <p className="small muted">
              Kan du ikke finde koden? Kontakt den, der står for gaverne hos jer. <Link href="/">Til forsiden</Link>
            </p>
          </div>
        </main>
      </>
    );
  }

  const o = (await getOrder(r.order_id))!;
  const deadline = await deadlineFor(o);
  const open = OPEN.includes(o.status) && !(deadline && deadline < new Date());
  const needInfo = open && (!r.name || (o.delivery_mode === 'home' && !r.address) || sp.ret === '1');
  const all = await giftsFor(o.price_category_id, r.chosen_product_id);
  const [phone, mail] = await Promise.all([getSetting('kontakt_telefon'), getSetting('kontakt_email')]);
  const contact = { phone: phone || '71 99 75 74', email: mail || 'info@gaverfordig.dk' };
  const kind = sp.k && (KINDS as readonly string[]).includes(sp.k) ? sp.k : 'Alle';
  const shown = kind === 'Alle' ? all : all.filter((p) => p.kind === kind);
  const kindsInUse = KINDS.filter((k) => all.some((p) => p.kind === k));
  const chosen = r.chosen_product_id ? await getProduct(r.chosen_product_id) : undefined;
  const variants = await variantsFor(all.filter((p) => p.variant_options).map((p) => p.id));
  const firstName = r.name?.split(' ')[0] ?? '';

  return (
    <>
      <TopBar />
      <header className="header">
        <div className="header-inner">
          <span className="logo">
            <img className="logo-img" src="/logo-white.png" alt="Gaver For Dig" width={162} height={24} />
            <span>gave fra {o.company_name}</span>
          </span>
          <span className="small" style={{ color: 'var(--green-light)' }}>
            {r.name}
          </span>
        </div>
      </header>
      <main className="wrap stack">
        <section className="row between end" style={{ gap: 24 }}>
          <div className="stack-s" style={{ flex: '1 1 520px' }}>
            {o.company_logo && <img className="company-logo" src={o.company_logo} alt={o.company_name} />}
            <div className="eyebrow">{o.title} fra {o.company_name}</div>
            <h1>{needInfo ? `Glædelig jul${firstName ? `, ${firstName}` : ''}!` : open ? `Hej ${firstName}. Vælg din gave.` : `Hej ${firstName}.`}</h1>
            {o.greeting && <p style={{ fontSize: 17, maxWidth: 680 }}>{o.greeting}</p>}
            <p className="muted">
              Alle gaver kommer fra butikker i Vejen Kommune.{' '}
              {o.delivery_mode === 'home' ? 'Din gave sendes til den adresse, du skriver.' : 'Din gave pakkes med dit navn og leveres til din arbejdsplads.'}
            </p>
          </div>
          {deadline && (
            <div className="card" style={{ minWidth: 220 }}>
              <div className="eyebrow">{open ? 'Vælg senest' : 'Vælgefristen var'}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{datoTid(deadline)}</div>
              {open && <div className="small muted">Du kan ændre dit valg indtil da</div>}
            </div>
          )}
        </section>

        <Notice msg={sp.m} />

        {needInfo && (
          <form action={saveInfo} className="card form" style={{ maxWidth: 640 }}>
            <h2>{o.delivery_mode === 'home' ? 'Hvem er du, og hvor skal gaven sendes hen?' : 'Hvem er du?'}</h2>
            <p className="hint">{o.delivery_mode === 'home' ? 'Vi bruger adressen til at sende din gave.' : 'Vi skriver dit navn på gaven, så den kommer frem til dig.'}</p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="name">Fulde navn *</label>
                <input id="name" name="name" type="text" defaultValue={r.name ?? ''} autoComplete="name" required />
              </div>
              <div className="field">
                <label htmlFor="email">E-mail (til kvittering)</label>
                <input id="email" name="email" type="email" defaultValue={r.email ?? ''} autoComplete="email" />
              </div>
              {o.delivery_mode === 'home' && (
                <>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="address">Adresse *</label>
                    <input id="address" name="address" type="text" defaultValue={r.address ?? ''} autoComplete="street-address" required />
                  </div>
                  <div className="field">
                    <label htmlFor="zip">Postnr. *</label>
                    <input id="zip" name="zip" type="text" inputMode="numeric" defaultValue={r.zip ?? ''} autoComplete="postal-code" required />
                  </div>
                  <div className="field">
                    <label htmlFor="city">By *</label>
                    <input id="city" name="city" type="text" defaultValue={r.city ?? ''} autoComplete="address-level2" required />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Mobilnummer (til fragtfirmaet)</label>
                    <input id="phone" name="phone" type="tel" defaultValue={r.phone ?? ''} autoComplete="tel" />
                  </div>
                </>
              )}
            </div>
            <div>
              <button className="btn" type="submit">
                Fortsæt til gaverne
              </button>
            </div>
          </form>
        )}

        {!needInfo && open && r.name && (
          <p className="small muted">
            {r.name}
            {o.delivery_mode === 'home' && r.address ? ` · ${r.address}, ${r.zip} ${r.city}` : ''} · <Link href="/gave?ret=1">Ret mine oplysninger</Link>
          </p>
        )}

        {chosen && !needInfo && (
          <div className="dark-card row between">
            <div>
              <div className="small muted">{r.is_default ? 'Du fik tildelt standardgaven' : 'Dit valg'}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {chosen.name}
                {r.variant_label ? ` – ${r.variant_label}` : ''}
              </div>
              <div className="small muted">fra {chosen.shop_name} · kan byttes i butikken frem til {BYTTEFRIST}</div>
            </div>
            {open && <span className="small muted">Vælg en anden gave nedenfor, hvis du skifter mening.</span>}
          </div>
        )}

        {needInfo ? null : open ? (
          <>
            <nav className="pills" aria-label="Filtrér gaver">
              {['Alle', ...kindsInUse].map((k) => (
                <Link key={k} href={k === 'Alle' ? '/gave' : `/gave?k=${encodeURIComponent(k)}`} className={`pill ${k === kind ? 'on' : ''}`}>
                  {k}
                </Link>
              ))}
            </nav>
            {shown.length === 0 && <p className="muted">Der er ingen gaver i denne kategori lige nu.</p>}
            <div className="products">
              {shown.map((p) => {
                const sel = p.id === r.chosen_product_id;
                // Varianter der stadig kan vælges (eller den, medarbejderen allerede har)
                const avail = (variants.get(p.id) ?? []).filter((v) => v.stock > v.chosen || v.id === r.variant_id);
                const hasVariants = !!p.variant_options;
                if (hasVariants && !avail.length && !sel) return null;
                return (
                  <article key={p.id} className={`product ${sel ? 'selected' : ''}`}>
                    <ProductImage json={p.images} alt={p.name} label={sel ? <Badge tone="wine">Dit valg</Badge> : undefined} />
                    <div className="body">
                      <div className="eyebrow">
                        {p.shop_name}
                        {p.shop_town ? ` · ${p.shop_town}` : ''}
                      </div>
                      <h3>{p.name}</h3>
                      <p className="desc">{p.description}</p>
                      {p.kind === 'Mad og drikke' && <FoodInfo ingredients={p.ingredients} netContent={p.net_content} contact={contact} compact />}
                      {sel && !hasVariants ? (
                        <span className="btn block" aria-disabled="true">
                          Valgt
                        </span>
                      ) : (
                        <form action={choose} className="stack-s">
                          <input type="hidden" name="product" value={p.id} />
                          {hasVariants && (
                            <div className="field">
                              <label htmlFor={`variant-${p.id}`} className="small">
                                Vælg {variantWord(p.variant_options)}
                              </label>
                              <select id={`variant-${p.id}`} name="variant" required defaultValue={sel && r.variant_id ? String(r.variant_id) : ''}>
                                <option value="" disabled>
                                  Vælg …
                                </option>
                                {avail.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {p.alcohol && !r.age_confirmed && (
                            <label className="check small" style={{ justifyContent: 'center' }}>
                              <input type="checkbox" name="age" value="ja" required /> Jeg er fyldt 18 år
                            </label>
                          )}
                          <button className={`btn block ${sel ? '' : 'outline'}`} type="submit">
                            {sel ? 'Valgt – skift variant' : 'Vælg denne gave'}
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          !chosen && <div className="alert warn">Vælgeperioden er slut. Kontakt den, der står for gaverne hos jer.</div>
        )}
      </main>
    </>
  );
}
