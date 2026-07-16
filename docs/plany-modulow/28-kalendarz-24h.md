# Moduł 28 — Kalendarz: pełna doba w widoku tygodnia i dnia

> Przeczytaj `docs/plany-modulow/README.md` i `CLAUDE.md`. Stan zbadany
> 2026-07-16 (kod + potwierdzenie wzrokowe w przeglądarce) — nie badaj od nowa.

## Skąd to się wzięło

Właściciel (2026-07-16): *„w kalendarzu w widoku tygodniowym i dziennym nie ma
24 godzinnej podziałki, brakuje jakby godzin w nocy"*.

Potwierdzone wizualnie (`preview_start name:"dev"`, widok tygodnia): siatka
zaczyna się od **07:00**.

## Stan faktyczny

- `app/[lang]/admin/calendar/CalendarView.tsx:58` — `const HOUR_PX = 48;`
- `CalendarView.tsx:59` — `const DEFAULT_RANGE = { startHour: 7, endHour: 21 };`
- `CalendarView.tsx:120-132` — `timelineRange(events)` startuje od 7–21 i
  **rozszerza zakres tylko wtedy, gdy jakieś wydarzenie wystaje** poza niego
  (`Math.min`/`Math.max` po `startMin`/`endMin`).

Konsekwencje:
1. Pusty dzień/tydzień rysuje wyłącznie 7:00–21:00. Godzin 0:00–6:59 i
   21:00–24:00 **nie da się kliknąć ani przeciągnąć**, dopóki nie ma tam już
   wydarzenia (a nie ma jak go tam dodać — błędne koło).
2. W widoku tygodnia zakres liczy się ze **wszystkich 7 dni naraz**
   (`:1265-1266`), więc **jedno** wydarzenie o 23:00 rozciąga siatkę całego
   tygodnia — niespójna wysokość z dnia na dzień.
3. Linia „teraz" (`showNowLine`, `:1408`) znika przed 7:00 i po 21:00.

## PUŁAPKA — to nie jest zmiana jednej stałej

**W `WeekTimeline` każda kolumna dnia ma WŁASNY, niezależny kontener
przewijania:** `CalendarView.tsx:1325` (`flex-1 overflow-y-auto` wewnątrz
`days.map`), a etykiety godzin mają jeszcze jeden osobny (`:1285`). To osiem
niezsynchronizowanych scrolli.

Dziś to się nie ujawnia, bo `(21-7) * 48 = 672 px` zwykle mieści się bez
przewijania. **Po przejściu na 24h `(24-0) * 48 = 1152 px` zacznie się
przewijać — i wtedy przewinięcie jednej kolumny rozjedzie ją z etykietami
godzin i z pozostałymi dniami.**

Zakres tego modułu MUSI więc objąć:
1. `DEFAULT_RANGE` → pełna doba (0–24) i uproszczenie/usunięcie
   `timelineRange()` (przestaje mieć sens, skoro zakres jest stały).
2. **Jeden wspólny kontener przewijania** w `WeekTimeline` obejmujący
   etykiety godzin ORAZ wszystkie kolumny dni — zamiast ośmiu osobnych.
3. **Auto-scroll przy wejściu** do sensownej godziny (propozycja: bieżąca
   godzina, a poza godzinami pracy ~7:00). Bez tego otwarcie kalendarza
   pokaże 00:00–05:00 i będzie to **regres** względem dzisiaj.
4. Sprawdzić `DayTimeline` (`:1171`, `HourLabels` `:1212`) — ten sam problem
   w mniejszej skali.
5. Zweryfikować, że linia „teraz" i drag→czas (`timeFromClientY`, `:1410-1415`,
   zaokrąglanie do 15 min) działają w nowym zakresie.

## Do rozstrzygnięcia z właścicielem

- **Czy `HOUR_PX = 48` zostaje?** 24 × 48 = 1152 px to dużo przewijania.
  Alternatywa: mniejsza wysokość godziny (np. 32 px → 768 px) albo zwijanie
  godzin nocnych z możliwością rozwinięcia. Apple Calendar/Google Calendar
  pokazują pełną dobę z przewijaniem i auto-scrollem — to bezpieczny wzorzec.

## Czego NIE robić

- Nie ruszaj palety/emoji/układu (Moduł 21).
- Nie przebudowuj modelu danych `events` — kolumny (`godzina`,
  `czas_trwania_min`, `data_koniec`, powiązania) są wystarczające.

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json`.
2. **Obowiązkowo w przeglądarce** (`preview_start name:"dev"`), bo to zmiana
   czysto wizualno-interakcyjna:
   - widok tygodnia: przewinięcie pokazuje 00:00 i 23:00, etykiety godzin
     trzymają się siatki we WSZYSTKICH kolumnach,
   - kliknięcie w slot o 2:00 tworzy wydarzenie o 2:00,
   - wejście w kalendarz nie ląduje na 00:00.
3. Zrzuty przed/po. Zaktualizuj `HUB_SETUP.md` i odhacz w `README.md`.
