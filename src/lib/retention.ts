import { logEvent, one, q } from './db';
import { runAutoReminders } from './reminders';

// Sletteregler (se privatlivspolitikken og databehandleraftalen)
export const RECIPIENT_MONTHS = 6; // medarbejderoplysninger: 6 måneder efter levering
export const OUTBOX_MONTHS = 3; // kopier af sendte mails
export const LEAD_MONTHS = 24; // henvendelser/leads

export interface CleanupResult {
  recipients: number;
  mails: number;
  sessions: number;
}

// Anonymiserer medarbejdere 6 måneder efter levering. Gavekode og gavevalg bevares til statistik,
// men kan ikke længere kobles til en person.
export async function runCleanup(actor = 'system'): Promise<CleanupResult> {
  const rec = await q<{ id: number }>(
    `update recipients r set name = null, email = null, department = null, address = null, zip = null, city = null, phone = null,
            anonymized_at = now()
       from gift_orders o
      where o.id = r.order_id and r.anonymized_at is null
        and coalesce(o.delivery_date, o.delivered_at::date) < (now() - interval '${RECIPIENT_MONTHS} months')::date
      returning r.id`,
  );
  const mails = await q<{ id: number }>(`delete from outbox where created_at < now() - interval '${OUTBOX_MONTHS} months' returning id`);
  const sess = await q<{ token: string }>(`delete from sessions where expires_at < now() returning token`);
  await q(`delete from password_resets where expires_at < now() - interval '7 days'`);
  await q(`delete from leads where created_at < now() - interval '${LEAD_MONTHS} months'`);
  await q(`delete from rate_hits where at < now() - interval '1 day'`);
  if (rec.length || mails.length) await logEvent(actor, 'oprydning', null, 'persondata slettet', `${rec.length} medarbejdere anonymiseret, ${mails.length} mails slettet`);
  await q(`insert into settings (key, value) values ('oprydning_sidst', now()::text) on conflict (key) do update set value = excluded.value`);
  return { recipients: rec.length, mails: mails.length, sessions: sess.length };
}

// Kører højst én gang i døgnet – kaldes fra admin-forsiden, så oprydningen sker, selv om cron ikke er sat op.
export async function cleanupIfDue() {
  const last = await one<{ value: string }>(`select value from settings where key = 'oprydning_sidst'`);
  if (last && Date.now() - new Date(last.value).getTime() < 24 * 3600 * 1000) return null;
  const r = await runCleanup();
  await runAutoReminders();
  return r;
}
