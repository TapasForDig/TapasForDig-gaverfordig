import { revalidatePath } from 'next/cache';
import { Badge, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, q } from '@/lib/db';
import { kr } from '@/lib/format';
import { getSetting } from '@/lib/gifts';
import { adminNav } from '../nav';

interface Group {
  key: string;
  name: string;
  towns: string | null;
  n: number;
  value: number;
  unpaid: number;
  companies: string;
  ids: number[];
}

async function markPaid(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const ids = String(fd.get('ids') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const paid = fd.get('paid') === '1';
  if (ids.length) {
    await q(`update recipients set donation_paid_at = ${paid ? 'now()' : 'null'} where id = any($1::int[]) and donation_to is not null`, [ids]);
    await logEvent(u.email, 'donation', null, paid ? 'udbetalt' : 'ikke udbetalt', String(fd.get('name') ?? ''));
  }
  revalidatePath('/admin/donationer');
}

export default async function Donations() {
  await requireRole('admin');
  const on = (await getSetting('donation_aktiv')).trim().toLowerCase() === 'ja';
  // Samme forening skrevet lidt forskelligt ("Brørup boldklub" / "Brørup Boldklub ") samles
  const groups = await q<Group>(
    `select lower(regexp_replace(trim(r.donation_to), '\\s+', ' ', 'g')) as key, min(r.donation_to) as name,
            string_agg(distinct r.donation_town, ', ') as towns, count(*)::int as n, sum(pc.value_kr)::int as value,
            coalesce(sum(pc.value_kr) filter (where r.donation_paid_at is null), 0)::int as unpaid,
            string_agg(distinct c.name, ', ') as companies, array_agg(r.id) as ids
       from recipients r join gift_orders o on o.id = r.order_id join price_categories pc on pc.id = o.price_category_id
       join companies c on c.id = o.company_id
      where r.donation_to is not null
      group by 1 order by unpaid desc, value desc`,
  );
  const total = groups.reduce((a, g) => a + g.value, 0);
  const unpaid = groups.reduce((a, g) => a + g.unpaid, 0);
  return (
    <Shell area="Admin" nav={adminNav} active="/admin/donationer">
      <div className="stack">
        <h1>Donationer til lokale foreninger</h1>
        <div className={`alert ${on ? '' : 'warn'}`}>
          {on
            ? 'Muligheden vises for medarbejderne i gaveshoppen.'
            : 'Muligheden er slået fra og vises ikke for medarbejderne. Slå den til under Sæson og priser (Donation til lokal forening = ja), når jeres rådgivere har sagt god for det.'}
        </div>
        <div className="stats">
          <div className="card stat">
            <div className="label">Foreninger</div>
            <div className="value">{groups.length}</div>
          </div>
          <div className="card stat">
            <div className="label">Doneret i alt (gavernes værdi ekskl. moms)</div>
            <div className="value">{kr(total)}</div>
          </div>
          <div className="card stat">
            <div className="label">Mangler at blive udbetalt</div>
            <div className={`value ${unpaid ? 'bad' : ''}`}>{kr(unpaid)}</div>
          </div>
        </div>
        <div className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Forening</th>
                  <th>Fra virksomheder</th>
                  <th className="num">Gaver</th>
                  <th className="num">Beløb</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key}>
                    <td>
                      <b>{g.name}</b>
                      {g.towns && <div className="small muted">{g.towns}</div>}
                    </td>
                    <td className="small">{g.companies}</td>
                    <td className="num">{g.n}</td>
                    <td className="num">{kr(g.value)}</td>
                    <td>{g.unpaid ? <Badge tone="warn">Mangler {kr(g.unpaid)}</Badge> : <Badge tone="ok">Udbetalt</Badge>}</td>
                    <td>
                      <form action={markPaid}>
                        <input type="hidden" name="ids" value={g.ids.join(',')} />
                        <input type="hidden" name="name" value={g.name} />
                        <input type="hidden" name="paid" value={g.unpaid ? '1' : '0'} />
                        <button className="btn small outline">{g.unpaid ? 'Markér udbetalt' : 'Fortryd'}</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Ingen donationer endnu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="small muted">
          Medarbejderne skriver selv foreningens navn, så kontrollér navnet, før I overfører. Navne, der kun adskiller sig ved store/små bogstaver og mellemrum, er lagt sammen.
        </p>
      </div>
    </Shell>
  );
}
