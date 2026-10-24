import { logEvent, q } from './db';
import { datoTid } from './format';
import { sendMail } from './mail';
import { inviteMail } from './purchase';

// Automatiske påmindelser til medarbejdere, der ikke har valgt: første gang 7 dage før fristen, anden gang 2 dage før.
// Kun når virksomheden ikke har slået det fra, bestillingen ikke afventer betaling, og koden blev sendt for mindst 2 dage siden.
export async function runAutoReminders(): Promise<number> {
  const rows = await q<{
    id: number;
    name: string | null;
    email: string;
    code: string;
    token: string;
    greeting: string | null;
    company_name: string;
    choose_deadline: Date;
    purchase_id: number;
  }>(
    `select r.id, r.name, r.email, r.code, r.token, o.greeting, p.company_name, p.choose_deadline, p.id as purchase_id
       from recipients r join gift_orders o on o.id = r.order_id join purchases p on p.id = o.purchase_id
      where p.auto_remind and not p.hold and p.choose_deadline > now()
        and o.status in ('confirmed','invited')
        and r.email is not null and r.chosen_product_id is null and r.anonymized_at is null
        and r.invited_at is not null and r.invited_at < now() - interval '2 days'
        and coalesce(r.reminded_at, 'epoch'::timestamptz) < now() - interval '2 days'
        and ((r.auto_reminders = 0 and p.choose_deadline < now() + interval '7 days')
          or (r.auto_reminders = 1 and p.choose_deadline < now() + interval '2 days'))
      order by r.id limit 2000`,
  );
  const perPurchase = new Map<number, number>();
  for (const r of rows) {
    const days = Math.max(1, Math.ceil((new Date(r.choose_deadline).getTime() - Date.now()) / 86400000));
    await sendMail(
      r.email,
      `Husk din julegave fra ${r.company_name} – ${days === 1 ? 'sidste dag' : `${days} dage tilbage`}`,
      `Du har endnu ikke valgt din julegave. Fristen er ${datoTid(r.choose_deadline)}.\n\n` +
        inviteMail(r.name ?? '', r.company_name, r.code, r.token, r.greeting, r.choose_deadline).replace(/^Hej \n/, 'Hej\n'),
    );
    await q('update recipients set reminded_at = now(), auto_reminders = auto_reminders + 1 where id = $1', [r.id]);
    perPurchase.set(r.purchase_id, (perPurchase.get(r.purchase_id) ?? 0) + 1);
  }
  for (const [pid, n] of perPurchase) await logEvent('system', 'purchase', pid, 'automatisk påmindelse', `${n} stk.`);
  return rows.length;
}
