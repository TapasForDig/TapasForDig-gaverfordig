import { redirect } from 'next/navigation';
import { Notice, ProductImage, Shell } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { logEvent, one, q } from '@/lib/db';
import { appUrl, images, int, kr, str } from '@/lib/format';
import { categories, getProduct, productsByStatus } from '@/lib/gifts';
import { sendMail } from '@/lib/mail';
import { adminNav } from '../nav';
import { FoodInfo } from '@/components/FoodInfo';

async function decideShop(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const id = Number(fd.get('shop'));
  const ok = fd.get('decision') === 'approve';
  const s = await one<{ name: string; email: string | null }>(`update shops set status = $1 where id = $2 returning name, email`, [ok ? 'approved' : 'rejected', id]);
  await logEvent(u.email, 'shop', id, ok ? 'godkendt' : 'afvist', s?.name);
  if (s?.email) {
    await sendMail(
      s.email,
      ok ? 'Din butik er godkendt' : 'Om din tilmelding',
      ok
        ? `Hej ${s.name}\n\nVelkommen hos Gaver For Dig! Din butik er godkendt. Dine godkendte produkter er nu synlige for medarbejderne.\n\n${appUrl()}/butik/produkter`
        : `Hej ${s.name}\n\nVi kan desværre ikke godkende din butik lige nu. ${str(fd, 'note')}\n\nVenlig hilsen\nGaver For Dig`,
    );
  }
  redirect('/admin/godkend?m=' + encodeURIComponent(ok ? `${s?.name} er godkendt` : `${s?.name} er afvist`));
}

async function decideProduct(fd: FormData) {
  'use server';
  const u = await requireRole('admin');
  const p = await getProduct(Number(fd.get('product')));
  if (!p) redirect('/admin/godkend');
  const ok = fd.get('decision') === 'approve';
  const note = str(fd, 'note');
  if (!ok && !note) redirect('/admin/godkend?m=' + encodeURIComponent('!Skriv hvad butikken skal rette'));
  await q(`update products set status = $1, review_note = $2, cost_kr = coalesce($3, cost_kr), updated_at = now() where id = $4`, [
    ok ? 'approved' : 'rejected',
    ok ? null : note,
    int(fd, 'cost'),
    p.id,
  ]);
  await logEvent(u.email, 'product', p.id, ok ? 'godkendt' : 'sendt retur', note || p.name);
  const shop = await one<{ email: string | null }>('select email from shops where id = $1', [p.shop_id]);
  if (shop?.email) {
    await sendMail(
      shop.email,
      ok ? `Godkendt: ${p.name}` : `Ret venligst: ${p.name}`,
      ok ? `Dit produkt "${p.name}" er godkendt og kan nu vælges.` : `Dit produkt "${p.name}" skal rettes, før det kan godkendes:\n\n${note}\n\nRet det her: ${appUrl()}/butik/produkt/${p.id}`,
    );
  }
  redirect('/admin/godkend?m=' + encodeURIComponent(ok ? `${p.name} er godkendt` : `${p.name} er sendt retur til butikken`));
}

export default async function Approve({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const shops = await q<{ id: number; name: string; cvr: string | null; town: string | null; contact_name: string | null; email: string | null; story: string | null }>(
    `select * from shops where status = 'pending' order by created_at`,
  );
  const [products, cats] = await Promise.all([productsByStatus('pending'), categories()]);
  return (
    <Shell area="Admin" nav={adminNav} active="/admin/godkend">
      <div className="stack">
        <h1>Godkend</h1>
        <Notice msg={sp.m} />
        <section className="stack-s">
          <h2>Butikker ({shops.length})</h2>
          {shops.length === 0 && <p className="muted small">Ingen butikker venter.</p>}
          {shops.map((s) => (
            <form key={s.id} action={decideShop} className="card row between">
              <input type="hidden" name="shop" value={s.id} />
              <div style={{ flex: '1 1 300px' }}>
                <b>{s.name}</b> · {s.town} · CVR {s.cvr || '–'}
                <div className="small muted">
                  {s.contact_name} · {s.email}
                </div>
                {s.story && <p className="small">{s.story}</p>}
              </div>
              <input type="text" name="note" placeholder="Begrundelse ved afvisning" aria-label="Begrundelse" style={{ width: 240 }} />
              <button className="btn small" name="decision" value="approve">
                Godkend
              </button>
              <button className="btn small danger" name="decision" value="reject">
                Afvis
              </button>
            </form>
          ))}
        </section>
        <section className="stack-s">
          <h2>Produkter ({products.length})</h2>
          {products.length === 0 && <p className="muted small">Ingen produkter venter.</p>}
          <div className="products">
            {products.map((p) => {
              const cat = cats.find((c) => c.id === p.price_category_id);
              const imgs = images(p.images);
              return (
                <form key={p.id} action={decideProduct} className="product">
                  <input type="hidden" name="product" value={p.id} />
                  <ProductImage json={p.images} alt={p.name} />
                  <div className="body" style={{ textAlign: 'left' }}>
                    <div className="eyebrow">{p.shop_name}</div>
                    <h3>{p.name}</h3>
                    <p className="desc">{p.description}</p>
                    {p.kind === 'Mad og drikke' &&
                      (p.ingredients ? (
                        <FoodInfo ingredients={p.ingredients} netContent={p.net_content} contact={{ phone: '–', email: '–' }} />
                      ) : (
                        <div className="alert bad small">Mangler ingredienser og allergener</div>
                      ))}
                    <div className="small">
                      {p.kind} · {cat ? `${cat.name} (${kr(cat.value_kr)})` : 'ingen kategori'} · normalpris {kr(p.normal_price_kr)} · lager {p.stock}
                      {p.alcohol ? ' · alkohol' : ''} · {imgs.length} billeder
                    </div>
                    <div className="field">
                      <label htmlFor={`cost-${p.id}`} className="small">
                        Indkøbspris til butikken (kr., valgfri)
                      </label>
                      <input id={`cost-${p.id}`} name="cost" type="number" min={0} defaultValue={p.cost_kr ?? ''} />
                    </div>
                    <textarea name="note" placeholder="Hvad skal rettes? (ved afvisning)" aria-label="Besked til butikken" style={{ minHeight: 70 }} />
                    <div className="row">
                      <button className="btn small" name="decision" value="approve">
                        Godkend
                      </button>
                      <button className="btn small danger" name="decision" value="reject">
                        Send retur
                      </button>
                    </div>
                  </div>
                </form>
              );
            })}
          </div>
        </section>
      </div>
    </Shell>
  );
}
