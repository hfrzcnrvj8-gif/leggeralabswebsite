import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema, ensureOffersSchema, ensureInvoicesSchema, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import {
  zbudujSciezki,
  type OfferRow,
  type ContractRow,
  type InvoiceRow,
  type ProjectRow,
} from "@/lib/sciezkaDokumentow";

export const runtime = "nodejs";

const RODZAJE = ["offer", "contract", "project", "invoice"] as const;
type Rodzaj = (typeof RODZAJE)[number];

/** Klient dokumentu. Świadomie switch, a nie nazwa tabeli wstrzykiwana do
 * zapytania: klient `neon()` (i PGlite w dev) nie mają `sql.unsafe`, więc
 * dynamiczna tabela kończyła się błędem 500 na każdej mini-mapie. */
async function klientDokumentu(sql: ReturnType<typeof getSql>, kind: Rodzaj, id: string): Promise<string | null | undefined> {
  const rows =
    kind === "offer"
      ? await sql`SELECT client_id FROM offers WHERE id = ${id};`
      : kind === "contract"
        ? await sql`SELECT client_id FROM contracts WHERE id = ${id};`
        : kind === "invoice"
          ? await sql`SELECT client_id FROM invoices WHERE id = ${id};`
          : await sql`SELECT client_id FROM projects WHERE id = ${id};`;
  if (!rows[0]) return undefined;
  return typeof rows[0].client_id === "string" ? rows[0].client_id : null;
}

/** GET /api/sciezka/:rodzaj/:id — wątek, w którym stoi TEN dokument.
 *
 * **Po co osobna trasa.** Ścieżkę widać było wyłącznie na karcie klienta, więc
 * pytanie „z czego wynika ta umowa i co z niej poszło" wymagało wyjścia
 * z dokumentu, znalezienia klienta i wrócenia. Mini-mapa w profilu odpowiada
 * na nie w miejscu, w którym pada.
 *
 * Wątek budujemy TĄ SAMĄ funkcją co karta klienta (`lib/sciezkaDokumentow.ts`)
 * — dwie kopie tej reguły rozjechałyby się przy pierwszej zmianie, a wtedy
 * profil pokazywałby inne zależności niż karta.
 *
 * **Dokument bez klienta** (np. umowa napisana zanim klient istniał) dostaje
 * wątek zbudowany z samych swoich powiązań. Zwracamy go nawet wtedy, gdy ma
 * jeden węzeł — inaczej profil milczałby dokładnie tam, gdzie właściciel pyta
 * „a z czym to jest połączone?". Karta klienta filtruje jednoelementowe wątki
 * z innego powodu: tam stoją obok pełnego rejestru, więc byłyby powtórzeniem.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ rodzaj: string; id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { rodzaj, id } = await params;
  if (!(RODZAJE as readonly string[]).includes(rodzaj)) {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }
  const kind = rodzaj as Rodzaj;

  await Promise.all([ensureOffersSchema(), ensureContractsSchema(), ensureInvoicesSchema(), ensureHubSchema()]);
  const sql = getSql();

  const clientId = await klientDokumentu(sql, kind, id);
  if (clientId === undefined) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Z klientem: bierzemy komplet jego dokumentów, żeby wątek był pełny
  // (faktura wie o umowie, umowa o ofercie). Bez klienta: tylko to, co wisi
  // wprost na tym dokumencie — więcej i tak nie ma jak znaleźć.
  const [offers, contracts, invoices, projects] = clientId
    ? await Promise.all([
        sql`
          SELECT o.id, o.tytul, o.status, o.waluta, o.project_id, o.created_at,
                 COALESCE(t.kwota, 0)::float8 AS kwota
          FROM offers o
          LEFT JOIN (
            SELECT offer_id, SUM(ilosc * cena) FILTER (WHERE NOT opcjonalna OR wybrana) AS kwota
            FROM offer_items GROUP BY offer_id
          ) t ON t.offer_id = o.id
          WHERE o.client_id = ${clientId} ORDER BY o.created_at DESC;
        ` as unknown as Promise<OfferRow[]>,
        sql`
          SELECT id, typ, status, project_id, offer_id, parent_contract_id, aneks_nr, cena, waluta, created_at
          FROM contracts WHERE client_id = ${clientId} ORDER BY created_at DESC;
        ` as unknown as Promise<ContractRow[]>,
        sql`
          SELECT i.id, i.numer, i.status, i.typ_dokumentu, i.offer_id, i.contract_id, i.project_id,
                 i.waluta, i.created_at, COALESCE(t.kwota, 0)::float8 AS kwota
          FROM invoices i
          LEFT JOIN (
            SELECT invoice_id, SUM(ilosc * cena_netto * (1 - rabat_procent / 100)) AS kwota FROM invoice_items GROUP BY invoice_id
          ) t ON t.invoice_id = i.id
          WHERE i.client_id = ${clientId} ORDER BY i.created_at DESC;
        ` as unknown as Promise<InvoiceRow[]>,
        sql`SELECT id, tytul, status, created_at FROM projects WHERE client_id = ${clientId};` as unknown as Promise<
          ProjectRow[]
        >,
      ])
    : await watekBezKlienta(sql, kind, id);

  const wszystkie = zbudujSciezki(offers, contracts, invoices, projects);
  // Wątek zawierający TEN dokument. Gdy dokument nie wpadł do żadnego (bo nie
  // ma powiązań), oddajemy pusty wątek — profil pokaże wtedy podpowiedź, czym
  // go połączyć, zamiast rysować drzewko z jednego kafelka.
  const wezly = wszystkie.find((w) => w.some((k) => k.id === id)) ?? [];
  return NextResponse.json({ wezly, aktywny: id });
}

/** Dokument bez klienta — wątek z jego własnych powiązań.
 *
 * Zapytania są celowo proste i bez `ANY(...)`: to ścieżka wyjątkowa (dokument
 * napisany zanim klient istniał), a kilka małych zapytań czyta się lepiej niż
 * jedno sprytne, które w dev (PGlite) potrafi zachować się inaczej niż na
 * produkcji. */
async function watekBezKlienta(
  sql: ReturnType<typeof getSql>,
  kind: Rodzaj,
  id: string
): Promise<[OfferRow[], ContractRow[], InvoiceRow[], ProjectRow[]]> {
  let offerId: string | null = kind === "offer" ? id : null;
  if (kind === "contract") {
    offerId = ((await sql`SELECT offer_id FROM contracts WHERE id = ${id};`)[0]?.offer_id as string) ?? null;
  }
  if (kind === "invoice") {
    offerId = ((await sql`SELECT offer_id FROM invoices WHERE id = ${id};`)[0]?.offer_id as string) ?? null;
  }

  const offers = offerId
    ? ((await sql`
        SELECT o.id, o.tytul, o.status, o.waluta, o.project_id, o.created_at,
               COALESCE(t.kwota, 0)::float8 AS kwota
        FROM offers o
        LEFT JOIN (
          SELECT offer_id, SUM(ilosc * cena) FILTER (WHERE NOT opcjonalna OR wybrana) AS kwota
          FROM offer_items GROUP BY offer_id
        ) t ON t.offer_id = o.id
        WHERE o.id = ${offerId};
      `) as unknown as OfferRow[])
    : [];

  const umowyBezposrednie = (await sql`
    SELECT id, typ, status, project_id, offer_id, parent_contract_id, aneks_nr, cena, waluta, created_at
    FROM contracts WHERE id = ${id} OR parent_contract_id = ${id};
  `) as unknown as ContractRow[];
  const umowyZOferty = offerId
    ? ((await sql`
        SELECT id, typ, status, project_id, offer_id, parent_contract_id, aneks_nr, cena, waluta, created_at
        FROM contracts WHERE offer_id = ${offerId};
      `) as unknown as ContractRow[])
    : [];
  const contracts = [...umowyBezposrednie, ...umowyZOferty].filter(
    (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
  );

  const fakturyPoUmowach: InvoiceRow[] = [];
  for (const c of contracts) {
    const rows = (await sql`
      SELECT i.id, i.numer, i.status, i.typ_dokumentu, i.offer_id, i.contract_id, i.project_id,
             i.waluta, i.created_at, COALESCE(t.kwota, 0)::float8 AS kwota
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(ilosc * cena_netto * (1 - rabat_procent / 100)) AS kwota FROM invoice_items GROUP BY invoice_id
      ) t ON t.invoice_id = i.id
      WHERE i.contract_id = ${c.id};
    `) as unknown as InvoiceRow[];
    fakturyPoUmowach.push(...rows);
  }
  const fakturyZOferty = offerId
    ? ((await sql`
        SELECT i.id, i.numer, i.status, i.typ_dokumentu, i.offer_id, i.contract_id, i.project_id,
               i.waluta, i.created_at, COALESCE(t.kwota, 0)::float8 AS kwota
        FROM invoices i
        LEFT JOIN (
          SELECT invoice_id, SUM(ilosc * cena_netto * (1 - rabat_procent / 100)) AS kwota FROM invoice_items GROUP BY invoice_id
        ) t ON t.invoice_id = i.id
        WHERE i.offer_id = ${offerId};
      `) as unknown as InvoiceRow[])
    : [];
  const invoices = [...fakturyPoUmowach, ...fakturyZOferty].filter(
    (f, i, arr) => arr.findIndex((x) => x.id === f.id) === i
  );

  const idProjektow = [
    ...new Set(
      [...contracts.map((c) => c.project_id), ...offers.map((o) => o.project_id), ...invoices.map((i) => i.project_id)]
        .filter(Boolean)
        .map(String)
    ),
  ];
  const projects: ProjectRow[] = [];
  for (const pid of idProjektow) {
    const rows = (await sql`SELECT id, tytul, status, created_at FROM projects WHERE id = ${pid};`) as unknown as ProjectRow[];
    projects.push(...rows);
  }

  return [offers, contracts, invoices, projects];
}
