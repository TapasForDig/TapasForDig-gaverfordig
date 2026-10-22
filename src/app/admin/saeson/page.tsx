import { redirect } from 'next/navigation';
import { Notice, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, q } from '@/lib/db';
import { fromLocalInput, int, kr, str, toLocalInput } from '@/lib/format';
import { activeSeason, categories, getSetting } from '@/lib/gifts';
import { adminNav } from '../nav';

async function saveSeason(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const vals = [str(fd, 'name'), fromLocalInput(str(fd, 'order')), fromLocalInput(str(fd, 'choose')), fromLocalInput(str(fd, 'dropoff')), fromLocalInput(str(fd, 'delivery'))];
  const id = Number(fd.get('id'));
  if (fd.get('new') === 'ja' || !id) {
    await q('update seasons set active = false');
    await q('insert into seasons (name, order_deadline, choose_deadline, dropoff_deadline, delivery_from) values ($1,$2,$3,$4,$5)', vals);
    await logEvent(u.email, 'season', null, 'ny sæson', vals[0] as string);
  } else {
    await q('update seasons set name=$1, order_deadline=$2, choose_deadline=$3, dropoff_deadline=$4, delivery_from=$5 where id = $6', [...vals, id]);
    await logEvent(u.email, 'season', id, 'frister ændret');
  }
  redirect('/admin/saeson?m=' + encodeURIComponent('Sæsonen er gemt'));
}

async function saveCategories(fd: FormData) {
  'use server';
  await requireRole('admin');
  for (const c of await categories()) {
    const name = str(fd, `name-${c.id}`);
    const value = int(fd, `value-${c.id}`);
    if (name && value) await q('update price_categories set name=$1, value_kr=$2, note=$3 where id=$4', [name, value, str(fd, `note-${c.id}`), c.id]);
  }
  const newName = str(fd, 'new-name');
  const newValue = int(fd, 'new-value');
  if (newName && newValue) await q('insert into price_categories (name, value_kr, note, sort) values ($1,$2,$3,99)', [newName, newValue, str(fd, 'new-note')]);
  redirect('/admin/saeson?m=' + encodeURIComponent('Priskategorier gemt'));
}

async function saveSettings(fd: FormData) {
  'use server';
  await requireRole('admin');
  for (const key of ['indkoebsrabat_pct', 'gebyr_pr_modtager_kr', 'logistik_adresse']) {
    await q('insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value', [key, str(fd, key)]);
  }
  redirect('/admin/saeson?m=' + encodeURIComponent('Indstillinger gemt'));
}

export default async function SeasonAdmin({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const [s, cats, rabat, gebyr, adr] = await Promise.all([
    activeSeason(),
    categories(),
    getSetting('indkoebsrabat_pct'),
    getSetting('gebyr_pr_modtager_kr'),
    getSetting('logistik_adresse'),
  ]);
  return (
    <Shell area="Admin" nav={adminNav} active="/admin/saeson">
      <div className="stack">
        <h1>Sæson og priser</h1>
        <Notice msg={sp.m} />
        <div className="split">
          <div className="main stack">
            <form action={saveSeason} className="card form">
              <h2>Aktiv sæson og frister</h2>
              <input type="hidden" name="id" value={s?.id ?? ''} />
              <div className="field">
                <label htmlFor="name">Navn</label>
                <input id="name" name="name" type="text" defaultValue={s?.name ?? ''} required />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="order">Sidste bestilling (virksomheder)</label>
                  <input id="order" name="order" type="datetime-local" defaultValue={toLocalInput(s?.order_deadline)} />
                </div>
                <div className="field">
                  <label htmlFor="choose">Vælgefrist (medarbejdere)</label>
                  <input id="choose" name="choose" type="datetime-local" defaultValue={toLocalInput(s?.choose_deadline)} />
                </div>
                <div className="field">
                  <label htmlFor="dropoff">Afleveringsfrist (butikker)</label>
                  <input id="dropoff" name="dropoff" type="datetime-local" defaultValue={toLocalInput(s?.dropoff_deadline)} />
                </div>
                <div className="field">
                  <label htmlFor="delivery">Levering fra</label>
                  <input id="delivery" name="delivery" type="datetime-local" defaultValue={toLocalInput(s?.delivery_from)} />
                </div>
              </div>
              <label className="check small">
                <input type="checkbox" name="new" value="ja" /> Gem som ny sæson (den nuværende lukkes for nye ordrer)
              </label>
              <button className="btn" type="submit">
                Gem sæson
              </button>
            </form>

            <form action={saveCategories} className="card form">
              <h2>Priskategorier</h2>
              <p className="hint">Gavens værdi inkl. moms. Skattefri julegave (tingsgave) 2026: maks. 1.000 kr. Bagatelgrænse 2026: 1.400 kr. (2027: 1.500 kr.).</p>
              {cats.map((c) => (
                <div key={c.id} className="grid-2" style={{ gridTemplateColumns: '1fr 120px 2fr' }}>
                  <input name={`name-${c.id}`} type="text" defaultValue={c.name} aria-label="Navn" />
                  <input name={`value-${c.id}`} type="number" defaultValue={c.value_kr} aria-label="Beløb" />
                  <input name={`note-${c.id}`} type="text" defaultValue={c.note ?? ''} aria-label="Bemærkning" />
                </div>
              ))}
              <div className="grid-2" style={{ gridTemplateColumns: '1fr 120px 2fr' }}>
                <input name="new-name" type="text" placeholder="Ny kategori" aria-label="Ny kategori navn" />
                <input name="new-value" type="number" placeholder="kr." aria-label="Ny kategori beløb" />
                <input name="new-note" type="text" placeholder="Bemærkning" aria-label="Ny kategori bemærkning" />
              </div>
              <button className="btn outline" type="submit">
                Gem kategorier
              </button>
            </form>
          </div>
          <aside className="side">
            <form action={saveSettings} className="card form">
              <h2>Økonomi og drift</h2>
              <div className="field">
                <label htmlFor="indkoebsrabat_pct">Butikkernes rabat til Gaver For Dig (%)</label>
                <input id="indkoebsrabat_pct" name="indkoebsrabat_pct" type="number" min={0} max={90} defaultValue={rabat} />
                <span className="hint">Bruges til at beregne indkøbspris, når et produkt ikke har sin egen. Tomt = aftales pr. produkt.</span>
              </div>
              <div className="field">
                <label htmlFor="gebyr_pr_modtager_kr">Gebyr pr. modtager til virksomheden (kr.)</label>
                <input id="gebyr_pr_modtager_kr" name="gebyr_pr_modtager_kr" type="number" min={0} defaultValue={gebyr} />
                <span className="hint">Fx pakning og levering. Nu: {kr(Number(gebyr) || 0)}</span>
              </div>
              <div className="field">
                <label htmlFor="logistik_adresse">Logistikcentralens adresse</label>
                <input id="logistik_adresse" name="logistik_adresse" type="text" defaultValue={adr} />
              </div>
              <button className="btn outline" type="submit">
                Gem
              </button>
            </form>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
