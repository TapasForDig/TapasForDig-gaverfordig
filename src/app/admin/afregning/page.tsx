import { Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { kr } from '@/lib/format';
import { activeSeason, getSetting } from '@/lib/gifts';
import { adminNav } from '../nav';

export default async function Billing() {
  await requireRole('admin');
  const season = await activeSeason();
  const [rabat, gebyr] = await Promise.all([getSetting('indkoebsrabat_pct'), getSetting('gebyr_pr_modtager_kr')]);
  const fee = Number(gebyr) || 0;
  const invoices = await q<{ id: number; company: string; cvr: string | null; title: string; status: string; n: number; value_kr: number }>(
    `select o.id, c.name as company, c.cvr, o.title, o.status, pc.value_kr,
            (select count(*)::int from recipients r where r.order_id = o.id) as n
       from gift_orders o join companies c on c.id = o.company_id join price_categories pc on pc.id = o.price_category_id
      where o.season_id = $1 and o.status <> 'draft' order by c.name`,
    [season?.id ?? 0],
  );
  const settle = await q<{ shop: string; cvr: string | null; product: string; n: number; received: number; cost_kr: number | null; value_kr: number | null }>(
    `select s.name as shop, s.cvr, p.name as product, count(*)::int as n, count(r.received_at)::int as received, p.cost_kr, pc.value_kr
       from recipients r join products p on p.id = r.chosen_product_id join shops s on s.id = p.shop_id
       join gift_orders o on o.id = r.order_id left join price_categories pc on pc.id = p.price_category_id
      where o.season_id = $1 group by s.name, s.cvr, p.name, p.cost_kr, pc.value_kr order by s.name, p.name`,
    [season?.id ?? 0],
  );
  const pct = rabat === '' ? null : Number(rabat);
  const unit = (r: (typeof settle)[number]) => r.cost_kr ?? (pct != null && r.value_kr != null ? Math.round(r.value_kr * (1 - pct / 100)) : null);
  const shops = [...new Set(settle.map((s) => s.shop))];
  const invTotal = invoices.reduce((s, i) => s + i.n * (i.value_kr + fee), 0);
  const costTotal = settle.reduce((s, r) => s + (unit(r) ?? 0) * r.received, 0);

  return (
    <Shell area="Admin" nav={adminNav} active="/admin/afregning">
      <div className="stack">
        <div>
          <div className="eyebrow">{season?.name}</div>
          <h1>Fakturering og afregning</h1>
        </div>
        <p className="muted">Fakturaerne oprettes i e-conomic ud fra listen herunder. Butikkerne fakturerer Gaver For Dig for de varer, logistikcentralen har modtaget.</p>

        <section className="card flush">
          <div className="card-head">
            <h2>Fakturaer til virksomheder</h2>
            <b>{kr(invTotal)} inkl. moms</b>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Virksomhed</th>
                  <th>Ordre</th>
                  <th className="num">Antal</th>
                  <th className="num">Pr. stk.</th>
                  <th className="num">I alt inkl. moms</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <b>{i.company}</b>
                      <div className="small muted">CVR {i.cvr || '–'}</div>
                    </td>
                    <td className="small">{i.title}</td>
                    <td className="num">{i.n}</td>
                    <td className="num">{kr(i.value_kr + fee)}</td>
                    <td className="num">
                      <b>{kr(i.n * (i.value_kr + fee))}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card flush">
          <div className="card-head">
            <h2>Afregning til butikker</h2>
            <b>{kr(costTotal)}</b>
          </div>
          {pct == null && <div className="alert warn" style={{ margin: 16 }}>Indkøbsrabat er ikke sat under Sæson og priser, og nogle produkter har ingen indkøbspris. De står som &quot;aftales&quot;.</div>}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Butik / produkt</th>
                  <th className="num">Valgt</th>
                  <th className="num">Modtaget</th>
                  <th className="num">Indkøbspris</th>
                  <th className="num">Til betaling</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => {
                  const rows = settle.filter((r) => r.shop === shop);
                  const sum = rows.reduce((s, r) => s + (unit(r) ?? 0) * r.received, 0);
                  return [
                    <tr key={shop} style={{ background: 'var(--cream)' }}>
                      <td colSpan={4}>
                        <b>{shop}</b> <span className="small muted">CVR {rows[0].cvr || '–'}</span>
                      </td>
                      <td className="num">
                        <b>{kr(sum)}</b>
                      </td>
                    </tr>,
                    ...rows.map((r) => (
                      <tr key={shop + r.product}>
                        <td className="small" style={{ paddingLeft: 36 }}>
                          {r.product}
                        </td>
                        <td className="num">{r.n}</td>
                        <td className="num">{r.received}</td>
                        <td className="num">{unit(r) != null ? kr(unit(r)) : 'aftales'}</td>
                        <td className="num">{unit(r) != null ? kr((unit(r) ?? 0) * r.received) : '–'}</td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}
