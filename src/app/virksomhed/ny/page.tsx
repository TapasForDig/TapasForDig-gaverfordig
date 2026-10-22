import { redirect } from 'next/navigation';
import { Notice, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, one } from '@/lib/db';
import { dato, kr, str } from '@/lib/format';
import { activeSeason, categories } from '@/lib/gifts';
import { companyNav } from '../nav';

async function create(fd: FormData) {
  'use server';
  const u = await requireRole('virksomhed');
  const season = await activeSeason();
  const catId = Number(fd.get('category'));
  if (!u.company_id) redirect('/virksomhed?m=' + encodeURIComponent('!Kun virksomhedsbrugere kan oprette ordrer'));
  if (!season) redirect('/virksomhed/ny?m=' + encodeURIComponent('!Der er ingen åben sæson lige nu'));
  const c = await one<{ address: string | null; town: string | null; contact_name: string | null; phone: string | null }>(
    'select address, town, contact_name, phone from companies where id = $1',
    [u.company_id],
  );
  const o = await one<{ id: number }>(
    `insert into gift_orders (company_id, season_id, price_category_id, title, greeting, delivery_address, delivery_contact)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [
      u.company_id,
      season.id,
      catId,
      str(fd, 'title') || `Gave ${season.name}`,
      str(fd, 'greeting'),
      [c?.address, c?.town].filter(Boolean).join(', '),
      [c?.contact_name, c?.phone].filter(Boolean).join(', '),
    ],
  );
  await logEvent(u.email, 'order', o!.id, 'oprettet');
  redirect(`/virksomhed/ordre/${o!.id}`);
}

export default async function NewOrder({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireRole('virksomhed');
  const { m } = await searchParams;
  const [season, cats] = await Promise.all([activeSeason(), categories()]);
  const late = season?.order_deadline && new Date(season.order_deadline) < new Date();
  return (
    <Shell area="Virksomhed" nav={companyNav} active="/virksomhed/ny">
      <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
        <form action={create} className="form">
          <div>
            <div className="eyebrow">{season?.name ?? 'Ingen åben sæson'}</div>
            <h1 style={{ fontSize: 30 }}>Ny gaveordre</h1>
          </div>
          <Notice msg={m} />
          {late && <div className="alert warn">Bestillingsfristen ({dato(season?.order_deadline)}) er overskredet. Kontakt os, før I opretter ordren.</div>}
          <div className="field">
            <label htmlFor="title">Anledning</label>
            <input id="title" name="title" type="text" defaultValue={`Julegave ${new Date().getFullYear()}`} required />
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 6 }}>
              Priskategori pr. medarbejder
            </legend>
            <div className="stack-s">
              {cats.map((c, i) => (
                <label key={c.id} className="check card" style={{ padding: 14 }}>
                  <input type="radio" name="category" value={c.id} defaultChecked={c.value_kr === 1000 || (i === 0 && !cats.some((x) => x.value_kr === 1000))} required />
                  <span>
                    <b>
                      {c.name} · {kr(c.value_kr)}
                    </b>
                    {c.note && <span className="hint" style={{ display: 'block' }}>{c.note}</span>}
                  </span>
                </label>
              ))}
            </div>
            <span className="hint">Beløbet er gavens værdi inkl. moms. Medarbejderne ser ingen priser.</span>
          </fieldset>
          <div className="field">
            <label htmlFor="greeting">Hilsen til medarbejderne (valgfri)</label>
            <textarea id="greeting" name="greeting" placeholder="Fx: Tak for en stærk indsats i år. Vælg den gave, der passer dig bedst." />
            <span className="hint">Vises øverst i gaveshoppen og i invitationsmailen.</span>
          </div>
          <button className="btn" type="submit" disabled={!season}>
            Opret og tilføj medarbejdere
          </button>
        </form>
      </div>
    </Shell>
  );
}
