import { appUrl } from './format';
import { TOWNS } from './towns';

export const SITE_NAME = 'Gaver For Dig';

// Virksomheden bag siden – bruges i strukturerede data på forsiden og bysiderne
export function organization() {
  const url = appUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${url}/#organization`,
    name: SITE_NAME,
    legalName: 'Vinfordig ApS',
    url,
    logo: `${url}/logo.png`,
    email: 'info@gaverfordig.dk',
    telephone: '+4571997574',
    vatID: 'DK35854258',
    address: { '@type': 'PostalAddress', streetAddress: 'Merkurvej 1A', postalCode: '6650', addressLocality: 'Brørup', addressCountry: 'DK' },
    areaServed: { '@type': 'AdministrativeArea', name: 'Vejen Kommune' },
  };
}

export function website() {
  const url = appUrl();
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${url}/#website`, name: SITE_NAME, url, inLanguage: 'da-DK', publisher: { '@id': `${url}/#organization` } };
}

export function service(town?: string) {
  const url = appUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: town ? `Firmajulegaver i ${town}` : 'Lokale firmajulegaver',
    serviceType: 'Firmagaver til medarbejdere',
    description: 'Virksomheden vælger gavebeløb, og hver medarbejder vælger selv sin julegave fra lokale butikker i Vejen Kommune. Gaverne pakkes med navn og leveres samlet.',
    provider: { '@id': `${url}/#organization` },
    areaServed: town ? { '@type': 'City', name: town } : TOWNS.map((t) => ({ '@type': 'City', name: t })),
    url: town ? undefined : `${url}/saadan-virker-det`,
  };
}

export function breadcrumbs(items: [string, string][]) {
  const url = appUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${url}${path}` })),
  };
}

export function faq(items: [string, string][]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}
