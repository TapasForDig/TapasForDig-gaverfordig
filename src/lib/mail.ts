import { q } from './db';

// Alle mails gemmes i outbox (kan ses under Admin → Mails).
// Er RESEND_API_KEY sat, sendes de også rigtigt via Resend.
export async function sendMail(to: string, subject: string, body: string) {
  let status = 'gemt';
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'Gaver For Dig <info@gaverfordig.dk>',
          to: [to],
          reply_to: process.env.MAIL_REPLY_TO || 'info@gaverfordig.dk',
          subject,
          text: body,
        }),
      });
      status = res.ok ? 'sendt' : `fejl ${res.status}`;
    } catch {
      status = 'fejl';
    }
  }
  await q('insert into outbox (to_email, subject, body, status) values ($1,$2,$3,$4)', [to, subject, body, status]);
}
