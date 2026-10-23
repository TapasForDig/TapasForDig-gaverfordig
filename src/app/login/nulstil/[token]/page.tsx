import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Notice, Shell } from '@/components/ui';
import { hashPassword, homeFor, startSession, type Role } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { str } from '@/lib/format';

interface Reset {
  user_id: number;
  email: string;
  role: Role;
}

async function validReset(token: string) {
  return one<Reset>(
    `select r.user_id, u.email, u.role from password_resets r join users u on u.id = r.user_id
      where r.token = $1 and r.used_at is null and r.expires_at > now()`,
    [token],
  );
}

async function setPassword(fd: FormData) {
  'use server';
  const token = str(fd, 'token');
  const pw = str(fd, 'password');
  const back = (m: string) => redirect(`/login/nulstil/${token}?m=${encodeURIComponent(m)}`);
  const r = await validReset(token);
  if (!r) redirect('/login/glemt?m=' + encodeURIComponent('!Linket er udløbet eller allerede brugt. Bestil et nyt.'));
  if (pw.length < 8) back('!Adgangskoden skal være mindst 8 tegn');
  if (pw !== str(fd, 'password2')) back('!De to adgangskoder er ikke ens');
  await q('update users set password_hash = $1 where id = $2', [hashPassword(pw), r.user_id]);
  await q('update password_resets set used_at = now() where token = $1', [token]);
  await q('delete from sessions where user_id = $1', [r.user_id]);
  await logEvent(r.email, 'user', r.user_id, 'adgangskode nulstillet');
  await startSession(r.user_id);
  redirect(homeFor(r.role));
}

export default async function ResetPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ m?: string }> }) {
  const { token } = await params;
  const { m } = await searchParams;
  const r = await validReset(token);
  return (
    <Shell showLogout={false} active="/login">
      <div className="card" style={{ maxWidth: 440, margin: '24px auto' }}>
        {r ? (
          <form action={setPassword} className="form">
            <h1 style={{ fontSize: 28 }}>Vælg ny adgangskode</h1>
            <p className="muted small">For {r.email}</p>
            <Notice msg={m} />
            <input type="hidden" name="token" value={token} />
            <div className="field">
              <label htmlFor="password">Ny adgangskode</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
              <span className="hint">Mindst 8 tegn</span>
            </div>
            <div className="field">
              <label htmlFor="password2">Gentag adgangskode</label>
              <input id="password2" name="password2" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <button className="btn block" type="submit">
              Gem og log ind
            </button>
          </form>
        ) : (
          <div className="stack-s">
            <h1 style={{ fontSize: 28 }}>Linket virker ikke</h1>
            <p className="muted">Linket er udløbet eller allerede brugt.</p>
            <Link href="/login/glemt" className="btn">
              Bestil et nyt link
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}
