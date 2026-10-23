import { currentUser } from '@/lib/auth';
import { one, q } from '@/lib/db';

// Fejlsøgning af opsætningen. Kun for admin (eller med CRON_SECRET). Viser kun ja/nej – aldrig værdier eller nøgler.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const byKey = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
  if (!byKey && (await currentUser())?.role !== 'admin') return new Response('Ikke fundet', { status: 404 });
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  let db = false;
  let adminExists = false;
  let admins = 0;
  let error: string | null = null;
  let produkter: Record<string, number> = {};
  let billeder_lokale = 0;
  try {
    admins = (await one<{ n: number }>(`select count(*)::int as n from users where role = 'admin'`))?.n ?? 0;
    db = true;
    const rows = await q<{ status: string; n: number }>('select status, count(*)::int as n from products group by status');
    produkter = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    billeder_lokale = (await one<{ n: number }>(`select count(*)::int as n from products where images like '%/api/files/%'`))?.n ?? 0;
    if (email) adminExists = !!(await one('select 1 from users where email = $1', [email]));
  } catch (e) {
    error = (e as Error).message.slice(0, 120);
  }
  return Response.json({
    database_url_sat: !!process.env.DATABASE_URL,
    database_forbundet: db,
    database_fejl: error,
    admin_email_sat: !!email,
    admin_password_sat: !!process.env.ADMIN_PASSWORD?.trim(),
    // Maskeret, så man kan se om det er den forventede mail: ma***@vinfordig.dk
    admin_email_maskeret: email ? email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : null,
    admin_email_ligner_skabelon: !!email && /[\[\]"' ]/.test(email),
    admin_password_ligner_skabelon: /[\[\]]|adgangskode/i.test(process.env.ADMIN_PASSWORD ?? ''),
    admin_password_har_anfoerselstegn: /^["'].*["']$/.test(process.env.ADMIN_PASSWORD?.trim() ?? ''),
    admin_bruger_findes: adminExists,
    antal_admins: admins,
    supabase_url_sat: !!process.env.SUPABASE_URL,
    supabase_key_sat: !!process.env.SUPABASE_SERVICE_KEY,
    no_demo: process.env.NO_DEMO === '1',
    app_url_sat: !!process.env.APP_URL,
    produkter_pr_status: produkter,
    produkter_med_lokale_billeder: billeder_lokale,
  });
}
