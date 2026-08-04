import { NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureHubSchema, ensureInvoicesSchema, ensureOffersSchema, ensureClientsSchema, ensureFollowupsSchema, ensureMailSchema, ensureContractsSchema, ensureBackupSchema, zPonowieniem } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, type Lead } from "@/lib/leads";
import { isProjectAtRisk, isProjectOverdue, projectReviewAverage, type Project } from "@/lib/projects";
import { isInvoiceOverdue, taxReserveBreakdown, type Invoice, type CompanySettings } from "@/lib/invoices";
import { isOfferExpired, isOfferStale, offerSilenceDays, weightedOfferValue, offerLiczySieDoStatystyk, CLOSED_OFFER_STATUSES, type Offer } from "@/lib/offers";
import {
  contractDraftAgeDays,
  isContractForgottenDraft,
  isContractStale,
  contractSilenceDays,
  dniDoDzialaniaUmowy,
  powodOdnowienia,
  signedContractRate,
  umowaDoOdnowienia,
  type Contract,
} from "@/lib/contracts";
import { isClientOverdue, type Client } from "@/lib/clients";
import { rozwinSerieWydarzen, type HubEvent } from "@/lib/events";
import type { Note } from "@/lib/notes";
import { todayLocalISO } from "@/lib/dates";
import { ocenKopie, type BackupRun } from "@/lib/backup";
import { stanAutomatow, zapiszWyjatek } from "@/lib/errorLog";
import { zbierzPropozycje, type StanPropozycji } from "@/lib/propozycje";
import { wymagaUwagi, type StanAutomatu } from "@/lib/observability";

export const runtime = "nodejs";

type InvoiceRow = Invoice & { netto: number; vat: number; brutto: number; zaplacono: number };
type OfferRow = Offer & { kwota: number };
/** Moduł 31 — tylko tyle kolumn umowy, ile Pulpit realnie pokazuje. Nazwa
 * klienta z JOIN-a, bo migawka `klient_nazwa` bywa pusta na szkicu. */
type ContractRow = Pick<
  Contract,
  | "id"
  | "typ"
  | "status"
  | "project_id"
  | "client_id"
  | "sent_at"
  | "klient_nazwa"
  // Okres obowiązywania — do sekcji „Umowy dobiegające końca" (2026-07-27).
  | "obowiazuje_do"
  | "wypowiedzenie_dni"
  | "odnawialna"
  // Krok 4 (B4) — do „zapomnianych szkiców": numer aneksu do etykiety
  // i data powstania do wieku szkicu.
  | "aneks_nr"
  | "created_at"
> & {
  client_nazwa: string | null;
};

function addToCurrencyMap(map: Map<string, number>, currency: string, amount: number) {
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

/** GET /api/hub/today — agreguje dane z leadów, projektów, faktur, ofert,
 * kalendarza i notatnika w jeden widok "co dziś" + KPI dla pulpitu. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureInvoicesSchema();
  await ensureOffersSchema();
  await ensureClientsSchema();
  await ensureFollowupsSchema();
  await ensureMailSchema();
  await ensureContractsSchema();
  const sql = getSql();

  const today = todayLocalISO();
  const thisMonth = today.slice(0, 7); // "YYYY-MM"
  // Miesiąc poprzedni liczony przez arytmetykę na roku/miesiącu (nie przez
  // Date), żeby uniknąć tej samej pułapki UTC-vs-lokalny czas co przy `today`.
  const [thisYearNum, thisMonthNum] = thisMonth.split("-").map(Number);
  const lastMonth =
    thisMonthNum === 1 ? `${thisYearNum - 1}-12` : `${thisYearNum}-${String(thisMonthNum - 1).padStart(2, "0")}`;

  const [leads, clients, projects, overdueMilestones, todayEvents, recentNotes, invoices, offers, contracts, dueFollowups, companySettingsRows, pendingMails] = await Promise.all([
    sql`SELECT * FROM leads;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM clients;` as unknown as Promise<Client[]>,
    sql`SELECT * FROM projects;` as unknown as Promise<Project[]>,
    // Kamienie milowe po terminie (projekt niewdrożony, kamień nieukończony) —
    // widoczne NIEZALEŻNIE od terminu całego projektu. Bez tego spóźniony
    // kamień w trwającym projekcie był zupełnie cichy (patrz isProjectOverdue,
    // które patrzy tylko na termin projektu).
    sql`
      SELECT m.id, m.nazwa, m.termin, m.project_id, p.tytul AS projekt
      FROM project_milestones m
      JOIN projects p ON p.id = m.project_id
      WHERE p.status != 'Wdrożone' AND m.termin IS NOT NULL AND m.termin <= ${today}
        AND (
          EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = m.id AND t.done = false)
          OR NOT EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = m.id)
        )
      ORDER BY m.termin ASC;
    ` as unknown as Promise<{ id: string; nazwa: string; termin: string; project_id: string; projekt: string }[]>,
    // Wydarzenia na dziś — plus wiersze-wzorce serii, które MOGĄ mieć dziś
    // wystąpienie. Sama równość na `data` wpuszczałaby tylko pierwsze
    // wystąpienie, więc cotygodniowy przegląd pokazałby się na Pulpicie raz
    // w życiu. Rozwinięcie na konkretny dzień robi `rozwinSerieWydarzen()`
    // niżej — tu zawężamy tylko to, co w ogóle warto pobrać.
    sql`
      SELECT * FROM events
      WHERE data = ${today}
         OR (powtarzanie IS NOT NULL AND data <= ${today}::date
             AND (powtarzanie_do IS NULL OR powtarzanie_do >= ${today}::date))
      ORDER BY godzina ASC NULLS LAST;
    ` as unknown as Promise<HubEvent[]>,
    sql`SELECT * FROM notes ORDER BY updated_at DESC LIMIT 5;` as unknown as Promise<Note[]>,
    sql`
      SELECT i.*,
        COALESCE(t.netto, 0)::float8 AS netto,
        COALESCE(t.vat, 0)::float8 AS vat,
        COALESCE(t.brutto, 0)::float8 AS brutto,
        COALESCE(p.zaplacono, 0)::float8 AS zaplacono
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id,
          SUM(ilosc * cena_netto * (1 - rabat_procent / 100)) AS netto,
          SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END) AS vat,
          SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
        FROM invoice_items GROUP BY invoice_id
      ) t ON t.invoice_id = i.id
      LEFT JOIN (
        SELECT invoice_id, SUM(kwota) AS zaplacono FROM invoice_payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id;
    ` as unknown as Promise<InvoiceRow[]>,
    sql`
      SELECT o.*, COALESCE(t.kwota, 0)::float8 AS kwota
      FROM offers o
      LEFT JOIN (
        SELECT offer_id, SUM(ilosc * cena) FILTER (WHERE NOT opcjonalna OR wybrana) AS kwota FROM offer_items GROUP BY offer_id
      ) t ON t.offer_id = o.id;
    ` as unknown as Promise<OfferRow[]>,
    // Moduł 31 — umowy/NDA do dwóch rzeczy naraz: ciszy po wysyłce (niżej
    // isContractStale) i wskaźnika "% projektów z podpisaną umową". Do tego
    // modułu Pulpit nie pytał bazy o umowy w ogóle, więc umowa wisząca
    // tydzień niepodpisana nie przypominała się nigdy — mimo że blokuje start
    // projektu (bramka w api/projects/[id]).
    sql`
      SELECT c.id, c.typ, c.status, c.project_id, c.client_id, c.sent_at, c.klient_nazwa,
             c.obowiazuje_do, c.wypowiedzenie_dni, c.odnawialna, c.aneks_nr, c.created_at,
             cl.nazwa AS client_nazwa
      FROM contracts c
      LEFT JOIN clients cl ON cl.id = c.client_id;
    ` as unknown as Promise<ContractRow[]>,
    // Zaplanowane kontakty nurture (Moduł 2) wymagalne dziś lub wcześniej,
    // jeszcze nieobsłużone — osobno od isClientOverdue (ręczny next_followup),
    // scalane z nim dopiero w UI (DashboardHome.tsx), żeby zachować czytelny,
    // własny powód przy każdym.
    sql`
      SELECT f.id, f.client_id, f.project_id, f.due_date, f.powod, c.nazwa AS client_nazwa
      FROM client_followups f
      JOIN clients c ON c.id = f.client_id
      WHERE f.due_date <= ${today} AND f.done_at IS NULL
      ORDER BY f.due_date ASC;
    ` as unknown as Promise<
      { id: string; client_id: string; project_id: string | null; due_date: string; powod: string; client_nazwa: string }[]
    >,
    sql`SELECT * FROM company_settings WHERE id = 'default';` as unknown as Promise<CompanySettings[]>,
    // Moduł 4 — "Wiadomości do odpowiedzi": każdy przychodzący mail jest do
    // obsłużenia, dopóki nie odpiszesz albo go nie odhaczysz. Wyciszone
    // (newslettery/no-reply) mają status 'zignorowany', więc tu nie wpadną.
    // Bez body_html/body_text — Pulpit pokazuje tylko nadawcę i temat.
    sql`
      SELECT m.id, m.from_addr, m.from_name, m.subject, m.received_at,
             c.nazwa AS client_nazwa, l.firma AS lead_nazwa
      FROM mail_messages m
      LEFT JOIN clients c ON c.id = m.client_id
      LEFT JOIN leads l ON l.id = m.lead_id
      WHERE m.status = 'nowy' AND m.kierunek = 'in'
        -- Wyciszony wątek (Faza 8) nie wypływa na Pulpit. Pominięcie tego
        -- warunku tutaj byłoby cichą dziurą: wątek zniknąłby z licznika
        -- w Poczcie, a dalej wracał na ekran główny.
        AND NOT EXISTS (SELECT 1 FROM mail_muted_threads mt WHERE mt.thread_id = m.thread_id)
      ORDER BY m.received_at DESC;
    ` as unknown as Promise<
      { id: string; from_addr: string; from_name: string; subject: string; received_at: string; client_nazwa: string | null; lead_nazwa: string | null }[]
    >,
  ]);

  const overdueLeads = leads.filter(isOverdue);
  const overdueClients = clients.filter(isClientOverdue);
  const dueProjects = projects.filter(isProjectOverdue);
  // Proforma nie jest dokumentem fiskalnym — nie liczy się do żadnego KPI (patrz lib/invoices.ts).
  const realInvoices = invoices.filter((i) => i.typ_dokumentu !== "proforma");
  const overdueInvoices = realInvoices.filter(isInvoiceOverdue);
  const expiredOffers = offers.filter(isOfferExpired);
  // Oferty, w których zapadła cisza (runda 2 Modułu 57). Do tej pory Pulpit
  // upominał się dopiero o ofertę PO TERMINIE — czyli wtedy, gdy było już za
  // późno na rozmowę. Tu chodzi o moment wcześniejszy: wysłana, brak decyzji.
  // Kolejność: najdłuższa cisza na górze, a otwarte przez klienta przed
  // nieotwartymi (te pierwsze są cieplejsze — ktoś dokument widział).
  const staleOffers = offers
    .filter((o) => isOfferStale(o) && !isOfferExpired(o))
    .map((o) => ({ ...o, silenceDays: offerSilenceDays(o) ?? 0 }))
    .sort((a, b) => {
      if (!!a.otwarta_at !== !!b.otwarta_at) return a.otwarta_at ? -1 : 1;
      return b.silenceDays - a.silenceDays;
    });
  // Moduł 31 — umowy/NDA wysłane i niepodpisane od tygodnia. Dni ciszy liczone
  // raz tutaj, nie w UI: DashboardHome i dzienny mail pokazują tę samą liczbę.
  const staleContracts = contracts
    .filter((c) => isContractStale(c))
    .map((c) => ({ ...c, silenceDays: contractSilenceDays(c) ?? 0 }))
    .sort((a, b) => b.silenceDays - a.silenceDays);

  // Krok 4, znalezisko B4 — dokument ZACZĘTY i zapomniany, w odróżnieniu od
  // wysłanego i niepodpisanego (tym zajmuje się `staleContracts` wyżej — i JUŻ
  // dziś łapie aneksy, bo nie filtruje po `typ`). Bliźniak `draftInvoices`
  // niżej; wiek liczony raz tutaj, żeby Pulpit, apka i dzienny mail mówiły tę
  // samą liczbę.
  const zapomnianeSzkiceUmow = contracts
    .filter((c) => isContractForgottenDraft(c, today))
    .map((c) => ({ ...c, draftAgeDays: contractDraftAgeDays(c, today) }))
    .sort((a, b) => b.draftAgeDays - a.draftAgeDays);

  // Krok 4, znalezisko B2 — projekt oznaczony ręcznie jako zagrożony/zerwany.
  // Osobno od `dueProjects`: zerwać projekt można na długo PRZED terminem
  // (w drugim przejściu termin był 49 dni w przyszłości), więc lista „po
  // terminie" nie łapie go z definicji.
  const projektyZagrozone = projects.filter(isProjectAtRisk);

  // Umowy dobiegające końca (2026-07-27) — rdzeń CLM, którego panel nie miał:
  // dokument znał termin REALIZACJI (kiedy kończy się praca), a nie koniec
  // obowiązywania. Umowa utrzymaniowa odnawiała się albo wygasała bez niczyjej
  // wiedzy. Przy umowie ODNAWIALNEJ liczy się ostatni dzień na wypowiedzenie,
  // nie sama data końca — po nim alert jest już bezużyteczny (patrz
  // dniDoDzialaniaUmowy). Powód pisze lib, żeby Pulpit, mail i apka mówiły
  // jedno zdanie.
  const wygasajaceUmowy = contracts
    .filter((c) => c.typ === "umowa" && umowaDoOdnowienia(c, today))
    .map((c) => ({
      id: c.id,
      klient_nazwa: c.klient_nazwa,
      client_nazwa: (c as { client_nazwa?: string | null }).client_nazwa ?? null,
      client_id: c.client_id,
      obowiazuje_do: c.obowiazuje_do,
      odnawialna: c.odnawialna,
      dniDoDzialania: dniDoDzialaniaUmowy(c, today) ?? 0,
      powod: powodOdnowienia(c, today),
    }))
    .sort((a, b) => a.dniDoDzialania - b.dniDoDzialania);

  // Faktury-szkice czekające na wystawienie — robota zrobiona, ale dokument
  // nigdy nie dostał numeru (a więc: nie liczy się do przychodu i nikt za
  // niego nie zapłaci). Nagabujemy tylko o szkice właściwych faktur (nie
  // proform/zaliczkowych), które mają jakąkolwiek treść i NIE powstały dziś —
  // żeby faktura, którą właśnie edytujesz, nie wyskakiwała od razu jako
  // „zaległa". Najczęstsze źródło: szkic utworzony automatycznie z
  // zaakceptowanej oferty albo z szablonu cyklicznego.
  const draftInvoices = invoices.filter(
    (i) =>
      i.status === "Szkic" &&
      i.typ_dokumentu === "faktura" &&
      i.brutto > 0 &&
      String(i.created_at ?? "").slice(0, 10) < today
  );

  // Przychód wg daty wystawienia (nie wg wpłat — wpłaty częściowe są opcjonalne
  // i nie każda opłacona faktura ma zarejestrowaną wpłatę).
  const revenueThisMonth = new Map<string, number>();
  const revenueLastMonth = new Map<string, number>();
  // Rezerwa podatkowa (Moduł 13) liczona TYLKO z faktur w PLN — stawki
  // podatkowe (VAT/PIT/ZUS) i tak rozliczane są w PLN, a przeliczanie obcych
  // walut po kursie NBP na potrzeby samego poglądowego wskaźnika byłoby
  // niepotrzebną komplikacją (dokładny kurs VAT liczy już `kurs_nbp` na
  // fakturze, ale to osobny, węższy mechanizm — patrz lib/ksef.ts).
  let nettoThisMonthPln = 0;
  for (const inv of realInvoices) {
    if (inv.status === "Anulowana" || inv.status === "Szkic") continue;
    if (!inv.data_wystawienia) continue;
    const month = String(inv.data_wystawienia).slice(0, 7);
    const currency = inv.waluta || "PLN";
    if (month === thisMonth) {
      addToCurrencyMap(revenueThisMonth, currency, inv.brutto);
      if (currency === "PLN") nettoThisMonthPln += inv.netto;
    } else if (month === lastMonth) {
      addToCurrencyMap(revenueLastMonth, currency, inv.brutto);
    }
  }
  const companySettings = companySettingsRows[0] ?? null;
  const taxReserve = companySettings ? taxReserveBreakdown(nettoThisMonthPln, companySettings) : { vat: 0, pit: 0, zus: 0 };

  const outstanding = new Map<string, number>();
  for (const inv of overdueInvoices) {
    addToCurrencyMap(outstanding, inv.waluta || "PLN", inv.brutto - inv.zaplacono);
  }

  // Wartość pipeline'u — oferty jeszcze nie zamknięte (oferty są wyłącznie w PLN, bez pola waluty),
  // ważona szacowanym prawdopodobieństwem zamknięcia wg statusu (patrz OFFER_STATUS_WEIGHT).
  // Zastąpione wersje poza pipeline'em — patrz offerLiczySieDoStatystyk.
  const pipeline = offers
    .filter(offerLiczySieDoStatystyk)
    .reduce((sum, o) => sum + weightedOfferValue(o.status, o.kwota), 0);
  // Surowa (nieważona) suma otwartych ofert — do podpisu KPI, dla przejrzystości.
  const pipelineRaw = offers.reduce((sum, o) => (CLOSED_OFFER_STATUSES.has(o.status) ? sum : sum + o.kwota), 0);

  // Moduł 15 (zamknięcie i opinie): średnia z ocen zebranych opinii + jaki
  // odsetek zamkniętych projektów w ogóle ma zebraną opinię (patrz "Monitorować"
  // w docs/plany-modulow/15-zamkniecie-i-opinie.md).
  // % leadów ze źródła "Polecenie" (Moduł 17/18 liczą to już w Statystykach,
  // ale tylko tam — Pulpit o pętli retencji milczał całkowicie, mimo że dane
  // były już pobrane w tym samym zapytaniu co `leads` wyżej). Świadomie po
  // WSZYSTKICH leadach w bazie (nie tylko zaległych) — to wskaźnik zdrowia
  // lejka, nie sprawa do dzisiejszej obsługi.
  const referralLeads = leads.filter((l) => l.zrodlo_kategoria === "Polecenie").length;
  const referralSharePct = leads.length > 0 ? Math.round((referralLeads / leads.length) * 1000) / 10 : null;

  const closedProjects = projects.filter((p) => p.status === "Wdrożone");
  const reviewedProjects = projects.filter((p) => p.review_submitted_at);
  const reviewAverages = reviewedProjects.map(projectReviewAverage).filter((v): v is number => v != null);
  const avgClientRating = reviewAverages.length ? reviewAverages.reduce((a, b) => a + b, 0) / reviewAverages.length : null;

  // Stan kopii zapasowych (2026-07-20). Osobne, TANIE zapytanie po głównym
  // agregacie — kilkanaście wierszy z indeksu. Świadomie NIE w Promise.all
  // wyżej: gdyby ta tabela z jakiegoś powodu nie istniała, nie ma prawa
  // wywrócić całego Pulpitu. Kopie są ważne, ale nie ważniejsze niż to,
  // co właściciel ma dziś do zrobienia.
  let backup = null;
  try {
    // Druga szansa dla odczytu (2026-07-25) — ta sama poprawka co w dziennym
    // raporcie: przejściowy błąd bazy nie ma prawa udawać awarii kopii.
    const runs = await zPonowieniem(async () => {
      await ensureBackupSchema();
      return (await sql`
        SELECT id, ok, host, powod, tabel, rozmiar_bajtow, trwalo_sekund, created_at
        FROM backup_runs ORDER BY created_at DESC LIMIT 20;
      `) as unknown as BackupRun[];
    });
    backup = ocenKopie(runs);
  } catch (e) {
    console.error("[GET /api/hub/today] nie udało się odczytać stanu kopii zapasowych", e);
    await zapiszWyjatek("kopie", "Nie udało się odczytać stanu kopii zapasowych (Pulpit)", e);
  }

  // Stan automatów (Audyt 4, 2026-07-22) — ta sama ostrożność co przy kopiach:
  // osobne, tanie zapytanie w try/catch, bo nadzór nie może wywrócić Pulpitu.
  // Wysyłamy TYLKO to, co wymaga uwagi: Pulpit jest ekranem „co dziś zrobić",
  // a nie tablicą kontrolną. Pełną listę, także zdrową, pokazuje dzienny mail.
  let automaty: StanAutomatu[] = [];
  try {
    automaty = (await stanAutomatow()).filter(wymagaUwagi);
  } catch (e) {
    console.error("[GET /api/hub/today] nie udało się odczytać stanu automatów", e);
    await zapiszWyjatek("nadzor", "Nie udało się odczytać stanu automatów (Pulpit)", e);
  }

  // Propozycje (Faza 3) — ta sama ostrożność co przy kopiach i automatach:
  // osobno, w try/catch. Świadomie liczone TU, a nie tylko w /api/hub/propozycje:
  // inaczej kafel „Wymaga działania dziś" pokazywałby mniej spraw, niż widać
  // niżej na ekranie. Logika jest jedna (lib/propozycje.ts), wołana dwa razy —
  // to nie to samo co dwie kopie reguł.
  let propozycje: StanPropozycji = { propozycje: [], odrzuconych: 0 };
  try {
    propozycje = await zbierzPropozycje();
  } catch (e) {
    console.error("[GET /api/hub/today] nie udało się zebrać propozycji", e);
    await zapiszWyjatek("propozycje", "Nie udało się zebrać propozycji (Pulpit)", e);
  }

  return NextResponse.json({
    backup,
    automaty,
    propozycje,
    overdueLeads,
    overdueClients,
    dueProjects,
    projektyZagrozone,
    overdueInvoices,
    draftInvoices,
    zapomnianeSzkiceUmow,
    overdueMilestones,
    expiredOffers,
    staleOffers,
    staleContracts,
    wygasajaceUmowy,
    dueFollowups,
    pendingMails,
    todayEvents: rozwinSerieWydarzen(todayEvents, today, today),
    recentNotes,
    kpi: {
      revenueThisMonth: Array.from(revenueThisMonth.entries()),
      revenueLastMonth: Array.from(revenueLastMonth.entries()),
      outstanding: Array.from(outstanding.entries()),
      pipeline,
      pipelineRaw,
      taxReserve,
      avgClientRating,
      // Moduł 31 — miara Etapu 3 z mapy drogi klienta (cel: 100%). `null` gdy
      // nie ma ani jednego projektu z klientem — patrz signedContractRate.
      signedContracts: signedContractRate(projects, contracts),
      reviewsCollected: reviewedProjects.length,
      closedProjectsCount: closedProjects.length,
      referralSharePct,
    },
    counts: {
      leads: leads.length,
      clients: clients.length,
      projects: projects.length,
      invoices: invoices.length,
      offers: offers.length,
    },
  });
}
