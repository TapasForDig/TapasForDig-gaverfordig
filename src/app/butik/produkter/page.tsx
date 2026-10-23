import Link from 'next/link';
import { Badge, Notice, Shell, Thumb } from '@/components/ui';
import { datoTid, kr } from '@/lib/format';
import { one } from '@/lib/db';
import { categories, getSetting, PRODUCT_STATUS, productsForShop } from '@/lib/gifts';
import { productAction } from '../produkt/[id]/actions';
import { shopNav } from '../nav';
import { myShop } from '../shop';

const tone = (s: string) => (s === 'approved' ? 'ok' : s === 'pending' ? 'warn' : s === 'rejected' ? 'bad' : undefined);

export default async function ShopProducts({ searchParams }: { searchParams: Promise<{ butik?: string; m?: string }> }) {
  const sp = await searchParams;
  const { shop, shops } = await myShop(sp.butik);
  const [products, cats, discount] = await Promise.all([productsForShop(shop.id), categories(), getSetting('indkoebsrabat_pct')]);
  const q0 = shops ? `?butik=${shop.id}` : '';
  const pct = Number(discount);
  const costOf = (catId: number | null, cost: number | null) => {
    if (cost != null) return cost;
    const v = cats.find((c) => c.id === catId)?.value_kr;
    return v != null && discount !== '' && Number.isFinite(pct) ? Math.round(v * (1 - pct / 100)) : null;
  };
  const approved = products.filter((p) => p.status === 'approved').length;
  const groupsCovered = new Set(products.filter((p) => p.status === 'approved').map((p) => p.price_category_id)).size;
  const steps: [boolean, string, string][] = [
    [true, 'Butikken er oprettet', 'Du er logget ind og kan oprette gaver.'],
    [shop.status === 'approved', 'Butikken godkendes', shop.status === 'approved' ? 'Din butik er godkendt.' : 'Vi godkender butikken inden for 2 hverdage.'],
    [!!(shop.logo && shop.story), 'Logo og kort beskrivelse', 'Under "Min butik". Vises på siden med deltagende butikker.'],
    [products.length > 0, 'Opret din første gave', 'Det tager ca. 10 minutter. Tag billederne med telefonen.'],
    [approved > 0, 'Gaven godkendes', 'Når gaven er godkendt, kan medarbejderne vælge den.'],
    [groupsCovered >= 2, 'Gaver i flere prisgrupper', 'Butikker med gaver i 2–3 prisgrupper bliver valgt oftere.'],
  ];
  const done = steps.filter((s) => s[0]).length;
  const due = await one<{ n: number; first: Date | null }>(
    `select count(r.id)::int as n, min(h.dropoff_deadline) as first from handoffs h join recipients r on r.handoff_id = h.id
      where h.shop_id = $1 and h.received_at is null`,
    [shop.id],
  );

  return (
    <Shell area={`Butik · ${shop.name}`} nav={shopNav.map((n) => ({ ...n, href: n.href + q0 }))} active={`/butik/produkter${q0}`}>
      <div className="stack">
        <div className="row between end">
          <h1>Mine produkter</h1>
          <Link className="btn" href={`/butik/produkt/ny${q0}`}>
            + Opret nyt produkt
          </Link>
        </div>
        <Notice msg={sp.m} />
        {due && due.n > 0 && (
          <div className="alert warn row between">
            <span>
              Du har <b>{due.n} gaver</b> til aflevering{due.first ? ` – senest ${datoTid(due.first)}` : ''}.
            </span>
            <Link href={`/butik${q0}`}>Se afleveringslisten</Link>
          </div>
        )}

        {done < steps.length && (
          <section className="card stack-s">
            <div className="row between">
              <h2>Kom i gang</h2>
              <span className="small muted">
                {done} af {steps.length} klar
              </span>
            </div>
            <ol className="onboard">
              {steps.map(([ok, t, d]) => (
                <li key={t} className={ok ? 'ok' : ''}>
                  <b>{t}</b>
                  <span className="small muted">{d}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Prisgruppe</th>
                  <th>Status</th>
                  <th className="num">Valgt / antal</th>
                  <th className="num">Du får pr. stk.</th>
                  <th aria-label="Handlinger" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const cat = cats.find((c) => c.id === p.price_category_id);
                  const cost = costOf(p.price_category_id, p.cost_kr);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <Thumb json={p.images} alt="" />
                          <div>
                            <Link href={`/butik/produkt/${p.id}${q0}`}>
                              <b>{p.name}</b>
                            </Link>
                            <div className="small muted">{p.kind || 'Ingen kategori'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="small">{cat ? `${kr(cat.value_kr)} ekskl. moms` : '–'}</td>
                      <td>
                        <Badge tone={tone(p.status)}>{PRODUCT_STATUS[p.status] ?? p.status}</Badge>
                        {p.status === 'rejected' && p.review_note && <div className="small" style={{ color: 'var(--bad)', marginTop: 6 }}>{p.review_note}</div>}
                      </td>
                      <td className="num">
                        <b>{p.chosen}</b> / {p.stock}
                        {p.chosen >= p.stock && p.stock > 0 && <div className="small" style={{ color: 'var(--warn)' }}>Udsolgt</div>}
                      </td>
                      <td className="num small">{cost != null ? kr(cost) : 'Aftales'}</td>
                      <td className="small">
                        <details className="menu">
                          <summary>Handlinger</summary>
                          <div className="menu-pop">
                            <Link href={`/butik/produkt/${p.id}${q0}`}>Ret</Link>
                            <form action={productAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="butik" value={shop.id} />
                              {p.status === 'approved' && (
                                <button className="linkbtn" name="what" value="pause">
                                  Sæt på pause
                                </button>
                              )}
                              {p.status === 'paused' && (
                                <button className="linkbtn" name="what" value="resume">
                                  Genaktivér
                                </button>
                              )}
                              <button className="linkbtn" name="what" value="copy">
                                Kopiér
                              </button>
                              {p.chosen === 0 && (
                                <button className="linkbtn" name="what" value="delete" style={{ color: 'var(--bad)' }}>
                                  Slet
                                </button>
                              )}
                            </form>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Du har ingen produkter endnu. <Link href={`/butik/produkt/ny${q0}`}>Opret dit første produkt</Link> – det tager ca. 10 minutter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}
