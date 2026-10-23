import { PublicHeader } from '@/components/ui';

export type Block = string | { table: string[][] } | { list: string[] };
export type Section = [string, Block[]];

// Fælles opsætning af juridiske sider (privatliv, databehandleraftale)
export function LegalPage({ title, lead, sections, updated }: { title: string; lead: string; sections: Section[]; updated: string }) {
  return (
    <>
      <PublicHeader />
      <main className="wrap stack legal" style={{ maxWidth: 860 }}>
        <div className="stack-s">
          <h1>{title}</h1>
          <p className="muted" style={{ fontSize: 17 }}>
            {lead}
          </p>
          <span className="small muted">Senest opdateret {updated}</span>
        </div>
        {sections.map(([h, blocks]) => (
          <section key={h} className="stack-s">
            <h2>{h}</h2>
            {blocks.map((b, i) =>
              typeof b === 'string' ? (
                <p key={i}>{b}</p>
              ) : 'list' in b ? (
                <ul key={i}>
                  {b.list.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <div key={i} className="table-wrap card flush">
                  <table className="table">
                    <thead>
                      <tr>
                        {b.table[0].map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.table.slice(1).map((r) => (
                        <tr key={r[0]}>
                          {r.map((c, j) => (
                            <td key={j} className="small">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
            )}
          </section>
        ))}
      </main>
    </>
  );
}
