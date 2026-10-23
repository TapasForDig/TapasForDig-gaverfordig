import { notFound } from 'next/navigation';
import { Badge, Notice, Shell } from '@/components/ui';
import { images, KINDS } from '@/lib/format';
import { categories, getProduct, getSetting, PRODUCT_STATUS } from '@/lib/gifts';
import { shopNav } from '../../nav';
import { myShop } from '../../shop';
import { saveProduct } from './actions';
import ProductForm from './ProductForm';

export default async function ProductGuide({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ butik?: string; m?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { shop, shops } = await myShop(sp.butik);
  const p = id === 'ny' ? undefined : await getProduct(Number(id));
  if (id !== 'ny' && (!p || p.shop_id !== shop.id)) notFound();
  const [cats, phone, mail] = await Promise.all([categories(), getSetting('kontakt_telefon'), getSetting('kontakt_email')]);
  const q0 = shops ? `?butik=${shop.id}` : '';

  return (
    <Shell area={`Butik · ${shop.name}`} nav={shopNav.map((n) => ({ ...n, href: n.href + q0 }))}>
      <div className="stack">
        <div className="row between end">
          <div>
            <div className="eyebrow">{p ? 'Ret produkt' : 'Opret produkt'} · ca. 10 minutter</div>
            <h1>{p?.name ?? 'Nyt produkt'}</h1>
          </div>
          {p && <Badge tone={p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'bad' : 'warn'}>{PRODUCT_STATUS[p.status]}</Badge>}
        </div>
        <Notice msg={sp.m} />
        {p?.status === 'rejected' && p.review_note && <div className="alert bad">Besked fra Gaver For Dig: {p.review_note}</div>}
        {p?.status === 'approved' && <div className="alert warn">Produktet er godkendt. Gemmer du ændringer, skal det godkendes igen.</div>}
        <ProductForm
          action={saveProduct}
          id={id}
          butik={shop.id}
          shopName={shop.name}
          shopTown={shop.town}
          kinds={KINDS}
          groups={cats.map((c) => ({ id: c.id, value: c.value_kr }))}
          backHref={`/butik/produkter${q0}`}
          contact={{ phone: phone || '71 99 75 74', email: mail || 'mail@vinfordig.dk' }}
          product={
            p
              ? {
                  name: p.name,
                  ingredients: p.ingredients,
                  net_content: p.net_content,
                  description: p.description,
                  kind: p.kind,
                  price_category_id: p.price_category_id,
                  normal_price_kr: p.normal_price_kr,
                  stock: p.stock,
                  alcohol: p.alcohol,
                  images: images(p.images),
                  wrap_ok: p.wrap_ok || p.status !== 'draft',
                  shelf_ok: p.shelf_ok || p.status !== 'draft',
                }
              : undefined
          }
        />
      </div>
    </Shell>
  );
}
