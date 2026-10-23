import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Notice, Shell } from '@/components/ui';
import { newToken } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, str } from '@/lib/format';
import { sendMail } from '@/lib/mail';

const SENT = 'Hvis e-mailen findes hos os, har vi sendt et link til at vælge en ny adgangskode. Linket virker i 1 time.';

async function requestReset(fd: FormData) {
  'use server';
  const email = str(fd, 'email').toLowerCase();
  const u = await one<{ id: number }>('select id from users where email = $1', [email]);
  if (u) {
    const token = newToken(32);
    await q(`insert into password_resets (token, user_id, expires_at) values ($1,$2, now() + interval '1 hour')`, [token, u.id]);
    await sendMail(
      email,
      'Nulstil din adgangskode til Gaver For Dig',
      `Hej\n\nDu har bedt om at nulstille din adgangskode. Vælg en ny her:\n${appUrl()}/login/nulstil/${token}\n\nLinket virker i 1 time. Har du ikke bedt om det, kan du se bort fra denne mail.\n\nVenlig hilsen\nGaver For Dig`,
    );
    await logEvent(email, 'user', u.id, 'nulstilling af adgangskode anmodet');
  }
  // Samme besked uanset om mailen findes, så man ikke kan teste hvem der har en konto
  redirect('/login/glemt?m=' + encodeURIComponent(SENT));
}

export default async function Forgot({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <Shell showLogout={false} active="/login">
      <div className="card" style={{ maxWidth: 440, margin: '24px auto' }}>
        <form action={requestReset} className="form">
          <h1 style={{ fontSize: 28 }}>Glemt adgangskode</h1>
          <p className="muted small">Skriv den e-mail, du logger ind med. Så sender vi et link, hvor du kan vælge en ny adgangskode.</p>
          <Notice msg={m} />
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <button className="btn block" type="submit">
            Send link
          </button>
          <Link href="/login" className="small" style={{ textAlign: 'center' }}>
            Tilbage til log ind
          </Link>
        </form>
      </div>
    </Shell>
  );
}
