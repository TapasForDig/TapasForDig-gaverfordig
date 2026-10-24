import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LeadForm } from '@/components/LeadForm';
import { TwoThings } from '@/components/TwoThings';
import { PublicHeader } from '@/components/ui';
import { BYTTEFRIST } from '@/lib/legal';
import { publicShops } from '@/lib/shops';
import { TOWNS, townFromSlug, townSlug } from '@/lib/towns';

export function generateStaticParams() {
  return TOWNS.map((t) => ({ by: townSlug(t) }));
}

export async function generateMetadata({ params }: { params: Promise<{ by: string }> }): Promise<Metadata> {
  const town = townFromSlug((await params).by);
  if (!town) return {};
  const title = `Firmajulegaver i ${town} – lokale julegaver til medarbejderne | Gaver For Dig`;
  const description = `Giv jeres medarbejdere i ${town} en julegave fra lokale butikker i Vejen Kommune. Medarbejderne vælger selv – vi pakker og leverer samlet. Skattefri inden for reglerne.`;
  return { title, description, alternates: { canonical: `/firmajulegaver/${townSlug(town)}` }, openGraph: { title, description, siteName: 'Gaver For Dig' } };
}

export default async function TownPage({ params, searchParams }: { params: Promise<{ by: string }>; searchParams: Promise<{ lead?: string }> }) {
  const { by } = await params;
  const sp = await searchParams;
  const town = townFromSlug(by);
  if (!town) notFound();
  const shops = await publicShops();
  const local = shops.filter((s) => s.town?.trim().toLowerCase() === town.toLowerCase());
  const others = shops.filter((s) => !local.includes(s));
  return (
    <>
      <PublicHeader />
      <main className="wrap stack">
        <section className="stack-s" style={{ maxWidth: 780 }}>
          <div className="eyebrow">Firmajulegaver · {town}</div>
          <h1>Julegaver til jeres medarbejdere – fra butikkerne i {town} og resten af Vejen Kommune</h1>
          <p style={{ fontSize: 18 }} className="muted">
            Har I en arbejdsplads i {town}? Med Gaver For Dig vælger I et gavebeløb, og hver medarbejder vælger selv sin julegave fra lokale butikker. Vi samler gaverne, sætter navn på og leverer det hele til jer – eller hjem til medarbejderne.
          </p>
          <div className="row">
            <Link href="/bestil" className="btn">
              Bestil julegaver
            </Link>
            <Link href="/saadan-virker-det" className="btn outline">
              Sådan virker det
            </Link>
          </div>
        </section>

        <TwoThings cta={false} />

        <section className="stack-s">
          <h2 style={{ fontSize: 24 }}>{local.length ? `Butikker i ${town}` : 'Butikkerne bag gaverne'}</h2>
          {!local.length && (
            <p className="muted" style={{ margin: 0 }}>
              Gaverne kommer fra butikker i hele Vejen Kommune. Har du en butik i {town}? <Link href="/butik/tilmeld">Tilmeld den her</Link>.
            </p>
          )}
          <div className="logo-strip">
            {(local.length ? local : others).slice(0, 12).map((s) => (
              <Link key={s.id} href="/butikker" title={s.name}>
                {s.logo ? <img src={s.logo} alt={s.name} /> : s.name}
              </Link>
            ))}
          </div>
          {local.length > 0 && others.length > 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              Og {others.length} {others.length === 1 ? 'butik' : 'butikker'} mere i resten af kommunen. <Link href="/butikker">Se alle butikker</Link>
            </p>
          )}
        </section>

        <section className="usp-strip">
          <div>
            <b>Medarbejderne vælger selv</b>
            <span>Fem gavebeløb fra 300 kr. – hver medarbejder finder den gave, der passer.</span>
          </div>
          <div>
            <b>Byt i butikken</b>
            <span>Passer størrelsen ikke, kan gaven byttes i butikken frem til {BYTTEFRIST}.</span>
          </div>
          <div>
            <b>Levering hver uge frem til jul</b>
            <span>
              Vælg den uge, der passer jer. <Link href="/levering">Se deadlines</Link>
            </span>
          </div>
        </section>

        <LeadForm
          kind="virksomhed"
          returnTo={`/firmajulegaver/${by}`}
          status={sp.lead}
          title={`Arbejdsplads i ${town}? Vi ringer gerne`}
          intro="Skriv dit navn og nummer, så hjælper vi med gavebeløb, antal og leveringsuge. Helt uforpligtende."
        />

        <nav className="town-chips" aria-label="Andre byer">
          {TOWNS.filter((t) => t !== town).map((t) => (
            <Link key={t} href={`/firmajulegaver/${townSlug(t)}`}>
              {t}
            </Link>
          ))}
        </nav>
      </main>
    </>
  );
}
