import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, PublicHeader } from '@/components/ui';
import { deliveryWeeks, shopSettings } from '@/lib/purchase';

export const metadata: Metadata = {
  title: 'Levering og deadlines – Gaver For Dig',
  description: 'Levering af firmajulegaver hver uge frem til jul. Se hvornår I senest skal bestille, og hvornår medarbejderne skal have valgt deres gave.',
  alternates: { canonical: '/levering' },
};

const fmt = (d: Date | string) => new Date(d).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Copenhagen' });

export default async function Delivery() {
  const s = await shopSettings();
  const weeks = deliveryWeeks(s);
  // Bestillingen skal være lagt mindst 3 dage før medarbejdernes frist, så I kan nå at dele koderne ud
  const orderBy = (choose: string) => new Date(new Date(choose).getTime() - 3 * 86400000);
  return (
    <>
      <PublicHeader />
      <main className="wrap stack" style={{ maxWidth: 960 }}>
        <div className="stack-s">
          <div className="eyebrow">Julen {weeks[0]?.year}</div>
          <h1>Levering hver uge frem til jul</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 680 }}>
            Vælg den uge, gaverne skal leveres. Jo tidligere uge, jo tidligere skal I bestille – og jo tidligere skal medarbejderne have valgt deres gave.
          </p>
        </div>

        <section className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Levering</th>
                  <th>I bestiller senest</th>
                  <th>Medarbejderne vælger senest</th>
                  <th>Leveret senest</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.key} style={w.available ? undefined : { opacity: 0.55 }}>
                    <td>
                      <b style={{ fontSize: 18 }}>Uge {w.week}</b>
                    </td>
                    <td>{w.closed ? '–' : fmt(orderBy(w.chooseDeadline))}</td>
                    <td>{w.closed ? '–' : fmt(w.chooseDeadline)}</td>
                    <td>{w.closed ? '–' : fmt(w.deliveryDate + 'T12:00:00Z')}</td>
                    <td>
                      {w.available ? (
                        <Link href="/bestil" className="btn small">
                          Bestil
                        </Link>
                      ) : (
                        <Badge>{w.closed ? 'Ingen levering' : 'Fristen er overskredet'}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tiles">
          <div className="card stack-s">
            <h2>I bestiller</h2>
            <p className="muted small">Bestil julegaverne senest den dato, der står ud for ugen. Så har I mindst 3 dage til at dele gavekoderne ud – eller vi sender dem direkte til medarbejderne.</p>
          </div>
          <div className="card stack-s">
            <h2>Medarbejderne vælger</h2>
            <p className="muted small">Hver medarbejder vælger sin gave inden fristen. Den, der ikke når det, får den standardgave, I har valgt.</p>
          </div>
          <div className="card stack-s">
            <h2>Vi leverer</h2>
            <p className="muted small">Gaverne pakkes med navn og leveres samlet til jer – eller til medarbejdernes hjemmeadresser – senest fredag i den valgte uge.</p>
          </div>
        </section>

        <div className="row">
          <Link href="/bestil" className="btn">
            Bestil julegaver
          </Link>
          <Link href="/kontakt" className="btn outline">
            Spørgsmål? Kontakt os
          </Link>
        </div>
      </main>
    </>
  );
}
