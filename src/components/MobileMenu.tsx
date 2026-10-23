'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Fold-ud-menu på mobil. Lukker af sig selv, når man skifter side.
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  return (
    <details ref={ref} className="nav-mobile">
      <summary aria-label="Åbn menu">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span>Menu</span>
      </summary>
      <nav className="nav-mobile-list" aria-label="Menu">
        {children}
      </nav>
    </details>
  );
}
