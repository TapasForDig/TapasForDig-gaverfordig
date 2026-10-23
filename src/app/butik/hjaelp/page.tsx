import { Shell } from '@/components/ui';
import { shopNav } from '../nav';
import { myShop } from '../shop';

const guides = [
  {
    title: 'Opret et produkt',
    steps: [
      'Gå til Mine produkter og tryk "Opret nyt produkt".',
      'Tilføj 1–5 billeder. Det første bliver hovedbillede.',
      'Skriv navn og beskrivelse: hvad er det, hvorfor er det godt, hvad er der i pakken.',
      'Vælg priskategori ud fra varens normale udsalgspris.',
      'Skriv hvor mange du kan levere, og tryk "Send til godkendelse".',
    ],
  },
  {
    title: 'Gode produktbilleder med telefonen',
    steps: [
      'Stil varen på et lyst bord tæt ved et vindue – undgå direkte sol og blitz.',
      'Brug en hvid eller lys baggrund (et stykke karton virker fint).',
      'Tag billedet lige forfra eller let ovenfra, så hele varen kan ses.',
      'Tag gerne et ekstra billede af detaljer eller indholdet i en kurv.',
    ],
  },
  {
    title: 'Se hvad du skal aflevere',
    steps: [
      'Når vælgefristen er slut, får du en mail.',
      'Under "Til aflevering" står præcis hvor mange af hver vare, du skal levere.',
      'Print afleveringssedlen og læg den ved varerne.',
      'Aflever gaverne i egen emballage på logistikcentralen inden fristen, og tryk "Markér som afleveret".',
    ],
  },
  {
    title: 'Afregning',
    steps: [
      'Gaver For Dig køber de valgte varer af dig til den aftalte indkøbspris.',
      'Efter sæsonen får du en oversigt over modtagne varer.',
      'Du sender én faktura til Gaver For Dig ud fra oversigten.',
    ],
  },
];

export default async function ShopHelp({ searchParams }: { searchParams: Promise<{ butik?: string }> }) {
  const sp = await searchParams;
  const { shop, shops } = await myShop(sp.butik);
  const q0 = shops ? `?butik=${shop.id}` : '';
  return (
    <Shell area={`Butik · ${shop.name}`} nav={shopNav.map((n) => ({ ...n, href: n.href + q0 }))} active={`/butik/hjaelp${q0}`}>
      <div className="stack">
        <h1>Hjælp og guides</h1>
        <a href="/billedguide" className="card row between" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>
            <b>Billedguide</b>
            <span className="small muted" style={{ display: 'block' }}>
              Mål, baggrund, lys og eksempler på gode og dårlige billeder
            </span>
          </span>
          <span className="btn small">Åbn guiden</span>
        </a>
        <div className="tiles">
          {guides.map((g) => (
            <section key={g.title} className="card stack-s">
              <h2>{g.title}</h2>
              <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <p className="small muted">Spørgsmål? Skriv til os, så hjælper vi.</p>
      </div>
    </Shell>
  );
}
