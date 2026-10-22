import Link from 'next/link';
import { Badge, Progress, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { dato, kr } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/gifts';
import { companyNav } from './nav';

interface Row {
  id: number;
  title: string;
  status: string;
  category_name: string;
  value_kr: number;
  season_name: string;
  choose_deadline: Date | null;
  total: number;
  chosen: number;
}

export default async function CompanyHome() {
  const u = await requireRole('virksomhed');
  const companyId = u.company_id;
  const company = companyId ? await one<{ name: string }>('select name from companies where id = $1', [companyId]) : undefined;
  const orders = await q<Row>(
    `select o.id, o.title, o.status, pc.name as category_name, pc.value_kr, s.name as season_name, s.choose_deadline,
            (select count(*)::int from recipients r where r.order_id = o.id) as total,
            (select count(chosen_product_id)::int from recipients r where r.order_id = o.id) as chosen
       from gift_orders o join price_categories pc on pc.id = o.price_category_id join seasons s on s.id = o.season_id
      where ($1::int is null or o.company_id = $1)
      order by o.created_at desc`,
    [companyId],
  );
  return (
    <Shell area={company?.name ?? 'Virksomhed'} nav={companyNav} active="/virksomhed">
      <div className="stack">
        <div className="row between end">
          <div>
            <div className="eyebrow">{company?.name ?? 'Alle virksomheder (admin)'}</div>
            <h1>Mine gaveordrer</h1>
          </div>
          <Link className="btn" href="/virksomhed/ny">
            + Ny gaveordre
          </Link>
        </div>
        {orders.length === 0 && (
          <div className="card stack-s">
            <h2>Ingen gaveordrer endnu</h2>
            <p className="muted">Opret jeres første gaveordre: vælg priskategori, tilføj medarbejdere, og send invitationerne.</p>
            <div>
              <Link className="btn" href="/virksomhed/ny">
                Opret gaveordre
              </Link>
            </div>
          </div>
        )}
        <div className="tiles">
          {orders.map((o) => (
            <Link key={o.id} href={`/virksomhed/ordre/${o.id}`} className="card stack-s" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row between">
                <h2>{o.title}</h2>
                <Badge tone={o.status === 'draft' ? 'warn' : o.status === 'delivered' ? 'ok' : undefined}>{ORDER_STATUS[o.status]}</Badge>
              </div>
              <div className="small muted">
                {o.season_name} · {o.category_name} ({kr(o.value_kr)}) · vælg senest {dato(o.choose_deadline)}
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
