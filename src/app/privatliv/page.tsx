import type { Metadata } from 'next';
import { LegalPage, type Section } from '@/components/LegalPage';
import { contact, LEGAL_UPDATED } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privatlivspolitik – Gaver For Dig' };

export default async function Privacy() {
  const c = await contact();
  const sections: Section[] = [
    ['Hvem er dataansvarlig', [`Gaver For Dig drives af Vinfordig ApS, CVR 35854258, Merkurvej 1A, 6650 Brørup. Har du spørgsmål om dine oplysninger, kan du skrive til ${c.email} eller ringe på ${c.phone}.`]],
    [
      'Hvilke oplysninger vi behandler, og hvorfor',
      [
        {
          table: [
            ['Hvem', 'Oplysninger', 'Formål', 'Retsgrundlag', 'Hvor længe'],
            ['Virksomheder, der bestiller', 'Firmanavn, CVR, EAN, adresse, kontaktpersonens navn, e-mail og telefon', 'Levere ordren, sende gavekoder og fakturere', 'Aftale (art. 6, stk. 1, litra b) og bogføringsloven (litra c)', 'Ordre- og fakturadata i 5 år efter regnskabsårets udløb'],
            ['Butikker', 'Butikkens navn, CVR, adresse, kontaktperson, e-mail, telefon, logo og beskrivelse', 'Samarbejdet om gaverne, afregning og visning på siden med deltagende butikker', 'Aftale (litra b)', 'Så længe samarbejdet varer. Afregninger i 5 år'],
            ['Medarbejdere, der får en julegave', 'Navn, e-mail, gavekode, valgt gave og evt. hjemmeadresse og telefon', 'Lade dig vælge og modtage din gave', 'Vi behandler oplysningerne på din arbejdsgivers vegne', 'Slettes 6 måneder efter levering'],
            ['Besøgende på siden', 'Teknisk nødvendige cookies til login', 'Få siden til at virke', 'Legitim interesse (litra f)', 'Login: 30 dage. Indkøbskurven gemmes kun i din egen browser'],
          ],
        },
        'Vi bruger kun nødvendige cookies og ingen cookies til statistik eller markedsføring. Se cookiepolitikken på gaverfordig.dk/cookies. Begynder vi at bruge andre cookies, beder vi om dit samtykke først.',
      ],
    ],
    [
      'Til dig, der har fået en julegave',
      [
        'Din arbejdsgiver har givet os dit navn og evt. din e-mail, så du kan vælge en gave. Din arbejdsgiver er dataansvarlig for de oplysninger, og vi er databehandler. Vil du have indsigt eller rettet noget, kan du kontakte din arbejdsgiver eller os.',
        'Vælger du en gave med alkohol, bekræfter du, at du er fyldt 18 år. Vi gemmer ikke din alder.',
      ],
    ],
    [
      'Hvem vi deler oplysninger med',
      [
        {
          list: [
            'Butikkerne får kun antal og type af gaver og virksomhedens navn – aldrig medarbejdernes oplysninger.',
            'Fragtfirmaer får navn, adresse og telefon, når en gave skal sendes hjem.',
            'IT-leverandører, der driver hjemmesiden, databasen og mails. De må kun bruge oplysningerne til at levere deres tjeneste til os.',
            'Myndigheder, hvis loven kræver det.',
          ],
        },
        'Vi sælger aldrig oplysninger videre.',
      ],
    ],
    ['Overførsel uden for EU', ['Nogle af vores IT-leverandører er amerikanske. Data gemmes så vidt muligt i EU, og overførsler sker under EU-USA Data Privacy Framework eller EU-Kommissionens standardkontraktbestemmelser.']],
    [
      'Dine rettigheder',
      [
        `Du har ret til at få indsigt i dine oplysninger og få dem rettet eller slettet. Du kan også gøre indsigelse, få begrænset behandlingen eller få dine data udleveret. Skriv til ${c.email}, så svarer vi inden for en måned.`,
        'Er du utilfreds, kan du klage til Datatilsynet, Carl Jacobsens Vej 35, 2500 Valby, datatilsynet.dk.',
      ],
    ],
  ];
  return (
    <LegalPage
      title="Privatlivspolitik"
      lead="Sådan behandler Gaver For Dig oplysninger om virksomheder, butikker og medarbejdere, der får en julegave."
      sections={sections}
      updated={LEGAL_UPDATED}
    />
  );
}
