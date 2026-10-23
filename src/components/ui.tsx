import Link from 'next/link';
import { images } from '@/lib/format';

export function TopBar() {
  return <div className="topbar">Lokale gaver · Pakket og leveret samlet · Fra butikker i Vejen Kommune</div>;
}

// Header til de offentlige sider (forside, skatteregler)
export function PublicHeader({ active }: { active?: string }) {
  const links = [
    { href: '/#saadan', label: 'Sådan virker det' },
    { href: '/skatteregler', label: 'Skatteregler' },
    { href: '/virksomhed/opret', label: 'For virksomheder' },
    { href: '/butik/tilmeld', label: 'For butikker' },
    { href: '/login', label: 'Log ind' },
  ];
  return (
    <>
      <TopBar />
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <img className="logo-img" src="/logo-white.png" alt="Gaver For Dig" width={162} height={24} />
          </Link>
          <nav className="nav" aria-label="Hovedmenu">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={active === l.href ? 'on' : ''}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}

export function Shell({
  area,
  nav,
  active,
  children,
  showLogout = true,
}: {
  area?: string;
  nav?: { href: string; label: string }[];
  active?: string;
  children: React.ReactNode;
  showLogout?: boolean;
}) {
  return (
    <>
      <TopBar />
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <img className="logo-img" src="/logo-white.png" alt="Gaver For Dig" width={162} height={24} />
            {area && <span>{area}</span>}
          </Link>
          <nav className="nav" aria-label="Hovedmenu">
            {nav?.map((n) => (
              <Link key={n.href} href={n.href} className={active === n.href ? 'on' : ''}>
                {n.label}
              </Link>
            ))}
            {showLogout && (
              <form action="/logout" method="post">
                <button type="submit">Log ud</button>
              </form>
            )}
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'bad' | 'wine'; children: React.ReactNode }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'ok' | 'bad' }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

export function ProductImage({ json, alt, label }: { json: string; alt: string; label?: React.ReactNode }) {
  const src = images(json)[0];
  return (
    <div className="img">
      {src ? <img src={src} alt={alt} /> : <span>Intet billede endnu</span>}
      {label}
    </div>
  );
}

export function Thumb({ json, alt }: { json: string; alt: string }) {
  const src = images(json)[0];
  return src ? <img className="thumb" src={src} alt={alt} /> : <div className="thumb" aria-hidden="true" />;
}

export function Progress({ pct, label }: { pct: number; label: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="progress" role="img" aria-label={label}>
      <div style={{ width: `${p}%` }} />
    </div>
  );
}

export function Notice({ msg }: { msg?: string | string[] }) {
  const m = Array.isArray(msg) ? msg[0] : msg;
  if (!m) return null;
  const bad = m.startsWith('!');
  return <div className={`alert ${bad ? 'bad' : ''}`}>{bad ? m.slice(1) : m}</div>;
}
