import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Notice, Progress, Shell, Stat } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { appUrl, dato, kr } from '@/lib/format';
import { getOrder, getSetting, giftsFor, ORDER_STATUS, orderStats, type Season } from '@/lib/gifts';
import { companyNav } from '../../nav';
import { addRecipient, confirmOrder, importRecipients, invite, remind, removeRecipient, saveDelivery, saveDetails } from './actions';

interface R {
  id: number;
  name: string;
  email: string;
  department: string | null;
  token: string;
  invited_at: Date | null;
  opened_at: Date | null;
  chosen_at: Date | null;
  is_default: boolean;
  product_name: string | null;
  shop_name: string | null;
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string; vis?: string }> }) {
  const u = await requireRole('virksomhed');
  const { id } = await params;
  const sp = await searchParams;
  const o = await getOrder(Number(id));
  if (!o || (u.role !== 'admin' && o.company_id !== u.company_id)) notFound();
  if (o.purchase_id) redirect(`/virksomhed/bestilling/${o.purchase_id}`);
  const [season, stats, rows, gifts, fee] = await Promise.all([
    one<Season>('select * from seasons where id = $1', [o.season_id]),
    orderStats(o.id),
    q<R>(
      `select r.id, r.name, r.email, r.department, r.token, r.invited_at, r.opened_at, r.chosen_at, r.is_default,
              p.name || coalesce(' – ' || r.variant_label, '') as product_name, s.name as shop_name
         from recipients r left join products p on p.id = r.chosen_product_id left join shops s on s.id = p.shop_id
        where r.order_id = $1 order by r.name`,
      [o.id],
    ),
    giftsFor(o.price_category_id, o.default_product_id).then((g) => g.filter((x) => !x.variant_options)),
    getSetting('gebyr_pr_modtager_kr'),
  ]);
  const editable = ['draft', 'confirmed', 'invited'].includes(o.status);
  const pct = stats.total ? (stats.chosen / stats.total) * 100 : 0;
  const feeKr = Number(fee) || 0;
  const filter = sp.vis ?? 'alle';
  const shown = rows.filter((r) =>
    filter === 'mangler' ? !r.product_name : filter === 'valgt' ? !!r.product_name : true,
  );
  const defaultName = gifts.find((g) => g.id === o.default_product_id)?.name;

  return (
    <Shell area={o.company_name} nav={companyNav}>
      <div className="stack">
        <div className="row between end">
          <div>
            <div className="eyebrow">
              {o.company_name} · {season?.name}
            </div>
            <h1>{o.title}</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              {o.category_name} ({kr(o.value_kr)}) · vælgefrist {dato(season?.choose_deadline)} · levering fra {dato(season?.delivery_from)}
            </div>
          </div>
          <div className="row">
            <Badge tone={o.status === 'draft' ? 'warn' : o.status === 'delivered' ? 'ok' : undefined}>{ORDER_STATUS[o.status]}</Badge>
            {o.status === 'draft' && (
              <form action={confirmOrder}>
                <input type="hidden" name="order" value={o.id} />
                <button className="btn" type="submit">
                  Bekræft ordre
                </button>
              </form>
            )}
            {['confirmed', 'invited'].includes(o.status) && rows.some((r) => !r.invited_at) && (
              <form action={invite}>
                <input type="hidden" name="order" value={o.id} />
                <button className="btn" type="submit">
                  Send invitationer ({rows.filter((r) => !r.invited_at).length})
                </button>
              </form>
            )}
            {o.status === 'invited' && stats.chosen < stats.total && (
              <form action={remind}>
                <input type="hidden" name="order" value={o.id} />
                <button className="btn outline" type="submit">
                  Send påmindelse
                </button>
              </form>
            )}
          </div>
        </div>

        <Notice msg={sp.m} />
        {o.status === 'draft' && (
          <div className="alert warn">
            Ordren er en kladde. Tilføj medarbejdere og leveringsadresse, og bekræft så ordren. Pris: {stats.total} × {kr(o.value_kr + feeKr)} ={' '}
            {kr(stats.total * (o.value_kr + feeKr))} inkl. moms.
          </div>
        )}

        <div className="stats">
          <Stat label="Modtagere" value={stats.total} />
          <Stat label="Har valgt gave" value={stats.chosen} tone="ok" />
          <Stat label="Har åbnet, ikke valgt" value={stats.opened} />
          <Stat label="Har ikke åbnet" value={stats.not_opened} tone={stats.not_opened ? 'bad' : undefined} />
        </div>

        <div className="card stack-s">
          <div className="row between small">
            <b>Valgprocent</b>
            <span>{Math.round(pct)} %</span>
          </div>
          <Progress pct={pct} label={`${Math.round(pct)} procent har valgt gave`} />
          <p className="small muted">
            Dem, der ikke vælger inden fristen, får standardgaven: <b style={{ color: 'var(--ink)' }}>{defaultName ?? 'ingen valgt endnu'}</b>
          </p>
        </div>

        <div className="split">
          <section className="main card flush">
            <div className="card-head">
              <h2>Modtagere</h2>
              <nav className="pills" aria-label="Filtrér modtagere">
                {[
                  ['alle', 'Alle'],
                  ['mangler', 'Mangler at vælge'],
                  ['valgt', 'Har valgt'],
                ].map(([k, l]) => (
                  <Link key={k} className={`pill ${filter === k ? 'on' : ''}`} href={`?vis=${k}`}>
                    {l}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Navn</th>
                    <th>Status</th>
                    <th>Gave</th>
                    {editable && <th aria-label="Handlinger" />}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b>{r.name}</b>
                        <div className="small muted">
                          {r.email}
                          {r.department ? ` · ${r.department}` : ''}
                        </div>
                      </td>
                      <td>
                        {r.product_name ? (
                          <Badge tone="ok">{r.is_default ? 'Standardgave' : 'Har valgt'}</Badge>
                        ) : r.opened_at ? (
                          <Badge tone="warn">Åbnet</Badge>
                        ) : r.invited_at ? (
                          <Badge tone="bad">Ikke åbnet</Badge>
                        ) : (
                          <Badge>Ikke inviteret</Badge>
                        )}
                      </td>
                      <td className="small">
                        {r.product_name ? (
                          <>
                            {r.product_name}
                            <div className="muted">{r.shop_name}</div>
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                      {editable && (
                        <td className="small">
                          <details>
                            <summary style={{ cursor: 'pointer' }}>Mere</summary>
                            <div className="stack-s" style={{ marginTop: 8 }}>
                              <span className="muted">Personligt link:</span>
                              <input type="text" readOnly value={`${appUrl()}/g/${r.token}`} aria-label={`Gave-link til ${r.name}`} style={{ fontSize: 12, minHeight: 32 }} />
                              {!r.product_name && (
                                <form action={removeRecipient}>
                                  <input type="hidden" name="order" value={o.id} />
                                  <input type="hidden" name="recipient" value={r.id} />
                                  <button className="linkbtn" type="submit" style={{ color: 'var(--bad)' }}>
                                    Fjern modtager
                                  </button>
                                </form>
                              )}
                            </div>
                          </details>
                        </td>
                      )}
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Ingen modtagere her endnu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card-foot row between small">
              <span className="muted">{rows.length} modtagere i alt</span>
              <a href={`/virksomhed/ordre/${o.id}/eksport`}>Hent liste over valgte gaver (CSV til Excel)</a>
            </div>
          </section>

          <aside className="side">
            {editable && (
              <div className="card">
                <form action={addRecipient} className="form">
                  <h2>Tilføj modtager</h2>
                  <input type="hidden" name="order" value={o.id} />
                  <div className="field">
                    <label htmlFor="r-name">Navn</label>
                    <input id="r-name" name="name" type="text" required />
                  </div>
                  <div className="field">
                    <label htmlFor="r-email">E-mail</label>
                    <input id="r-email" name="email" type="email" required />
                  </div>
                  <div className="field">
                    <label htmlFor="r-dept">Afdeling (valgfri)</label>
                    <input id="r-dept" name="department" type="text" />
                  </div>
                  <button className="btn outline" type="submit">
                    Tilføj
                  </button>
                </form>
              </div>
            )}
            {editable && (
              <div className="card">
                <form action={importRecipients} className="form">
                  <h2>Indsæt mange på én gang</h2>
                  <input type="hidden" name="order" value={o.id} />
                  <p className="hint">Kopiér fra Excel: én medarbejder pr. linje med navn, e-mail og evt. afdeling. Eller vælg en CSV-fil.</p>
                  <textarea name="rows" aria-label="Modtagere, én pr. linje" placeholder={'Anne Jensen; anne@firma.dk; Salg\nBo Hansen; bo@firma.dk; Lager'} />
                  <input type="file" name="file" accept=".csv,.txt" aria-label="CSV-fil" />
                  <button className="btn outline" type="submit">
                    Tilføj liste
                  </button>
                </form>
              </div>
            )}
            <div className="card">
              <form action={saveDetails} className="form">
                <h2>Hilsen og standardgave</h2>
                <input type="hidden" name="order" value={o.id} />
                <div className="field">
                  <label htmlFor="greeting">Hilsen</label>
                  <textarea id="greeting" name="greeting" defaultValue={o.greeting ?? ''} disabled={!editable} />
                </div>
                <div className="field">
                  <label htmlFor="default_product">Standardgave</label>
                  <select id="default_product" name="default_product" defaultValue={o.default_product_id ?? ''} disabled={!editable}>
                    <option value="">Ingen</option>
                    {gifts.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} – {g.shop_name}
                      </option>
                    ))}
                  </select>
                  <span className="hint">Gives til dem, der ikke har valgt, når fristen udløber.</span>
                </div>
                {editable && (
                  <button className="btn outline" type="submit">
                    Gem
                  </button>
                )}
              </form>
            </div>
            <div className="card">
              <form action={saveDelivery} className="form">
                <h2>Levering</h2>
                <input type="hidden" name="order" value={o.id} />
                <div className="field">
                  <label htmlFor="address">Leveringsadresse</label>
                  <input id="address" name="address" type="text" defaultValue={o.delivery_address ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="contact">Kontaktperson og telefon</label>
                  <input id="contact" name="contact" type="text" defaultValue={o.delivery_contact ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="note">Bemærkning til levering</label>
                  <input id="note" name="note" type="text" defaultValue={o.delivery_note ?? ''} placeholder="Fx port 2, ring ved ankomst" />
                </div>
                <button className="btn outline" type="submit">
                  Gem
                </button>
                {o.delivered_at && (
                  <p className="small muted">
                    Leveret {dato(o.delivered_at)}
                    {o.delivered_to ? ` til ${o.delivered_to}` : ''}
                  </p>
                )}
              </form>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
