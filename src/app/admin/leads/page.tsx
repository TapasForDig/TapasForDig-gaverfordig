import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Badge, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, q } from '@/lib/db';
import { datoTid } from '@/lib/format';
import { subscribeLead } from '@/lib/klaviyo';
import { adminNav } from '../nav';

const SOURCES: Record<string, string> = { '/': 'forsiden', '/saadan-virker-det': 'Sådan virker det', '/butikker': 'Butikkerne', bestilling: 'bestilling (nyhedsbrev)' };
const STATUSES = ['ny', 'kontaktet', 'kunde', 'ikke interesseret'] as const;

interface Lead {
  id: number;
  kind: 'virksomhed' | 'butik';
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  employees: number | null;
  town: string | null;
  message: string | null;
  consent: boolean;
  klaviyo: string | null;
  source: string | null;
  status: string;
  created_at: Date;
}

async function leadAction(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const id = Number(fd.get('id'));
  const what = String(fd.get('what'));
  if (what === 'status') {
    const s = String(fd.get('status'));
    if ((STATUSES as readonly string[]).includes(s)) {
      await q('update leads set status = $1 where id = $2', [s, id]);
      await logEvent(u.email, 'lead', id, 'status', s);
    }
  } else if (what === 'klaviyo') {
    const [l] = await q<Lead>('select * from leads where id = $1 and consent', [id]);
    if (l) {
      const k = await subscribeLead(l.kind, { email: l.email, name: l.name, company: l.company, phone: l.phone });
      await q('update leads set klaviyo = $1 where id = $2', [k, id]);
    }
  } else if (what === 'delete') {
    await q('delete from leads where id = $1', [id]);
    await logEvent(u.email, 'lead', id, 'slettet');
  }
  revalidatePath('/admin/leads');
}

export default async function Leads({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const type = sp.type === 'butik' || sp.type === 'virksomhed' ? sp.type : '';
  const leads = await q<Lead>(`select * from leads ${type ? 'where kind = $1' : ''} order by id desc limit 500`, type ? [type] : []);
  const counts = await q<{ kind: string; n: number; nye: number }>(`select kind, count(*)::int n, count(*) filter (where status = 'ny')::int nye from leads group by kind`);
  const c = (k: string) => counts.find((x) => x.kind === k) ?? { n: 0, nye: 0 };
  const live = !!process.env.KLAVIYO_PRIVATE_KEY;
  return (
    <Shell area="Admin" nav={adminNav} active="/admin/leads">
      <div className="stack">
        <div className="row between">
          <h1>Leads</h1>
          <a className="btn outline" href="/admin/leads/csv">
            Hent CSV
          </a>
        </div>
        <div className={`alert ${live ? '' : 'warn'}`}>
          {live
            ? 'Leads med samtykke sendes automatisk til Klaviyo (listerne “Gaver For Dig – Virksomheder” og “Gaver For Dig – Butikker”).'
            : 'Klaviyo er ikke forbundet endnu: leads gemmes her, men sendes ikke videre. Sæt KLAVIYO_PRIVATE_KEY i Vercel.'}
        </div>
        <div className="row">
          <Link href="/admin/leads" className={`btn small ${type ? 'outline' : ''}`}>
            Alle
          </Link>
          <Link href="/admin/leads?type=virksomhed" className={`btn small ${type === 'virksomhed' ? '' : 'outline'}`}>
            Virksomheder ({c('virksomhed').n}, {c('virksomhed').nye} nye)
          </Link>
          <Link href="/admin/leads?type=butik" className={`btn small ${type === 'butik' ? '' : 'outline'}`}>
            Butikker ({c('butik').n}, {c('butik').nye} nye)
          </Link>
        </div>
        <div className="stack-s">
          {leads.map((l) => (
            <div key={l.id} className="card stack-s">
              <div className="row between">
                <div>
                  <b>{l.company ?? l.name}</b> <Badge>{l.kind}</Badge> {l.status === 'ny' && <Badge tone="warn">ny</Badge>}
                  <div className="small muted">
                    {l.name} · <a href={`mailto:${l.email}`}>{l.email}</a>
                    {l.phone && (
                      <>
                        {' '}
                        · <a href={`tel:${l.phone}`}>{l.phone}</a>
                      </>
                    )}
                    {l.employees ? ` · ca. ${l.employees} medarbejdere` : ''}
                    {l.town ? ` · ${l.town}` : ''}
                  </div>
                </div>
                <span className="small muted">
                  {datoTid(l.created_at)} · fra {SOURCES[l.source ?? ''] ?? l.source ?? 'siden'}
                </span>
              </div>
              {l.message && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{l.message}</p>}
              <div className="row between small">
                <span className="muted">
                  Samtykke: {l.consent ? 'ja' : 'nej'}
                  {l.consent && <> · Klaviyo: {l.klaviyo === 'ok' ? <Badge tone="ok">sendt</Badge> : <Badge tone="bad">{l.klaviyo ?? 'ikke sendt'}</Badge>}</>}
                </span>
                <div className="row">
                  <form action={leadAction} className="row" style={{ flexWrap: 'nowrap' }}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="what" value="status" />
                    <select name="status" defaultValue={l.status} aria-label="Status" style={{ width: 'auto', padding: '6px 10px', minHeight: 0 }}>
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <button className="btn small outline">Gem</button>
                  </form>
                  {l.consent && l.klaviyo !== 'ok' && live && (
                    <form action={leadAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="what" value="klaviyo" />
                      <button className="btn small outline">Send til Klaviyo</button>
                    </form>
                  )}
                  <form action={leadAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="what" value="delete" />
                    <button className="btn small outline">Slet</button>
                  </form>
                </div>
              </div>
            </div>
          ))}
          {leads.length === 0 && <p className="muted">Ingen leads endnu. De kommer fra formularerne på forsiden, “Sådan virker det” og Butikkerne – og fra bestillinger med ja til nyhedsbrev.</p>}
        </div>
      </div>
    </Shell>
  );
}
