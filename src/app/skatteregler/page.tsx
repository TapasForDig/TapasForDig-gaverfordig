import type { Metadata } from 'next';
import { breadcrumbs, faq } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import Link from 'next/link';
import { PublicHeader } from '@/components/ui';
import { kr } from '@/lib/format';
import { categories } from '@/lib/gifts';
import { incl } from '@/lib/purchase';

export const metadata: Metadata = {
  alternates: { canonical: '/skatteregler' },
  title: 'Skatteregler for firmagaver 2026 – Gaver For Dig',
  description: 'Hvor meget må en skattefri julegave koste i 2026? Overblik over beløbsgrænser, gavekort, jubilæum og moms for firmagaver til medarbejdere.',
};

// Skattestyrelsens egne eksempler (skat.dk, 2026)
const EXAMPLES: [string, string, string, string][] = [
  ['1.000 kr.', '–', 'Skattefri', 'Julegaven er højst 1.000 kr.'],
  ['1.400 kr.', '–', 'Skattefri', 'Samlet højst 1.400 kr. i året'],
  ['900 kr.', '500 kr.', 'Skattefri', 'Samlet 1.400 kr. – under grænsen'],
  ['900 kr.', '600 kr.', '600 kr. beskattes', 'Samlet over 1.400 kr., men julegaven er under 1.000 kr.'],
  ['1.010 kr.', '400 kr.', '1.410 kr. beskattes', 'Begge grænser er overskredet'],
];

const FAQ: [string, string][] = [
  [
    'Er gaverne fra Gaver For Dig skattefri?',
    'Ja, når I holder jer inden for grænserne. Medarbejderen vælger én fysisk gave fra et udvalg af lokale varer, og gaven bliver leveret til jer eller til medarbejderens adresse. Der er ingen kontanter og intet gavekort, der kan bruges frit i en butik. Vælg en julegave til højst 800 kr. ekskl. moms (1.000 kr. inkl. moms), så er den skattefri, uanset hvad medarbejderen ellers har fået i årets løb.',
  ],
  [
    'Hvad sker der, hvis grænsen bliver overskredet?',
    'Overstiger de samlede gaver og mindre personalegoder 1.400 kr. i 2026, skal medarbejderen betale skat af hele beløbet – ikke kun det, der ligger over grænsen. Julegaven er dog altid skattefri, hvis den er højst 1.000 kr.',
  ],
  [
    'Må vi give flere gaver i løbet af året?',
    'Ja. Gaver og mindre personalegoder må tilsammen være op til 1.400 kr. i 2026. Giver I fx en påskegave og en julegave, tæller begge med.',
  ],
  [
    'Er et gavekort skattefrit?',
    'Det afhænger af gavekortet. Gavekort, der kan veksles til kontanter, digitale gavekort og gavekort med bred anvendelse (fx til et stormagasin, et supermarked eller en hel butiks sortiment) er skattepligtige. Et gavekort til få bestemte varer, som arbejdsgiveren har valgt, kan være skattefrit inden for grænsen.',
  ],
  [
    'Kan vi give penge i stedet?',
    'Nej, ikke skattefrit. Kontanter er altid skattepligtige for medarbejderen og skal indberettes som A-indkomst.',
  ],
  [
    'Kan virksomheden trække moms og udgift fra?',
    'Der er ikke fradrag for moms på gaver til medarbejdere, uanset beløbet. Grænserne gælder derfor beløbet inkl. moms, selvom vores priser står ekskl. moms. Selve udgiften kan virksomheden normalt trække fra som en driftsudgift.',
  ],
  [
    'Hvad skal vi gemme som dokumentation?',
    'Gem fakturaen og oversigten over, hvem der har fået hvad. Den kan I hente som en liste fra jeres ordre her på siden.',
  ],
];

export default async function TaxRules() {
  const cats = await categories();
  return (
    <>
      <PublicHeader active="/skatteregler" />
      <JsonLd data={[faq(FAQ), breadcrumbs([['Forside', '/'], ['Skatteregler', '/skatteregler']])]} />

      <section className="hero" style={{ paddingBottom: 24 }}>
        <div className="stack-s" style={{ flex: '1 1 600px' }}>
          <div className="eyebrow">Skatteregler for firmagaver · 2026</div>
          <h1>Hvor meget må firmagaven koste?</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 680 }}>
            Gaver fra arbejdsgiveren er som udgangspunkt skattepligtige for medarbejderen, men der er tre vigtige undtagelser. Her er reglerne kort fortalt, så I kan give en gave, der er skattefri.
          </p>
        </div>
      </section>

      <main className="wrap stack" style={{ paddingTop: 0 }}>
        <section className="tiles">
          <div className="dark-card stack-s">
            <div className="eyebrow" style={{ color: 'var(--green-light)' }}>
              Julegave
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>1.000 kr.</div>
            <p className="muted">pr. medarbejder inkl. moms. Altid skattefri, hvis det er en fysisk gave – også selvom medarbejderen har fået andre gaver i året.</p>
          </div>
          <div className="card stack-s">
            <div className="eyebrow">Gaver i alt pr. år</div>
            <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>1.400 kr.</div>
            <p className="muted">i 2026 for alle gaver og mindre personalegoder tilsammen. Grænsen stiger til 1.500 kr. i 2027.</p>
          </div>
          <div className="card stack-s">
            <div className="eyebrow">Jubilæum</div>
            <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>8.000 kr.</div>
            <p className="muted">ved 25, 35, 40, 45 eller 50 års ansættelse, eller når virksomheden fylder 25 år eller et antal år deleligt med 25.</p>
          </div>
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: 22 }}>Hold øje med tre ting</h2>
          <div className="tiles">
            <div className="stack-s">
              <h3>1 · Anledningen</h3>
              <p className="muted">Julegaven har sin egen grænse på 1.000 kr. Andre gaver i årets løb tæller med i den samlede grænse på 1.400 kr.</p>
            </div>
            <div className="stack-s">
              <h3>2 · Værdien</h3>
              <p className="muted">Det er gavens markedsværdi inkl. moms, der tæller. Overskrides grænsen, beskattes hele beløbet – ikke kun det, der ligger over.</p>
            </div>
            <div className="stack-s">
              <h3>3 · Gavetypen</h3>
              <p className="muted">Fysiske gaver kan være skattefri. Kontanter er altid skattepligtige, og det samme er de fleste gavekort med bred anvendelse.</p>
            </div>
          </div>
        </section>

        <section className="card flush">
          <div className="card-head">
            <h2 style={{ fontSize: 22 }}>Eksempler fra Skattestyrelsen</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Julegave</th>
                  <th>Andre gaver i året</th>
                  <th>Resultat</th>
                  <th>Hvorfor</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLES.map(([a, b, c, d]) => (
                  <tr key={a + b}>
                    <td>
                      <b>{a}</b>
                    </td>
                    <td>{b}</td>
                    <td>
                      <span className={`badge ${c === 'Skattefri' ? 'ok' : 'bad'}`}>{c}</span>
                    </td>
                    <td className="small muted">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-foot small muted">
            Kilde:{' '}
            <a href="https://skat.dk/borger/personalegoder-hvis-du-er-medarbejder/gaver-fra-arbejdsgiver" target="_blank" rel="noreferrer">
              skat.dk – Gaver fra arbejdsgiver
            </a>
          </div>
        </section>

        <section className="stack-s">
          <h2 style={{ fontSize: 22 }}>Sådan passer vores julegaver til reglerne</h2>
          <p className="muted small">Vores priser er ekskl. moms, men skattegrænserne gælder beløbet inkl. moms.</p>
          <div className="tiles">
            {cats.map((c) => {
              const jul = incl(c.value_kr) <= 1000;
              const alone = incl(c.value_kr) <= 1400;
              return (
                <div key={c.id} className="card stack-s">
                  <div className="row between">
                    <div className="eyebrow">Julegave</div>
                    <span className={`badge ${jul ? 'ok' : 'warn'}`}>{jul ? 'Skattefri julegave' : alone ? 'Kun hvis ingen andre gaver' : 'Skattepligtig'}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{kr(c.value_kr)}</div>
                  <div className="small muted">ekskl. moms · {kr(incl(c.value_kr))} inkl. moms</div>
                  <p className="small muted">
                    {jul
                      ? 'Holder sig inden for grænsen for skattefri julegaver.'
                      : alone
                        ? 'Over julegavegrænsen. Skattefri som eneste gave i året, så længe den samlede grænse på 1.400 kr. ikke overskrides.'
                        : 'Over begge grænser. Medarbejderen beskattes af gaven.'}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="stack-s">
          <h2 style={{ fontSize: 22 }}>Ofte stillede spørgsmål</h2>
          <div className="stack-s">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card">
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>{q}</summary>
                <p className="muted" style={{ marginTop: 10 }}>
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="dark-card row between" style={{ gap: 20 }}>
          <div className="stack-s" style={{ flex: '1 1 420px' }}>
            <h2 style={{ fontSize: 22 }}>Klar til en skattefri, lokal julegave?</h2>
            <p className="muted">Vælg julegaven til 800 kr. ekskl. moms – den højeste skattefri julegave – så vælger medarbejderne selv fra butikker i Vejen Kommune.</p>
          </div>
          <Link href="/bestil" className="btn light">
            Bestil julegaver
          </Link>
        </section>

        <p className="small muted" style={{ maxWidth: 820 }}>
          Siden er en generel vejledning ud fra reglerne for 2026 og er ikke skatterådgivning. Er I i tvivl om jeres konkrete situation, så spørg jeres revisor eller
          Skattestyrelsen. Kilder:{' '}
          <a href="https://skat.dk/borger/personalegoder-hvis-du-er-medarbejder/gaver-fra-arbejdsgiver" target="_blank" rel="noreferrer">
            skat.dk
          </a>
          ,{' '}
          <a href="https://www.pwc.dk/da/personalegoder/gaver.html" target="_blank" rel="noreferrer">
            PwC – Personalegoder 2026
          </a>
          ,{' '}
          <a
            href="https://www.danskindustri.dk/vi-radgiver-dig/personale/nyhedsarkiver---personaleforhold/nyheder-personalejura/2026/9/satser-for-beskatning-af-personalegoder-2027/"
            target="_blank"
            rel="noreferrer"
          >
            Dansk Industri – satser 2027
          </a>
          .
        </p>
      </main>
    </>
  );
}
