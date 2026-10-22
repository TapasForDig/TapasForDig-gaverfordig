import QRCode from 'qrcode';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { one, q } from '@/lib/db';
import { datoTid } from '@/lib/format';
import { activeSeason, getSetting } from '@/lib/gifts';
import { myShop } from '../../shop';
import { PrintButton } from '@/components/PrintButton';

export default async function HandoffSheet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ butik?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { shop } = await myShop(sp.butik);
  const h = await one<{ id: number; code: string }>('select id, code from handoffs where id = $1 and shop_id = $2', [Number(id), shop.id]);
  if (!h) notFound();
  const [season, dropAddr] = await Promise.all([activeSeason(), getSetting('logistik_adresse')]);
  const lines = await q<{ product: string; company: string; n: number }>(
    `select p.name as product, c.name as company, count(*)::int as n
       from recipients r join products p on p.id = r.chosen_product_id
       join gift_orders o on o.id = r.order_id join companies c on c.id = o.company_id
      where r.handoff_id = $1 group by p.name, c.name order by p.name, c.name`,
    [h.id],
  );
  const total = lines.reduce((s, l) => s + l.n, 0);
  const qr = await QRCode.toDataURL(h.code, { margin: 1, width: 180 });
  return (
    <main className="wrap">
      <div className="row no-print" style={{ marginBottom: 16 }}>
        <Link href={`/butik${sp.butik ? `?butik=${sp.butik}` : ''}`}>← Tilbage</Link>
        <PrintButton />
      </div>
      <div className="print-sheet card stack">
        <div className="row between">
          <div className="stack-s">
            <div style={{ fontWeight: 700, letterSpacing: '.04em' }}>GAVER FOR DIG · AFLEVERINGSSEDDEL</div>
            <h1 style={{ fontSize: 30 }}>{shop.name}</h1>
            <div>
              Seddel <b>{h.code}</b> · {total} gaver
            </div>
            <div className="small">Afleveres senest {datoTid(season?.dropoff_deadline)} · {dropAddr}</div>
          </div>
          <img src={qr} alt={`QR-kode ${h.code}`} width={150} height={150} />
        </div>
        <table className="table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Virksomhed</th>
              <th className="num">Antal</th>
              <th>Talt op</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.product + l.company}>
                <td>{l.product}</td>
                <td>{l.company}</td>
                <td className="num">
                  <b>{l.n}</b>
                </td>
                <td>☐</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid-2 small" style={{ marginTop: 24 }}>
          <div>Afleveret af: ______________________</div>
          <div>Modtaget af: ______________________</div>
        </div>
      </div>
    </main>
  );
}
