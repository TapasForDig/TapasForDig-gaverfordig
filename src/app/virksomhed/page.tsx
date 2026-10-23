import Link from 'next/link';
import { Badge, Progress, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { dato, datoTid, kr } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/gifts';
import { weekLabel } from '@/lib/purchase';
import { companyNav } from './nav';

interface PRow {
  id: number;
  company_name: string;
  delivery_week: string;
  delivery_date: Date;
  choose_deadline: Date;
  quantity: number;
  total_inc: number;
  delivery_mode: string;
  chosen: number;
  status: string;
  created_at: Date;
}
interface ORow {
  id: number;
  title: string;
  status: string;
  total: number;
  chosen: number;
}

export default async function CompanyHome() {
  const u = await requireRole('virksomhed');
  const companyId = u.role === 'admin' ? null : u.company_id;
  const company = companyId ? await one<{ name: string }>('select name from companies where id = $1', [companyId]) : undefined;
  const purchases = await q<PRow>(
    `select p.id, p.company_name, p.delivery_week, p.delivery_date, p.choose_deadline, p.quantity, p.total_inc, p.delivery_mode, p.created_at,
            (select count(r.chosen_product_id)::int from recipients r join gift_orders o on o.id = r.order_id where o.purchase_id = p.id) as chosen,
            (select case min(case o.status when 'closed' then 2 when 'packed' then 3 when 'delivered' then 4 else 1 end)
                      when 2 then 'closed' when 3 then 'packed' when 4 then 'delivered' else 'confirmed' end
               from gift_orders o where o.purchase_id = p.id) as status
       from purchases p where ($1::int is null or p.company_id = $1) order by p.created_at desc`,
    [companyId],
  );
  // Ældre ordrer fra før webshoppen
  const legacy = await q<ORow>(
    `select o.id, o.title, o.status,
            (select count(*)::int from recipients r where r.order_id = o.id) as total,
            (select count(chosen_product_id)::int from recipients r where r.order_id = o.id) as chosen
       from gift_orders o where o.purchase_id is null and ($1::int is null or o.company_id = $1) order by o.created_at desc`,
    [companyId],
  );
  return (
    <Shell area={company?.name ?? 'Virksomhed'} nav={companyNav} active="/virksomhed">
      <div className="stack">
        <div className="row between end">
          <div>
            <div className="eyebrow">{company?.name ?? 'Alle virksomheder (admin)'}</div>
            <h1>Mine bestillinger</h1>
          </div>
          <Link className="btn" href="/bestil">
            + Ny bestilling
          </Link>
        </div>
        {purchases.length === 0 && legacy.length === 0 && (
          <div className="card stack-s">
            <h2>Ingen bestillinger endnu</h2>
            <p className="muted">Bestil julegavekort til jeres medarbejdere – det tager få minutter.</p>
            <div>
              <Link className="btn" href="/bestil">
                Bestil gavekort
              </Link>
            </div>
          </div>
        )}
        <div className="tiles">
          {purchases.map((p) => (
            <Link key={p.id} href={`/virksomhed/bestilling/${p.id}`} className="card stack-s" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row between">
                <h2>
                  Ordre {p.id} · {p.quantity} gavekort
                </h2>
                <Badge tone={p.status === 'delivered' ? 'ok' : p.status === 'closed' || p.status === 'packed' ? undefined : 'warn'}>
                  {p.status === 'confirmed' || p.status === 'invited' ? 'Medarbejderne vælger' : ORDER_STATUS[p.status]}
                </Badge>
              </div>
              <div className="small muted">
                {u.role === 'admin' && `${p.company_name} · `}
                {weekLabel(p.delivery_week)} (senest {dato(p.delivery_date)}) · {p.delivery_mode === 'home' ? 'hjemmelevering' : 'til virksomheden'} · {kr(p.total_inc)}
              </div>
              <div className="small muted">Vælg senest {datoTid(p.choose_deadline)}</div>
              <div className="row between small">
                <span>Har valgt gave</span>
                <span>
                  {p.chosen} af {p.quantity}
                </span>
              </div>
              <Progress pct={p.quantity ? (p.chosen / p.quantity) * 100 : 0} label={`${p.chosen} af ${p.quantity} har valgt`} />
            </Link>
          ))}
          {legacy.map((o) => (
            <Link key={`o${o.id}`} href={`/virksomhed/ordre/${o.id}`} className="card stack-s" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row between">
                <h2>{o.title}</h2>
                <Badge>{ORDER_STATUS[o.status]}</Badge>
              </div>
              <div className="row between small">
                <span>Har valgt</span>
                <span>
                  {o.chosen} af {o.total}
                </span>
              </div>
              <Progress pct={o.total ? (o.chosen / o.total) * 100 : 0} label={`${o.chosen} af ${o.total} har valgt`} />
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
