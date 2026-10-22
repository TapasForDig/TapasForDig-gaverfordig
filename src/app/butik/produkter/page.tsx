import Link from 'next/link';
import { Badge, Notice, Shell, Thumb } from '@/components/ui';
import { kr } from '@/lib/format';
import { categories, getSetting, PRODUCT_STATUS, productsForShop } from '@/lib/gifts';
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
        <section className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Kategori</th>
                  <th>Status</th>
                  <th className="num">Valgt / lager</th>
                  <th className="num">Du får pr. stk.</th>
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
                            <div className="small muted">{p.kind}</div>
                          </div>
                        </div>
                      </td>
                      <td className="small">{cat ? `${cat.name} (${kr(cat.value_kr)})` : '–'}</td>
                      <td>
                        <Badge tone={tone(p.status)}>{PRODUCT_STATUS[p.status]}</Badge>
                        {p.status === 'rejected' && p.review_note && <div className="small" style={{ color: 'var(--bad)', marginTop: 6 }}>{p.review_note}</div>}
                      </td>
                      <td className="num">
                        <b>{p.chosen}</b> / {p.stock}
                        {p.chosen >= p.stock && p.stock > 0 && <div className="small" style={{ color: 'var(--warn)' }}>Udsolgt</div>}
                      </td>
                      <td className="num small">{cost != null ? kr(cost) : 'Aftales'}</td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
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
