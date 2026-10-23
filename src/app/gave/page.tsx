import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Notice, ProductImage, TopBar } from '@/components/ui';
import { currentRecipient } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { dato, KINDS } from '@/lib/format';
import { getOrder, getProduct, giftsFor, type Season } from '@/lib/gifts';
import { sendMail } from '@/lib/mail';

const OPEN = ['confirmed', 'invited'];

async function choose(fd: FormData) {
  'use server';
  const r = await currentRecipient();
  if (!r) redirect('/gave');
  const productId = Number(fd.get('product'));
  const o = await getOrder(r.order_id);
  const season = o && (await one<Season>('select * from seasons where id = $1', [o.season_id]));
  if (!o || !OPEN.includes(o.status) || (season?.choose_deadline && new Date(season.choose_deadline) < new Date())) {
    redirect('/gave?m=' + encodeURIComponent('!Vælgeperioden er slut'));
  }
  const allowed = await giftsFor(o.price_category_id, r.chosen_product_id);
  const p = allowed.find((x) => x.id === productId);
  if (!p) redirect('/gave?m=' + encodeURIComponent('!Gaven er desværre ikke længere tilgængelig'));
  if (p.alcohol && !r.age_confirmed && fd.get('age') !== 'ja') {
    redirect('/gave?m=' + encodeURIComponent('!Bekræft at du er fyldt 18 år for at vælge en gave med alkohol'));
  }
  await q('update recipients set chosen_product_id = $1, chosen_at = now(), is_default = false, age_confirmed = age_confirmed or $2 where id = $3', [
    p.id,
    fd.get('age') === 'ja',
    r.id,
  ]);
  await logEvent(`modtager:${r.id}`, 'recipient', r.id, 'gave valgt', `${p.name} (${p.shop_name})`);
  await sendMail(
    r.email,
    'Din gave er valgt',
    `Hej ${r.name}\n\nTak! Du har valgt: ${p.name} fra ${p.shop_name}.\nGaven pakkes med dit navn og leveres til din arbejdsplads.\n\nDu kan ændre dit valg frem til ${dato(season?.choose_deadline ?? null)} via linket i din invitation.\n\nVenlig hilsen\nGaver For Dig`,
  );
  redirect('/gave?m=' + encodeURIComponent(`Du har valgt ${p.name}. Du får en bekræftelse på mail.`));
}

export default async function GiftShop({ searchParams }: { searchParams: Promise<{ k?: string; m?: string; ugyldig?: string }> }) {
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
            <p className="muted">Brug det personlige link i den mail, du har fået fra din arbejdsplads. Så kommer du direkte ind i din gaveshop.</p>
            <p className="small muted">
              Kan du ikke finde mailen? Kontakt den, der står for gaverne hos jer, eller skriv til os. <Link href="/">Til forsiden</Link>
            </p>
          </div>
        </main>
      </>
    );
  }

  const o = (await getOrder(r.order_id))!;
  const season = await one<Season>('select * from seasons where id = $1', [o.season_id]);
  const open = OPEN.includes(o.status) && !(season?.choose_deadline && new Date(season.choose_deadline) < new Date());
  const all = await giftsFor(o.price_category_id, r.chosen_product_id);
  const kind = sp.k && (KINDS as readonly string[]).includes(sp.k) ? sp.k : 'Alle';
  const shown = kind === 'Alle' ? all : all.filter((p) => p.kind === kind);
  const kindsInUse = KINDS.filter((k) => all.some((p) => p.kind === k));
  const chosen = r.chosen_product_id ? await getProduct(r.chosen_product_id) : undefined;
  const firstName = r.name.split(' ')[0];

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
            <div className="eyebrow">{o.title} fra {o.company_name}</div>
            <h1>{open ? `Hej ${firstName}. Vælg din gave.` : `Hej ${firstName}.`}</h1>
            {o.greeting && <p style={{ fontSize: 17, maxWidth: 680 }}>{o.greeting}</p>}
            <p className="muted">Alle gaver kommer fra butikker i Vejen Kommune. Din gave pakkes med dit navn og leveres til din arbejdsplads.</p>
          </div>
          {season?.choose_deadline && (
            <div className="card" style={{ minWidth: 220 }}>
              <div className="eyebrow">{open ? 'Vælg senest' : 'Vælgefristen var'}</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{dato(season.choose_deadline)}</div>
              {open && <div className="small muted">Du kan ændre dit valg indtil da</div>}
            </div>
          )}
        </section>

        <Notice msg={sp.m} />

        {chosen && (
          <div className="dark-card row between">
            <div>
              <div className="small muted">{r.is_default ? 'Du fik tildelt standardgaven' : 'Dit valg'}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{chosen.name}</div>
              <div className="small muted">fra {chosen.shop_name}</div>
            </div>
            {open && <span className="small muted">Vælg en anden gave nedenfor, hvis du skifter mening.</span>}
          </div>
        )}

        {open ? (
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
                      {sel ? (
                        <span className="btn block" aria-disabled="true">
                          Valgt
                        </span>
                      ) : (
                        <form action={choose} className="stack-s">
                          <input type="hidden" name="product" value={p.id} />
                          {p.alcohol && !r.age_confirmed && (
                            <label className="check small" style={{ justifyContent: 'center' }}>
                              <input type="checkbox" name="age" value="ja" required /> Jeg er fyldt 18 år
                            </label>
                          )}
                          <button className="btn outline block" type="submit">
                            Vælg denne gave
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
