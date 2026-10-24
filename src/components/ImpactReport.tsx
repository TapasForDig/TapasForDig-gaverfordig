import { kr } from '@/lib/format';
import { genitiv, type Impact } from '@/lib/impact';

// Delbar oversigt over, hvor meget en virksomheds julegaver holder i lokale butikker
export function ImpactReport({ company, logo, impact, year, final }: { company: string; logo: string | null; impact: Impact; year: number; final: boolean }) {
  return (
    <article className="impact">
      <header className="impact-head">
        <div className="impact-brand">
          {logo ? <img src={logo} alt={company} className="impact-logo" /> : <span className="impact-company">{company}</span>}
          <img src="/logo-white.png" alt="Gaver For Dig" width={140} height={21} />
        </div>
        <div className="eyebrow">Julegaver {year} · lokal effekt</div>
        <h1>
          {genitiv(company)} julegaver holdt <span className="gold">{kr(impact.value)}</span> i Vejen Kommune
        </h1>
        <p>
          {impact.gifts} {impact.gifts === 1 ? 'gave' : 'gaver'} fra {impact.shops.length} lokale {impact.shops.length === 1 ? 'butik' : 'butikker'}
          {impact.towns.length ? ` i ${listText(impact.towns)}` : ''}.{' '}
          {!final && impact.total > impact.gifts ? `Tallene vokser endnu – ${impact.total - impact.gifts} medarbejdere har ikke valgt endnu.` : ''}
        </p>
      </header>
      <div className="impact-stats">
        <div>
          <b>{kr(impact.value)}</b>
          <span>handlet lokalt</span>
        </div>
        <div>
          <b>{impact.shops.length}</b>
          <span>lokale butikker</span>
        </div>
        <div>
          <b>{impact.gifts}</b>
          <span>julegaver</span>
        </div>
      </div>
      <section className="impact-shops">
        <h2>Butikkerne bag gaverne</h2>
        <ul>
          {impact.shops.map((s) => (
            <li key={s.id}>
              {s.logo ? <img src={s.logo} alt="" /> : <span className="impact-initial">{s.name.slice(0, 1)}</span>}
              <div>
                <b>{s.name}</b>
                {s.town && <span className="small muted">{s.town}</span>}
              </div>
              <span className="impact-count">
                {s.gifts} {s.gifts === 1 ? 'gave' : 'gaver'}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <footer className="impact-foot small">
        Når pengene bliver i lokale butikker, styrker det handelslivet, arbejdspladserne og byerne, hvor vi bor. Beløb er gavernes værdi ekskl. moms. · gaverfordig.dk
      </footer>
    </article>
  );
}

function listText(xs: string[]) {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} og ${xs[xs.length - 1]}`;
}
