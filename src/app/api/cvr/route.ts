import { clientIp, tooMany } from '@/lib/ratelimit';
// Slår firmaoplysninger op i CVR via cvrapi.dk (gratis, begrænset antal opslag pr. dag)

export async function GET(req: Request) {
  if (await tooMany(`cvr:${await clientIp()}`, 30, 3600)) return Response.json({ error: 'For mange opslag' }, { status: 429 });
  const cvr = (new URL(req.url).searchParams.get('cvr') ?? '').replace(/\D/g, '');
  if (cvr.length !== 8) return Response.json({ error: 'CVR skal være 8 cifre' }, { status: 400 });
  try {
    const res = await fetch(`https://cvrapi.dk/api?search=${cvr}&country=dk`, {
      headers: { 'User-Agent': 'gaverfordig.dk - firmagaver - info@gaverfordig.dk' },
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok || data.error) return Response.json({ error: 'CVR-nummeret blev ikke fundet' }, { status: 404 });
    return Response.json({
      name: data.name ?? '',
      address: data.address ?? '',
      zip: data.zipcode ?? '',
      city: data.city ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
    });
  } catch {
    return Response.json({ error: 'Opslaget virker ikke lige nu – udfyld felterne selv' }, { status: 502 });
  }
}
