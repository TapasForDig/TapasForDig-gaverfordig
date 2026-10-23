import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Notice, Shell } from '@/components/ui';
import { hashPassword, newToken, requireRole } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, dato, str } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { adminNav } from '../nav';

const back = (m: string): never => redirect('/admin/butikker?m=' + encodeURIComponent(m));

function inviteText(contact: string, shop: string, link: string) {
  return `Hej ${contact}

Velkommen til Gaver For Dig – den lokale firmagaveløsning i Vejen Kommune.

Vi har oprettet ${shop} i butiksportalen. Her opretter du de gaver, som lokale virksomheders medarbejdere kan vælge imellem. Du afleverer kun det, der rent faktisk bliver valgt.

1. Vælg din adgangskode her (linket virker i 14 dage):
   ${link}
2. Upload jeres logo og skriv et par linjer om butikken under "Min butik". Det vises på siden med deltagende butikker.
3. Opret dine gaver under "Mine produkter" – det tager ca. 10 minutter pr. gave, og billederne kan tages med telefonen.
   Se billedguiden her: ${appUrl()}/billedguide
4. Vi godkender gaverne inden for 2 hverdage.

Har du spørgsmål, så svar bare på denne mail.

Venlig hilsen
Gaver For Dig`;
}

async function invite(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const name = str(fd, 'name');
  const email = str(fd, 'email').toLowerCase();
  const contact = str(fd, 'contact');
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back('!Skriv butikkens navn og en gyldig e-mail');
  if (await one('select 1 from users where email = $1', [email])) back('!Der findes allerede en bruger med den e-mail');
  const s = await one<{ id: number }>(
    `insert into shops (name, town, contact_name, email, phone, cvr, status) values ($1,$2,$3,$4,$5,$6,'approved') returning id`,
    [name, str(fd, 'town'), contact, email, str(fd, 'phone'), str(fd, 'cvr')],
  );
  const nu = await one<{ id: number }>(`insert into users (email, password_hash, name, role, shop_id) values ($1,$2,$3,'butik',$4) returning id`, [
    email,
    hashPassword(newToken(18)),
    contact || name,
    s!.id,
  ]);
  const token = newToken(32);
  await q(`insert into password_resets (token, user_id, expires_at) values ($1,$2, now() + interval '14 days')`, [token, nu!.id]);
  await sendMail(email, `Velkommen til Gaver For Dig, ${name}`, inviteText(contact || name, name, `${appUrl()}/login/nulstil/${token}`));
  await logEvent(u.email, 'shop', s!.id, 'inviteret', email);
  back(`${name} er oprettet, og ${email} har fået en mail med login`);
}

async function resend(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const user = await one<{ id: number; email: string; name: string | null; shop: string }>(
    `select u.id, u.email, u.name, s.name as shop from users u join shops s on s.id = u.shop_id where u.id = $1`,
    [Number(fd.get('user'))],
  );
  if (!user) return back('!Brugeren findes ikke');
  const token = newToken(32);
  await q(`insert into password_resets (token, user_id, expires_at) values ($1,$2, now() + interval '14 days')`, [token, user.id]);
  await sendMail(user.email, `Dit login til Gaver For Dig`, inviteText(user.name ?? user.shop, user.shop, `${appUrl()}/login/nulstil/${token}`));
  await logEvent(u.email, 'user', user.id, 'login gensendt');
  back(`Nyt login-link er sendt til ${user.email}`);
}

async function shopAction(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const id = Number(fd.get('shop'));
  const shop = await one<{ name: string; chosen: number }>(
    `select s.name, (select count(*)::int from recipients r join products p on p.id = r.chosen_product_id where p.shop_id = s.id) as chosen
       from shops s where s.id = $1`,
    [id],
  );
  if (!shop) return back('!Butikken findes ikke');
  const act = String(fd.get('act'));
  if (act === 'delete') {
    if (fd.get('confirm') !== 'ja') return back('!Sæt flueben for at bekræfte sletningen');
    if (shop.chosen > 0)
      return back(`!${shop.name} har gaver, som medarbejdere har valgt, og kan derfor ikke slettes. Deaktivér butikken i stedet – så forsvinder den fra siden.`);
    // Sletter også butikkens logins, produkter og afleveringssedler
    await q('delete from shops where id = $1', [id]);
    await logEvent(u.email, 'shop', id, 'slettet', shop.name);
    return back(`${shop.name} er slettet`);
  }
  if (act === 'deactivate') {
    await q(`update shops set status = 'rejected' where id = $1`, [id]);
    await logEvent(u.email, 'shop', id, 'deaktiveret', shop.name);
    return back(`${shop.name} er deaktiveret og vises ikke længere på siden`);
  }
  if (act === 'activate') {
    await q(`update shops set status = 'approved' where id = $1`, [id]);
    await logEvent(u.email, 'shop', id, 'aktiveret', shop.name);
    return back(`${shop.name} er aktiv igen`);
  }
  back('!Ukendt handling');
}

interface Row {
  id: number;
  name: string;
  town: string | null;
  status: string;
  created_at: Date;
  products: number;
  approved: number;
  pending: number;
  chosen: number;
  users: { id: number; email: string }[] | null;
}

export default async function Shops({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const rows = await q<Row>(
    `select s.id, s.name, s.town, s.status, s.created_at,
            (select count(*)::int from products p where p.shop_id = s.id) as products,
            (select count(*)::int from products p where p.shop_id = s.id and p.status = 'approved') as approved,
            (select count(*)::int from products p where p.shop_id = s.id and p.status = 'pending') as pending,
            (select count(*)::int from recipients r join products p on p.id = r.chosen_product_id where p.shop_id = s.id) as chosen,
            (select json_agg(json_build_object('id', u.id, 'email', u.email)) from users u where u.shop_id = s.id) as users
       from shops s order by s.status <> 'pending', s.name`,
  );
  return (
    <Shell area="Admin" nav={adminNav} active="/admin/butikker">
      <div className="stack">
        <h1>Butikker</h1>
        <Notice msg={sp.m} />
        <div className="split">
          <section className="main stack-s">
            {rows.length === 0 && <div className="card muted">Ingen butikker endnu. Invitér den første til højre.</div>}
            {rows.map((r) => (
              <article key={r.id} className="card shop-admin">
                <div className="shop-admin-top">
                  <div className="stack-s" style={{ gap: 2, minWidth: 0 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <b style={{ fontSize: 17 }}>{r.name}</b>
                      <Badge tone={r.status === 'approved' ? 'ok' : r.status === 'pending' ? 'warn' : 'bad'}>
                        {r.status === 'approved' ? 'Godkendt' : r.status === 'pending' ? 'Afventer' : 'Deaktiveret'}
                      </Badge>
                    </div>
                    <span className="small muted">
                      {r.town ?? '–'} · oprettet {dato(r.created_at)}
                    </span>
                  </div>
                  <div className="shop-admin-stats small">
                    <span>
                      <b>{r.approved}</b> godkendte gaver
                    </span>
                    {r.pending > 0 && <span style={{ color: 'var(--warn)' }}>{r.pending} venter</span>}
                    {r.products - r.approved - r.pending > 0 && <span className="muted">{r.products - r.approved - r.pending} kladder</span>}
                    <span>
                      <b>{r.chosen}</b> valgt
                    </span>
                  </div>
                </div>

                <div className="shop-admin-bottom small">
                  <div className="row" style={{ gap: 16 }}>
                    <Link href={`/butik/produkter?butik=${r.id}`}>Produkter</Link>
                    <Link href={`/butik/produkt/ny?butik=${r.id}`}>Opret gave</Link>
                    <Link href={`/butik/min-butik?butik=${r.id}`}>Oplysninger</Link>
                  </div>
                  <div className="row" style={{ gap: 14 }}>
                    {(r.users ?? []).map((x) => (
                      <form key={x.id} action={resend} className="row" style={{ gap: 8 }}>
                        <span className="muted">{x.email}</span>
                        <input type="hidden" name="user" value={x.id} />
                        <button className="linkbtn small">Send nyt login-link</button>
                      </form>
                    ))}
                    {!r.users && <span className="muted">Intet login</span>}
                  </div>
                </div>

                <details className="shop-admin-more small">
                  <summary>Deaktivér eller slet</summary>
                  <div className="row" style={{ gap: 16, alignItems: 'flex-start', marginTop: 10 }}>
                    <form action={shopAction}>
                      <input type="hidden" name="shop" value={r.id} />
                      {r.status === 'rejected' ? (
                        <button className="btn outline small" name="act" value="activate">
                          Aktivér igen
                        </button>
                      ) : (
                        <button className="btn outline small" name="act" value="deactivate">
                          Deaktivér
                        </button>
                      )}
                    </form>
                    <form action={shopAction} className="row" style={{ gap: 10 }}>
                      <input type="hidden" name="shop" value={r.id} />
                      {r.chosen > 0 ? (
                        <span className="muted">Kan ikke slettes – {r.chosen === 1 ? '1 gave er' : `${r.chosen} gaver er`} valgt. Deaktivér i stedet.</span>
                      ) : (
                        <>
                          <label className="check small">
                            <input type="checkbox" name="confirm" value="ja" /> Ja, slet butik, logins og gaver
                          </label>
                          <button className="btn small" name="act" value="delete" style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }}>
                            Slet butik
                          </button>
                        </>
                      )}
                    </form>
                  </div>
                </details>
              </article>
            ))}
          </section>
          <aside className="side">
            <form action={invite} className="card form">
              <h2>Invitér en butik</h2>
              <p className="hint">Butikken oprettes som godkendt og får en mail med et link til at vælge adgangskode og komme i gang.</p>
              <div className="field">
                <label htmlFor="name">Butikkens navn *</label>
                <input id="name" name="name" type="text" required />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="town">By</label>
                  <input id="town" name="town" type="text" />
                </div>
                <div className="field">
                  <label htmlFor="cvr">CVR</label>
                  <input id="cvr" name="cvr" type="text" inputMode="numeric" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="contact">Kontaktperson</label>
                <input id="contact" name="contact" type="text" />
              </div>
              <div className="field">
                <label htmlFor="email">E-mail (bruges til login) *</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div className="field">
                <label htmlFor="phone">Telefon</label>
                <input id="phone" name="phone" type="tel" />
              </div>
              <button className="btn" type="submit">
                Opret og send invitation
              </button>
            </form>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
