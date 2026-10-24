import Link from 'next/link';
import { TOWNS, townSlug } from '@/lib/towns';

export function SiteFooter() {
  return (
    <footer className="site-footer no-print">
      <div className="footer-inner">
        <span>Gaver For Dig · Vinfordig ApS · CVR 35854258 · Merkurvej 1A, 6650 Brørup</span>
        <nav aria-label="Om siden">
          <Link href="/kontakt">Kontakt</Link>
          <Link href="/handelsbetingelser">Handelsbetingelser</Link>
          <Link href="/privatliv">Privatlivspolitik</Link>
          <Link href="/databehandleraftale">Databehandleraftale</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/butikker">Butikkerne</Link>
        </nav>
      </div>
      <nav className="footer-towns" aria-label="Firmajulegaver i byerne">
        <span>Firmajulegaver i</span>
        {TOWNS.map((t) => (
          <Link key={t} href={`/firmajulegaver/${townSlug(t)}`}>
            {t}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
