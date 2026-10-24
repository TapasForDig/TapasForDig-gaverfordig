import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { ProductImage, PublicHeader } from '@/components/ui';
import { kr } from '@/lib/format';
import { categories, giftsFor } from '@/lib/gifts';
import { breadcrumbs } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Se julegaverne – gaver fra lokale butikker i Vejen Kommune | Gaver For Dig',
  description:
    'Se udvalget af julegaver til medarbejdere fra lokale butikker i Vejen Kommune – mad og drikke, mode, bolig og oplevelser i fem prisgrupper fra 300 kr. Medarbejderne vælger selv.',
  alternates: { canonical: '/gaver' },
};

export default async function GiftCatalogue() {
  const cats = await categories();
  const groups = (await Promise.all(cats.map(async (c) => ({ c, gifts: await giftsFor(c.id, null) })))).filter((g) => g.gifts.length);
  const total = groups.reduce((a, g) => a + g.gifts.length, 0);
  return (
    <>
      <PublicHeader />
      <JsonLd data={breadcrumbs([['Forside', '/'], ['Julegaverne', '/gaver']])} />
      <main className="wrap stack">
        <section className="stack-s" style={{ maxWidth: 760 }}>
          <div className="eyebrow">Udvalget</div>
          <h1>Julegaverne fra butikkerne i Vejen Kommune</h1>
          <p className="muted" style={{ fontSize: 17 }}>
            {total ? `${total} gaver fra lokale butikker, fordelt på ${groups.length} prisgrupper. ` : ''}I vælger beløbet – hver medarbejder vælger selv sin gave inden for det. Udvalget vokser, efterhånden som butikkerne tilføjer gaver.
          </p>
          {groups.length > 1 && (
            <nav className="town-chips" aria-label="Prisgrupper">
              {groups.map(({ c }) => (
                <a key={c.id} href={`#gaver-${c.value_kr}`}>
                  {kr(c.value_kr)}
                </a>
              ))}
            </nav>
          )}
        </section>

        {groups.length === 0 && <p className="muted">Butikkerne er ved at oprette årets gaver. Kig forbi igen om lidt.</p>}

        {groups.map(({ c, gifts }) => (
          <section key={c.id} id={`gaver-${c.value_kr}`} className="stack-s" style={{ scrollMarginTop: 20 }}>
            <div className="row between end">
              <h2 style={{ fontSize: 24 }}>
                Julegaver til {kr(c.value_kr)} <span className="small muted">ekskl. moms</span>
              </h2>
              <Link href="/bestil" className="small">
                Bestil i denne prisgruppe →
              </Link>
            </div>
            <div className="products">
              {gifts.map((p) => (
                <article key={p.id} className="product">
                  <ProductImage json={p.images} alt={p.name} />
                  <div className="body">
                    <div className="eyebrow">
                      {p.shop_name}
                      {p.shop_town ? ` · ${p.shop_town}` : ''}
                    </div>
                    <h3>{p.name}</h3>
                    <p className="desc">{p.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className="dark-card row between" style={{ gap: 20 }}>
          <div className="stack-s" style={{ flex: '1 1 420px' }}>
            <h2 style={{ fontSize: 24 }}>Giv medarbejderne valget</h2>
            <p className="muted">Vælg gavebeløb og leveringsuge – medarbejderne vælger selv blandt gaverne, og vi leverer samlet.</p>
          </div>
          <div className="row">
            <Link href="/bestil" className="btn light">
              Bestil julegaver
            </Link>
            <Link href="/butik/tilmeld" className="btn" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.6)' }}>
              Har du en butik?
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
