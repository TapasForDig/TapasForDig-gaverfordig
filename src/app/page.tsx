import Link from 'next/link';
import { TopBar } from '@/components/ui';
import { activeSeason, categories } from '@/lib/gifts';
import { dato, kr } from '@/lib/format';

export default async function Home() {
  const [season, cats] = await Promise.all([activeSeason(), categories()]);
  const demo = process.env.NO_DEMO !== '1';
  return (
    <>
      <TopBar />
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <b>GAVER FOR DIG</b>
            <span>lokale firmagaver</span>
          </Link>
          <nav className="nav" aria-label="Hovedmenu">
            <a href="#saadan">Sådan virker det</a>
            <Link href="/virksomhed/opret">For virksomheder</Link>
            <Link href="/butik/tilmeld">For butikker</Link>
            <Link href="/login">Log ind</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div style={{ flex: '1 1 520px' }} className="stack-s">
          <div className="eyebrow">Firmagaver fra Vejen Kommune</div>
          <h1>Giv en gave, der bliver i lokalsamfundet</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 620 }}>
            Jeres medarbejdere vælger selv deres gave blandt varer fra lokale butikker. Vi samler, pakker med navn og leverer det hele samlet til jeres
            virksomhed.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <Link href="/virksomhed/opret" className="btn">
              Bestil til jeres medarbejdere
            </Link>
            <Link href="/gave" className="btn outline">
              Jeg har fået en gave
            </Link>
          </div>
        </div>
        {season?.order_deadline && (
          <div className="card" style={{ minWidth: 240 }}>
            <div className="eyebrow">{season.name} · Bestil senest</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{dato(season.order_deadline)}</div>
            <div className="small muted">Levering fra {dato(season.delivery_from)}</div>
          </div>
        )}
      </section>

      <main className="wrap stack" style={{ paddingTop: 0 }}>
        <section id="saadan" className="stack-s">
          <h2 style={{ fontSize: 24 }}>Sådan virker det</h2>
          <div className="tiles">
            {[
              ['1. I bestiller', 'Vælg priskategori og upload jeres medarbejdere med navn og mail.'],
              ['2. Medarbejderne vælger', 'Hver medarbejder får et personligt link og vælger én gave fra de lokale butikker.'],
              ['3. Vi samler og pakker', 'Butikkerne afleverer på vores logistikcentral i Brørup. Hver gave pakkes med navn.'],
              ['4. Én samlet levering', 'I får alle gaver leveret samlet og én faktura.'],
            ].map(([t, d]) => (
              <div key={t} className="card stack-s">
                <h3>{t}</h3>
                <p className="muted">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="stack-s">
          <h2 style={{ fontSize: 24 }}>Priskategorier</h2>
          <div className="tiles">
            {cats.map((c) => (
              <div key={c.id} className="card">
                <div className="eyebrow">{c.name}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{kr(c.value_kr)}</div>
                {c.note && <p className="small muted">{c.note}</p>}
              </div>
            ))}
          </div>
          <p className="small muted">Priser er gavens værdi inkl. moms. Gaverne er fysiske tingsgaver fra lokale butikker.</p>
        </section>

        <section className="tiles">
          <div className="dark-card stack-s">
            <h2>Er du butik i Vejen Kommune?</h2>
            <p className="muted">Sælg dine varer som firmagaver. Du opretter selv produkterne og afleverer kun det, der er valgt.</p>
            <div>
              <Link href="/butik/tilmeld" className="btn light">
                Tilmeld din butik
              </Link>
            </div>
          </div>
          {demo && (
            <div className="card stack-s">
              <h2>Demo-logins</h2>
              <p className="small muted">Adgangskode til alle: demo1234</p>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                <li>admin@demo.dk – admin</li>
                <li>virksomhed@demo.dk – virksomhed</li>
                <li>butik@demo.dk – butik (Vin For Dig)</li>
                <li>interior@demo.dk – butik (demo)</li>
                <li>logistik@demo.dk – logistikcentral</li>
              </ul>
              <p className="small muted">Medarbejdernes gave-links findes under Virksomhed → ordre → modtagere.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
