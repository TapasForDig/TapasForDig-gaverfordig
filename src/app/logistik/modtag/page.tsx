import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Notice, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { dato, str } from '@/lib/format';
import { logisticsNav } from '../nav';

interface H {
  id: number;
  code: string;
  shop: string;
  handed_at: Date | null;
  received_at: Date | null;
  n: number;
  got: number;
}
interface Item {
  id: number;
  product: string;
  company: string;
  recipient: string;
  received_at: Date | null;
  missing: boolean;
}

async function lookup(fd: FormData) {
  'use server';
  await requireRole('logistik');
  const code = str(fd, 'code').toUpperCase();
  const h = await one<{ id: number }>('select id from handoffs where upper(code) = $1', [code]);
  redirect(h ? `/logistik/modtag?h=${h.id}` : `/logistik/modtag?m=${encodeURIComponent('!Ukendt kode: ' + code)}`);
}

async function receive(fd: FormData) {
  'use server';
  const u = await requireRole('logistik');
  const hId = Number(fd.get('handoff'));
  const missingIds = fd.getAll('missing').map(Number);
  await q(
    `update recipients set received_at = case when id = any($2::int[]) then null else coalesce(received_at, now()) end,
                           missing = id = any($2::int[])
      where handoff_id = $1`,
    [hId, missingIds],
  );
  await q('update handoffs set received_at = now(), handed_at = coalesce(handed_at, now()) where id = $1', [hId]);
  await logEvent(u.email, 'handoff', hId, 'modtaget', missingIds.length ? `${missingIds.length} mangler` : 'komplet');
  redirect(`/logistik/modtag?h=${hId}&m=${encodeURIComponent(missingIds.length ? `Registreret. ${missingIds.length} gaver markeret som manglende.` : 'Alle varer er registreret som modtaget.')}`);
}

export default async function Receive({ searchParams }: { searchParams: Promise<{ h?: string; m?: string }> }) {
  await requireRole('logistik');
  const sp = await searchParams;
  const handoffs = await q<H>(
    `select h.id, h.code, s.name as shop, h.handed_at, h.received_at,
            (select count(*)::int from recipients r where r.handoff_id = h.id) as n,
            (select count(r.received_at)::int from recipients r where r.handoff_id = h.id) as got
       from handoffs h join shops s on s.id = h.shop_id order by h.received_at is not null, s.name`,
  );
  const sel = sp.h ? handoffs.find((h) => h.id === Number(sp.h)) : undefined;
  const items = sel
    ? await q<Item>(
        `select r.id, p.name as product, c.name as company, r.name as recipient, r.received_at, r.missing
           from recipients r join products p on p.id = r.chosen_product_id
           join gift_orders o on o.id = r.order_id join companies c on c.id = o.company_id
          where r.handoff_id = $1 order by p.name, c.name, r.name`,
        [sel.id],
      )
    : [];

  return (
    <Shell area="Logistikcentral" nav={logisticsNav} active="/logistik/modtag">
      <div className="split">
        <div className="main stack">
          <h1>Modtag varer</h1>
          <Notice msg={sp.m} />
          <form action={lookup} className="card row">
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label htmlFor="code">Scan QR-koden eller skriv koden fra afleveringssedlen</label>
              <input id="code" name="code" type="text" autoFocus placeholder="GFD-XXXXXX" autoComplete="off" />
            </div>
            <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
              Find seddel
            </button>
          </form>

          {sel && (
            <form action={receive} className="card flush">
              <input type="hidden" name="handoff" value={sel.id} />
              <div className="card-head">
                <div>
                  <h2>
                    {sel.shop} · {sel.code}
                  </h2>
                  <div className="small muted">{sel.n} gaver. Sæt kryds ved dem, der mangler eller er skadet.</div>
                </div>
                {sel.received_at && <Badge tone="ok">Registreret {dato(sel.received_at)}</Badge>}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Gave</th>
                      <th>Til</th>
                      <th>Mangler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.product}</td>
                        <td className="small">
                          {i.recipient}
                          <div className="muted">{i.company}</div>
                        </td>
                        <td>
                          <label className="check">
                            <input type="checkbox" name="missing" value={i.id} defaultChecked={i.missing} aria-label={`${i.product} til ${i.recipient} mangler`} />
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-foot">
                <button className="btn" type="submit">
                  Registrér som modtaget
                </button>
              </div>
            </form>
          )}
        </div>
        <aside className="side">
          <div className="card flush">
            <div className="card-head">
              <h2>Afleveringssedler</h2>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {handoffs.map((h) => (
                <li key={h.id} style={{ borderTop: '1px solid var(--line-soft)', padding: '12px 20px' }} className="row between small">
                  <Link href={`/logistik/modtag?h=${h.id}`}>
                    <b>{h.shop}</b> · {h.code}
                  </Link>
                  {h.received_at ? (
                    <Badge tone={h.got === h.n ? 'ok' : 'warn'}>
                      {h.got}/{h.n}
                    </Badge>
                  ) : h.handed_at ? (
                    <Badge tone="warn">Afleveret</Badge>
                  ) : (
                    <Badge>Venter</Badge>
                  )}
                </li>
              ))}
              {handoffs.length === 0 && <li className="small muted" style={{ padding: '12px 20px' }}>Ingen endnu.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
