import { q } from './db';

// Dansk ejefald: "Brørup Træ's" undgås – navne på s, x og z får apostrof
export function genitiv(name: string) {
  return /[sxz]$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}s`;
}

export interface ImpactShop {
  id: number;
  name: string;
  town: string | null;
  logo: string | null;
  gifts: number;
  value: number;
}

export interface ImpactClub {
  name: string;
  town: string | null;
  gifts: number;
  value: number;
}

export interface Impact {
  clubs: ImpactClub[];
  clubValue: number;
  shops: ImpactShop[];
  gifts: number;
  value: number;
  towns: string[];
  total: number;
}

// Hvor jeres julegaver er handlet – kun samlede tal pr. butik, aldrig hvem der har valgt hvad
export async function purchaseImpact(purchaseId: number): Promise<Impact> {
  const shops = await q<ImpactShop>(
    `select s.id, s.name, s.town, s.logo, count(*)::int as gifts, sum(pc.value_kr)::int as value
       from recipients r join gift_orders o on o.id = r.order_id join price_categories pc on pc.id = o.price_category_id
       join products p on p.id = r.chosen_product_id join shops s on s.id = p.shop_id
      where o.purchase_id = $1
      group by s.id, s.name, s.town, s.logo order by value desc, s.name`,
    [purchaseId],
  );
  const clubs = await q<ImpactClub>(
    `select min(r.donation_to) as name, min(r.donation_town) as town, count(*)::int as gifts, sum(pc.value_kr)::int as value
       from recipients r join gift_orders o on o.id = r.order_id join price_categories pc on pc.id = o.price_category_id
      where o.purchase_id = $1 and r.donation_to is not null
      group by lower(regexp_replace(trim(r.donation_to), '\\s+', ' ', 'g')) order by value desc`,
    [purchaseId],
  );
  const total = (await q<{ n: number }>(`select count(*)::int as n from recipients r join gift_orders o on o.id = r.order_id where o.purchase_id = $1`, [purchaseId]))[0]?.n ?? 0;
  const towns = [...new Set(shops.map((s) => s.town?.trim()).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, 'da'));
  return {
    clubs,
    clubValue: clubs.reduce((a, c) => a + c.value, 0),
    shops,
    gifts: shops.reduce((a, s) => a + s.gifts, 0) + clubs.reduce((a, c) => a + c.gifts, 0),
    value: shops.reduce((a, s) => a + s.value, 0) + clubs.reduce((a, c) => a + c.value, 0),
    towns,
    total,
  };
}
