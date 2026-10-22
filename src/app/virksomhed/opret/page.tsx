import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Notice, Shell } from '@/components/ui';
import { hashPassword, startSession } from '@/lib/auth';
import { logEvent, one } from '@/lib/db';
import { str } from '@/lib/format';
import { sendMail } from '@/lib/mail';

async function signup(fd: FormData) {
  'use server';
  const name = str(fd, 'name');
  const email = str(fd, 'email').toLowerCase();
  const pw = str(fd, 'password');
  if (!name || !email || pw.length < 8) redirect('/virksomhed/opret?m=' + encodeURIComponent('!Udfyld navn, e-mail og en adgangskode på mindst 8 tegn'));
  if (await one('select 1 from users where email = $1', [email])) {
    redirect('/virksomhed/opret?m=' + encodeURIComponent('!Der findes allerede en bruger med den e-mail. Log ind i stedet.'));
  }
  const c = await one<{ id: number }>(
    `insert into companies (name, cvr, address, town, contact_name, phone, email) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [name, str(fd, 'cvr'), str(fd, 'address'), str(fd, 'town'), str(fd, 'contact'), str(fd, 'phone'), email],
  );
  const u = await one<{ id: number }>(
    `insert into users (email, password_hash, name, role, company_id) values ($1,$2,$3,'virksomhed',$4) returning id`,
    [email, hashPassword(pw), str(fd, 'contact') || name, c!.id],
  );
  await logEvent(email, 'company', c!.id, 'oprettet', name);
  await sendMail(email, 'Velkommen til Gaver For Dig', `Hej ${str(fd, 'contact') || name}\n\nJeres konto er oprettet. Log ind og opret jeres første gaveordre.\n\nVenlig hilsen\nGaver For Dig`);
  await startSession(u!.id);
  redirect('/virksomhed/ny');
}

export default async function CompanySignup({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <Shell showLogout={false} nav={[{ href: '/login', label: 'Log ind' }]}>
      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <form action={signup} className="form">
          <h1 style={{ fontSize: 28 }}>Opret virksomhed</h1>
          <p className="muted">Opret en konto, så kan I bestille gaver til jeres medarbejdere. Det er gratis at oprette sig.</p>
          <Notice msg={m} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="name">Virksomhedens navn</label>
              <input id="name" name="name" type="text" required />
            </div>
            <div className="field">
              <label htmlFor="cvr">CVR-nummer</label>
              <input id="cvr" name="cvr" type="text" inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor="address">Adresse</label>
              <input id="address" name="address" type="text" />
            </div>
            <div className="field">
              <label htmlFor="town">By</label>
              <input id="town" name="town" type="text" />
            </div>
            <div className="field">
              <label htmlFor="contact">Kontaktperson</label>
              <input id="contact" name="contact" type="text" />
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
              <span className="hint">Mindst 8 tegn</span>
            </div>
          </div>
          <button className="btn" type="submit">
            Opret og fortsæt
          </button>
          <p className="small muted">
            Har I allerede en konto? <Link href="/login">Log ind</Link>
          </p>
        </form>
      </div>
    </Shell>
  );
}
