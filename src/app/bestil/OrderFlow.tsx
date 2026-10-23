'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState } from 'react';
import type { OrderState } from './actions';
import { Icon } from '@/components/Icon';
import { FoodInfo } from '@/components/FoodInfo';

export interface GroupView {
  id: number;
  value: number;
  note: string | null;
  products: { id: number; name: string; shop: string; town: string | null; desc: string; img: string | null; food: boolean; ingredients: string | null; net: string | null }[];
}
interface WeekView {
  key: string;
  week: number;
  deliveryDate: string;
  chooseDeadline: string;
  available: boolean;
  closed: boolean;
}

const MOMS = 0.25;
const kr = (n: number) => `${n.toLocaleString('da-DK')} kr.`;
const incl = (n: number) => Math.round(n * (1 + MOMS));
const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
const dayMonth = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
  const [, m, day] = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Copenhagen' }).split('-').map(Number);
  return `${day}. ${MONTHS.at(m - 1)}`;
};
const weekday = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('da-DK', { weekday: 'long', timeZone: 'Europe/Copenhagen' });
const STORAGE = 'gfd-bestilling-v1';
const STEPS = ['Vælg gaver', 'Levering', 'Leveringsuge', 'Gennemfør'];

export default function OrderFlow({
  groups,
  weeks,
  settings,
  contact,
  defaults,
  action,
}: {
  groups: GroupView[];
  weeks: WeekView[];
  settings: { homeFee: number; wrapFee: number; minQty: number };
  contact: { phone: string; email: string };
  defaults: Record<string, string>;
  action: (prev: OrderState, fd: FormData) => Promise<OrderState>;
}) {
  const [step, setStep] = useState(1);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [mode, setMode] = useState<'company' | 'home'>('company');
  const [wrapping, setWrapping] = useState(false);
  const [codes, setCodes] = useState<'email' | 'file'>('email');
  const [week, setWeek] = useState<string>('');
  const [modal, setModal] = useState<GroupView | null>(null);
  const [state, formAction, pending] = useActionState(action, {});
  // Unik nøgle pr. bestillingsforløb, så et dobbeltklik ikke giver to bestillinger
  const [submitKey] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()));

  // Husk kurven, hvis siden genindlæses
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (saved) {
        setQty(saved.qty ?? {});
        setMode(saved.mode ?? 'company');
        setWrapping(!!saved.wrapping);
        setCodes(saved.codes ?? 'email');
        if (weeks.some((w) => w.key === saved.week && w.available)) setWeek(saved.week);
      }
    } catch {}
  }, [weeks]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ qty, mode, wrapping, codes, week }));
    } catch {}
  }, [qty, mode, wrapping, codes, week]);
  useEffect(() => {
    if (state.error) setStep(4);
  }, [state]);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setModal(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const lines = groups.filter((g) => (qty[g.id] ?? 0) > 0).map((g) => ({ g, n: qty[g.id] }));
  const totals = useMemo(() => {
    const n = lines.reduce((s, l) => s + l.n, 0);
    const subtotal = lines.reduce((s, l) => s + l.n * l.g.value, 0);
    const delivery = mode === 'home' ? n * settings.homeFee : 0;
    const wrap = wrapping ? n * settings.wrapFee : 0;
    const ex = subtotal + delivery + wrap;
    const moms = Math.round(ex * MOMS);
    return { n, subtotal, delivery, wrap, moms, total: ex + moms };
  }, [lines, mode, wrapping, settings]);
  const selWeek = weeks.find((w) => w.key === week);
  const canNext = step === 1 ? totals.n >= settings.minQty : step === 3 ? !!selWeek : true;
  const set = (id: number, n: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(5000, Math.floor(n) || 0)) }));
  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const val = (k: string) => state.values?.[k] ?? defaults[k] ?? '';

  const titles = [
    ['Bestil årets julegavekort', 'Vælg gavebeløb og antal medarbejdere. Medarbejderne vælger selv deres gave fra lokale butikker.'],
    ['Levering og indpakning', 'Vælg hvor gaverne skal leveres, og hvordan gavekoderne skal ud til medarbejderne.'],
    ['Hvornår skal gaverne leveres?', 'Vælg leveringsuge. Medarbejderne skal have valgt gave senest søndagen knap tre uger før.'],
    ['Du er næsten i mål', 'Udfyld firmaoplysninger, så sender vi ordrebekræftelse og gavekoder på mail.'],
  ][step - 1];

  return (
    <main className="wrap stack">
      <div className="row between end" style={{ gap: 24 }}>
        <div style={{ flex: '1 1 480px' }}>
          <h1 style={{ color: 'var(--green)' }}>{titles[0]}</h1>
          <p className="muted" style={{ fontSize: 16, marginTop: 6 }}>
            {titles[1]}
          </p>
        </div>
        <ol className="stepper" aria-label="Trin">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            return (
              <li key={label} className={n === step ? 'on' : done ? 'done' : ''}>
                <button type="button" onClick={() => n < step && go(n)} disabled={n >= step} aria-current={n === step ? 'step' : undefined}>
                  <span className="dot">{done ? '✓' : n}</span>
                  <span className="lbl">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="usp card">
        <span>
          <Icon name="mail" /> Gavekoder på e-mail med det samme
        </span>
        <span>
          <Icon name="gift" /> Valgfri gaveindpakning
        </span>
        <span>
          <Icon name="calendar" /> I vælger selv leveringsuge
        </span>
        <span>
          <Icon name="receipt" /> Faktura eller EAN
        </span>
        <span>
          <Icon name="pin" /> Gaver fra lokale butikker
        </span>
      </div>

      <div className="split">
        <div className="main stack">
          {step === 1 && (
            <div className="groups">
              {groups.map((g) => {
                const n = qty[g.id] ?? 0;
                const tax = incl(g.value) <= 1000;
                return (
                  <section key={g.id} className={`group card ${n ? 'chosen' : ''}`} aria-label={`Gavekort ${kr(g.value)}`}>
                    <div className="stack-s" style={{ padding: 18 }}>
                      <div className="row between" style={{ alignItems: 'flex-start' }}>
                        <div>
                          <div className="price">{kr(g.value)}</div>
                          <div className="small muted">pr. medarbejder ekskl. moms</div>
                        </div>
                        <span className={`badge ${tax ? 'ok' : 'warn'}`} title={g.note ?? ''}>
                          {tax ? 'Skattefri julegave' : 'Se skatteregler'}
                        </span>
                      </div>
                      <button type="button" className="linkbtn arrow" onClick={() => setModal(g)}>
                        {g.products.length} {g.products.length === 1 ? 'gave' : 'gaver'} i prisgruppen →
                      </button>
                      <button type="button" className="thumbs" onClick={() => setModal(g)} aria-label={`Se gaver til ${kr(g.value)}`}>
                        {[0, 1].map((i) => {
                          const p = g.products[i];
                          return p?.img ? <img key={i} src={p.img} alt="" /> : <span key={i} className="ph" aria-hidden="true" />;
                        })}
                      </button>
                      <div className="qty" role="group" aria-label="Antal medarbejdere">
                        <button type="button" onClick={() => set(g.id, n - 1)} aria-label="Færre">
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={n || ''}
                          placeholder="Antal medarbejdere"
                          onChange={(e) => set(g.id, Number(e.target.value))}
                          aria-label={`Antal gavekort à ${kr(g.value)}`}
                        />
                        <button type="button" onClick={() => set(g.id, n + 1)} aria-label="Flere">
                          +
                        </button>
                      </div>
                    </div>
                    <div className={`group-foot ${n ? 'on' : ''}`}>{n ? `${n} medarbejdere valgt ✓` : 'Ingen valgt endnu'}</div>
                  </section>
                );
              })}
              <section className="group card help stack-s">
                <div className="help-icon">
                  <Icon name="gift" size={28} />
                </div>
                <h2>Vi hjælper gerne</h2>
                <p className="small muted">Har I særlige ønsker, mange medarbejdere eller brug for hjælp til at sammensætte gaverne? Kontakt os – det er uforpligtende.</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <a className="btn small" href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                    Ring {contact.phone}
                  </a>
                  <a className="btn small outline" href="/kontakt" target="_blank" rel="noopener">
                    Skriv til os
                  </a>
                </div>
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="stack">
              <fieldset className="choice-set">
                <legend>Hvor skal gaverne leveres?</legend>
                <div className="choices">
                  <Choice on={mode === 'company'} onClick={() => setMode('company')} icon="building" title="Til virksomheden" price="Gratis">
                    Alle gaver leveres samlet til jer, mærket med navn på hver medarbejder.
                  </Choice>
                  <Choice on={mode === 'home'} onClick={() => setMode('home')} icon="home" title="Til medarbejdernes hjemmeadresser" price={`${kr(settings.homeFee)} pr. gave`}>
                    Medarbejderen skriver selv sin adresse, når gaven vælges. Vi sender med fragtfirma.
                  </Choice>
                </div>
              </fieldset>
              <fieldset className="choice-set">
                <legend>Skal gaverne pakkes ind?</legend>
                <div className="choices">
                  <Choice on={!wrapping} onClick={() => setWrapping(false)} icon="bag" title="Leveres i mulepose" price="Gratis">
                    Gaven leveres i en mulepose med navnelabel.
                  </Choice>
                  <Choice on={wrapping} onClick={() => setWrapping(true)} icon="gift" title="Gaveindpakning" price={`${kr(settings.wrapFee)} pr. gave`}>
                    Vi pakker hver gave ind i julepapir med navnelabel.
                  </Choice>
                </div>
              </fieldset>
              <fieldset className="choice-set">
                <legend>Hvordan skal gavekoderne ud til medarbejderne?</legend>
                <div className="choices">
                  <Choice on={codes === 'email'} onClick={() => setCodes('email')} icon="mail" title="Gavekoder på e-mail til jer" price="Gratis">
                    I får alle gavekoder på mail med det samme og deler dem selv ud – fx i et julekort.
                  </Choice>
                  <Choice on={codes === 'file'} onClick={() => setCodes('file')} icon="users" title="Vi sender til jeres medarbejdere" price="Gratis">
                    I sender os en liste med navn og e-mail, og vi sender hver medarbejder sin personlige gavekode.
                  </Choice>
                </div>
              </fieldset>
              <p className="small muted">Gavekortene leveres digitalt på e-mail. Medarbejderen logger ind med sin kode og vælger én gave.</p>
            </div>
          )}

          {step === 3 && (
            <div className="stack">
              <div className="weeks">
                {weeks.map((w) => (
                  <button
                    type="button"
                    key={w.key}
                    className={`week ${week === w.key ? 'on' : ''} ${w.available ? '' : 'off'}`}
                    onClick={() => w.available && setWeek(w.key)}
                    disabled={!w.available}
                    aria-pressed={week === w.key}
                  >
                    <b>Uge {w.week}</b>
                    <span>{w.closed ? 'Ikke tilgængelig' : w.available ? `Leveres senest ${dayMonth(w.deliveryDate)}` : 'Fristen er overskredet'}</span>
                  </button>
                ))}
              </div>
              {selWeek && (
                <div className="tiles">
                  <div className="card row" style={{ gap: 16, flexWrap: 'nowrap' }}>
                    <span className="big-icon">
                      <Icon name="truck" size={30} />
                    </span>
                    <div>
                      <div className="eyebrow">Vi leverer jeres gaver senest</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {weekday(selWeek.deliveryDate)} d. {dayMonth(selWeek.deliveryDate)}
                      </div>
                    </div>
                  </div>
                  <div className="card row" style={{ gap: 16, flexWrap: 'nowrap' }}>
                    <span className="big-icon">
                      <Icon name="clock" size={30} />
                    </span>
                    <div>
                      <div className="eyebrow">Medarbejderne skal vælge senest</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {weekday(selWeek.chooseDeadline)} d. {dayMonth(selWeek.chooseDeadline)} kl. 23.59
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <form action={formAction} id="checkout" className="stack" noValidate={false}>
              <input type="hidden" name="lines" value={JSON.stringify(lines.map((l) => ({ groupId: l.g.id, qty: l.n })))} />
              <input type="hidden" name="submit_key" value={submitKey} />
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="wrapping" value={wrapping ? '1' : '0'} />
              <input type="hidden" name="codes" value={codes} />
              <input type="hidden" name="week" value={week} />
              {state.error && (
                <div className="alert bad" role="alert">
                  {state.error}
                </div>
              )}
              <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
                <BillingSection val={val} mode={mode} />
                <section className="card form">
                  <h2>Kontaktperson</h2>
                  <p className="hint">Ordrebekræftelse{codes === 'email' ? ' og gavekoder' : ''} sendes hertil.</p>
                  <div className="grid-2">
                    <Field name="contact_first" label="Fornavn" val={val} autoComplete="given-name" required />
                    <Field name="contact_last" label="Efternavn" val={val} autoComplete="family-name" required />
                    <Field name="contact_email" label="E-mail" type="email" val={val} autoComplete="email" required />
                    <Field name="contact_email2" label="Gentag e-mail" type="email" val={val} autoComplete="off" required />
                    <Field name="contact_phone" label="Telefon" type="tel" val={val} autoComplete="tel" required />
                  </div>
                  <h2 style={{ marginTop: 8 }}>Betaling</h2>
                  <PaymentChoice val={val} />
                  {codes === 'file' && (
                    <div className="stack-s" style={{ marginTop: 8 }}>
                      <h2>Medarbejderliste</h2>
                      <p className="hint">
                        Én medarbejder pr. linje: navn; e-mail; prisgruppe (fx 500). Vi sender gavekoderne, så snart bestillingen er gennemført. I kan også uploade listen senere i jeres
                        oversigt.
                      </p>
                      <textarea name="recipients_text" defaultValue={val('recipients_text')} placeholder={'Anne Jensen; anne@firma.dk; 500\nBo Hansen; bo@firma.dk; 500'} aria-label="Medarbejderliste" />
                      <label className="small">
                        Eller vælg en fil (CSV fra Excel): <input type="file" name="recipients_file" accept=".csv,.txt" />
                      </label>
                    </div>
                  )}
                  <label className="check small" style={{ marginTop: 8 }}>
                    <input type="checkbox" name="newsletter" value="1" defaultChecked={val('newsletter') === '1'} />
                    <span>Ja tak til nyhedsbrev med gaveidéer før højtiderne</span>
                  </label>
                  <label className="check small">
                    <input type="checkbox" name="terms" value="1" required defaultChecked={val('terms') === '1'} />
                    <span>
                      Jeg accepterer{' '}
                      <Link href="/handelsbetingelser" target="_blank">
                        handelsbetingelserne
                      </Link>{' '}
                      og{' '}
                      <Link href="/databehandleraftale" target="_blank">
                        databehandleraftalen
                      </Link>
                    </span>
                  </label>
                </section>
              </div>
            </form>
          )}
        </div>

        <aside className="side">
          <div className="card stack-s summary">
            <h2 style={{ color: 'var(--green)', fontSize: 22 }}>Din bestilling</h2>
            <div className={`small ${canNext || step === 4 ? 'ok-txt' : 'muted'}`}>
              {totals.n < settings.minQty
                ? `Vælg mindst ${settings.minQty} gaver (${totals.n} valgt)`
                : step === 3 && !selWeek
                  ? 'Vælg en leveringsuge'
                  : step === 4
                    ? 'Udfyld firmaoplysninger'
                    : '✓ Klar til næste trin'}
            </div>
            {lines.length > 0 && (
              <table className="mini">
                <thead>
                  <tr>
                    <th>Prisgruppe</th>
                    <th>Antal</th>
                    <th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.g.id}>
                      <td>
                        <button type="button" className="x" onClick={() => set(l.g.id, 0)} aria-label={`Fjern ${kr(l.g.value)}`}>
                          ×
                        </button>{' '}
                        {kr(l.g.value)}
                      </td>
                      <td>
                        <input className="mini-qty" type="number" min={0} value={l.n} onChange={(e) => set(l.g.id, Number(e.target.value))} aria-label="Antal" />
                      </td>
                      <td className="num">{kr(l.n * l.g.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {step >= 2 && totals.n > 0 && (
              <dl className="sum">
                <dt>Levering</dt>
                <dd>{mode === 'home' ? `Hjemmeadresser · ${kr(totals.delivery)}` : 'Til virksomheden · Gratis'}</dd>
                <dt>Indpakning</dt>
                <dd>{wrapping ? `Gaveindpakning · ${kr(totals.wrap)}` : 'Mulepose · Gratis'}</dd>
                <dt>Gavekoder</dt>
                <dd>{codes === 'email' ? 'På e-mail til jer' : 'Sendes til medarbejderne'}</dd>
                {selWeek && (
                  <>
                    <dt>Leveringsuge</dt>
                    <dd>
                      Uge {selWeek.week} · senest {dayMonth(selWeek.deliveryDate)}
                    </dd>
                  </>
                )}
              </dl>
            )}
            <div className="totals">
              <div className="row between">
                <span>Gaver til {totals.n} medarbejdere</span>
                <span>{kr(totals.subtotal)}</span>
              </div>
              {totals.delivery > 0 && (
                <div className="row between">
                  <span>Levering</span>
                  <span>{kr(totals.delivery)}</span>
                </div>
              )}
              {totals.wrap > 0 && (
                <div className="row between">
                  <span>Indpakning</span>
                  <span>{kr(totals.wrap)}</span>
                </div>
              )}
              <div className="row between">
                <span>Moms 25 %</span>
                <span>{kr(totals.moms)}</span>
              </div>
              <div className="row between total">
                <span>I alt inkl. moms</span>
                <span>{kr(totals.total)}</span>
              </div>
            </div>
            {step < 4 ? (
              <button type="button" className="btn block next" disabled={!canNext} onClick={() => go(step + 1)}>
                <span>
                  Næste
                  <small>{STEPS[step]}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ) : (
              <button type="submit" form="checkout" className="btn block next" disabled={pending || totals.n < settings.minQty || !selWeek}>
                <span>
                  {pending ? 'Sender bestilling …' : 'Gennemfør bestilling'}
                  <small>Faktura eller EAN</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            )}
            {step > 1 && (
              <button type="button" className="linkbtn small" onClick={() => go(step - 1)}>
                ‹ Tilbage
              </button>
            )}
            <ul className="trust small muted">
              <li>Minimumskøb {settings.minQty} gaver</li>
              <li>Gaverne er fysiske tingsgaver – <Link href="/skatteregler">se skatteregler</Link></li>
              <li>Betaling via faktura eller EAN</li>
            </ul>
          </div>
        </aside>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">Gaveudvalg</div>
                <h2 id="modal-title" style={{ fontSize: 26, color: 'var(--green)' }}>
                  {kr(modal.value)}
                </h2>
                <div className="small muted">{modal.products.length} gaver i prisgruppen · medarbejderen vælger én</div>
              </div>
              <button type="button" className="close" onClick={() => setModal(null)} aria-label="Luk" autoFocus>
                ×
              </button>
            </div>
            <div className="modal-body">
              {modal.products.length === 0 ? (
                <p className="muted">Butikkerne er ved at lægge gaver ind i denne prisgruppe. Kom tilbage snart, eller kontakt os.</p>
              ) : (
                <div className="products">
                  {modal.products.map((p) => (
                    <article key={p.id} className="product">
                      <div className="img">{p.img ? <img src={p.img} alt={p.name} /> : <span>Billede kommer</span>}</div>
                      <div className="body">
                        <div className="eyebrow">
                          {p.shop}
                          {p.town ? ` · ${p.town}` : ''}
                        </div>
                        <h3>{p.name}</h3>
                        <p className="desc">{p.desc}</p>
                        {p.food && <FoodInfo ingredients={p.ingredients} netContent={p.net} contact={contact} compact />}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-foot row between">
              <span className="small muted">Udvalget kan ændre sig, efterhånden som butikkerne tilføjer gaver.</span>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!qty[modal.id]) set(modal.id, settings.minQty);
                  setModal(null);
                }}
              >
                {qty[modal.id] ? 'Luk' : `Vælg ${kr(modal.value)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Choice({ on, onClick, icon, title, price, children }: { on: boolean; onClick: () => void; icon: string; title: string; price: string; children: React.ReactNode }) {
  return (
    <button type="button" className={`choice ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="choice-icon">
        <Icon name={icon} size={30} />
      </span>
      <b>{title}</b>
      <span className="small muted">{children}</span>
      <span className="choice-price">{price}</span>
    </button>
  );
}

function Field({
  name,
  label,
  val,
  type = 'text',
  required,
  autoComplete,
  hint,
  inputMode,
}: {
  name: string;
  label: string;
  val: (k: string) => string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  inputMode?: 'numeric';
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input id={name} name={name} type={type} defaultValue={val(name)} required={required} autoComplete={autoComplete} inputMode={inputMode} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function BillingSection({ val, mode }: { val: (k: string) => string; mode: 'company' | 'home' }) {
  const [msg, setMsg] = useState('');
  const [same, setSame] = useState(val('delivery_same') !== '0');
  const lookup = async () => {
    const el = (id: string) => document.getElementById(id) as HTMLInputElement | null;
    const cvr = el('cvr')?.value ?? '';
    setMsg('Henter …');
    try {
      const r = await fetch(`/api/cvr?cvr=${encodeURIComponent(cvr)}`);
      const d = await r.json();
      if (!r.ok) return setMsg(d.error ?? 'Ikke fundet');
      const fill = (id: string, v: string) => {
        const i = el(id);
        if (i && v) i.value = v;
      };
      fill('company_name', d.name);
      fill('billing_address', d.address);
      fill('billing_zip', String(d.zip ?? ''));
      fill('billing_city', d.city);
      setMsg('Oplysningerne er hentet – tjek dem gerne.');
    } catch {
      setMsg('Opslaget virker ikke lige nu – udfyld felterne selv.');
    }
  };
  return (
    <section className="card form">
      <h2>Faktureringsoplysninger</h2>
      <div className="field">
        <label htmlFor="cvr">CVR-nummer *</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input id="cvr" name="cvr" type="text" inputMode="numeric" defaultValue={val('cvr')} autoComplete="off" />
          <button type="button" className="btn outline" onClick={lookup} style={{ whiteSpace: 'nowrap' }}>
            Hent oplysninger
          </button>
        </div>
        {msg && (
          <span className="hint" role="status">
            {msg}
          </span>
        )}
      </div>
      <Field name="company_name" label="Firmanavn" val={val} autoComplete="organization" required />
      <Field name="billing_address" label="Fakturaadresse" val={val} autoComplete="street-address" required />
      <div className="grid-2" style={{ gridTemplateColumns: '120px 1fr' }}>
        <Field name="billing_zip" label="Postnr." val={val} inputMode="numeric" autoComplete="postal-code" required />
        <Field name="billing_city" label="By" val={val} autoComplete="address-level2" required />
      </div>
      <div className="field">
        <label htmlFor="billing_country">Land *</label>
        <select id="billing_country" name="billing_country" defaultValue={val('billing_country') || 'Danmark'}>
          <option>Danmark</option>
          <option>Sverige</option>
          <option>Norge</option>
          <option>Tyskland</option>
        </select>
      </div>
      <div className="grid-2">
        <Field name="billing_email" label="Faktureringsemail" type="email" val={val} required />
        <Field name="billing_email2" label="Gentag faktureringsemail" type="email" val={val} required />
        <Field name="po_number" label="PO- / rekvisitionsnummer" val={val} />
        <Field name="ean" label="EAN-nummer" val={val} inputMode="numeric" hint="Offentlige kunder: 13 cifre" />
      </div>
      {mode === 'company' && (
        <>
          <label className="check small">
            <input type="checkbox" name="delivery_same" value="1" checked={same} onChange={(e) => setSame(e.target.checked)} />
            <span>Leveringsadressen er den samme som fakturaadressen</span>
          </label>
          {!same && (
            <div className="stack-s">
              <h3>Leveringsadresse</h3>
              <Field name="delivery_name" label="Firma / modtager" val={val} />
              <Field name="delivery_att" label="Att." val={val} />
              <Field name="delivery_address" label="Adresse" val={val} required />
              <div className="grid-2" style={{ gridTemplateColumns: '120px 1fr' }}>
                <Field name="delivery_zip" label="Postnr." val={val} inputMode="numeric" required />
                <Field name="delivery_city" label="By" val={val} required />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PaymentChoice({ val }: { val: (k: string) => string }) {
  const [pay, setPay] = useState(val('payment') || 'faktura');
  return (
    <div className="choices" role="radiogroup" aria-label="Betalingsmetode">
      {[
        ['faktura', 'receipt', 'Faktura', 'Betal via faktura, 14 dage netto'],
        ['ean', 'bank', 'EAN-betaling', 'For offentlige kunder – udfyld EAN-nummer'],
      ].map(([k, icon, t, d]) => (
        <label key={k} className={`choice ${pay === k ? 'on' : ''}`}>
          <input type="radio" name="payment" value={k} checked={pay === k} onChange={() => setPay(k)} className="sr-only" />
          <span className="choice-icon">
            <Icon name={icon} size={30} />
          </span>
          <b>{t}</b>
          <span className="small muted">{d}</span>
        </label>
      ))}
    </div>
  );
}
