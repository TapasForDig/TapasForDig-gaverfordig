import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { currentUser } from '@/lib/auth';
import { dato, datoTid, kr } from '@/lib/format';
import { deliveryAddressText, getPurchase, weekLabel } from '@/lib/purchase';
import { ClearCart } from './ClearCart';

export const metadata: Metadata = { title: 'Tak for bestillingen – Gaver For Dig', robots: { index: false, follow: false } };


export default async function Thanks({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ login?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [p, me] = await Promise.all([getPurchase(Number(id)), currentUser()]);
  const mine = !!p && !!me && (me.role === 'admin' || me.company_id === p.company_id);
  return (
    <>
      <PublicHeader />
      <ClearCart />
      <main className="wrap stack" style={{ maxWidth: 860 }}>
        <div className="stack-s">
          <span className="big-icon" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
            <Icon name="check" size={30} />
          </span>
          <h1>Tak for jeres bestilling</h1>
          <p className="muted" style={{ fontSize: 17 }}>
            Ordrebekræftelsen er sendt på mail{mine && p ? ` til ${p.contact_email}` : ''}.
            {mine && p?.codes_delivery === 'email' && ' Gavekoderne kommer i en separat mail om et øjeblik.'}
          </p>
        </div>
        {mine && p && (
          <>
            <div className="card stack-s">
              <div className="row between">
                <h2>Ordre {p.id}</h2>
                <b>{kr(p.total_inc)} inkl. moms</b>
              </div>
              <dl className="sum" style={{ fontSize: 15 }}>
                <dt>Gaver</dt>
                <dd>{p.quantity} stk.</dd>
                <dt>Medarbejderne vælger senest</dt>
                <dd>{datoTid(p.choose_deadline)}</dd>
                <dt>Levering</dt>
                <dd>
                  {weekLabel(p.delivery_week)}, senest {dato(p.delivery_date)}
                </dd>
                <dt>Leveres til</dt>
                <dd>{deliveryAddressText(p)}</dd>
                <dt>Indpakning</dt>
                <dd>{p.wrapping ? 'Gaveindpakning' : 'Mulepose'}</dd>
                <dt>Betaling</dt>
                <dd>{p.payment === 'ean' ? `EAN ${p.ean}` : 'Faktura'}</dd>
              </dl>
            </div>
            <div className="dark-card stack-s">
              <h2>Næste skridt</h2>
              {p.codes_delivery === 'email' ? (
                <p className="muted">Del én gavekode med hver medarbejder. I kan også printe dem eller hente dem som en fil i jeres oversigt.</p>
              ) : (
                <p className="muted">Har I ikke allerede sendt jeres medarbejderliste, så upload den i oversigten. Så sender vi hver medarbejder sin gavekode.</p>
              )}
              <div>
                <Link className="btn light" href={`/virksomhed/bestilling/${p.id}`}>
                  Gå til oversigten
                </Link>
              </div>
              <p className="small muted">Vi har sendt jer et link på mail, hvor I vælger en adgangskode, så I kan logge ind igen senere.</p>
            </div>
          </>
        )}
        {!mine && (
          <div className="card stack-s">
            <p>Bestillingen er modtaget. Log ind for at se gavekoder og følge med i, hvem der har valgt gave.</p>
            <div>
              <Link className="btn" href="/login">
                Log ind
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
