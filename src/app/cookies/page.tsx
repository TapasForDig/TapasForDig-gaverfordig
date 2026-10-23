import type { Metadata } from 'next';
import { LegalPage, type Section } from '@/components/LegalPage';
import { contact, LEGAL_UPDATED } from '@/lib/legal';

export const metadata: Metadata = { title: 'Cookiepolitik – Gaver For Dig' };

export default async function Cookies() {
  const c = await contact();
  const sections: Section[] = [
    [
      'Kort fortalt',
      [
        'Gaver For Dig bruger kun de cookies, der er nødvendige for, at siden virker – fx for at holde dig logget ind. Vi bruger ingen cookies til statistik, annoncer eller sporing, og vi deler ikke data med Google, Facebook eller andre annoncenetværk.',
        'Nødvendige cookies kræver ikke samtykke efter cookiebekendtgørelsen, og derfor viser vi ikke et cookiebanner.',
      ],
    ],
    [
      'Cookies og lagring på siden',
      [
        {
          table: [
            ['Navn', 'Type', 'Formål', 'Varighed'],
            ['gfd_s', 'Nødvendig cookie', 'Holder dig logget ind som butik, virksomhed eller administrator', '30 dage, eller til du logger ud'],
            ['gfd_r', 'Nødvendig cookie', 'Husker din gavekode, så du kan vælge og ændre din gave', '90 dage'],
            ['gfd-bestilling-v1', 'Lokal lagring i din browser', 'Husker indholdet af din bestilling, mens du bestiller. Sendes ikke til os', 'Til bestillingen er gennemført, eller du sletter den'],
          ],
        },
        'Cookierne indeholder kun en tilfældig nøgle – ingen navne, e-mails eller andre oplysninger om dig.',
      ],
    ],
    [
      'Tredjeparter',
      [
        'Siden driftes af Vercel (servere i Frankfurt), og skrifttypen hentes fra vores egen server. Hvis du trykker "Hent oplysninger" ved CVR-nummeret, slår vi virksomheden op hos cvrapi.dk – det sætter ingen cookies hos dig.',
      ],
    ],
    [
      'Sådan sletter eller blokerer du cookies',
      [
        'Du kan altid slette cookies i din browsers indstillinger. Blokerer du de nødvendige cookies, kan du ikke logge ind eller vælge en gave.',
        `Spørgsmål? Skriv til ${c.email}. Læs også vores privatlivspolitik på gaverfordig.dk/privatliv.`,
      ],
    ],
  ];
  return <LegalPage title="Cookiepolitik" lead="Hvilke cookies gaverfordig.dk bruger, og hvorfor." sections={sections} updated={LEGAL_UPDATED} />;
}
