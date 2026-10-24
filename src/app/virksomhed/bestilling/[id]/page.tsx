import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Notice, Progress, Shell, Stat } from "@/components/ui";
import { logEvent, one, q } from "@/lib/db";
import { dato, datoTid, kr, str } from "@/lib/format";
import { giftsFor } from "@/lib/gifts";
import { sendMail } from "@/lib/mail";
import {
  assignRecipients,
  codeLink,
  deliveryAddressText,
  inviteMail,
  purchaseCodes,
  sendCodesMail,
  weekLabel,
} from "@/lib/purchase";
import { companyNav } from "../../nav";
import { ownPurchase } from "../access";

const back = (id: number, m: string): never =>
  redirect(`/virksomhed/bestilling/${id}?m=${encodeURIComponent(m)}`);

async function upload(fd: FormData) {
  "use server";
  const { u, p } = await ownPurchase(Number(fd.get("id")));
  if (new Date(p.choose_deadline) < new Date())
    back(p.id, "!Vælgefristen er overskredet");
  let text = str(fd, "rows");
  const file = fd.get("file");
  if (file instanceof File && file.size > 0 && file.size < 2_000_000)
    text += "\n" + (await file.text());
  if (!text.trim()) back(p.id, "!Indsæt eller vælg en liste med medarbejdere");
  const r = await assignRecipients(p.id, text, u.email);
  if (p.hold)
    back(
      p.id,
      `${r.assigned} medarbejdere er gemt. De får deres gavekode, så snart betalingen er registreret.`,
    );
  back(
    p.id,
    r.skipped.length
      ? `${r.assigned} gavekoder sendt. Sprunget over: ${r.skipped.slice(0, 5).join("; ")}${r.skipped.length > 5 ? " …" : ""}`
      : `${r.assigned} gavekoder er sendt til medarbejderne`,
  );
}

async function remind(fd: FormData) {
  "use server";
  const { u, p } = await ownPurchase(Number(fd.get("id")));
  if (p.hold) back(p.id, "!Bestillingen afventer betaling");
  const rows = await q<{
    id: number;
    name: string;
    email: string;
    code: string;
    token: string;
    greeting: string | null;
  }>(
    `select r.id, r.name, r.email, r.code, r.token, o.greeting from recipients r join gift_orders o on o.id = r.order_id
      where o.purchase_id = $1 and r.email is not null and r.chosen_product_id is null`,
    [p.id],
  );
  for (const r of rows) {
    await sendMail(
      r.email,
      `Husk at vælge din julegave fra ${p.company_name}`,
      inviteMail(
        r.name,
        p.company_name,
        r.code,
        r.token,
        r.greeting,
        p.choose_deadline,
      ),
    );
    await q("update recipients set reminded_at = now() where id = $1", [r.id]);
  }
  await logEvent(
    u.email,
    "purchase",
    p.id,
    "påmindelse sendt",
    `${rows.length}`,
  );
  back(
    p.id,
    rows.length
      ? `Påmindelse sendt til ${rows.length} medarbejdere`
      : "!Ingen medarbejdere med e-mail mangler at vælge",
  );
}

async function resendCodes(fd: FormData) {
  "use server";
  const { u, p } = await ownPurchase(Number(fd.get("id")));
  if (p.hold)
    back(
      p.id,
      "!Bestillingen afventer betaling – koderne sendes, når betalingen er registreret",
    );
  await sendCodesMail(p);
  await logEvent(u.email, "purchase", p.id, "gavekoder gensendt");
  back(p.id, `Gavekoderne er sendt til ${p.contact_email}`);
}

async function saveLine(fd: FormData) {
  "use server";
  const { p } = await ownPurchase(Number(fd.get("id")));
  const orderId = Number(fd.get("order"));
  const def = Number(fd.get("default_product")) || null;
  if (def) {
    // Standardgaven skal være en godkendt gave i ordrelinjens egen prisgruppe
    const line = await one<{ price_category_id: number }>("select price_category_id from gift_orders where id = $1 and purchase_id = $2", [orderId, p.id]);
    const allowed = line ? await giftsFor(line.price_category_id, null) : [];
    if (!allowed.some((x) => x.id === def && !x.variant_options)) back(p.id, "!Standardgaven skal være en af gaverne i prisgruppen (uden størrelser eller farver)");
  }
  await q(
    `update gift_orders set greeting = $1, default_product_id = $2 where id = $3 and purchase_id = $4 and status in ('confirmed','invited')`,
    [str(fd, "greeting"), def, orderId, p.id],
  );
  back(p.id, "Gemt");
}

export default async function PurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; vis?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { u, p } = await ownPurchase(Number(id));
  const codes = await purchaseCodes(p.id);
  const hidden = p.hold && u.role !== "admin";
  const lines = await q<{
    id: number;
    value_kr: number;
    quantity: number;
    price_category_id: number;
    greeting: string | null;
    default_product_id: number | null;
    status: string;
  }>(
    `select o.id, pc.value_kr, o.quantity, o.price_category_id, o.greeting, o.default_product_id, o.status
       from gift_orders o join price_categories pc on pc.id = o.price_category_id where o.purchase_id = $1 order by pc.value_kr`,
    [p.id],
  );
  const giftLists = await Promise.all(
    // Gaver med varianter (fx størrelse) kan ikke være standardgave – vi ved ikke, hvilken størrelse folk skal have
    lines.map(async (l) => (await giftsFor(l.price_category_id, l.default_product_id)).filter((g) => !g.variant_options)),
  );
  const chosen = codes.filter((c) => c.product_name).length;
  const sentTo = codes.filter((c) => c.email).length;
  const unassigned = codes.filter((c) => !c.email && !c.product_name).length;
  const open =
    new Date(p.choose_deadline) > new Date() &&
    lines.some((l) => ["confirmed", "invited"].includes(l.status));
  const filter = sp.vis ?? "alle";
  const shown = codes.filter((c) =>
    filter === "mangler"
      ? !c.product_name
      : filter === "valgt"
        ? !!c.product_name
        : true,
  );

  return (
    <Shell area={p.company_name} nav={companyNav}>
      <div className="stack">
        <div className="row between end">
          <div>
            <div className="eyebrow">
              Ordre {p.id} · bestilt {dato(p.created_at)}
              {u.role === "admin" ? ` · ${p.company_name}` : ""}
            </div>
            <h1>{p.quantity} julegaver</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              {weekLabel(p.delivery_week)} · leveres senest{" "}
              {dato(p.delivery_date)} · vælg senest {datoTid(p.choose_deadline)}
            </div>
          </div>
          {!hidden && (
            <div className="row">
              <a
                className="btn outline"
                href={`/virksomhed/bestilling/${p.id}/print`}
              >
                Print gavekoder
              </a>
              <a
                className="btn outline"
                href={`/virksomhed/bestilling/${p.id}/koder`}
              >
                Hent koder (Excel)
              </a>
            </div>
          )}
        </div>
        <Notice msg={sp.m} />
        {p.hold && (
          <div className="alert">
            <b>Afventer betaling.</b> Vi har sendt fakturaen til{" "}
            {p.billing_email}. Gavekoderne{" "}
            {p.codes_delivery === "file"
              ? "sendes til medarbejderne"
              : "sendes til jer"}
            , så snart betalingen er registreret – normalt samme dag.
            {u.role === "admin" &&
              " (Admin: frigiv koderne under Fakturering.)"}
          </div>
        )}

        <div className="stats">
          <Stat label="Julegaver" value={p.quantity} />
          <Stat label="Har valgt gave" value={chosen} tone="ok" />
          <Stat
            label="Mangler at vælge"
            value={p.quantity - chosen}
            tone={p.quantity - chosen ? "bad" : undefined}
          />
          <Stat
            label={
              p.codes_delivery === "file"
                ? "Sendt til medarbejdere"
                : "Sendt til jer"
            }
            value={p.codes_delivery === "file" ? sentTo : p.quantity}
          />
        </div>
        <div className="card stack-s">
          <div className="row between small">
            <b>Valgprocent</b>
            <span>
              {Math.round((chosen / Math.max(1, p.quantity)) * 100)} %
            </span>
          </div>
          <Progress
            pct={(chosen / Math.max(1, p.quantity)) * 100}
            label="Andel der har valgt gave"
          />
        </div>

        <div className="split">
          <section className="main card flush">
            <div className="card-head">
              <h2>Gavekoder</h2>
              <nav className="pills" aria-label="Filtrér">
                {[
                  ["alle", "Alle"],
                  ["mangler", "Mangler at vælge"],
                  ["valgt", "Har valgt"],
                ].map(([k, l]) => (
                  <Link
                    key={k}
                    className={`pill ${filter === k ? "on" : ""}`}
                    href={`?vis=${k}`}
                  >
                    {l}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Beløb</th>
                    <th>Medarbejder</th>
                    <th>Status</th>
                    <th>Gave</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id}>
                      <td
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {hidden ? "••••-••••" : c.code}
                      </td>
                      <td className="small">{kr(c.value_kr)}</td>
                      <td className="small">
                        {c.name ?? <span className="muted">–</span>}
                        {c.email && <div className="muted">{c.email}</div>}
                      </td>
                      <td>
                        {c.product_name ? (
                          <Badge tone="ok">
                            {c.is_default ? "Standardgave" : "Har valgt"}
                          </Badge>
                        ) : c.opened_at ? (
                          <Badge tone="warn">Åbnet</Badge>
                        ) : (
                          <Badge>Ikke brugt</Badge>
                        )}
                      </td>
                      <td className="small">
                        {c.product_name ?? "–"}
                        {c.shop_name && (
                          <div className="muted">{c.shop_name}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="side">
            {open && (p.codes_delivery === "file" || unassigned > 0) && (
              <div className="card">
                <form action={upload} className="form">
                  <h2>Send koder til medarbejdere</h2>
                  <input type="hidden" name="id" value={p.id} />
                  <p className="hint">
                    Én medarbejder pr. linje: navn; e-mail; beløb (fx 500). Vi
                    sender hver medarbejder sin personlige gavekode med det
                    samme. {unassigned} koder er ledige.
                  </p>
                  <textarea
                    name="rows"
                    aria-label="Medarbejderliste"
                    placeholder={
                      "Anne Jensen; anne@firma.dk; 500\nBo Hansen; bo@firma.dk; 500"
                    }
                  />
                  <input
                    type="file"
                    name="file"
                    accept=".csv,.txt"
                    aria-label="CSV-fil"
                  />
                  <button
                    className="btn"
                    type="submit"
                    disabled={unassigned === 0}
                  >
                    Send gavekoder
                  </button>
                </form>
              </div>
            )}
            {open && (
              <div className="card stack-s">
                <h2>Påmindelser</h2>
                {sentTo > 0 && (
                  <form action={remind}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn outline block" type="submit">
                      Påmind dem, der ikke har valgt
                    </button>
                  </form>
                )}
                <form action={resendCodes}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn outline block" type="submit">
                    Send alle koder til {p.contact_email} igen
                  </button>
                </form>
              </div>
            )}
            {lines.map((l, i) => (
              <div key={l.id} className="card">
                <form action={saveLine} className="form">
                  <h2>
                    Julegaver til {kr(l.value_kr)} · {l.quantity} stk.
                  </h2>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="order" value={l.id} />
                  <div className="field">
                    <label htmlFor={`g-${l.id}`}>Hilsen i gaveshoppen</label>
                    <textarea
                      id={`g-${l.id}`}
                      name="greeting"
                      defaultValue={l.greeting ?? ""}
                      disabled={!open}
                      style={{ minHeight: 80 }}
                      placeholder="Fx: Tak for en stærk indsats i år – glædelig jul!"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`d-${l.id}`}>Standardgave</label>
                    <select
                      id={`d-${l.id}`}
                      name="default_product"
                      defaultValue={l.default_product_id ?? ""}
                      disabled={!open}
                    >
                      <option value="">Gaver For Dig vælger</option>
                      {giftLists[i].map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} – {g.shop_name}
                        </option>
                      ))}
                    </select>
                    <span className="hint">
                      Gives til dem, der ikke har valgt, når fristen udløber.
                    </span>
                  </div>
                  {open && (
                    <button className="btn outline" type="submit">
                      Gem
                    </button>
                  )}
                </form>
              </div>
            ))}
            <div className="card stack-s small">
              <h2>Bestilling</h2>
              <dl className="sum" style={{ fontSize: 13 }}>
                <dt>Leveres til</dt>
                <dd>{deliveryAddressText(p)}</dd>
                <dt>Indpakning</dt>
                <dd>{p.wrapping ? "Gaveindpakning" : "Mulepose"}</dd>
                <dt>Julegaver</dt>
                <dd>{kr(p.subtotal_ex)}</dd>
                {p.delivery_fee_ex > 0 && (
                  <>
                    <dt>Levering</dt>
                    <dd>{kr(p.delivery_fee_ex)}</dd>
                  </>
                )}
                {p.wrapping_fee_ex > 0 && (
                  <>
                    <dt>Indpakning</dt>
                    <dd>{kr(p.wrapping_fee_ex)}</dd>
                  </>
                )}
                <dt>Moms</dt>
                <dd>{kr(p.moms)}</dd>
                <dt>
                  <b>I alt</b>
                </dt>
                <dd>
                  <b>{kr(p.total_inc)}</b>
                </dd>
                <dt>Betaling</dt>
                <dd>
                  {p.payment === "ean" ? `EAN ${p.ean}` : "Faktura"}
                  {p.po_number ? ` · ${p.po_number}` : ""}
                </dd>
              </dl>
              <p className="muted">
                Medarbejderne vælger på{" "}
                {codeLink("").replace(/\/g\/$/, "/gave")}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
