import type { Metadata } from 'next';
import { PublicHeader } from '@/components/ui';
import { shopSettings } from '@/lib/purchase';
import { kr } from '@/lib/format';

export const metadata: Metadata = { title: 'Handelsbetingelser – Gaver For Dig' };

// UDKAST – skal gennemgås, før siden bruges i drift
export default async function Terms() {
  const s = await shopSettings();
  const sections: [string, string[]][] = [
    ['Sælger', ['Gaver For Dig drives af Vinfordig ApS, CVR 35854258, Merkurvej 1A, 6650 Brørup.']],
    [
      'Bestilling',
      [
        `Gaver For Dig sælger til virksomheder og offentlige institutioner. Minimumskøb er ${s.minQty} gavekort pr. bestilling.`,
        'Alle priser er angivet ekskl. moms. Moms på 25 % lægges til ved bestillingen.',
        'Bestillingen er bindende, når ordrebekræftelsen er sendt.',
      ],
    ],
    [
      'Gavekort og gaver',
      [
        'Et gavekort giver medarbejderen ret til at vælge én fysisk gave fra udvalget i den valgte prisgruppe. Gavekortet kan ikke byttes til kontanter.',
        'Medarbejderen skal vælge gave senest på den frist, der står i ordrebekræftelsen. Vælger medarbejderen ikke, leveres den standardgave, virksomheden har valgt, eller en gave, vi vælger i prisgruppen.',
        'Udvalget kan ændre sig, efterhånden som butikkerne tilføjer gaver, eller varer bliver udsolgt.',
      ],
    ],
    [
      'Levering',
      [
        'Gaverne leveres i den uge, virksomheden har valgt.',
        `Levering samlet til virksomheden er gratis. Levering til medarbejdernes hjemmeadresser koster ${kr(s.homeFee)} ekskl. moms pr. gave.`,
        `Gaveindpakning koster ${kr(s.wrapFee)} ekskl. moms pr. gave. Uden indpakning leveres gaven i mulepose med navnelabel.`,
      ],
    ],
    ['Betaling', ['Betaling sker via faktura (14 dage netto) eller EAN for offentlige kunder.']],
    [
      'Reklamation',
      ['Er en gave defekt eller beskadiget ved levering, skal I kontakte os hurtigst muligt og senest 14 dage efter levering. Så sørger vi for en ny gave eller en anden løsning.'],
    ],
    [
      'Persondata',
      [
        'Uploader virksomheden navne og e-mails på medarbejdere, behandler vi oplysningerne som databehandler på vegne af virksomheden og kun for at levere gaverne.',
        'Oplysninger om medarbejdere slettes senest 6 måneder efter levering. Regnskabsdata gemmes efter bogføringsloven.',
      ],
    ],
  ];
  return (
    <>
      <PublicHeader />
      <main className="wrap stack" style={{ maxWidth: 820 }}>
        <h1>Handelsbetingelser</h1>
        <div className="alert warn">Udkast – skal gennemgås, før det bruges i drift.</div>
        {sections.map(([h, ps]) => (
          <section key={h} className="stack-s">
            <h2>{h}</h2>
            {ps.map((p) => (
              <p key={p} className="muted">
                {p}
              </p>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
