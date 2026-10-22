import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const UPLOAD_DIR = path.join(process.cwd(), '.data', 'uploads');

// Gemmer et produktbillede og returnerer dets URL.
// Lokalt: i .data/uploads. Med SUPABASE_URL + SUPABASE_SERVICE_KEY: i Supabase Storage (bucket "produkter").
export async function saveImage(file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error('Kun JPG, PNG eller WEBP');
  if (file.size > 8 * 1024 * 1024) throw new Error('Billedet er større end 8 MB');
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    const res = await fetch(`${url}/storage/v1/object/produkter/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': file.type },
      body: buf,
    });
    if (!res.ok) throw new Error('Billedet kunne ikke gemmes');
    return `${url}/storage/v1/object/public/produkter/${name}`;
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/api/files/${name}`;
}
