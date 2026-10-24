import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImpactReport } from '@/components/ImpactReport';
import { PublicHeader } from '@/components/ui';
import { one } from '@/lib/db';
import { kr } from '@/lib/format';
import { genitiv, purchaseImpact } from '@/lib/impact';

interface Row {
  id: number;
  company_name: string;
  logo: string | null;
  delivery_date: Date;
  choose_deadline: Date;
}

async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  return one<Row>(
    `select p.id, p.company_name, c.logo, p.delivery_date, p.choose_deadline from purchases p join companies c on c.id = p.company_id where p.share_token = $1`,
    [token],
  );
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const p = await load((await params).token);
  if (!p) return { title: 'Gaver For Dig' };
  const i = await purchaseImpact(p.id);
  const title = `${genitiv(p.company_name)} julegaver holdt ${kr(i.value)} i Vejen Kommune`;
  const description = `${i.gifts} julegaver fra ${i.shops.length} lokale butikker – via Gaver For Dig.`;
  return { title, description, openGraph: { title, description, siteName: 'Gaver For Dig', locale: 'da_DK', images: [{ url: '/og.png', width: 1200, height: 630 }] }, robots: { index: false } };
}

export default async function PublicImpact({ params }: { params: Promise<{ token: string }> }) {
  const p = await load((await params).token);
  if (!p) notFound();
  const impact = await purchaseImpact(p.id);
  return (
    <>
      <PublicHeader />
      <main className="wrap stack" style={{ maxWidth: 960 }}>
        <ImpactReport company={p.company_name} logo={p.logo} impact={impact} year={new Date(p.delivery_date).getFullYear()} final={new Date(p.choose_deadline) < new Date()} />
        <section className="card row between" style={{ gap: 16 }}>
          <div className="stack-s" style={{ flex: '1 1 380px' }}>
            <h2 style={{ fontSize: 22 }}>Vil I også give julegaver, der bliver i lokalsamfundet?</h2>
            <p className="muted" style={{ margin: 0 }}>Medarbejderne vælger selv fra lokale butikker. Vi pakker og leverer samlet til jer.</p>
          </div>
          <div className="row">
            <Link className="btn" href="/bestil">
              Bestil julegaver
            </Link>
            <Link className="btn outline" href="/saadan-virker-det">
              Sådan virker det
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
