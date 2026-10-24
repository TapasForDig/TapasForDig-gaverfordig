import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Billedguide til butikker – Gaver For Dig', robots: { index: false, follow: true } };

// Enkel tegning af en gave i et kvadratisk billede. variant styrer god/dårlig.
function Shot({ variant }: { variant: 'good' | 'dark' | 'cut' | 'text' | 'small' | 'collage' }) {
  const bg = variant === 'dark' ? '#3a3a3a' : '#f3efe8';
  const box = (x: number, y: number, s: number) => (
    <g>
      <rect x={x} y={y + s * 0.18} width={s} height={s * 0.82} rx={4} fill="#7b2d3b" />
      <rect x={x - s * 0.06} y={y} width={s * 1.12} height={s * 0.24} rx={4} fill="#93404f" />
      <rect x={x + s * 0.44} y={y} width={s * 0.12} height={s} fill="#e9d5a0" />
      <path d={`M${x + s / 2} ${y} c-${s * 0.25} -${s * 0.28} -${s * 0.42} -${s * 0.05} 0 0 c${s * 0.42} -${s * 0.05} ${s * 0.25} -${s * 0.28} 0 0`} fill="none" stroke="#e9d5a0" strokeWidth={4} />
    </g>
  );
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Eksempel" className="shot">
      <rect width="200" height="200" fill={bg} />
      {variant === 'good' && (
        <>
          <ellipse cx="100" cy="162" rx="58" ry="7" fill="#000" opacity=".08" />
          {box(52, 62, 96)}
        </>
      )}
      {variant === 'dark' && box(52, 62, 96)}
      {variant === 'cut' && box(70, 40, 170)}
      {variant === 'small' && box(86, 112, 28)}
      {variant === 'text' && (
        <>
          {box(52, 62, 96)}
          <rect x="18" y="18" width="164" height="34" rx="6" fill="#d33" />
          <text x="100" y="41" textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff">
            KUN 299,-
          </text>
        </>
      )}
      {variant === 'collage' && (
        <>
          <rect x="0" y="0" width="100" height="100" fill="#d9cdbd" />
          <rect x="100" y="100" width="100" height="100" fill="#c9d3c4" />
          {box(20, 22, 56)}
          {box(124, 122, 56)}
          {box(124, 22, 56)}
          {box(20, 122, 56)}
        </>
      )}
    </svg>
  );
}

const DO = [
  'Kvadratisk billede – mindst 1200 × 1200 px, gerne 1600 × 1600 px',
  'Lys, rolig baggrund: hvid, lys grå, creme eller lyst træ',
  'Hele gaven kan ses, midt i billedet, med lidt luft hele vejen rundt',
  'Dagslys fra et vindue – gerne fra siden',
  'Hovedbilledet viser gaven alene. Ekstra billeder må vise indhold, detaljer eller stemning',
];
const DONT = ['Tekst, priser, logoer eller "tilbud" på billedet', 'Mørk eller rodet baggrund', 'Blitz og direkte sollys (hårde skygger)', 'Gaven skåret over i kanten', 'Flere produkter sat sammen i én collage som hovedbillede'];

export default function ImageGuide() {
  return (
    <>
      <PublicHeader />
      <main className="wrap stack" style={{ maxWidth: 1000 }}>
        <div className="stack-s">
          <div className="eyebrow">For butikker</div>
          <h1>Billedguide</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 720 }}>
            Gode billeder er det, der får medarbejderne til at vælge din gave. Du behøver ikke et kamera – en telefon og et vindue er nok. Billederne gøres automatisk klar, når du
            uploader dem.
          </p>
        </div>

        <section className="card guide-specs">
          <div>
            <div className="eyebrow">Format</div>
            <b>Kvadratisk 1:1</b>
          </div>
          <div>
            <div className="eyebrow">Anbefalet</div>
            <b>1600 × 1600 px</b>
          </div>
          <div>
            <div className="eyebrow">Mindst</div>
            <b>1200 × 1200 px</b>
          </div>
          <div>
            <div className="eyebrow">Antal</div>
            <b>1–5 billeder</b>
          </div>
          <div>
            <div className="eyebrow">Filtype</div>
            <b>JPG, PNG eller WEBP</b>
          </div>
        </section>

        <section className="split" style={{ alignItems: 'center' }}>
          <div className="main stack-s">
            <h2 style={{ fontSize: 22 }}>Sådan placerer du gaven</h2>
            <p className="muted">
              Billedet vises kvadratisk i gaveshoppen. Hold gaven inden for den stiplede ramme, så intet bliver skåret af – heller ikke på små skærme. Lad der være ca. 10 % luft til
              kanten hele vejen rundt.
            </p>
            <p className="muted">Det første billede er hovedbilledet. Det er det, medarbejderne ser i oversigten. Du vælger selv, hvilket billede der er hovedbillede.</p>
          </div>
          <div className="side">
            <div className="safe-zone">
              <Shot variant="good" />
              <span className="safe-line" aria-hidden="true" />
              <span className="safe-label">Hold gaven inden for rammen</span>
            </div>
          </div>
        </section>

        <section className="stack-s">
          <h2 style={{ fontSize: 22 }}>Godt og skidt</h2>
          <div className="shots">
            {(
              [
                ['good', true, 'Lys baggrund, hele gaven, luft rundt om'],
                ['dark', false, 'Mørk baggrund'],
                ['cut', false, 'Gaven er skåret over'],
                ['small', false, 'Gaven er for lille i billedet'],
                ['text', false, 'Tekst og pris på billedet'],
                ['collage', false, 'Collage som hovedbillede'],
              ] as const
            ).map(([v, ok, t]) => (
              <figure key={v} className={`shot-card ${ok ? 'ok' : 'bad'}`}>
                <Shot variant={v} />
                <figcaption>
                  <b>{ok ? '✓ Godt' : '✕ Undgå'}</b>
                  <span>{t}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="tiles">
          <div className="card stack-s">
            <h2>Gør sådan</h2>
            <ul className="dolist ok">
              {DO.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="card stack-s">
            <h2>Undgå</h2>
            <ul className="dolist bad">
              {DONT.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card stack-s">
          <h2>Med telefonen – 5 hurtige tips</h2>
          <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>Stil gaven på et bord tæt ved et vindue. Sluk loftslyset, så farverne bliver rigtige.</li>
            <li>Læg et stort stykke hvidt karton bag og under gaven – det giver en ren baggrund.</li>
            <li>Vælg kvadratisk format i kameraet (ofte kaldet &quot;1:1&quot; eller &quot;Kvadrat&quot;).</li>
            <li>Brug almindelig zoom (1×), og hold telefonen i gavens højde eller lidt oppefra.</li>
            <li>Tør kameralinsen af og tryk på gaven på skærmen, så den er skarp.</li>
          </ol>
        </section>

        <section className="card stack-s">
          <h2>Gavekurve og gaveæsker</h2>
          <p className="muted small">
            Brug hovedbilledet til hele kurven, pænt arrangeret. Tag gerne et ekstra billede, hvor indholdet er lagt ud ved siden af hinanden, så medarbejderen kan se, hvad der er i.
          </p>
        </section>

        <p className="small muted">
          Klar? <Link href="/butik/produkt/ny">Opret en gave</Link>
        </p>
      </main>
    </>
  );
}
