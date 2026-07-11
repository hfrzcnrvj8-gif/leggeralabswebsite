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
  „Wystaw fakturę” (kolejny w roku), podgląd/wydruk pod
  `/admin/invoices/:id/print`. `lib/invoices.ts` / `app/api/invoices/*`.
  Wydruk (`InvoicePrint.tsx`) ma premium, stonowany styl (czerń/biel/
  szarości + jeden delikatny akcent `brand.purple`, wzorowany na fakturach
  Apple/Anthropic) i jest **trójjęzyczny (PL/EN/DE)** — język wybiera się
  per faktura w edytorze (pole `invoice.jezyk`, property "Dokument" w
  bocznym pasku), niezależnie od języka aktualnie przeglądanego panelu,
  bo klient bywa zagraniczny. Kwoty/daty formatowane wg locale danego
  języka; domyślna jednostka nowej pozycji też dopasowana do języka
  (szt./pcs./Stk.). „Słownie” (kwota słowna) pokazuje się tylko w PL — to
  polska konwencja, nie tłumaczona. Adres nabywcy to pola strukturalne
  (ulica / kod pocztowy + miasto / kraj) zamiast jednego zlepionego pola —
  `klient_adres` zostaje w bazie tylko jako fallback dla starych faktur
  (`clientAddressLines()` w `lib/invoices.ts`). Termin płatności ma szybkie
  przyciski 7/14/30 dni obok koła dat (liczone od daty wystawienia, a gdy
  ta jest pusta — od dziś). Endpointy `PATCH`/`issue` łapią wyjątki i
  zwracają realny komunikat błędu Postgresa w toaście zamiast generycznego
  „nie udało się” — ważne przy diagnozowaniu bez dostępu do logów produkcji.

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
