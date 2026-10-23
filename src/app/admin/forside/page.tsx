import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ImageUpload } from '@/components/ImageUpload';
import { Notice, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, q } from '@/lib/db';
import { str } from '@/lib/format';
import { getSetting } from '@/lib/gifts';
import { saveImage } from '@/lib/storage';
import { adminNav } from '../nav';

// Forsidens billeder og tekster. Billederne gemmes som almindelige indstillinger (URL).
const IMAGES: [string, string, string][] = [
  ['forside_hero_billede', 'Stort billede øverst til højre', '1600 × 1200 px (4:3), liggende. Et billede, der sætter Vejen Kommune i fokus – fx en gade, et torv eller en butik i Brørup/Vejen. Hold det vigtigste midt i billedet.'],
  ['forside_fritvalg_billede', 'Indgang 1: Frit valg', '1600 × 1000 px (16:10)'],
  ['forside_webshop_billede', 'Indgang 2: Vælg selv i webshoppen', '1600 × 1000 px (16:10)'],
  ['forside_gaveaesker_billede', 'Indgang 3: Gaveæsker og julekalendere', '1600 × 1000 px (16:10)'],
];
const TEXTS: [string, string, string][] = [
  ['forside_overskrift', 'Overskrift', 'Giv en gave, der bliver i lokalsamfundet'],
  ['forside_hero_tekst', 'Lille tekst på billedet (fx "Brørup Torv")', ''],
  ['forside_undertekst', 'Tekst under overskriften', 'Jeres medarbejdere vælger selv deres gave blandt varer fra lokale butikker. Vi samler, pakker med navn og leverer det hele til jer.'],
];

async function save(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const set = (k: string, v: string) => q('insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value', [k, v]);
  for (const [key] of IMAGES) {
    const f = fd.get(key);
    if (fd.get(`${key}_fjern`) === 'ja') await set(key, '');
    else if (f instanceof File && f.size > 0) {
      try {
        await set(key, await saveImage(f));
      } catch (e) {
        redirect('/admin/forside?m=' + encodeURIComponent('!' + (e as Error).message));
      }
    }
  }
  for (const [key] of TEXTS) await set(key, str(fd, key));
  await logEvent(u.email, 'settings', null, 'forside opdateret');
  redirect('/admin/forside?m=' + encodeURIComponent('Forsiden er opdateret'));
}

export default async function FrontPageAdmin({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const imgs = await Promise.all(IMAGES.map(([k]) => getSetting(k)));
  const texts = await Promise.all(TEXTS.map(([k]) => getSetting(k)));
  return (
    <Shell area="Admin" nav={adminNav} active="/admin/forside">
      <form action={save} className="stack">
        <div className="row between end">
          <h1>Forside</h1>
          <div className="row">
            <Link href="/" target="_blank">
              Se forsiden
            </Link>
            <button className="btn" type="submit">
              Gem forside
            </button>
          </div>
        </div>
        <Notice msg={sp.m} />
        <section className="card form">
          <h2>Tekst</h2>
          {TEXTS.map(([key, label, def], i) => (
            <div key={key} className="field">
              <label htmlFor={key}>{label}</label>
              {key.endsWith('undertekst') ? (
                <textarea id={key} name={key} defaultValue={texts[i] || def} style={{ minHeight: 80 }} />
              ) : (
                <input id={key} name={key} type="text" defaultValue={texts[i] || def} />
              )}
            </div>
          ))}
        </section>
        <section className="card stack">
          <h2>Billeder</h2>
          <p className="hint">Billederne gøres automatisk mindre, før de uploades. Brug gerne billeder i god kvalitet – mindst de mål, der står ved hvert billede.</p>
          <div className="tiles">
            {IMAGES.map(([key, label, hint], i) => (
              <div key={key} className="stack-s">
                <ImageUpload name={key} current={imgs[i] || null} label={label} aspect={key === 'forside_hero_billede' ? '4 / 3' : '16 / 10'} />
                <span className="hint">{hint}</span>
                {imgs[i] && (
                  <label className="check small">
                    <input type="checkbox" name={`${key}_fjern`} value="ja" /> Fjern billedet
                  </label>
                )}
              </div>
            ))}
          </div>
        </section>
        <div>
          <button className="btn" type="submit">
            Gem forside
          </button>
        </div>
      </form>
    </Shell>
  );
}
