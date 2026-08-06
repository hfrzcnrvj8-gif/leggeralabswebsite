import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema, ensureInvoicesSchema, ensureCostsSchema, ensureContractsSchema, ensureOffersSchema, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";
import {
  isPlausibleDateString,
  formatPlDate,
  isProjectStatus,
  isProjectPriority,
  isProjectHealth,
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_HEALTHS,
} from "@/lib/projects";
import { skutkiZmianyStatusuProjektu } from "@/lib/skutkiProjektu";
import { contractReference, type ContractTyp } from "@/lib/contracts";
import type { ContractRow } from "@/lib/sciezkaDokumentow";
import { odpowiedzBrakRekordu } from "@/lib/brakRekordu";

export const runtime = "nodejs";

/** GET /api/projects/:id — project + its checklist + activity log. Admin-only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM projects WHERE id = ${id};`;
  const project = rows[0];
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const tasks = await sql`
    SELECT * FROM project_tasks WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const activity = await sql`
    SELECT * FROM project_activity WHERE project_id = ${id} ORDER BY created_at DESC;
  `;
  const milestones = await sql`
    SELECT * FROM project_milestones WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const resources = await sql`
    SELECT * FROM project_resources WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const onboarding = await sql`
    SELECT * FROM project_onboarding_items WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const dependencies = await sql`SELECT depends_on_id FROM project_dependencies WHERE project_id = ${id};`;

  // Skąd powstał ten projekt — jeśli został utworzony przez akceptację
  // oferty (lib/offerAccept.ts ustawia offers.project_id), pokazujemy w UI
  // link "→ Oferta: ...". Projekty utworzone ręcznie (POST /api/projects)
  // nie mają źródła — sourceOffer zostaje null.
  await ensureOffersSchema();
  const sourceOfferRows = await sql`SELECT id, tytul FROM offers WHERE project_id = ${id} LIMIT 1;`;
  const sourceOffer = sourceOfferRows[0] ?? null;

  // Dokumenty projektu — umowy i faktury (audyt Projektów, 2026-07-31).
  // Do tej pory profil projektu nie pokazywał ANI JEDNEGO dokumentu, choć
  // powiązania istniały w bazie w obie strony. Efekt: bramka Modułu 31
  // odmawiała startu „bo brak podpisanej umowy", a właściciel nie miał stąd
  // jak sprawdzić, czy umowa istnieje i w jakim jest stanie — musiał iść do
  // modułu Umowy i szukać po nazwie. Lejek był domknięty w kodzie, a rozpięty
  // na ekranie.
  await ensureContractsSchema();
  await ensureInvoicesSchema();
  // Umowa NIE ma kolumn `numer`/`tytul` — identyfikuje ją `contractReference()`
  // liczona z `id`, `typ` i `created_at` (bez numeracji fiskalnej, wzorem
  // oferty). Dlatego bierzemy te trzy pola, a etykietę składa UI.
  const documents = {
    // NUMER liczony TU, nie w apce — dokładnie jak w `GET /api/clients/:id`
    // (Moduł 59). `contractReference` jest funkcją panelu; przepisanie jej do
    // Swifta dałoby DRUGIE źródło numeru dokumentu. Bez tego pola apka mogłaby
    // pokazać tylko słowo „Umowa", a trzy umowy jednego projektu byłyby trzema
    // nierozróżnialnymi wierszami (audyt Faktur, 2026-07-31).
    contracts: ((await sql`
      SELECT id, typ, status, accepted_at, created_at
      FROM contracts WHERE project_id = ${id} ORDER BY created_at DESC;
    `) as ContractRow[]).map((c) => ({
      ...c,
      numer: contractReference({ id: c.id, typ: c.typ as ContractTyp, created_at: c.created_at }),
    })),
    /* Kwota brutto liczona TĄ SAMĄ formułą, co lista Faktur (`app/api/invoices`):
       z rabatem i z VAT-em per pozycja. Bez niej rejestr dokumentów w profilu
       projektu pokazywał sam numer i status — a „kwoty zawsze z walutą" jest
       punktem listy kontrolnej (kat. 7), i to nie kosmetycznym: jedyne pytanie,
       po które właściciel tu zagląda po zamknięciu projektu, brzmi „na ile
       wystawiłem". Rabat MUSI wejść — ta sama literówka zawyżała rentowność
       projektu do audytu 2026-07-31. */
    invoices: await sql`
      SELECT i.id, i.numer, i.status, i.typ_dokumentu, i.waluta, i.created_at,
             COALESCE((
               SELECT SUM(p.ilosc * p.cena_netto * (1 - p.rabat_procent / 100)
                          * (1 + CASE WHEN p.vat_stawka ~ '^[0-9]+$' THEN p.vat_stawka::numeric / 100 ELSE 0 END))
               FROM invoice_items p WHERE p.invoice_id = i.id
             ), 0)::float8 AS brutto
      FROM invoices i WHERE i.project_id = ${id} ORDER BY i.created_at DESC;
    `,
  };

  // Rentowność projektu: przychód netto z faktur projektu (wg tych samych
  // wykluczeń co licznik KSeF w InvoicesDashboard: bez proform/szkiców/
  // anulowanych, tylko PLN) minus koszty netto podpięte do projektu.
  // Świadomie tylko PLN w v1 — faktury w innych walutach są pomijane, o czym
  // informuje `ma_inne_waluty`.
  //
  // `(1 - rabat_procent / 100)` w sumie pozycji: rabat MUSI wejść do przychodu.
  // Do audytu Projektów (2026-07-31) ta jedna suma liczyła pozycje po cenie
  // katalogowej, podczas gdy lista faktur, eksport dla księgowej, wezwanie do
  // zapłaty i rejestr wpłat rabat stosowały. Projekt z rabatem pokazywał więc
  // przychód wyższy niż kwota, którą klient faktycznie zapłacił — a że zysk
  // i efektywna stawka godzinowa liczą się z tej liczby, jedna literówka
  // zawyżała TRZY wskaźniki naraz i żaden nie wyglądał na zepsuty. To ta sama
  // wpadka, co VAT 23 % dla każdej pozycji w Ofertach.
  //
  // Komentarz stoi TUTAJ, a nie w zapytaniu: w tych szablonach nowe linie się
  // gubią, więc SQL-owy komentarz `--` wycina wszystko, co po nim (złapane
  // sondą przy tej właśnie poprawce — `tsc` tego nie widzi). Wewnątrz zapytania
  // dozwolone są wyłącznie komentarze blokowe.
  await ensureInvoicesSchema();
  await ensureCostsSchema();
  const [revenueRow] = await sql`
    SELECT COALESCE(SUM(t.netto), 0)::float8 AS netto
    FROM invoices i
    JOIN (
      SELECT invoice_id, SUM(ilosc * cena_netto * (1 - rabat_procent / 100)) AS netto
      FROM invoice_items GROUP BY invoice_id
    ) t ON t.invoice_id = i.id
    WHERE i.project_id = ${id}
      AND i.typ_dokumentu != 'proforma'
      AND i.status != 'Szkic'
      AND i.status != 'Anulowana'
      AND i.waluta = 'PLN';
  `;
  const [nonPlnRow] = await sql`
    SELECT COUNT(*)::int AS n
    FROM invoices
    WHERE project_id = ${id}
      AND typ_dokumentu != 'proforma'
      AND status != 'Szkic'
      AND status != 'Anulowana'
      AND waluta != 'PLN';
  `;
  // KOSZT W OBCEJ WALUCIE PRZELICZ KURSEM (przegląd szwów, 2026-08-06).
  //
  // Do tego dnia było tu gołe `SUM(kwota_netto)`. Zmierzone sondą: koszt
  // 1000 EUR z kursem 4,30 wchodził do rentowności jako **1000 zł** zamiast
  // 4300 — zysk zawyżony o 3300 zł, a `ma_inne_waluty` milczało, bo patrzy
  // wyłącznie na faktury. Moduł Koszty i eksport dla księgowej liczyły to
  // poprawnie (`wPln()` z lib/costs.ts), więc dwa ekrany podawały dwie różne
  // kwoty tego samego kosztu i żaden nie wyglądał na zepsuty. Ta sama rodzina,
  // co rabat pominięty w tej samej sumie (audyt Projektów, 2026-07-31).
  //
  // `kurs_pln IS NULL` znaczy „koszt w złotych" (patrz `kursDoPln()`), więc
  // COALESCE(...,1) jest tu poprawne — ale TYLKO razem z warunkiem niżej,
  // który wyrzuca koszt w obcej walucie BEZ kursu. Bez tego mnożnik 1 wróciłby
  // tylnymi drzwiami dla wpisu z importu KSeF, gdzie kursu może nie być
  // (`maPrzelicznik()`); zaniżona suma bez śladu jest gorsza niż suma niepełna
  // z ostrzeżeniem — to rozstrzygnięcie Modułu 63 i tu obowiązuje tak samo.
  const [costsRow] = await sql`
    SELECT COALESCE(SUM(kwota_netto * COALESCE(kurs_pln, 1)), 0)::float8 AS netto
    FROM costs
    WHERE project_id = ${id}
      AND (COALESCE(waluta, 'PLN') = 'PLN' OR kurs_pln > 0);
  `;
  const [kosztyBezKursuRow] = await sql`
    SELECT COUNT(*)::int AS n
    FROM costs
    WHERE project_id = ${id}
      AND COALESCE(waluta, 'PLN') != 'PLN'
      AND (kurs_pln IS NULL OR kurs_pln <= 0);
  `;
  const przychodNetto = Number(revenueRow?.netto ?? 0);
  const kosztyNetto = Number(costsRow?.netto ?? 0);
  const kosztyBezKursu = Number(kosztyBezKursuRow?.n ?? 0);
  const rentownosc = {
    przychod_netto: przychodNetto,
    koszty_netto: kosztyNetto,
    zysk_netto: przychodNetto - kosztyNetto,
    ma_inne_waluty: Number(nonPlnRow?.n ?? 0) > 0,
    /** Ile kosztów wypadło z sumy, bo są w obcej walucie bez kursu. Liczba, nie
     *  flaga: ekran ma powiedzieć „bez 2 kosztów", a nie samo „niepełne". */
    koszty_bez_kursu: kosztyBezKursu,
  };

  return NextResponse.json({ project, tasks, activity, milestones, resources, onboarding, dependencies, rentownosc, sourceOffer, documents });
}

/** PATCH /api/projects/:id — update one or more fields. Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  // Stan sprzed zmiany — potrzebny do automatycznego logu aktywności
  // ("Status: X → Y"). Bez tego log nie wiedziałby, co było wcześniej.
  const current = (await sql`SELECT * FROM projects WHERE id = ${id};`)[0] as
    | Record<string, unknown>
    | undefined;
  // Projekt mógł zniknąć w drugim oknie panelu — patrz lib/brakRekordu.ts.
  if (!current) return odpowiedzBrakRekordu("projekt");

  // Zbieramy czytelne opisy zmian pól śledzonych na osi historii projektu.
  const changes: string[] = [];
  const norm = (v: unknown) => (v == null ? "" : String(v));
  const dateLabel = (v: string) => (v ? formatPlDate(v) : "—");

  if ("tytul" in body) {
    await sql`UPDATE projects SET tytul = ${str(body.tytul)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("opis" in body) {
    await sql`UPDATE projects SET opis = ${str(body.opis)}, updated_at = now() WHERE id = ${id};`;
  }
  let statusChangedTo: string | null = null;
  if ("status" in body) {
    // PRZYCINAMY przed sprawdzeniem słownika — bramka umowy niżej porównuje
    // status przez `===`, więc surowe „W trakcie " (ze spacją) omijało ją
    // w całości (sonda audytu, 2026-07-31). Strażnik bez `trim()` zamknąłby
    // tylko połowę dziury.
    const nv = str(body.status).trim();
    if (!isProjectStatus(nv)) {
      return NextResponse.json(
        { error: `Nieznany status projektu. Dozwolone: ${PROJECT_STATUSES.join(", ")}.` },
        { status: 400 }
      );
    }
    // Formalny start realizacji ("W trakcie") wymaga podpisanej Umowy —
    // jedyny wyjątek od zasady "miękkie podpowiedzi, nigdy twarde bramki"
    // w tym panelu, świadomie zaakceptowany przez właściciela (patrz
    // docs/plany-modulow/11-umowy-i-nda.md, mapa drogi klienta Krok 3:
    // "to jest formalny start projektu, nie wcześniej").
    //
    // Moduł 31 — bramka obejmuje TYLKO projekty mające klienta. Projekt bez
    // `client_id` to robota wewnętrzna (przebudowa własnej strony, demo do
    // portfolio) — panel żądał od niego podpisanej umowy, której nie ma z kim
    // podpisać, więc taki projekt nie przechodził na "W trakcie" NIGDY
    // (POST /api/projects nie ustawia `client_id` w ogóle, więc dotyczyło to
    // każdego ręcznie założonego projektu). Warunek "ma klienta" włącza
    // dyscyplinę dokładnie w momencie, w którym projekt staje się pracą dla
    // kogoś. Decyzja właściciela 2026-07-17 — bramka zostaje TWARDA, patrz
    // docs/plany-modulow/31-umowy-widoczne.md, pytanie 1.
    if (nv === "W trakcie" && current && norm(current.status) !== "W trakcie" && norm(current.client_id)) {
      await ensureContractsSchema();
      const signed = await sql`
        SELECT 1 FROM contracts WHERE project_id = ${id} AND typ = 'umowa' AND status = 'Podpisana' LIMIT 1;
      `;
      if (signed.length === 0) {
        return NextResponse.json(
          {
            error:
              "Brak podpisanej umowy — projekt ma klienta, więc formalny start wymaga papieru. Wejdź w moduł Umowy, przypnij do tej umowy ten projekt (pole „Projekt” obok powiązania) i oznacz ją jako podpisaną.",
          },
          { status: 409 }
        );
      }
    }
    if (current && norm(current.status) !== nv) {
      changes.push(`Status: ${norm(current.status) || "—"} → ${nv}`);
      statusChangedTo = nv;
    }
    await sql`UPDATE projects SET status = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("priorytet" in body) {
    const nv = str(body.priorytet).trim();
    if (!isProjectPriority(nv)) {
      return NextResponse.json(
        { error: `Nieznany priorytet. Dozwolone: ${PROJECT_PRIORITIES.join(", ")}.` },
        { status: 400 }
      );
    }
    if (current && norm(current.priorytet) !== nv) changes.push(`Priorytet: ${norm(current.priorytet) || "—"} → ${nv}`);
    await sql`UPDATE projects SET priorytet = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zdrowie" in body) {
    // Zdrowie wolno WYCZYŚCIĆ (projekt bez oceny) — pusty string przechodzi,
    // reszta musi być ze słownika.
    const nv = str(body.zdrowie).trim();
    if (nv && !isProjectHealth(nv)) {
      return NextResponse.json(
        { error: `Nieznane zdrowie projektu. Dozwolone: ${PROJECT_HEALTHS.join(", ")}.` },
        { status: 400 }
      );
    }
    if (current && norm(current.zdrowie) !== nv) changes.push(`Zdrowie: ${norm(current.zdrowie) || "—"} → ${nv}`);
    await sql`UPDATE projects SET zdrowie = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("termin" in body) {
    const raw = body.termin;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid termin" }, { status: 400 });
    }
    const value = trimmed || null;
    const oldD = norm(current?.termin).slice(0, 10);
    const newD = value ? value.slice(0, 10) : "";
    if (current && oldD !== newD) changes.push(`Termin: ${dateLabel(oldD)} → ${dateLabel(newD)}`);
    await sql`UPDATE projects SET termin = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("start" in body) {
    const raw = body.start;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid start" }, { status: 400 });
    }
    const value = trimmed || null;
    const oldD = norm(current?.start).slice(0, 10);
    const newD = value ? value.slice(0, 10) : "";
    if (current && oldD !== newD) changes.push(`Start: ${dateLabel(oldD)} → ${dateLabel(newD)}`);
    await sql`UPDATE projects SET start = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("lead_id" in body) {
    const raw = body.lead_id;
    const value = typeof raw === "string" && raw.trim() ? raw : null;
    await sql`UPDATE projects SET lead_id = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("client_id" in body) {
    // Ręczne podpięcie/zmiana klienta — jedyna dziś ścieżka poza automatycznym
    // ustawieniem przy akceptacji oferty (lib/offerAccept.ts). Potrzebne m.in.
    // dla Modułu 15 (zamknięcie/opinia), który wymaga klienta z adresem e-mail.
    await ensureClientsSchema();
    const raw = body.client_id;
    const value = typeof raw === "string" && raw.trim() ? raw : null;
    await sql`UPDATE projects SET client_id = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kolor" in body) {
    const value = typeof body.kolor === "string" && body.kolor.trim() ? body.kolor.slice(0, 20) : null;
    await sql`UPDATE projects SET kolor = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ikona" in body) {
    const value = typeof body.ikona === "string" && body.ikona.trim() ? body.ikona.slice(0, 16) : null;
    await sql`UPDATE projects SET ikona = ${value}, updated_at = now() WHERE id = ${id};`;
  }

  // Dopisz automatyczne wpisy „system" do logu aktywności (audyt zmian).
  for (const text of changes) {
    await sql`
      INSERT INTO project_activity (id, project_id, text, kind)
      VALUES (${randomUUID()}, ${id}, ${text}, 'system');
    `;
  }

  if (statusChangedTo && current) {
    // Komplet skutków (wpis na osi klienta + nurture) liczy od Fazy 3 jedno
    // miejsce — bo do „Wdrożone" prowadzi też zatwierdzenie propozycji
    // „opinia przyszła — zamknąć projekt?" (lib/propozycje.ts), a skutek nie
    // może zależeć od tego, którą drogą przyszedł.
    await skutkiZmianyStatusuProjektu(
      sql,
      {
        id,
        tytul: typeof current.tytul === "string" ? current.tytul : "Projekt",
        clientId: typeof current.client_id === "string" ? current.client_id : null,
        leadId: typeof current.lead_id === "string" ? current.lead_id : null,
      },
      statusChangedTo
    );
  }

  const activity = await sql`
    SELECT * FROM project_activity WHERE project_id = ${id} ORDER BY created_at DESC;
  `;
  return NextResponse.json({ ok: true, activity });
}

/** DELETE /api/projects/:id — remove a project (cascades tasks/activity). Admin-only. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();

  // POTWIERDZENIE (Faza 4), poziom „mocne" — kasowanie projektu kaskaduje na
  // kamienie milowe, zadania i zapisany czas. Tytuł czyta serwer, bo to on
  // rozstrzyga, czy przepisano właściwy.
  const istnieje = await sql`SELECT tytul FROM projects WHERE id = ${id};`;
  if (!istnieje[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  const odmowaPotw = odmowaPotwierdzenia(
    "projekt-usun",
    odczytajPotwierdzenie(req.headers),
    typeof istnieje[0].tytul === "string" ? istnieje[0].tytul : null
  );
  if (odmowaPotw) {
    return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
  }

  await sql`DELETE FROM projects WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
