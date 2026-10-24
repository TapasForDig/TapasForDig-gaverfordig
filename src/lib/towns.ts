// Byerne i Vejen Kommune, som vi viser på forsiden og har egne sider for (/firmajulegaver/brorup osv.)
export const TOWNS = ['Brørup', 'Vejen', 'Rødding', 'Holsted', 'Askov', 'Lintrup', 'Gesten', 'Jels', 'Skodborg', 'Bække', 'Hovborg', 'Føvling', 'Lindknud', 'Glejbjerg', 'Andst', 'Malt'];

export function townSlug(t: string) {
  return t.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Accepterer også fx /brorup og /rodding (ø/å skrevet som o/a)
export function townFromSlug(slug: string): string | undefined {
  const loose = (t: string) => t.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-');
  return TOWNS.find((t) => townSlug(t) === slug || loose(t) === slug);
}
