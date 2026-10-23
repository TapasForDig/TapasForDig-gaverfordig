import type { Metadata } from 'next';
import { LegalPage, type Section } from '@/components/LegalPage';
import { LEGAL_UPDATED } from '@/lib/legal';

export const metadata: Metadata = { title: 'Databehandleraftale – Gaver For Dig' };

export default function DataProcessing() {
  const sections: Section[] = [
    [
      'Parter',
      [
        'Aftalen indgås mellem virksomheden, der bestiller gavekort (den dataansvarlige), og Vinfordig ApS, CVR 35854258, Merkurvej 1A, 6650 Brørup, der driver Gaver For Dig (databehandleren). Aftalen accepteres ved bestillingen og gælder, indtil alle oplysninger er slettet.',
      ],
    ],
    [
      'Formål og omfang',
      [
        {
          table: [
            ['Emne', 'Indhold'],
            ['Behandlingens art', 'Opbevaring, udsendelse af gavekoder på e-mail, registrering af gavevalg, pakning med navn og levering'],
            ['Registrerede', 'Medarbejdere og andre, som den dataansvarlige giver et gavekort'],
            ['Typer af oplysninger', 'Navn, e-mail, gavekode, valgt gave, hilsen og ved hjemmelevering adresse og telefon. Ingen følsomme oplysninger'],
            ['Varighed', 'Indtil gaven er leveret og derefter højst 6 måneder til reklamationer og spørgsmål'],
          ],
        },
      ],
    ],
    [
      'Den dataansvarliges forpligtelser',
      ['Den dataansvarlige sikrer, at der er et lovligt grundlag for at give oplysningerne til databehandleren, og informerer selv medarbejderne om det. Der må kun gives de oplysninger, som er nødvendige for leveringen.'],
    ],
    [
      'Databehandlerens forpligtelser',
      [
        {
          list: [
            'Behandler kun oplysningerne efter den dataansvarliges instruks, som er denne aftale og bestillingen.',
            'Sikrer, at medarbejdere med adgang har tavshedspligt.',
            'Gennemfører passende tekniske og organisatoriske sikkerhedsforanstaltninger.',
            'Bistår den dataansvarlige med at besvare anmodninger fra de registrerede, fx om indsigt eller sletning.',
            'Underretter den dataansvarlige uden unødig forsinkelse og senest 48 timer efter at have opdaget et brud på persondatasikkerheden.',
            'Giver den dataansvarlige de oplysninger, der er nødvendige for at vise, at aftalen overholdes.',
          ],
        },
      ],
    ],
    [
      'Underdatabehandlere',
      [
        'Den dataansvarlige giver generel godkendelse til underdatabehandlerne nedenfor. Nye underdatabehandlere varsles mindst 30 dage før, så den dataansvarlige kan gøre indsigelse.',
        {
          table: [
            ['Leverandør', 'Opgave', 'Placering'],
            ['Supabase Inc.', 'Database og billedlager', 'EU'],
            ['Vercel Inc.', 'Drift af hjemmesiden', 'Frankfurt'],
            ['Resend Inc.', 'Udsendelse af e-mails', 'EU/USA (Data Privacy Framework)'],
            ['Shipmondo ApS', 'Fragtlabels ved hjemmelevering', 'Danmark'],
            ['Fragtfirma', 'Levering af pakker til hjemmeadresser', 'EU'],
          ],
        },
      ],
    ],
    [
      'Sikkerhed',
      [
        {
          list: [
            'Al trafik er krypteret, og adgangskoder gemmes kun som hash.',
            'Adgang efter rolle: virksomheder ser kun egne ordrer, butikker ser ingen medarbejderoplysninger.',
            'Gavekoder er tilfældige og kan ikke gættes ud fra hinanden.',
            'Etiketter og pakkelister med navne opbevares aflåst og makuleres efter levering.',
          ],
        },
      ],
    ],
    [
      'Sletning',
      [
        'Navn, e-mail, adresse og telefon på medarbejdere slettes automatisk 6 måneder efter levering. Gavekoder og gavevalg bevares anonymt til statistik. Den dataansvarlige kan bede om tidligere sletning. Fakturaer indeholder ingen medarbejderoplysninger.',
      ],
    ],
    ['Ansvar og ophør', ['Parternes ansvar følger databeskyttelsesforordningen og handelsbetingelserne. Ved uoverensstemmelse gælder denne aftale for behandling af personoplysninger.']],
  ];
  return <LegalPage title="Databehandleraftale" lead="Gælder for de oplysninger om medarbejdere, som virksomheden giver Gaver For Dig, når den bestiller gavekort." sections={sections} updated={LEGAL_UPDATED} />;
}
