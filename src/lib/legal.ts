import { getSetting } from './gifts';

// Bytteret i butikken (gælder alle gaver, se handelsbetingelser og samarbejdsvilkår)
export const BYTTEFRIST = '31. januar';
export const LEGAL_UPDATED = '24. oktober 2026';

export async function contact() {
  const [email, phone] = await Promise.all([getSetting('kontakt_email'), getSetting('kontakt_telefon')]);
  return { email: email || 'info@gaverfordig.dk', phone: phone || '71 99 75 74' };
}
