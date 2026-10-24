import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { PrintButton } from '@/components/PrintButton';
import { appUrl, datoTid } from '@/lib/format';
import { one, q } from '@/lib/db';
import { codeLink, purchaseCodes } from '@/lib/purchase';
import { ownPurchase } from '../../access';

// Printbare gavekoder – én pr. medarbejder, med kode og QR til det personlige link
export default async function PrintCodes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { u, p } = await ownPurchase(Number(id));
  if (p.hold && u.role !== 'admin') redirect(`/virksomhed/bestilling/${p.id}`);
  const codes = await purchaseCodes(p.id);
  const company = await one<{ logo: string | null }>('select logo from companies where id = $1', [p.company_id]);
  const greetings = new Map((await q<{ id: number; greeting: string | null }>('select id, greeting from gift_orders where purchase_id = $1', [p.id])).map((g) => [g.id, g.greeting]));
  const qrs = await Promise.all(codes.map((c) => QRCode.toDataURL(codeLink(c.token), { margin: 1, width: 160 })));
  return (
    <main className="wrap">
      <div className="row no-print" style={{ marginBottom: 16 }}>
        <Link href={`/virksomhed/bestilling/${p.id}`}>← Tilbage</Link>
        <PrintButton label="Print gavekoder" />
        <span className="small muted">{codes.length} gavekoder · 6 pr. side</span>
      </div>
      <div className="giftcards">
        {codes.map((c, i) => (
          <div key={c.id} className="giftcard">
            <div className="row between" style={{ flexWrap: 'nowrap' }}>
              {company?.logo ? <img src={company.logo} alt={p.company_name} className="giftcard-logo" /> : <b>{p.company_name}</b>}
              <img src="/logo.png" alt="Gaver For Dig" width={110} height={17} />
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Julegave fra <b>{p.company_name}</b>
            </div>
            {greetings.get(c.order_id) && <div className="small giftcard-greeting">{greetings.get(c.order_id)}</div>}
            <div className="row" style={{ marginTop: 10, flexWrap: 'nowrap', gap: 12 }}>
              <img src={qrs[i]} alt="" width={86} height={86} />
              <div>
                <div className="small">Din gavekode</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'ui-monospace, monospace', letterSpacing: '.04em' }}>{c.code}</div>
                <div className="small">
                  Vælg din gave på <b>{appUrl().replace(/^https?:\/\//, '')}/gave</b>
                </div>
              </div>
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Vælg senest {datoTid(p.choose_deadline)}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
