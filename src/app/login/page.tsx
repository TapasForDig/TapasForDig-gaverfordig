import { redirect } from 'next/navigation';
import { Notice, Shell } from '@/components/ui';
import { checkPassword, currentUser, homeFor, startSession, type Role } from '@/lib/auth';
import { one } from '@/lib/db';
import { str } from '@/lib/format';

async function login(fd: FormData) {
  'use server';
  const email = str(fd, 'email').toLowerCase();
  const pw = str(fd, 'password');
  const u = await one<{ id: number; password_hash: string; role: Role }>('select id, password_hash, role from users where email = $1', [email]);
  if (!u || !checkPassword(pw, u.password_hash)) redirect('/login?m=' + encodeURIComponent('!Forkert e-mail eller adgangskode'));
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
        </form>
      </div>
    </Shell>
  );
}
