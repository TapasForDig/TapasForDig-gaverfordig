import type { Metadata } from 'next';
import { PublicHeader } from '@/components/ui';
import { currentUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { images } from '@/lib/format';
import { categories, getSetting } from '@/lib/gifts';
import { deliveryWeeks, shopSettings } from '@/lib/purchase';
import { placeOrder } from './actions';
import OrderFlow, { type GroupView } from './OrderFlow';

export const metadata: Metadata = {
  title: 'Bestil julegavekort – Gaver For Dig',
  description: 'Vælg gavebeløb, antal medarbejdere og leveringsuge. Medarbejderne vælger selv deres gave fra lokale butikker.',
};

interface P {
  id: number;
  name: string;
  description: string;
  images: string;
  price_category_id: number;
  kind: string;
  ingredients: string | null;
  net_content: string | null;
  shop_name: string;
  shop_town: string | null;
}

export default async function OrderPage() {
  const [groups, s, phone, mail, me] = await Promise.all([
    categories(),
    shopSettings(),
    getSetting('kontakt_telefon'),
    getSetting('kontakt_email'),
    currentUser(),
  ]);
  const products = await q<P>(
    `select p.id, p.name, p.description, p.images, p.price_category_id, p.kind, p.ingredients, p.net_content, s.name as shop_name, s.town as shop_town
       from products p join shops s on s.id = p.shop_id
      where p.status = 'approved' and s.status = 'approved'
        and p.stock > (select count(*) from recipients r where r.chosen_product_id = p.id)
      order by s.name, p.name`,
  );
  const view: GroupView[] = groups.map((g) => {
    const ps = products.filter((p) => p.price_category_id === g.id);
    return {
      id: g.id,
      value: g.value_kr,
      note: g.note,
      products: ps.map((p) => ({ id: p.id, name: p.name, shop: p.shop_name, town: p.shop_town, desc: p.description, img: images(p.images)[0] ?? null, food: p.kind === 'Mad og drikke', ingredients: p.ingredients, net: p.net_content })),
    };
  });

  // Udfyld kendte oplysninger, hvis virksomheden er logget ind
  let defaults: Record<string, string> = {};
  if (me?.role === 'virksomhed' && me.company_id) {
    const last = await one<Record<string, string | null>>(`select * from purchases where company_id = $1 order by id desc limit 1`, [me.company_id]);
    if (last) {
      for (const k of ['cvr', 'company_name', 'billing_address', 'billing_zip', 'billing_city', 'billing_email', 'po_number', 'ean', 'contact_first', 'contact_last', 'contact_email', 'contact_phone']) {
        if (last[k]) defaults[k] = String(last[k]);
      }
      defaults.billing_email2 = defaults.billing_email ?? '';
      defaults.contact_email2 = defaults.contact_email ?? '';
    } else {
      defaults = { contact_email: me.email, contact_email2: me.email };
    }
  }

  return (
    <>
      <PublicHeader active="/bestil" />
      <OrderFlow
        groups={view}
        weeks={deliveryWeeks(s)}
        settings={{ homeFee: s.homeFee, wrapFee: s.wrapFee, minQty: s.minQty }}
        contact={{ phone: phone || '71 99 75 74', email: mail || 'mail@vinfordig.dk' }}
        defaults={defaults}
        action={placeOrder}
      />
    </>
  );
}
