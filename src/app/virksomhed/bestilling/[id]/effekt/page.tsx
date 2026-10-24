import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CopyButton } from '@/components/CopyButton';
import { ImpactReport } from '@/components/ImpactReport';
import { PrintButton } from '@/components/PrintButton';
import { Shell } from '@/components/ui';
import { newToken } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { appUrl } from '@/lib/format';
import { purchaseImpact } from '@/lib/impact';
import { companyNav } from '../../../nav';
import { ownPurchase } from '../../access';

async function share(fd: FormData) {
  'use server';
  const { u, p } = await ownPurchase(Number(fd.get('id')));
  if (fd.get('stop') === '1') {
    await q('update purchases set share_token = null where id = $1', [p.id]);
    redirect(`/virksomhed/bestilling/${p.id}/effekt`);
  }
  if (!p.share_token) {
    await q('update purchases set share_token = $1 where id = $2 and share_token is null', [newToken(12), p.id]);
    await logEvent(u.email, 'purchase', p.id, 'effektrapport delt');
  }
  redirect(`/virksomhed/bestilling/${p.id}/effekt`);
}

export default async function ImpactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { p } = await ownPurchase(Number(id));
  const [impact, company] = await Promise.all([purchaseImpact(p.id), one<{ logo: string | null }>('select logo from companies where id = $1', [p.company_id])]);
  const url = p.share_token ? `${appUrl()}/effekt/${p.share_token}` : null;
  const final = new Date(p.choose_deadline) < new Date();
  return (
    <Shell area={p.company_name} nav={companyNav}>
      <div className="stack">
        <div className="row between no-print">
          <Link href={`/virksomhed/bestilling/${p.id}`}>← Tilbage til bestillingen</Link>
          <PrintButton label="Print / gem som PDF" />
        </div>
        {impact.gifts === 0 ? (
          <div className="card">Rapporten bliver klar, så snart de første medarbejdere har valgt deres gave.</div>
        ) : (
          <ImpactReport company={p.company_name} logo={company?.logo ?? null} impact={impact} year={new Date(p.delivery_date).getFullYear()} final={final} />
        )}
        {impact.gifts > 0 && (
          <div className="card stack-s no-print">
            <h2>Del jeres lokale effekt</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Rapporten viser kun samlede tal pr. butik – aldrig hvilke medarbejdere, der har valgt hvad. Del den på intranettet, i nyhedsbrevet eller på LinkedIn.
            </p>
            {url ? (
              <>
                <div className="share-url">{url}</div>
                <div className="row">
                  <CopyButton text={url} />
                  <a className="btn small" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                    Del på LinkedIn
                  </a>
                  <a className="btn small outline" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                    Del på Facebook
                  </a>
                  <form action={share}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn small outline" name="stop" value="1">
                      Stop deling
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <form action={share}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn">Lav et link, vi kan dele</button>
              </form>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
