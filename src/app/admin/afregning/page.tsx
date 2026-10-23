import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Notice, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, q } from '@/lib/db';
import { dato, kr } from '@/lib/format';
import { activeSeason, getSetting } from '@/lib/gifts';
import { releaseCodes, weekLabel } from '@/lib/purchase';
import { adminNav } from '../nav';

async function markInvoiced(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const id = Number(fd.get('id'));
  const undo = fd.get('undo') === '1';
  await q(`update purchases set invoiced_at = ${undo ? 'null' : 'now()'} where id = $1`, [id]);
  await logEvent(u.email, 'purchase', id, undo ? 'faktura fortrudt' : 'faktureret');
  redirect('/admin/afregning?m=' + encodeURIComponent(undo ? `Ordre ${id} er markeret som ikke faktureret` : `Ordre ${id} er markeret som faktureret`));
}

async function payment(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const id = Number(fd.get('id'));
  const act = String(fd.get('act'));
  let m = '';
  if (act === 'paid') {
    const p = await q<{ hold: boolean }>('update purchases set paid_at = now() where id = $1 returning hold', [id]);
    await logEvent(u.email, 'purchase', id, 'betalt');
    if (p[0]?.hold) {
      const n = await releaseCodes(id, u.email);
      m = `Ordre ${id} er betalt, og koderne er sendt${n ? ` (${n})` : ''}`;
    } else m = `Ordre ${id} er markeret som betalt`;
  } else if (act === 'unpaid') {
    await q('update purchases set paid_at = null where id = $1', [id]);
    await logEvent(u.email, 'purchase', id, 'betaling fortrudt');
    m = `Ordre ${id} er markeret som ikke betalt`;
  } else if (act === 'hold') {
    const sent = await q<{ n: number }>(
      `select count(*)::int as n from recipients r join gift_orders o on o.id = r.order_id where o.purchase_id = $1 and r.invited_at is not null`,
      [id],
    );
    if (sent[0].n > 0) redirect('/admin/afregning?m=' + encodeURIComponent(`!Koderne til ordre ${id} er allerede sendt og kan ikke holdes tilbage`));
    await q('update purchases set hold = true where id = $1', [id]);
    await logEvent(u.email, 'purchase', id, 'afventer betaling (manuelt)');
    m = `Ordre ${id} afventer betaling – koderne holdes tilbage`;
  } else if (act === 'release') {
    const n = await releaseCodes(id, u.email);
    m = `Koderne til ordre ${id} er sendt uden betaling${n ? ` (${n})` : ''}`;
  }
  redirect('/admin/afregning?m=' + encodeURIComponent(m));
}

async function removePurchase(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const id = Number(fd.get('id'));
  const busy = await q<{ n: number }>(
    `select count(*)::int as n from recipients r join gift_orders o on o.id = r.order_id where o.purchase_id = $1 and r.handoff_id is not null`,
    [id],
  );
  if (busy[0].n > 0) redirect('/admin/afregning?m=' + encodeURIComponent(`!Ordre ${id} er allerede sendt videre til butikkerne og kan ikke slettes`));
  await q('delete from purchases where id = $1', [id]);
  await logEvent(u.email, 'purchase', id, 'slettet');
  redirect('/admin/afregning?m=' + encodeURIComponent(`Ordre ${id} er slettet`));
}

interface Inv {
  id: number;
  company_name: string;
  cvr: string | null;
  ean: string | null;
  po_number: string | null;
  payment: string;
  billing_email: string;
  quantity: number;
  subtotal_ex: number;
  delivery_fee_ex: number;
  wrapping_fee_ex: number;
  moms: number;
  total_inc: number;
  delivery_week: string;
  invoiced_at: Date | null;
  hold: boolean;
  paid_at: Date | null;
  sent: number;
  created_at: Date;
  lines: string;
}

export default async function Billing({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const season = await activeSeason();
  const rabat = await getSetting('indkoebsrabat_pct');
  const invoices = await q<Inv>(
    `select p.*, (select string_agg(o.quantity || ' × ' || pc.value_kr || ' kr.', ', ' order by pc.value_kr)
                    from gift_orders o join price_categories pc on pc.id = o.price_category_id where o.purchase_id = p.id) as lines,
            (select count(*)::int from recipients r join gift_orders o on o.id = r.order_id where o.purchase_id = p.id and r.invited_at is not null) as sent
       from purchases p order by p.hold desc, p.paid_at is not null, p.invoiced_at is not null, p.created_at desc`,
  );
  const settle = await q<{ shop: string; cvr: string | null; product: string; n: number; received: number; wrapped: number; cost_kr: number | null; value_kr: number | null }>(
    `select s.name as shop, s.cvr, p.name as product, count(*)::int as n, count(r.received_at)::int as received,
            count(r.received_at) filter (where o.wrapping)::int as wrapped, p.cost_kr, pc.value_kr
       from recipients r join products p on p.id = r.chosen_product_id join shops s on s.id = p.shop_id
       join gift_orders o on o.id = r.order_id left join price_categories pc on pc.id = p.price_category_id
      where o.season_id = $1 group by s.name, s.cvr, p.name, p.cost_kr, pc.value_kr order by s.name, p.name`,
    [season?.id ?? 0],
  );
  const pct = rabat === '' ? null : Number(rabat);
  const unit = (r: (typeof settle)[number]) => r.cost_kr ?? (pct != null && r.value_kr != null ? Math.round(r.value_kr * (1 - pct / 100)) : null);
  const wrapFee = Number(await getSetting('indpakning_kr')) || 30;
  const lineTotal = (r: (typeof settle)[number]) => (unit(r) ?? 0) * r.received + wrapFee * r.wrapped;
  const shops = [...new Set(settle.map((s) => s.shop))];
  const pending = invoices.filter((i) => !i.invoiced_at);
  const held = invoices.filter((i) => i.hold);
  const unpaid = invoices.filter((i) => i.invoiced_at && !i.paid_at);
  const limit = await getSetting('forudbetaling_graense_kr');
  const costTotal = settle.reduce((s, r) => s + lineTotal(r), 0);

  return (
    <Shell area="Admin" nav={adminNav} active="/admin/afregning">
      <div className="stack">
        <div>
          <div className="eyebrow">{season?.name}</div>
          <h1>Fakturering og afregning</h1>
        </div>
        <Notice msg={sp.m} />
        <p className="muted">Opret fakturaerne i e-conomic ud fra listen, og markér dem som faktureret og betalt her. Beløb er ekskl. moms, medmindre andet står.</p>
        {held.length > 0 && (
          <div className="alert">
            <b>{held.length} {held.length === 1 ? 'bestilling afventer' : 'bestillinger afventer'} betaling.</b> Koderne er holdt tilbage. Når betalingen er registreret, trykker du
            &quot;Markér betalt&quot;, så sendes koderne automatisk.
          </div>
        )}
        <p className="small muted">
          {Number(limit) > 0
            ? `Nye kunder betaler forud ved bestillinger på ${kr(Number(limit))} inkl. moms eller mere. Grænsen ændres under Sæson og indstillinger.`
            : 'Forudbetaling for nye kunder er slået fra. Det slås til under Sæson og indstillinger.'}{' '}
          {unpaid.length > 0 && `${unpaid.length} fakturerede ordrer er ikke markeret som betalt (${kr(unpaid.reduce((s, i) => s + i.total_inc, 0))}).`}
        </p>

        <section className="card flush">
          <div className="card-head">
            <h2>Fakturaer til virksomheder</h2>
            <b>
              {pending.length} mangler · {kr(pending.reduce((s, i) => s + i.total_inc, 0))} inkl. moms
            </b>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ordre / kunde</th>
                  <th>Linjer</th>
                  <th className="num">Gebyrer</th>
                  <th className="num">Moms</th>
                  <th className="num">I alt inkl.</th>
                  <th>Faktura</th>
                  <th>Betaling</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/virksomhed/bestilling/${i.id}`}>
                        <b>
                          {i.id} · {i.company_name}
                        </b>
                      </Link>
                      <div className="small muted">
                        CVR {i.cvr || '–'}
                        {i.ean ? ` · EAN ${i.ean}` : ''}
                        {i.po_number ? ` · Rekv. ${i.po_number}` : ''}
                      </div>
                      <div className="small muted">
                        {i.billing_email} · {dato(i.created_at)} · {weekLabel(i.delivery_week)}
                      </div>
                    </td>
                    <td className="small">{i.lines}</td>
                    <td className="num small">
                      {i.delivery_fee_ex ? <div>Levering {kr(i.delivery_fee_ex)}</div> : null}
                      {i.wrapping_fee_ex ? <div>Indpakning {kr(i.wrapping_fee_ex)}</div> : null}
                      {!i.delivery_fee_ex && !i.wrapping_fee_ex && '–'}
                    </td>
                    <td className="num">{kr(i.moms)}</td>
                    <td className="num">
                      <b>{kr(i.total_inc)}</b>
                    </td>
                    <td>
                      <form action={markInvoiced} className="stack-s">
                        <input type="hidden" name="id" value={i.id} />
                        {i.invoiced_at ? (
                          <>
                            <Badge tone="ok">Faktureret {dato(i.invoiced_at)}</Badge>
                            <button className="linkbtn small" name="undo" value="1">
                              Fortryd
                            </button>
                          </>
                        ) : (
                          <>
                            <Badge tone="warn">{i.payment === 'ean' ? 'EAN-faktura' : 'Faktura'} mangler</Badge>
                            <button className="btn small">Markér faktureret</button>
                          </>
                        )}
                      </form>
                    </td>
                    <td>
                      <form action={payment} className="stack-s">
                        <input type="hidden" name="id" value={i.id} />
                        {i.paid_at ? (
                          <>
                            <Badge tone="ok">Betalt {dato(i.paid_at)}</Badge>
                            <button className="linkbtn small" name="act" value="unpaid">
                              Fortryd
                            </button>
                          </>
                        ) : (
                          <>
                            {i.hold ? <Badge tone="bad">Afventer betaling</Badge> : <Badge>Ikke betalt</Badge>}
                            <button className="btn small" name="act" value="paid">
                              {i.hold ? 'Markér betalt og send koder' : 'Markér betalt'}
                            </button>
                            {i.hold ? (
                              <button className="linkbtn small" name="act" value="release">
                                Send koder uden betaling
                              </button>
                            ) : (
                              i.sent === 0 && (
                                <button className="linkbtn small" name="act" value="hold">
                                  Hold koderne tilbage
                                </button>
                              )
                            )}
                          </>
                        )}
                      </form>
                      <details className="small" style={{ marginTop: 6 }}>
                        <summary className="muted" style={{ cursor: 'pointer' }}>Slet</summary>
                        <form action={removePurchase} className="stack-s" style={{ marginTop: 6 }}>
                          <input type="hidden" name="id" value={i.id} />
                          <span className="muted">Sletter ordren og alle gavekoder. Kan ikke fortrydes.</span>
                          <button className="btn small" style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }}>
                            Slet ordre {i.id}
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      Ingen bestillinger endnu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card flush">
          <div className="card-head">
            <h2>Afregning til butikker</h2>
            <b>{kr(costTotal)}</b>
          </div>
          {pct == null && (
            <div className="alert warn" style={{ margin: 16 }}>
              Indkøbsrabat er ikke sat under Sæson og priser, og nogle produkter har ingen indkøbspris. De står som &quot;aftales&quot;.
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Butik / produkt</th>
                  <th className="num">Valgt</th>
                  <th className="num">Modtaget</th>
                  <th className="num">Indkøbspris</th>
                  <th className="num">Indpakket</th>
                  <th className="num">Til betaling</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => {
                  const rows = settle.filter((r) => r.shop === shop);
                  const sum = rows.reduce((s, r) => s + lineTotal(r), 0);
                  return [
                    <tr key={shop} style={{ background: 'var(--cream)' }}>
                      <td colSpan={5}>
                        <b>{shop}</b> <span className="small muted">CVR {rows[0].cvr || '–'}</span>
                      </td>
                      <td className="num">
                        <b>{kr(sum)}</b>
                      </td>
                    </tr>,
                    ...rows.map((r) => (
                      <tr key={shop + r.product}>
                        <td className="small" style={{ paddingLeft: 36 }}>
                          {r.product}
                        </td>
                        <td className="num">{r.n}</td>
                        <td className="num">{r.received}</td>
                        <td className="num">{unit(r) != null ? kr(unit(r)) : 'aftales'}</td>
                        <td className="num small">{r.wrapped ? `${r.wrapped} × ${kr(wrapFee)}` : '–'}</td>
                        <td className="num">{unit(r) != null ? kr(lineTotal(r)) : '–'}</td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}
