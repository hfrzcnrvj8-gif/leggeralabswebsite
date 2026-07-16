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
- **Kalendarz** (`/admin/calendar`) — przełącznik widoku Miesiąc/Tydzień/
  Dzień, filtr po kliencie, klik w dzień (miesiąc) otwiera modal z pełną
  listą wydarzeń i formularzem dodawania nowego (tytuł + opcjonalna
  godzina, opcjonalne powiązanie z leadem/projektem/klientem, opcjonalny
  zakres wielodniowy). Wydarzenia da się przeciągnąć na inny dzień, tytuł
  rozpoznaje szybkie frazy typu "jutro 14:00" (bez AI — patrz Moduł 10),
  agregacja obejmuje telefon i mail, eksport/subskrypcja ICS (przycisk
  "📅 Subskrybuj", gdy skonfigurowany `CALENDAR_ICS_SECRET`) — patrz
  Moduł 10 niżej.
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

## Moduł 7 — AI: szkice odpowiedzi mailowych (2026-07-16)

W widoku odpowiadania na maila (`MailDetailPanel.tsx`, Moduł 4/4b) przycisk
"✨ Zaproponuj szkic" — obok `TemplatePickerButton`, w tym samym rządku —
generuje modelem tekstowym (Ollama) PROPOZYCJĘ treści odpowiedzi i wstawia ją
do pola `replyText`. Właściciel czyta, poprawia, dopiero wtedy klika "Wyślij
odpowiedź" — model nigdy nic nie wysyła sam (patrz CLAUDE.md, jedyny
dopuszczony wyjątek od "zero AI w logice panelu", ten sam co Moduł 8).

- **Model:** `qwen3.6:27b` (`DRAFT_MODEL`, `lib/mail-draft.ts`) — z listy
  modeli tekstowych zainstalowanych na Macu właściciela (2026-07-16:
  `qwen2.5vl:7b/32b`, `qwen3-vl:8b`, `qwen3.5:9b`, `qwen3.6:27b`,
  `qwen3-coder:30b`, `qwen3:14b`, `gemma4:26b`, `nomic-embed-text` —
  wybrany największy spośród ogólnych "qwen3.x", poza wariantami wizyjnymi
  (te zarezerwowane pod OCR, Moduł 8), coderem i embeddingami. Jakość
  polskiej prozy ma tu większe znaczenie niż przy OCR-owym odczycie pól, a
  funkcja jest klikana pojedynczo, nie w pętli — większy/wolniejszy model
  jest uzasadniony.
- **Ton/długość (decyzja właściciela 2026-07-16):** neutralny, długość
  dopasowana przez model do treści maila źródłowego (nie sztywno "krótko").
- **Kontekst do modelu** (`buildDraftPrompt()`): temat + treść maila, na
  który odpowiadamy, oraz — jeśli mail jest dopięty do klienta/leada —
  nazwa firmy, branża, status i ostatnia notatka z `client_activity`/
  `lead_activity` (`ORDER BY created_at DESC LIMIT 1`). Historia
  wcześniejszej korespondencji z tym kontaktem świadomie NIE wchodzi do
  promptu (decyzja właściciela 2026-07-16: prościej, szybciej, kontekst
  klienta wystarcza). System prompt (`DRAFT_SYSTEM`) ma jawny zakaz
  zmyślania faktów i instrukcję, żeby model nie dopisywał zamknięcia z
  podpisem — ten dokleja się osobno (przełącznik PL/EN/DE/Bez podpisu, już
  istniejący w `MailDetailPanel.tsx`).
- **`POST /api/mail/:id/draft-reply`** (admin-only, `runtime = "nodejs"`,
  `maxDuration = 60`): dociąga mail + LEFT JOIN `clients`/`leads` (ten sam
  wzorzec co `GET /api/mail/:id`), osobnym zapytaniem ostatnią notatkę z
  osi kontaktu, woła `ollamaGenerate()` (`lib/ollama.ts`, Moduł 6,
  `DRAFT_TIMEOUT_MS = 45s`), zwraca `{ draft }` albo `503` z czytelnym
  błędem ("Model AI chwilowo niedostępny — napisz odpowiedź ręcznie.") gdy
  model niedostępny. Nigdy nic nie zapisuje/wysyła.
- **UI:** klik nadpisuje CAŁE pole `replyText` treścią szkicu (decyzja
  właściciela 2026-07-16 — to pełna propozycja odpowiedzi, nie fragment do
  doklejenia jak szablon, inaczej niż `applyTemplate()`). Stan ładowania
  ("Generuję…", przycisk disabled) i błąd przez `toast()` (`useUI()`) —
  nigdy nie blokuje "Wyślij odpowiedź" ani ręcznego pisania.
- **Zweryfikowane lokalnie (2026-07-16):** `tsc` czysty; w dev (bez
  `OLLAMA_API_URL`) endpoint poprawnie zwraca `503` z kontrolowanym
  komunikatem (potwierdzone przez `GET`/`POST` w Network — brak 500,
  brak zawieszenia), pole treści zostaje puste zamiast nadpisane śmieciem,
  reszta panelu (Wyślij/Anuluj/szablony/podpis) w pełni używalna. Test
  wykonany na mailu dopiętym do klienta (Nordwind Studio), więc ścieżka
  LEFT JOIN + zapytanie o ostatnią notatkę z `client_activity` również
  przeszła bez błędu. Jakość samego tekstu szkicu (polska proza modelu
  `qwen3.6:27b` na żywej korespondencji) do potwierdzenia na produkcji z
  prawdziwym Mac Studio właściciela — jeśli jakość zawiedzie, `DRAFT_MODEL`
  to jedna stała do zmiany.

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

## Moduł 9 — Koszty jako branżowy standard (2026-07-14, w toku)

Ambicja właściciela po przetestowaniu Modułu 8 (OCR) na prawdziwej fakturze:
podciągnąć moduł Koszty w stronę Ramp/Expensify/QuickBooks/wFirma, nie tylko
"wystarczające". Duży, wieloetapowy, świadomie otwarty zakres — patrz
`docs/plany-modulow/09-koszty-branzowy-standard.md` za pełny research
konkurencji i listę pomysłów do priorytetyzacji. **Świadomie POZA zakresem:**
prawdziwa integracja z bramką płatności ("kliknij i zapłać" jak wFirma) — to
operacja finansowa, osobna decyzja biznesowa, nie dobudowanie funkcji.

**Krok 1 (zbudowany i zweryfikowany lokalnie 2026-07-14): metoda płatności +
kopiuj dane do przelewu.**

- Nowe pola na koszcie (`lib/db.ts` → `createCostsSchema`):
  `metoda_platnosci` (TEXT, NULL = nieustawiona) i `dostawca_konto` (TEXT,
  domyślnie `''` — numer konta/IBAN dostawcy).
- **`lib/costs.ts`**: `PAYMENT_METHODS` (`przelew`/`karta`/`gotowka`/`blik`/
  `paypal`/`apple_pay`) + mapy `PAYMENT_METHOD_LABEL`/`_ICON`/`_CLASS`,
  wzorem istniejącego rejestru kanałów kontaktu (`lib/contact.ts`,
  `CONTACT_CHANNEL_*`) — czysta etykieta do raportowania/uzgadniania z
  wyciągiem, **nie inicjuje żadnej płatności** (patrz "poza zakresem" wyżej;
  research w pliku modułu potwierdza, że nawet Ramp/Expensify/QuickBooks
  robią to tylko jako tag, nie jako "kliknij i zapłać").
- **UI** (`CostEditor.tsx`): plakietka metody płatności obok statusu
  (`PropertyMenu`, wzorem `StatusTag`) — klik otwiera menu z ikoną+etykietą
  każdej metody, "Brak" resetuje na `NULL`. Pole "Numer konta dostawcy" +
  przycisk "Kopiuj" obok (`IconCopy`) — kopiuje do schowka trzy linie (numer
  konta, kwota brutto przez `formatMoney`, tytuł = dostawca + opis) przez
  `navigator.clipboard.writeText`, z potwierdzeniem `toast()`. Przycisk
  wyłączony, gdy `dostawca_konto` puste. Zero integracji z bramką płatności,
  zero przenoszenia pieniędzy — czysta wygoda kopiuj-wklej, zgodnie z
  rekomendacją z researchu w pliku modułu.
- **`CostsDashboard.tsx`**: kolumna "Płatność" w tabeli — sama ikona metody
  (tooltip z pełną etykietą), `—` gdy nieustawiona.
- **API** (`app/api/costs/route.ts`, `[id]/route.ts`, `export/route.ts`):
  GET zwraca oba nowe pola, PATCH waliduje `metoda_platnosci` przeciw
  `PAYMENT_METHODS` (nieznana wartość → `NULL`, nie błąd — miękkie
  zachowanie), `dostawca_konto` zapisywany jako zwykły string (limit 40
  znaków). Eksport CSV (rejestr zakupów dla księgowej) dostał dwie nowe
  kolumny: "Metoda płatności" (etykieta PL) i "Nr konta dostawcy".
- Zweryfikowane lokalnie na dev (PGlite): dodanie kosztu → wybór metody
  "Przelew" w plakietce zapisuje się i przeżywa refetch (kolor cyan,
  ikona 🏦) → widoczne też jako ikona w kolumnie "Płatność" tabeli →
  wypełnienie numeru konta odblokowuje przycisk "Kopiuj" → klik nie rzuca
  błędu w konsoli. `tsc --noEmit` czysty.
- **Dalsze kroki modułu (nieuzgodnione jeszcze z właścicielem, do
  priorytetyzacji w kolejnym czacie)**: wykrywanie duplikatów (ten sam
  NIP+kwota+data), koszty cykliczne/subskrypcje, analityka/trendy wydatków,
  zdjęcie z aparatu na telefonie, rozpoznawanie powtarzającego się
  dostawcy po NIP — patrz plik modułu, sekcja "Dodatkowe pomysły z rynku".

**Krok 2 (zbudowany i zweryfikowany lokalnie 2026-07-14): fundamenty
zgodności prawnej + ostrzeżenia podatkowe + trzy dobre praktyki rynkowe.**
Właściciel poprosił o audyt "co trzeba dodać, żeby moduł Koszty był zgodny z
przepisami i miał integrację z przyszłą księgowością" — audyt (subagent +
research) zidentyfikował realne luki (nie tylko wygodę), opisane niżej z
podziałem 🔴 wymóg prawny / 🔵 integracja / 🟢 dobra praktyka rynkowa.
Właściciel zatwierdził wszystkie trzy zestawy do zbudowania w jednej sesji.

- 🔴 **Numer faktury dostawcy** (`numer_faktury`, TEXT) — ustawowy element
  faktury VAT (art. 106e) i osobne pole w rejestrze zakupów JPK_V7
  (`NrFaktury`). OCR (Moduł 8, `lib/costs-ocr.ts`) teraz też go wyciąga
  (nowe pole `numer_faktury` w schemacie JSON modelu wizyjnego).
- 🔴 **`data_wplywu`** (DATE, nullable) — data OTRZYMANIA faktury, osobna od
  `data_wydatku` (data wystawienia, etykieta w UI doprecyzowana na "Data
  wystawienia (wydatku)"). Prawo VAT liczy termin odliczenia od daty
  otrzymania, nie wystawienia — jeśli się różnią, jedna data myliłaby okres
  rozliczeniowy. Opcjonalne pole, wypełniane tylko gdy faktycznie różni się.
- 🔴 **Autouzupełnianie dostawcy po NIP z Białej Listy MF** —
  `lib/vies.ts` → `lookupSupplierByNip()` (analogiczny do istniejącego
  `lookupClientByNip()` używanego w Fakturach/Ofertach, ale zwraca pola
  `dostawca_*` + `numeryKont`; PL → Biała Lista MF, prefiks kraju UE →
  VIES). Przycisk 🔍 obok pola NIP w `CostEditor.tsx` (wzorem
  `InvoiceEditor.tsx`). `lib/mf.ts` → `lookupNip()` rozszerzony o
  `accountNumbers` z odpowiedzi `wl-api.mf.gov.pl` (pole `numeryKont`).
- 🔴 **Weryfikacja konta dostawcy na Białej Liście** — po wyszukaniu NIP-u
  edytor porównuje wpisany `dostawca_konto` z `numeryKont` zwróconymi przez
  MF (`normalizeAccountNumber()` w `lib/vies.ts` — same cyfry, bez `PL`).
  Zielony ✓ = zgodny, żółte ostrzeżenie = brak na liście (przelew >15 000 zł
  na takie konto grozi utratą prawa do zaliczenia w koszty bez zgłoszenia
  ZAW-NR w 7 dni — art. 117ba Ordynacji podatkowej), neutralna notatka = MF
  nie zwróciło żadnych numerów dla tego NIP-u. Czysto informacyjne, nic nie
  blokuje.
- 🔴 **% odliczenia VAT** (`vat_odliczenie_procent`, INTEGER, domyślnie 100)
  — picker 100%/50%/0% (`VAT_ODLICZENIE_OPTIONS` w `lib/costs.ts`) dla
  typowych ograniczeń: samochody mieszanego użytku (art. 86a, 50%),
  reprezentacja (art. 88 ust. 1 pkt 2, 0%). Nowe pole "VAT do odliczenia"
  (`vatDoOdliczenia()`) liczy realną kwotę do odliczenia z uwzględnieniem
  procentu — widoczne w edytorze i w eksporcie CSV.
- 🔴 **Ostrzeżenie o progu amortyzacji** — miękki żółty baner w edytorze,
  gdy kategoria = "Sprzęt" i kwota netto ≥ `AMORTYZACJA_PROG_NETTO` (10 000
  zł, art. 22k ustawy o PIT) — informuje, że wydatek może wymagać
  amortyzacji zamiast jednorazowego wrzucenia w koszty. Nic nie blokuje,
  właściciel i tak może zapisać jak chce.
- 🟢 **Wykrywanie duplikatów** — `GET /api/costs/hints` (nowy endpoint,
  `app/api/costs/hints/route.ts`) liczy dwie w pełni deterministyczne
  podpowiedzi (zero AI) na podstawie NIP+kwota+data: (1) czy istnieje inny
  koszt tego samego dostawcy z tą samą kwotą brutto i datą w oknie ±3 dni
  (`duplikat_potwierdzony` BOOLEAN pozwala świadomie wyciszyć ostrzeżenie na
  stałe dla danego kosztu — nie wraca po odświeżeniu); (2) kategoria/projekt
  z najnowszego INNEGO kosztu tego samego dostawcy, do podpowiedzi przy
  wpisywaniu kolejnego. Oba jako nienachalne banery nad formularzem w
  `CostEditor.tsx`, każdy z przyciskiem akcji ("To nie duplikat" /
  "Zastosuj") — miękkie podpowiedzi, nigdy twarde bramki.
- 🟢 **Zdjęcie z aparatu na telefonie** — drugi przycisk "Zrób zdjęcie" obok
  "Wgraj skan/PDF", osobny ukryty `<input type="file" accept="image/*"
  capture="environment">` — na telefonie otwiera od razu aparat zamiast
  wyboru pliku z galerii, pierwszy krok pod Moduł 5 (mobilna aplikacja).
- **Zweryfikowane na żywo na dev (PGlite)**: amortyzacja — kategoria
  "Sprzęt" + 15 000 zł netto pokazuje baner, znika po zmianie kategorii;
  VAT do odliczenia przelicza się poprawnie przy zmianie 100%→50% (3450 zł
  → 1725 zł); duplikat — dwa koszty tego samego NIP-u/kwoty/daty pokazują
  baner ostrzegawczy, klik "To nie duplikat" chowa go trwale (dopisany
  lokalny `setHints` obok `patch()`, bo serwer nie odświeża hintów przy
  zmianie samego `duplikat_potwierdzony`); podpowiedź kategorii — klik
  "Zastosuj" ustawia kategorię z historii dostawcy i chowa baner. `tsc
  --noEmit` czysty przez cały proces (4 przebiegi po każdej paczce zmian).
- **Wciąż nieuzgodnione** (do priorytetyzacji w kolejnej sesji): koszty
  cykliczne/subskrypcje, analityka/trendy wydatków (wykres per kategoria) —
  oba to większy, osobny zakres (nowe UI/tabela), świadomie odłożone.

**Krok 3 (zbudowany i zweryfikowany lokalnie 2026-07-14): domknięcie
Kroku 2 (własne konto, OCR konta) + oba odłożone większe elementy (koszty
cykliczne, analityka).** Właściciel poprosił o realizację wszystkich
czterech pomysłów z poprzedniej rozmowy naraz — wszystkie ocenione jako
dające realną wartość, nie tylko kosmetyczne.

- **Ostrzeżenie o własnym koncie** — `CostEditor.tsx` dociąga
  `company_settings.konto` (`GET /api/settings`, już istniejące od
  faktur) przy otwarciu kosztu i porównuje znormalizowany numer z
  `dostawca_konto`; zgodność → żółte ostrzeżenie "To wygląda na numer
  konta Twojej własnej firmy…" (typowa pomyłka przy kopiowaniu danych z
  faktury). Priorytet wyższy niż ostrzeżenie Białej Listy (bardziej
  podstawowy błąd).
- **OCR wyciąga numer konta dostawcy** — `lib/costs-ocr.ts`: prompt i
  schemat JSON modelu rozszerzone o `numer_konta`, `parseOcrResponse`
  akceptuje wynik tylko gdy po usunięciu spacji/prefiksu `PL` zostaje
  dokładnie 26 cyfr (wiarygodna długość polskiego IBAN-u) — inaczej pusty
  string zamiast zgadywania. W `CostEditor.tsx` sugestia wypełnia
  `dostawca_konto` TYLKO gdy pole jest jeszcze puste (świadomie NIE
  nadpisuje cicho czegoś, co właściciel już ręcznie sprawdził — pole
  steruje przelewem).
- **Koszty cykliczne** (abonamenty/subskrypcje) — wzorem `recurring_invoices`
  (`lib/recurring.ts`, `RecurringPanel.tsx`), ale generuje SZKICE KOSZTÓW,
  nie faktur:
  - Nowa tabela `recurring_costs` (`lib/db.ts`) — szablon: dane dostawcy,
    kategoria, kwota netto/VAT, metoda płatności, projekt, `cykl`
    (re-used `RECURRING_CYCLES`/`RECURRING_CYCLE_LABEL`/`nextRunAfter`
    z `lib/recurring.ts` — bez duplikowania logiki), `next_run`, `active`.
  - `app/api/recurring-costs/route.ts` + `[id]/route.ts` — CRUD wzorem
    `app/api/recurring/*`.
  - `generateDueRecurringCosts()` w `app/api/leads/notify/route.ts`
    (ten sam dzienny raport co faktury cykliczne i przypomnienia o
    płatnościach) — dla każdego aktywnego szablonu z `next_run <= dziś`
    tworzy nowy koszt "Nieopłacony" ze skopiowanymi danymi (opis:
    "Wygenerowano automatycznie z cyklicznego szablonu „X”."), przesuwa
    `next_run` o kalendarzowy cykl. Właściciel i tak musi ręcznie
    sprawdzić kwotę (mogła się zmienić) i oznaczyć jako opłacony — zero
    automatycznych płatności. Linia w mailu dziennym: "Wygenerowane dziś
    szkice kosztów cyklicznych: N".
  - `RecurringCostsPanel.tsx` (nowy plik, wzorem `RecurringPanel.tsx`) +
    przycisk "🔁 Cykliczne" w `CostsDashboard.tsx` obok eksportu CSV.
  - **Nie zweryfikowane w tej sesji**: samo wywołanie
    `generateDueRecurringCosts()` przez `POST /api/leads/notify` — ten
    endpoint wysyła też prawdziwego maila (`sendEmail`), który w dev bez
    `RESEND_API_KEY` rzuca błędem przed dotarciem do sekcji kosztów
    cyklicznych (to samo ograniczenie dotyczy już istniejącej generacji
    faktur cyklicznych — nic nowego). Logika jest bezpośrednią kopią
    już działającego na produkcji wzorca `generateDueRecurringInvoices()`
    (te same zapytania SQL, ten sam `nextRunAfter`) — do potwierdzenia
    przy najbliższym uruchomieniu dziennego crona na produkcji.
- **Analityka/trendy wydatków** — `GET /api/costs/analytics?months=N`
  (`app/api/costs/analytics/route.ts`): czyste `SUM/GROUP BY` po
  `to_char(data_wydatku,'YYYY-MM')` i kategorii, zero AI. `SpendTrendChart.tsx`
  (nowy plik) — wykres słupkowy skumulowany (jeden słupek = miesiąc,
  segmenty = 7 kategorii `COST_CATEGORIES` w stałej kolejności), wbudowany
  w `CostsDashboard.tsx` nad tabelą (ukryty przy filtrze projektu — wtedy
  trend całej firmy nie ma sensu). Zbudowany wg `dataviz` skill:
  - Paleta = pierwsze 7 slotów zwalidowanej domyślnej palety kategorycznej
    (`node scripts/validate_palette.js` — PASS light i dark, worst-case
    CVD w paśmie WARN 8–12 dla trybu ciemnego, więc zgodnie z regułą
    dodane relief: liczbowa etykieta sumy nad każdym słupkiem + legenda z
    nazwą i sumą kategorii, nigdy sam kolor).
  - Kolory jako CSS custom properties (`--s1`…`--s7`) osobno dla jasnego i
    `.dark` (ten sam mechanizm co `globals.css`), 2 px odstęp między
    segmentami stosu, zaokrąglony górny segment.
  - Hover na segmencie → tooltip (kategoria + dokładna kwota za miesiąc) +
    przyciemnienie pozostałych segmentów tego słupka; przełącznik
    6/12 miesięcy.
- **Zweryfikowane na żywo na dev (PGlite, 9 testowych kosztów w 3
  miesiącach)**: wykres poprawnie agreguje i stackuje (sumy legendy zgodne
  z ręcznym przeliczeniem brutto), przełącznik 6↔12 miesięcy działa,
  hover pokazuje poprawny tooltip i przyciemnia resztę słupka; panel
  Koszty cykliczne — utworzenie szablonu, edycja pól (dostawca, kwota →
  automatyczne przeliczenie brutto), przełącznik "Aktywny" — wszystko
  potwierdzone zapisane w bazie przez bezpośrednie odpytanie API po
  interakcji w przeglądarce; ostrzeżenie o własnym koncie — potwierdzone
  wizualnie po ustawieniu `company_settings.konto` i dopasowaniu numeru
  konta kosztu. `tsc --noEmit` czysty po każdej paczce zmian.

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

### Moduł 3 — trzecia tura: połączenia w Kalendarzu (2026-07-14)

Właściciel poprosił, żeby historia kontaktu agregowała się też w Kalendarzu.
Świadomie **tylko połączenia telefoniczne**, nie cała historia kontaktu
(zatwierdzone przez właściciela) — kalendarz pokazuje maks. 2 pozycje na
dzień + "+N więcej", więc każda notatka/mail zalogowana jako wpis osi
zagłuszyłaby ważniejsze terminy (płatności, kamienie milowe).

- `app/api/events/deadlines/route.ts` — ten sam, już istniejący wzorzec
  "wyliczonych terminów" co płatności/kamienie/przypomnienia (endpoint
  tylko do odczytu, kalendarz niczego tu nie zapisuje ani nie usuwa). Nowe
  zapytania do `lead_activity`/`client_activity` gdzie `kanal='telefon'` w
  danym miesiącu, zjoinowane z nazwą leada/klienta. Dwa nowe `DeadlineKind`:
  `call` (odebrane, tytuł z czasem trwania gdy znany —
  `formatCallDuration()` z `lib/contact.ts`) i `call-missed` (nieodebrane).
- `CalendarView.tsx` — `DEADLINE_STYLE` rozszerzony o te dwa rodzaje,
  kolory świadomie identyczne z tym, co już widać na osi kontaktu:
  `call` = turkus (`brand-cyan`, jak `CONTACT_CHANNEL_CLASS.telefon`),
  `call-missed` = czerwony (jak `CALL_OUTCOME_CLASS.nieodebrane`) — jeden
  spójny język kolorów w całym panelu, nie osobna paleta dla kalendarza.
  Klik w pozycję prowadzi do karty leada/klienta (`href` z tego samego
  mechanizmu co reszta wyliczonych terminów).
- Przetestowane end-to-end lokalnie (PGlite): odebrane i nieodebrane
  połączenie dodane leadowi → oba widoczne w komórce dnia i w panelu
  bocznym z poprawnymi kolorami/tytułami, klik w "Połączenie — …" prowadzi
  do właściwego leada.

### Moduł 3 — czwarta tura: szybka notatka z telefonu + gotowość pod VoIP (2026-07-14)

Domknięcie modułu: "Opcja A" z pliku modułu (mobilna szybka notatka) +
przygotowanie generycznego webhooka pod przyszłe konto VoIP (właściciel
jeszcze go nie założył — patrz [[telefonia-voip-plan]] w pamięci projektu).

- **`lib/contactLookup.ts`** — nowy, serwerowy moduł: `findContactsByPhone()`
  dopasowuje leada/klienta po ostatnich 9 cyfrach numeru (niezależnie od
  formatu zapisu — spacje, myślniki, prefiks). Jedno wspólne miejsce
  dopasowania numeru, użyte i przez ręczną ścieżkę (quick-log), i przez
  przyszłą automatyczną (webhook) — żeby obie się zgadzały.
- **`GET /api/contacts/lookup?telefon=...`** — cienki wrapper na
  `findContactsByPhone()`, zwraca listę dopasowań `{type: "lead"|"client",
  id, nazwa}`.
- **`/admin/quick-log`** (`QuickLogView.tsx`) — mobilna "szybka notatka":
  wklej/wpisz numer → "Szukaj" → automatyczny skok do formularza przy
  jednym dopasowaniu (albo lista do wyboru przy kilku, albo komunikat "nie
  znaleziono" z linkiem do Leadów) → notatka (dyktowana głosem przez
  wbudowany mikrofon klawiatury iOS, nic specjalnego nie trzeba
  konfigurować) + kanał/kierunek/wynik/czas trwania (te same kontrolki co w
  `LeadDetailPanel`/`ClientDetailPanel`) → zapis przez te same, istniejące
  endpointy `.../activity` (zero nowej logiki zapisu). Po zapisie — "Zaloguj
  kolejny kontakt" zamiast wracać do zera. Pomyślana pod "Dodaj do ekranu
  początkowego" w Safari — otwiera się jak osobna apka, korzysta z tej samej
  sesji logowania co reszta panelu (żadnego nowego uwierzytelniania).
- **`POST /api/telefonia/webhook?token=...`** — gotowy, ale **jeszcze
  NIEUŻYWANY naprawdę** (fail-closed: 500 dopóki `TELEFONIA_WEBHOOK_SECRET`
  nie jest ustawiony w env, wzorem `CRON_SECRET` w
  `app/api/leads/notify/route.ts`). Token w query string, nie w nagłówku —
  większość dostawców VoIP pozwala skonfigurować tylko URL webhooka.
  Generyczny payload (`telefon`, opcjonalnie `kierunek`/`wynik`/
  `czas_trwania_sek`/`opis`) — gdy właściciel założy konto (rozważana
  Zadarma), trzeba będzie dopasować tylko NAZWY pól do tego, co faktycznie
  wysyła webhook danego dostawcy; cała logika dopasowania numeru i zapisu
  wpisu już działa i jest przetestowana. Numer niepasujący do żadnego
  leada/klienta → `200 {matched: false}`, nie błąd (webhook VoIP nie
  powinien dostawać błędu za zdarzenie, które nas nie dotyczy).
- **Kolorowa odznaka kanału na kartach kanban i w widoku Tabela**
  (Leady/Klienci) — `ostatni_kanal` renderuje się teraz jako małe kolorowe
  kółko (`CONTACT_CHANNEL_CLASS`) zamiast płaskiej emoji inline, spójnie z
  osią kontaktu. Widok Tabela dostał też widoczny link LinkedIn (gdy
  wypełniony) obok telefonu/maila.
- Przetestowane end-to-end lokalnie (PGlite): lookup po numerze ze
  spacjami trafia poprawny lead; pełny przepływ quick-log (numer → wybór →
  notatka + odebrane → zapis) tworzy poprawny wpis na osi z kanałem/
  kierunkiem/wynikiem; webhook bez `TELEFONIA_WEBHOOK_SECRET` poprawnie
  odrzuca żądanie (500, czytelny komunikat); kolorowa odznaka widoczna w
  Tabeli po zalogowaniu połączenia.

**Moduł 3 jest tym samym w pełni zamknięty** — dalsze pomysły (widżet do
dzwonienia z komputera w Hub, natywna apka-towarzysz do CallKit) są
świadomie odłożone na przyszłość, patrz [[telefonia-voip-plan]]. Dalsza
praca nad agregacją w Kalendarzu ("wszystkie działania z tagami,
dopasowaniem do klienta") kontynuowana w Module 10, patrz
`docs/plany-modulow/10-kalendarz-dopracowanie.md`.

### Moduł 10 — dopracowanie Kalendarza (2026-07-14)

Odpowiedź na `docs/plany-modulow/10-kalendarz-dopracowanie.md` — właściciel
zdecydował: zakres agregacji zostaje na razie tylko przy telefonie (bez
maili/WhatsApp/notatek), "dopasowanie do klienta" oznacza I powiązanie
ręcznego wydarzenia z klientem I filtrowanie kalendarza po kliencie, tagi
to nadal kolory (bez nowej struktury), a limit 2+"więcej" na dzień zastąpiony
— dodano modal dnia (pełna lista) oraz widoki Tydzień/Dzień.

- `events.client_id` (nowa kolumna, `ALTER TABLE ... ADD COLUMN IF NOT
  EXISTS`, wzorem `leads`/`offers`/`invoices`/`projects` — nullable,
  `ON DELETE SET NULL`) — ręczne wydarzenie może teraz być powiązane z
  klientem, obok istniejącego leada/projektu. `POST`/`PATCH /api/events`
  obsługują nowe pole; `PATCH` dostał też brakujące wcześniej
  `lead_id`/`project_id`.
- `Deadline.client_id` (`app/api/events/deadlines/route.ts`) — każdy
  wyliczony termin (faktura/projekt/kamień/lead/klient/połączenie) niesie
  teraz `client_id`, ustalony bezpośrednio albo przez powiązany
  lead/projekt — żeby filtr po kliencie działał jednolicie na ręcznych
  wydarzeniach i wyliczonych terminach, niezależnie od typu.
- **Filtr po kliencie** — dropdown w pasku górnym (`Wszyscy klienci` +
  lista), filtruje jednocześnie wydarzenia i terminy w bieżącym widoku po
  stronie klienta (dane już wczytane w danym miesiącu, bez dodatkowego
  zapytania).
- **Modal dnia** (wzorem `LeadDetailPanel.tsx` — wyśrodkowany,
  backdrop-blur, `framer-motion`) zastępuje sztywny limit 2 pozycji +
  "więcej" w widoku miesiąca: klik w dzień pokazuje PEŁNĄ, przewijalną
  listę wydarzeń i terminów tego dnia plus formularz dodawania (z
  wyborem klienta/leada/projektu). Podgląd w komórce siatki miesiąca
  nadal skraca do 2 pozycji + "+N więcej" — to celowe, dotyczy tylko
  gęstości siatki, nie danych.
- **Widoki Tydzień/Dzień** — przełącznik obok "Miesiąc" w pasku górnym.
  Tydzień: 7 kolumn (Pon–Nie), każda z pełną, przewijalną listą (bez
  limitu) i przyciskiem "+" otwierającym ten sam modal dnia. Dzień:
  pojedyncza kolumna z pełną agendą i formularzem dodawania wbudowanym
  bezpośrednio w widok (bez modala). Nawigacja ←/→ przełącza
  miesiąc/tydzień/dzień zależnie od aktywnego widoku; dane spoza
  aktualnie wczytanego miesiąca (np. tydzień na przełomie miesięcy)
  dociągane są automatycznie dla brakujących miesięcy.
- Przetestowane lokalnie (PGlite): modal dnia otwiera się z poprawną datą
  i pełną listą, formularz dodaje wydarzenie z powiązaniem
  klient/lead/projekt, widok Tydzień poprawnie renderuje 7 kolumn z
  przyciskiem "+" per dzień, widok Dzień renderuje pojedynczą agendę.

### Moduł 10 — druga tura: maile, wielodniowe, przeciąganie, ICS, szybkie dodawanie (2026-07-14)

Właściciel poprosił o rozszerzenie: dołożyć maile do agregacji (teraz, gdy
modal/widoki bez limitu robią gęstość dnia mniej dotkliwą) oraz wszystkie
pomysły zainspirowane innymi kalendarzami (drag&drop, wydarzenia
wielodniowe, eksport ICS, szybkie dodawanie tekstem). Zero AI/LLM
zachowane — szybkie dodawanie jest w pełni deterministyczne (regexy), nie
model językowy.

- **Maile w agregacji** — `app/api/events/deadlines/route.ts` dokłada
  `kanal='email'` z `lead_activity`/`client_activity` jako nowy
  `DeadlineKind: "email"` (kolor indygo, odróżniony od złotej "Płatność" i
  turkusowego "Połączenie"). Bez rozróżnienia wynik/nieodebrany (dotyczy
  tylko telefonu) — tytuł pokazuje tylko kierunek ("Email do —"/"Email
  od —").
- **Wydarzenia wielodniowe** — nowa kolumna `events.data_koniec` (DATE,
  nullable, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` w `createHubSchema()`
  w `lib/db.ts`). `null`/wcześniejsza niż `data` = wydarzenie jednodniowe
  (zachowanie sprzed zmiany). `expandEventDays()` (`lib/events.ts`) zwraca
  wszystkie dni zakresu włącznie (limit 366 dni jako zabezpieczenie) —
  używane przy budowaniu mapy dzień→wydarzenia w siatce/tygodniu/dniu/
  modalu, więc wielodniowe wydarzenie pojawia się w każdym dniu zakresu.
  `GET /api/events` filtruje po **nakładaniu się** z miesiącem
  (`data <= koniec_miesiąca AND COALESCE(data_koniec, data) >=
  początek_miesiąca`), nie po samej `data` — inaczej wydarzenie zaczęte w
  poprzednim miesiącu zniknęłoby z widoku miesiąca, w którym realnie
  trwa. Formularz dodawania: przycisk "Wielodniowe" odsłania pole "Do dnia".
- **Przeciąganie (drag&drop)** — natywne HTML5 D&D (`draggable`,
  `onDragStart`/`onDragOver`/`onDrop`), bez biblioteki. Działa na chipach
  ręcznych wydarzeń w siatce miesiąca i na pozycjach w widoku
  Tydzień/modalu/widoku Dnia (`DayAgendaList`); upuszczenie na inny dzień
  (komórka miesiąca albo kolumna tygodnia) wywołuje `PATCH /api/events/:id`
  z nową `data` — dla wydarzeń wielodniowych `data_koniec` przesuwa się o
  tyle samo, żeby zachować długość zakresu (`moveEvent()` w
  `CalendarView.tsx`). Wyliczone terminy (deadlines) nie są przeciągalne —
  żyją w swoich modułach, kalendarz ich nie zapisuje.
- **Eksport/subskrypcja ICS** — `GET /api/calendar/ics?token=...`
  (`app/api/calendar/ics/route.ts`) zwraca plik `.ics` (RFC 5545) z
  ręcznych wydarzeń (nie z wyliczonych terminów — te żyją w swoich
  modułach). Fail-closed wzorem `TELEFONIA_WEBHOOK_SECRET`
  (`app/api/telefonia/webhook/route.ts`): jeśli `CALENDAR_ICS_SECRET` nie
  jest ustawiony w env, endpoint zwraca 500 zamiast być cicho publiczny.
  Wszystkie wpisy jako całodniowe (`DTSTART;VALUE=DATE`), godzina (jeśli
  ustawiona) ląduje w tytule — świadomie unikamy obsługi stref czasowych w
  ICS. `GET /api/calendar/ics-info` (admin-only, `isAuthed()`) mówi
  panelowi, czy sekret jest ustawiony, i zwraca go, żeby
  `IcsSubscribeButton` w `CalendarView.tsx` mogło złożyć gotowy do
  skopiowania link — przycisk "📅 Subskrybuj" w pasku górnym pojawia się
  tylko, gdy skonfigurowane. **Żeby włączyć**: ustaw `CALENDAR_ICS_SECRET`
  (dowolny losowy string) w zmiennych środowiskowych Vercela — wtedy link
  można wkleić jako subskrypcję w Apple Calendar ("Dodaj kalendarz →
  Subskrybuj") albo Google Calendar ("Z adresu URL").
- **Szybkie dodawanie tekstem** — `parseQuickAdd()` (`lib/events.ts`),
  w pełni deterministyczne (regexy, zero AI/LLM, zgodnie z zasadą
  projektu). Rozpoznaje na początku tekstu: "dziś"/"dzisiaj", "jutro",
  "pojutrze", "za N dni/tydzień/tygodni", "w/we <dzień tygodnia>",
  "DD.MM"/"DD.MM.RRRR" (bez roku = najbliższe wystąpienie tej daty, rok do
  przodu jeśli już minęła); godzinę rozpoznaje gdziekolwiek w tekście
  ("o 14", "14:00"). Rozpoznane frazy są usuwane z tekstu — reszta staje
  się tytułem. Pole formularza dodawania działa więc jak zwykłe pole
  tytułu ORAZ jak szybki wpis — użytkownik nie musi wybierać trybu.
  Świadomy kompromis: literalny tytuł zaczynający się od jednego z tych
  słów (np. wydarzenie faktycznie nazwane "Wtorek — przegląd zarządu")
  zostanie błędnie zinterpretowany jako data; w praktyce rzadkie i łatwe
  do poprawienia (usunięcie wydarzenia i dodanie ponownie z innym
  sformułowaniem).
- Przetestowane: `npx tsc --noEmit` czysty po całej turze zmian (schema,
  API, deadlines route, CalendarView, ICS). Weryfikacja w przeglądarce nie
  była możliwa w tej sesji (port 3000 zajęty przez serwer dev innej sesji
  równoległej) — logika pokrywa się wzorcowo z już zweryfikowaną pierwszą
  turą Modułu 10 (modal/widoki/formularz), nowe funkcje (drag&drop, ICS,
  quick-add, wielodniowe) warto przeklikać przy najbliższej okazji w
  przeglądarce.

### Moduł 10 — trzecia tura: siatka godzinowa, łączone filtry, "Dziś", pełny ekran (2026-07-14)

Właściciel poprosił o dorzucenie reszty wzorców z topowych kalendarzy
(Notion Calendar/Cron, Google Calendar) — bloki o wysokości = czas trwania,
łączone filtry, szybki skok "Dziś", tryb pełnoekranowy.

- **Czas trwania + siatka godzinowa** — nowa kolumna
  `events.czas_trwania_min` (INTEGER, nullable, ma sens tylko z ustawioną
  `godzina`). Widoki Dzień/Tydzień renderują teraz prawdziwą siatkę godzin
  (`TimelineGridRow`/`HourLabels`/`WeekTimeline`/`DayTimeline` w
  `CalendarView.tsx`, zakres domyślnie 7–21, rozszerzany, gdy wydarzenie
  wystaje poza — `timelineRange()`): wydarzenia z godziną są blokami o
  wysokości = czas trwania (domyślnie 60 min, gdy nieustawiony), nakładające
  się dostają równe kolumny obok siebie (`layoutTimedEvents()` w
  `lib/events.ts` — klasyczny algorytm "sweep" z Google/Notion Calendar).
  Wydarzenia bez godziny + wyliczone terminy dalej renderują się w pasku
  "cały dzień" nad siatką (`DayAgendaList`, bez zmian). Czerwona linia "teraz"
  w kolumnie dzisiejszego dnia. Przeciąganie bloku w pionie zmienia godzinę
  (zaokrąglone do 15 min, `moveEventToTime()`), przeciąganie na inną kolumnę
  dnia (widok Tydzień) zmienia też dzień. Formularz dodawania: pole godziny
  odsłania dodatkowy `<select>` czasu trwania (15 min – 3 godz.).
- **ICS z realną godziną** — `buildICS()` (`lib/events.ts`) używa teraz
  DATE-TIME (floating local, bez `Z`/`TZID`) z `czas_trwania_min`, gdy
  `godzina` ustawiona, zamiast zawsze całodniowego wpisu z godziną w
  tytule — subskrybowany kalendarz pokazuje realne bloki czasu, nie tylko
  całodniowe paski.
- **Łączone filtry** — obok filtra klienta doszły filtry leada i projektu
  (AND: pozycja musi pasować do KAŻDEGO ustawionego filtra). `Deadline`
  (`app/api/events/deadlines/route.ts`) dostał `lead_id`/`project_id` obok
  istniejącego `client_id` (ustalane bezpośrednio albo przez
  `projects.lead_id`), żeby filtrowanie działało jednolicie na wszystkich
  typach wpisów, nie tylko ręcznych wydarzeniach.
- **Przycisk "Dziś"** — obok przełącznika widoku, skacze do dzisiejszego
  dnia niezależnie od aktywnego widoku (miesiąc/tydzień/dzień) i tego, jak
  daleko się nawigowało.
- **Tryb pełnego ekranu** — natywne Fullscreen API (`requestFullscreen()`/
  `document.fullscreenElement`/zdarzenie `fullscreenchange`) na kontenerze
  całego widoku kalendarza — bez żadnej biblioteki. Przycisk "⛶"/"⤡" w
  pasku górnym. **Nie dało się zweryfikować w tej sesji** — Browser pane
  używane do podglądu działa we `<iframe>` bez `allow="fullscreen"`, więc
  `requestFullscreen()` odrzuca się z "Permissions check failed" (sprawdzone
  bezpośrednio w konsoli) — to ograniczenie środowiska podglądu, nie kodu;
  w prawdziwej karcie przeglądarki (Vercel/produkcja) zadziała standardowo.
  Warto przeklikać na żywej stronie przy najbliższej okazji.
- Przetestowane w przeglądarce (lokalny podgląd, port zwolniony przez
  równoległą sesję): siatka godzinowa Tydzień/Dzień renderuje poprawnie
  wyrównane rzędy godzin, dodanie wydarzenia z godziną 11:30/60 min pokazało
  poprawnie pozycjonowany i wysokościowo skalowany blok, usunięcie z bloku
  zadziałało, `Dziś`/łączone filtry/pasek narzędzi renderują się poprawnie,
  `GET /api/calendar/ics-info` poprawnie zwraca `configured:false` (brak
  `CALENDAR_ICS_SECRET` lokalnie) — przycisk "Subskrybuj" poprawnie ukryty.

### Moduł 10 — czwarta tura: wypełnienie przestrzeni, podgląd dnia w stylu Apple, spójny picker godziny (2026-07-14)

Właściciel wskazał konkretne problemy UX po wdrożeniu: dużo niewykorzystanej
przestrzeni w widoku miesiąca (zwłaszcza pełny ekran), pełnoekranowy modal
dnia zbyt ciężki (poprosił o coś bliższego Apple Calendar — mały podgląd
przy klikniętym dniu z przełączaniem strzałkami), niespójny natywny picker
godziny, i możliwość dodawania wydarzeń bezpośrednio tylko w widoku
miesiąca (nie w Tygodniu/Dniu).

- **Siatka miesiąca wypełnia dostępną wysokość** — `CalendarView.tsx`
  root jest teraz `flex flex-col`; poza pełnym ekranem ma
  `min-h-[calc(100vh-140px)]`, treść (`flex-1 min-h-0 overflow-y-auto`)
  rozciąga kartę miesiąca (`flex-1 flex-col`), a sama siatka dni używa
  `grid-auto-rows: 1fr`, żeby wiersze tygodni rozciągnęły się na całą
  wysokość zamiast zostawiać pustą przestrzeń pod spodem. Limit podglądu w
  komórce podniesiony z 2 do 3 pozycji (więcej miejsca = mniej "+N więcej").
- **Podgląd dnia w stylu Apple Calendar** (`DayPeekContent`) zastępuje
  pełnoekranowy modal — każda komórka miesiąca i każda kolumna tygodnia to
  teraz osobny `Popover` (ten sam współdzielony komponent z `Menu.tsx`, użyty
  już w innych miejscach panelu), którego trigger jest całą komórką/kolumną.
  Zamiast ciemnego, pełnoekranowego tła — mały, zakotwiczony przy klikniętym
  dniu kafelek. Strzałki ‹/› wewnątrz **przełączają wyświetlany dzień bez
  zamykania i bez przesuwania popovera** (ten sam mechanizm co realny Apple
  Calendar — popover zostaje w miejscu kliknięcia, zmienia się tylko treść).
- **Bug w `Popover` (Menu.tsx), naprawiony przy okazji, dotyczy WSZYSTKICH
  jego użyć w panelu, nie tylko kalendarza**: treść popovera renderuje się
  przez `createPortal` bezpośrednio do `<body>`, POZA scope'em klasy
  `.admin-linear` na korzeniu `AppShell`, która definiuje
  `--fg`/`--fg-muted`/`--hairline` (ciemna paleta panelu). Bez tej klasy
  `var(--fg)`/`text-muted` w portalowanej treści spadały do jasnych tokenów
  strony publicznej (`:root`) — ciemny tekst na tym samym ciemnym tle
  popovera, praktycznie nieczytelny. Naprawa: dodano klasę `admin-linear`
  (i jawny `text-[var(--fg)]` jako domyślny kolor tekstu) na portalowanym
  wrapperze w `Popover`. Odkryte i naprawione podczas testowania nowego
  podglądu dnia — wcześniejsze użycia `Popover` w panelu (np.
  `ClientPickerButton`) prawdopodobnie nie polegały aż tak mocno na
  `text-muted`/`var(--fg)`, stąd problem nie był widoczny wcześniej.
- **Spójny picker godziny** (`TimeSelect` w `CalendarView.tsx`) zastępuje
  natywny `<input type="time">` — ten renderował się drastycznie różnie
  między przeglądarkami/systemami (np. kółko z minutami), co odstawało od
  reszty custom-stylowanego UI panelu. Dwa `<select>` (godzina/minuta, krok
  15 min — pasuje do granulacji przeciągania w siatce godzinowej), wizualnie
  spójne z resztą selectów w formularzu.
- **Dodawanie bezpośrednio w siatce godzinowej (Tydzień/Dzień)** — klik w
  puste miejsce siatki (nie tylko przycisk "+") wylicza godzinę z pozycji
  kliknięcia (zaokrągloną do 15 min, ten sam algorytm co przeciąganie) i
  otwiera dodawanie z góry wypełnioną godziną: w Tygodniu — ten sam podgląd
  Apple-style (`DayPeekContent`, zakotwiczony przy kolumnie dnia); w Dniu —
  wypełnia pole godziny w formularzu, który i tak jest tam zawsze widoczny.
  Domyka zgłoszony problem "tylko w miesiącu można dodawać bezpośrednio w
  polach kalendarza" — teraz wszystkie trzy widoki wspierają to tak samo.
- Przetestowane w przeglądarce: podgląd dnia otwiera się zakotwiczony przy
  komórce 14 lipca z poprawnym kontrastem (białym tekstem) po naprawie
  Popovera; strzałka "Następny dzień" poprawnie przełącza treść na 15 lipca
  bez zamykania/przesuwania kafelka; klik w puste miejsce siatki godzinowej
  Tygodnia (symulowany na godz. 13:15) poprawnie otworzył podgląd z
  wypełnioną godziną `13:15`; analogiczny klik w widoku Dnia poprawnie
  ustawił `09` w selekcie godziny widocznego formularza. `npx tsc --noEmit`
  czysty. Tryb pełnoekranowy nadal nie do zweryfikowania w tym środowisku
  podglądu (iframe bez `allow="fullscreen"`) — kod niezmieniony względem
  poprzedniej tury, warto przeklikać na żywej stronie.

### Moduł 10 — piąta tura: przebudowa 1:1 na wzór Notion Calendar (2026-07-14)

Właściciel przesłał zrzuty ekranu Notion Calendar (dzień/tydzień, panel
szczegółów wydarzenia, sidebar z mini-kalendarzem i listą "kalendarzy",
kolorowe bloki z lewym paskiem) i poprosił o przeniesienie wyglądu/
funkcjonalności "żywcem 1:1", z zachowaniem palety marki i integracji z
resztą panelu. Świadomie NIE skopiowano jednego elementu: stałego panelu
szczegółów na całą wysokość ekranu po prawej — koliduje z już ustaloną
konwencją panelu (`CLAUDE.md`, wyśrodkowany modal zamiast panelu z prawej
dla profili rekordów); zamiast tego wzbogacono treść już istniejącego,
zakotwiczonego podglądu dnia (z poprzedniej tury) o elementy z panelu
Notion (kolor, zakres godzin, klikalne powiązania).

- **Sidebar** (`Sidebar` w `CalendarView.tsx`, ~200px, wzorem lewej kolumny
  Notion Calendar) — zastępuje dawną statyczną legendę na dole siatki:
  - `MiniMonthCalendar` — klikalny mini-kalendarz miesiąca (dziś na
    czerwono, wybrany dzień podświetlony), strzałki ‹/› do zmiany miesiąca
    niezależnie od aktywnego widoku Miesiąc/Tydzień/Dzień — szybki skok do
    dowolnego dnia, jak w Notion.
  - **"Kalendarze"** — lista rodzajów wpisów (Wydarzenia + wszystkie
    `DeadlineKind`) z kolorową kropką, klik = toggle widoczności
    (`hiddenKinds: Set<string>` w stanie `CalendarView`, filtrowane w
    `filteredEvents`/`filteredDeadlines` obok istniejących filtrów
    klient/lead/projekt). Odpowiednik włączania/wyłączania kalendarzy w
    Notion, tylko po TYPIE wpisu zamiast po koncie/kalendarzu zewnętrznym
    (nie mamy wielu kont — to nasz sensowny odpowiednik).
- **Kolorowe bloki wydarzeń** (lewy pasek `border-l` + podbarwione tło
  `bg-*/10`, wzorem Notion) zamiast cienkich plakietek — dotyczy chipów w
  siatce miesiąca, bloków w siatce godzinowej Dzień/Tydzień i pozycji na
  liście dnia. `DEADLINE_STYLE` rozszerzony o `border`/`bg` obok
  istniejących `dot`/`label`. **Ręczne wydarzenia dostają kolor
  automatycznie z powiązania** (`eventStyle()`) — klient → cyan (marka),
  lead → gold/orange, projekt → purple (marka), brak powiązania → domyślny
  niebieski. To jest właśnie "integracja z modułami" widoczna na pierwszy
  rzut oka, bez dodatkowego klikania — sam kolor mówi, z czym wydarzenie
  jest związane.
- **Wzbogacona lista dnia** (`DayAgendaList`) — zakres godzin z czasem
  trwania (`formatTimeRange()`: "10:00–11:00" zamiast samego "10:00"),
  klikalne odnośniki do powiązanego klienta/leada/projektu (emoji-ikona +
  nazwa, kolor jak reszta encji: 👤 cyan / 🎯 orange / 📁 purple),
  prowadzące bezpośrednio do karty rekordu — wzorem pól
  Participants/Location w panelu Event w Notion Calendar.
- **Przełącznik widoku jako dropdown** ("Miesiąc ▾", `ViewDropdown`) —
  zamiast segmentowanych przycisków, wzorem górnego paska Notion Calendar.
- Przetestowane w przeglądarce (viewport 1600×900 — na wąskim viewport
  ~800px pasek narzędzi zawija się na dwie linie, co jest akceptowalne,
  typowe szerokości desktopowe mieszczą wszystko w jednym rzędzie): sidebar
  renderuje mini-kalendarz i listę kalendarzy poprawnie; wyłączenie
  "Kamień" w sidebarze poprawnie ukryło oba kamienie milowe z siatki
  miesiąca (16 i 28 lipca) i przywróciło je po ponownym włączeniu; dropdown
  widoku poprawnie przełącza na Tydzień, siatka godzinowa renderuje
  kolorowe bloki z lewym paskiem, wyrównane rzędy godzin i czerwoną linię
  "teraz". `npx tsc --noEmit` czysty po całej turze zmian.

### Moduł 10 — szósta tura: dalsze dopieszczanie pod Notion Calendar (2026-07-14)

Właściciel przesłał kolejne zrzuty (gęsty widok Tygodnia z podwójną osią
stref czasowych i panelem "Upcoming"/skrótów; osobny szablon "Timeblock
Calendar" oparty na bazach Notion) i poprosił o sprawdzenie WSZYSTKICH
funkcji Notion Calendar pod kątem dalszego podobieństwa. Drugi zrzut
(karty time-block w kolumnach tygodnia) pominięty świadomie — to inny
produkt Notion (szablon bazodanowy, nie prawdziwy kalendarz), którego
metafora "kart zamiast siatki godzinowej" obniżyłaby użyteczność
prawdziwego kalendarza czasu. Z pierwszego zrzutu przeniesione:

- **Czerwona plakietka "dziś"** w nagłówkach kolumn widoku Tygodnia — data
  dnia w kółku (czerwone tylko dla dzisiejszego dnia), obok skróconej nazwy
  dnia tygodnia, wzorem "Wed [17]" w Notion Calendar.
- **Widget "Najbliżej" w sidebarze** (`upcomingItem`, między mini-kalendarzem
  a listą "Kalendarze") — odpowiednik "Upcoming in 45 min" z Notion.
  Najbliższe wydarzenie/wyliczony termin (>= teraz), policzone z aktualnie
  wczytanych miesięcy — w pełni trafne dopóki "dziś" mieści się w wczytanym
  zakresie (typowy przypadek, panel startuje na bieżącym miesiącu; jeśli
  właściciel nawiguje daleko w przód/tył, widget pokazuje najbliższe z tego,
  co akurat wczytane — samo się koryguje po powrocie do bieżącego miesiąca).
  Klik przenosi do widoku Dnia dla tej daty.
- **Więcej skrótów w palecie poleceń** (Cmd/Ctrl+K) — "Dziś" (T),
  "Widok: Miesiąc/Tydzień/Dzień" — odpowiednik listy "Useful shortcuts"
  z Notion Calendar (Command menu, Go to date itp.), rejestrowane przez już
  istniejący mechanizm `useRegisterActions`.
- Świadomie NIE przeniesiono: podwójnej/wielokrotnej osi stref czasowych
  (jednoosobowa firma w jednej strefie — Europe/Warsaw, brak potrzeby) oraz
  panelu "Scheduling snippet"/"Quick meeting" (współdzielenie dostępności,
  planowanie spotkań z innymi — poza zakresem jednoosobowego narzędzia bez
  zewnętrznych uczestników/integracji kalendarzowych innych osób).
- **Uwaga naprawcza podczas tej tury**: pierwsza wersja skrótu "Dziś" w
  palecie poleceń miała `goToday` w tablicy zależności `useRegisterActions`
  — że `goToday` to zwykła funkcja tworzona na nowo przy każdym renderze
  (nie `useCallback`), useEffect w `useRegisterActions` odpalał się przy
  KAŻDYM renderze i wywoływał `setContextActions`, co wywoływało kolejny
  render → nieskończona pętla ("Maximum update depth exceeded"). Naprawione
  przez powrót do `deps: []` (wzorem istniejącej akcji "+ Nowe wydarzenie")
  — `run: () => goToday()` łapie bieżące domknięcie przy pierwszym renderze,
  co jest wystarczające (nie zależy od świeżego stanu poza stabilnymi
  setterami `useState`). **Wniosek na przyszłość**: nigdy nie wrzucać do
  `deps` tablicy w `useRegisterActions` funkcji, która nie jest
  zmemoizowana (`useCallback`) — zawsze `[]`, chyba że akcja faktycznie
  potrzebuje świeżych wartości z aktualnego renderu.
- Przetestowane: `npx tsc --noEmit` czysty; w przeglądarce po naprawie
  pętli — brak błędu w konsoli, brak czerwonego wskaźnika "Issue" nakładki
  deweloperskiej Next.js, widget "Najbliżej" poprawnie pokazuje "Call z
  klientem — Dziś 10:00", przycisk "Dziś" (toolbar i paleta poleceń)
  działa bez zawieszenia strony.

### Moduł 10 — siódma tura: kompleksowy przegląd QA + polerowanie premium UX (2026-07-14)

Właściciel poprosił o pełny przegląd funkcjonalny (błędy) i ocenę
użyteczności/"premium UX" całego modułu, a następnie o poprawienie
wszystkich zauważonych niedociągnięć.

**Przegląd QA** — bez realnych błędów w kodzie. Podczas testowania trafiono
na pozorny bug (klik w pole formularza w podglądzie dnia zamykał go, klik
"Dodaj" nic nie robił) — zdiagnozowane aż do źródła: to artefakt środowiska
testowego (Browser pane w tej sesji ma `devicePixelRatio: 2`, klik narzędzia
QA trafiał w złe miejsce), **nie błąd aplikacji** — potwierdzone przez
wywołanie tego samego przycisku programowo (`button.click()` przez JS
zamiast przez narzędzie klikające), co zadziałało poprawnie od razu
(wydarzenie realnie zapisało się w bazie). Nie dotyczy realnej przeglądarki
użytkownika. Cała reszta funkcji (dodawanie z klientem/leadem/godziną/
czasem trwania/wielodniowością, usuwanie, widoki, podgląd dnia, sidebar,
paleta poleceń) przetestowana i działa poprawnie.

**Poprawki premium UX** (`CalendarView.tsx`), wszystkie z konkretnej,
szczerej samooceny UX poprzedniej tury:

- **Wyraźny stan aktywny przycisku "Wielodniowe"** — wypełnione tło
  (`bg-[var(--fg)] text-[var(--bg)]`) zamiast tylko subtelnej zmiany koloru
  tekstu, spójne z resztą aktywnych przełączników w panelu (np. dropdown
  widoku).
- **Większe cele kliknięcia strzałek mini-kalendarza** — `h-5 w-5` → `h-7
  w-7`, czytelniejszy rozmiar glifu.
- **Widget "Najbliżej" poprawny niezależnie od nawigacji** — wcześniej
  liczony z danych aktualnie WYŚWIETLANEGO miesiąca/widoku, więc nawigacja
  daleko w przód/tył psuła jego trafność. Naprawione: dedykowany
  `loadUpcoming()` pobiera zawsze bieżący + następny miesiąc względem
  REALNEGO "dziś" (`todayISO()`), niezależnie od tego, co widać na ekranie;
  odświeżany też po każdym dodaniu/usunięciu/przeniesieniu wydarzenia.
- **Brak "błysku" złych danych przy zmianie miesiąca** — siatka dat
  aktualizowała się natychmiast przy zmianie miesiąca, ale
  wydarzenia/terminy dociągały się asynchronicznie, więc przez chwilę stare
  dane (z poprzedniego miesiąca) nakładały się na nowe daty siatki. Naprawione
  przez `monthReady` (para `eventsReadyKey`/`deadlinesReadyKey`, ustawiane
  tylko dla FAKTYCZNIE zażądanego miesiąca — zamknięcie nad `key` chroni
  przed wyścigiem) — siatka miesiąca pokazuje puste komórki (same numery
  dni) zamiast złych danych, dopóki nowe dane nie dotrą.
- **Kurczący się pasek "cały dzień" w Tygodniu, gdy pusty** — wcześniej
  zarezerwowana wysokość 96px na pasek "cały dzień" nad siatką godzinową
  zostawała nawet w tygodniu bez ŻADNYCH wydarzeń bez godziny/wyliczonych
  terminów. Naprawione: `hasAnyAllDay` (sprawdzone dla całego tygodnia, nie
  per dzień — żeby kolumny zostały wyrównane) zmniejsza wysokość do 28px i
  pomija render pustych list "Brak wydarzeń tego dnia." w każdej z 7 kolumn,
  gdy naprawdę nic nie ma do pokazania — więcej miejsca dla siatki godzinowej.
- Przetestowane w przeglądarce: nawigacja Lipiec → Sierpień 2026 pokazała
  poprawne, nowe wyliczone terminy bez śladu starych danych; widget
  "Najbliżej" pozostał poprawny ("Call z klientem — Dziś 10:00") mimo
  nawigacji do innego miesiąca; tydzień 20–26 lipca (bez żadnych wydarzeń
  całodniowych) poprawnie zwinął pasek "cały dzień" do minimalnej
  wysokości, odsłaniając więcej siatki godzinowej. `npx tsc --noEmit`
  czysty po całej turze.

### Moduł 10 — ósma tura: premium animacje wzorem Linear/Apple (2026-07-14)

Właściciel zapytał wprost, jakie animacje premium (znane z Linear, Apple)
dałoby się dodać do Kalendarza — moduł nie miał wcześniej żadnych przejść
poza jedną, bardzo krótką (0.1s) animacją Popovera. Dodano `framer-motion`
w czterech miejscach (`CalendarView.tsx`, `Menu.tsx`):

- **Kierunkowy slide+fade przy zmianie miesiąca/tygodnia/dnia** — nowy stan
  `direction` (-1/0/1), ustawiany w `changeMonth`/`changePeriod`/`goToday`/
  `pickDay` (porównanie starej i nowej daty), zerowany przy zmianie WIDOKU
  (`handleViewChange` — to nie "strona" tego samego widoku, więc czysty
  fade bez przesunięcia). Cała zawartość głównego panelu (miesiąc/tydzień/
  dzień) owinięta w `AnimatePresence mode="wait"` + `motion.div` kluczowany
  `${viewMode}-${monthKey lub selectedDay}`, warianty `enter`/`center`/
  `exit` z `custom={direction}` — "dalej" wjeżdża z prawej, "wstecz" z lewej.
- **Animacje wejścia/wyjścia + layout list wydarzeń** — `DayAgendaList`
  (lista dnia w podglądzie/tygodniu) i bloki wydarzeń w `TimelineGridRow`
  (siatka godzinowa Dzień/Tydzień) owinięte w `AnimatePresence` +
  `motion.li`/`motion.div` z `layout` — dodanie/usunięcie/przesunięcie
  wydarzenia animuje się płynnie zamiast znikać/pojawiać się skokowo.
- **Wizualny feedback przeciągania** — przeciągany element traci opacity
  (0.4) przez czas `onDragStart`/`onDragEnd` (miesiąc, tydzień, siatka
  godzinowa), cel upuszczenia podświetla się ringiem
  (`ring-2 ring-inset ring-[var(--fg)]/40`) na `onDragEnter`/`onDragLeave`.
  W siatce miesiąca zrobione imperatywnie przez `classList` bezpośrednio na
  `ev.currentTarget` (42 komórki w miesiącu — stan React per-komórka byłby
  przesadą tylko dla podświetlenia ramki); w siatce godzinowej przez lokalny
  `useState<boolean>` (jedna kolumna na komponent, więc naturalny stan).
- **Dopieszczenie timingu Popovera** — `Menu.tsx`: dłuższy, bardziej
  "premium" easing (`[0.16, 1, 0.3, 1]`, 0.16s zamiast 0.1s liniowego),
  osobny `exit` (wcześniej brak — zamykanie było natychmiastowe, bez
  animacji). Subtelny hover-lift (`hover:-translate-y-px`) na chipach
  wydarzeń w miesiącu i liście dnia.

**Pułapka napotkana i naprawiona**: pierwsza wersja owinęła
`AnimatePresence` WOKÓŁ wywołania `createPortal(...)` w `Popover`/
`PropertyMenu` (`Menu.tsx`) — to zepsuło popover całkowicie (przestawał się
otwierać, brak elementu `[role="menu"]` w DOM). Przyczyna: `createPortal`
zwraca obiekt `ReactPortal`, nie zwykły element React — `AnimatePresence`
potrzebuje zwykłego elementu (najlepiej `motion.*`) jako bezpośredniego
dziecka, żeby śledzić jego obecność/klonować propsy. Naprawione przez
zamianę kolejności: `AnimatePresence` musi być WEWNĄTRZ portalu (owija
`motion.div`), portal wywoływany bezwarunkowo (gdy `pos` ustawione), a samo
`motion.div` renderowane warunkowo (`open &&`) wewnątrz — dzięki temu
`AnimatePresence` widzi normalny motion-element i poprawnie animuje zarówno
wejście, jak i wyjście (przy zamykaniu portal zostaje zamontowany do czasu
zakończenia animacji `exit`). Wniosek na przyszłość: `AnimatePresence`
zawsze musi opakowywać zwykłe elementy/motion-komponenty, nigdy wynik
`createPortal(...)` bezpośrednio.

Przetestowane w przeglądarce (lokalny dev, `preview_start name:"dev"`):
nawigacja miesiąc→miesiąc (Lipiec→Sierpień 2026) z widocznym slide,
przełączanie Miesiąc→Tydzień→Dzień przez dropdown (nowy timing dropdownu
widoczny), otwieranie/zamykanie podglądu dnia (popover) z płynnym
wejściem/wyjściem, `npx tsc --noEmit` czysty. Uwaga o narzędziu QA: w tej
samej sesji `read_console_messages`/`preview_logs` pokazywały uporczywie
STARE błędy (w tym błąd sprzed poprawki portalu i błędy parsowania z
wcześniejszego stanu pliku) mimo świeżego restartu serwera dev — potwierdzone
jako artefakt cache'a tych narzędzi (nie realny stan aplikacji) przez
bezpośrednią inspekcję DOM/`nextjs-portal` i `preview_logs` po restarcie
serwera (`No server errors found`). Podobnie klikanie przez narzędzie
`computer` po współrzędnych z zrzutu ekranu bywało niecelne (viewport
1600×900 vs zrzut 800×450) — klikanie przez `ref` (z `read_page`) lub
programowo (`button.click()` w JS) działało niezawodnie i potwierdziło, że
sama aplikacja reaguje poprawnie.

## Moduł 11 — Umowy + NDA (2026-07-14)

Nowy moduł `/admin/contracts` ("Umowy") — pierwszy krok domknięcia
największej luki prawnej znalezionej w audycie 2026-07-14 (patrz
`docs/plany-modulow/11-umowy-i-nda.md` i `00-mapa-drogi-klienta.md`, Etap 3).
Decyzje właściciela na starcie tego modułu (nie zgadywane):

- **Osobny dokument**, nie rozszerzenie oferty — nowa tabela `contracts`
  (jedna dla obu typów: `typ = 'umowa' | 'nda'`, dzielą e-podpis i wysyłkę),
  generowana z zaakceptowanej oferty (`app/api/contracts/route.ts` POST,
  kopiuje klienta/zakres/kwotę z pozycji oferty). Przycisk „Wygeneruj umowę”
  w `OfferEditor.tsx`, widoczny dopiero po akceptacji oferty; idempotentny
  (drugie kliknięcie zwraca istniejącą umowę zamiast duplikatu).
- **Jeden stały szablon prawny** (`lib/contracts.ts`: `CONTRACT_CLAUSES`,
  `NDA_CLAUSES`) — klauzule (wyłączenia, zmiana zakresu, reklamacje, IP,
  odpowiedzialność, płatności / cel, poufność, wyłączenia, okres) są
  identyczne dla każdej umowy/NDA; zmienne są tylko pola per-rekord (zakres
  prac, cena, termin, dane drugiej strony). Treść jest **roboczym
  placeholderem** — `LEGAL_PLACEHOLDER_NOTE` wyświetla się na każdym
  dokumencie (panel + wydruk + publiczny link) z ostrzeżeniem, że wymaga
  weryfikacji prawnika przed użyciem z prawdziwym klientem (jak
  `PO_REJESTRACJI.md`).
- **Dwa osobne kroki podpisu** — klient najpierw akceptuje ofertę (jak
  dotąd), umowę podpisuje osobno przez własny link (`/umowa/[token]` albo
  `/nda/[token]`, oba renderują ten sam `ContractPrint.tsx` — typ-świadomy,
  wzorem `OfferPrint.tsx`). E-podpis to ten sam mechanizm co oferty (imię,
  IP, user-agent, `app/api/contracts/public/[token]/accept`), ale bez
  atomowej transakcji z wieloma insertami — dokument już istnieje, więc
  wystarczy jedno "claim"-style `UPDATE ... WHERE status != 'Podpisana'`.
- **Twarda brama (świadomy wyjątek od "miękkie podpowiedzi")** — status
  projektu nie da się ustawić na "W trakcie" bez podpisanej Umowy powiązanej
  z tym projektem (`app/api/projects/[id]/route.ts` PATCH, 409 + czytelny
  komunikat). Przy okazji naprawiono `ProjectsDashboard.updateProject`, żeby
  cofał optymistyczną zmianę UI i pokazywał realny komunikat błędu z API
  zamiast generycznego (wcześniej nieudany PATCH zostawiał niespójny stan
  do czasu odświeżenia strony).
- **NDA ręcznie, z profilu leada** — przycisk „+ Wyślij NDA” w
  `LeadDetailPanel.tsx` (obok „+ Utwórz klienta”), tworzy szkic NDA
  powiązany z leadem i otwiera go w nowej karcie do dopracowania/wysyłki.
  Moduł Umowy ma też własny „+” w Cmd+K do wolnostojącego NDA (bez leada).
- Świadomie **tylko po polsku** — treść prawna wymaga weryfikacji prawnika
  niezależnie od języka; tłumaczenie na EN/DE (jak w Ofertach/Fakturach)
  odłożone do czasu, aż treść będzie ostateczna.
- Nawigacja: pozycja „Umowy” między Ofertami a Projektami (kolejność wg
  realnej ścieżki pracy), skrót `g u`.

## Moduł 12 — Fundament linkowania (2026-07-14)

Infrastrukturalny moduł odblokowujący klikalną historię klienta ("kliknij na
coś typu mail z kiedyś tam i mnie do tego przenosi" — wprost zgłoszone przez
właściciela). Patrz `docs/plany-modulow/12-fundament-linkowania.md`.

- **Podstrony Faktur/Ofert** — `app/[lang]/admin/invoices/[id]/page.tsx` i
  `.../offers/[id]/page.tsx` (+ cienkie wrappery `InvoiceDetail.tsx`/
  `OfferDetail.tsx`, wzorem `LeadDetail.tsx`) renderują **ten sam edytor co
  modal** (`InvoiceEditor`/`OfferEditor`), tylko jako pełną stronę z kartą
  `card-paper` — nie przekierowanie na `/print`. Współistnieją z istniejącym
  `[id]/print/` (osobna podstrona, bez kolizji). Naprawia przy okazji martwy
  link z Pulpitu (`DashboardHome.tsx` linkował do `/admin/invoices/[id]`,
  zanim ta podstrona istniała).
- **Klikalna oś czasu klienta** — `client_events` ma nową kolumnę
  `related_id` (id oferty/faktury/projektu/umowy, do którego zdarzenie się
  odnosi); `logClientEvent()` przyjmuje opcjonalny 6. parametr `relatedId`.
  Docelowy URL wynika z `kind` przez `CLIENT_EVENT_TARGET` (`lib/clients.ts`)
  — nie ma osobnej kolumny "typu celu". `client_created` i
  `nurture_scheduled` świadomie bez linku (nie mają odrębnego rekordu).
  Rozszerzono też `CLIENT_EVENT_KINDS`/`CLIENT_EVENT_ICON` o zdarzenia z
  Modułu 11 (`contract_created`, `contract_sent`, `contract_signed`,
  `nda_created`), które dotąd nie były w tej liście mimo że już się logowały.
  Sekcja "Powiązane" w `ClientDetailPanel.tsx` linkuje teraz do `/[id]`
  (pełny edytor) zamiast do `/print`, spójnie z Projektami.
- **Gubione pola przy konwersji Lead→Klient** — `clients` ma nowe kolumny
  `osoba_kontaktowa`, `zrodlo`, `zrodlo_kategoria` (analogiczne pola już
  istniały w `leads`, ale nie miały odpowiednika w `clients`). Oba miejsca
  automatycznej promocji leada (`app/api/leads/[id]/promote/route.ts`,
  `app/api/offers/route.ts` POST) kopiują teraz też `linkedin_url` i
  `notatki` — te kolumny w `clients` już istniały, ale nie były wypełniane.
  Ręczny formularz "Utwórz klienta" (`app/api/clients/route.ts` POST) nie
  był w zakresie tego modułu — to inny przepływ (prefill pustego formularza,
  nie automatyczna migracja danych).

## Moduł 13 — Faktury: eskalacja windykacji + rezerwa podatkowa (2026-07-14)

Patrz `docs/plany-modulow/13-faktury-windykacja.md`. Decyzje właściciela na
starcie tego czatu:

- **3-poziomowa eskalacja** zamiast dawnego stałego 7-dniowego cooldownu bez
  eskalacji: +3 dni po terminie = uprzejme przypomnienie, +10 = stanowcze,
  +21 = formalne wezwanie do zapłaty. Świadomie BEZ przypomnienia przed
  terminem. `invoices.reminder_level` (0-3) pilnuje, żeby dany poziom nie
  poszedł dwa razy — zarówno w dziennym cronie
  (`sendOverdueInvoiceReminders()` w `app/api/leads/notify/route.ts`), jak i
  w ręcznym triggerze (`app/api/invoices/[id]/remind/route.ts`, minimalny
  poziom 1 nawet przed automatycznym progiem — to jawna decyzja "wyślij
  teraz"). Nowa tabela `invoice_reminders` trzyma pełną historię (poziom +
  data), widoczną w `InvoiceEditor.tsx` (karta "Windykacja") — dotąd był
  tylko nadpisywany `last_reminder_at`. Treść e-maili poziomu 1/2
  scentralizowana w `reminderEmailText()` (`lib/invoices.ts`) — wcześniej
  była zduplikowana 1:1 między cronem a ręcznym triggerem.
- **Wezwanie do zapłaty = osobny generowany dokument**, wzorem Umów (Moduł
  11): własny token publiczny (`invoices.wezwanie_share_token`, osobny od
  `share_token` samej faktury), własna referencja bez numeracji fiskalnej
  (`dunningReference()`, np. "WZ-2026-A1B2C3" — wezwanie nie jest
  dokumentem fiskalnym, więc świadomie NIE wchodzi do `INVOICE_TYPES`/
  numeracji `invoices.numer`). Wydruk: `DunningPrint.tsx`
  (`app/[lang]/admin/invoices/[id]/wezwanie/print/`), ten sam premium styl
  co `ContractPrint.tsx`, bez sekcji e-podpisu (wezwanie to jednostronne
  oświadczenie). Publiczny podgląd bez logowania: `app/[lang]/wezwanie/[token]`
  + `app/api/invoices/wezwanie/public/[token]/route.ts` (widoczny tylko po
  realnym wystawieniu, `wezwanie_wystawiono_at` ustawione). Jak przy
  Umowach — treść to **roboczy szablon** (`DUNNING_LEGAL_NOTE`), wymaga
  weryfikacji prawnej przed użyciem z prawdziwym klientem.
- **Odsetki ustawowe** — opcjonalne, wyliczane automatycznie
  (`lateInterestAmount()`: kwota × stawka/100 × dni/365) od kwoty **i
  liczby dni opóźnienia**, ale stawka wejściowa (`company_settings.
  stawka_odsetek_ustawowych`) jest wpisywana WYŁĄCZNIE ręcznie w Danych
  firmy (zmienia się okresowo, ogłasza NBP/MF) — panel nigdy jej sam nie
  wylicza/aktualizuje. Puste = wezwanie nie pokazuje kwoty odsetek.
- **Rezerwa podatkowa — rozbicie VAT/PIT/ZUS**, trzy osobne stawki % w
  Danych firmy (`rezerwa_vat_procent`/`rezerwa_pit_procent`/
  `rezerwa_zus_procent`), liczone od kwoty **netto** (VAT jest już osobno
  wyszczególniony na fakturze, więc netto jako wspólna baza dla wszystkich
  trzech unika podwójnego liczenia — `taxReserveBreakdown()` w
  `lib/invoices.ts`). Widoczna zbiorczo na Pulpicie (nowa karta "Rezerwa
  podatkowa (ten miesiąc)" w `DashboardHome.tsx`, liczona **tylko z faktur
  w PLN** — świadome uproszczenie, przeliczanie obcych walut po kursie NBP
  dla samego poglądowego wskaźnika byłoby niepotrzebną komplikacją). To
  pomoc poglądowa, nie automat księgowy — nie zastępuje wyliczeń księgowej.
- Nowy typ zdarzenia na osi czasu klienta (Moduł 12): `invoice_dunning_sent`
  — klikalny, prowadzi do podstrony faktury. Przy okazji dopisano do
  `CLIENT_EVENT_KINDS` cztery zdarzenia z Modułu 11 (`contract_created`,
  `contract_sent`, `contract_signed`, `nda_created`), które już się logowały,
  ale nie były w tej liście.

## Moduł 14 — Onboarding klienta (2026-07-14)

Patrz `docs/plany-modulow/14-onboarding-klienta.md`. Decyzje właściciela na
starcie tego czatu:

- **Checklista onboardingowa**: stały domyślny zestaw punktów
  (`DEFAULT_ONBOARDING_ITEMS` w `lib/projects.ts` — dane kontaktowe do
  decydenta, dostępy, materiały startowe, częstotliwość statusów, wysłana
  wiadomość powitalna), wsiewany automatycznie przy tworzeniu projektu
  (zarówno `POST /api/projects`, jak i akceptacja oferty w
  `lib/offerAccept.ts`), a potem dowolnie edytowalny/rozszerzalny per
  projekt — nowa tabela `project_onboarding_items`
  (`id/project_id/tekst/done/position`), CRUD w
  `app/api/projects/[id]/onboarding/`. Projekty sprzed tej migracji mają
  pusty stan z przyciskiem "uzupełnij domyślną checklistą"
  (`seedDefaults: true` w tym samym POST).
- **Czysto miękka podpowiedź, nigdy blokada** — `ONBOARDING_INCOMPLETE_HINT`
  pokazuje się, gdy checklista nie jest domknięta (wzorem
  `LEAD_STATUS_HINT`), ale nic nie blokuje zmiany statusu projektu na "W
  trakcie" (tam obowiązuje jedyna twarda blokada w tym panelu — podpisana
  Umowa, Moduł 11 — i to się nie zmienia).
- **Wiadomość powitalna = szkic do ręcznego wysłania**, nigdy wysyłana
  automatycznie — `buildOnboardingWelcomeMessage()` w `lib/projects.ts`
  generuje tekst z placeholderami (kontakt/częstotliwość/kolejny krok) na
  podstawie tytułu projektu i (jeśli podpięty) nazwy/osoby kontaktowej
  klienta, edytowalny w `<textarea>` w panelu, z przyciskiem "Kopiuj do
  schowka" (`navigator.clipboard`). Generowany raz przy pierwszym
  załadowaniu panelu, potem nie nadpisywany przy odświeżeniach — właściciel
  może swobodnie edytować przed wysłaniem, treść nie jest zapisywana do
  bazy (to jednorazowy szkic, nie trwałe pole projektu).
- **UI**: nowa sekcja "Onboarding" w `ProjectDetailPanel.tsx`, w głównej
  kolumnie zaraz po opisie projektu — przed "Kamieniami milowymi", bo
  onboarding logicznie poprzedza realizację.

## Moduł 15 — Zamknięcie projektu i opinie (2026-07-14)

Patrz `docs/plany-modulow/15-zamkniecie-i-opinie.md`. Decyzje właściciela na
starcie tego czatu: ocena w trzech wymiarach (jakość/terminowość/
komunikacja, 1-5 każdy), zbierana przez publiczny formularz (link mailem,
jak Oferty), zgoda na case study/referencję jako pełny tekst do
zaakceptowania (nie prosty checkbox), szkic podsumowania generowany
automatycznie z danych projektu, i dodatkowo prosta średnia na Pulpicie
już w tym module (nie odłożona do Modułu 18).

- **Dane na projekcie, nie na kliencie** — mimo że mapa drogi klienta mówi
  "zapisywane przy kliencie", opinia dotyczy konkretnego zrealizowanego
  projektu (klient może mieć kilka projektów w czasie), więc pola
  `review_*` (token, trzy oceny, komentarz, zgoda + dowód złożenia: imię/
  IP/user-agent) żyją na `projects` (`createHubSchema` w `lib/db.ts`),
  wzorem `share_token` oferty/umowy. `ensureProjectReviewToken()` — token
  generowany leniwie i idempotentnie.
- **Formularz publiczny**: `app/[lang]/opinia/[token]/` (strona +
  `ProjectReviewForm.tsx`, prosty jasny card, nie pełny druk A4 jak
  Oferta/Umowa — to ankieta, nie dokument), `GET`/`POST .../submit` w
  `app/api/projects/review/public/[token]/` — bez `isAuthed()` (token =
  hasło-w-linku, wzorem publicznego podglądu oferty). "Claim"-style UPDATE
  (`WHERE review_submitted_at IS NULL`) chroni przed podwójnym zapisem.
  Zgoda na case study wymaga wpisanego imienia i nazwiska jako dowodu
  (jak e-podpis oferty) — samego checkboxa nie da się użyć jako dowodu.
  Treść zgody (`PROJECT_REVIEW_CONSENT_TEXT` w `lib/projects.ts`) jest
  zapisywana jako snapshot w `review_consent_text` w momencie akceptacji,
  żeby późniejsza zmiana treści w kodzie nie podważała, na co klient
  faktycznie się zgodził.
- **Szkic podsumowania + wysyłka — ten sam duch co wiadomość powitalna
  (Moduł 14)**: `buildProjectClosingSummary()` generuje tekst (powitanie +
  lista kamieni milowych + link do formularza opinii) raz przy pierwszym
  załadowaniu panelu, edytowalny w `<textarea>`, nigdy wysyłany
  automatycznie. Przycisk "Wyślij mailem" (`POST /api/projects/:id/
  request-review`) wysyła DOKŁADNIE tę (ew. zredagowaną) treść przez
  Resend i dopiero WTEDY ustawia `review_requested_at` — jeśli wysyłka się
  nie uda (np. brak `RESEND_API_KEY`), stan nie zmienia się na "wysłano".
  Wymaga podpiętego klienta z adresem e-mail.
- **Miękka podpowiedź** — `PROJECT_REVIEW_REQUEST_HINT` pokazuje się przy
  statusie "Wdrożone", dopóki opinia nie została ani poproszona, ani
  zebrana (wzorem `ONBOARDING_INCOMPLETE_HINT`/`LEAD_STATUS_HINT`) —
  czysto informacyjna, nic nie blokuje.
- **Pulpit**: nowy kafelek "Opinie klientów" (`kpi.avgClientRating`,
  `reviewsCollected`/`closedProjectsCount` w `app/api/hub/today`) — średnia
  z `projectReviewAverage()` po wszystkich projektach z zebraną opinią,
  plus "X/Y zamkniętych projektów z opinią" (dokładnie wskaźnik z
  "Monitorować" w pliku modułu).
- **Oś czasu klienta** (Moduł 12): nowe zdarzenia `review_requested` (📮)
  i `review_collected` (⭐), oba klikalne do podstrony projektu
  (`CLIENT_EVENT_TARGET`).

### Moduł 15 — dodatki (2026-07-15)

Kontynuacja tej samej sesji, na wyraźną prośbę właściciela:

- **Projekt: pole "Klient"** — dotąd klient wpinał się do projektu WYŁĄCZNIE
  automatycznie przy akceptacji oferty; projekty tworzone ręcznie (`POST
  /api/projects`) nigdy nie miały klienta, więc nie mogły korzystać z
  Modułu 15. Nowe pole "Klient" w panelu bocznym `ProjectDetailPanel.tsx`
  (obok "Lead") pozwala podpiąć/zmienić klienta ręcznie — `PATCH
  /api/projects/:id` z polem `client_id`. Zmiana klienta resetuje i
  odświeża szkice (wiadomość powitalna, podsumowanie+opinia), żeby
  odzwierciedlały nowy kontekst.
- **Link "→ Powstał z oferty"** — jeśli projekt ma faktycznie powstał z
  akceptacji oferty (`offers.project_id = ten projekt`), pod tytułem
  projektu pokazuje się klikalny link do tej oferty (`GET
  /api/projects/:id` dociąga `sourceOffer`).
- **Język formularza opinii dziedziczony z oferty (PL/EN/DE)** — nowa
  kolumna `projects.jezyk` (domyślnie 'pl'), ustawiana na `offer.jezyk` w
  OBU gałęziach tworzenia projektu w `lib/offerAccept.ts`. Decyduje o
  wersji językowej: `buildProjectClosingSummary()` (szkic maila),
  `PROJECT_REVIEW_CONSENT_TEXT` (zgoda na case study — Record<DocLang,
  string>), temacie maila (`app/api/projects/:id/request-review`) i
  `ProjectReviewForm.tsx` (publiczny formularz, DICT PL/EN/DE — świadomie
  NIE wg segmentu URL `[lang]`, bo to język rozmowy z klientem, nie język
  przeglądania strony). Projekty utworzone poza ścieżką oferty zostają
  domyślnie 'pl'.
- **Ręczne wpisanie opinii przez właściciela** — `POST
  /api/projects/:id/review` (admin-only, bez ograniczenia "tylko raz" —
  świadomie inaczej niż publiczny `submit`, bo właściciel może poprawiać
  literówkę). Dla feedbacku zebranego telefonicznie/na spotkaniu, gdy
  klient nie wypełni formularza sam. Zgoda zapisana tą drogą NIE ma dowodu
  IP/user-agent (nie ma przeglądarki klienta w tej ścieżce) — świadomie
  niższy standard dowodowy niż e-podpis z publicznego formularza. UI:
  link "albo wpisz opinię ręcznie" w sekcji "Zamknięcie..." w
  `ProjectDetailPanel.tsx`, rozwija mini-formularz z gwiazdkami
  (`StarPicker`).
- **`/[lang]/references`** — publiczna strona referencji, pokazuje
  WYŁĄCZNIE opinie z `review_consent_case_study = true` (nigdy surowe
  oceny bez zgody klienta). Dane przez `GET /api/references` (publiczne,
  bez `isAuthed()` — to już jawnie zgodzone na wykorzystanie marketingowe).
  Empty-state świadomie w tonie "wybieramy pierwszych partnerów
  założycieli" (spójne z pozycjonowaniem nowej firmy, patrz `page.tsx` w
  `oferta`/homepage) — bo realnie strona długo będzie pusta. Server
  Component robi fetch do własnego `/api/references` (przez `headers()` +
  URL absolutny), a NIE bezpośredni import `lib/db.ts` — bezpośredni
  import Neona w Server Component (page.tsx) wywoływał błąd bundlowania w
  tym środowisku deweloperskim.
- **Gwiazdka ★ przy kliencie** — `GET /api/clients` dociąga `avg_rating`
  (podzapytanie AVG po `projects.review_*` per `client_id`), pokazywana w
  `KanbanBoard.tsx` (przy branży) i `TableView.tsx` (nowa kolumna "Ocena").

### Umowy (Moduł 11) — infrastruktura językowa BEZ tłumaczenia klauzul (2026-07-15)

Właściciel poprosił o wersje PL/EN/DE Umów/NDA analogicznie do Modułu 15.
**Świadomie zbudowana tylko infrastruktura, NIE tłumaczenie treści
klauzul** — `lib/contracts.ts` już wcześniej zawierał jawne ostrzeżenie:
treść `CONTRACT_CLAUSES`/`NDA_CLAUSES` to roboczy szablon, "WYMAGA
WERYFIKACJI PRAWNEJ przed użyciem z prawdziwym klientem"
(`LEGAL_PLACEHOLDER_NOTE`). Tłumaczenie niezweryfikowanego szkicu
dokładałoby pracę do wyrzucenia po weryfikacji prawnika — właściciel to
zaakceptował.

Co zbudowano:
- `contracts.jezyk` (domyślnie 'pl') — dla `typ="umowa"` ustawiane na
  `offer.jezyk` przy generowaniu z zaakceptowanej oferty (`app/api/
  contracts` POST); dla `typ="nda"` zawsze 'pl' (NDA nie ma powiązanej
  oferty). Edytowalne ręcznie w `ContractEditor.tsx` (pole "Język
  wydruku", wzorem Oferty).
- `ContractPrint.tsx` — CAŁE "chrome" wydruku (nagłówki, przyciski,
  etykiety stron, e-podpis, `LEGAL_PLACEHOLDER_NOTE`) przetłumaczone na
  PL/EN/DE (`DICT` w pliku, `CONTRACT_TYP_LABEL_LANG`,
  `LEGAL_PLACEHOLDER_NOTE_LANG` w `lib/contracts.ts`) — te teksty to
  metainformacje o dokumencie, nie klauzule prawne, więc bezpieczne do
  tłumaczenia od razu.
- Same klauzule (`CONTRACT_CLAUSES`/`NDA_CLAUSES`) renderują się ZAWSZE po
  polsku, niezależnie od `contract.jezyk` — przy wydruku niepolskojęzycznym
  nad klauzulami pokazuje się dodatkowa notatka (`CLAUSES_UNTRANSLATED_
  NOTE`) informująca, że tłumaczenie i weryfikacja prawna dopiero czekają.

**Do zrobienia w przyszłości (nie teraz)**: dopiero po tym, jak polska
treść klauzul przejdzie realną weryfikację prawnika, przetłumaczyć
`CONTRACT_CLAUSES`/`NDA_CLAUSES` na EN/DE — infrastruktura (`jezyk`,
`CONTRACT_TYP_LABEL_LANG` z gotowym kluczem `umowa`/`nda`) jest już
gotowa, zostanie tylko dopisać treść klauzul per język.

## Moduł 17 — Retencja i polecenia (2026-07-15)

Patrz `docs/plany-modulow/17-retencja-i-polecenia.md`. Audyt kodu przy
okazji Modułu 15 ustalił, że wyzwalacz/zapis/odczyt/oznaczanie-zrobione
kontaktów nurture (+14/+90 dni po "Wdrożone", Moduł 2) już istniały i
działały — brakowało tylko gotowego szkicu wiadomości (`powod` był samym
krótkim tekstem) i miejsca na pytanie o polecenie. Decyzje właściciela na
starcie tego czatu: +14 to przypomnienie o opinii, o ile jeszcze jej nie
zebrano (NIE duplikat Modułu 15 — tamten mail idzie od razu przy
zamknięciu, ten dopiero po dwóch tygodniach ciszy); pytanie o polecenie w
OBU szkicach (+14 i +90); kontakty nurture wyróżnione na Pulpicie osobną
sekcją/ikoną (🔁) od ręcznie ustawionych przypomnień klienta; licznik
poleceń (z `zrodlo_kategoria = "Polecenie"`) świadomie odłożony do Modułu
18 (Pulpit: wskaźniki), nie budowany tu.

- **`buildNurtureMessage()`** (`lib/clients.ts`) — generuje szkic wg
  `days` (14 lub 90) i języka projektu (PL/EN/DE, wzorem
  `buildProjectClosingSummary`), zawsze kończy się pytaniem o polecenie.
  Wariant +14 dokłada zdanie z linkiem do formularza opinii TYLKO gdy
  `review.submitted` jest fałszywe — jeśli klient już ją zostawił (Moduł
  15), nie prosi drugi raz.
- **`GET /api/client-followups/:id/draft`** — generuje szkic na żądanie
  (dociąga projekt/klienta, zapewnia `review_token` przez
  `ensureProjectReviewToken` dla wariantu +14, sprawdza
  `review_submitted_at`). Nic nie zapisuje poza tym tokenem (idempotentny,
  jak w Module 15).
- **`POST /api/client-followups/:id/send`** — wysyła zaakceptowaną
  (ew. zredagowaną) treść przez Resend, DOPIERO wtedy ustawia
  `done_at = now()` i loguje zdarzenie `nurture_contact_sent` (🔁) na osi
  klienta z `related_id` = projekt. Wzorem `request-review` (Moduł 15) —
  panel nigdy nie wysyła nic automatycznie.
- **Pulpit** (`DashboardHome.tsx`): karta "Klienci wymagający kontaktu"
  dzieli się na ręczne przypomnienia (`overdueClients`, jak dotąd) i
  osobną sekcję "🔁 Zaplanowany kontakt retencyjny" (`dueFollowups`) z
  przyciskiem "Szkic" — rozwija edytowalny `<textarea>` + "Kopiuj do
  schowka" + "Wyślij mailem" (disabled bez adresu e-mail klienta), obok
  istniejącego "Obsłużone" dla ręcznego zamknięcia bez wysyłki.

## Moduł 18 — Pulpit: wskaźniki zdrowia biznesu (2026-07-15)

Patrz `docs/plany-modulow/18-pulpit-wskazniki.md`. Nowa podstrona
`/admin/stats` ("Statystyki"), osobna od Pulpitu — linkowana z niego kartą
"Czy trzymam wzorzec pracy?". Decyzje właściciela na starcie tego czatu:
pełen zestaw 6 wskaźników z `00-mapa-drogi-klienta.md` na start (nie węższy
wybór); osobna podstrona (nie sekcja na Pulpicie); nagłówkowe liczby liczone
OD POCZĄTKU działalności (bez okresu — firma dopiero startuje, miesięczne
okno dawałoby puste/mylące liczby); wizualizacja przez wykresy trendu w
czasie (dataviz skill przeczytany przed pisaniem wykresu).

- **`app/api/stats/route.ts`** — jeden agregujący route (wzorem
  `app/api/hub/today`), zero AI, same SQL/JS agregacje nad danymi, które już
  istniały (bez nowych tabel):
  - **Czas do 1. odpowiedzi** — brak dedykowanej kolumny; liczony jako
    pierwszy wpis `lead_activity` z `kierunek = 'wychodzacy'` po
    `leads.created_at` (najwcześniejszy wychodzący kontakt = odpowiedź).
  - **Konwersja lead→klient** — `leads.client_id IS NOT NULL` / wszystkie
    leady, per miesiąc utworzenia leada.
  - **Zdrowie projektów** — rozkład `projects.zdrowie` (snapshot, nie
    trend — to bieżący stan, nie coś co ma "historię miesięczną").
  - **DSO** — TYLKO faktury PLN, typu `faktura` (nie proforma), status
    `Opłacona`: dni między `data_wystawienia` a datą ostatniej wpłaty
    (`MAX(invoice_payments.data)`), per miesiąc wystawienia. Najstarsza
    zaległość = `MAX(dni po terminie)` po dziś nieopłaconych.
  - **% opinii** — reużyte z logiki `hub/today` (closedProjects vs
    reviewedProjects), tu dodatkowo jako jawny %.
  - **% Polecenie** — `zrodlo_kategoria = 'Polecenie'` / wszystkie leady,
    per miesiąc; obok niego licznik `client_events.kind =
    'nurture_contact_sent'` (Moduł 17) — "ile razy zapytaliśmy" vs "ile
    poleceń przyszło". To domyka licznik poleceń świadomie odłożony przez
    Moduł 17.
- **`lib/stats.ts`** — czyste pomocnicze funkcje (klucze miesięcy, etykiety,
  średnia) współdzielone przez route i UI; wzorem `app/api/costs/analytics`.
- **`TrendChart.tsx`** — prosty, jednoseriowy wykres liniowy SVG (własny,
  lżejszy niż `SpendTrendChart.tsx` bo bez wielu kategorii — jedna seria nie
  potrzebuje legendy, kolor niesie tożsamość marki `brand.purple`,
  zwalidowany `scripts/validate_palette.js` w obu motywach). Punkty bez
  danych w danym miesiącu przerywają linię (nie rysują fałszywego zera).
- Wykresy trendu (12 mies.) tylko dla metryk, które faktycznie mają sens
  jako trend (czas odpowiedzi, konwersja, DSO, % poleceń) — zdrowie
  projektów i % opinii to karty ze statyczną liczbą/rozkładem, nie wykres.
- Nawigacja: `AppShell.tsx` — wpis "Statystyki" na KOŃCU listy `NAV` (to
  okresowy przegląd, nie krok w codziennym lejku pracy), chord `g s`.

## Moduł 19 — Śledzenie czasu pracy (2026-07-15)

Patrz `docs/plany-modulow/19-sledzenie-czasu.md`. Decyzje właściciela na
starcie tego czatu: stoper start/stop ORAZ ręczny wpis godzin (oba, nie
jedno albo drugie); czas przypięty per zadanie (`project_tasks`), z opcją
zalogowania ogólnie na projekt bez wybierania zadania; wyłącznie narzędzie
analityczne — brak wpływu na fakturowanie, brak pola "stawka klienta";
efektywna stawka godzinowa widoczna ZAWSZE (nie tylko po zamknięciu
projektu).

- **`time_entries`** (`ensureTimeSchema()` w `lib/db.ts`) — jeden wiersz na
  wpis, `source` = `'manual' | 'timer'`. `task_id` opcjonalny
  (`ON DELETE SET NULL` — usunięcie zadania nie kasuje historii czasu).
  `ended_at IS NULL` = stoper aktualnie działa; panel jest jednoosobowy, więc
  w danym momencie może być aktywny co najwyżej jeden taki wiersz (pilnowane
  w API, nie w bazie — start nowego stopera automatycznie zatrzymuje
  poprzedni i zapisuje go jako zakończony wpis, z toastem informującym o
  tym właściciela).
- **`lib/time-tracking.ts`** — czyste funkcje: `formatDuration` ("2 godz. 15
  min", bez "00:00" — to narzędzie do samopoznania, nie stoper sportowy),
  `sumMinutes` (pomija niedokończony stoper), `effectiveHourlyRate` —
  świadomie liczona od **zysku netto** (nie przychodu) ÷ godziny, żeby
  pokazać prawdziwą rentowność liczoną też czasem właściciela, zgodnie z
  motywacją modułu.
- **`app/api/time/*`** — `GET/POST /api/time` (lista + ręczny wpis),
  `PATCH/DELETE /api/time/:id`, `POST /api/time/start` (zatrzymuje
  poprzedni aktywny, jeśli istnieje), `POST /api/time/stop`,
  `GET /api/time/active` (globalny aktywny stoper, z nazwą projektu/zadania
  przez JOIN — do wskaźnika w sidebarze).
- **`ProjectDetailPanel.tsx`** — nowa karta "Czas pracy" (zawsze widoczna,
  niezależnie od tego czy karta "Rentowność" w ogóle się renderuje —
  efektywna stawka miała być widoczna ZAWSZE, więc żyje w osobnej karcie,
  nie w Rentowności): żywy licznik działającego stopera, lista wpisów
  (wpis w trakcie celowo pomijany z listy — jest już widoczny w banerze
  powyżej), ręczny wpis (godziny + opcjonalne zadanie + data + notatka).
  Przy każdym zadaniu (`TaskList`): ikona start/stop stopera (hover, chyba
  że aktywny — wtedy zawsze widoczna) + suma zalogowanych minut.
  Zarejestrowana komenda w palecie (Cmd+K): "⏱ Start/zatrzymaj stoper".
- **Globalny wskaźnik w `AppShell.tsx`** — mały pill w sidebarze (nad
  "Wyloguj") z nazwą projektu i żywym czasem, widoczny na KAŻDEJ stronie
  panelu, nie tylko w widoku projektu (żeby nie zgubić, że stoper chodzi po
  zamknięciu modala/zmianie strony). Synchronizacja bez pollingu: zwykły
  `window` `CustomEvent` (`TIMER_CHANGED_EVENT`, eksportowany z
  `AppShell.tsx`) który `ProjectDetailPanel` odpala po starcie/zatrzymaniu
  — świadomie prostsze niż SWR/kontekst, bo w całym panelu i tak nigdzie
  indziej nie ma pollingu cross-page live data.

### Moduł 19 — dogranie: edycja wpisów, precyzja stopera, raport zbiorczy (2026-07-15)

Właściciel po pierwszym wdrożeniu poprosił o dogranie czterech braków
zgłoszonych świadomie jako "czego nie ma" — wszystkie cztery domknięte w tej
samej sesji:

- **Edycja ręcznego/stoperowego wpisu w UI** — ikona ołówka (hover, obok
  kosza) w karcie "Czas pracy" przełącza wiersz w formularz inline (godziny,
  zadanie, data, notatka + Zapisz/Anuluj, Enter/Escape jako skróty) — ten sam
  kształt co formularz dodawania, żeby nie trzeba było uczyć się drugiego
  wzorca. Backend (`PATCH /api/time/:id`) istniał od początku, brakowało
  tylko wejścia z UI.
- **Precyzja stopera poniżej minuty** — `time_entries.minutes` zmienione z
  `INTEGER` na `NUMERIC` (idempotentny `ALTER COLUMN TYPE` w
  `ensureTimeSchema()`), `/api/time/start` i `/api/time/stop` liczą teraz
  dokładny czas (`ROUND(..., 2)`) zamiast `GREATEST(1, ROUND(...))` które
  zaokrąglało w górę do pełnej minuty. `formatDuration()`
  (`lib/time-tracking.ts`) pokazuje sekundy poniżej minuty ("17 s") zamiast
  chować krótkie sesje pod "0 min". Wszystkie SELECT-y na `time_entries`
  jawnie rzutują `minutes::float8 AS minutes` (zamiast `SELECT *`) — NUMERIC
  bez rzutowania wraca z neona jako string, co psułoby arytmetykę/typy w UI.
- **Lista wpisów bez sztywnego limitu 8** — `<ul>` w karcie "Czas pracy" ma
  teraz `max-h-56 overflow-y-auto` i renderuje WSZYSTKIE wpisy (przewijalnie),
  zamiast `.slice(0, 8)` które po prostu obcinało starsze wpisy bez żadnego
  sposobu, by je zobaczyć.
- **Raport zbiorczy godzin pracy** — nowa karta "Godziny pracy (łącznie)" +
  wykres trendu 12-miesięcznego na `/admin/stats` (Moduł 18), wzorem
  pozostałych metryk: `app/api/stats/route.ts` dolicza `time_entries`
  (`ensureTimeSchema()` + agregacja per miesiąc `entry_date`, z pominięciem
  wpisu w trakcie — tak jak `sumMinutes()`), `StatsDashboard.tsx` dostaje
  `timeTracking: { totalHours, trend }` i renderuje identycznym `StatCard`/
  `ChartCard`/`TrendChart` co reszta strony (kolor marki dziedziczony
  automatycznie z `.trend-chart` CSS, bez nowego stylu).

## Moduł 20 — Szablony ofert / pakiety usług (2026-07-15)

Gotowe szkielety pozycji + domyślnych uwag do wstawienia jako punkt startowy
nowej oferty, żeby nie pisać każdej oferty od zera i wymusić spójność
zakresu. Wzorem `recurring_invoices` (Moduł 9 faktur) — pozycje trzymane
jako JSONB "odbitka" (`offer_templates.pozycje`), bez relacyjnej
integralności, bo tylko kopiowane przy wstawianiu, bez cyklicznego
generowania.

- **Zarządzanie** — osobny panel `OfferTemplatesPanel.tsx` (wzorem
  `RecurringPanel.tsx`), otwierany przyciskiem "Szablony" w nagłówku
  `/admin/offers`: lista rozwijanych kart, każda z nazwą, opisem (widocznym
  tylko w panelu), pozycjami (nazwa/ilość/jednostka/cena) i domyślnymi
  uwagami. CRUD przez `/api/offer-templates` (GET/POST) i
  `/api/offer-templates/:id` (PATCH/DELETE).
- **Zasiew startowy** — przy pierwszym uruchomieniu (tabela jeszcze nie
  istnieje, sprawdzane `to_regclass` PRZED `CREATE TABLE`, więc zasiew
  odpala się dokładnie raz, nie odtwarza usuniętych szablonów przy kolejnych
  cold-startach) `createOfferTemplatesSchema()` w `lib/db.ts` wstawia 3
  przykładowe szablony zaakceptowane przez właściciela (Audyt/PoC AI,
  Wdrożenie automatyzacji, Abonament/opieka miesięczna) + jeden pusty wzór
  do skopiowania. Wszystkie w pełni edytowalne/usuwalne z panelu.
- **Wstawianie do oferty** — przycisk "Wstaw z szablonu" w karcie "Pozycje"
  `OfferEditor.tsx` (obok "+ Pozycja"), lista szablonów w Popoverze z ceną
  przy nazwie. `POST /api/offers/:id/apply-template` dopisuje pozycje
  szablonu na końcu istniejących pozycji oferty i doklejowuje domyślne
  uwagi szablonu pod istniejącą treścią uwag (jeśli oferta miała już jakąś
  treść) — czysta kopia, bez żadnego powiązania z szablonem po wstawieniu,
  więc dalsza edycja pozycji nie rusza samego szablonu.

## Moduł 4 — Natywna poczta w panelu (IMAP/SMTP az.pl) (2026-07-15)

Brief: `docs/plany-modulow/04-skrzynka-mailowa.md`. Panel łączy się
**bezpośrednio ze skrzynką az.pl** (zwykły IMAP/SMTP — właściciel nie ma
Microsoft 365/Exchange, więc Graph/OAuth nie wchodzi w grę i nie jest
potrzebny). Outlook czyta tę samą skrzynkę, więc oba widoki są spójne:
odpiszesz w panelu → widać w Outlooku.

**Zmienne środowiskowe (Vercel)** — bez nich moduł działa w trybie „tylko to,
co w bazie", a zakładka pokazuje spokojny baner zamiast błędu:
`MAIL_IMAP_HOST`, `MAIL_USER`, `MAIL_PASS` (wymagane) oraz opcjonalnie
`MAIL_IMAP_PORT` (domyślnie 993), `MAIL_SMTP_HOST` (domyślnie ten sam co
IMAP), `MAIL_SMTP_PORT` (domyślnie 465), `MAIL_FROM`. Wartości z panelu az.pl.
**Panel zyskuje pełny dostęp do poczty** — ten sam poziom zaufania co
`DATABASE_URL`; hasło żyje wyłącznie po stronie serwera i nigdy nie trafia do
odpowiedzi API.

- **Warstwy** (ten sam podział co `lib/contact.ts` vs `lib/contactLookup.ts`):
  - `lib/mail.ts` — czyste typy/stałe/reguły, bezpieczne dla `"use client"`.
  - `lib/mailbox.ts` — server-only IMAP/SMTP (`imapflow`, `mailparser`,
    `nodemailer`). Wszystkie trasy poczty `runtime = "nodejs"`.
  - `lib/mailSync.ts` — dopasowanie + dedup + zapis; wołane z dwóch wejść:
    `POST /api/mail/sync` (otwarcie zakładki) i dziennego crona.
- **Dedup po `message_id UNIQUE`** — podwójny sync nic nie dubluje. UID-y
  (`mail_state.last_seen_uid`) to tylko optymalizacja „skąd czytać". Przy
  zmianie `UIDVALIDITY` (serwer przenumerował skrzynkę) kursor resetuje się
  do zera — bezpieczne właśnie dzięki dedupowi.
- **Auto-przypisanie po adresie nadawcy** (`findContactsByEmail` w
  `lib/contactLookup.ts`, obok istniejącego dopasowania po telefonie):
  klient → lead → kolejka „Nieprzypisane". Zero AI, sama równość adresów.
- **Mail na osi kontaktu = `client_activity`/`lead_activity` z
  `kanal='email'`**, NIE `client_events` (decyzja 2026-07-15). Powód: mail to
  kontakt z człowiekiem jak telefon z Modułu 3 (ma kanał i kierunek), a nie
  zdarzenie systemowe typu „wystawiono fakturę". Precedens:
  `POST /api/telefonia/webhook` zapisuje tam automatycznie tak samo. Wpis to
  skrót (temat + pierwsza linia); pełna treść zostaje w `mail_messages`, a
  nowa kolumna `mail_message_id` linkuje oś wprost do niej (odpowiednik
  `client_events.related_id` z Modułu 12).
- **Odpowiadanie** — `POST /api/mail/[id]/reply`: SMTP az.pl z
  `In-Reply-To`/`References` (wątkowanie) → kopia do „Sent" przez IMAP APPEND
  → zapis jako `kierunek='out'` → oryginał `obsłużony`. Wiadomość składamy
  `MailComposer`-em, więc do „Sent" trafia bajt w bajt to, co poszło do
  klienta. **Wysyłka jest nieodwracalna, więc idzie pierwsza** — awaria
  któregokolwiek z kroków po niej nie zwraca błędu, tylko ostrzeżenie
  (klient dostał już maila; drugi „wyślij" byłby gorszy niż brak kopii w Sent).
- **Ścieżka wysyłki** (decyzja właściciela): osobiste odpowiedzi → SMTP az.pl
  (wątkowanie + „Sent"); faktury/oferty/raport dzienny → dalej Resend
  (`lib/email.ts`), bo to inne zadanie — dostarczalność maili automatycznych.
- **Wyciszenie szumu** — `isNoiseAddress()` dopasowuje jednoznaczne wzorce w
  lokalnej części adresu (`no-reply`, `newsletter`, `mailer-daemon`…) →
  status `zignorowany`, poza listę „do odpowiedzi". Celowo konserwatywne:
  wątpliwy mail lepiej pokazać niż ukryć realne zapytanie.
- **UI** — zakładka „Poczta" (`g m`): lista z filtrami (Do odpowiedzi /
  Nieprzypisane / Wszystkie), profil wiadomości jako **wyśrodkowany modal**
  (`MailDetailPanel.tsx`) + własna podstrona `[id]` dla linków. Akcje:
  Odpisz, Obsłużone, Wycisz, „Otwórz w Outlooku" (mailto), „+ Utwórz leada z
  tego maila" (status „Nowe zgłoszenie ze strony" → od razu na Pulpicie),
  „Z maila → zadanie" (wybór projektu klienta; treść podaje właściciel —
  model niczego nie wnioskuje).
- **Pulpit** — sekcja „Wiadomości do odpowiedzi" (`status='nowy'`) z
  „Obsłużone", wliczana do licznika „spraw na dziś". To samo w mailu dziennym.
- **Sync** (decyzja właściciela): przy otwarciu zakładki + raz dziennie w
  cronie 06:00. Bez push — funkcje serverless nie utrzymują połączenia IMAP;
  od „dinga w sekundę" jest Outlook. `maxDuration` crona podniesione 30→60 s.
  Sync w cronie leci **przed** zapytaniami (sekwencyjnie, nie w `Promise.all`),
  bo raport czyta to, co sync właśnie zapisał. Awaria skrzynki jest wypisana
  w raporcie — cicho niepobierana poczta wyglądałaby jak „nikt nie pisze".
- **Retencja (RODO)** — 24 miesiące (decyzja właściciela), stała
  `MAIL_RETENTION_MONTHS` w `lib/mail.ts`, czyszczone dziennym cronem
  (`purgeOldMail`). Kasujemy całe wiersze; wpisy na osi kontaktu zostają
  (`ON DELETE SET NULL`), tracą tylko link do treści. Oryginały zostają na
  az.pl — panel jest roboczą kopią. **Wartość musi zgadzać się z polityką
  prywatności** — patrz `PO_REJESTRACJI.md`.

### Moduł 4 — druga tura: kategorie, wyciszanie, HTML maila (2026-07-15)

Po pierwszym uruchomieniu na produkcji właściciel zgłosił trzy rzeczy —
wszystkie trafione, wszystkie naprawione.

**1. Wyciszanie szumu przepuszczało automaty (BŁĄD).** `jobalerts-noreply@
linkedin.com` lądował jako "Do odpowiedzi" z propozycją "Utwórz leada",
bo pierwsza wersja `isNoiseAddress()` sprawdzała `startsWith` — a tu
"noreply" jest na KOŃCU. Dziś `isNoiseMail()`:
- czyta **standardowe nagłówki masówki** (`List-Unsubscribe` RFC 2919/8058,
  `Precedence: bulk/list/junk`, `Auto-Submitted` RFC 3834) — to sygnał ze
  standardu, pewniejszy niż jakakolwiek nazwa adresu, więc idzie pierwszy,
- dopiero potem tnie lokalną część adresu na tokeny (`.`/`-`/`_`/`+`) i
  szuka dopasowania w KAŻDYM z nich, nie tylko na początku.
Ten mail jest w seedzie dev (`lib/dev-db.ts`) jako regresja — ma na zawsze
wpadać w "reklama".

**2. Kategorie (deterministyczne, ZERO AI).** `classifyMail()` w
`lib/mail.ts` → kolumna `mail_messages.kategoria`:
`urzedowe` → `rachunek` → `reklama` → `oferta` → `inne`. **Kolejność reguł
jest treścią, nie kosmetyką:** bank i faktura mają pierwszeństwo przed
masówką, bo jedno i drugie potrafi przyjść z `List-Unsubscribe`, a takiego
maila nie wolno uciszyć. `oferta` = nieznany nadawca, który nie jest robotem
(potencjalny klient). Status `zignorowany` nadaje wyłącznie `reklama` —
świadomie po kategorii, nie po surowym "to masówka".
- Filtry w UI to dwie NIEZALEŻNE osie (jak status vs zdrowie projektu): co
  wymaga reakcji (Do odpowiedzi/Nieprzypisane/Wszystkie) × czego dotyczy
  (Rodzaj: Zapytanie/Rachunek/Urzędowe/Rozmowa/Reklama).
- `kategoria` jest **nullable bez DEFAULT** — NULL ("jeszcze nie wiadomo")
  różni się od `'inne'` ("sprawdzone, zwykła rozmowa"). Dzięki temu
  `backfillCategories()` (`lib/mailSync.ts`) przelicza wiadomości pobrane
  przed tą zmianą. Bez tego zostałyby z błędnym statusem NA ZAWSZE — dedup po
  `message_id` nie pozwala pobrać ich ponownie. Backfill leci w
  `POST /api/mail/sync` **przed** sprawdzeniem skrzynki (to porządki na
  własnej bazie, nie pobieranie poczty), więc działa też lokalnie i przy
  padniętym IMAP. Podnosi status tylko `nowy`→`zignorowany` — ręczna decyzja
  właściciela jest ważniejsza niż reguła.

**3. Treść maila = HTML (właściciel: "wygląda nieobsługiwane").** Panel
pokazywał `body_text`, stąd ściany linków trackingowych zamiast przycisków.
Teraz renderujemy HTML, ale **treść maila to kod od obcej osoby** — wrzucony
wprost (`dangerouslySetInnerHTML`) mógłby wykraść ciasteczko sesji panelu.
Dlatego trzy niezależne warstwy:
1. `lib/mailHtml.ts` — `sanitize-html`: wycina `<script>`, `on*=`, `<iframe>`,
   `<form>`, `javascript:`; whitelist tagów (tabele ZOSTAJĄ — maile
   marketingowe są na nich zbudowane) i stylów.
2. `MailBodyHtml.tsx` — `<iframe sandbox>` **bez `allow-scripts` i bez
   `allow-same-origin`**: nawet gdyby coś przeszło odkażanie, nie ma jak się
   wykonać ani sięgnąć do sesji. `srcdoc`, nie `innerHTML`.
3. CSP w `<meta>` wewnątrz ramki (`script-src 'none'`).
- **Zdalne obrazki domyślnie blokowane** (podmiana na przezroczysty piksel +
  "Pokaż obrazki") — to tracking pixele: samo otwarcie zdradza nadawcy, że i
  kiedy przeczytałeś maila. Tak samo robi Gmail/Outlook. `data:` obrazki
  (osadzone) zostają.
- Odkażamy przy KAŻDYM odczycie, nie raz przy zapisie — poprawka reguł
  działa wtedy od razu na całej historii. Surowy `body_html` nie opuszcza
  serwera (`GET /api/mail/[id]` zwraca `body_html: ""` + gotowy `html`).
- Ramka nie mierzy własnej wysokości (to wymagałoby `allow-scripts`) —
  świadomy kompromis: stała wysokość wg długości treści + scroll w środku.

**Ustalone, NIEzbudowane:** wiele skrzynek. Decyzja właściciela: przez env
Vercela (`MAIL_2_HOST/USER/PASS`), **nie** przez formularz w panelu — hasła do
poczty nie trafiają do bazy. Osobny moduł, gdy pojawi się druga skrzynka.

### Moduł 4 — trzecia tura: podpisy PL/EN/DE, klient z maila, DW (2026-07-15)

**Klient bezpośrednio z maila.** Obok „Utwórz leada" jest „Utwórz klienta"
(`POST /api/mail/[id]/create-client`) — właściciel poprosił, bo nie każdy
piszący to lead do przepchnięcia przez lejek. Dwa osobne przyciski, bo to dwie
różne decyzje biznesowe i panel ich nie zgaduje. Klient dostaje status
`Prospekt` (nie `Aktywny` — z maila jeszcze nic nie kupił), źródło
`Inbound / E-mail`, wpis `client_created` na osi czasu i mail na osi kontaktu.
Ochrona przed duplikatem: jeśli adres już jest znany, przypina do
istniejącego rekordu zamiast tworzyć drugi.

**Podpisy PL/EN/DE** (`lib/mailSignature.ts`). Przełącznik przy pisaniu,
domyślnie polski, plus opcja „Bez podpisu" — decyzja właściciela: świadomie
RĘCZNIE, nie automatem po kraju klienta („mam wiedzieć, co podpinam").
- **Dlaczego HTML, a nie gotowe PNG-i.** W repo leżały
  `stopka_mailowa_{PL,EN,DE}.png` — cały podpis jako jeden obrazek. Odradzone
  właścicielowi i zastąpione: (1) klienci blokują domyślnie obrazki → u
  odbiorcy pusta ramka (tę samą blokadę mamy u siebie), (2) telefon/mail/
  LinkedIn to piksele, nie linki, (3) mail-obrazek dostaje gorszą ocenę
  antyspamową, (4) czytniki ekranu nic nie odczytają. Dziś dane kontaktowe to
  PRAWDZIWY tekst z linkami `tel:`/`mailto:`, a obrazki są tylko ozdobą —
  podpis czyta się w całości nawet, gdy się nie wczytają.
- **Adres: `kontakt@leggeralabs.pl` wszędzie** (decyzja właściciela) — PNG-i
  miały nieaktualne `kontakt@patrykpiecyk.pl`. Reszta kodu i tak używała
  właściwego.
- **Baner jest HTML-em, nie obrazkiem** — mimo że `sygnatura_baner_*.png` są w
  repo. To on niesie CTA (jedyny element podpisu, który ma coś sprzedać), więc
  nie może zniknąć przy zablokowanych obrazkach. Te same hasła i kolory marki.
- **Tabele + style inline** — Outlook na Windows renderuje HTML silnikiem
  Worda: flexbox/klasy CSS/marginesy nie działają. To nie zaniedbanie.
- **Zdjęcie wypalone w okręgu** (`sygnatura_zdjecie_kolo.png`, generowane raz
  z `sygnatura_zdjecie.png`) — Outlook ignoruje `border-radius`.
- **Obrazki jako `cid:`** (osadzone w wiadomości), nie zdalne `https://` — te
  drugie są blokowane jak każdy tracking pixel. ⚠️ Pobierane przez HTTP z
  `siteUrl`, NIE z dysku: pliki z `public/` nie trafiają do funkcji serverless
  na Vercelu, więc `fs.readFile` działałby lokalnie i wywalił się na
  produkcji. Awaria pobierania = mail leci bez ozdób, nie błąd.
- **Zawsze multipart text+HTML** — sam HTML podbija punktację spamową i psuje
  odbiór w klientach tekstowych (`signatureText()`).
- Podpis doklejany przy WYSYŁCE, nie w polu edycji — nie da się go
  przypadkiem nadpisać. Do bazy i na oś kontaktu klienta zapisujemy treść BEZ
  podpisu, inaczej każda rozmowa byłaby zaśmiecona powtórzoną stopką.
- Teksty 1:1 z kanonem marki (`i18n/dictionaries/*.json` → `footer.tagline`,
  `cta.bookingCta`), kolory = `brand.*` z `tailwind.config.ts` wpisane wprost
  (w mailu nie ma Tailwinda ani zmiennych CSS).

**DW (Cc)** przy odpowiadaniu — adresy trafiają też do koperty SMTP, inaczej
nagłówek byłby widoczny, ale poczta by tam nie poszła.

### Moduł 4b — Etap 1: pisanie i odpowiadanie (2026-07-15)

Brief: `docs/plany-modulow/04b-poczta-pelny-klient.md`. Po tym, jak właściciel
przetestował Moduł 4 na produkcji i powiedział wprost „lepiej, ale wciąż
daleko od ideału" — panel umiał tylko odpisać nadawcy. Etap 1 dogania
podstawowe funkcje każdego klienta pocztowego:

- **Nowa wiadomość** (`POST /api/mail/compose`) i **Przekaż**
  (`POST /api/mail/[id]/forward`) — obie generalizują dawne `sendReply()` do
  `sendMail()` w `lib/mailbox.ts` (odpowiedź/przekazanie/nowa wiadomość to ten
  sam mechanizm SMTP+APPEND-do-Sent, różni się tylko obecnością nagłówków
  wątku). Przekazanie świadomie zakłada NOWY wątek (bez `In-Reply-To`) — tak
  samo robi Gmail/Outlook z "Fwd:". Cytowana treść (nagłówek "Od/Data/Temat/Do"
  + oryginalna treść w blockquote) — `forwardHtml()`/`forwardHeaderText()` w
  `lib/mail.ts`. **Załączniki NIE są przekazywane** — świadomie odłożone,
  panel w ogóle nie przechowuje ich treści.
- **Odbiorca — z bazy LUB dowolny adres ręcznie** (decyzja właściciela
  2026-07-15): `RecipientField` (`app/[lang]/admin/mail/RecipientPicker.tsx`)
  łączy zwykły input z podpowiedzią klientów/leadów mających e-mail. Odbiorca
  nie musi być w CRM.
- **Odpowiedz wszystkim** — bez zmian po stronie serwera: przycisk w
  `MailDetailPanel` po prostu wstępnie wypełnia pole DW wartością `cc_addr`
  oryginału i otwiera zwykły formularz odpowiedzi. Prostsze niż osobna trasa.
- **DW przychodzących wiadomości** (`mail_messages.cc_addr`) — dotąd w ogóle
  nie zapisywane, więc "Odpowiedz wszystkim" nie miało skąd wziąć adresów.
  Nullable bez DEFAULT (ten sam wzorzec co `kategoria`): NULL = jeszcze nie
  sprawdzone, "" = sprawdzone, brak DW. `backfillCc()` (`lib/mailSync.ts`,
  wołane w `syncMailbox()`) dociąga brakujące DW starym wiadomościom po
  UID-zie (`fetchCcByUids()` w `lib/mailbox.ts`) — dedup po `message_id` nie
  pozwala pobrać ich ponownie w całości.
- **Cofnij wysyłkę — po stronie KLIENTA** (`useUndoSend`,
  `app/[lang]/admin/mail/useUndoSend.ts`): 10 s odliczania z przyciskiem
  "Cofnij" PRZED faktycznym wywołaniem API wysyłki. Świadomie bez kolejki
  serwerowej — Vercel nie utrzymuje stanu między zimnymi startami, a
  odroczona wysyłka wymagałaby crona co minutę (dziś jest raz dziennie).
  Dotyczy WSZYSTKICH ścieżek wysyłki (Odpisz/Wszystkim/Przekaż/Nowa) — jedna
  implementacja, spójne zachowanie.
- **Szablony wiadomości** (`mail_templates`: nazwa+temat+treść,
  `app/api/mail-templates/`) — wzorem `offer_templates`, bez seeda
  (właściciel tworzy własne od zera). `TemplatePickerButton` wstawia treść do
  pola (dokleja, nie nadpisuje) — dostępny przy odpowiedzi, przekazaniu i
  nowej wiadomości.

**Zostało (Etap 2/3, świadomie osobne sesje wg briefu):** fundament
IMAP (special-use foldery, CONDSTORE, flagi, Kosz≠kasowanie), screener
nowych nadawców, snooze, follow-up nudge, wątkowanie JWZ.

### Moduł 4c — podpis: symetria, gradient marki, dark mode (2026-07-15)

Po obejrzeniu podpisu z trzeciej tury w prawdziwym Outlooku właściciel zgłosił
trzy poprawki (`docs/plany-modulow/04c-podpis-mailowy.md`):

- **Symetria lewej kolumny.** Zdjęcie i logo były jedno pod drugim, wyrównane
  do góry — obok tekstowej kolumny (imię/rola/4 wiersze kontaktu) wyglądało
  nierówno. Właściciel wybrał układ zdjęcie+logo **obok siebie w rzędzie**
  zamiast jednego pod drugim; obie kolumny dostały `vertical-align:middle`, a
  pionowa kreska (`border-left`) rozciąga się na pełną wysokość wiersza (tak
  działają komórki tabeli — automatycznie, bez dodatkowego CSS). Logo
  (wordmark 480×47px) w rzędzie obok zdjęcia 88px wychodzi bardzo niskie
  (~13px przy szerokości 130px) — świadomy kompromis wynikający z proporcji
  pliku, nie błąd.
- **Gradient marki (fiolet→złoto) zamiast płaskiego fioletu** — na kresce pod
  „Założyciel" i na banerze CTA. Technika „bulletproof background": VML
  (`v:rect`/`v:roundrect` + `v:fill type="gradient"`) w komentarzu
  `<!--[if mso]>` dla Outlooka, zwykły CSS `background-image` +
  `bgcolor` fallback dla reszty klientów — bez obrazków, patrz
  `gradientBar()`/`bannerHtml()` w `lib/mailSignature.ts`.
  ⚠️ **Świadomie NIE dokładny kanon `.text-liquid`** (który na 100% dochodzi
  do prawie białego kremu) — na pełnowymiarowym tle banera to psuło kontrast
  nakładanego tekstu (nagłówek/tagline stawały się nieczytelne w jasnej
  części gradientu). Banner trzyma się ciemnych odcieni
  (`bannerBg → purple → gold`, bez jasnego kremowego stopu); CTA dostał
  własną białą „pigułkę" z ciemnym tekstem, więc jest czytelne niezależnie od
  tego, gdzie akurat wypadnie w gradiencie. Kreska pod „Założyciel" (mały
  pasek 40×3px) używa pełnego dwustopniowego gradientu — tam kontrast nie
  jest problemem, bo nic się na niej nie renderuje.
  ⚠️ VML nie da się zobaczyć w Chrome (patrz „Jak podejrzeć efekt" w briefie)
  — ostateczny test w prawdziwym Outlooku robi właściciel.
- **Dark mode fallback.** Cała tabela podpisu dostała jawne jasne tło
  (`#FFFFFE`, prawie biały — nie czysty `#FFFFFF`), żeby nie dziedziczyć tła
  maila i nie paść ofiarą auto-inwersji kolorów w Outlooku/Apple Mail w
  trybie ciemnym. Logo (przezroczyste tło PNG) dostało jasną „podkładkę" pod
  spodem z tego samego powodu — inaczej mogłoby zlać się z ciemnym tłem.
  Wszystkie pozostałe użycia czystego `#FFFFFF` w banerze/CTA też zamienione
  na `#FFFFFE`.

**Research wzorców stopek topowych firm** (Apple, Stripe, Linear, Notion,
Figma, agencje kreatywne) — zatwierdzone przez właściciela do wdrożenia:
dark mode fallback (zrobione wyżej), alt text (już był na zdjęciu/logo,
banner nie ma obrazków więc nie potrzebuje), prawie-czarny/prawie-biały
zamiast czystych skrajności (zrobione). **Świadomie odłożone bez zmiany**
(nie cofać bez pytania):
- `cid:` zamiast hostowanych obrazków — większość źródeł poleca linkowane
  `https://`, ale to koliduje ze świadomą decyzją „bez remote-loadingu"
  (patrz wyżej, trzecia tura); zostawione właścicielowi do przemyślenia.
- Delimiter `--` (RFC 3676) — rekomendacja researchu: NIE dodawać (dotyczy
  formalnie plain-textu/Usenetu, a część klientów chowa treść pod nim w
  cytowaniach, co realnie mogłoby ukryć klauzulę poufności). Uwaga: wersja
  tekstowa (`signatureText()`) ma `--` jako pierwszą linię od samego początku
  (trzecia tura) — nie usunięte, bo właściciel o to nie poprosił, ale warto
  wiedzieć, że to niespójne z rekomendacją i teoretycznie ten sam wektor
  ryzyka dotyczy klauzuli poufności w wersji tekstowej.
- Max-width 560px, emoji zamiast ikon, zdjęcie+baner razem — zostają, już w
  normie.

### Moduł 4d — dopasowanie do klienta, kartoteka, szybkie akcje, szerokość (2026-07-15)

Właściciel używał poczty na produkcji i zgłosił cztery braki
(`docs/plany-modulow/04d-poczta-powiazanie-i-ux.md`):

- **⚠️ Luka w logice, nie kosmetyka: mail od znanego klienta nie był
  rozpoznawany, gdy kontakt powstał PO otrzymaniu maila.** `findContactsByEmail()`
  było wołane wyłącznie w `saveIncoming()` przy pobraniu wiadomości — mail,
  który przyszedł zanim właściciel założył klienta/leada, zostawał
  `client_id = NULL` na zawsze, bo nic go potem nie sprawdzało ponownie. Skoro
  właściciel dopiero buduje bazę klientów, to był codzienny przypadek, nie
  wyjątek. Naprawione dwutorowo:
  - `rematchUnassigned()` w `lib/mailSync.ts` — wzorem `backfillCategories()`,
    wołane w `syncMailbox()` przy każdym otwarciu zakładki/cronie: bierze do
    300 maili `client_id IS NULL AND lead_id IS NULL AND kategoria <> 'reklama'`
    i próbuje dopasować ponownie, dopisując wpis na oś (`logMailOnTimeline`,
    z tą samą ochroną przed duplikatem co ręczne przypisanie).
  - Ta sama funkcja wołana też **od razu** z `POST`/`PATCH` `/api/clients` i
    `/api/leads`, gdy pojawia się/zmienia się `email` — właściciel nie czeka
    na kolejny sync, zaległa korespondencja dopina się w momencie zapisania
    klienta.
- **Kartoteka korespondencji na karcie klienta.** Świadoma zmiana wcześniejszej
  decyzji z `04-skrzynka-mailowa.md` („bez osobnej sekcji, mail wpada w
  scalony feed") — właściciel po naprawie punktu 1 wprost potwierdził, że
  nadal chce osobnego rejestru. Sekcja „Korespondencja" na
  `ClientDetailPanel.tsx`, lista maili (temat, kierunek, status, data) z
  linkiem do pełnej treści w Poczcie. `GET /api/clients/[id]` dociąga teraz
  też `mail` (do 100 wiadomości `WHERE client_id = ...`), obok istniejącego
  scalonego `feed`.
- **Szybkie akcje bez otwierania podglądu.** Klik w plakietkę statusu NA
  LIŚCIE (`MailDashboard.tsx`) otwiera małe menu (Obsłużone/Wycisz/Przywróć)
  zamiast wymagać otwarcia całego podglądu — `stopPropagation`, optymistyczna
  zmiana stanu listy, PATCH `/api/mail/[id]` w tle. Wiersz listy zmienił się z
  zagnieżdżonego `<button>` na `<div role="button">` (żeby plakietka mogła być
  osobnym, prawdziwym `<button>` w środku — HTML nie pozwala zagnieżdżać
  buttonów).
- **Pełna szerokość ekranu.** Modal `max-w-5xl` zastąpiony układem
  dwukolumnowym w `MailDashboard.tsx`: lista (stała szerokość 420px) + podgląd
  wybranej wiadomości obok, na całą resztę szerokości (wzorem Outlooka —
  rozwiązuje też punkt szybkich akcji, bo zmiana wiadomości nie wymaga już
  modala). Standalone `[id]/page.tsx` (`MailDetail.tsx`) też stracił
  `max-w-5xl` — pełna szerokość, margines tylko z paddingu. Czytelność akapitu
  (bardzo długie linijki) pilnuje `max-w-[70ch]` w samej treści maila
  (`MailDetailPanel.tsx`), NIE na całej karcie.

## Bramka migracji — dlaczego panel przestał mielić przy wejściu (2026-07-15)

Właściciel zgłosił: „wszystko wczytuje się bardzo wolno". Zmierzone, nie
zgadywane — łańcuch migracji uruchamiany przy zimnym starcie:

| Wejście | Zapytań do bazy |
|---|---|
| **Poczta** (ciągnie leady + klientów + faktury) | **156** |
| Klienci | 141 |
| Faktury | 103 |

Klient `neon()` w trybie HTTP wysyła KAŻDE zapytanie jako osobne żądanie, więc
przy ~50 ms na jedno to kilka sekund samego czekania na sieć, zanim
cokolwiek się policzy. Płacone przy każdym **zimnym starcie** funkcji na
Vercelu (stąd objaw: pierwsze wejście mieli, kolejne są szybkie, po przerwie
znowu mieli). **To nie wina poczty** — wzorzec „migracje przy pierwszym
użyciu" jest w panelu od początku; poczta ma po prostu najdłuższy łańcuch
zależności ze wszystkich modułów i pierwsza to obnażyła.

**Rozwiązanie:** tabela `schema_state(name, version)` + `schemaUpToDate()` /
`markSchemaApplied()` w `lib/db.ts`. Wersja = `VERCEL_GIT_COMMIT_SHA`, czyli
zmienia się dokładnie przy każdym wdrożeniu. Pierwsze żądanie po wdrożeniu
wykonuje migracje i odhacza je; każde kolejne płaci **2 zapytania zamiast
150+**. Migracje pozostają idempotentne — bramka nie zmienia ich treści, tylko
pomija powtarzanie tego, co już zrobiono w TEJ wersji kodu. Padnięcie w
połowie = wersja niezapisana = następne żądanie próbuje od nowa.

**W dev bramka jest wyłączona** (brak SHA) — migracje lecą zawsze. Celowo:
PGlite jest w tym samym procesie (zapytanie ≈ darmowe), a przy dopisywaniu
kolumny zmiana ma działać od razu, bez kombinowania z wersjami.

⚠️ **Przy dodawaniu nowego schematu** pamiętaj o obu liniach:
`if (await schemaUpToDate("nazwa")) return;` na początku i
`await markSchemaApplied("nazwa");` na końcu `create*Schema()`.

⚠️ **Czego NIE dało się sprawdzić lokalnie:** samego pominięcia migracji przy
kolejnym zimnym starcie — dev-baza żyje w pamięci procesu, więc nowy start to
nowa, pusta baza i migracje zawsze muszą polecieć. Zweryfikowano: brak
zakleszczenia, poprawne dane przy aktywnej bramce, zapis wersji. Realny zysk
czasu widać dopiero na produkcji.

**Przy okazji złapana pułapka (ta sama co niżej):** pierwsza wersja bramki
czytała `schema_state` zwykłym `SELECT`-em, poza `inMigration()` — przez co w
dev seeder czekał na wersję, a wersja na seed. Wszystkie `/api/*` wisiały 60 s.
Odczyt stanu migracji też jest migracją.

### Moduł 4 — Etap 2 (foldery IMAP): Odebrane/Wysłane/Kosz/Archiwum, klawiatura, bulk actions (2026-07-16)

Po audycie UX modułu Poczty na żywym zrzucie ekranu (właściciel: dużo pustego
miejsca w layoucie, biały podgląd maila razi na ciemnym tle, brak prawdziwych
"skrzynek" jak w Apple Mail, chce upodobnienie UX do topowych klientów
pocztowych) zbudowany rdzeń "Etapu 2" z `docs/plany-modulow/04b-poczta-pelny-klient.md`
— realne foldery IMAP, nie pseudo-foldery z samego `kierunek`. Właściciel
wybrał to świadomie, znając koszt ("przepisanie fundamentu, nie dokładanie
przycisków"), zamiast prostszej opcji.

- **Bugfix nazwy nadawcy:** `mailFrom()` (`lib/mailbox.ts`) zwracała surowy
  login skrzynki (`kontakt@leggeralabs.pl`) jako nagłówek `From` przy
  wysyłce — odbiorca widział adres zamiast "Leggera Labs". Teraz domyślnie
  `"Leggera Labs <" + cfg.user + ">"` (wzorzec z `RESEND_FROM` w
  `lib/email.ts`), `MAIL_FROM` nadal pozwala nadpisać całość.
- **Schemat bazy** (`lib/db.ts`): nowa tabela `mail_folders` (własna bramka
  migracji `"mail_folders"`) — `role` ('inbox'/'sent'/'trash'/'archive'),
  `imap_path` (realna ścieżka na serwerze, wynik discovery — bywa różna niż
  `role`), `special_use`, `uidvalidity`, `last_seen_uid` per folder, zamiast
  jednego globalnego kursora w `mail_state` (który zostaje w bazie, ale kod
  przestał go aktualizować). Wiersz `role='inbox'` migrowany NATYCHMIAST z
  `mail_state`, żeby nie zgubić postępu synchronizacji. Nowa kolumna
  `mail_messages.folder` (domyślnie `'inbox'`), z backfillem
  `kierunek='out' → folder='sent'` dla już wysłanych z panelu maili — "Wysłane"
  nie jest puste od razu po wdrożeniu.
- **`lib/mailbox.ts`:** `discoverMailFolders()` — `LIST (SPECIAL-USE)`
  najpierw, fallback po nazwach dopiero potem (uogólnienie wzorca, który już
  miał `appendToSent()` — ta funkcja przepisana, żeby go wołać zamiast mieć
  własną zduplikowaną listę). `fetchNewMessages()` → `fetchMessagesInFolder()`
  (przyjmuje dowolny `imapPath`, nie tylko `"INBOX"`). Nowe `moveMessage()` —
  natywne IMAP MOVE (RFC 6851, atomowe) do Archiwum/Kosza; **komentarz w
  kodzie wprost: NIGDY nie wołać EXPUNGE ręcznie** — jeśli serwer nie wspiera
  MOVE, imapflow emuluje przez COPY+STORE+EXPUNGE, co bez UIDPLUS mogłoby
  skasować też inne wiadomości oznaczone `\Deleted`; `moveMessage()` loguje
  `console.warn`, jeśli brakuje capability `MOVE`/`UIDPLUS` (widoczne w
  `vercel logs`, do zweryfikowania na produkcji — nie da się stąd sprawdzić
  wobec az.pl). Nowe `getFolderCursorStart()` (tania komenda STATUS) —
  punkt startowy kursora dla nowo odkrytego folderu.
- **`lib/mailSync.ts`:** `syncMailbox()` iteruje po wszystkich wierszach
  `mail_folders` z osobną logiką zapisu per rola: `inbox` — dokładnie
  dotychczasowa ścieżka (`saveIncoming()`, klasyfikacja, dopasowanie,
  oś kontaktu); `sent` — nowe `saveOutgoingFromServer()`, dopasowanie
  kontaktu po ODBIORCY (`to_addr`/`cc_addr`), nie po nadawcy (ten to zawsze
  nasz adres) — dedup po `message_id` sprawia, że kopia z Sent nie dubluje
  wiersza zapisanego przy wysyłce z panelu; `trash`/`archive` — lekki odczyt
  (`saveArchivedOrTrashed()`), świadomie BEZ klasyfikacji/dopasowania/wpisu
  na oś kontaktu (to dane już raz odrzucone przez właściciela, nie mają
  automatycznie "ożywać"). **Decyzja właściciela 2026-07-16: bez ściągania
  historii** — nowo odkryty folder startuje kursor "od teraz", nie od zera.
  Konflikt po `message_id` w `sent`/`trash`/`archive` aktualizuje `folder`,
  jeśli się zmienił (np. mail przeniesiony później do innego folderu w
  Outlooku) — w przeciwieństwie do `inbox`, gdzie `DO NOTHING` zostaje bez
  zmian.
- **API:** `GET /api/mail?folder=inbox|sent|trash|archive` (domyślnie
  `inbox`), `counts` rozszerzone o `folder_inbox/sent/trash/archive` do
  liczników w sidebarze; liczniki "Do odpowiedzi"/kategorii świadomie
  ograniczone do `folder='inbox'`. `PATCH /api/mail/:id` rozszerzone o
  `{ move: "trash"|"archive"|"inbox" }` — mapuje folder źródłowy/docelowy na
  `mail_folders.imap_path`, woła `moveMessage()`, DOPIERO PO sukcesie
  aktualizuje `mail_messages.folder` (błąd IMAP nigdy nie zmienia stanu bazy).
  `reply`/`forward`/`compose` insertują `folder='sent'` od razu (nie czekają
  na kolejny sync). `maxDuration` syncu podniesione 60→90 (discovery + do 4
  folderów w jednym przebiegu).
- **UI:** sidebar folderów (📥 Odebrane/📤 Wysłane/🗑️ Kosz/🗄️ Archiwum,
  emoji zgodnie z decyzją projektu — NIE zamienione na bibliotekę ikon)
  przed listą 420px w `MailDashboard.tsx`; filtry "Do odpowiedzi"/"Rodzaj"
  renderują się tylko w Odebranych. Nawigacja klawiaturą (`isTypingTarget()`
  z `app/[lang]/admin/ui.tsx`, już używane w `ClientsDashboard.tsx`, reużyte
  nie napisane od nowa): j/↓, k/↑ po liście, Enter otwiera, spacja zaznacza,
  `r` otwiera odpowiedź (nowy prop `replyShortcut` w `MailDetailPanel.tsx` —
  inkrementowany nonce), `e` = Obsłużone (decyzja właściciela: status, NIE
  MOVE — folder i status to dwie osobne osie), Escape zamyka podgląd.
  Zaznaczanie wielu (`Set<string>`, wzorem `ClientsDashboard.tsx`) + pasek
  "Zaznaczono: N" (Obsłużone/Archiwizuj/Usuń — sekwencyjne wywołania
  istniejącego `PATCH`, bez nowego endpointu zbiorczego). "Wycisz" (status)
  zostaje OBOK nowych "Archiwizuj"/"Usuń" (folder) — dwie niezależne akcje,
  decyzja właściciela. Poprawki wizualne: `MailDetailPanel.tsx` — treść maila
  wycentrowana (`mx-auto`) zamiast przy lewej krawędzi (mniej rażące puste
  miejsce na szerokim ekranie); `MailBodyHtml.tsx` — subtelniejsza ramka
  (padding + cień) wokół `<iframe>` treści maila — NIE wymuszamy ciemnego
  tła na treści maila (ta ma często własne, wpisane w HTML białe tło —
  tak samo robi Apple Mail/Gmail, to nie bug).
- **Świadomie odłożone w tej samej sesji** (uzasadnienie w
  `docs/plany-modulow/04b-poczta-pelny-klient.md` → Etap 2): Robocze
  (Drafts, to nowa funkcja od zera — autosave + APPEND/delete dance,
  UIDPLUS), CONDSTORE/QRESYNC (optymalizacja, zero wpływu na UX), pełne
  dwukierunkowe flagi `\Seen`/`\Answered`/`\Flagged` (MOVE zachowuje flagi
  przy przenoszeniu — to "za darmo"), przejście na architekturę outbox+cron
  zamiast IMAP w ścieżce żądania (głębsza zmiana niż same foldery — dziś
  `moveMessage()`/`syncMailbox()` nadal w ścieżce żądania, spójnie z
  istniejącym `sendMail()`/`appendToSent()`).
- **Zweryfikowane lokalnie (2026-07-16):** `tsc` czysty. W przeglądarce
  (PGlite, tymczasowo odblokowane dane mailbox — patrz wzorzec z Modułu 7):
  sidebar folderów przełącza widoki poprawnie (Wysłane puste jak
  oczekiwano), nawigacja klawiaturą (j/k/Enter/Escape/e/r) działa zgodnie z
  projektem, zaznaczanie wielu + pasek akcji zbiorczych działa, próba
  "Usuń"/"Archiwizuj" bez prawdziwego IMAP-a zwraca kontrolowany błąd 502
  ("Nie znaleziono folderu... sprawdź konfigurację skrzynki") — mail
  zostaje na miejscu, panel w pełni używalny, bez crasha. **Realna
  weryfikacja wobec az.pl (czy SPECIAL-USE działa, czy MOVE jest wspierane,
  czy Wysłane/Kosz/Archiwum faktycznie się odkrywają) możliwa dopiero na
  produkcji** — analogicznie do Modułu 8 (OCR), które było iteracyjnie
  naprawiane na podstawie logów produkcyjnych po pierwszym wdrożeniu.
  Właściciel powinien po wdrożeniu: wysłać testowego maila z Outlooka i
  sprawdzić, czy pojawia się w "Wysłane" w panelu po odświeżeniu; kliknąć
  "Usuń" na testowym mailu i potwierdzić w Outlooku, że wylądował w
  prawdziwym Koszu (nie zniknął bezpowrotnie); sprawdzić `vercel logs` pod
  kątem ostrzeżeń o brakujących capabilities MOVE/UIDPLUS.

**Pierwsza runda poprawek po realnym teście (2026-07-16, ten sam dzień)** —
właściciel wysłał testowego maila z Outlooka do siebie i zgłosił: mail nie
pojawił się w "Wysłane" w panelu, odświeżanie ("Pobierz nowe") trwało
zauważalnie długo, i nadal nie widział "Leggera Labs" jako nadawcy.
Zdiagnozowane z `vercel logs` (`npx vercel logs <url-ostatniego-deploya>`,
CLI zalogowane w tym środowisku — nie trzeba pytać właściciela o logi ręcznie):

- **Prawdziwy bug w `saveOutgoingFromServer()`** (`lib/mailSync.ts`):
  `logMailOnTimeline()` dostawał lokalnie wygenerowany `id` zamiast
  `written[0].id` zwróconego przez zapytanie. Dla ŚWIEŻEGO INSERT-u oba są
  identyczne (bez objawów), ale gdy INSERT trafił w `ON CONFLICT` (bo
  wiadomość self-mail wpadła też do INBOX-a pod tym samym `message_id` i
  `saveIncoming()` zdążył ją zapisać pod SWOIM id pierwszy) — `written[0].id`
  to prawdziwy id istniejącego wiersza, a lokalny `id` wskazuje donikąd.
  Efekt na produkcji: `NeonDbError 23503` — "insert or update on table
  client_activity violates foreign key constraint... Key (mail_message_id)=
  (...) is not present in table mail_messages". INSERT/UPDATE samej
  wiadomości i tak się udawał (błąd leciał w kroku PO nim), więc mail
  faktycznie trafiał do bazy z `folder='sent'` — ale rzucony wyjątek
  przerywał liczenie w tej iteracji, przez co właściciel nie miał pewności,
  czy się zapisał. Naprawione: `mailId: written[0].id`.
- **Wolniejsze odświeżanie — nie bug, oczekiwany koszt architektury, ale
  do złagodzenia:** każdy folder (`inbox`/`sent`/`trash`/`archive`) to
  OSOBNE połączenie IMAP (TLS+AUTH+SELECT), a `syncOneFolder()` był wołany
  sekwencyjnie w pętli — czas syncu rósł liniowo z liczbą odkrytych
  folderów (do 4) zamiast być ograniczonym najwolniejszym z nich.
  Naprawione: `Promise.allSettled()` zamiast pętli `for` w `syncMailbox()` —
  foldery synchronizują się równolegle. `allSettled`, nie `all`: awaria
  jednego folderu (rzadka, ale możliwa — np. serwer akurat wolny na Trash)
  nie przerywa zapisu pozostałych; błąd INBOX-a (jedyna rola, która nadal
  rzuca dalej) jest świadomie przepuszczany po zebraniu wyników reszty.
- **"Leggera Labs" wciąż nie widoczne — to NIE bug, tylko test niewłaściwej
  ścieżki.** Właściciel testował, wysyłając mail BEZPOŚREDNIO Z OUTLOOKA —
  `mailFrom()` (poprawiony wcześniej tego samego dnia) wpływa WYŁĄCZNIE na
  maile wysyłane Z PANELU (Odpisz/Przekaż/Nowa wiadomość, przez `sendMail()`
  w `lib/mailbox.ts`). Mail skomponowany wprost w Outlooku ma nazwę nadawcy
  całkowicie z ustawień konta Outlooka — panel nigdy nie jest na tej ścieżce.
  Potwierdzone przez `npx vercel env ls production`: `MAIL_FROM` NIE jest
  ustawione na Vercelu, więc domyślna wartość z kodu (`"Leggera Labs <" +
  adres + ">"`) powinna już działać dla maili wysłanych z panelu — do
  potwierdzenia przez właściciela osobnym testem (Nowa wiadomość → do
  zewnętrznego adresu, nie do siebie przez Outlooka).
- Do potwierdzenia po tej rundzie poprawek: czy testowy self-mail faktycznie
  pojawił się w "Wysłane" (kliknij "Pobierz nowe" ponownie — insert z
  poprzedniej próby prawdopodobnie już się udał mimo błędu w logu, dedup po
  `message_id` obroni przed duplikatem), i czy odświeżanie jest teraz
  wyraźnie szybsze.

**Druga runda poprawek (2026-07-16, ten sam dzień)** — właściciel zgłosił
dwie rzeczy po pierwszej rundzie: odświeżanie NADAL nie szybsze mimo
zrównoleglenia, i self-mail zniknął z Odebranych (widoczny tylko w Wysłane).

- **Prawdziwa przyczyna wolnego syncu, znaleziona w kodzie
  `fetchMessagesInFolder()` (`lib/mailbox.ts`):** zrównoleglenie folderów z
  pierwszej rundy skróciło TYLKO czas nawiązywania połączeń, ale nie dotknęło
  prawdziwego winowajcy — zakres IMAP `${sinceUid+1}:*` dopasowuje OSTATNIĄ
  wiadomość w folderze, NAWET GDY nie jest nowa (znana pułapka "*", opisana
  już w komentarzu przy tej funkcji) — a zapytanie fetch pobierało jej PEŁNĄ
  treść (`source: true`) zanim cokolwiek odfiltrowało ją jako "nie nowa". To
  znaczy: KAŻDY sync, dla KAŻDEGO z 4 folderów, ściągał pełną treść co
  najmniej jednego maila na darmo — przy dużych mailach (załączniki) w
  Archiwum/Koszu to realny, wielosekundowy koszt, i to jeszcze PRZED moją
  optymalizacją równoległości. Naprawione: tania kontrola `uidNext` (z
  `client.mailbox`, dostępne od razu po SELECT/`getMailboxLock`, zero
  dodatkowego zapytania) PRZED fetchem — jeśli `uidNext - 1 <= sinceUid`,
  folder naprawdę nie ma nic nowego, funkcja wraca natychmiast bez
  dotykania treści żadnej wiadomości.
- **Self-mail znikający z Odebranych — realne ograniczenie schematu, nie
  literalny bug do "naprawienia" w pełni.** Mail wysłany do siebie fizycznie
  istnieje na serwerze W DWÓCH folderach naraz (Wysłane — nasza kopia,
  Odebrane — bo jesteśmy też odbiorcą) pod TYM SAMYM `message_id`. Nasz
  schemat (Etap 2) trzyma JEDEN wiersz na `message_id` z JEDNĄ wartością
  `folder` — nie potrafi wprost reprezentować "ta sama wiadomość w dwóch
  miejscach naraz". `saveOutgoingFromServer()` (`lib/mailSync.ts`) miał
  "sprytną" logikę aktualizacji folderu przy konflikcie (żeby np. mail
  przeniesiony później do Archiwum w Outlooku poprawnie "przeskoczył" folder)
  — ale ta sama logika przy self-mailu podkradała wiadomość z Odebranych do
  Wysłane. Naprawione częściowo: `'inbox'` jest teraz "chronione" — skan
  Wysłane nigdy nie nadpisze wiadomości, która już jest w Odebranych
  (Odebrane to kolejka "wymaga reakcji", ważniejsza niż widoczność w
  Wysłane). Efekt uboczny, świadomie zaakceptowany: self-mail będzie
  widoczny w Odebranych, ale NIE pojawi się DODATKOWO w Wysłane — pełne
  rozwiązanie (jedna wiadomość widoczna w dwóch folderach naraz) wymagałoby
  zmiany schematu (osobna tabela łącząca wiadomość z wieloma folderami),
  którą warto rozważyć, jeśli self-mail jako test/przypomnienie do siebie
  okaże się częstym, realnym przypadkiem użycia, nie tylko testem tej sesji.
- **Zweryfikowane:** `tsc` czysty. Realna poprawa czasu syncu i poprawność
  self-mail w Odebranych do potwierdzenia przez właściciela na produkcji po
  tym wdrożeniu — nie da się zmierzyć z tej sesji (brak dostępu do az.pl).

**Trzecia runda — DIAGNOZA Z REALNYCH LOGÓW, nie zgadywanie (2026-07-16).**
Właściciel zgłosił brak poprawy mimo dwóch poprzednich rund. Dodane
tymczasowe `console.log` z czasem każdego etapu `syncMailbox()`/
`syncOneFolder()` ujawniły PRAWDZIWY rozkład ~5.3s syncu (po wcześniejszych
poprawkach — wcześniej bliżej ~20s):
- ~1s: `backfillCategories`/`backfillCc`/`rematchUnassigned` (porządki bazowe).
- **~1.8s: samo `discoverMailFoldersOnce()`** (osobne połączenie IMAP:
  TLS+AUTH+LIST) — okazało się największym pojedynczym kosztem, i to
  **niepotrzebnym przy każdym syncu**, bo foldery na serwerze prawie nigdy
  się nie zmieniają.
- ~2s: 3 równoległe połączenia (Odebrane/Wysłane/Kosz) — nawet z pustym
  fetchem (0 wiadomości, wcześniejsza optymalizacja `uidNext` zadziałała)
  samo połączenie+SELECT do tego serwera pocztowego kosztuje ~2s.

Naprawione: `discoverMailFoldersOnce()` woła się TYLKO gdy w `mail_folders`
nie ma jeszcze ŻADNEGO wiersza `sent`/`trash`/`archive` (czyli praktycznie
tylko przy pierwszym syncu po wdrożeniu) — kolejne synce pomijają je
całkowicie. Świadomy kompromis: zmiana nazwy folderu na serwerze albo nowo
utworzone Archiwum nie zostaną wykryte automatycznie (trzeba by ręcznie
skasować odpowiednie wiersze `mail_folders`, żeby wymusić ponowne discovery)
— akceptowalne, bo to rzadkie zdarzenie, a oszczędność jest spora (~1.8s z
~5.3s, czyli ~1/3 całkowitego czasu).

**Osobno znaleziona przyczyna "58 reklam w Wysłane" (bug frontendowy, NIE
bazodanowy):** `load()` w `MailDashboard.tsx` nie chronił się przed
odpowiedziami, które wracają w INNEJ kolejności niż zostały wysłane — przy
szybkim przełączaniu folderów starsza odpowiedź (np. dla Kosza) mogła
przyjść PO nowszej (dla Wysłane) i nadpisać jej wynik, mimo że sidebar
pokazywał już poprawnie wybrane "Wysłane". Naprawione: `loadSeqRef` —
monotonicznie rosnący numer żądania, odpowiedź stosowana tylko, gdy wciąż
jest najnowsza; starsze, spóźnione odpowiedzi są po cichu odrzucane.

Do zweryfikowania przez właściciela po tym wdrożeniu: czy sync jest teraz
odczuwalnie szybszy (oczekiwane: bliżej ~3.5s zamiast ~5.3s przy kolejnych
syncach, bo discovery już się nie powtarza), i czy przełączanie folderów
zawsze pokazuje właściwą zawartość.

### Moduł 4e — upodobnienie UX do Apple Mail (2026-07-16)

Po audycie UX/wydajności Etapu 2 (sekcje wyżej) właściciel przesłał zrzuty
ekranu (nasz panel + realny Apple Mail na jego Macu) i wskazał Apple Mail
jako "złoty standard". Brief zatwierdzony w
`docs/plany-modulow/04e-poczta-apple-mail-ux.md` — WYŁĄCZNIE runda
wizualna/strukturalna, backend folderów/MOVE/syncu z Etapu 2 bez zmian, poza
jednym maleńkim dodatkiem (link wypisu, patrz niżej).

- **Pasek akcji przeniesiony na górę podglądu** (`MailDetailPanel.tsx`) —
  wcześniej rządek przycisków renderował się PO treści maila, na samym
  dole karty; teraz jest bezpośrednio pod nagłówkiem (temat + tagi +
  zamknij), widoczny bez przewijania nawet przy długim mailu. Tryb
  odpowiedzi/przekazania nadal ZASTĘPUJE pasek w tym samym miejscu (nie
  osobna sekcja). Grupowanie: główna akcja (`.btn-primary`, "Odpisz") →
  drugorzędne zawsze widoczne ("Odpowiedz wszystkim" gdy jest DW, "Przekaż",
  "Archiwizuj", "Usuń") → rzadziej używane schowane w menu "•••"
  ("Wycisz", "Obsłużone"/"Przywróć do odpowiedzi" zależnie od stanu,
  "Przywróć do Odebranych" w Koszu/Archiwum, "Otwórz w Outlooku") —
  overflow zbudowany na `Popover`/`MenuRow` z `app/[lang]/admin/Menu.tsx`,
  ten sam komponent co pasek akcji zbiorczych w `ClientsDashboard.tsx`,
  bez pisania nowego menu od zera.
- **Kategorie ("Rodzaj") przeniesione do sidebara** (`MailDashboard.tsx`) —
  wzorem "Inteligentnych skrzynek pocztowych" Apple Mail: wcześniej
  `CAT_FILTERS` renderowały się jako poziomy rządek pigułek nad listą,
  teraz osobna sekcja sidebara POD folderami, z nagłówkiem "Rodzaj" i tymi
  samymi licznikami (`counts[c.id]`, bez zmian w API), renderowana TYLKO w
  Odebranych. Filtry statusu ("Do odpowiedzi"/"Nieprzypisane"/"Wszystkie")
  celowo ZOSTAJĄ jako rządek pigułek nad listą — to była świadomie zawężona
  decyzja właściciela, nie przeoczenie.
- **Baner "Wiadomość z listy dystrybucyjnej"** (jedyna zmiana backendu tej
  rundy) — dotąd `mail_messages.list_unsubscribe` trzymał tylko BOOLEAN
  obecności nagłówka, nie samą wartość (link do wypisania). Nowa nullable
  kolumna `list_unsubscribe_url TEXT` (bramka migracji `"mail"`, ta sama
  wersja podniesiona); `parseUnsubscribeUrl()` (`lib/mail.ts`) parsuje
  `List-Unsubscribe` wg RFC 2369/8058 (`<https://...>, <mailto:...>`),
  preferuje `http(s)://` nad `mailto:`, zwraca `null` gdy nagłówek jest
  pusty/nie do sparsowania — nigdy nie zgaduje URL-a. Dociąganie surowej
  wartości nagłówka: `fetchMessagesInFolder()` i `fetchHintsByUids()`
  (`lib/mailbox.ts`); zapis: `saveIncoming()` i `backfillCategories()`
  (`lib/mailSync.ts`); SELECT: `GET /api/mail`. UI: baner nad treścią maila
  (pod paskiem akcji), widoczny gdy `list_unsubscribe_url` niepuste — link
  "Anuluj subskrypcję" otwiera się w nowej karcie dla `http(s)`, zwykłym
  `mailto:` dla adresu e-mail. To zwykły klik użytkownika — panel nigdy sam
  nie odpytuje ani nie POST-uje do cudzego URL-a wypisu w tle.
- **Dopracowanie wizualne** (`MailDetailPanel.tsx`/`MailDashboard.tsx`):
  hierarchia nagłówka podglądu odwrócona wzorem Apple Mail — nazwa nadawcy
  teraz NAJBARDZIEJ wyróżniony element (większy, pogrubiony), adres
  przygaszony tuż obok, temat mniejszy pod spodem (wcześniej odwrotnie:
  temat `text-lg`, nadawca mały). Odstępy pionowe na liście wiadomości
  zwiększone (`py-3` → `py-3.5`) dla większego "oddechu" zgodnie ze zrzutem
  właściciela. Sidebar poszerzony (`lg:w-40` → `lg:w-44`) pod dwie sekcje
  (foldery + Rodzaj) zamiast jednej.
- **Zweryfikowane lokalnie (2026-07-16):** `tsc` czysty. W przeglądarce
  (PGlite + dev-login) — dodana jedna seedowa wiadomość z syntetycznym
  `list_unsubscribe_url` (`lib/dev-db.ts`, `ensureSeeded()`) do wizualnej
  weryfikacji banera bez dostępu do prawdziwych nagłówków IMAP: sidebar
  pokazuje sekcję "Rodzaj" z poprawnymi licznikami, pasek akcji widoczny na
  górze bez przewijania, menu "•••" pokazuje tylko akcje właściwe dla
  bieżącego stanu wiadomości (np. "Przywróć do odpowiedzi" zamiast
  "Obsłużone" dla już obsłużonej), baner wypisu renderuje się z klikalnym
  linkiem do `https://example.com/unsubscribe?id=test`. **Realne dociągnięcie
  prawdziwej wartości `list_unsubscribe_url` z działającej skrzynki (czy
  parsowanie nagłówka faktycznie wyciąga poprawny URL z prawdziwego
  newslettera) do potwierdzenia na produkcji** — analogicznie do innych
  zmian dotykających parsowania IMAP w tym module.

### Moduł 4e, runda 2 — szerokość, obcinanie tekstu, flagi, więcej skrótów (2026-07-16)

Właściciel obejrzał wdrożenie rundy 1 na żywo (zrzut ekranu z szerokiego
monitora) i zgłosił: dużo czarnej przestrzeni marnowanej po prawej stronie
i między kolumnami, nazwa nadawcy/temat/podgląd na liście brutalnie obcinane,
status wiadomości powinien być klikalny wprost w tagu (nie tylko w menu
"•••"), brak możliwości flagowania wiadomości, i pytanie o porównanie z
najlepszymi klientami pocztowymi (odpowiedź: patrz `docs/plany-modulow/04b-poczta-pelny-klient.md`
→ Etap 3, nieprzekreślone punkty — screener/VIP/snooze/nudge/wątkowanie,
świadomie NIE zaczęte w tej rundzie, zbyt duży zakres na jedną sesję).

- **Pełna szerokość ekranu TYLKO dla Poczty** (`AppShell.tsx`) — globalny
  wrapper treści panelu (`mx-auto max-w-[1800px]`, dotyczy WSZYSTKICH modułów)
  marnował przestrzeń najbardziej widocznie na gęstym, trójkolumnowym
  dashboardzie Poczty na szerokich/ultra-szerokich monitorach. Naprawione
  warunkiem po `pathname` (już dostępny w `ShellBody`): trasa `/admin/mail`
  dostaje `max-w-none`, reszta modułów (Faktury/Projekty/formularze) zostaje
  przy dotychczasowym limicie — **nie ujednolicaj bez potrzeby**, to świadomie
  odrębna decyzja dla jednego modułu, nie zmiana globalnego designu.
- **Wiersz listy przebudowany z jednej linii + bocznej kolumny znaczników na
  TRZY linie** (`MailDashboard.tsx`) — poprzedni układ miał osobny,
  stałej-szerokości sibling (`flex shrink-0`) z kategorią+statusem+czasem
  (~200px), który zabierał miejsce NIEZALEŻNIE od tego, ile go potrzebowały
  nadawca/temat/podgląd w sąsiedniej kolumnie `flex-1` — stąd brutalne
  obcinanie nawet przy szerokiej kolumnie. Teraz: wiersz 1 = nadawca + flaga +
  czas, wiersz 2 = temat + tagi klienta/leada, wiersz 3 = podgląd treści +
  kategoria + status (klikalny). Każdy znacznik dzieli szerokość TYLKO ze
  swoją linią, nie z całą wysokością wiersza. Dodatkowo kolumna listy zmieniona
  ze sztywnych `420px` na responsywną (`lg:w-[38%] lg:min-w-[380px] lg:max-w-[620px]`)
  — rośnie razem ze stroną zamiast zostawać przyklejona do stałej wartości.
- **Status klikalny wprost w tagu nagłówka** (`MailDetailPanel.tsx`) — tag
  statusu owinięty w `PropertyMenu` (`../Menu`, ten sam komponent co np.
  status leada) z trzema opcjami (Do odpowiedzi/Obsłużony/Zignorowany).
  Konsoliduje wszystkie trzy przejścia statusu w jednym miejscu, dlatego
  usunięte z overflow menu "•••" (zostaje tam tylko "Przywróć do Odebranych" i
  "Otwórz w Outlooku" — to, co NIE jest zmianą statusu).
- **Flaga "ważne"** (`★`/`☆`) — świadomie TYLKO lokalna (decyzja właściciela,
  zapytany wprost: lekka flaga w naszej bazie vs. pełna dwustronna
  synchronizacja `\Flagged` z Outlookiem — ta druga to większy, osobny zakres
  z niezweryfikowanym ryzykiem wsparcia własnych keywordów na az.pl/Dovecot,
  patrz "Flagi" w `docs/plany-modulow/04b-poczta-pelny-klient.md` → Etap 2,
  nadal odłożone). Nowa kolumna `mail_messages.flagged BOOLEAN NOT NULL
  DEFAULT false` (bramka migracji `"mail"`), klikalna gwiazdka w liście i w
  nagłówku podglądu, PATCH `{flagged: boolean}`.
- **Nowe skróty klawiszowe** (wzorem Apple Mail, `MailDashboard.tsx` +
  `MailDetailPanel.tsx`): `f` (Przekaż) i `a` (Odpowiedz wszystkim) — działają
  TYLKO przy otwartym podglądzie (potrzebują formularza/pola DW, które żyją
  tam), ten sam wzorzec nonce co istniejące `r`; `s` (flaga), `y`
  (Archiwizuj), `Backspace` (Usuń) — działają na otwartej LUB fokusowanej
  wiadomości w liście (jak istniejące `e`), bez potwierdzenia (tak jak
  pojedynczy przycisk "Usuń" w podglądzie — tylko akcja ZBIORCZA pyta).
- **Zweryfikowane lokalnie (2026-07-16):** `tsc` czysty. W przeglądarce
  (PGlite + dev-login, viewport 1920×1000) — Poczta wypełnia pełną szerokość
  ekranu (zero czarnego marginesu po prawej), wiersze listy pokazują pełną
  nazwę nadawcy/temat bez obcinania, klik w tag statusu w podglądzie otwiera
  `PropertyMenu` z trzema opcjami i poprawnie aktualizuje (potwierdzone przez
  PATCH w sieci + zniknięcie z licznika "Do odpowiedzi"), flaga przełącza się
  klikiem w liście i w podglądzie (gwiazdka złota/pusta), menu "•••" pokazuje
  już tylko "Otwórz w Outlooku" (bez zdublowanych akcji statusu). Jedna
  seedowa wiadomość (`lib/dev-db.ts`) oflagowana na stałe do weryfikacji
  wizualnej gwiazdki.

### Naprawa przy okazji: zakleszczenie dev-bazy (2026-07-15)

Dodanie `ensureMailSchema()`/`ensureClientsSchema()` do seedera PGlite
ujawniło istniejącą pułapkę: seeder sam odpala migracje, a migracje robią nie
tylko DDL, ale i pojedyncze `INSERT`-y singletonów (`company_settings`,
`offer_templates`, `mail_state`). Taki INSERT wracał do taga dev-bazy, który
czeka na `ensureSeeded()` → seeder czekał na promise trzymany przez route →
**każde `/api/*` w dev wisiało ~56 s**. Filtr `isDDL()` celował dokładnie w
ten problem, ale łapie tylko CREATE/ALTER/DROP.

Naprawione przez `lib/migration-ctx.ts` (AsyncLocalStorage): migracja jawnie
oznacza swoje zapytania `inMigration()`, a tag dev-bazy je przepuszcza bez
czekania na seed. Świadomie **nie** rozpoznajemy tego po treści SQL-a (np.
„INSERT … ON CONFLICT DO NOTHING”), bo identyczny kształt mają zapytania
runtime, które na seed czekać MUSZĄ — choćby dedup poczty w `lib/mailSync.ts`.

## Wydajność nawigacji: sidebar prefetchował WSZYSTKIE strony na każde wejście (2026-07-16)

Właściciel zgłosił po Etapie 2 Poczty (foldery IMAP), że "cała aplikacja ma
problemy z wydajnością", nie tylko poczta — a mierzony czas synchronizacji
poczty (~3.2s po optymalizacjach, patrz sekcja wyżej) nie tłumaczył
odczuwalnego ~20-sekundowego opóźnienia przy wejściu w zakładkę. Diagnoza z
`vercel logs`: zaraz po KAŻDYM wejściu na dowolną stronę panelu, serwer
dostawał **12 równoległych żądań GET** — po jednym do KAŻDEJ pozycji w
sidebarze (Pulpit/Leady/Klienci/Oferty/Umowy/Projekty/Faktury/Koszty/Poczta/
Kalendarz/Notatnik/Statystyki), czasem zdublowane. To NIE był problem
konkretnej strony — to domyślne zachowanie `<Link>` z Next.js: sidebar
pokazuje wszystkie 12 pozycji na raz, więc IntersectionObserver widzi je
wszystkie od razu jako "w viewporcie" i odpala prefetch dla KAŻDEJ, na
KAŻDEJ stronie panelu — nawet jeśli właściciel patrzy tylko na jedną.

Skutek: każde jedno wejście do panelu = 12 dodatkowych zapytań do serwera
(każde z własnym ensureXSchema()/zapytaniami do bazy), niezależnie od tego,
którą stronę właściciel faktycznie chciał zobaczyć. To dotyczy WSZYSTKICH
stron panelu, nie tylko Poczty — Poczta tylko to uwypukliła, bo jej własny
sync (osobno) też jest wolny, więc dwa niezależne opóźnienia się sumowały.

Naprawione: `<Link>` w `AppShell.tsx` (rządek sidebara, `NAV.map(...)`)
dostał `prefetch={false}`. Klik w link działa dokładnie tak samo (zwykła
nawigacja), tylko bez wcześniejszego "podgrzewania" wszystkich 12 stron w
tle. Zweryfikowane: `tsc` czysty. Realną redukcję liczby zapytań przy
wejściu do panelu i odczuwalną poprawę czasu nawigacji trzeba potwierdzić
na produkcji — nie da się zmierzyć z tej sesji.

⚠️ Do rozważenia w przyszłości, jeśli to nie wystarczy: to samo zjawisko
może dotyczyć innych miejsc z wieloma linkami widocznymi naraz (np. wyniki
wyszukiwania w `CommandPalette.tsx`, listy leadów/klientów z linkami do
profili) — nie sprawdzone w tej sesji, bo sidebar (widoczny na KAŻDEJ
stronie) był oczywistym, najbardziej opłacalnym punktem startu.

## Czego świadomie nie ma (na razie)

- Brak zależności między zadaniami/projektami (np. „projekt B czeka na
  ukończenie projektu A”) — oś czasu jest poglądowa, nie blokuje niczego.
- Kalendarz nie obsługuje wydarzeń cyklicznych — każde wydarzenie to
  pojedynczy wpis.
- Brak wielu użytkowników/ról — panel jest jednoosobowy z jednym hasłem
  administratora, zgodnie z założeniem "narzędzie dla solo-przedsiębiorcy".
- Poczta (Moduł 4) nie ma powiadomień push ani załączników: serverless nie
  utrzymuje stałego połączenia IMAP (model = polling przy otwarciu zakładki +
  cron 06:00), a zapisywanie załączników to osobna decyzja RODO (retencja
  plików), świadomie odłożona. Pobieramy tylko INBOX i tylko treść. Panel nie
  kasuje niczego na serwerze az.pl.
- Brak integracji KSeF (Krajowy System e-Faktur) — świadomie odłożone,
  osobny i większy zakres (wymaga certyfikatów/uwierzytelniania API
  Ministerstwa Finansów). Podobnie brak linków do płatności online
  (Stripe/Przelewy24) — nie było w zatwierdzonym zakresie.
