/**
 * Lokalna baza deweloperska (PGlite = Postgres w WASM, w procesie).
 *
 * Używana WYŁĄCZNIE gdy NODE_ENV=development i brak connection stringa do
 * prawdziwej bazy — patrz getSql() w db.ts. Nigdy na produkcji. Dzięki temu
 * `npm run dev` daje w pełni działający panel z danymi bez podłączania Neona,
 * bez Vercel CLI i bez ryzyka tknięcia produkcyjnych danych. Mówi prawdziwym
 * SQL-em, więc wszystkie route'y i migracje (`CREATE TABLE IF NOT EXISTS`)
 * działają bez zmian.
 *
 * Adapter naśladuje sygnaturę taga neon-a: `sql\`SELECT ... ${x}\`` → Promise<
 * rows[]>. Daty (DATE/TIMESTAMP) zwracamy jako stringi, tak jak robi to
 * neonowy klient HTTP — inaczej `parseDate`/`formatPlDate` dostałyby obiekty
 * Date i się wywaliły.
 */
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { isInMigration } from "./migration-ctx";

type Row = Record<string, unknown>;
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

let db: PGlite | null = null;
let seedPromise: Promise<void> | null = null;

function getDb(): PGlite {
  if (!db) {
    db = new PGlite({
      // Zwracaj daty jako surowe stringi (jak neon), nie obiekty Date.
      parsers: {
        1082: (v: string) => v, // date
        1114: (v: string) => v, // timestamp
        1184: (v: string) => v, // timestamptz
      },
    });
  }
  return db;
}

/** Surowe zapytanie do PGlite — bez czekania na seed. Używane wewnętrznie
 * przez seeder i przez publiczny tag po wykonaniu seeda. */
async function raw(text: string, params: unknown[]): Promise<Row[]> {
  const res = await getDb().query(text, params);
  return res.rows as Row[];
}

/** Zamienia tagged-template neon-a na sparametryzowane zapytanie Postgresa
 * ($1, $2, …), które rozumie PGlite. */
function buildQuery(strings: TemplateStringsArray, values: unknown[]): { text: string; params: unknown[] } {
  let text = "";
  strings.forEach((part, i) => {
    text += part;
    if (i < values.length) text += `$${i + 1}`;
  });
  return { text, params: values };
}

function isDDL(text: string): boolean {
  return /^\s*(CREATE|ALTER|DROP)\b/i.test(text);
}

const day = 86400000;
function iso(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
}

/** Wypełnia dev-bazę realistycznymi danymi RAZ — dopiero po tym, jak schemat
 * już istnieje (tworzą go migracje aplikacji przez getSql()). */
async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      // Schemat tworzą migracje aplikacji, ale seeder może odpalić się jako
      // pierwszy — więc na wszelki wypadek importujemy i uruchamiamy je tu.
      const { ensureLeadsSchema, ensureHubSchema, ensureClientsSchema, ensureMailSchema, ensureFollowupsSchema } =
        await import("./db");
      await ensureLeadsSchema();
      await ensureHubSchema();
      await ensureClientsSchema();
      await ensureMailSchema();
      // Followupy mają WŁASNY schemat, nieciągnięty przez pozostałe — bez tego
      // seed kontaktu nurture niżej wywala się na nieistniejącej tabeli.
      await ensureFollowupsSchema();

      const existing = await raw("SELECT COUNT(*)::int AS n FROM projects", []);
      if ((existing[0]?.n as number) > 0) return; // już zaseedowane

      // — Leady —
      const leadA = randomUUID();
      const leadB = randomUUID();
      await raw(
        // `ostatni_kanal` (Moduł 34): dwa RÓŻNE kanały świadomie — odznaka kanału
        // na liście jest teraz klikalnym filtrem, a przy jednym kanale (albo przy
        // NULL-ach, jak było do 2026-07-17) nie da się lokalnie zobaczyć ani
        // odznaki, ani tego, że filtr faktycznie odsiewa.
        `INSERT INTO leads (id, firma, osoba_kontaktowa, branza, telefon, email, www, miasto, zrodlo_kategoria, zrodlo, status, ostatni_kontakt, ostatni_kanal, notatki)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14),($15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
        [
          leadA, "Kancelaria Kowalski", "Marek Kowalski", "Prawo", "600100200", "biuro@kowalski.pl", "kowalski.pl", "Warszawa", "Polecenie", "", "Rozmowa umówiona", iso(-2), "telefon", "Zainteresowani automatyzacją umów.",
          leadB, "Piekarnia Złoty Kłos", "", "Gastronomia", "500300400", "kontakt@zlotyklos.pl", "zlotyklos.pl", "Wilanów", "Formularz na stronie", "", "Nowe zgłoszenie ze strony", iso(-6), "email", "",
        ]
      );

      // — Projekty (z datami i kamieniami milowymi — żeby oś czasu żyła) —
      const projects = [
        { tytul: "Website", zdrowie: "Na dobrej drodze", priorytet: "Wysoki", start: iso(-8), termin: iso(40), lead: leadA,
          milestones: [ ["Discovery", iso(2)], ["Design", iso(18)], ["Wdrożenie", iso(34)] ] },
        { tytul: "Leggera Source", zdrowie: "Zagrożony", priorytet: "Normalny", start: iso(-1), termin: iso(55), lead: null,
          milestones: [ ["MVP scraper", iso(14)], ["Integracja API", iso(38)] ] },
        { tytul: "Leggera Flow", zdrowie: "Na dobrej drodze", priorytet: "Niski", start: iso(20), termin: iso(70), lead: null,
          milestones: [ ["Model procesu", iso(35)] ] },
      ];
      // Identyfikatory projektów zbieramy, bo zależność (niżej) potrzebuje
      // DWÓCH istniejących projektów — inaczej nie ma czego wskazać.
      const projectIds: string[] = [];
      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        const pid = randomUUID();
        projectIds.push(pid);
        await raw(
          `INSERT INTO projects (id, tytul, opis, status, priorytet, zdrowie, start, termin, lead_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [pid, p.tytul, "Opis przykładowego projektu — dev seed.", "W trakcie", p.priorytet, p.zdrowie, p.start, p.termin, p.lead]
        );
        for (let m = 0; m < p.milestones.length; m++) {
          await raw(
            `INSERT INTO project_milestones (id, project_id, nazwa, termin, position) VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), pid, p.milestones[m][0], p.milestones[m][1], m]
          );
        }
        // Parę zadań, żeby pasek postępu na kartach kanbana coś pokazywał.
        for (let t = 0; t < 4; t++) {
          await raw(
            `INSERT INTO project_tasks (id, project_id, text, done, position) VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), pid, `Zadanie ${t + 1}`, t < 2, t]
          );
        }
      }

      // — Onboarding, zasoby i zależność (paczka 2 apki natywnej) —
      // Te trzy tabele NIE BYŁY seedowane do 2026-07-20, przez co sekcja
      // „Zasoby" w `ProjektDetailView.swift` — istniejąca od Fazy 5 — była
      // lokalnie ZAWSZE pusta, a onboardingu i zależności nie dało się
      // obejrzeć w ogóle. Dokładnie ten sam błąd, co z kontaktami nurture
      // w paczce 1: funkcja oddana bez wiersza, który by ją pokazał.
      {
        const [pierwszy, drugi] = projectIds;

        // Onboarding pierwszego projektu: część odhaczona, część nie —
        // inaczej nie widać różnicy między stanem zrobionym a otwartym.
        const onboardingItems: [string, boolean][] = [
          ["Dostępy do hostingu", true],
          ["Materiały od klienta (logo, teksty)", true],
          ["Zakres i harmonogram potwierdzone mailem", false],
          ["Kanał komunikacji ustalony", false],
        ];
        for (let i = 0; i < onboardingItems.length; i++) {
          await raw(
            `INSERT INTO project_onboarding_items (id, project_id, tekst, done, position) VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), pierwszy, onboardingItems[i][0], onboardingItems[i][1], i]
          );
        }

        // Zasoby — dwa linki, żeby sekcja miała więcej niż jeden wiersz
        // (przy jednym nie widać, czy kolejność i gest kasowania działają).
        const zasoby: [string, string][] = [
          ["Makiety w Figmie", "https://figma.com/file/dev-seed"],
          ["Dokument zakresu", "https://docs.google.com/document/d/dev-seed"],
        ];
        for (let i = 0; i < zasoby.length; i++) {
          await raw(
            `INSERT INTO project_resources (id, project_id, etykieta, url, position) VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), pierwszy, zasoby[i][0], zasoby[i][1], i]
          );
        }

        // Zależność: „Leggera Source" czeka na „Website". Kierunek zgodny
        // z trasą: project_id ZALEŻY OD depends_on_id (poprzednika).
        if (drugi) {
          await raw(
            `INSERT INTO project_dependencies (id, project_id, depends_on_id) VALUES ($1,$2,$3)`,
            [randomUUID(), drugi, pierwszy]
          );
        }
      }

      // — Wpisy czasu pracy (dla Statystyk / paczka 3) —
      // Bez nich KPI „Godziny pracy" jest 0, a sparkline pusty — nie dałoby się
      // obejrzeć ani wskaźnika, ani wykresu trendu. Rozłożone na DWA miesiące,
      // żeby trend miał więcej niż jeden punkt. `ended_at` niepuste = pomiar
      // zakończony (stats pomija działający stoper).
      {
        const czasWpisy: [number, number][] = [
          [-2, 95], [-6, 140], [-9, 60],   // bieżący miesiąc
          [-38, 120], [-45, 80],           // poprzedni miesiąc
        ];
        for (const [dni, minut] of czasWpisy) {
          // Jawne rzutowania: ten sam `$3` trafia i do DATE (`entry_date`),
          // i do TIMESTAMPTZ (`started_at`/`ended_at`) — bez castów Postgres
          // nie wydedukuje jednego typu dla parametru i wywala 42P08, co zatruwa
          // cały seeder (pułapka z CLAUDE.md: błąd w seedzie = 500 na wszystkim).
          await raw(
            `INSERT INTO time_entries (id, project_id, source, entry_date, started_at, ended_at, minutes, note)
             VALUES ($1,$2,'manual',$3::date,$3::timestamptz,$3::timestamptz,$4,'dev seed')`,
            [randomUUID(), projectIds[0], iso(dni), minut]
          );
        }
      }

      // — Umowa wisząca bez podpisu (Moduł 31) —
      // Bez tego sekcji „Umowy czekające na podpis" na Pulpicie i w dziennym
      // mailu NIE DA SIĘ zobaczyć lokalnie: seed nie miał ani jednej umowy, a
      // `sent_at` ustawia wyłącznie wysyłka mailem (której w dev nie ma).
      // Dwanaście dni ciszy = powyżej progu CONTRACT_STALE_DAYS (7).
      // `client_id` dopina się niżej, przy kliencie — tu go jeszcze nie ma.
      const contractStale = randomUUID();
      {
        const { ensureContractsSchema } = await import("./db");
        await ensureContractsSchema();
        await raw(
          `INSERT INTO contracts (id, typ, status, klient_nazwa, klient_email, zakres_prac, cena, sent_at)
           VALUES ($1,'umowa','Wysłana',$2,$3,$4,$5, now() - interval '12 days')`,
          [contractStale, "Nordwind Studio", "anna@nordwind.pl", "Wdrożenie panelu zamówień — dev seed.", 18000]
        );
      }

      // — Faktury i oferty (Faza 10 apki natywnej) —
      // Bez tego apka pokazywałaby lokalnie wyłącznie puste ekrany „Brak
      // faktur"/„Brak ofert" — nie dałoby się obejrzeć list, filtrów
      // (nieopłacone/po terminie), pozycji ani stanu wpłat.
      {
        const { ensureInvoicesSchema, ensureOffersSchema } = await import("./db");
        await ensureInvoicesSchema();
        await ensureOffersSchema();

        // Wystawiona, po terminie, bez wpłaty — trafia do filtrów
        // „Nieopłacone" I „Po terminie" naraz.
        const invPoTerminie = randomUUID();
        await raw(
          `INSERT INTO invoices (id, numer, klient_nazwa, klient_email, data_wystawienia, termin_platnosci, status, waluta)
           VALUES ($1,'FV 3/2026','Nordwind Studio','anna@nordwind.pl',$2,$3,'Po terminie','PLN')`,
          [invPoTerminie, iso(-30), iso(-10)]
        );
        await raw(
          `INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
           VALUES ($1,$2,'Wdrożenie panelu zamówień — etap 1',1,'szt.',5000,'23',0)`,
          [randomUUID(), invPoTerminie]
        );

        // Wystawiona, termin jeszcze nie minął, częściowa wpłata — testuje
        // „Pozostało" i to, że przycisk „Oznacz jako opłaconą" liczy resztę,
        // nie całość.
        const invCzesciowo = randomUUID();
        await raw(
          `INSERT INTO invoices (id, numer, klient_nazwa, klient_email, data_wystawienia, termin_platnosci, status, waluta)
           VALUES ($1,'FV 4/2026','Baltic Retail sp. z o.o.','ksiegowosc@baltic-retail.pl',$2,$3,'Wystawiona','PLN')`,
          [invCzesciowo, iso(-5), iso(9)]
        );
        await raw(
          `INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
           VALUES ($1,$2,'Automatyzacja raportów miesięcznych',1,'szt.',8000,'23',0)`,
          [randomUUID(), invCzesciowo]
        );
        await raw(
          `INSERT INTO invoice_payments (id, invoice_id, kwota, data) VALUES ($1,$2,3000,$3)`,
          [randomUUID(), invCzesciowo, iso(-2)]
        );

        // Opłacona w całości — znika z „Nieopłacone", zostaje tylko na
        // „Wszystkie"; testuje, że „Oznacz jako opłaconą" się chowa.
        // Ma też `ksef_status='przyjeto'` — jedyny sposób na obejrzenie
        // plakietki KSeF bez realnej wysyłki (ta trasa nie idzie przez
        // PATCH, więc inaczej nie dałoby się tego zobaczyć w dev-seedzie).
        // `project_id` = pierwszy projekt („Website"): bez tego RENTOWNOŚĆ
        // projektu (przychód − koszty) jest zawsze 0 i sekcji w apce nie da się
        // obejrzeć. Ta faktura daje przychód netto 6×350 = 2100 zł.
        const invOplacona = randomUUID();
        await raw(
          `INSERT INTO invoices (id, numer, klient_nazwa, klient_email, data_wystawienia, termin_platnosci, status, waluta, ksef_status, project_id)
           VALUES ($1,'FV 2/2026','Studio Kreska','biuro@studiokreska.pl',$2,$3,'Opłacona','PLN','przyjeto',$4)`,
          [invOplacona, iso(-40), iso(-26), projectIds[0]]
        );
        await raw(
          `INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
           VALUES ($1,$2,'Konsultacja AI-automation',6,'godz.',350,'23',0)`,
          [randomUUID(), invOplacona]
        );
        await raw(
          `INSERT INTO invoice_payments (id, invoice_id, kwota, data) VALUES ($1,$2,2583,$3)`,
          [randomUUID(), invOplacona, iso(-38)]
        );

        // Oferta wysłana, ważna — testuje wysyłkę i link publicznego podglądu.
        const ofertaOtwarta = randomUUID();
        await raw(
          `INSERT INTO offers (id, tytul, klient_nazwa, klient_email, wazna_do, status)
           VALUES ($1,'Oferta — wdrożenie asystenta AI','Nordwind Studio','anna@nordwind.pl',$2,'Wysłana')`,
          [ofertaOtwarta, iso(14)]
        );
        await raw(
          `INSERT INTO offer_items (id, offer_id, nazwa, ilosc, jednostka, cena, position)
           VALUES ($1,$2,'Wdrożenie lokalnego modelu do obsługi zgłoszeń',1,'szt.',12000,0)`,
          [randomUUID(), ofertaOtwarta]
        );

        // Oferta wysłana, ale ważność minęła — testuje odznakę „po terminie
        // ważności" bez zmiany statusu (`isOfferExpired()` liczy to z daty,
        // nie ze statusu).
        const ofertaWygasla = randomUUID();
        await raw(
          `INSERT INTO offers (id, tytul, klient_nazwa, klient_email, wazna_do, status)
           VALUES ($1,'Oferta — automatyzacja fakturowania','Baltic Retail sp. z o.o.','ksiegowosc@baltic-retail.pl',$2,'Wysłana')`,
          [ofertaWygasla, iso(-3)]
        );
        await raw(
          `INSERT INTO offer_items (id, offer_id, nazwa, ilosc, jednostka, cena, position)
           VALUES ($1,$2,'Integracja KSeF',1,'szt.',6000,0)`,
          [randomUUID(), ofertaWygasla]
        );

        // — Koszty (faktury kosztowe) — jeden nieopłacony, jeden opłacony,
        // do przetestowania „Oznacz jako opłacony" w apce.
        //
        // BEZ `ensureCostsSchema()` tu poniżej ten INSERT rzuca „relation
        // costs does not exist" przy niekorzystnej kolejności żądań (gdy
        // seeder odpala się PRZED tym, jak cokolwiek inne zdąży stworzyć tę
        // tabelę) — a rzucony błąd zatruwa `seedPromise` na stałe, więc
        // WSZYSTKIE trasy API (nie tylko koszty) zaczynają zwracać 500,
        // dopóki proces się nie zrestartuje. Złapane na własnej skórze
        // 2026-07-20: curl od razu po edycji wyglądał na sukces (kolejność
        // akurat sprzyjała), a chwilę później wszystko się posypało.
        const { ensureCostsSchema } = await import("./db");
        await ensureCostsSchema();
        // Załącznik (mały, poprawny PDF „faktury kosztowej") wpięty do jednego
        // kosztu, żeby dało się LOKALNIE obejrzeć podgląd w apce. Bez wiersza
        // z `zalacznik_dane` trasa `GET /api/costs/:id/attachment` zwraca 404
        // i nie ma czego stuknąć — dokładnie ta luka „funkcja bez danych",
        // która wracała w tej fazie. Na produkcji załączniki wgrywa właściciel
        // ze zdjęcia paragonu; ten seed tylko udowadnia, że podgląd działa.
        const kosztPdfB64 =
          "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzNjAgMjQwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAxODQgPj4Kc3RyZWFtCkJUIC9GMSAyMCBUZiA0MCAxNzAgVGQgKEZha3R1cmEga29zenRvd2EpIFRqIDAgLTMwIFRkIC9GMSAxMyBUZiAoU2Vyd2VyeSBzcC4geiBvLm8uKSBUaiAwIC0yMiBUZCAoTmV0dG86IDI0OSwwMCB6bCAgQnJ1dHRvOiAzMDYsMjcgemwpIFRqIDAgLTIyIFRkIChkZXYgc2VlZCAtIHBvZGdsYWQgemFsYWN6bmlrYSkgVGogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDA0NzYgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo1NDYKJSVFT0Y=";
        await raw(
          `INSERT INTO costs (id, dostawca_nazwa, dostawca_nip, kategoria, numer_faktury, data_wydatku, kwota_netto, vat_stawka, kwota_brutto, status, zalacznik_nazwa, zalacznik_typ, zalacznik_dane)
           VALUES ($1,'Serwery sp. z o.o.','5261234567','Subskrypcje','FS/2026/07/0088',$2,249,'23',306.27,'Nieopłacony','faktura-serwery.pdf','application/pdf',$3)`,
          [randomUUID(), iso(-4), kosztPdfB64]
        );
        // `project_id` = „Website": koszt netto 600 zł podpięty do projektu,
        // żeby rentowność pokazała zysk 2100 − 600 = 1500 zł, a nie sam przychód.
        // `ksef_numer` + `ksef_tryb='test'`: koszt „pobrany z KSeF" — bez tego
        // plakietki „z KSeF" na liście i w profilu nie da się obejrzeć lokalnie
        // (import KSeF wymaga realnego połączenia z systemem, którego w dev nie
        // ma). Numer w formacie zbliżonym do prawdziwego (NIP-data-losowe-suma).
        await raw(
          `INSERT INTO costs (id, dostawca_nazwa, dostawca_nip, kategoria, numer_faktury, data_wydatku, kwota_netto, vat_stawka, kwota_brutto, status, data_platnosci, project_id, ksef_numer, ksef_tryb)
           VALUES ($1,'Biuro Rachunkowe Klarowni','7791234567','Usługi','FV/22/2026',$2,600,'23',738,'Opłacony',$3,$4,'7791234567-20260705-6F3A1B2C4D-9E','test')`,
          [randomUUID(), iso(-15), iso(-13), projectIds[0]]
        );
      }

      // — Notatki —
      await raw(
        `INSERT INTO notes (id, tytul, tresc, tagi) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)`,
        [
          randomUUID(), "Pomysł: newsletter", "Cotygodniowy mail z case studies.", "marketing, pomysł",
          randomUUID(), "Do przemyślenia: cennik", "Może pakiet founding partner?", "biznes",
        ]
      );

      // — Wydarzenia (dziś + w tym miesiącu) —
      // Trzy kształty, których kalendarz w apce MUSI nie pomylić: z godziną
      // i czasem trwania, całodniowe (`godzina` NULL) oraz wielodniowe
      // (`data_koniec` — musi być widoczne w każdym dniu zakresu, także gdy
      // zaczyna się w poprzednim miesiącu).
      await raw(
        `INSERT INTO events (id, tytul, opis, data, godzina, data_koniec, czas_trwania_min) VALUES
           ($1,$2,$3,$4,'10:00',NULL,45),
           ($5,$6,$7,$8,'14:30',NULL,90),
           ($9,$10,$11,$12,NULL,NULL,NULL),
           ($13,$14,$15,$16,NULL,$17,NULL)`,
        [
          randomUUID(), "Call z klientem", "Omówienie zakresu pilotażu.", iso(0),
          randomUUID(), "Demo produktu", "", iso(3),
          randomUUID(), "Deadline: wysłać ofertę", "Całodniowe — bez godziny.", iso(1),
          randomUUID(), "Urlop", "Wielodniowe — sprawdza rozwijanie zakresu.", iso(-2), iso(2),
        ]
      );

      // — Klient (Moduł 4: bez klienta nie da się lokalnie sprawdzić
      //   dopasowania maila po adresie ani wpisu na osi kontaktu) —
      const clientA = randomUUID();
      await raw(
        // `ostatni_kanal` (Moduł 34) — jak w seedzie leadów wyżej: bez tego
        // klikalna odznaka kanału na liście klientów jest lokalnie niewidoczna.
        // Świadomie INNY kanał niż leady (whatsapp), żeby było widać, że ikona
        // marki czyta się w monochromie, i żeby filtr miał co odsiewać.
        // NIP celowo TAKI SAM jak dostawca kosztu „Serwery sp. z o.o."
        // (5261234567) — żeby dało się lokalnie zobaczyć AUTO-PODPOWIEDŹ klienta
        // na koszcie (dopasowanie po NIP, `matchClientForOrphan`). Bez pasującego
        // NIP-u banner „To chyba klient…" nigdy by się nie pokazał.
        `INSERT INTO clients (id, nazwa, nip, osoba_kontaktowa, email, telefon, status, ostatni_kontakt, ostatni_kanal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [clientA, "Nordwind Studio", "5261234567", "Anna Nowak", "anna@nordwind.pl", "601202303", "Aktywny", iso(-3), "whatsapp"]
      );
      // Moduł 31 — dopięcie umowy do klienta, dopiero teraz, bo klient
      // powstaje po niej. Dzięki temu sekcja „Umowy i NDA" na karcie klienta
      // też ma co pokazać w dev.
      await raw(`UPDATE contracts SET client_id = $1 WHERE id = $2`, [clientA, contractStale]);

      // Podpięcie klienta do projektu „Website" — dopiero teraz, bo klient
      // powstaje po projektach. Bez tego profil projektu w apce nie ma linku
      // „Klient →" do czego prowadzić (i nie widać uprzedzenia o bramce umowy,
      // która włącza się dopiero dla projektu z klientem).
      await raw(`UPDATE projects SET client_id = $1 WHERE id = $2`, [clientA, projectIds[0]]);

      // — Zaplanowany kontakt nurture (Moduł 2 / Moduł 17) —
      // Bez tego wiersza sekcja „Zaplanowane kontakty" na Pulpicie jest pusta
      // W KAŻDYM środowisku deweloperskim, bo followupy powstają wyłącznie
      // automatycznie: przy przejściu projektu Z KLIENTEM w status „Wdrożone",
      // z terminem +14 i +90 dni. Żeby zobaczyć je własnymi oczami, trzeba by
      // zamknąć projekt i przestawić zegar o dwa tygodnie.
      //
      // Kosztowało to jedną nieudaną weryfikację (2026-07-20): apka dostała
      // pełną obsługę kontaktów nurture, po czym ani na telefonie, ani lokalnie
      // nie było czego kliknąć — i wyglądało to na zepsutą funkcję zamiast na
      // brak danych. `due_date` w przeszłości, bo Pulpit bierze `<= dziś`.
      await raw(
        `INSERT INTO client_followups (id, client_id, project_id, due_date, powod)
         VALUES ($1,$2,$3,$4,$5)`,
        [randomUUID(), clientA, null, iso(-1), "kontakt kontrolny: referencja/opinia"]
      );

      // — Poczta (Moduł 4) —
      // Dev nie ma dostępu do skrzynki az.pl (IMAP żyje tylko na Vercelu z
      // env właściciela), więc realny sync symulujemy: wstawiamy wprost do
      // mail_messages to, co normalnie zapisałby lib/mailSync.ts. Cztery
      // wiersze pokrywają wszystkie ścieżki modułu: mail od KLIENTA (kanał
      // e-mail na osi kontaktu), od LEADA, z nieznanego adresu (kolejka
      // "Nieprzypisane" → "Utwórz leada") i newsletter (wyciszony szum).
      const mailClient = randomUUID();
      const mailLead = randomUUID();
      const mailUnknown = randomUUID();
      const mailNoise = randomUUID();
      // `thread_id` seedowany od razu jako własny `message_id` (self-rooted) —
      // reprezentuje stan "po backfillu" zamiast polegać na tym, że
      // backfillThreadIds() zdąży zadziałać przed pierwszym obejrzeniem w devie.
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, client_id, lead_id, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, received_at)
         VALUES ($1,$2,'in',$3,NULL,$4,$5,$6,$7,$8,$9,$9,'nowy',now() - interval '2 hours'),
                ($10,$11,'in',NULL,$12,$13,$14,$15,$16,$17,$18,$18,'nowy',now() - interval '1 day'),
                ($19,$20,'in',NULL,NULL,$21,$22,$23,$24,$25,$26,$26,'nowy',now() - interval '3 hours'),
                ($27,$28,'in',NULL,NULL,$29,$30,$31,$32,$33,$34,$34,'zignorowany',now() - interval '5 hours')`,
        [
          mailClient, 101, clientA, "anna@nordwind.pl", "Anna Nowak", "kontakt@leggeralabs.pl",
          "Prośba o zmianę w panelu", "Cześć, czy dałoby się dodać eksport do CSV na liście zamówień?\n\nPozdrawiam,\nAnna", "<dev-client-1@nordwind.pl>",

          mailLead, 102, leadA, "biuro@kowalski.pl", "Marek Kowalski", "kontakt@leggeralabs.pl",
          "Re: Automatyzacja umów", "Dzień dobry, wracam do tematu — kiedy moglibyśmy porozmawiać?", "<dev-lead-1@kowalski.pl>",

          mailUnknown, 103, "zapytanie@nowafirma.pl", "Tomasz Wiśniewski", "kontakt@leggeralabs.pl",
          "Zapytanie o współpracę", "Dzień dobry, szukamy kogoś do automatyzacji obiegu faktur. Czy moglibyśmy porozmawiać?", "<dev-unknown-1@nowafirma.pl>",

          // Prawdziwy przypadek zgłoszony przez właściciela 2026-07-15:
          // "noreply" jest tu NA KOŃCU lokalnej części, przez co pierwsza
          // wersja filtra (startsWith) przepuściła go jako "do odpowiedzi".
          // Zostaje w seedzie jako regresja — ma na zawsze wpadać w "reklama".
          mailNoise, 104, "jobalerts-noreply@linkedin.com", "Alerty o ofertach pracy na LinkedIn", "kontakt@leggeralabs.pl",
          "„Konsultant systemu SAP”: SAP Systemanalytiker Banking Platform (m/w/d) i więcej",
          "Twój alert o ofertach pracy na stanowisko Konsultant systemu SAP\nNowe oferty pracy pasują do Twoich preferencji.",
          "<dev-noise-1@linkedin.com>",
        ]
      );

      // Screener nowych nadawców (Moduł 4, Etap 3) — dokładnie to, co
      // saveIncoming() (lib/mailSync.ts) zapisałby dla ŚWIEŻO
      // zsynchronizowanego maila kategorii 'oferta': sam wiersz w
      // mail_messages (kategoria świadomie NIE NULL, w odróżnieniu od
      // mailUnknown wyżej — ten reprezentuje pocztę sprzed wprowadzenia
      // kategorii) + wpis 'pending' w mail_senders. Bez tego drugiego wiersza
      // bramka nie miałaby czego pokazać w "Nowi nadawcy".
      const mailScreener = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, received_at)
         VALUES ($1,106,'in',$2,$3,$4,$5,$6,$7,$7,'nowy','oferta',now() - interval '30 minutes')`,
        [
          mailScreener, "kontakt@nieznanafirma.pl", "Piotr Zieliński", "kontakt@leggeralabs.pl",
          "Zapytanie o wdrożenie",
          "Dzień dobry, natrafiłem na Państwa stronę i chciałbym zapytać o możliwość współpracy przy automatyzacji procesów.",
          "<dev-screener-1@nieznanafirma.pl>",
        ]
      );
      await raw(
        `INSERT INTO mail_senders (id, email, status) VALUES ($1,$2,'pending')`,
        [randomUUID(), "kontakt@nieznanafirma.pl"]
      );

      // Moduł 22 — DWIE wiadomości z tego samego, nieznanego adresu.
      //
      // Odwzorowuje lukę, dla której powstał ten moduł: klientka (Anna z
      // Nordwind Studio) pisze z prywatnej skrzynki, więc auto-dopasowanie
      // po równości adresu (findContactsByEmail) nie ma się o co zaczepić i
      // KAŻDA jej wiadomość ląduje w "Nieprzypisane". Dwie sztuki, bo dopiero
      // przy zaległości panel pyta "zapamiętać ten adres?" — przy jednej
      // wiadomości pytanie nie ma sensu i nie pada.
      const mailAliasA = randomUUID();
      const mailAliasB = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, received_at)
         VALUES ($1,107,'in',$2,$3,$4,$5,$6,$7,$7,'nowy','rozmowa',now() - interval '3 hours')`,
        [
          mailAliasA, "anna.nowak.prywatnie@gmail.com", "Anna Nowak", "kontakt@leggeralabs.pl",
          "Pytanie z prywatnej skrzynki",
          "Cześć, piszę z prywatnego adresu, bo służbowa poczta mi dziś nie działa. Czy zdążymy z panelem na piątek?",
          "<dev-alias-1@gmail.com>",
        ]
      );
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, received_at)
         VALUES ($1,108,'in',$2,$3,$4,$5,$6,$7,$7,'nowy','rozmowa',now() - interval '2 hours')`,
        [
          mailAliasB, "anna.nowak.prywatnie@gmail.com", "Anna Nowak", "kontakt@leggeralabs.pl",
          "Jeszcze jedno pytanie",
          "I druga sprawa — czy fakturę wystawicie na koniec miesiąca, czy po odbiorze?",
          "<dev-alias-2@gmail.com>",
        ]
      );

      // Wątkowanie (Moduł 4, Etap 3) — druga połowa wątku "Re: Automatyzacja
      // umów": to, co WYSŁALIŚMY do Marka WCZEŚNIEJ (Wysłane), na co mailLead
      // (Odebrane) jest odpowiedzią. Jedyny sposób, żeby lokalnie sprawdzić
      // pasek wątku ROZPIĘTY MIĘDZY DWOMA FOLDERAMI (Wysłane + Odebrane) — bez
      // tego wiersza cross-folder thread strip nie miałby czego pokazać w devie.
      const mailLeadOriginal = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, folder, lead_id, from_addr, to_addr, subject, body_text, message_id, thread_id, status, received_at)
         VALUES ($1,100,'out','sent',$2,$3,$4,$5,$6,$7,$7,'obsłużony',now() - interval '2 days')`,
        [
          mailLeadOriginal, leadA, "kontakt@leggeralabs.pl", "biuro@kowalski.pl",
          "Automatyzacja umów",
          "Dzień dobry, przesyłam wstępną propozycję zakresu automatyzacji obiegu umów — dajcie znać, co Państwo o niej myślicie.",
          "<dev-lead-1-original@leggeralabs.pl>",
        ]
      );
      await raw(
        `UPDATE mail_messages SET in_reply_to = $1, refs = $1, thread_id = $1 WHERE id = $2`,
        ["<dev-lead-1-original@leggeralabs.pl>", mailLead]
      );

      // Wpisy na osi kontaktu — dokładnie to, co robi logMailOnTimeline()
      // przy realnym syncu (kanał e-mail, jak telefon z Modułu 3).
      await raw(
        `INSERT INTO client_activity (id, client_id, text, kanal, kierunek, mail_message_id) VALUES ($1,$2,$3,'email','przychodzacy',$4)`,
        [randomUUID(), clientA, "Prośba o zmianę w panelu — Cześć, czy dałoby się dodać eksport do CSV na liście zamówień?", mailClient]
      );
      await raw(
        `INSERT INTO lead_activity (id, lead_id, text, kanal, kierunek, mail_message_id) VALUES ($1,$2,$3,'email','przychodzacy',$4)`,
        [randomUUID(), leadA, "Re: Automatyzacja umów — Dzień dobry, wracam do tematu — kiedy moglibyśmy porozmawiać?", mailLead]
      );

      // Jedna wiadomość oflagowana jako "ważne" (04e runda 2) — bez tego nie
      // da się lokalnie zweryfikować gwiazdki w liście/podglądzie.
      await raw(`UPDATE mail_messages SET flagged = true WHERE id = $1`, [mailLead]);

      // — Telefony i pozostałe kanały (REJESTR, `GET /api/activity`) —
      // Bez tych wierszy rejestr w apce pokazuje same maile i nie da się
      // sprawdzić ani wyróżnienia nieodebranych, ani filtra po rodzaju:
      // seed miał do tej pory WYŁĄCZNIE wpisy kanału `email`, dopięte do
      // wiadomości. Świadomie mieszanka: odebrane z czasem trwania, odebrane
      // z ręczną notatką (notatka wygrywa nad "Odebrane · 4 min"), dwa
      // nieodebrane (lead i klient) oraz kanały nietelefoniczne.
      //
      // `created_at` rozrzucone po godzinach, nie wszystkie `now()` — inaczej
      // sortowanie rejestru byłoby nie do zweryfikowania, bo wszystko miałoby
      // ten sam znacznik czasu.
      await raw(
        `INSERT INTO lead_activity (id, lead_id, text, kanal, kierunek, wynik, czas_trwania_sek, created_at) VALUES
           ($1,$2,$3,'telefon','wychodzacy','odebrane',222, now() - interval '5 hours'),
           ($4,$5,$6,'telefon','przychodzacy','nieodebrane',NULL, now() - interval '26 hours'),
           ($7,$8,$9,'whatsapp','wychodzacy',NULL,NULL, now() - interval '3 days'),
           ($10,$11,$12,'spotkanie','przychodzacy',NULL,NULL, now() - interval '9 days')`,
        [
          randomUUID(), leadA, "Ustalone: pilotaż na dwóch typach umów, wracam z wyceną do piątku.",
          randomUUID(), leadB, "",
          randomUUID(), leadA, "Wysłałem link do kalendarza.",
          randomUUID(), leadB, "Spotkanie w piekarni — obejrzeliśmy obieg zamówień.",
        ]
      );
      await raw(
        `INSERT INTO client_activity (id, client_id, text, kanal, kierunek, wynik, czas_trwania_sek, created_at) VALUES
           ($1,$2,$3,'telefon','przychodzacy','odebrane',95, now() - interval '31 hours'),
           ($4,$5,$6,'telefon','wychodzacy','nieodebrane',NULL, now() - interval '4 days'),
           ($7,$8,$9,'linkedin','przychodzacy',NULL,NULL, now() - interval '12 days')`,
        [
          randomUUID(), clientA, "",
          randomUUID(), clientA, "",
          randomUUID(), clientA, "Anna podesłała kontakt do znajomej z branży.",
        ]
      );

      // HTML dla maila "reklamowego" — sprawdza renderowanie w izolowanej
      // ramce (lib/mailHtml.ts + MailBodyHtml.tsx). Zawiera CELOWO trzy
      // rzeczy, które MUSZĄ zostać wycięte przez odkażanie: <script>, atrybut
      // onerror= i link javascript:. Jeśli po zmianie w regułach zobaczysz w
      // panelu alert albo goły kod — to regresja bezpieczeństwa.
      //
      // Od 2026-07-19 jest tu też próbka pod DOPASOWANIE DO EKRANU (zgłoszenie
      // właściciela z telefonu: „podgląd maila kompletnie się nie skaluje"):
      //  1. preheader ukryty przez display:none — jeśli go WIDAĆ, to znaczy,
      //     że odkażanie znów wycina style ukrywania i newsletterom wycieka
      //     tekst podglądu;
      //  2. opakowanie <div style="width:600px"> — jeśli treść UCINA SIĘ
      //     z prawej, to znaczy, że reguły szerokości przestały je zerować.
      //     Zmierzone: bez nich ten mail wystawał o 234 px na ekranie 390 px.
      await raw(
        `UPDATE mail_messages SET body_html = $1 WHERE id = $2`,
        [
          `<html><body style="font-family:sans-serif">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0">Preheader: ten tekst NIE ma być widoczny w treści wiadomości.</div>
            <div style="width:600px">
            <table width="600" cellpadding="8"><tr><td bgcolor="#0a66c2" style="color:#fff">
              <h2 style="margin:0">Alerty o ofertach pracy</h2></td></tr>
              <tr><td><p>Twój alert o ofertach pracy na stanowisko <b>Konsultant systemu SAP</b>.</p>
              <p><a href="https://www.linkedin.com/comm/jobs/view/4440064680/?trackingId=c9bGxz9ZszGOTqn4FoidKA%3D%3D&refId=5p%2FQ6kiuHC9hb15LfUiMWg%3D%3D&midToken=AQGsyEYTyg_tSw">Wyświetl ofertę pracy</a></p>
              <img src="https://www.linkedin.com/tracking-pixel.gif" width="1" height="1" onerror="alert('xss')">
              <p><a href="javascript:alert('xss')">Podejrzany link</a></p>
              <script>alert('xss')</script>
              </td></tr></table>
            </div>
            <!-- Druga pułapka szerokości, INNA niż powyższa: nowocześni nadawcy
                 (Calendly, Stripe) nie używają atrybutu width, tylko stylu
                 inline. Selektor [width] ich nie łapie, więc muszą je zerować
                 reguły na samym table/td. Bez tego mail wychodzi poza ekran
                 i jest ucinany (zgłoszenie właściciela 2026-07-19, druga tura). -->
            <table style="width:640px"><tr>
              <td style="width:400px">Upgrade to keep using the premium features you love</td>
              <td style="width:240px">Automate email and text reminder Workflows</td>
            </tr></table>
            <!-- Trzecia pułapka, ta najbardziej podstępna: sztywna szerokość
                 na elementach, które NIE są tabelą ani obrazkiem. Lista tagów
                 (table,td,th,img,div) przepuszczała je bez zmian — dopiero
                 reguła na gwiazdkę (selektor uniwersalny) je łapie. Zmierzone: ten nagłówek wystawał
                 o 234 px poza ekran 390 px. -->
            <h1 style="width:600px">Upgrade to keep using the premium features you love</h1>
            <p style="width:600px">Your 14-day trial may have ended, but your scheduling is just getting started.</p>
          </body></html>`,
          mailNoise,
        ]
      );

      // Mail z linkiem wypisu (Moduł 4e) — bez tego wiersza nie da się
      // lokalnie zweryfikować banera "Wiadomość z listy dystrybucyjnej",
      // PGlite nie ma dostępu do prawdziwych nagłówków IMAP. Osobny INSERT,
      // żeby nie renumerować placeholderów w tabeli czterowierszowej wyżej.
      const mailNewsletter = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, list_unsubscribe, list_unsubscribe_url, received_at)
         VALUES ($1,105,'in',$2,$3,$4,$5,$6,$7,$7,'zignorowany','reklama',true,$8,now() - interval '6 hours')`,
        [
          mailNewsletter, "newsletter@przyklad.pl", "Przykładowy Newsletter", "kontakt@leggeralabs.pl",
          "Nowości w tym tygodniu",
          "Cześć! Oto najnowsze wiadomości i promocje z naszego sklepu.",
          "<dev-newsletter-1@przyklad.pl>",
          "https://example.com/unsubscribe?id=test",
        ]
      );

      // Faza 8 — DRUGI i TRZECI nadawca masówki, żeby ekran „Subskrypcje"
      // miał co grupować i sortować. Sedno tego ekranu to kolejność malejąco
      // po liczbie wiadomości, a listy jednoelementowej nie da się posortować
      // źle — bez tych wierszy błąd sortowania przeszedłby niezauważony.
      // „Sklep Ogrodowy" celowo dostaje 3 wiadomości, a „Portal Pracy" 2.
      for (let i = 0; i < 3; i++) {
        await raw(
          `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, list_unsubscribe, list_unsubscribe_url, received_at)
           VALUES ($1,$2,'in',$3,$4,$5,$6,$7,$8,$8,'zignorowany','reklama',true,$9,now() - interval '1 day' * $10)`,
          [
            randomUUID(), 130 + i, "promocje@sklepogrodowy.pl", "Sklep Ogrodowy", "kontakt@leggeralabs.pl",
            `Wyprzedaż tygodnia (${i + 1})`,
            "Rabaty do 60% na narzędzia ogrodowe.",
            `<dev-ogrod-${i}@sklepogrodowy.pl>`,
            "https://example.com/unsub/ogrod",
            i + 1,
          ]
        );
      }
      for (let i = 0; i < 2; i++) {
        await raw(
          `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, list_unsubscribe, list_unsubscribe_url, received_at)
           VALUES ($1,$2,'in',$3,$4,$5,$6,$7,$8,$8,'zignorowany','reklama',true,$9,now() - interval '2 days' * $10)`,
          [
            randomUUID(), 140 + i, "alerty@portalpracy.pl", "Portal Pracy", "kontakt@leggeralabs.pl",
            `Nowe oferty dla Ciebie (${i + 1})`,
            "Zobacz oferty dopasowane do Twojego profilu.",
            `<dev-praca-${i}@portalpracy.pl>`,
            "", // nadawca BEZ działającego linku wypisania — ekran musi to znieść
            i + 1,
          ]
        );
      }

      // Faza 8 — załączniki. PGlite nie ma dostępu do IMAP-a, więc treści
      // i tak nie pobierzemy lokalnie; te wiersze istnieją po to, żeby dało
      // się zweryfikować LISTĘ plików, ikonkę spinacza i zachowanie panelu
      // przy próbie pobrania bez skrzynki (czytelny komunikat, nie spinner).
      //
      // Trzeci wiersz jest CELOWO większy niż próg pobrania
      // (MAIL_INCOMING_ATTACHMENT_MAX_BYTES) — bez niego ścieżka „za duży
      // plik" nigdy nie zostałaby przejechana.
      await raw(
        `INSERT INTO mail_attachments (id, message_id, part_id, filename, mime, size_bytes)
         VALUES ($1,$2,'2','faktura-2026-07.pdf','application/pdf',148231)`,
        [randomUUID(), mailClient]
      );
      await raw(
        `INSERT INTO mail_attachments (id, message_id, part_id, filename, mime, size_bytes)
         VALUES ($1,$2,'3','zrzut-ekranu.png','image/png',402118)`,
        [randomUUID(), mailClient]
      );
      await raw(
        `INSERT INTO mail_attachments (id, message_id, part_id, filename, mime, size_bytes)
         VALUES ($1,$2,'4','nagranie-spotkania.mp4','video/mp4',31457280)`,
        [randomUUID(), mailClient]
      );
      await raw(`UPDATE mail_messages SET has_attachments = true WHERE id = $1`, [mailClient]);

      // VIP (Moduł 4, Etap 3) — druga wiadomość od TEGO SAMEGO klienta
      // (clientA, status 'Aktywny' = VIP z automatu), ale już OBSŁUŻONA. Bez
      // tego wiersza nie da się odróżnić zakładki "VIP" (pokazuje WSZYSTKO
      // od VIP-a, niezależnie od statusu) od "Do odpowiedzi" — mailClient
      // wyżej ma i tak status='nowy' i jest widoczny wszędzie. UWAGA
      // architektoniczna: dosłowny przypadek z brifu ("VIP bije
      // kategoria='reklama'") jest NIEOSIĄGALNY dla dopasowanego klienta —
      // saveIncoming() zeruje dopasowanie PRZED klasyfikacją, gdy nadawca
      // jest szumem (patrz komentarz w lib/mailSync.ts), więc
      // kategoria='reklama' i client_id nigdy nie współistnieją. Realny
      // odpowiednik: właściciel odpisał/wyciszył — VIP i tak zostaje widoczny.
      const mailVip = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, client_id, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, handled_at, received_at)
         VALUES ($1,107,'in',$2,$3,$4,$5,$6,$7,$8,$8,'obsłużony',now() - interval '1 hour',now() - interval '4 hours')`,
        [
          mailVip, clientA, "anna@nordwind.pl", "Anna Nowak", "kontakt@leggeralabs.pl",
          "Re: Prośba o zmianę w panelu",
          "Dzięki za szybką odpowiedź, wszystko jasne!",
          "<dev-vip-1@nordwind.pl>",
        ]
      );

      // Snooze / Odłóż (Moduł 4, Etap 3) — jeden wiersz odłożony W PRZYSZŁOŚĆ
      // (musi zniknąć z "Do odpowiedzi"/"Nieprzypisane" i pokazać się w
      // "Uśpione"), drugi odłożony W PRZESZŁOŚĆ (termin minął — musi wrócić
      // SAM, bez żadnego crona, bo widoczność liczy się przy odczycie, patrz
      // lib/db.ts).
      const mailSnoozeFuture = randomUUID();
      const mailSnoozePast = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, snooze_until, received_at)
         VALUES ($1,108,'in',$2,$3,$4,$5,$6,$7,$7,'nowy', now() + interval '2 days', now() - interval '7 hours'),
                ($8,109,'in',$9,$10,$11,$12,$13,$14,$14,'nowy', now() - interval '1 hour', now() - interval '2 days')`,
        [
          mailSnoozeFuture, "biuro@innafirma.pl", "Kasia Zaręba", "kontakt@leggeralabs.pl",
          "Pytanie o wolny termin we wrześniu",
          "Dzień dobry, chciałabym zapytać o wolny termin — odezwę się bliżej, proszę odłożyć.",
          "<dev-snooze-future-1@innafirma.pl>",

          mailSnoozePast, "kontakt@budzik.pl", "Rafał Sowa", "kontakt@leggeralabs.pl",
          "Wracam do rozmowy",
          "Dzień dobry, wracam do wcześniejszej rozmowy — jest Pan/Pani dostępny/a w tym tygodniu?",
          "<dev-snooze-past-1@budzik.pl>",
        ]
      );

      // Nudge/Follow-up (Moduł 4f) — wątek BEZ odpowiedzi (musi pojawić się
      // w zakładce "Bez odpowiedzi" i w digescie) oraz wątek KONTROLNY, który
      // wygląda podobnie (mail wychodzący, cisza kilka dni), ale MA
      // odpowiedź — musi zostać wykluczony. Bez tej pary nie da się lokalnie
      // odróżnić poprawnego NOT EXISTS w getNudgeThreads() (lib/db.ts) od
      // przypadkowo zawsze-prawdziwego.
      const mailNudgeSent = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, folder, from_addr, to_addr, subject, body_text, message_id, thread_id, status, received_at)
         VALUES ($1,110,'out','sent',$2,$3,$4,$5,$6,$6,'obsłużony', now() - interval '8 days')`,
        [
          mailNudgeSent, "kontakt@leggeralabs.pl", "biuro@cisza.pl",
          "Oferta na wdrożenie automatyzacji",
          "Dzień dobry, w załączeniu przesyłam ofertę — czekam na odzew.",
          "<dev-nudge-sent-1@leggeralabs.pl>",
        ]
      );

      const mailNudgeControlSent = randomUUID();
      const mailNudgeControlReply = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, folder, from_addr, to_addr, subject, body_text, message_id, thread_id, status, received_at)
         VALUES ($1,111,'out','sent',$2,$3,$4,$5,$6,$6,'obsłużony', now() - interval '9 days')`,
        [
          mailNudgeControlSent, "kontakt@leggeralabs.pl", "biuro@odpowiada.pl",
          "Propozycja współpracy",
          "Dzień dobry, przesyłam propozycję współpracy — czekam na odpowiedź.",
          "<dev-nudge-control-1@leggeralabs.pl>",
        ]
      );
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, folder, from_addr, to_addr, subject, body_text, message_id, in_reply_to, refs, thread_id, status, received_at)
         VALUES ($1,112,'in','inbox',$2,$3,$4,$5,$6,$7,$7,$7,'obsłużony', now() - interval '2 days')`,
        [
          mailNudgeControlReply, "biuro@odpowiada.pl", "kontakt@leggeralabs.pl",
          "Re: Propozycja współpracy",
          "Dzień dobry, dziękuję za propozycję — jesteśmy zainteresowani, umówmy rozmowę.",
          "<dev-nudge-control-2@odpowiada.pl>",
          "<dev-nudge-control-1@leggeralabs.pl>",
        ]
      );

      await raw(`UPDATE mail_state SET last_seen_uid = 112 WHERE id = 'default'`, []);

      // — Kolejka wysyłki odłożonej (Faza 8 panelu / Faza 13.3 apki) —
      // Ta sama lekcja co przy kontakcie nurture wyżej: wiersz w `mail_outbox`
      // powstaje WYŁĄCZNIE przez „wyślij później" w edytorze, a lokalnie nikt
      // maila nie odkłada — więc ekran „Zaplanowane" i Wyspa kolejki w apce
      // były nie do obejrzenia w żadnym środowisku deweloperskim.
      //
      // `mail_outbox` ma własny schemat, nieciągnięty przez `ensureMailSchema`.
      // Termin za 45 minut, bo apka zapala Wyspę dopiero, gdy do wysyłki
      // zostało mniej niż 4 h — wiersz „na jutro" wyglądałby jak niedziałająca
      // funkcja. Drugi wiersz jest wysłany: kolejka ma pokazywać także to, co
      // już poszło, inaczej „zniknęło" jest nie do odróżnienia od „nie
      // zadziałało".
      const { ensureMailOutboxSchema } = await import("./db");
      await ensureMailOutboxSchema();
      await raw(
        `INSERT INTO mail_outbox (id, to_addr, subject, body_text, jezyk, send_at, status) VALUES
           ($1,$2,$3,$4,'pl', now() + interval '45 minutes','queued')`,
        [
          randomUUID(), "biuro@kowalski.pl", "Podsumowanie rozmowy i następne kroki",
          "Dzień dobry, w załączeniu podsumowanie naszej rozmowy i propozycja terminów.",
        ]
      );
      await raw(
        `INSERT INTO mail_outbox (id, to_addr, subject, body_text, jezyk, send_at, status, sent_at) VALUES
           ($1,$2,$3,$4,'pl', now() - interval '1 day','sent', now() - interval '1 day')`,
        [
          randomUUID(), "kontakt@zlotyklos.pl", "Oferta — automatyzacja zamówień",
          "Dzień dobry, przesyłam ofertę zgodnie z ustaleniami.",
        ]
      );

      // Centrum powiadomień (Moduł 24) — kilka zdarzeń w kronice, żeby dzwonek
      // w sidebarze dało się w ogóle obejrzeć lokalnie. W prawdziwym panelu
      // wpisy powstają z hooków (formularz, sync poczty, cron), a tych w dev
      // nikt nie odpala: formularz publiczny wymaga wysyłki, poczta — serwera
      // IMAP, cron — Vercela. Bez seeda każda sesja nad wyglądem dzwonka
      // zaczynałaby się od pustej listy i „przed chwilą" przy każdym wpisie.
      // Mieszanka przeczytanych i nie, z różnym wiekiem — bo to właśnie te
      // stany mają różny wygląd (wyszarzenie, kropka, „2 godz. temu").
      const { ensureNotificationsSchema } = await import("./db");
      await ensureNotificationsSchema();
      await raw(
        `INSERT INTO notifications (id, kind, title, body, entity, entity_id, dedupe_key, read_at, created_at) VALUES
           ($1,'lead_new','Nowe zgłoszenie ze strony — Piekarnia Złoty Kłos','Jan Kowalski · jan@zlotyklos.pl','lead',$2,'dev:lead_new',NULL, now() - interval '35 minutes'),
           ($3,'invoice_paid','Faktura 3/2026 w pełni opłacona','Wpłata 4 920,00 PLN domknęła należność.','invoice',NULL,'dev:invoice_paid',NULL, now() - interval '5 hours'),
           ($4,'mail_nudge','Brak odpowiedzi od Nordwind Studio','Oferta na wdrożenie automatyzacji — 8 dni ciszy od Twojej wiadomości.','mail',NULL,'dev:mail_nudge', now() - interval '1 day', now() - interval '2 days'),
           ($5,'recurring_cost','Wygenerowano koszt cykliczny — Hosting az.pl','az.pl · 49,20 zł brutto · sprawdź kwotę przed opłaceniem.','cost',NULL,'dev:recurring_cost', now() - interval '3 days', now() - interval '4 days')`,
        // `leadB` = Piekarnia Złoty Kłos, jedyny seedowy lead ze źródłem
        // „Formularz na stronie" — czyli dokładnie ten, o którym hook w
        // POST /api/leads faktycznie by zadzwonił. Kliknięcie w to
        // powiadomienie prowadzi więc w dev do prawdziwego rekordu.
        [randomUUID(), leadB, randomUUID(), randomUUID(), randomUUID()]
      );
    })();
  }
  await seedPromise;
}

/** Publiczny tag — zgodny sygnaturą z klientem neon-a. */
export function getDevSql(): Sql {
  const tag: Sql = async (strings, ...values) => {
    const { text, params } = buildQuery(strings, values);
    // Migracje omijają seed, żeby nie było zakleszczenia: seeder sam wywołuje
    // migracje, a te wracają tutaj. `isDDL` łapie CREATE/ALTER/DROP;
    // `isInMigration()` — pozostałe zapytania migracji (INSERT-y singletonów
    // typu company_settings/mail_state), których po treści SQL-a nie da się
    // bezpiecznie odróżnić od runtime'u. Patrz lib/migration-ctx.ts.
    if (isDDL(text) || isInMigration()) return raw(text, params);
    await ensureSeeded();
    return raw(text, params);
  };
  return tag;
}

/** Odpowiednik `withTransaction()` z db.ts, ale na PGlite — używa wbudowanej
 * `db.transaction()` (prawdziwy BEGIN/COMMIT/ROLLBACK, PGlite to realny
 * silnik Postgresa w WASM, nie atrapa). */
export async function withDevTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  await ensureSeeded();
  return getDb().transaction(async (tx) => {
    const txSql: Sql = async (strings, ...values) => {
      const { text, params } = buildQuery(strings, values);
      const res = await tx.query(text, params);
      return res.rows as Row[];
    };
    return fn(txSql);
  });
}
