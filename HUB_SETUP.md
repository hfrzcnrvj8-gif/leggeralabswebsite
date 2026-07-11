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
  projekty z minionym terminem, dzisiejsze wydarzenia z kalendarza,
  ostatnie notatki. Punkt startowy każdego dnia pracy. Interaktywny — bez
  przechodzenia do modułu można leada oznaczyć jako obsłużony, projekt jako
  wdrożone, albo usunąć dzisiejsze wydarzenie prosto z listy.
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
