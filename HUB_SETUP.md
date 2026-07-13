# Panel /admin — pulpit, projekty, notatnik, kalendarz

Rozszerzenie rejestru leadów (`LEADS_SETUP.md`) o pełny "command center" w
stylu Linear — jedno miejsce spinające wszystko, o czym warto pamiętać.

## Wygląd — świadomie 1:1 z Linear, nie z resztą strony

Na wyraźną prośbę właściciela panel `/admin` ma teraz odrębny, w pełni
neutralny system wizualny skopiowany z prawdziwego interfejsu Linear —
**celowo bez palety marki** (brak `brand-purple/pink/gold/cyan`,
`text-liquid`, `btn-primary`, `font-serif`), które nadal obowiązują na
stronie publicznej. Scoped przez klasę `.admin-linear` na korzeniu
`AppShell.tsx` (w `globals.css`) — nadpisuje `--bg/--bg-soft/--fg/--fg-
muted/--hairline` tylko wewnątrz panelu, strona publiczna korzysta z
własnych tokenów `:root`/`.dark` bez zmian. Kluczowe elementy:
- Ikony: `@tabler/icons-react` (nie emoji, świadome odejście od
  wcześniejszej decyzji z uwagi na wymóg wizualnej wierności Linear).
- Jeden akcent: `#4ea7fc` (niebieski) — zamiast gradientów marki.
- Kompaktowy, jednowierszowy pasek górny w każdym module (zakładki +
  filtry + małe ikony akcji) zamiast dużego nagłówka h1/podtytułu i
  kolorowych kart statystyk — dokładnie jak realny układ Linear (filtry/
  opcje wyświetlania w prawym górnym rogu, bez dużego tytułu strony).
- Aktywna pozycja w sidebarze: niebieski obrys, nie wypełniona pigułka.
- Jeśli w przyszłości ktoś poprosi o coś nowego w panelu, trzymaj się tego
  neutralnego systemu (nie wracaj do gradientów/emoji bez wyraźnej prośby).
Bez dodatkowej konfiguracji: te same zmienne środowiskowe co dla leadów
(`DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`) obsługują cały
panel. Wszystkie tabele (`leads`, `projects`, `project_tasks`,
`project_milestones`, `project_resources`, `project_activity`, `notes`,
`notes_activity`, `events`) tworzą się i aktualizują same przy pierwszym
użyciu API.

## Nawigacja

Lewy pasek boczny (zwijany, stan zapamiętywany) przełącza między modułami:

- **Pulpit** (`/admin`) — widok "co dziś": leady wymagające działania,
  projekty z minionym terminem, zaległe faktury, dzisiejsze wydarzenia z
  kalendarza, ostatnie notatki. Punkt startowy każdego dnia pracy.
  Interaktywny — bez przechodzenia do modułu można leada oznaczyć jako
  obsłużony, projekt jako wdrożone, wysłać przypomnienie o zaległej
  fakturze, albo usunąć dzisiejsze wydarzenie prosto z listy.
  Na górze pasek KPI ("Pulpit prezesa" — Faza C planu wirtualnej firmy):
  - **Przychód (ten miesiąc)** — suma brutto faktur (bez proform) wg daty
    wystawienia w bieżącym miesiącu, z porównaniem procentowym do
    poprzedniego miesiąca. Świadomie liczone wg daty wystawienia, nie wg
    wpłat — wpłaty częściowe są opcjonalne i nie każda opłacona faktura ma
    zarejestrowaną wpłatę, więc suma wpłat zaniżałaby przychód.
  - **Należności (zaległe)** — suma (brutto − zapłacono) faktur po
    terminie płatności (bez proform), ten sam wzorzec co kafelek "Po
    terminie" w `InvoicesDashboard.tsx`.
  - **Pipeline ofert** — suma kwot ofert w statusie Szkic/Wysłana (nie
    Zaakceptowana/Odrzucona/Wygasła). Oferty są wyłącznie w PLN.
  - **Wymaga działania dziś** — suma leadów+projektów+faktur+ofert z
    powyższych list (liczba, nie kwota).
  Kwoty w różnych walutach nie są sumowane w jedną liczbę (faktura w EUR i
  w PLN to nie ta sama wartość) — każda waluta pokazana osobno, sklejone
  znakiem "+", tak jak w `InvoicesDashboard.tsx`.
- **Projekty** (`/admin/projects`) — Twoje własne projekty/wdrożenia,
  z dwoma widokami do przełączania (jak Kanban/Tabela przy leadach):
  - **Tablica** — kanban po statusie (Pomysł → Planowanie → W trakcie →
    Testy/review → Wdrożone/Wstrzymane), karty pokazują priorytet, pigułkę
    "zdrowia" projektu (gdy inne niż "Na dobrej drodze"), pasek postępu
    zadań (gradient purple→cyan, z ułamkiem obok, np. „3/7”) i termin.
  - **Oś czasu** — widok Gantt-lite: pasek projektu dzieli się na odcinki
    wyznaczone kamieniami milowymi, każdy z nazwą kamienia na stałe widoczną
    pod spodem (styl Linear — nie tylko po najechaniu); odcinek po ostatnim
    kamieniu do końca to skośnie kreskowana "prognoza" (praca jeszcze
    nierozbita na kamienie milowe). Romby kamieni milowych na granicach
    odcinków, pionowa linia „dziś”, mały wskaźnik priorytetu (słupki, a dla
    "Krytyczny" pomarańczowa plakietka z „!") obok tytułu. Kolor paska
    odzwierciedla zdrowie projektu (zielony/pomarańczowy/czerwony).
    Świadomie bez linii zależności między projektami (patrz sekcja "Czego
    świadomie nie ma" niżej) — to był wyraźny wybór, nie przeoczenie.
  - Panel szczegółów projektu jest dwukolumnowy (styl Linear): treść +
    kamienie milowe z paskami postępu + log aktywności po lewej; po prawej
    boczny pasek z metadanymi — zdrowie, status, priorytet, daty
    start/termin, powiązany lead, lista zasobów (linki do Figmy,
    dokumentów itp.).
- **Notatnik** (`/admin/notes`) — szybkie zapisywanie pomysłów, z tagami
  i zapamiętanym filtrem. Przycisk „→ Przekuj w projekt” tworzy z notatki
  nowy projekt jednym kliknięciem. Każda notatka ma zwijany „Log” (jak
  aktywność przy leadach/projektach, ale lżejszy — bez osobnej podstrony,
  bo notatki nie mają peek panelu/detail page) do zapisywania kolejnych
  ustaleń bez nadpisywania treści notatki.
- **Kalendarz** (`/admin/calendar`) — widok miesiąca, klik w dzień pokazuje
  listę wydarzeń i formularz dodawania nowego (tytuł + opcjonalna godzina,
  opcjonalne powiązanie z leadem lub projektem).
- **Leady** (`/admin/leads`) — opisane w `LEADS_SETUP.md`, teraz też w
  ramach wspólnego sidebaru i palety poleceń.
- **Klienci** (`/admin/clients`, Faza F, 2026-07-12) — fundament CRM: Lead to
  ktoś nieznany, dopiero kwalifikowany; Klient to ktoś, z kim realnie zaczęła
  się rozmowa i jest szansa coś dla niego stworzyć/sprzedać (teraz albo w
  przyszłości). Rekord Klienta powstaje **automatycznie** przy tworzeniu
  pierwszej Oferty dla leada (`app/api/offers/route.ts` POST), albo
  **ręcznie** przyciskiem „+ Utwórz klienta” na leadzie
  (`app/api/leads/[id]/promote`) — dla sytuacji gdy rozmowa już trwa, zanim
  jest gotowa oferta. `client_id` (nullable, `ON DELETE SET NULL`) doklejony
  do leads/offers/invoices/projects — przy akceptacji oferty propaguje się
  automatycznie do utworzonego projektu i faktury. Status relacji
  (Prospekt/Aktywny/Uśpiony/Stracony, `lib/clients.ts`) to OSOBNA oś od tego
  czy klient coś kupił — dokładnie jak „zdrowie” projektu vs jego status.
  Karta klienta (peek panel wysuwany z prawej, jak Leady — NIE modal): dane
  kontaktowe, statyczna podpowiedź „co zwykle dalej” per status
  (`CLIENT_STATUS_HINT` — miękka, nigdy nie blokuje), sekcja „Powiązane” z
  listą ofert/faktur/projektów (szybkie linki do aktualnego stanu), i
  **„Pełna historia”** — JEDEN scalony chronologiczny feed (2026-07-12,
  właściciel wprost poprosił o "pełną historię akcji" łączącą wszystko w
  jedno) z trzech źródeł, scalanych server-side w `GET /api/clients/:id`:
  1. ręczne notatki na karcie klienta (`client_activity`),
  2. notatki z leada sprzed awansu na klienta (`lead_activity` leada spod
     `client.lead_id`, dociągnięte automatycznie — bez tego historia sprzed
     powstania klienta by ginęła), oznaczone tagiem „z etapu leada”,
  3. zdarzenia systemowe (`client_events`, `lib/db.ts` `logClientEvent()`) —
     zapisywane od razu w momencie realnej akcji (nie odgadywane później z
     `updated_at`): utworzenie/wysyłka/akceptacja oferty, wystawienie/
     wysyłka faktury, przypomnienie o płatności (ręczne i z dziennego
     crona), wpłata (z kwotą), pełne opłacenie faktury, zmiana statusu
     projektu. Każdy typ ma swoją ikonę (`CLIENT_EVENT_ICON`).
  Pulpit ma osobną sekcję „Klienci wymagający kontaktu” (`isClientOverdue`
  — wyłącznie na podstawie jawnie ustawionego `next_followup`, bez sztywnej
  reguły czasowej jak przy leadach). Globalne wyszukiwanie (Cmd+K,
  `/api/search`) i skrót `g k` też obejmują klientów.
  `lib/clients.ts` / `app/api/clients/*`.
- **Oferty** (`/admin/offers`) — most między leadem a realizacją: oferta ma
  tytuł, dane klienta, pozycje (nazwa/ilość/cena — bez VAT, to kwota
  ogólna) i datę ważności. Przycisk „Akceptuj ofertę” jednym kliknięciem
  (opcjonalnie z wyborem szablonu projektu z `PROJECT_TEMPLATES`) tworzy
  PROJEKT i FAKTURĘ-szkic z pozycjami skopiowanymi z oferty (domyślnie VAT
  23% na fakturze), podpina oba do oferty i ustawia jej status na
  „Zaakceptowana”. `lib/offers.ts` / `app/api/offers/*`.
- **Faktury** (`/admin/invoices`) — proste fakturowanie: dane sprzedawcy +
  tryb VAT/zwolnienie w „Dane firmy” (singleton), faktura jako szkic z
  dowolną liczbą pozycji (VAT per pozycja), numer nadawany dopiero przy
  „Wystaw fakturę” (kolejny w roku). `lib/invoices.ts` / `app/api/invoices/*`.
  Endpointy `PATCH`/`issue` (i analogicznie w Ofertach) łapią wyjątki i
  zwracają realny komunikat błędu Postgresa w toaście zamiast generycznego
  „nie udało się” — ważne przy diagnozowaniu bez dostępu do logów produkcji.
  Termin płatności ma szybkie przyciski 7/14/30 dni obok koła dat.

**Wydruk faktur i ofert dzieli wspólną logikę** przez `lib/documents.ts`
(język/locale, adres klienta, formatowanie kwot/dat, akcent gradientu marki,
payload kodu QR) — oba dokumenty są strukturalnie bliźniacze, więc realna
duplikacja (formatowanie, adres) żyje w jednym miejscu, a JSX/prezentacja
zostają osobno w `InvoicePrint.tsx` / `OfferPrint.tsx` (inne sekcje: faktura
ma VAT/płatność/QR, oferta ma „ważna do” bez VAT). Styl: premium, stonowany
(czerń/biel/szarości) + **subtelny akcent gradientu marki fiolet→złoto**
(`DOC_GRADIENT` w `lib/documents.ts`) na pasku u góry, na kwocie końcowej i
na prawdziwym logo firmy (`DocLogoMark` w obu komponentach print — dwa
nachodzące na siebie "L" jak w `app/icon.svg`/`components/Logo.tsx`, tu
renderowane jako sam kontur/stroke w gradiencie, bez wypełnienia, na wyraźną
prośbę właściciela).
**Format A4**: jawne `@page { size: A4; margin: 16mm }` + kontener o
szerokości/wysokości 794×1123px (210×297mm przy 96dpi) — na ekranie wygląda
jak pełna strona, na wydruku `min-h` jest wyłączone (`print:min-h-0`), żeby
krótkie dokumenty nie generowały pustej drugiej strony; **stopka trzyma się
dołu** dzięki `mt-auto` w kontenerze flex. **Trójjęzyczne (PL/EN/DE)** —
język wybiera się per dokument w edytorze (pole `jezyk`, property "Dokument"
w bocznym pasku), niezależnie od języka aktualnie przeglądanego panelu.
Adres nabywcy to pola strukturalne (ulica / kod pocztowy + miasto / kraj)
zamiast jednego zlepionego pola — `klient_adres` zostaje w bazie tylko jako
fallback dla starych rekordów (`clientAddressLines()`).

Stopka faktury/oferty pokazuje na stałe (3 kolumny): dane firmy, kontakt,
dane do przelewu (bank/konto/BIC-SWIFT — nowe pola `company_settings.
bank_nazwa`/`swift`, edytowalne w „Dane firmy”) — jak w klasycznych
fakturach korporacyjnych. Faktura dodatkowo: **zestawienie VAT wg stawek**
(`vatBreakdown()` w `lib/invoices.ts`, widoczne tylko gdy pozycje mieszają
stawki), **adnotacja o odwrotnym obciążeniu** (gdy użyto stawki VAT „np” —
wymagana prawnie przy usługach B2B do UE), „Słownie” tylko w PL (polska
konwencja, nie tłumaczona; `amountInWords()` faktycznie rozpisuje kwotę
słowami po polsku z odmianą wg waluty — PLN/EUR/USD/GBP — a nie tylko
przepisuje cyfry jak w pierwszej wersji), i **kod QR do przelewu** (`buildEpcQrPayload()`
+ npm `qrcode`, standard EPC069-12/„GiroCode”) — tylko gdy waluta faktury to
EUR (standard SEPA jest zdefiniowany wyłącznie dla EUR); waluta wybierana
per faktura w edytorze (`INVOICE_CURRENCIES`). Oferta nie ma numeracji
fiskalnej (nie podlega przepisom o VAT) — na wydruku pokazuje się
`offerReference()`, stabilna referencja liczona z daty utworzenia i ID, bez
osobnej kolumny w bazie.

Faktura opcjonalnie ma **Odbiorcę** — osobnego od Nabywcy (np. faktura na
centralę, towar/usługa fizycznie dla oddziału), jak w Fakturowni/inFakt.
Włączany checkboxem "Inny odbiorca niż nabywca" w edytorze (odkrywa pola
`odbiorca_nazwa/ulica/kod/miasto/kraj`), na wydruku pojawia się jako trzecia
kolumna obok Sprzedawcy/Nabywcy tylko gdy `odbiorca_nazwa` jest wypełnione.

Lista faktur (`InvoicesDashboard.tsx`) formatuje kwoty wg **rzeczywistej
waluty każdej faktury** (`inv.waluta`), nie zawsze PLN — KPI
"Nieopłacone"/"Po terminie" sumują osobno per walutę (Map, nie jedna liczba),
żeby nie dodawać do siebie PLN i EUR. Każdy wiersz ma też plakietkę języka
wydruku (PL/EN/DE) obok numeru — to samo w Ofertach.

Trzeci kafelek KPI: **"Sprzedaż (ten mies.) / próg KSeF"** — licznik miesięcznej
sprzedaży w PLN (faktury nie-proforma, nie-szkic, nie-anulowane, wg daty
wystawienia) vs `KSEF_MICRO_THRESHOLD_PLN` = 10 000 zł (`lib/invoices.ts`).
Obowiązek KSeF wszedł w życie 1 lutego 2026 (duże firmy) i 1 kwietnia 2026
(wszyscy pozostali) — mikroprzedsiębiorcy mają zwolnienie do końca 2026, ale
tylko poniżej tego progu miesięcznie. Świadomie tylko miękkie ostrzeżenie
(żółty przy 70%, czerwony po przekroczeniu) — bez blokowania czegokolwiek i
bez integracji z samym KSeF (to osobna, większa faza z roadmapy).

**Księgowość — dopięte do końca (wzorce z Fakturowni/inFakt/SAP, bez KSeF na
razie — celowo, to osobny, większy zakres):**

- **Typ dokumentu** (`typ_dokumentu`: faktura / proforma / zaliczkowa) —
  proforma ma własną numerację (prefiks `PF`), nie liczy się do KPI
  przychodu (niefiskalna); ma przycisk „Przekształć w fakturę VAT”
  (`InvoiceEditor.tsx`), który kopiuje dane jako nowy szkic prawdziwej
  faktury (`POST /api/invoices/:id/duplicate` z `{ typ_dokumentu: "faktura"
  }`). Zaliczkowa ma pole „Rozlicza zaliczkę” na fakturze końcowej
  (`rozlicza_zaliczke_id`) — na wydruku odejmuje kwotę zaliczki od sumy do
  zapłaty.
- **Korekta** (`koryguje_id`, prefiks numeracji `KOR`) — przycisk „Wystaw
  korektę” na już wystawionej fakturze tworzy nowy szkic powiązany z
  oryginałem; wydruk pokazuje tabelę porównawczą przed/po korekcie
  (`InvoicePrint.tsx`), oryginał zostaje nienaruszony.
- **Wpłaty częściowe** (`invoice_payments`) — karta „Płatności” w edytorze,
  pokazuje zapłacono/pozostało (`totalPaid()` w `lib/invoices.ts`).
- **Link publiczny + e-mail** — każda faktura ma `share_token` (losowy,
  generowany w JS, nie SQL — PGlite nie ma `pgcrypto`), pod
  `/[lang]/faktura/[token]` widoczny bez logowania. Przycisk „Wyślij
  mailem” (`app/api/invoices/[id]/send`) wysyła link przez Resend
  (`lib/email.ts`, wspólne z modułem leadów).
- **Przypomnienia o zaległych płatnościach** — automatycznie, w ramach
  istniejącego dziennego crona `/api/leads/notify` (celowo bez nowego wpisu
  w `vercel.json` — jeden cron na cały panel), z odstępem 7 dni między
  przypomnieniami tej samej faktury (`last_reminder_at`); też ręcznie,
  przyciskiem „Wyślij przypomnienie” (widoczny tylko gdy faktura po
  terminie).
- **Kurs NBP dla faktur w walucie obcej** — wymóg ustawy o VAT: kwota VAT
  musi być dodatkowo pokazana w PLN wg kursu z dnia poprzedzającego
  wystawienie. Pobierane automatycznie przy „Wystaw fakturę” (`lib/nbp.ts`,
  cofa się do 10 dni wstecz pomijając dni bez publikacji kursu), zapisywane
  raz i nigdy nie nadpisywane przy ponownym wystawieniu; jeśli NBP jest
  nieosiągalne, wystawienie i tak przechodzi (fail-open).
- **Biała Lista MF (lookup NIP)** — przycisk „Szukaj po NIP” w edytorze
  (`app/api/mf/nip/[nip]`, `lib/mf.ts`) autouzupełnia nazwę/adres nabywcy z
  publicznego API Ministerstwa Finansów.
- **Duplikowanie faktury** — kopiuje nabywcę/odbiorcę/pozycje do nowego
  szkicu (`app/api/invoices/[id]/duplicate`), bez numeru/dat/statusu/wpłat.
- **Faktury cykliczne** (`recurring_invoices`, `RecurringPanel.tsx`, panel
  „Cykliczne” w pasku Faktur) — szablon (nabywca + pozycje + cykl
  miesięczny/kwartalny/roczny) generuje automatycznie nowy szkic faktury,
  gdy nadejdzie `next_run` — też w ramach dziennego crona
  (`generateDueRecurringInvoices()` w `app/api/leads/notify/route.ts`).
  Wystawienie (numer) i wysyłkę robi właściciel ręcznie z listy faktur —
  świadomie, żeby zawsze mógł spojrzeć na szkic przed wysłaniem klientowi.
  Edycja pozycji w panelu zapisuje na `onBlur`, nie na każdym znaku (patch
  po każdym keystroke'u ścigał się z odświeżeniem listy i gubił wpisywane
  znaki — poprawione).

## Cmd+K, wyszukiwanie, skróty

Globalna paleta poleceń (Cmd/Ctrl+K) działa na każdej podstronie panelu —
agreguje akcje kontekstowe bieżącego modułu (np. „+ Dodaj projekt”) razem
z wyszukiwaniem pełnotekstowym po leadach, projektach, notatkach i
wydarzeniach jednocześnie. Skróty klawiszowe (`/` — szukaj, `n` — nowy
element, `j`/`k` — nawigacja po liście, `Esc` — zamknij panel) działają
spójnie we wszystkich modułach, nie tylko w Leadach. `Cmd/Ctrl+Enter` zapisuje
formularz z aktywnego pola tekstowego (notatka w logu aktywności leada/
projektu, nowa notatka w Notatniku, nowe wydarzenie w Kalendarzu) — bez
sięgania po myszkę. Gdy panel szczegółów leada lub projektu jest otwarty,
cyfry `1`-`9` zmieniają status na n-tą pozycję z listy statusów (kolejność
jak w `STATUSES`/`PROJECT_STATUSES`) — szybka zmiana bez sięgania po
pigułkę statusu myszką, tak jak w Linear. Poza paletą działają też chordy
nawigacyjne w stylu Linear: `g` a potem `h`/`p`/`n`/`c`/`l` przenosi
odpowiednio do Pulpitu/Projektów/Notatnika/Kalendarza/Leadów (drugi klawisz
trzeba nacisnąć w ciągu ~0,9 s od `g`).

## Zapisane Widoki (nazwane kombinacje filtrów)

Leady i Projekty mają, obok jednego zapamiętanego ostatniego filtra, też
nazwane, zapisane kombinacje filtrów — pigułki pod paskiem filtrów (np.
„Leady gorące” = status + źródło, „Projekty zagrożone” = status +
priorytet). „+ Zapisz widok” zapisuje bieżące ustawienie filtrów pod nazwą
z promptu; kliknięcie pigułki je przywraca; ✕ (widoczny po najechaniu) ją
usuwa. Trzymane w `localStorage` (`leggera_leads_saved_views` /
`leggera_projects_saved_views`) — świadomie bez tabeli w bazie, to lokalna
wygoda, nie dane biznesowe. Komponent `SavedViews` w `components.tsx` jest
współdzielony przez oba moduły.

## Zaznaczanie wielu elementów naraz (bulk actions)

Zarówno tabela i tablica leadów, jak i tablica projektów mają checkboxy przy
każdym wierszu/karcie (w tabeli leadów też „zaznacz wszystko” w nagłówku).
Gdy coś jest zaznaczone, nad listą pojawia się pływający pasek akcji:
zmiana statusu (leady, projekty), zmiana priorytetu (projekty) i usuwanie
zaznaczonych naraz. Zaznaczenie czyści się automatycznie przy zmianie
filtra, wyszukiwania albo przełączeniu widoku — to świadomie proste
zachowanie (żeby nie zostawiać "zombie" zaznaczenia po zmianie kontekstu),
bez osobnego przycisku "odznacz przy zmianie filtra".

## Przypominacz

Zamiast modelu AI generującego sugestie (świadomie, zgodnie z wcześniejszą
decyzją o nie wciąganiu tu żadnego LLM-a) — deterministyczne reguły, ten sam
duch co przy leadach:

- Projekt "wymaga działania", jeśli ma ustawiony termin, który minął lub jest
  dziś, i nie jest w statusie "Wdrożone" (niezależnie od ręcznie ustawionego
  pola "zdrowie" — to dwie osobne osie, tak jak w Linear).
- Dzienny raport mailowy (patrz `LEADS_SETUP.md` → sekcja o Resend) obejmuje
  cały panel: leady wymagające działania, projekty po terminie, i
  dzisiejsze wydarzenia z kalendarza — jeden mail na kontakt@leggeralabs.pl
  zamiast osobnych powiadomień per moduł.

## Mentor: podpowiedzi dla leadów + mapa 12-krokowego procesu (Moduł 1, 2026-07-13)

Domknięcie luki ⑤ z audytu przepływów: karty klientów miały miękką
podpowiedź per status (`CLIENT_STATUS_HINT`), leady nie miały żadnej — mimo
że to początek lejka, gdzie podpowiedź jest najcenniejsza.

- `LEAD_STATUS_HINT` (`lib/leads.ts`) — jedno zdanie „co teraz zrobić” per
  status leada, 1:1 wzorem `CLIENT_STATUS_HINT`. Renderowane w
  `LeadDetailPanel.tsx` pod `StatusTag` (peek panel i podstrona
  `/admin/leads/[id]` dzielą ten sam komponent, więc obie miejsca dostają
  podpowiedź automatycznie).
- `lib/process.ts` — jedna wspólna lista uzgodnionego 12-krokowego procesu
  (znalezienie leada → pierwszy kontakt → … → nurture), czysta stała bez
  logiki AI/LLM.
- `LEAD_STATUS_STEP` (`lib/leads.ts`) i `CLIENT_STATUS_STEP` (`lib/clients.ts`)
  — statyczne mapowanie status→krok. Przybliżone z natury: kilka statusów
  kontaktowych leada mieści się w jednym kroku „Pierwszy kontakt”; status
  klienta to osobna oś (relacja, nie proces), więc „Uśpiony”/„Stracony” oba
  lądują na kroku „Nurture” (ten sam duch co ich hint — ustaw przypomnienie
  na później).
- `ProcessMap` (`app/[lang]/admin/components.tsx`) — generyczny komponent
  współdzielony przez Leady i Klientów: 12 kroków w poziomie, aktualny krok
  podświetlony gradientem marki, wcześniejsze odhaczone. Renderowany na dole
  panelu leada/klienta (Wariant A z briefu — „jesteś tu” przy konkretnym
  rekordzie, nie osobny widok). Wyłącznie informacyjny, nigdy nie blokuje.
- Pełny brief: `docs/plany-modulow/01-podpowiedzi-leadow.md`.

## Leady: ustrukturyzowane dane + lista tylko-do-podglądu (2026-07-13)

Kontynuacja Modułu 1 po rozmowie z właścicielem o realnych problemach z
listą leadów: pola obcinane w wąskich kolumnach, adres upychany w
notatkach, pole "Źródło" mieszające kategorię z dopiskiem (np. "Przysucha -
ciepły?"). Trzy decyzje właściciela (2026-07-13): kategorie źródła + wolne
pole "szczegóły" (nie tagi, nie jedno pole), stare wpisy `zrodlo` NIE są
migrowane (świadomie zostają nieustrukturyzowane), dodać pole "Osoba
kontaktowa".

- **Nowe kolumny leada** (`lib/db.ts` `createSchema()`, ALTER TABLE
  idempotentne jak zawsze): `osoba_kontaktowa`, `ulica`/`kod`/`miasto`/`kraj`
  (adres, wzorem `clients`), `zrodlo_kategoria`. Kolumna `zrodlo` ZMIENIA
  znaczenie na "szczegóły źródła" (wolny tekst) — nazwa w bazie zostaje,
  żeby nie ruszać istniejących zapisów/wstawień.
- `SOURCE_CATEGORIES` (`lib/leads.ts`) — stała lista 8 kategorii (WWW,
  Polecenie, Networking, Zimny telefon, Formularz na stronie, Automatyczne
  wyszukiwanie, Ręcznie dodane, Inne). `leadSourceLabel()` zwraca kategorię,
  a dla starych leadów bez kategorii (`zrodlo_kategoria` puste) surowe stare
  `zrodlo` — nic nie znika z list/filtrów mimo braku migracji.
- Automatyczne źródła leadów zapisują teraz PRAWDZIWE dane do właściwych pól
  zamiast upychać je w `notatki`: `ContactForm.tsx` (formularz na stronie)
  zapisuje `osoba_kontaktowa` zamiast dopisku "Osoba kontaktowa: X" w
  notatkach; `app/api/leads/discover/route.ts` (auto-wyszukiwanie po OSM)
  zapisuje `ulica`/`kod`/`miasto` z tagów `addr:*` zamiast jednego bloba
  adresu w notatkach.
- Adres kopiuje się teraz też przy awansie leada na klienta — zarówno przy
  ręcznym „+ Utwórz klienta” (`app/api/leads/[id]/promote/route.ts`), jak i
  automatycznie przy pierwszej ofercie (`app/api/offers/route.ts`).
- **Lista = tylko podgląd, profil = edycja.** `TableView.tsx` i
  `KanbanBoard.tsx` nie mają już edytowalnych pól dla danych stałych (nazwa,
  branża, kontakt, adres, źródło) — to zwykły tekst z tooltipem pełnej
  treści (`Truncate`, `components.tsx`). Jedyna edycja wprost z listy to
  status (`StatusTag`), bo to codzienna czynność robocza, nie dana stała.
  Klik w nazwę firmy (albo ikona „Otwórz profil”) otwiera `LeadDetailPanel`
  (peek panel lub podstrona `/admin/leads/[id]`), gdzie wszystko jest
  edytowalne — łącznie z nowymi polami i kategorią źródła przez `PillPicker`
  (`components.tsx`, neutralna wersja `StatusPill` bez kolorowania per
  wartość).
- **Tabela wykorzystuje pełną szerokość**: `table-fixed` + `<colgroup>` z
  szerokościami procentowymi zamiast sztywnych `min-w-[]px` na każdej
  kolumnie — wcześniej tabela nie rozciągała się na dostępną szerokość
  ekranu, tylko sumowała minimalne szerokości kolumn. Kolumny "WWW" i
  "Notatki" zniknęły z listy (długie/rzadko potrzebne od razu) — dostępne w
  profilu.

## Uporządkuj źródła — auto-kategoryzacja starych leadów (2026-07-14)

Jednoprzyciskowa akcja w toolbarze `/admin/leads` (ikona 🏷️, `IconTag`) i w
palecie poleceń — doklasyfikowuje WSZYSTKIE leady z pustym
`zrodlo_kategoria` (czyli sprzed rozbicia źródła na kategorię+szczegóły)
przez deterministyczne dopasowanie słów kluczowych w starym `zrodlo`
(`guessSourceCategory()`, `lib/leads.ts`) — zero AI/LLM, zgodnie z zasadą
"Zero AI w logice przypominaczy/podpowiedzi". Niejednoznaczne przypadki
(np. "Przysucha - ciepły?") świadomie lądują w kategorii "Inne" zamiast
zgadywać — sam tekst `zrodlo` zostaje nietknięty jako "Szczegóły źródła" w
profilu, więc kontekst się nie gubi. Idempotentne i bezpieczne do
wielokrotnego klikania: dotyka tylko leadów, które jeszcze nie mają
kategorii (przyszłe automatyczne źródła — formularz, discover — już
zapisują kategorię od razu, więc to głównie dla importów/starych danych).
`LeadsDashboard.tsx` → `tidySources()`.

## Leady: eksport CSV, szersze wyszukiwanie/filtr miasta, ostrzeżenie o duplikacie (2026-07-14)

Dogonienie Leadów do poziomu Faktur/Kosztów pod kątem narzędzi, po pytaniu
właściciela "co jeszcze usprawniłoby pracę":

- **Eksport CSV** (`app/api/leads/export/route.ts`, ikona `IconFileExport`
  w toolbarze) — cały rejestr na raz, bez pytania o zakres dat jak przy
  Fakturach/Kosztach (leady to żywy rejestr, nie zdarzenia z okresu, więc
  `ExportCsvButton` z zakresem dat by tu nie pasował — osobny, prostszy
  komponent: `<a href="/api/leads/export">`).
- **Wyszukiwarka** dopasowuje teraz też branżę, miasto, osobę kontaktową i
  notatki, nie tylko nazwę firmy (`LeadsDashboard.tsx` `filtered`).
- **Filtr "Miasto"** w tym samym Popoverze co Status/Źródło (lista miast
  wyliczona z aktualnych leadów, jak `zrodla`) — obsługiwany też przez
  Zapisane Widoki.
- **Miękkie ostrzeżenie o duplikacie** przy ręcznym "Dodaj leada"
  (`findSimilarLead()`, `lib/leads.ts`) — normalizuje nazwę (usuwa polskie
  znaki diakrytyczne/interpunkcję/wielkość liter) i szuka istniejącego
  leada o identycznej lub zawierającej się nazwie. Nigdy nie blokuje —
  tylko `confirm()` z pytaniem, czy dodać mimo to. Auto-wyszukiwanie (OSM)
  miało już własne, dokładne sprawdzenie duplikatów; to domyka ścieżkę
  ręczną, która go nie miała wcale.

## Moduł 2 — Nurture automatyczny (2026-07-14)

Domyka lukę ⑥ z audytu przepływów (`docs/plany-modulow/02-nurture-automatyczny.md`):
po wygranym projekcie nic samo nie planowało powrotu do klienta — trzeba
było ręcznie ustawić `next_followup`. Teraz: gdy projekt z podpiętym
klientem przechodzi w status **"Wdrożone"**, panel automatycznie planuje
**dwa** przyszłe kontakty, bez klikania:
- **+14 dni** — "kontakt kontrolny: referencja/opinia" (moment największego
  zadowolenia klienta, najlepszy na prośbę o opinię).
- **+90 dni** — "kontakt kontrolny: kolejna automatyzacja" (po kwartale
  użytkowania, moment na upsell).

Świadomie tylko te dwa dotknięcia (decyzja właściciela 2026-07-14, zgodna z
rekomendacją briefu) — po nich panel przestaje nagabywać, dalej to ręczna
decyzja (`next_followup` albo status "Uśpiony"). Panel **nic nie wysyła do
klienta automatycznie** — to zadanie dla właściciela na Pulpicie, nie mail
za niego. Zero AI — odstępy to stałe (`NURTURE_OFFSETS`, `lib/clients.ts`).

- **Schemat**: nowa tabela `client_followups` (id, client_id, project_id,
  due_date, powod, done_at) — `ensureFollowupsSchema()` w `lib/db.ts`.
  Osobna tabela zamiast nadpisywania `next_followup`, żeby trzymać DWA
  przyszłe terminy naraz bez gubienia drugiego; nie koliduje z ręcznym
  `next_followup` klienta — oba źródła sumują się na Pulpicie/w mailu.
  `project_id` służy do deduplikacji (nie planuj drugi raz dla tego samego
  projektu, np. przy powrocie do "Wdrożone" po korekcie).
- **Trigger**: `app/api/projects/[id]/route.ts` PATCH — przy zmianie statusu
  na zamknięty (`CLOSED_PROJECT_STATUSES`, teraz eksportowane z
  `lib/projects.ts`) z podpiętym `client_id`, wstawia 2 wiersze wg
  `NURTURE_OFFSETS` i loguje zdarzenie `nurture_scheduled` (📅) na osi
  klienta.
- **Widoczność**: `app/api/hub/today` dorzuca `dueFollowups` (wymagalne
  dziś/wcześniej, `done_at IS NULL`) do sekcji "Klienci wymagający
  kontaktu" na Pulpicie — osobna lista obok istniejących `overdueClients`
  (ręczny `next_followup`), bo mają inny czytelny powód, ale renderują się
  razem (`DashboardHome.tsx`). Analogicznie dorzucone do dziennego maila
  (`app/api/leads/notify`), który wcześniej w ogóle nie raportował klientów
  — przy okazji domknięta ta luka.
- **Obsługa**: nowy endpoint `PATCH /api/client-followups/:id` ustawia
  `done_at = now()` na pojedynczym wpisie — przycisk "Obsłużone" przy
  kliencie na Pulpicie (`markFollowupHandled`, osobno od `markClientHandled`
  dla ręcznego `next_followup`).
- Zweryfikowane end-to-end na dev: oferta → akceptacja (projekt z
  `client_id`) → status "Wdrożone" → 2 wiersze w `client_followups` +
  zdarzenie `nurture_scheduled` na osi klienta.

## Profil leada/klienta jako wyśrodkowany modal (2026-07-14)

Na wyraźną prośbę właściciela: dawny wąski panel "peek" wysuwany z prawej
(`max-w-2xl` na `.glass` tle) był za ciasny na gęstą treść profilu (dane +
adres + źródło + log + mapa procesu). Zamieniony na wyśrodkowany modal —
dokładnie ten sam wzorzec co `InvoiceEditor.tsx`/`OfferEditor.tsx` (patrz
`## Architektura modułów` w `CLAUDE.md` — WYJĄTEK od zasady "peek panel z
prawej" teraz obejmuje też Leady i Klientów, nie tylko Faktury/Oferty/
Projekty). Pierwsza wersja miała `max-w-4xl`, ale wciąż było za ciasno —
finalnie usunięty limit szerokości (`w-full` bez `max-w`, margines tylko z
paddingu overlayu `p-4 sm:p-8`), więc modal realnie zajmuje całą szerokość
ekranu. Siatka pól w środku dostała `xl:grid-cols-3` (zamiast tylko
`sm:grid-cols-2`), żeby dodatkowa szerokość była wykorzystana, nie tylko
poszerzała odstępy. Dotyczy obu: `LeadDetailPanel.tsx`/
`ClientDetailPanel.tsx` (ten sam komponent renderuje się w peek-modalu z
`LeadsDashboard.tsx`/`ClientsDashboard.tsx` ORAZ w samodzielnej podstronie
`[id]/page.tsx`, więc zmiana objęła oba miejsca naraz). Wewnątrz komponentu
trzy dawne zagnieżdżone karty (`card-paper rounded-3xl`) scalone w jedną
ramkę z separatorami (`border-t hairline`) — mniej wizualnego szumu,
więcej miejsca na treść.

Logo w sidebarze poprawione w tej samej rundzie — pierwsza wersja
("LEGGERA HUB" + `.text-liquid`) nie pasowała do prawdziwego wzorca marki.
Teraz: `LogoMark` (`components/Logo.tsx`, prawdziwy znak "podwójne L") +
tekst stylowany tym samym gradientem/kątem/dark-stroke co realny wordmark
"Leggera Labs" (`HUB_WORDMARK_STYLE` w `AppShell.tsx`, skopiowany 1:1 z
`wordmarkGradient` w `Logo.tsx` — nie reużywa importu, bo `Logo.tsx` ma też
scroll-animowaną logikę specyficzną dla strony publicznej, niepotrzebną w
statycznym sidebarze).

## Branding panelu: "LEGGERA HUB" + kolejność nawigacji wg procesu (2026-07-14)

- Logo w sidebarze zmienione z "Leggera Labs" (nazwa firmy) na "LEGGERA HUB"
  (nazwa produktu/panelu, zgodnie z tym jak panel jest nazywany w `CLAUDE.md`)
  z gradientem `.text-liquid` (purpurowo-złoty, `app/globals.css`) — jedyne
  świadome odejście od neutralnej palety panelu, bo to wyraźna prośba
  właściciela (patrz `## Wygląd` wyżej: "trzymaj się neutralnego systemu,
  chyba że wyraźna prośba"). Nazwa firmy w ustawieniach/loginie zostaje
  "Leggera Labs" bez zmian — to dwie różne rzeczy (produkt vs. firma).
- Kolejność `NAV` w `AppShell.tsx` zmieniona z alfabetyczno-historycznej na
  zgodną z realną ścieżką pracy (`lib/process.ts`): Pulpit → Leady → Klienci
  → Oferty → Projekty → Faktury → Koszty → Kalendarz → Notatnik. Klawiszowe
  skróty `g` + litera (`GO_CHORDS`) bez zmian, bo są przypisane do `href`,
  nie do pozycji na liście.

## Infrastruktura AI: lokalna Ollama przez Tailscale Funnel (2026-07-14)

Fundament pod Moduł 7 (szkice mailowe) i Moduł 8 (OCR kosztów) — **wyłącznie
lokalne modele, żadnych chmurowych API**. Panel działa na Vercel (serverless),
model działa na Mac Studio M2 Ultra 64GB właściciela, działający 24/7, za
własnym proxy na porcie **11435** (nie domyślny port Ollamy 11434).

- **Dostęp z Vercela**: zwykły adres Tailscale (`100.x.x.x` / tryb prywatny)
  nie wystarcza — Vercel nie jest urządzeniem w tej sieci Tailscale.
  Rozwiązanie: **Tailscale Funnel** (`tailscale funnel --bg 11435` na Macu)
  wystawia proxy pod publicznym `https://<maszyna>.<tailnet>.ts.net`, z
  automatycznym TLS — bez routera, bez nowego DNS, bez drugiej usługi.
- **Autoryzacja**: proxy sprawdza nagłówek `Authorization: Bearer <sekret>`
  w trybie miękkim (zły token → 401, brak nagłówka → nadal przepuszcza, dla
  kompatybilności z innymi automatyzacjami w trakcie migracji). Hub **zawsze**
  wysyła ten nagłówek poprawnie wypełniony.
- **`lib/ollama.ts`** — cienki server-only klient (wzorem `lib/email.ts`):
  - `ollamaGenerate({ model, prompt, system?, timeoutMs? })` → `POST /api/generate`,
    zwraca `string | null`.
  - `ollamaHealth(timeoutMs?)` → `GET /api/tags`, zwraca `{ available, models }`.
  - Obie funkcje mają `AbortController` na timeout (domyślnie 12s/6s) i
    `try/catch` — przy błędzie/timeout zwracają wynik "niedostępny"
    (`null` / `available: false`), nigdy nie rzucają dalej. Panel działa
    dalej bez AI, gdy Mac/tunel/proxy są wyłączone.
- **`GET /api/ai/health`** — admin-only, ping do `ollamaHealth()`. Do użycia
  przez przyszły widget statusu w UI (świadomie jeszcze nie zbudowany —
  dopiero przy Module 7/8, gdy będzie faktyczna funkcja AI obok statusu).
- **Env potrzebne w Vercelu**: `OLLAMA_API_URL` (publiczny adres `*.ts.net`
  proxy, bez końcowego `/`) i `OLLAMA_API_SECRET` (sekret z Maca —
  `~/.ollama-proxy-secret`, wklejony jako wartość, nigdy sam plik).
- **Granica z resztą panelu (bez zmian)**: podpowiedzi leadów, dopasowania,
  przypominacze pozostają w 100% deterministyczne — to punktowe, jawnie
  klikane użycie modelu do treści-do-zatwierdzenia (Moduł 7/8), nie ogólny
  mechanizm AI w panelu.
- **Zweryfikowane end-to-end (2026-07-14)**: Funnel włączony na Mac Studio
  (publiczny adres `*.ts.net` — patrz `OLLAMA_API_URL` w env Vercela, świadomie
  nie powielany tutaj w repo), `GET /api/ai/health` z produkcji zwraca
  `available: true` i pełną listę modeli, w tym warianty wizyjne przydatne
  pod Moduł 8 (OCR): `qwen2.5vl:7b`, `qwen2.5vl:32b`, `qwen3-vl:8b`.
  `lib/ollama.ts` na razie obsługuje tylko tekst (`ollamaGenerate`/
  `ollamaHealth`) — obsługa obrazów (pole `images` w `/api/generate`) do
  dodania przy Module 8.

## Moduł 8 — OCR paragonów/faktur zakupowych w Kosztach (2026-07-14)

Przy dodawaniu kosztu: po wgraniu załącznika (skan/PDF) pojawia się przycisk
"📷 Odczytaj z załącznika" — model wizyjny analizuje plik i **proponuje**
wartości pól (dostawca, kwota netto, VAT, data, opis); wszystkie pola
zostają normalnie edytowalne, właściciel poprawia i zapisuje ręcznie. Model
nigdy nie zapisuje kosztu sam (patrz CLAUDE.md — jedyny dopuszczony wyjątek
od "zero AI w logice panelu").

- **`lib/ollama.ts`** rozszerzony o `ollamaGenerateWithImage({ model, prompt,
  imageBase64, system?, timeoutMs? })` — jak `ollamaGenerate`, ale wysyła
  obraz base64 w polu `images` (Ollama `/api/generate`). Też nigdy nie
  rzuca — `null` przy błędzie/timeoucie/braku konfiguracji.
- **`lib/costs-ocr.ts`** — czysta logika: `OCR_MODEL` (`qwen3-vl:8b`,
  najmniejszy/najszybszy z dostępnych modeli wizyjnych — świadomy wybór dla
  krótszego czasu oczekiwania przy klikanym OCR; łatwo zmienić na
  `qwen2.5vl:32b` w jednej stałej, jeśli jakość na polskich paragonach
  zawiedzie), prompt systemowy każący modelowi zwrócić czysty JSON
  `{dostawca, kwota_netto, vat_stawka, data, opis}`, oraz
  `parseOcrResponse()` — parsuje i WALIDUJE każde pole osobno (kwota musi
  być liczbą > 0, VAT musi być z `VAT_RATES`, data musi przejść
  `isPlausibleDateString()`) — pole, które nie przejdzie walidacji, zostaje
  puste/null zamiast wpisywać śmieciową wartość do formularza.
- **`POST /api/costs/:id/ocr`** (admin-only, `runtime = "nodejs"`): czyta
  `zalacznik_dane` kosztu. Dla PDF: konwertuje pierwszą stronę do PNG przez
  `pdf-to-img` (czysty JS/`pdfjs-dist`, bez zależności binarnych typu
  poppler — bezpieczne na Vercelu), dla JPEG/PNG/WEBP używa pliku wprost.
  Woła `ollamaGenerateWithImage` z timeoutem 60s (dłuższy niż domyślny w
  `lib/ollama.ts` — model wizyjny odpowiada wolniej niż tekstowy), zwraca
  `{ suggestion }` albo czytelny błąd (`400` brak załącznika, `422`
  nierozpoznany typ/nieudana konwersja PDF, `503` model niedostępny).
  Endpoint nigdy nic nie zapisuje do bazy.
- **UI** (`CostEditor.tsx`): przycisk "Odczytaj z załącznika" pojawia się
  obok już wgranego załącznika. Klik → `POST .../ocr` → wypełnia pola
  formularza tymi z sugestii, które przeszły walidację (puste pola sugestii
  są pomijane, nie nadpisują niczego pustym stringiem) → toast potwierdzenia
  z przypomnieniem, żeby sprawdzić dane przed zapisem. Błąd (model
  niedostępny, PDF nieczytelny, nic nie rozpoznano) → czytelny toast błędu,
  formularz zostaje w pełni używalny do ręcznego wpisania jak dziś.
- **Zweryfikowane lokalnie (2026-07-14)**: `tsc` czysty; `parseOcrResponse`
  poprawnie parsuje dobrą odpowiedź modelu (w tym owiniętą w ```json) i
  poprawnie odrzuca pojedyncze niepewne/błędne pola (zła data, VAT spoza
  `VAT_RATES`, ujemna kwota) zamiast zgadywać; `pdf-to-img` poprawnie
  renderuje pierwszą stronę testowego PDF do PNG w Node bez błędów; w
  przeglądarce (dev, bez `OLLAMA_API_URL` lokalnie) przycisk "Odczytaj z
  załącznika" pokazuje kontrolowany toast "Model AI niedostępny. Wpisz dane
  ręcznie." zamiast zawieszać UI — dokładnie zachowanie wymagane przy
  wyłączonej/niedostępnej Ollamie. Rzeczywisty odczyt obrazu (jakość modelu
  na prawdziwych polskich paragonach) do zweryfikowania na produkcji z
  żywym Mac Studio właściciela.
- **Naprawa PDF na produkcji (2026-07-14, po dwóch nieudanych realnych
  testach)**: pierwszy wgrany PDF od razu dawał błąd "nie można odczytać".
  Log z produkcji (`vercel logs`, dostępne z tego środowiska — CLI jest
  zalogowane) pokazał dokładną przyczynę: `Cannot find module
  '@napi-rs/canvas'`. `pdf-to-img`/`pdfjs-dist` w Node SAME próbują w
  runtime `require("@napi-rs/canvas")` (natywny dodatek binarny do
  renderowania) — to głęboko zagnieżdżony, dynamiczny require, którego
  Next.js/Turbopack nie widzi przy statycznej analizie zależności, więc
  binarka nie trafiała do paczki funkcji serverless. Pierwsza próba naprawy
  samą konfiguracją (`serverExternalPackages` +
  `outputFileTracingIncludes`) NIE wystarczyła — w tej wersji
  Next/Turbopacka `outputFileTracingIncludes` okazał się bez efektu dla
  zwykłych route'ów API (zweryfikowane lokalnie: `npx next build` działa
  tu w tym środowisku, więc dało się to sprawdzić bez czekania na deploy —
  tylko literalne ścieżki w wywołaniach `fs.readFile`/`require.resolve` są
  śledzone automatycznie, patrz `app/[lang]/opengraph-image.tsx` jako
  działający wzorzec). Docelowa naprawa w **`lib/pdf-render.ts`**:
  - jawny, statyczny `import ... from "@napi-rs/canvas"` na górze pliku —
    bundler to widzi i poprawnie dołącza (potwierdzone w
    `.next/.../route.js.nft.json` po lokalnym buildzie: pliki
    `@napi-rs/canvas/*.js` i natywna binarka są w śladzie);
  - `globalThis.DOMMatrix/ImageData/Path2D` ustawiane z tego importu PRZED
    załadowaniem `pdf-to-img` — pdfjs sprawdza `if (!globalThis.X)` i
    pomija swój wewnętrzny, nietraceable `require()`, jeśli globalne już
    istnieją;
  - własna `CanvasFactory` (`docInitParams.CanvasFactory`) oparta o ten sam
    jawny import — omija wewnętrzną fabrykę pdfjs, która i tak próbowałaby
    swojego requira;
  - dane `cMap`/czcionek standardowych (`pdfjs-dist/cmaps`,
    `standard_fonts` — czytane z dysku dynamiczną ścieżką, też
    nietraceable) zamienione na `BinaryDataFactory` pobierający je przez
    HTTPS z jsdelivr (`cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/...` — numer
    wersji zsynchronizowany z zainstalowaną `pdfjs-dist`, podbić razem przy
    aktualizacji). Funkcja i tak ma dostęp do internetu (woła Ollamę przez
    Tailscale Funnel), więc to nie nowa kategoria zależności.
  - Zweryfikowane lokalnie: `tsc` czysty, `npx next build` przechodzi,
    ślad pliku (`.nft.json`) zawiera `@napi-rs/canvas` i NIE zawiera już
    `cmaps`/`standard_fonts` (bo te idą przez sieć), bezpośredni test
    `renderFirstPdfPageToPng()` na testowym PDF-ie działa, fetch z
    jsdelivr do prawdziwych plików cmap/font (`78-EUC-H.bcmap`,
    `LiberationSans-Regular.ttf`) zwraca `200`.

  **Druga runda (ten sam dzień, po deployu pierwszej naprawy)**: błąd
  `@napi-rs/canvas` zniknął, ale wyszedł kolejny, tej samej natury —
  `Setting up fake worker failed: Cannot find module
  '.../pdfjs-dist/legacy/build/pdf.worker.mjs'`. pdfjs-dist w Node ZAWSZE
  próbuje uruchomić swój "worker" (nawet jako atrapa w tym samym wątku) i
  SAM doładowuje ten plik przez `import(this.workerSrc)` z runtime'owym
  stringiem — identyczny problem nietraceable-dynamic-require jak z
  `@napi-rs/canvas`, tylko w innym miejscu kodu pdfjs. Naprawa tym samym
  wzorcem: `lib/pdf-render.ts` doładowuje `pdf.worker.mjs` JAWNYM,
  literałowym dynamicznym importem (`import("pdfjs-dist/legacy/build/
  pdf.worker.mjs")` — literał w kodzie źródłowym, więc traceable) i
  ustawia `globalThis.pdfjsWorker = { WorkerMessageHandler }` PRZED
  wywołaniem `pdf()` — pdfjs sprawdza ten global jako pierwszy i pomija
  swój własny, nietraceable import, jeśli go znajdzie. Typy dla tego
  pod-modułu (którego pdfjs-dist nie publikuje) w `lib/pdfjs-worker.d.ts`.
  Zweryfikowane tak samo jak wyżej: `tsc` czysty, `npx next build`
  przechodzi, `pdf.worker.mjs` teraz widoczny w `.nft.json` śladzie
  funkcji `/api/costs/[id]/ocr`. Do ostatecznego potwierdzenia po
  najbliższym deployu: ponowny upload tego samego PDF-a na produkcji —
  jeśli wyskoczy KOLEJNY "Cannot find module" dla innego pliku pdfjs, to
  ten sam wzorzec naprawy (jawny literałowy import zamiast pozwalać
  pdfjs szukać czegoś samemu w runtime) powinien się powtórzyć.

  **Trzecia runda**: PDF wreszcie się skonwertował, ale wyskoczył
  `Model AI niedostępny` — log pokazał `AbortError: This operation was
  aborted` (nasz własny timeout 60s w `OCR_TIMEOUT_MS`, nie błąd Ollamy).
  `ollama ps` na Macu właściciela pokazał przyczynę: `qwen3-vl:8b` był
  załadowany z oknem kontekstu **262144** tokenów, co samo w sobie zajmowało
  **44 GB** (KV-cache rośnie z rozmiarem kontekstu, niezależnie od tego, że
  model to tylko 8B parametrów) — długie ładowanie/wolna odpowiedź na
  współdzielonym sprzęcie. Naprawa: `ollamaGenerateWithImage()`
  (`lib/ollama.ts`) przyjmuje teraz opcjonalny `numCtx`, wysyłany jako
  `options.num_ctx` do Ollamy; `/api/costs/[id]/ocr` jawnie ustawia
  `OCR_NUM_CTX = 8192` — z dużym zapasem wystarczające na jeden obraz
  paragonu + krótki prompt/JSON, a drastycznie mniejsze niż domyślne
  262144. Jeśli po tym nadal będzie za wolno/timeout, kolejny krok to
  albo dalsze zmniejszenie `OCR_NUM_CTX`, albo podniesienie
  `OCR_TIMEOUT_MS` (+ `maxDuration` na route'cie, w granicach planu
  Vercela).

  Przy tej samej okazji dwa mniejsze usprawnienia UX/zasobów:
  - `ollamaGenerateWithImage()` przyjmuje teraz też opcjonalny `keepAlive`
    (Ollama `keep_alive`) — `/api/costs/[id]/ocr` ustawia `"30s"` zamiast
    domyślnych 5 minut w Ollamie, żeby model szybciej oddawał RAM na
    współdzielonym Macu (właściciel woła z tego samego sprzętu inną,
    niezależną automatyzację).
  - `CostEditor`/`CostsDashboard` (moduł Koszty): okno edytora nie da się
    już przypadkiem zamknąć (kliknięciem w tło ani przyciskiem X) w trakcie
    trwania zapytania OCR — zgłoszone przez właściciela jako "kliknąłem w
    tło i nie wiem czy się odczytuje". Zapytanie leciało dalej w tle nawet
    wcześniej (fetch niezwiązany z cyklem życia komponentu), ale nic o tym
    nie informowało; teraz `CostEditor` zgłasza rodzicowi `onBusyChange`,
    dodatkowo pokazuje toast "Odczytuję załącznik…" na starcie.

  **Czwarta runda**: nawet z `OCR_NUM_CTX = 8192` (zamiast 262144) dwie
  kolejne próby na produkcji dalej kończyły się `AbortError` po pełnych 60s
  — czyli sam rozmiar kontekstu nie był (jedyną) przyczyną, to realne
  obciążenie/rywalizacja o zasoby na Macu właściciela (inna automatyzacja
  dzieli ten sam sprzęt). Podniesione `OCR_TIMEOUT_MS` z 60s na 100s +
  jawne `export const maxDuration = 120` na route'cie (bez tego domyślny
  limit czasu funkcji na Vercelu mógłby uciąć wywołanie SAM, zanim zdąży
  zadziałać nasz kontrolowany timeout/komunikat błędu) — na wypadek gdyby
  to była kwestia chwilowego, a nie trwałego obciążenia. Jeśli to nie
  pomoże, prawdziwy problem jest po stronie zasobów Maca (RAM/GPU zajęte
  przez inny proces), nie kodu panelu — do zdiagnozowania przez właściciela
  (`ollama ps`, Monitor Aktywności) w momencie próby.

  **Piąta runda — pierwszy udany odczyt na prawdziwej fakturze** (faktura
  za abonament TV/internet z mieszaną stawką VAT 8%+23%): dostawca, opis i
  data odczytane poprawnie; ujawniły się dwa kolejne, mniejsze problemy:
  - **Błąd wyświetlania**: pole "Kwota netto" (i inne pola tekstowe:
    Dostawca, NIP, Opis) używają nieskontrolowanego `defaultValue` (żeby
    nie gubić kursora przy pisaniu), więc nie odświeżały się WIZUALNIE po
    programowym patchu z OCR — sama wartość w bazie była zapisana
    poprawnie, tylko okno tego nie pokazywało (myląco wyglądało, jakby AI
    nic nie wpisało). Naprawione: `<div key={cost.updated_at}>` na siatce
    pól w `CostEditor.tsx` — wymusza remount (a więc świeży `defaultValue`)
    po każdym patchu z zewnątrz, nie tylko po ręcznej edycji.
  - **Zła stawka VAT przy mieszanych fakturach**: model wybrał 23% (mniej
    znaczący fragment kwoty) zamiast 8% (dominujący), co psuło przeliczoną
    kwotę brutto. `OCR_SYSTEM` (`lib/costs-ocr.ts`) doprecyzowany: przy
    więcej niż jednej stawce VAT na dokumencie model ma wybierać tę, na
    którą przypada NAJWIĘKSZA kwota netto — to nadal tylko przybliżenie
    (nasz model kosztu ma jedną stawkę na wpis, nie da się zapisać dwóch),
    ale powinno zmniejszyć błąd w typowym przypadku (jedna dominująca +
    mały dodatek).
  - **NIP dostawcy dodany do OCR** (właściciel poprosił po zauważeniu, że
    NIP widoczny na fakturze wcale nie był wyciągany): `OCR_SYSTEM` i
    `OcrSuggestion` (`lib/costs-ocr.ts`) mają teraz pole `nip` — model
    zwraca same cyfry (parser czyści myślniki/spacje), walidacja wymaga
    dokładnie 10 cyfr, inaczej puste. `CostEditor.tsx` wypełnia
    `dostawca_nip`, jeśli sugestia je zawiera. Zweryfikowane lokalnie
    (zasymulowana odpowiedź OCR z NIP-em z tej samej faktury) — pole
    poprawnie się wypełnia i odświeża.
  - **Definicja ukończenia modułu 8 — spełniona**: realny test na
    prawdziwej fakturze (nie tylko obraz testowy) potwierdził odczyt
    jednym kliknięciem z edytowalnymi polami przed zapisem, kontrolowany
    fallback przy niedostępności modelu, `tsc` czysty. Jakość na typowych
    polskich dokumentach do dalszej obserwacji w praktyce (mieszane stawki
    VAT to znany, świadomy kompromis — pojedyncza stawka na wpis kosztu).

  **Szósta runda — matematyczne dopasowanie VAT + termin płatności**:
  właściciel zapytał, czy z rozróżnianiem VAT przy mieszanych stawkach da
  się zrobić coś lepszego niż "zgadywanie dominującej stawki przez model".
  Tak — model i tak zwykle widzi na dokumencie sumę "Do zapłaty" (kwotę
  brutto), więc zamiast ufać, którą stawkę VAT model *uzna* za dominującą,
  każemy mu zwrócić też `kwota_brutto`, a `bestFitVatRate()`
  (`lib/costs-ocr.ts`) dobiera z `VAT_RATES` tę stawkę, która
  MATEMATYCZNIE najlepiej odtwarza `kwota_brutto` z `kwota_netto` (najmniejsza
  różnica) — niezależnie od tego, co model "myślał". Test na tej samej
  fakturze z modułu potwierdza: nawet gdy model błędnie wskazał `"23"`
  wprost, dopasowanie po kwotach poprawnie skorygowało na `"8"` (właściwa
  dominująca stawka). Brak `kwota_brutto` w odpowiedzi → fallback do
  wyboru modelu jak wcześniej (nadal tylko przybliżenie, świadomy limit
  jednej stawki VAT na wpis kosztu — dwóch stawek nie da się zapisać bez
  większej zmiany schematu, nierozważanej teraz).

  Przy okazji: `termin_platnosci` dodany do schematu OCR i mapowany na
  `data_platnosci` kosztu (wcześniej OCR wypełniał tylko datę
  wystawienia/`data_wydatku`, termin płatności trzeba było wpisywać
  ręcznie mimo że jest wprost na dokumencie). Zweryfikowane lokalnie:
  `tsc` czysty, `parseOcrResponse` przetestowany na przykładzie z realną
  fakturą (z i bez `kwota_brutto`).

## Dwie naprawy przy okazji audytu Pulpitu (2026-07-14)

Zgłoszone jako "Pulpit się nie ładuje" przy tej samej okazji, niezwiązane z
Ollamą, ale warte odnotowania:
- `DashboardHome.tsx` — `fetch("/api/hub/today")` nie miał `.catch()`; błąd
  sieci/serwera zostawiał `data=null` na zawsze, więc UI pokazywał animowany
  szkielet ładowania w nieskończoność zamiast informacji o błędzie. Dodany
  stan błędu z przyciskiem "Spróbuj ponownie".
- `app/api/hub/today/route.ts` — `inv.data_wystawienia.slice(0, 7)` crashował
  całym endpointem 500-tką, bo kolumna typu `DATE` bywa zwracana przez driver
  Neona jako obiekt `Date`, nie string (ten sam problem już wcześniej
  załatany w `invoices/export/route.ts` przez `String(...)`, tu brakowało
  tego owinięcia). Jeśli w przyszłości pojawi się podobny crash na innym
  polu typu `DATE` z bazy — to ten sam wzorzec do zastosowania.

## Moduł 3 — Kanały kontaktu: telefon/WhatsApp/LinkedIn (2026-07-14)

Realizacja `docs/plany-modulow/03-kanaly-kontaktu.md`, zaprojektowana od razu
pod desktop + mobile (przed Modułem 5, PWA) i pod pełną integrację z kartą
klienta ("nic nie zginęło, co zostało zrobione i co trzeba zrobić").
Rejestr i szybkie odnośniki — panel niczego nie wysyła sam (żadnej bramki
SMS/WhatsApp Business API), tylko `tel:`/`mailto:`/`wa.me`/link LinkedIn.
Zero AI.

- `lib/contact.ts` — wspólny moduł dla leadów i klientów: `CONTACT_CHANNELS`
  (telefon/email/whatsapp/linkedin/spotkanie/inne) + ikony/etykiety,
  `CONTACT_DIRECTIONS` (`wychodzacy`/`przychodzacy` — kto zainicjował dany
  kontakt), `waLink()` (normalizacja numeru do `https://wa.me/…`, domyślny
  kod kraju +48 dla numerów 9-cyfrowych bez prefiksu, zwraca `null` gdy nie
  da się jednoznacznie znormalizować — wtedy przycisk po prostu się nie
  pokazuje), `linkedinLink()` (dokłada `https://` jeśli brakuje).
- **Nowe kolumny** (`leads`/`clients`): `linkedin_url` (osobne pole, świadomie
  NIE wykrywane z `www`), `next_action` (tekstowy "następny krok" obok
  `next_followup` — PO CO jest przypomnienie, nie tylko KIEDY; widoczny w
  panelu tylko gdy `next_followup` ustawiony, i doklejany do
  `overdueReason()`/`clientOverdueReason()` widocznych na Pulpicie),
  `ostatni_kanal` (denormalizacja z ostatniego wpisu na osi — ikona na
  karcie kanban bez dociągania całej historii). Na `lead_activity`/
  `client_activity`: `kanal`, `kierunek` (oba nullable, null = wpis sprzed
  Modułu 3).
- **Kierunek kontaktu** (`Ja → oni` / `Oni → ja`) — dodany przy każdym
  wpisie na osi, żeby reguła "czeka na odpowiedź" (`isOverdue`) miała ten
  sam sygnał dla telefonu/WhatsAppu co dziś dla maila (samo `ostatni_kontakt`
  jest już kanało-agnostyczne — aktualizuje się przy KAŻDYM wpisie
  niezależnie od kanału, więc próg 4 dni działał od razu tak samo dla
  wszystkich kanałów; kierunek to dodatkowy, widoczny w UI kontekst).
- **UI** (`LeadDetailPanel.tsx`, `ClientDetailPanel.tsx`, wspólne komponenty
  w `components.tsx`): `ContactQuickActions` — rząd dużych przycisków
  (min. 44px wysokości, zweryfikowane na wąskim viewporcie) 📞 Zadzwoń /
  ✉️ Mail / 💬 WhatsApp / 🔗 LinkedIn pod nagłówkiem karty, warunkowe na
  wypełnione pola. `QuickDateChips` (Jutro/Za 3 dni/Za tydzień,
  `addDaysLocalISO()` w `lib/dates.ts`) obok `DateField` przy ustawianiu
  przypomnienia w formularzu osi. Formularz osi ma dodatkowo `PillPicker`
  kanału i przełącznik kierunku; wpisy na liście pokazują ikonę kanału +
  plakietkę kierunku.
- **Karty kanban** (Leady, Klienci) — ikona `ostatni_kanal` obok "X dni
  temu"/statusu overdue.
- **Scalony feed klienta** (`GET /api/clients/[id]`) rozszerzony o
  `kanal`/`kierunek` z obu źródeł (`client_activity` i dociągnięty
  `lead_activity` sprzed awansu na klienta) — kanał widoczny w historii
  klienta nawet dla wpisów sprzed powstania rekordu klienta.
- Przetestowane end-to-end lokalnie (PGlite): dodanie wpisu telefonicznego
  z kierunkiem i przypomnieniem "jutro" + tekstem następnego kroku →
  poprawna ikona/tag na osi, poprawna denormalizacja `ostatni_kanal` na
  karcie kanban, poprawne przeniesienie kanału do scalonego feedu po
  awansie leada na klienta. Zweryfikowane też na wąskim viewporcie (375px) —
  przyciski szybkiego kontaktu i formularz osi zawijają się czytelnie,
  cele dotykowe 44px.

### Moduł 3 — druga tura: wynik połączenia, kolorowe tagi, grupowanie dni (2026-07-14)

Po zbudowaniu podstawy właściciel poprosił o "premium UX jak w Apple/iPhone" —
kolorowe tagi per zdarzenie i wygląd dodawania połączenia jak w dzienniku
iPhone'a (odebrane/nieodebrane, czas trwania). Zaprojektowane najpierw jako
makieta w realnym ciemnym stylu marki (`mcp__visualize`) i zatwierdzone przed
kodowaniem — dopiero potem wdrożone.

- **Wynik połączenia** — nowe pole `wynik` (`CALL_OUTCOMES` w
  `lib/contact.ts`: `odebrane`/`nieodebrane`), osobne od `kierunek` (kierunek
  mówi KTO dzwonił, wynik mówi CZY się połączyło). Nowa kolumna
  `czas_trwania_sek` (sensowna tylko przy `wynik="odebrane"`, serwer
  wymusza `null` dla nieodebranych niezależnie co przyszło w żądaniu, limit
  24h). Formularz osi: gdy kanał="telefon", pojawia się przełącznik
  Odebrane/Nieodebrane (kolory jak w iOS: zielony/czerwony,
  `CALL_OUTCOME_CLASS`), a przy "Odebrane" — dwa pola liczbowe (min/s).
- **Kolorowe tagi kanałów** (`CONTACT_CHANNEL_CLASS` w `lib/contact.ts`) —
  zamiast płaskiego szarego tła każdy kanał ma stały, rozpoznawalny kolor:
  telefon turkusowy (marka), email złoty (marka), WhatsApp zielony (własny
  kolor marki WhatsApp — świadome zapożyczenie poza paletę Leggera dla
  rozpoznawalności), LinkedIn niebieski (analogicznie), spotkanie fioletowy
  (marka), inne neutralne. Wpisy na osi renderują się jako kolorowe kółka z
  emoji zamiast płaskiej ikony inline.
- **Miękka podpowiedź przy nieodebranym połączeniu przychodzącym** — gdy w
  formularzu kanał="telefon", kierunek="przychodzacy", wynik="nieodebrane" i
  nie ustawiono jeszcze `next_followup`, pojawia się czerwony przycisk
  "📵 Nieodebrane od klienta — ustaw przypomnienie na jutro" — jedno
  kliknięcie ustawia `next_followup` na jutro (`addDaysLocalISO(1)`) i
  `next_action` na "Oddzwonić". Świadomie miękkie (nie wymusza niczego,
  właściciel może zignorować) — wpina się w już istniejący mechanizm
  next_followup/next_action, więc nieodebrane połączenie automatycznie
  trafia do "Wymaga działania dziś" na Pulpicie bez żadnej nowej,
  równoległej logiki liczenia "nieobsłużonych połączeń".
- **Grupowanie osi po dniach** (styl Wiadomości/Telefonu w iOS) — wpisy w
  logu leada i w Pełnej historii klienta grupują się pod nagłówkiem
  "Dziś"/"Wczoraj"/"DD.MM.YYYY" zamiast powtarzać pełną datę przy każdym
  wpisie (`groupActivityByDay()`/`groupFeedByDay()`, lokalne w obu panelach
  — czysto kosmetyczne, nie mylić z `todayLocalISO()` z `lib/dates.ts`,
  która steruje regułami biznesowymi).
- Przetestowane end-to-end lokalnie (PGlite): nieodebrane połączenie
  przychodzące → czerwone kółko 📵 na osi, przycisk podpowiedzi widoczny
  tylko gdy `next_followup` puste, klik ustawia poprawną datę/akcję i
  przycisk znika; odebrane wychodzące z czasem trwania 3:42 → turkusowe
  kółko + "3 min 42 s" przy godzinie; scalony feed klienta poprawnie
  pokazuje kolor/czas trwania także dla wpisów dociągniętych z leada.

## Czego świadomie nie ma (na razie)

- Brak zależności między zadaniami/projektami (np. „projekt B czeka na
  ukończenie projektu A”) — oś czasu jest poglądowa, nie blokuje niczego.
- Kalendarz nie obsługuje wydarzeń cyklicznych — każde wydarzenie to
  pojedynczy wpis.
- Brak wielu użytkowników/ról — panel jest jednoosobowy z jednym hasłem
  administratora, zgodnie z założeniem "narzędzie dla solo-przedsiębiorcy".
- Brak integracji KSeF (Krajowy System e-Faktur) — świadomie odłożone,
  osobny i większy zakres (wymaga certyfikatów/uwierzytelniania API
  Ministerstwa Finansów). Podobnie brak linków do płatności online
  (Stripe/Przelewy24) — nie było w zatwierdzonym zakresie.
