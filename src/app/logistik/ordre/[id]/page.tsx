import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Notice } from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { requireRole } from '@/lib/auth';
import { logEvent, q } from '@/lib/db';
import { dato, str } from '@/lib/format';
import { getOrder, ORDER_STATUS } from '@/lib/gifts';
import { sendMail } from '@/lib/mail';

interface Item {
  id: number;
  name: string;
  department: string | null;
  product: string;
  shop: string;
  received_at: Date | null;
}

async function setStatus(fd: FormData) {
  'use server';
  const u = await requireRole('logistik');
  const o = await getOrder(Number(fd.get('order')));
  if (!o) redirect('/logistik');
  const to = String(fd.get('to'));
  if (to === 'packed') {
    await q(`update gift_orders set status = 'packed', packed_at = now() where id = $1`, [o.id]);
    await logEvent(u.email, 'order', o.id, 'pakket');
  } else if (to === 'delivered') {
    const who = str(fd, 'who');
    await q(`update gift_orders set status = 'delivered', delivered_at = now(), delivered_to = $2 where id = $1`, [o.id, who]);
    await logEvent(u.email, 'order', o.id, 'leveret', who);
    const users = await q<{ email: string }>(`select email from users where company_id = $1`, [o.company_id]);
    for (const x of users) {
      await sendMail(x.email, `Jeres gaver er leveret: ${o.title}`, `Hej\n\nGaverne til ${o.title} er leveret${who ? ` og modtaget af ${who}` : ''}.\nHver gave har en navnemærkat.\n\nGod fornøjelse og glædelig jul!\nGaver For Dig`);
    }
  }
  redirect(`/logistik/ordre/${o.id}?m=${encodeURIComponent(to === 'packed' ? 'Markeret som pakket' : 'Markeret som leveret')}`);
}

export default async function PackOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  await requireRole('logistik');
  const { id } = await params;
  const sp = await searchParams;
  const o = await getOrder(Number(id));
  if (!o) notFound();
  const items = await q<Item>(
    `select r.id, r.name, r.department, p.name as product, s.name as shop, r.received_at
       from recipients r join products p on p.id = r.chosen_product_id join shops s on s.id = p.shop_id
      where r.order_id = $1 order by r.department nulls last, r.name`,
    [o.id],
  );
  const missing = items.filter((i) => !i.received_at).length;
  const byProduct = Object.entries(
    items.reduce<Record<string, number>>((acc, i) => {
      const k = `${i.product} · ${i.shop}`;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  );

  return (
    <main className="wrap stack">
      <div className="row between no-print">
        <Link href="/logistik">← Alle ordrer</Link>
        <div className="row">
          <PrintButton label="Print pakkeliste og mærkater" />
          {o.status === 'closed' && (
            <form action={setStatus}>
              <input type="hidden" name="order" value={o.id} />
              <input type="hidden" name="to" value="packed" />
              <button className="btn small" type="submit" disabled={missing > 0}>
                Markér som pakket
              </button>
            </form>
          )}
          {o.status === 'packed' && (
            <form action={setStatus} className="row">
              <input type="hidden" name="order" value={o.id} />
              <input type="hidden" name="to" value="delivered" />
              <input type="text" name="who" placeholder="Modtaget af (navn)" aria-label="Modtaget af" style={{ width: 200, minHeight: 36 }} />
              <button className="btn small" type="submit">
                Markér som leveret
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="no-print">
        <Notice msg={sp.m} />
        {missing > 0 && o.status === 'closed' && <div className="alert warn">{missing} gaver er ikke modtaget endnu. Ordren kan pakkes, når alle er her.</div>}
      </div>

      <section className="print-sheet card stack">
        <div className="row between">
          <div>
            <img src="/logo.png" alt="Gaver For Dig" width={195} height={29} /><div style={{ fontWeight: 700, letterSpacing: '.04em' }}>PAKKESEDDEL</div>
            <h1 style={{ fontSize: 30 }}>{o.company_name}</h1>
            <div>
              {o.title} · {items.length} gaver
            </div>
            <div className="small">
              {o.delivery_address} · {o.delivery_contact}
              {o.delivery_note ? ` · ${o.delivery_note}` : ''}
            </div>
          </div>
          <Badge tone={o.status === 'delivered' ? 'ok' : undefined}>{ORDER_STATUS[o.status]}</Badge>
        </div>
        <table className="table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>Gave</th>
              <th className="num">Antal</th>
            </tr>
          </thead>
          <tbody>
            {byProduct.map(([k, n]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="num">
                  <b>{n}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>Modtager</th>
              <th>Afdeling</th>
              <th>Gave</th>
              <th className="no-print">Modtaget</th>
              <th>Pakket</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.department ?? ''}</td>
                <td>{i.product}</td>
                <td className="no-print">{i.received_at ? <Badge tone="ok">Ja</Badge> : <Badge tone="bad">Mangler</Badge>}</td>
                <td>☐</td>
              </tr>
            ))}
          </tbody>
        </table>
        {o.delivered_at && (
          <p className="small">
            Leveret {dato(o.delivered_at)}
            {o.delivered_to ? ` · modtaget af ${o.delivered_to}` : ''}
          </p>
        )}
      </section>

      <section className="print-sheet" style={{ pageBreakBefore: 'always' }}>
        <h2 className="no-print" style={{ marginBottom: 12 }}>
          Navnemærkater
        </h2>
        <div className="labels">
          {items.map((i) => (
            <div key={i.id} className="label-card">
              <img src="/logo.png" alt="Gaver For Dig" width={110} height={17} />
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{i.name}</div>
              <div className="small">
                {o.company_name}
                {i.department ? ` · ${i.department}` : ''}
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                {i.product}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
