# Panel /admin — pulpit, projekty, notatnik, kalendarz

Rozszerzenie rejestru leadów (`LEADS_SETUP.md`) o pełny "command center" w
stylu Linear — jedno miejsce spinające wszystko, o czym warto pamiętać.
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
  - **Oś czasu** — widok Gantt-lite: paski projektów od daty startu do
    terminu na siatce miesięcy, romby kamieni milowych na osi, pionowa
    linia „dziś”. Kolor paska odzwierciedla zdrowie projektu (zielony/
    pomarańczowy/czerwony).
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
