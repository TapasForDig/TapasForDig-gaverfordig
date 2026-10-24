import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/ui';
import { publicShops } from '@/lib/shops';

export const metadata: Metadata = { title: 'Deltagende butikker – Gaver For Dig' };

export default async function Shops({ searchParams }: { searchParams: Promise<{ by?: string }> }) {
  const sp = await searchParams;
  const all = await publicShops();
  const towns = [...new Set(all.map((s) => s.town?.trim()).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, 'da'));
  const list = sp.by ? all.filter((s) => s.town?.trim() === sp.by) : all;
  const host = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <>
      <PublicHeader active="/butikker" />
      <main className="wrap stack">
        <div className="stack-s">
          <div className="eyebrow">Vejen Kommune</div>
          <h1>Deltagende butikker</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 680 }}>
            Gaverne kommer fra {all.length} lokale {all.length === 1 ? 'butik' : 'butikker'}. Når jeres medarbejdere vælger en gave, går pengene til en butik i lokalområdet.
          </p>
        </div>

        {towns.length > 1 && (
          <nav className="town-chips" aria-label="Vælg by">
            <Link href="/butikker" className={!sp.by ? 'on' : ''}>
              Alle
            </Link>
            {towns.map((t) => (
              <Link key={t} href={`/butikker?by=${encodeURIComponent(t)}`} className={sp.by === t ? 'on' : ''}>
                {t}
              </Link>
            ))}
          </nav>
        )}

        {list.length === 0 ? (
          <p className="muted">Der er ingen butikker at vise endnu.</p>
        ) : (
          <div className="shop-grid">
            {list.map((s) => (
              <article key={s.id} className="shop-card">
                <div className="logo-box">{s.logo ? <img src={s.logo} alt={s.name} /> : <span className="initials">{s.name}</span>}</div>
                <div className="body">
                  <h3>{s.name}</h3>
                  {s.town && <span className="small muted">{s.town}</span>}
                  {s.story && <p>{s.story}</p>}
                  <div className="foot">
                    <span className="badge">{s.gifts === 1 ? '1 gave' : `${s.gifts} gaver`}</span>
                    {s.website && (
                      <a href={s.website} target="_blank" rel="noopener noreferrer">
                        {host(s.website)}
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <section className="tiles">
          <div className="dark-card stack-s">
            <h2>Vil I give en gave fra butikkerne?</h2>
            <p className="muted">Vælg gavebeløb – medarbejderne vælger selv blandt gaverne.</p>
            <div>
              <Link href="/bestil" className="btn light">
                Bestil julegaver
              </Link>
            </div>
          </div>
          <div className="card stack-s">
            <h2>Er din butik med?</h2>
            <p className="muted small">Butikker i Vejen Kommune kan tilmelde sig gratis og selv oprette deres gaver.</p>
            <div>
              <Link href="/butik/tilmeld" className="btn outline">
                Tilmeld din butik
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
