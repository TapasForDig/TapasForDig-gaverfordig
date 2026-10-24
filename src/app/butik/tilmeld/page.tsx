import { BYTTEFRIST } from '@/lib/legal';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Notice, Shell } from '@/components/ui';
import { hashPassword, startSession } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, str } from '@/lib/format';
import { sendMail } from '@/lib/mail';

async function signup(fd: FormData) {
  'use server';
  const name = str(fd, 'name');
  const email = str(fd, 'email').toLowerCase();
  const pw = str(fd, 'password');
  if (!name || !email || pw.length < 8) redirect('/butik/tilmeld?m=' + encodeURIComponent('!Udfyld butikkens navn, e-mail og en adgangskode på mindst 8 tegn'));
  if (fd.get('terms') !== 'ja') redirect('/butik/tilmeld?m=' + encodeURIComponent('!Du skal acceptere samarbejdsvilkårene'));
  if (await one('select 1 from users where email = $1', [email])) {
    redirect('/butik/tilmeld?m=' + encodeURIComponent('!Der findes allerede en bruger med den e-mail. Log ind i stedet.'));
  }
  const s = await one<{ id: number }>(
    `insert into shops (name, cvr, address, town, contact_name, phone, email, story) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [name, str(fd, 'cvr'), str(fd, 'address'), str(fd, 'town'), str(fd, 'contact'), str(fd, 'phone'), email, str(fd, 'story')],
  );
  const u = await one<{ id: number }>(`insert into users (email, password_hash, name, role, shop_id) values ($1,$2,$3,'butik',$4) returning id`, [
    email,
    hashPassword(pw),
    str(fd, 'contact') || name,
    s!.id,
  ]);
  await logEvent(email, 'shop', s!.id, 'tilmeldt', name);
  const admins = await q<{ email: string }>(`select email from users where role = 'admin'`);
  for (const a of admins) await sendMail(a.email, `Ny butik til godkendelse: ${name}`, `${name}, ${str(fd, 'town')}\nCVR: ${str(fd, 'cvr')}\n\nGodkend her: ${appUrl()}/admin/godkend`);
  await startSession(u!.id);
  redirect('/butik/produkter?m=' + encodeURIComponent('Tak! Din butik afventer godkendelse. Du kan allerede nu oprette dine produkter.'));
}

export default async function ShopSignup({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <Shell showLogout={false} active="/butik/tilmeld">
      <div className="split">
        <div className="main card">
          <form action={signup} className="form">
            <h1 style={{ fontSize: 28 }}>Tilmeld din butik</h1>
            <Notice msg={m} />
            <div className="grid-2">
              <div className="field">
                <label htmlFor="name">Butikkens navn</label>
                <input id="name" name="name" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="cvr">CVR-nummer</label>
                <input id="cvr" name="cvr" type="text" inputMode="numeric" required />
              </div>
              <div className="field">
                <label htmlFor="address">Adresse</label>
                <input id="address" name="address" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="town">By</label>
                <input id="town" name="town" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="contact">Kontaktperson</label>
                <input id="contact" name="contact" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="phone">Telefon</label>
                <input id="phone" name="phone" type="tel" />
              </div>
              <div className="field">
                <label htmlFor="email">E-mail (bruges til login)</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div className="field">
                <label htmlFor="password">Adgangskode</label>
                <input id="password" name="password" type="password" minLength={8} required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="story">Kort om butikken (vises for medarbejderne)</label>
              <textarea id="story" name="story" maxLength={400} placeholder="Fx: Familiedrevet blomsterbutik i Rødding siden 1987." />
            </div>
            <label className="check">
              <input type="checkbox" name="terms" value="ja" required />
              <span>
                Jeg accepterer samarbejdsvilkårene: Gaver For Dig køber de valgte varer af butikken til den aftalte indkøbspris og afregner efter sæsonen. Medarbejdere kan bytte gaven i butikken frem til {BYTTEFRIST} mod navnemærkaten – til en anden vare, ikke kontanter.
              </span>
            </label>
            <button className="btn" type="submit">
              Tilmeld butik
            </button>
            <p className="small muted">
              Allerede tilmeldt? <Link href="/login">Log ind</Link>
            </p>
          </form>
        </div>
        <aside className="side">
          <div className="dark-card stack-s">
            <h2>Sådan fungerer det for butikker</h2>
            <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Du opretter dine gaver i en kort guide.</li>
              <li>Vi godkender dem inden for 2 hverdage.</li>
              <li>Medarbejderne vælger. Du har intet lager hos os.</li>
              <li>Passer en gave ikke, kan medarbejderen bytte den hos dig frem til {BYTTEFRIST} – det giver ofte et ekstra besøg i butikken.</li>
              <li>Efter vælgefristen ser du præcis, hvad der skal afleveres.</li>
              <li>Du afleverer i Brørup – gaveindpakket, hvor kunden har valgt det (30 kr. ekstra pr. stk.) – og får afregning efter sæsonen.</li>
            </ol>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
