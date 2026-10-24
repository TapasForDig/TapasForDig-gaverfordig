'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Kopiér link' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn small outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {}
      }}
    >
      {done ? 'Kopieret ✓' : label}
    </button>
  );
}
