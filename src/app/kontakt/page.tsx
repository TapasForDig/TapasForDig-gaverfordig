import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Notice, PublicHeader } from '@/components/ui';
import { logEvent } from '@/lib/db';
import { str } from '@/lib/format';
import { contact } from '@/lib/legal';
import { sendMail } from '@/lib/mail';
import { clientIp, tooMany } from '@/lib/ratelimit';

export const metadata: Metadata = { title: 'Kontakt – Gaver For Dig' };

const TOPICS = ['Vi er en virksomhed og vil bestille gaver', 'Jeg har en butik og vil være med', 'Jeg har fået en gavekode', 'Andet'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function send(fd: FormData) {
  'use server';
  const back = (m: string): never => redirect('/kontakt?m=' + encodeURIComponent(m) + '#formular');
  // Usynligt felt, som kun robotter udfylder
  if (str(fd, 'website')) back('Tak for din besked – vi vender tilbage hurtigst muligt.');
  const name = str(fd, 'name').slice(0, 120);
  const email = str(fd, 'email').toLowerCase().slice(0, 200);
  const message = str(fd, 'message').slice(0, 4000);
  const topic = TOPICS.includes(str(fd, 'topic')) ? str(fd, 'topic') : 'Andet';
  if (!name || !EMAIL.test(email) || message.length < 5) back('!Udfyld navn, en gyldig e-mail og din besked.');
  if (await tooMany(`kontakt:${await clientIp()}`, 5, 3600)) back('!Du har sendt flere beskeder på kort tid. Ring eller skriv direkte til os i stedet.');
  const c = await contact();
  await sendMail(
    c.email,
    `Kontaktformular: ${topic} – ${name}`,
    [`Fra: ${name} <${email}>`, `Firma/butik: ${str(fd, 'company') || '–'}`, `Telefon: ${str(fd, 'phone') || '–'}`, `Emne: ${topic}`, '', message, '', 'Svar direkte på denne mail for at svare afsenderen.'].join('\n'),
    email,
  );
  await logEvent(email, 'kontakt', null, 'besked sendt', topic);
  back('Tak for din besked – vi vender tilbage hurtigst muligt, normalt inden for én hverdag.');
}

export default async function Contact({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const c = await contact();
  const tel = c.phone.replace(/\s/g, '');
  return (
    <>
      <PublicHeader active="/kontakt" />
      <main className="wrap stack" style={{ maxWidth: 1000 }}>
        <div className="stack-s">
          <div className="eyebrow">Gaver For Dig</div>
          <h1>Kontakt os</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 640 }}>
            Har du spørgsmål til en bestilling, en gavekode eller vil din butik være med? Ring, skriv eller brug formularen – vi svarer normalt inden for én hverdag.
          </p>
        </div>

        <div className="split" style={{ alignItems: 'start' }}>
          <form action={send} className="main card form" id="formular">
            <h2>Send en besked</h2>
            <Notice msg={sp.m} />
            <div className="field">
              <label htmlFor="topic">Hvad drejer det sig om?</label>
              <select id="topic" name="topic" defaultValue={TOPICS[0]}>
                {TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="name">Navn</label>
                <input id="name" name="name" type="text" autoComplete="name" required />
              </div>
              <div className="field">
                <label htmlFor="company">Firma eller butik (valgfrit)</label>
                <input id="company" name="company" type="text" autoComplete="organization" />
              </div>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="field">
                <label htmlFor="phone">Telefon (valgfrit)</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="message">Besked</label>
              <textarea id="message" name="message" required style={{ minHeight: 140 }} />
            </div>
            <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
              <label htmlFor="website">Lad dette felt være tomt</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Vi bruger kun dine oplysninger til at svare dig. Se <Link href="/privatliv">privatlivspolitikken</Link>.
            </p>
            <div>
              <button className="btn" type="submit">
                Send besked
              </button>
            </div>
          </form>

          <aside className="side stack">
            <div className="dark-card stack-s">
              <h2>Ring eller skriv</h2>
              <p style={{ margin: 0, fontSize: 18 }}>
                <a href={`tel:+45${tel}`} style={{ color: '#fff' }}>
                  Tlf. {c.phone}
                </a>
                <br />
                <a href={`mailto:${c.email}`} style={{ color: '#fff' }}>
                  {c.email}
                </a>
              </p>
            </div>
            <div className="card stack-s">
              <h2>Adresse</h2>
              <p style={{ margin: 0 }}>
                Gaver For Dig
                <br />
                Vinfordig ApS
                <br />
                Merkurvej 1A
                <br />
                6650 Brørup
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                CVR 35854258
              </p>
            </div>
            <div className="card stack-s">
              <h2>Hurtige svar</h2>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                <li>
                  <Link href="/gave">Jeg har fået en gavekode</Link>
                </li>
                <li>
                  <Link href="/bestil">Bestil julegaver</Link>
                </li>
                <li>
                  <Link href="/skatteregler">Skatteregler for julegaver</Link>
                </li>
                <li>
                  <Link href="/butik/tilmeld">Tilmeld din butik</Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
