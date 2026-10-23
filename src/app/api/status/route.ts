import { one } from '@/lib/db';

// Fejlsøgning af opsætningen. Viser kun ja/nej – aldrig værdier eller nøgler.
export async function GET() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  let db = false;
  let adminExists = false;
  let admins = 0;
  let error: string | null = null;
  try {
    admins = (await one<{ n: number }>(`select count(*)::int as n from users where role = 'admin'`))?.n ?? 0;
    db = true;
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
    admin_bruger_findes: adminExists,
    antal_admins: admins,
    supabase_url_sat: !!process.env.SUPABASE_URL,
    supabase_key_sat: !!process.env.SUPABASE_SERVICE_KEY,
    no_demo: process.env.NO_DEMO === '1',
    app_url_sat: !!process.env.APP_URL,
  });
}
