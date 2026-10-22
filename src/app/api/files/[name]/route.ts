import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from '@/lib/storage';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name)) return new Response('Ikke fundet', { status: 404 });
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return new Response('Ikke fundet', { status: 404 });
  const ext = name.split('.').pop() as string;
  return new Response(fs.readFileSync(file), {
    headers: { 'Content-Type': TYPES[ext], 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
