import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Notice, Shell } from '@/components/ui';
import { logEvent, one, q } from '@/lib/db';
import { dato, datoTid, daysLeft, kr as fmtKr } from '@/lib/format';
import { activeSeason, getSetting } from '@/lib/gifts';
import { shopNav } from './nav';
import { myShop } from './shop';

interface Handoff {
  id: number;
  code: string;
  handed_at: Date | null;
  received_at: Date | null;
  dropoff_deadline: Date | null;
  n: number;
}
interface Line {
  handoff_id: number;
  product: string;
  n: number;
  companies: string;
  received: number;
  wrap: number;
}

async function markHanded(fd: FormData) {
  'use server';
  const { u, shop } = await myShop(String(fd.get('butik') ?? ''));
  const id = Number(fd.get('handoff'));
  const h = await one<{ id: number }>('update handoffs set handed_at = now() where id = $1 and shop_id = $2 returning id', [id, shop.id]);
  if (h) await logEvent(u.email, 'handoff', id, 'afleveret af butik', shop.name);
  redirect(`/butik?butik=${shop.id}&m=${encodeURIComponent('Markeret som afleveret. Logistikcentralen bekræfter, når varerne er talt op.')}`);
}

export default async function ShopHome({ searchParams }: { searchParams: Promise<{ butik?: string; m?: string }> }) {
  const sp = await searchParams;
  const { shop, shops } = await myShop(sp.butik);
  const [season, dropAddr, wrapSetting] = await Promise.all([activeSeason(), getSetting('logistik_adresse'), getSetting('indpakning_kr')]);
  const wrapFee = Number(wrapSetting) || 30;
  const handoffs = await q<Handoff>(
    `select h.id, h.code, h.handed_at, h.received_at, h.dropoff_deadline, (select count(*)::int from recipients r where r.handoff_id = h.id) as n
       from handoffs h where h.shop_id = $1 order by h.created_at desc`,
    [shop.id],
  );
  const lines = await q<Line>(
    `select r.handoff_id, p.name || coalesce(' – ' || r.variant_label, '') as product, count(*)::int as n, string_agg(distinct c.name, ', ') as companies,
            count(r.received_at)::int as received, count(*) filter (where o.wrapping)::int as wrap
       from recipients r join products p on p.id = r.chosen_product_id
       join gift_orders o on o.id = r.order_id join companies c on c.id = o.company_id
      where p.shop_id = $1 and r.handoff_id is not null
      group by r.handoff_id, p.name, r.variant_label order by p.name, r.variant_label`,
    [shop.id],
  );
  const pending = await q<{ product: string; n: number }>(
    `select p.name || coalesce(' – ' || r.variant_label, '') as product, count(*)::int as n
       from recipients r join products p on p.id = r.chosen_product_id join gift_orders o on o.id = r.order_id
      where p.shop_id = $1 and r.handoff_id is null and o.status in ('confirmed','invited')
      group by p.name, r.variant_label order by n desc`,
    [shop.id],
  );
  const open = handoffs.filter((h) => !h.received_at);
  const total = open.reduce((s, h) => s + h.n, 0);
  const nextDrop = open.map((h) => h.dropoff_deadline).filter(Boolean).sort((a, b) => +new Date(a!) - +new Date(b!))[0] ?? season?.dropoff_deadline ?? null;
  const left = daysLeft(nextDrop);
  const q0 = shops ? `?butik=${shop.id}` : '';

  return (
    <Shell area={`Butik · ${shop.name}`} nav={shopNav.map((n) => ({ ...n, href: n.href + q0 }))} active={`/butik${q0}`}>
      <div className="stack">
        {shops && (
          <form className="row small" action="/butik">
            <label htmlFor="butik">Admin – vis butik:</label>
            <select id="butik" name="butik" defaultValue={shop.id} style={{ width: 'auto' }}>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button className="btn small outline">Vis</button>
          </form>
        )}
        <div className="row between end">
          <div>
            <div className="eyebrow">{season?.name ?? ''}</div>
            <h1>Det skal du aflevere</h1>
          </div>
          <Link className="btn" href={`/butik/produkt/ny${q0}`}>
            + Opret nyt produkt
          </Link>
        </div>
        <Notice msg={sp.m} />
        {shop.status !== 'approved' && (
          <div className="alert warn">Din butik afventer godkendelse. Dine produkter bliver synlige for medarbejderne, når butikken er godkendt.</div>
        )}

        <div className="dark-card row between" style={{ gap: 20 }}>
          <div>
            <div className="small muted">Aflevering på logistikcentralen</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{nextDrop ? `Senest ${datoTid(nextDrop)}` : 'Ingen afleveringer endnu'}</div>
            <div className="small muted">
              Gaver For Dig · {dropAddr}
              {left != null && left >= 0 ? ` · ${left} dage tilbage` : ''}
            </div>
          </div>
          <div className="row" style={{ gap: 28 }}>
            <div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{total}</div>
              <div className="small muted">gaver at aflevere</div>
            </div>
          </div>
        </div>

        {handoffs.length === 0 && (
          <div className="card stack-s">
            <h2>Ingen afleveringer endnu</h2>
            <p className="muted">
              Når vælgefristen ({dato(season?.choose_deadline)}) er udløbet, kommer listen over præcis hvilke gaver, du skal aflevere, her. Du får også en mail.
            </p>
          </div>
        )}

        {handoffs.map((h) => {
          const ls = lines.filter((l) => l.handoff_id === h.id);
          return (
            <section key={h.id} className="card flush">
              <div className="card-head">
                <div>
                  <h2>Afleveringsseddel {h.code}</h2>
                  <div className="small muted">
                    {h.n} gaver{h.dropoff_deadline ? ` · afleveres senest ${datoTid(h.dropoff_deadline)}` : ''}
                  </div>
                </div>
                <div className="row">
                  {h.received_at ? (
                    <Badge tone="ok">Modtaget {dato(h.received_at)}</Badge>
                  ) : h.handed_at ? (
                    <Badge tone="warn">Afleveret – afventer optælling</Badge>
                  ) : (
                    <Badge>Ikke afleveret</Badge>
                  )}
                  <Link className="btn small outline" href={`/butik/seddel/${h.id}${q0}`}>
                    Print afleveringsseddel
                  </Link>
                  {!h.handed_at && (
                    <form action={markHanded}>
                      <input type="hidden" name="handoff" value={h.id} />
                      <input type="hidden" name="butik" value={shop.id} />
                      <button className="btn small" type="submit">
                        Markér som afleveret
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produkt</th>
                      <th className="num">Antal</th>
                      <th>Til</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ls.map((l) => (
                      <tr key={l.product}>
                        <td>
                          <b>{l.product}</b>
                        </td>
                        <td className="num" style={{ fontSize: 20, fontWeight: 700 }}>
                          {l.n}
                          {l.wrap > 0 && (
                            <div>
                              <Badge tone="wine">{l.wrap === l.n ? 'Alle' : l.wrap} gaveindpakkes</Badge>
                            </div>
                          )}
                        </td>
                        <td className="small muted">{l.companies}</td>
                        <td>
                          {l.received === l.n ? <Badge tone="ok">Modtaget</Badge> : l.received > 0 ? <Badge tone="warn">Mangler {l.n - l.received}</Badge> : <Badge>Venter</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-foot small muted">
                Gaver markeret &quot;gaveindpakkes&quot; pakker du ind – du får {fmtKr(wrapFee)} ekskl. moms ekstra pr. stk. De øvrige afleveres i egen emballage. Logistikcentralen sætter
                navnemærkat på.
              </div>
            </section>
          );
        })}

        {pending.length > 0 && (
          <section className="card flush">
            <div className="card-head">
              <h2>Valgt indtil nu (foreløbigt)</h2>
              <span className="small muted">Vælgeperioden er stadig åben – tallene kan ændre sig</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.product}>
                      <td>{p.product}</td>
                      <td className="num">
                        <b>{p.n}</b> valgt
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}
