import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { TwoThings } from '@/components/TwoThings';
import { PublicHeader } from '@/components/ui';
import { kr } from '@/lib/format';
import { categories } from '@/lib/gifts';
import { incl, shopSettings } from '@/lib/purchase';

export const metadata: Metadata = {
  title: 'Sådan virker det – Gaver For Dig',
  description: 'Sådan fungerer lokale firmajulegaver: I bestiller, medarbejderne vælger selv en gave fra lokale butikker, og vi pakker og leverer samlet.',
};

export default async function HowItWorks() {
  const [s, cats] = await Promise.all([shopSettings(), categories()]);
  const low = cats.length ? Math.min(...cats.map((c) => c.value_kr)) : 300;
  const high = cats.length ? Math.max(...cats.map((c) => c.value_kr)) : 1100;
  return (
    <>
      <PublicHeader active="/saadan-virker-det" />
      <main className="wrap stack how" style={{ maxWidth: 1100 }}>
        <div className="stack-s" style={{ textAlign: 'center', alignItems: 'center' }}>
          <div className="eyebrow">Sådan virker det</div>
          <h1 style={{ maxWidth: 760 }}>Lokale julegaver – uden besvær for jer</h1>
          <p className="muted" style={{ fontSize: 18, maxWidth: 680 }}>
            Som gaveansvarlig bestiller du online og vælger gavebeløb. Gaver For Dig sørger for resten – fra gavekoder til levering.
          </p>
        </div>

        <TwoThings />

        <h2 style={{ textAlign: 'center', fontSize: 26, marginTop: 12 }}>Trin for trin</h2>

        {/* Overblik: fem trin på en linje */}
        <ol className="how-flow" aria-label="De fem trin">
          {(
            [
              ['receipt', 'I bestiller', 'Beløb, antal og uge'],
              ['mail', 'Koder sendes', 'Én pr. medarbejder'],
              ['gift', 'De vælger', 'Fra lokale butikker'],
              ['building', 'Vi pakker', 'Med navn på hver gave'],
              ['truck', 'Vi leverer', 'Samlet eller hjem'],
            ] as const
          ).map(([icon, t, d], i) => (
            <li key={t}>
              <span className="how-dot">
                <Icon name={icon} size={30} />
                <span className="how-n">{i + 1}</span>
              </span>
              <b>{t}</b>
              <span className="small muted">{d}</span>
            </li>
          ))}
        </ol>

        {/* Trin 1 */}
        <section className="how-step">
          <div className="how-text">
            <div className="how-num">1</div>
            <h2>I bestiller julegaverne</h2>
            <p className="muted">
              Vælg et gavebeløb mellem {kr(low)} og {kr(high)} ekskl. moms, hvor mange medarbejdere der skal have en gave, og hvilken uge gaverne skal leveres. Det tager få minutter, og
              I betaler på faktura eller EAN.
            </p>
            <ul className="how-list">
              <li>Minimum {s.minQty} gaver</li>
              <li>Levering hver uge frem til jul</li>
              <li>Julegaver op til 800 kr. ekskl. moms er skattefri</li>
            </ul>
          </div>
          <div className="how-art" aria-hidden="true">
            <div className="mock card">
              <div className="mock-title">Jeres bestilling</div>
              {[
                [500, 24],
                [800, 6],
              ].map(([v, n]) => (
                <div key={v} className="mock-row">
                  <span>Julegaver til {kr(v)}</span>
                  <b>{n} stk.</b>
                </div>
              ))}
              <div className="mock-row muted">
                <span>Levering</span>
                <span>Uge 49 · til jer</span>
              </div>
              <div className="mock-btn">Bestil julegaver</div>
            </div>
          </div>
        </section>

        {/* Trin 2 */}
        <section className="how-step flip">
          <div className="how-text">
            <div className="how-num">2</div>
            <h2>Hver medarbejder får en gavekode</h2>
            <p className="muted">
              Vi sender koderne til jer, så I selv kan dele dem ud – på mail eller printet. Eller I giver os en liste, så sender vi en personlig mail direkte til hver medarbejder med jeres
              egen hilsen.
            </p>
          </div>
          <div className="how-art" aria-hidden="true">
            <div className="phone">
              <div className="phone-bar" />
              <div className="phone-mail">
                <div className="small muted">Fra: Gaver For Dig</div>
                <b>Din julegave fra Firma A/S</b>
                <p className="small">Hej Anne – i år vælger du selv din julegave fra lokale butikker.</p>
                <div className="code">ABCD-EFGH</div>
                <div className="mock-btn">Vælg din gave</div>
              </div>
            </div>
          </div>
        </section>

        {/* Trin 3 */}
        <section className="how-step">
          <div className="how-text">
            <div className="how-num">3</div>
            <h2>Medarbejderne vælger selv</h2>
            <p className="muted">
              Med koden kommer medarbejderen ind i gaveshoppen og ser gaverne i jeres prisgruppe – uden priser. Mad og drikke, bolig, mode, velvære og oplevelser fra butikker i hele
              kommunen. Den, der ikke når at vælge, får den standardgave, I har valgt.
            </p>
          </div>
          <div className="how-art" aria-hidden="true">
            <div className="gifts">
              {[
                ['Mad og drikke', 'Delikatessekurv', '#7b2d3b'],
                ['Bolig', 'Lysestager i messing', '#415743'],
                ['Velvære', 'Gavebevis på massage', '#2e3d31'],
                ['Oplevelser', 'Middag for to', '#93404f'],
              ].map(([k, n, c]) => (
                <div key={n} className="gift card">
                  <div className="gift-img" style={{ background: c }}>
                    <Icon name="gift" size={34} />
                  </div>
                  <div className="eyebrow" style={{ fontSize: 10 }}>
                    {k}
                  </div>
                  <b className="small">{n}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trin 4 */}
        <section className="how-step flip">
          <div className="how-text">
            <div className="how-num">4</div>
            <h2>Butikkerne leverer – vi pakker</h2>
            <p className="muted">
              Når fristen er gået, afleverer butikkerne de valgte gaver hos os i Brørup. Vi sætter navn på hver gave, så det er nemt at dele ud. Vælger I gaveindpakning, kommer gaverne
              pakket pænt ind – ellers i en mulepose.
            </p>
          </div>
          <div className="how-art" aria-hidden="true">
            <div className="parcel">
              <div className="parcel-box">
                <div className="parcel-ribbon" />
                <div className="parcel-label">
                  <span className="small muted">Til</span>
                  <b>Anne Jensen</b>
                  <span className="small muted">Firma A/S · Salg</span>
                </div>
              </div>
              <div className="parcel-shops small muted">
                <span>
                  <Icon name="pin" size={14} /> Brørup
                </span>
                <span>
                  <Icon name="pin" size={14} /> Vejen
                </span>
                <span>
                  <Icon name="pin" size={14} /> Rødding
                </span>
                <span>
                  <Icon name="pin" size={14} /> Holsted
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Trin 5 */}
        <section className="how-step">
          <div className="how-text">
            <div className="how-num">5</div>
            <h2>Vi leverer det hele samlet</h2>
            <p className="muted">Alle gaver kommer i én levering til jeres adresse i den uge, I har valgt – eller sendt direkte hjem til hver medarbejder.</p>
          </div>
          <div className="how-art" aria-hidden="true">
            <div className="deliver">
              <div className="deliver-opt card">
                <Icon name="building" size={30} />
                <b>Til virksomheden</b>
                <span className="small muted">Gratis</span>
              </div>
              <div className="deliver-opt card">
                <Icon name="home" size={30} />
                <b>Hjem til medarbejderen</b>
                <span className="small muted">{kr(s.homeFee)} ekskl. moms pr. gave</span>
              </div>
            </div>
          </div>
        </section>

        {/* Priser */}
        <section className="card stack-s">
          <h2>Det koster det</h2>
          <div className="how-prices">
            <div>
              <div className="eyebrow">Gaven</div>
              <b>
                {kr(low)}–{kr(high)}
              </b>
              <span className="small muted">
                ekskl. moms ({kr(incl(low))}–{kr(incl(high))} inkl.)
              </span>
            </div>
            <div>
              <div className="eyebrow">Levering til jer</div>
              <b>Gratis</b>
              <span className="small muted">Samlet i én levering</span>
            </div>
            <div>
              <div className="eyebrow">Levering hjem</div>
              <b>{kr(s.homeFee)}</b>
              <span className="small muted">ekskl. moms pr. gave</span>
            </div>
            <div>
              <div className="eyebrow">Gaveindpakning</div>
              <b>{kr(s.wrapFee)}</b>
              <span className="small muted">ekskl. moms pr. gave · ellers mulepose</span>
            </div>
          </div>
        </section>

        <section className="dark-card row between" style={{ gap: 20 }}>
          <div className="stack-s" style={{ flex: '1 1 420px' }}>
            <h2 style={{ fontSize: 24 }}>Klar til årets julegaver?</h2>
            <p className="muted">
              Se <Link href="/levering" style={{ color: '#fff' }}>deadlines for hver uge</Link> og <Link href="/skatteregler" style={{ color: '#fff' }}>skattereglerne</Link>, eller kontakt os,
              hvis I har spørgsmål.
            </p>
          </div>
          <div className="row">
            <Link href="/bestil" className="btn light">
              Bestil julegaver
            </Link>
            <Link href="/kontakt" className="btn" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.6)' }}>
              Kontakt os
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
