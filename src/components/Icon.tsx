// Enkle stregikoner (24×24), arver tekstfarven
const PATHS: Record<string, string> = {
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  gift: 'M3 9h18v4H3z M5 13v8h14v-8 M12 9v12 M12 9c-2-4-6-4-6-1.5S9 9 12 9c3 0 6-.5 6-1.5S14 5 12 9',
  calendar: 'M4 5h16v15H4z M4 10h16 M8 3v4 M16 3v4',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h4',
  pin: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  building: 'M4 21V4h10v17 M14 9h6v12 M2 21h20 M7 8h4 M7 12h4 M7 16h4 M17 13h0 M17 17h0',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6',
  bag: 'M5 8h14l-1 13H6z M9 8V6a3 3 0 0 1 6 0v2',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14.5c2 .6 3.3 2.5 3.5 5.5',
  truck: 'M2 6h12v10H2z M14 10h4l3 3v3h-7 M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  bank: 'M3 10l9-6 9 6 M4 10h16 M6 10v8 M10 10v8 M14 10v8 M18 10v8 M3 20h18',
  check: 'M5 12l5 5 9-10',
};

export function Icon({ name, size = 22, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {(PATHS[name] ?? '').split(' M').map((d, i) => (
        <path key={i} d={i === 0 ? d : 'M' + d} />
      ))}
    </svg>
  );
}
