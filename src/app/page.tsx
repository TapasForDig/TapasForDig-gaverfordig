import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PublicHeader } from '@/components/ui';
import { categories, getSetting } from '@/lib/gifts';
import { kr } from '@/lib/format';
import { deliveryWeeks, incl, shopSettings } from '@/lib/purchase';

const TOWNS = ['Brørup', 'Vejen', 'Rødding', 'Holsted', 'Askov', 'Lintrup', 'Gesten', 'Jels', 'Skodborg', 'Bække', 'Hovborg', 'Føvling', 'Lindknud', 'Glejbjerg', 'Andst', 'Malt'];

export default async function Home() {
  const [cats, s, hero, img1, img2, img3, title, intro] = await Promise.all([
    categories(),
    shopSettings(),
    getSetting('forside_hero_billede'),
    getSetting('forside_fritvalg_billede'),
    getSetting('forside_webshop_billede'),
    getSetting('forside_gaveaesker_billede'),
    getSetting('forside_overskrift'),
    getSetting('forside_undertekst'),
  ]);
  const [heroCaption, band, bandTitle, bandText] = await Promise.all([
    getSetting('forside_hero_tekst'),
    getSetting('forside_baand_billede'),
    getSetting('forside_baand_overskrift'),
    getSetting('forside_baand_tekst'),
  ]);
  const next = deliveryWeeks(s).find((w) => w.available);
  const demo = process.env.NO_DEMO !== '1';
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', timeZone: 'Europe/Copenhagen' });
  return (
    <>
      <PublicHeader />

      {next && (
        <div className="deadline-bar">
          <div className="deadline-inner">
            <span>
              <b>Næste levering: uge {next.week}</b>
              <span className="sep">·</span>Bestil inden <b>{fmt(next.chooseDeadline)}</b>
              <span className="sep">·</span>Leveres senest {fmt(next.deliveryDate + 'T12:00:00Z')}
            </span>
            <Link href="/bestil">Bestil nu →</Link>
          </div>
        </div>
      )}

      <section className="hero">
        <div style={{ flex: '1 1 480px' }} className="stack-s">
          <div className="eyebrow">Firmagaver fra Vejen Kommune</div>
          <h1>{title || 'Giv en gave, der bliver i lokalsamfundet'}</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 620 }}>
            {intro || 'Jeres medarbejdere vælger selv deres gave blandt varer fra lokale butikker. Vi samler, pakker med navn og leverer det hele til jer.'}
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <Link href="/bestil" className="btn">
              Bestil julegavekort
            </Link>
            <Link href="/gave" className="btn outline">
              Jeg har fået en gavekode
            </Link>
          </div>
        </div>
        <figure className="hero-img">
          {hero ? (
            <img src={hero} alt={heroCaption || 'Vejen Kommune'} />
          ) : (
            <div className="hero-fallback">
              <span className="eyebrow">Gaver fra</span>
              <div className="towns">
                {TOWNS.slice(0, 10).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {(heroCaption || !hero) && <figcaption>{heroCaption || 'Lokale butikker i Vejen Kommune'}</figcaption>}
        </figure>
      </section>

      <main className="wrap stack" style={{ paddingTop: 0 }}>
        <section className="stack-s">
          <h2 style={{ fontSize: 28, textAlign: 'center', margin: '8px 0 12px' }}>Vælg den løsning, der passer jer bedst</h2>
          <div className="paths">
            <div className="path">
              <div className="visual" style={{ background: 'var(--green)' }}>
                {img1 ? <img src={img1} alt="" /> : <Icon name="gift" size={72} />}
              </div>
              <h3>Giv medarbejderne frit valg</h3>
              <p>Vælg gavebeløb – vi sender gavekoder, og hver medarbejder vælger sin gave fra lokale butikker. Vi klarer resten.</p>
              <div className="row">
                <Link href="/bestil" className="btn">
                  Frit valg af gave
                </Link>
              </div>
            </div>
            <div className="path">
              <div className="visual" style={{ background: 'var(--wine)' }}>
                {img2 ? <img src={img2} alt="" /> : <Icon name="bag" size={72} />}
              </div>
              <h3>I vælger selv i webshoppen</h3>
              <p>Gå på opdagelse i butikkernes udvalg og vælg selv gaverne til jeres medarbejdere.</p>
              <div className="row">
                <span className="badge">Kommer snart</span>
              </div>
            </div>
            <div className="path">
              <div className="visual" style={{ background: 'var(--green-dark)' }}>
                {img3 ? <img src={img3} alt="" /> : <Icon name="calendar" size={72} />}
              </div>
              <h3>Gaveæsker &amp; julekalendere</h3>
              <p>Lokale lækkerier samlet i gaveæsker og julekalendere – klar til at give videre.</p>
              <div className="row">
                <span className="badge">Kommer snart</span>
              </div>
            </div>
          </div>
        </section>

        {band && (
          <section className="band">
            <img src={band} alt="" />
            <div className="band-text">
              <h2>{bandTitle || 'Gaver med lokal sjæl'}</h2>
              <p>{bandText || 'Hver gave kommer fra en butik i Vejen Kommune. Når I giver en gave herfra, bliver pengene i lokalsamfundet.'}</p>
            </div>
            <div className="town-flow" aria-hidden="true">
              <div className="town-track">
                {[...TOWNS, ...TOWNS].map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="saadan" className="stack-s">
          <h2 style={{ fontSize: 24 }}>Sådan virker gavekortet</h2>
          <div className="tiles">
            {(
              [
                ['receipt', '1. Bestil online', 'Vælg gavebeløb, antal og leveringsuge.'],
                ['mail', '2. Modtag gavekoderne', 'Vi sender koderne til jer – eller direkte til medarbejderne.'],
                ['users', '3. Medarbejderen vælger', 'Med sin kode vælger hver medarbejder én gave fra de lokale butikker.'],
                ['truck', '4. Vi leverer', 'Samlet til virksomheden eller til medarbejdernes hjemmeadresser.'],
              ] as const
            ).map(([icon, t, d]) => (
              <div key={t} className="card stack-s" style={{ textAlign: 'center', alignItems: 'center' }}>
                <span className="big-icon">
                  <Icon name={icon} size={28} />
                </span>
                <h3>{t}</h3>
                <p className="muted small">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="stack-s">
          <h2 style={{ fontSize: 24 }}>Gavebeløb</h2>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            {cats.map((c) => (
              <Link key={c.id} href="/bestil" className="card stack-s" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--wine)' }}>{kr(c.value_kr)}</div>
                <div className="small muted">ekskl. moms · {kr(incl(c.value_kr))} inkl.</div>
                <span className={`badge ${incl(c.value_kr) <= 1000 ? 'ok' : 'warn'}`}>{incl(c.value_kr) <= 1000 ? 'Skattefri julegave' : 'Se skatteregler'}</span>
              </Link>
            ))}
          </div>
          <p className="small muted">
            Minimum {s.minQty} gaver. Gaverne er fysiske tingsgaver fra lokale butikker. <Link href="/skatteregler">Se hvad skattereglerne siger</Link>
          </p>
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
            </div>
          )}
        </section>
      </main>
    </>
  );
}
