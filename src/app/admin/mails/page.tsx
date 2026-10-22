import { Badge, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { datoTid } from '@/lib/format';
import { adminNav } from '../nav';

export default async function Mails() {
  await requireRole('admin');
  const mails = await q<{ id: number; to_email: string; subject: string; body: string; status: string; created_at: Date }>(
    'select * from outbox order by id desc limit 200',
  );
  const live = !!process.env.RESEND_API_KEY;
  return (
    <Shell area="Admin" nav={adminNav} active="/admin/mails">
      <div className="stack">
        <h1>Mails</h1>
        <div className={`alert ${live ? '' : 'warn'}`}>
          {live ? 'Mails sendes via Resend.' : 'Testtilstand: mails sendes ikke, de gemmes kun her. Sæt RESEND_API_KEY for at sende rigtigt.'}
        </div>
        <div className="stack-s">
          {mails.map((m) => (
            <details key={m.id} className="card">
              <summary className="row between" style={{ cursor: 'pointer' }}>
                <span>
                  <b>{m.subject}</b> <span className="small muted">→ {m.to_email}</span>
                </span>
                <span className="row small">
                  <Badge tone={m.status === 'sendt' ? 'ok' : m.status.startsWith('fejl') ? 'bad' : undefined}>{m.status}</Badge>
                  <span className="muted">{datoTid(m.created_at)}</span>
                </span>
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, marginTop: 12 }}>{m.body}</pre>
            </details>
          ))}
          {mails.length === 0 && <p className="muted">Ingen mails endnu.</p>}
        </div>
      </div>
    </Shell>
  );
}
