import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Notice, Shell, Stat } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { cleanupIfDue } from '@/lib/retention';
import { q } from '@/lib/db';
import { dato, datoTid, kr } from '@/lib/format';
import { activeSeason, closeChoosing, ORDER_STATUS } from '@/lib/gifts';
import { adminNav } from './nav';

async function close(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  if (fd.get('confirm') !== 'ja') redirect('/admin?m=' + encodeURIComponent('!Sæt kryds for at bekræfte'));
  const season = await activeSeason();
  if (!season) redirect('/admin');
  const r = await closeChoosing(season.id, u.email, fd.get('force') === 'ja');
  redirect(
    '/admin?m=' +
      encodeURIComponent(
        r.orders === 0
          ? '!Ingen ordrer har udløbet vælgefrist endnu'
          : `${r.orders} ordrer er lukket. ${r.defaults} fik standardgaven. ${r.handoffs} butikker har fået deres afleveringsliste.${r.noDefault ? ` OBS: ${r.noDefault} medarbejdere har hverken valgt gave eller fået en standardgave.` : ''}`,
      ),
  );
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  await cleanupIfDue();
  const season = await activeSeason();
  const sid = season?.id ?? 0;
  const [totals] = await q<{ orders: number; recipients: number; chosen: number; revenue: number; companies: number }>(
    `select count(distinct o.id)::int as orders, count(r.id)::int as recipients, count(r.chosen_product_id)::int as chosen,
            coalesce(sum(pc.value_kr) filter (where o.status <> 'draft'), 0)::int as revenue, count(distinct o.company_id)::int as companies
       from gift_orders o join price_categories pc on pc.id = o.price_category_id left join recipients r on r.order_id = o.id
      where o.season_id = $1`,
    [sid],
  );
  const [pend] = await q<{ shops: number; products: number }>(
    `select (select count(*)::int from shops where status = 'pending') as shops, (select count(*)::int from products where status = 'pending') as products`,
  );
  const orders = await q<{ id: number; company: string; title: string; status: string; total: number; chosen: number; value_kr: number; no_default: boolean; deadline: Date | null; due: boolean }>(
    `select o.id, c.name as company, o.title, o.status, pc.value_kr, o.default_product_id is null as no_default,
            coalesce(o.choose_deadline, ss.choose_deadline) as deadline, coalesce(o.choose_deadline, ss.choose_deadline) < now() as due,
            (select count(*)::int from recipients r where r.order_id = o.id) as total,
            (select count(chosen_product_id)::int from recipients r where r.order_id = o.id) as chosen
       from gift_orders o join companies c on c.id = o.company_id join price_categories pc on pc.id = o.price_category_id
       join seasons ss on ss.id = o.season_id
      where o.season_id = $1 order by o.created_at desc`,
    [sid],
  );
  const top = await q<{ name: string; shop: string; n: number }>(
    `select p.name, s.name as shop, count(*)::int as n from recipients r join products p on p.id = r.chosen_product_id
       join shops s on s.id = p.shop_id join gift_orders o on o.id = r.order_id where o.season_id = $1
      group by p.name, s.name order by n desc limit 5`,
    [sid],
  );
  const events = await q<{ at: Date; actor: string; entity: string; action: string; detail: string }>(
    'select at, actor, entity, action, detail from events order by id desc limit 15',
  );
  const openOrders = orders.filter((o) => ['confirmed', 'invited'].includes(o.status));
  const dueOrders = openOrders.filter((o) => o.due);
  const nextDeadline = openOrders.filter((o) => !o.due && o.deadline).sort((a, b) => +new Date(a.deadline!) - +new Date(b.deadline!))[0]?.deadline;
  const pct = totals.recipients ? Math.round((totals.chosen / totals.recipients) * 100) : 0;

  return (
    <Shell area="Admin" nav={adminNav} active="/admin">
      <div className="stack">
        <div>
          <div className="eyebrow">
            {season?.name}
          </div>
          <h1>Overblik</h1>
        </div>
        <Notice msg={sp.m} />
        {(pend.shops > 0 || pend.products > 0) && (
          <div className="alert warn row between">
            <span>
              {pend.shops} butikker og {pend.products} produkter venter på godkendelse.
            </span>
            <Link href="/admin/godkend">Gå til godkendelse</Link>
          </div>
        )}
        <div className="stats">
          <Stat label="Virksomheder" value={totals.companies} />
          <Stat label="Gaver bestilt" value={totals.recipients} />
          <Stat label="Har valgt" value={`${pct} %`} tone="ok" />
          <Stat label="Omsætning (bekræftet)" value={kr(orders.filter((o) => o.status !== 'draft').reduce((s, o) => s + o.total * o.value_kr, 0))} />
        </div>

        <div className="split">
          <section className="main card flush">
            <div className="card-head">
              <h2>Ordrer i sæsonen</h2>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Virksomhed</th>
                    <th>Status</th>
                    <th className="num">Valgt</th>
                    <th className="num">Beløb</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/virksomhed/ordre/${o.id}`}>
                          <b>{o.company}</b>
                        </Link>
                        <div className="small muted">{o.title}</div>
                      </td>
                      <td>
                        <Badge tone={o.status === 'draft' ? 'warn' : o.status === 'delivered' ? 'ok' : undefined}>{ORDER_STATUS[o.status]}</Badge>
                        {o.no_default && ['confirmed', 'invited'].includes(o.status) && <div className="small" style={{ color: 'var(--warn)' }}>Ingen standardgave</div>}
                      </td>
                      <td className="num">
                        {o.chosen}/{o.total}
                      </td>
                      <td className="num">{kr(o.total * o.value_kr)}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Ingen ordrer endnu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="side">
            <div className="card">
              <form action={close} className="form">
                <h2>Luk ordrer med udløbet vælgefrist</h2>
                <p className="small muted">
                  Hver bestilling har sin egen vælgefrist ud fra leveringsugen. Når fristen er udløbet, lukker du ordrerne her. Dem der ikke har valgt, får standardgaven,
                  og hver butik får sin afleveringsliste på mail.
                </p>
                <p className="small">
                  Klar til lukning: <b>{dueOrders.length}</b> ordrer med <b>{dueOrders.reduce((s, o) => s + (o.total - o.chosen), 0)}</b> medarbejdere uden valg.
                  {nextDeadline && (
                    <>
                      <br />
                      Næste frist: {datoTid(nextDeadline)}
                    </>
                  )}
                </p>
                <label className="check small">
                  <input type="checkbox" name="confirm" value="ja" /> Ja, luk nu
                </label>
                <label className="check small">
                  <input type="checkbox" name="force" value="ja" /> Luk også ordrer, hvor fristen ikke er udløbet ({openOrders.length - dueOrders.length})
                </label>
                <button className="btn wine" type="submit" disabled={openOrders.length === 0}>
                  Luk ordrer
                </button>
              </form>
            </div>
            <div className="card stack-s">
              <h2>Mest valgte gaver</h2>
              <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {top.map((t) => (
                  <li key={t.name}>
                    {t.name} <span className="muted">({t.shop})</span> – <b>{t.n}</b>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>

        <section className="card flush">
          <div className="card-head">
            <h2>Seneste hændelser</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {events.map((e, i) => (
                  <tr key={i}>
                    <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                      {datoTid(e.at)}
                    </td>
                    <td className="small">{e.actor}</td>
                    <td className="small">
                      <b>{e.action}</b> {e.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}
