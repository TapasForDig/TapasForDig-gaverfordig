// Klaviyo: tilmelder leads med samtykke til de rigtige lister i Vin For Dig-kontoen.
// Kræver KLAVIYO_PRIVATE_KEY i Vercel (Klaviyo → Settings → API keys, med adgang til Profiles, Lists og Subscriptions).
// Uden nøgle gør funktionen ingenting – leads gemmes stadig under Admin → Leads.

export const KLAVIYO_LISTS = {
  virksomhed: process.env.KLAVIYO_LIST_VIRKSOMHEDER || 'WMD3PS', // "Gaver For Dig – Virksomheder"
  butik: process.env.KLAVIYO_LIST_BUTIKKER || 'RWKbzE', // "Gaver For Dig – Butikker"
} as const;

const API = 'https://a.klaviyo.com/api';
const REVISION = '2024-10-15';

export interface KlaviyoLead {
  email: string;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  properties?: Record<string, string | number | boolean | null>;
}

function headers(key: string) {
  return { Authorization: `Klaviyo-API-Key ${key}`, revision: REVISION, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json' };
}

// Danske numre som +45xxxxxxxx (Klaviyo kræver internationalt format)
function e164(phone?: string | null): string | undefined {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 8) return `+45${d}`;
  if (d.length === 10 && d.startsWith('45')) return `+${d}`;
  return undefined;
}

// Returnerer 'ok', 'ingen nøgle' eller en fejltekst – kaster aldrig, så en Klaviyo-fejl ikke stopper formularen
export async function subscribeLead(kind: keyof typeof KLAVIYO_LISTS, lead: KlaviyoLead): Promise<string> {
  const key = process.env.KLAVIYO_PRIVATE_KEY;
  if (!key) return 'ingen nøgle';
  const [first, ...rest] = (lead.name ?? '').trim().split(/\s+/);
  try {
    // 1) Opret eller opdatér profilen med navn, firma og egne felter
    const prof = await fetch(`${API}/profile-import`, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({
        data: {
          type: 'profile',
          attributes: {
            email: lead.email,
            first_name: first || undefined,
            last_name: rest.join(' ') || undefined,
            organization: lead.company || undefined,
            phone_number: e164(lead.phone),
            properties: Object.fromEntries(Object.entries({ kilde: 'gaverfordig.dk', gfd_type: kind, ...(lead.properties ?? {}) }).filter(([, v]) => v != null && v !== '')),
          },
        },
      }),
    });
    if (!prof.ok) return `profil ${prof.status}`;
    // 2) Tilmeld til listen med e-mail-samtykke
    const sub = await fetch(`${API}/profile-subscription-bulk-create-jobs`, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({
        data: {
          type: 'profile-subscription-bulk-create-job',
          attributes: {
            profiles: { data: [{ type: 'profile', attributes: { email: lead.email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } }] },
            historical_import: false,
          },
          relationships: { list: { data: { type: 'list', id: KLAVIYO_LISTS[kind] } } },
        },
      }),
    });
    return sub.ok ? 'ok' : `tilmelding ${sub.status}`;
  } catch {
    return 'netværksfejl';
  }
}

export const CONSENT_TEXT = 'Ja tak, Gaver For Dig må sende mig nyheder, gaveidéer og tilbud på e-mail. Jeg kan altid afmelde mig igen.';
