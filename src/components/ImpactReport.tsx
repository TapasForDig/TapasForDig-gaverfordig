import { kr } from "@/lib/format";
import { genitiv, type Impact } from "@/lib/impact";

// Delbar oversigt over, hvor meget en virksomheds julegaver holder i lokale butikker
export function ImpactReport({
  company,
  logo,
  impact,
  year,
  final,
}: {
  company: string;
  logo: string | null;
  impact: Impact;
  year: number;
  final: boolean;
}) {
  return (
    <article className="impact">
      <header className="impact-head">
        <div className="impact-brand">
          {logo ? (
            <img src={logo} alt={company} className="impact-logo" />
          ) : (
            <span className="impact-company">{company}</span>
          )}
          <img
            src="/logo-white.png"
            alt="Gaver For Dig"
            width={140}
            height={21}
          />
        </div>
        <div className="eyebrow">Julegaver {year} · lokal effekt</div>
        <h1>
          {genitiv(company)} julegaver holdt{" "}
          <span className="gold">{kr(impact.value)}</span> i Vejen Kommune
        </h1>
        <p>
          {summary(impact)}{" "}
          {!final && impact.total > impact.gifts
            ? `Tallene vokser endnu – ${impact.total - impact.gifts} medarbejdere har ikke valgt endnu.`
            : ""}
        </p>
      </header>
      <div className="impact-stats">
        <div>
          <b>{kr(impact.value)}</b>
          <span>handlet lokalt</span>
        </div>
        <div>
          <b>{impact.shops.length}</b>
          <span>lokale butikker</span>
        </div>
        <div>
          <b>{impact.gifts}</b>
          <span>julegaver</span>
        </div>
      </div>
      {impact.shops.length > 0 && (
        <section className="impact-shops">
          <h2>Butikkerne bag gaverne</h2>
          <ul>
            {impact.shops.map((s) => (
              <li key={s.id}>
                {s.logo ? (
                  <img src={s.logo} alt="" />
                ) : (
                  <span className="impact-initial">{s.name.slice(0, 1)}</span>
                )}
                <div>
                  <b>{s.name}</b>
                  {s.town && <span className="small muted">{s.town}</span>}
                </div>
                <span className="impact-count">
                  {s.gifts} {s.gifts === 1 ? "gave" : "gaver"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {impact.clubs.length > 0 && (
        <section className="impact-shops">
          <h2>Givet videre til lokale foreninger</h2>
          <ul>
            {impact.clubs.map((c) => (
              <li key={c.name}>
                <span className="impact-initial">♥</span>
                <div>
                  <b>{c.name}</b>
                  {c.town && <span className="small muted">{c.town}</span>}
                </div>
                <span className="impact-count">{kr(c.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="impact-foot small">
        Når pengene bliver i lokale butikker, styrker det handelslivet,
        arbejdspladserne og byerne, hvor vi bor. Beløb er gavernes værdi ekskl.
        moms. · gaverfordig.dk
      </footer>
    </article>
  );
}

function summary(i: Impact) {
  const parts: string[] = [];
  if (i.shops.length) {
    const n = i.gifts - i.clubs.reduce((a, c) => a + c.gifts, 0);
    parts.push(
      `${n} ${n === 1 ? "gave" : "gaver"} fra ${i.shops.length} lokale ${i.shops.length === 1 ? "butik" : "butikker"}${i.towns.length ? ` i ${listText(i.towns)}` : ""}`,
    );
  }
  if (i.clubs.length)
    parts.push(
      `${kr(i.clubValue)} givet videre til ${i.clubs.length} ${i.clubs.length === 1 ? "lokal forening" : "lokale foreninger"}`,
    );
  const t = parts.join(" – og ");
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : "";
}

function listText(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} og ${xs[xs.length - 1]}`;
}
