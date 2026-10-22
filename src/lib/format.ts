export const KINDS = ['Mad og drikke', 'Bolig', 'Mode', 'Velvære', 'Oplevelser'] as const;

export function kr(n: number | null | undefined): string {
  if (n == null) return '–';
  return `${n.toLocaleString('da-DK')} kr.`;
}

export function dato(d: Date | string | null | undefined): string {
  if (!d) return '[ikke sat]';
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Copenhagen' });
}

export function datoTid(d: Date | string | null | undefined): string {
  if (!d) return '[ikke sat]';
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleString('da-DK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Copenhagen',
  });
}

// Til <input type="datetime-local"> i dansk tid
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(x);
  return parts.replace(' ', 'T');
}

// Fra <input type="datetime-local"> (dansk tid) til Date
export function fromLocalInput(v: string | null): Date | null {
  if (!v) return null;
  const [d, t] = v.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = (t ?? '00:00').split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, day, hh, mm));
  // Find Københavns forskydning på det tidspunkt
  const local = new Date(guess.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}

export function daysLeft(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const x = typeof d === 'string' ? new Date(d) : d;
  return Math.ceil((x.getTime() - Date.now()) / 86400000);
}

export function images(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function int(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}
