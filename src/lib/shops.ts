import { q } from './db';

export interface PublicShop {
  id: number;
  name: string;
  town: string | null;
  story: string | null;
  logo: string | null;
  website: string | null;
  gifts: number;
}

// Godkendte butikker, som de vises offentligt
export async function publicShops(): Promise<PublicShop[]> {
  return q<PublicShop>(
    `select s.id, s.name, s.town, s.story, s.logo, s.website,
            (select count(*)::int from products p where p.shop_id = s.id and p.status = 'approved') as gifts
       from shops s where s.status = 'approved'
      order by (s.logo is null), s.name`,
  );
}

