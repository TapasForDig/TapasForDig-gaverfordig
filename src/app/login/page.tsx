import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Notice, Shell } from '@/components/ui';
import { checkPassword, currentUser, hashPassword, homeFor, startSession, type Role } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { str } from '@/lib/format';

async function login(fd: FormData) {
  'use server';
  const email = str(fd, 'email').toLowerCase();
  const pw = str(fd, 'password');
  let u = await one<{ id: number; password_hash: string; role: Role }>('select id, password_hash, role from users where email = $1', [email]);

  // Admin fra Vercel (ADMIN_EMAIL / ADMIN_PASSWORD) kan altid logge ind – og bliver oprettet/opdateret hvis nødvendigt
  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPw = process.env.ADMIN_PASSWORD?.trim();
  const isEnvAdmin = !!envEmail && !!envPw && email === envEmail && pw === envPw;
  if (isEnvAdmin && (!u || !checkPassword(pw, u.password_hash))) {
    if (u) {
      await q(`update users set password_hash = $1, role = 'admin' where id = $2`, [hashPassword(pw), u.id]);
    } else {
      await q(`insert into users (email, password_hash, name, role) values ($1,$2,'Admin','admin')`, [email, hashPassword(pw)]);
    }
    u = await one<{ id: number; password_hash: string; role: Role }>('select id, password_hash, role from users where email = $1', [email]);
    await logEvent(email, 'user', u?.id ?? null, 'admin-kode synkroniseret fra Vercel');
  }

  if (!u || !checkPassword(pw, u.password_hash)) {
    // Til fejlsøgning i Vercel → Logs (ingen adgangskoder logges)
    console.warn(`[login] fejlede for ${email}: ${!u ? 'ingen bruger med den e-mail' : 'forkert adgangskode'}${email === envEmail ? ' (admin-mail, men koden matcher ikke ADMIN_PASSWORD)' : ''}`);
    redirect('/login?m=' + encodeURIComponent('!Forkert e-mail eller adgangskode'));
  }
  await startSession(u.id);
  redirect(homeFor(u.role));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const u = await currentUser();
  if (u) redirect(homeFor(u.role));
  const { m } = await searchParams;
  return (
    <Shell showLogout={false}>
      <div className="card" style={{ maxWidth: 440, margin: '24px auto' }}>
        <form action={login} className="form">
          <h1 style={{ fontSize: 28 }}>Log ind</h1>
          <p className="muted small">For butikker, virksomheder og logistikcentralen. Har du fået en gave, så brug linket i din mail.</p>
          <Notice msg={m} />
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Adgangskode</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn block" type="submit">
            Log ind
          </button>
          <Link href="/login/glemt" className="small" style={{ textAlign: 'center' }}>
            Glemt adgangskode?
          </Link>
        </form>
      </div>
    </Shell>
  );
}
