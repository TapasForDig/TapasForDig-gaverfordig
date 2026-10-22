import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Notice, Progress, Shell, Stat } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, q } from '@/lib/db';
import { appUrl, dato, datoTid } from '@/lib/format';
import { activeSeason, ORDER_STATUS } from '@/lib/gifts';
import { sendMail } from '@/lib/mail';
import { logisticsNav } from './nav';

interface O {
  id: number;
  company: string;
  title: string;
  status: string;
  delivery_address: string | null;
  total: number;
  got: number;
}
interface Missing {
  order_id: number;
  shop_id: number;
  shop: string;
  email: string | null;
  n: number;
}

async function nudgeShops(fd: FormData) {
  'use server';
  const u = await requireRole('logistik');
  const season = await activeSeason();
  const rows = await q<{ shop: string; email: string | null; n: number }>(
    `select s.name as shop, s.email, count(*)::int as n
       from recipients r join handoffs h on h.id = r.handoff_id join shops s on s.id = h.shop_id
      where r.received_at is null and h.season_id = $1 group by s.name, s.email`,
    [season?.id],
  );
  const only = String(fd.get('shop') ?? '');
  let sent = 0;
  for (const r of rows) {
    if (!r.email || (only && only !== r.shop)) continue;
    await sendMail(
      r.email,
      'Påmindelse: gaver til aflevering',
      `Hej ${r.shop}\n\nVi mangler stadig ${r.n} gaver fra jer på logistikcentralen.\nFristen er ${datoTid(season?.dropoff_deadline)}.\n\nSe listen: ${appUrl()}/butik\n\nVenlig hilsen\nGaver For Dig`,
    );
    sent++;
  }
  await logEvent(u.email, 'season', season?.id ?? null, 'butikker rykket', `${sent} butikker`);
  redirect('/logistik?m=' + encodeURIComponent(`Påmindelse sendt til ${sent} butikker`));
}

export default async function LogisticsHome({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireRole('logistik');
  const sp = await searchParams;
  const season = await activeSeason();
  const orders = await q<O>(
    `select o.id, c.name as company, o.title, o.status, o.delivery_address,
            (select count(*)::int from recipients r where r.order_id = o.id and r.chosen_product_id is not null) as total,
            (select count(r.received_at)::int from recipients r where r.order_id = o.id) as got
       from gift_orders o join companies c on c.id = o.company_id
      where o.season_id = $1 and o.status in ('closed','packed','delivered')
      order by o.status = 'delivered', c.name`,
    [season?.id],
  );
  const missing = await q<Missing>(
    `select r.order_id, s.id as shop_id, s.name as shop, s.email, count(*)::int as n
       from recipients r join products p on p.id = r.chosen_product_id join shops s on s.id = p.shop_id
       join gift_orders o on o.id = r.order_id
      where o.season_id = $1 and o.status = 'closed' and r.received_at is null
      group by r.order_id, s.id, s.name, s.email`,
    [season?.id],
  );
  const today = await q<{ n: number }>(`select count(*)::int as n from recipients where received_at::date = now()::date`);
  const ready = orders.filter((o) => o.status === 'closed' && o.total > 0 && o.got >= o.total).length;
  const shopsMissing = new Set(missing.map((m) => m.shop)).size;
  const openOrders = await q<{ n: number }>(`select count(*)::int as n from gift_orders where season_id = $1 and status in ('confirmed','invited')`, [season?.id]);

  return (
    <Shell area="Logistikcentral" nav={logisticsNav} active="/logistik">
      <div className="stack">
        <div className="row between end">
          <div>
            <div className="eyebrow">{season?.name}</div>
            <h1>Ordrer pr. virksomhed</h1>
          </div>
          <Link className="btn" href="/logistik/modtag">
            Scan afleveringsseddel
          </Link>
        </div>
        <Notice msg={sp.m} />
        <div className="stats">
          <Stat label="Modtaget i dag" value={today[0]?.n ?? 0} />
          <Stat label="Klar til pakning" value={ready} tone="ok" />
          <Stat label="Butikker mangler at aflevere" value={shopsMissing} tone={shopsMissing ? 'bad' : undefined} />
          <Stat label="Ordrer i vælgeperiode" value={openOrders[0]?.n ?? 0} />
        </div>
        {orders.length === 0 && (
          <div className="card">
            <p className="muted">
              Ingen ordrer at pakke endnu. Ordrerne kommer her, når admin har lukket vælgeperioden ({dato(season?.choose_deadline)}).
            </p>
          </div>
        )}
        {shopsMissing > 0 && (
          <form action={nudgeShops} className="row">
            <button className="btn outline small" type="submit">
              Ryk alle butikker, der mangler at aflevere
            </button>
          </form>
        )}
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {orders.map((o) => {
            const done = o.total > 0 && o.got >= o.total;
            const miss = missing.filter((m) => m.order_id === o.id);
            return (
              <article key={o.id} className="card stack-s">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h2>{o.company}</h2>
                    <div className="small muted">
                      {o.title} · {o.delivery_address || 'ingen adresse'}
                    </div>
                  </div>
                  <Badge tone={o.status === 'delivered' ? 'ok' : o.status === 'packed' ? 'ok' : done ? 'ok' : 'warn'}>
                    {o.status === 'closed' ? (done ? 'Klar til pakning' : 'Afventer butikker') : ORDER_STATUS[o.status]}
                  </Badge>
                </div>
                <div className="row between small">
                  <span>Gaver modtaget</span>
                  <span>
                    {o.got} af {o.total}
                  </span>
                </div>
                <Progress pct={o.total ? (o.got / o.total) * 100 : 0} label={`${o.got} af ${o.total} gaver modtaget`} />
                <div className="small muted">{miss.length ? 'Mangler fra: ' + miss.map((m) => `${m.shop} (${m.n})`).join(', ') : 'Alle varer modtaget.'}</div>
                <Link className={`btn ${done || o.status !== 'closed' ? '' : 'outline'}`} href={`/logistik/ordre/${o.id}`}>
                  {o.status === 'closed' ? 'Pakkeliste og mærkater' : 'Se ordre'}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
