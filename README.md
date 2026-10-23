# Gaver For Dig (gaverfordig.dk)

Lokale firmagaver fra butikker i Vejen Kommune. Butikker opretter gaver, virksomheder bestiller til deres medarbejdere, medarbejderne vælger selv via et personligt link, og logistikcentralen samler, pakker og leverer én samlet ordre pr. virksomhed.

Bygget i **Next.js** (App Router) med **Postgres**. Lokalt kører databasen i en mappe (PGlite), så der skal ikke installeres noget. I drift bruges **Supabase** og **Vercel**.

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åbn http://localhost:3000. Første gang oprettes demo-data automatisk.

| Login | Rolle |
| --- | --- |
| admin@demo.dk | Admin (ser alle portaler) |
| virksomhed@demo.dk | Virksomhed |
| butik@demo.dk | Butik (Vin For Dig) |
| interior@demo.dk | Butik (demo) |
| logistik@demo.dk | Logistikcentral |

Adgangskode til alle: `demo1234`. Medarbejdernes gave-links står under Virksomhed → ordre → modtagere → "Mere".

Start forfra med ny demo-data: stop serveren og kør `npm run seed`.

## De fem portaler

| Portal | Adresse | Hvad man gør |
| --- | --- | --- |
| Forside | `/` | Info, priskategorier, tilmelding |
| Gaveshop | `/g/<token>` → `/gave` | Medarbejderen vælger én gave (ingen adgangskode) |
| Virksomhed | `/virksomhed` | Opret ordre, tilføj/indsæt modtagere, bekræft, send invitationer og påmindelser, standardgave, levering, CSV-eksport |
| Butik | `/butik` | Produktguide, afleveringsliste, print afleveringsseddel med QR, markér afleveret |
| Logistik | `/logistik` | Scan/indtast seddel, registrér modtaget/mangler, pakkeliste og navnemærkater, pakket/leveret |
| Admin | `/admin` | Godkend butikker/produkter, frister og priskategorier, luk vælgeperioden, fakturering og afregning, mails, hændelseslog |

## Flowet

1. Butik opretter produkt → admin godkender.
2. Virksomhed opretter ordre → tilføjer modtagere → bekræfter → sender invitationer.
3. Medarbejderne vælger (alkohol kræver bekræftelse af 18 år; udsolgte varer skjules).
4. Admin lukker vælgeperioden → standardgave til dem der ikke valgte → én afleveringsseddel pr. butik + mail.
5. Butik afleverer → logistik scanner og registrerer → pakker med navnemærkat → leverer.
6. Admin → Fakturering: liste til e-conomic og afregning pr. butik.

## Sæt i drift (Supabase + Vercel)

1. Opret et projekt på supabase.com (region EU, fx Frankfurt).
2. (Billed-bucket `produkter` oprettes automatisk ved første upload.)
3. Opret projektet på vercel.com ud fra dette GitHub-repo.
4. Sæt miljøvariabler i Vercel:

| Variabel | Værdi |
| --- | --- |
| `DATABASE_URL` | Supabase → Project Settings → Database → connection string (Transaction pooler) |
| `SUPABASE_URL` | `https://<projekt>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role key |
| `APP_URL` | `https://gaverfordig.dk` |
| `NO_DEMO` | `1` (ingen demo-data i drift) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Første admin-bruger |
| `RESEND_API_KEY` / `MAIL_FROM` | Når mails skal sendes rigtigt (resend.com) |

Tabellerne oprettes automatisk ved første opstart. Uden `RESEND_API_KEY` sendes ingen mails – de kan ses under Admin → Mails.

## Teknik

- `src/lib/schema.ts` – databaseskema (oprettes automatisk)
- `src/lib/seed.ts` – demo-data
- `src/lib/gifts.ts` – forretningslogik (gaver, invitationer, luk vælgeperiode)
- `src/lib/auth.ts` – login med sessioner; medarbejdere logger ind via personligt link
- `src/lib/mail.ts` – mails via Resend, altid gemt i outbox
- `src/lib/storage.ts` – produktbilleder (lokalt eller Supabase Storage)
