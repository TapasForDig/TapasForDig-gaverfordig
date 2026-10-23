'use client';

import { useRef, useState } from 'react';

// Ét billede: gøres mindre i browseren (så upload holder sig under Vercels grænse) og vises som forhåndsvisning
export function ImageUpload({ name, current, maxSide = 2000, aspect = '16 / 10', label }: { name: string; current?: string | null; maxSide?: number; aspect?: string; label: string }) {
  const field = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [info, setInfo] = useState('');

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setInfo('Gør billedet klar …');
    try {
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale);
      const h = Math.round(bmp.height * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error())), 'image/jpeg', 0.86));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'billede.jpg', { type: 'image/jpeg' }));
      if (field.current) field.current.files = dt.files;
      setPreview(URL.createObjectURL(blob));
      setInfo(`${bmp.width} × ${bmp.height} px → gemmes som ${w} × ${h} px`);
    } catch {
      setInfo('Billedet kunne ikke læses. Prøv at gemme det som JPG.');
    }
  };

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="upload-frame" style={{ aspectRatio: aspect }}>
        {preview ? <img src={preview} alt="" /> : <span className="muted small">Intet billede</span>}
      </div>
      <input ref={field} type="file" name={name} hidden tabIndex={-1} aria-hidden="true" />
      <label className="btn outline small" style={{ alignSelf: 'flex-start' }}>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        {preview ? 'Skift billede' : 'Vælg billede'}
      </label>
      {info && <span className="hint">{info}</span>}
    </div>
  );
}
