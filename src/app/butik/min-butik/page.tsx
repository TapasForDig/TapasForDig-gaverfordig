import { redirect } from 'next/navigation';
import { ImageUpload } from '@/components/ImageUpload';
import { Badge, Notice, Shell } from '@/components/ui';
import { checkPassword, endOtherSessions, hashPassword, newToken } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, str } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { saveImage } from '@/lib/storage';
import { shopNav } from '../nav';
import { myShop } from '../shop';

interface ShopRow {
  id: number;
  name: string;
  cvr: string | null;
  address: string | null;
  town: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  story: string | null;
  logo: string | null;
  website: string | null;
  status: string;
}

const back = (shopId: number, m: string): never => redirect(`/butik/min-butik?butik=${shopId}&m=${encodeURIComponent(m)}`);

async function saveShop(fd: FormData) {
  'use server';
  const { u, shop } = await myShop(str(fd, 'butik'));
  const email = str(fd, 'email').toLowerCase();
  if (!str(fd, 'name')) back(shop.id, '!Butikken skal have et navn');
  let website = str(fd, 'website');
  if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;
  const f = fd.get('logo');
  if (fd.get('logo_fjern') === 'ja') await q('update shops set logo = null where id = $1', [shop.id]);
  else if (f instanceof File && f.size > 0) {
    let url = '';
    try {
      url = await saveImage(f);
    } catch (e) {
      back(shop.id, '!' + (e as Error).message);
    }
    await q('update shops set logo = $1 where id = $2', [url, shop.id]);
  }
  await q(`update shops set name=$1, cvr=$2, address=$3, town=$4, contact_name=$5, phone=$6, email=$7, story=$8, website=$10 where id=$9`, [
    str(fd, 'name'),
    str(fd, 'cvr'),
    str(fd, 'address'),
    str(fd, 'town'),
    str(fd, 'contact_name'),
    str(fd, 'phone'),
    email || null,
    str(fd, 'story').slice(0, 400),
    shop.id,
    website || null,
  ]);
  await logEvent(u.email, 'shop', shop.id, 'oplysninger rettet');
  back(shop.id, 'Oplysningerne er gemt');
}

async function addColleague(fd: FormData) {
  'use server';
  const { u, shop } = await myShop(str(fd, 'butik'));
  const email = str(fd, 'email').toLowerCase();
  const name = str(fd, 'name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back(shop.id, '!Skriv en gyldig e-mail');
  if (await one('select 1 from users where email = $1', [email])) back(shop.id, '!Der findes allerede en bruger med den e-mail');
  const nu = await one<{ id: number }>(`insert into users (email, password_hash, name, role, shop_id) values ($1,$2,$3,'butik',$4) returning id`, [
    email,
    hashPassword(newToken(18)),
    name || email,
    shop.id,
  ]);
  const token = newToken(32);
  await q(`insert into password_resets (token, user_id, expires_at) values ($1,$2, now() + interval '14 days')`, [token, nu!.id]);
  await sendMail(
    email,
    `Du har fået adgang til ${shop.name} hos Gaver For Dig`,
    `Hej ${name || ''}\n\n${u.name ?? u.email} har givet dig adgang til butiksportalen for ${shop.name} hos Gaver For Dig.\nVælg din adgangskode her (linket virker i 14 dage):\n${appUrl()}/login/nulstil/${token}\n\nVenlig hilsen\nGaver For Dig`,
  );
  await logEvent(u.email, 'shop', shop.id, 'kollega tilføjet', email);
  back(shop.id, `${email} har fået en mail med login`);
}

async function removeColleague(fd: FormData) {
  'use server';
  const { u, shop } = await myShop(str(fd, 'butik'));
  const id = Number(fd.get('user'));
  if (id === u.id) back(shop.id, '!Du kan ikke fjerne dig selv');
  await q(`delete from users where id = $1 and shop_id = $2 and role = 'butik'`, [id, shop.id]);
  back(shop.id, 'Brugeren er fjernet');
}

async function changePassword(fd: FormData) {
  'use server';
  const { u, shop } = await myShop(str(fd, 'butik'));
  const row = await one<{ password_hash: string }>('select password_hash from users where id = $1', [u.id]);
  if (!row || !checkPassword(str(fd, 'current'), row.password_hash)) back(shop.id, '!Den nuværende adgangskode er forkert');
  const pw = str(fd, 'new');
  if (pw.length < 8) back(shop.id, '!Den nye adgangskode skal være mindst 8 tegn');
  if (pw !== str(fd, 'new2')) back(shop.id, '!De to nye adgangskoder er ikke ens');
  await q('update users set password_hash = $1 where id = $2', [hashPassword(pw), u.id]);
  await endOtherSessions(u.id);
  back(shop.id, 'Din adgangskode er skiftet');
}

export default async function MyShop({ searchParams }: { searchParams: Promise<{ butik?: string; m?: string }> }) {
  const sp = await searchParams;
  const { u, shop, shops } = await myShop(sp.butik);
  const s = (await one<ShopRow>('select * from shops where id = $1', [shop.id]))!;
  const users = await q<{ id: number; email: string; name: string | null }>(`select id, email, name from users where shop_id = $1 order by id`, [shop.id]);
  const q0 = shops ? `?butik=${shop.id}` : '';
  const f = (name: keyof ShopRow, label: string, type = 'text', hint?: string) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={(s[name] as string | null) ?? ''} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
  return (
    <Shell area={`Butik · ${shop.name}`} nav={shopNav.map((n) => ({ ...n, href: n.href + q0 }))} active={`/butik/min-butik${q0}`}>
      <div className="stack">
        <div className="row between end">
          <h1>Min butik</h1>
          <Badge tone={s.status === 'approved' ? 'ok' : 'warn'}>{s.status === 'approved' ? 'Godkendt' : s.status === 'rejected' ? 'Ikke godkendt' : 'Afventer godkendelse'}</Badge>
        </div>
        <Notice msg={sp.m} />
        <div className="split">
          <form action={saveShop} className="main card form">
            <input type="hidden" name="butik" value={shop.id} />
            <h2>Butikkens oplysninger</h2>
            <div className="grid-2">
              {f('name', 'Butikkens navn')}
              {f('cvr', 'CVR-nummer')}
              {f('address', 'Adresse')}
              {f('town', 'By', 'text', 'Vises ved gaverne, fx "Vejen"')}
              {f('contact_name', 'Kontaktperson')}
              {f('phone', 'Telefon', 'tel')}
              {f('email', 'E-mail til ordrer og afleveringslister', 'email')}
            </div>
            <h2 style={{ marginTop: 8 }}>Sådan præsenteres butikken</h2>
            <p className="hint" style={{ marginTop: -6 }}>
              Vises på siden <a href="/butikker" target="_blank">Deltagende butikker</a> og ved jeres gaver.
            </p>
            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="stack-s">
                <ImageUpload name="logo" current={s.logo} label="Logo" logo maxSide={800} aspect="3 / 2" />
                <span className="hint">PNG med gennemsigtig baggrund er bedst. Mindst 600 px bredt. Liggende eller kvadratisk logo.</span>
                {s.logo && (
                  <label className="check small">
                    <input type="checkbox" name="logo_fjern" value="ja" /> Fjern logoet
                  </label>
                )}
              </div>
              <div className="stack-s">
                <div className="field">
                  <label htmlFor="story">Kort om butikken</label>
                  <textarea id="story" name="story" maxLength={400} defaultValue={s.story ?? ''} style={{ minHeight: 140 }} placeholder="Fx: Familiedrevet blomsterbutik i Rødding siden 1987. Vi binder alt selv og elsker sæsonens blomster." />
                  <span className="hint">2–3 sætninger. Hvem er I, og hvad er I gode til? Maks. 400 tegn.</span>
                </div>
                {f('website', 'Hjemmeside', 'text', 'Fx www.butik.dk – valgfri')}
              </div>
            </div>
            <div>
              <button className="btn" type="submit">
                Gem oplysninger
              </button>
            </div>
          </form>
          <aside className="side">
            <div className="card stack-s">
              <h2>Hvem har adgang</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack-s">
                {users.map((x) => (
                  <li key={x.id} className="row between small">
                    <span>
                      {x.name && x.name !== x.email ? `${x.name} · ` : ''}
                      {x.email}
                      {x.id === u.id ? ' (dig)' : ''}
                    </span>
                    {x.id !== u.id && (
                      <form action={removeColleague}>
                        <input type="hidden" name="butik" value={shop.id} />
                        <input type="hidden" name="user" value={x.id} />
                        <button className="linkbtn small" style={{ color: 'var(--bad)' }}>
                          Fjern
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              <form action={addColleague} className="form" style={{ gap: 10 }}>
                <input type="hidden" name="butik" value={shop.id} />
                <h3>Giv en kollega adgang</h3>
                <input name="name" type="text" placeholder="Navn" aria-label="Navn" />
                <input name="email" type="email" placeholder="E-mail" aria-label="E-mail" required />
                <button className="btn outline" type="submit">
                  Send login
                </button>
              </form>
            </div>
            {u.role === 'butik' && (
              <form action={changePassword} className="card form" style={{ gap: 10 }}>
                <input type="hidden" name="butik" value={shop.id} />
                <h2>Skift adgangskode</h2>
                <input name="current" type="password" placeholder="Nuværende adgangskode" aria-label="Nuværende adgangskode" autoComplete="current-password" required />
                <input name="new" type="password" placeholder="Ny adgangskode (mindst 8 tegn)" aria-label="Ny adgangskode" autoComplete="new-password" minLength={8} required />
                <input name="new2" type="password" placeholder="Gentag ny adgangskode" aria-label="Gentag ny adgangskode" autoComplete="new-password" minLength={8} required />
                <button className="btn outline" type="submit">
                  Skift adgangskode
                </button>
              </form>
            )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}
