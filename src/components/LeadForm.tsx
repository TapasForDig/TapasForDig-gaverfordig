import Link from 'next/link';
import { saveLead } from '@/app/lead/actions';
import { CONSENT_TEXT } from '@/lib/klaviyo';

// Lead-opsamler til virksomheder ("hør mere / få et tilbud") og butikker ("vil gerne være med")
export function LeadForm({ kind, returnTo, status, title, intro }: { kind: 'virksomhed' | 'butik'; returnTo: string; status?: string; title: string; intro: string }) {
  const ok = status === 'ok';
  const err = status && status !== 'ok' ? status.replace(/^!/, '') : '';
  return (
    <section id="lead" className="lead card">
      <div className="lead-text stack-s">
        <h2>{title}</h2>
        <p className="muted">{intro}</p>
      </div>
      {ok ? (
        <div className="alert" role="status">
          Tak! Vi kontakter dig hurtigst muligt – normalt inden for én hverdag.
        </div>
      ) : (
        <form action={saveLead} className="form lead-form">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="return" value={returnTo} />
          {err && <div className="alert bad">{err}</div>}
          <div className="grid-2">
            <div className="field">
              <label htmlFor={`lead-name-${kind}`}>Navn *</label>
              <input id={`lead-name-${kind}`} name="name" type="text" autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor={`lead-company-${kind}`}>{kind === 'butik' ? 'Butikkens navn' : 'Virksomhed'}</label>
              <input id={`lead-company-${kind}`} name="company" type="text" autoComplete="organization" />
            </div>
            <div className="field">
              <label htmlFor={`lead-email-${kind}`}>E-mail *</label>
              <input id={`lead-email-${kind}`} name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor={`lead-phone-${kind}`}>Telefon</label>
              <input id={`lead-phone-${kind}`} name="phone" type="tel" autoComplete="tel" />
            </div>
            {kind === 'virksomhed' ? (
              <div className="field">
                <label htmlFor="lead-employees">Ca. antal medarbejdere</label>
                <input id="lead-employees" name="employees" type="number" min={1} inputMode="numeric" />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="lead-town">By</label>
                <input id="lead-town" name="town" type="text" />
              </div>
            )}
          </div>
          <label className="check small">
            <input type="checkbox" name="consent" value="ja" />
            <span>{CONSENT_TEXT}</span>
          </label>
          <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor={`lead-web-${kind}`}>Lad feltet være tomt</label>
            <input id={`lead-web-${kind}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="row between">
            <button className="btn" type="submit">
              {kind === 'butik' ? 'Ja, kontakt mig' : 'Kontakt mig'}
            </button>
            <span className="hint">
              Vi bruger oplysningerne til at kontakte dig – og kun til nyheder, hvis du siger ja. <Link href="/privatliv">Privatliv</Link>
            </span>
          </div>
        </form>
      )}
    </section>
  );
}
