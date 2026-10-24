import Link from 'next/link';
import { Icon } from './Icon';

// "Du gør to ting – vi klarer resten": budskabet til den gaveansvarlige
export function TwoThings({ cta = true }: { cta?: boolean }) {
  return (
    <section className="two-things" aria-labelledby="to-ting">
      <div className="two-you">
        <div className="eyebrow" style={{ color: 'var(--green-dark)' }}>
          Som gaveansvarlig
        </div>
        <h2 id="to-ting">Du gør kun to ting</h2>
        <ol className="two-list">
          <li>
            <span className="two-n">1</span>
            <span>
              <b>Bestil online</b>
              <span className="small">Antal medarbejdere og leveringsuge – det tager få minutter.</span>
            </span>
          </li>
          <li>
            <span className="two-n">2</span>
            <span>
              <b>Vælg gavebeløb</b>
              <span className="small">Fra 300 til 1.100 kr. – medarbejderne vælger selv gaven inden for beløbet.</span>
            </span>
          </li>
        </ol>
        {cta && (
          <Link href="/bestil" className="btn" style={{ alignSelf: 'flex-start' }}>
            Bestil julegaver
          </Link>
        )}
      </div>
      <div className="two-we">
        <div className="eyebrow" style={{ color: 'var(--gold)' }}>
          Gaver For Dig
        </div>
        <h2>Vi sørger for resten</h2>
        <ul className="two-check">
          {[
            'Sender en gavekode til hver medarbejder – eller til jer',
            'Viser medarbejderne gaverne fra lokale butikker',
            'Svarer på medarbejdernes spørgsmål',
            'Samler gaverne fra butikkerne i hele kommunen',
            'Sætter navn på hver gave – og pakker ind, hvis I ønsker det',
            'Leverer det hele samlet til jer eller hjem til medarbejderne',
          ].map((t) => (
            <li key={t}>
              <span className="two-ok" aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
