# Moduł 25 — Menu kontekstowe (prawy przycisk) i rozwijane w całym panelu

> Przeczytaj `docs/plany-modulow/README.md` i `CLAUDE.md`. Stan zbadany
> 2026-07-16, **zweryfikowany ponownie 2026-07-17** (po Modułach 22–24 i 26).
> Numery linii sprawdzone tego dnia — ale i tak potwierdź je gretem, zanim
> na nich oprzesz zmianę.

## Skąd to się wzięło

Właściciel (2026-07-16): *„mamy też bardzo mało rozsuwanych menu albo
możliwości kliknięcia prawą myszą żeby coś wywołać. Chciałbym żebyś sprawdził
gdzie takie implementacje mogłyby być pomocne u nas."*

## Stan faktyczny (potwierdzony 2026-07-17)

**`onContextMenu` nie występuje w kodzie ANI RAZU.** Grep po
`onContextMenu|contextmenu` w `app/`, `components/`, `lib/` → zero trafień.
Prawy przycisk daje dziś natywne menu przeglądarki. Zielone pole, brak kolizji.

**`Menu.tsx` (315 linii) eksportuje** (numery linii bez zmian od 16.07):
`Popover` (:37), `PropertyMenu` (:172), `MenuRow` (:139), `MenuLabel` (:164),
`MenuDivider` (:168), typ `MenuOption` (:25). Oba menu renderują przez
`createPortal` do `<body>`, `z-[200]`, klasa `admin-linear glass`, zamykanie
mousedown/Esc, `PropertyMenu` ma nawigację klawiaturą (:227-245).

## Kluczowa przeszkoda techniczna

**`Popover` NIE da się dziś otworzyć w pozycji kursora** (sprawdzone
2026-07-17, sygnatura bez zmian — brak propsów `open`/`anchor`):

- `place()` (:58-69) liczy pozycję **wyłącznie** z prostokąta triggera:
  `triggerWrapRef.current?.firstElementChild.getBoundingClientRect()`. Brak
  wejścia na współrzędne.
- `openMenu(e?)` (:71-75) ignoruje `e.clientX/clientY` — używa `e` tylko do
  `stopPropagation()`.
- Stan `open` jest **wewnętrzny** (`useState`, :53) — brak propsa
  `open`/`onOpenChange`, więc nie otworzysz go z `onContextMenu` na wierszu.
- `useEffect` (:86-90) przy scrollu wywołuje `place()` — menu i tak wróci do
  triggera.

**Rekomendacja: rozszerzyć `Popover`, nie tworzyć drugiego pliku.** Dodaj
opcjonalny `anchor?: { x: number; y: number }` (gdy podany, `place()` liczy z
punktu) + kontrolowany `open`/`onClose`. Do ponownego użycia jest tam
wszystko, co trudne: clamp do krawędzi ekranu (:63), ucieczka w górę przy
dolnej krawędzi (:64-67), animacje. **Kopiowanie tego do nowego
`ContextMenu.tsx` = powtórzenie tych samych bugów** — plik ma komentarze
opisujące dwie pułapki, które już raz kosztowały czas: `AnimatePresence` musi
być WEWNĄTRZ `createPortal` (:105-110), a portal potrzebuje klasy
`admin-linear`, inaczej tokeny kolorów spadają do jasnej palety strony
publicznej (:121-124).

> **⚠️ NOWE 2026-07-17 — `Popover` ma dziś ~20 konsumentów**, w tym świeży
> `NotificationBell.tsx` (Moduł 24), `DatePicker`, `LinkPicker`,
> `CalendarView`, `RecipientPicker` i większość dashboardów. Rozszerzenie MUSI
> być **wstecznie zgodne**: nowe propsy opcjonalne, dotychczasowe zachowanie
> (trigger + wewnętrzny stan) niezmienione, gdy `anchor`/`open` nie podano.
> Zmiana sygnatury na wymagającą = 20 plików do poprawienia i realne ryzyko, że
> coś się cicho zepsuje. `npx tsc --noEmit` złapie tylko część tego.

## NOWE 2026-07-17: Poczta ma własne, ręcznie zrobione menu

`mail/MailDashboard.tsx` (~:1133-1160) trzyma **dwunasty wzorzec menu** — nie
używa `Menu.tsx` w ogóle:

- stan per-wiersz: `const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null)`,
- panel: `<div className="glass absolute right-4 top-11 z-20 w-40 rounded-xl p-1">`
  — **`absolute`, nie portal**, więc może być przycięty przez kontener z
  `overflow`, i ma własny `z-20` zamiast `z-[200]`,
- zamykanie: osobny `<div className="fixed inset-0 z-10" onClick={...} />` na
  końcu komponentu — reimplementacja click-outside, którą `Popover` ma
  wbudowaną,
- brak animacji, brak Esc, brak klawiatury.

To jest **dokładnie ten sam kształt problemu, co „10 kopii modala → 1" w
Module 21** — i mocny argument, żeby zrobić Pocztę jednym z pierwszych
wdrożeń: prawy przycisk na wierszu może zastąpić to menu, a nie tylko je
zdublować. To jedyne takie obejście w panelu (sprawdzone gretem po
`MenuFor|openMenuId|showMenu` i `glass absolute`) — reszta idzie przez
`Menu.tsx`.

## Kandydaci — gdzie prawy przycisk realnie pomoże

Miejsca, gdzie dziś trzeba trafić w mały cel (linie odświeżone 2026-07-17):

| Miejsce | Linia | Ukryte za małym celem |
|---|---|---|
| `invoices/InvoicesDashboard.tsx` | :436-452 | **najlepszy zwrot** — ikony 15 px obok siebie: podgląd (`IconExternalLink`), „Usuń szkic" (`IconX`), „Anuluj fakturę" (`IconBan`) |
| `mail/MailDashboard.tsx` | :1119-1160 | tag statusu jako przycisk + własny dropdown (patrz sekcja wyżej) |
| `leads/KanbanBoard.tsx` | :129-137 | „✕" — krzyżyk ~11 px w rogu karty |
| `leads/KanbanBoard.tsx` | :153-154 | `StatusTag` w `<span onClick={stopPropagation}>` |
| `leads/TableView.tsx` | :210, :220-221 | status + usuń |
| `costs/CostsDashboard.tsx` | :339 | „Usuń" (ikona) |
| `clients/*`, `projects/ProjectKanban.tsx` | — | ten sam wzorzec |

**Uwaga implementacyjna:** karty Kanban mają `onClick` na całej karcie
(`leads/KanbanBoard.tsx:101`) i `stopPropagation` na przyciskach wewnątrz.
`onContextMenu` nie wejdzie w konflikt z lewym klikiem, ale **musi robić
`preventDefault()`**, inaczej wyskoczy natywne menu przeglądarki.

## Otwarte decyzje — ZAPYTAJ właściciela, zanim zbudujesz

1. **Czy menu ma tylko dublować istniejące przyciski, czy dokładać akcje,
   których dziś NIE ma?** Prawy przycisk, który powtarza to, co i tak widać, ma
   niską wartość. Prawdziwa dźwignia to rzeczy bez przycisku dzisiaj: „kopiuj
   e-mail", „kopiuj NIP", „kopiuj numer konta", „otwórz w nowej karcie",
   „powiel jako szkic". To rozszerza zakres — niech właściciel zdecyduje.
2. **Na których modułach wdrożyć w tej rundzie?** Rekomendacja: Faktury
   (najwięcej ikon), Poczta (przy okazji kasuje ręczne menu), Leady/Kanban.
   Reszta przyrostowo.
3. **Czy przy okazji ujednolicić menu statusu w Poczcie** (usunąć ręczny
   dropdown na rzecz `Menu.tsx`), czy zostawić to na osobną rundę?

## Zakres

1. Rozszerzyć `Popover` o tryb kotwiczony w punkcie + kontrolowany stan
   (**wstecznie zgodnie** — patrz ostrzeżenie o 20 konsumentach).
2. Wspólny hook/komponent menu kontekstowego oparty o powyższe.
3. Wdrożyć na 2-3 najlepszych kandydatach — **jako skrót, nie jedyną drogę**:
   istniejące przyciski zostają (odkrywalność), prawy przycisk je dubluje.
4. Zadbać o klawiaturę i dotyk — na mobile prawego przycisku nie ma
   (long-press to osobny temat, Moduł 5).

## Czego NIE robić

- Nie usuwaj istniejących przycisków akcji — menu kontekstowe to dodatek dla
  wprawnego użytkownika, nie zamiennik widocznej afordancji.
- Nie duplikuj `Menu.tsx` (patrz wyżej).
- Nie ruszaj palety/emoji/układu (Moduł 21).

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json`.
2. Sprawdzone na WIĘCEJ NIŻ jednym module (to ma być dźwignia).
3. Potwierdź w przeglądarce, że natywne menu przeglądarki się nie pokazuje i
   że menu nie ucieka poza ekran przy dolnej/prawej krawędzi.
4. **Regresja:** otwórz kilka istniejących `Popover`-ów (dzwonek w sidebarze,
   `DatePicker`, filtry na liście leadów) i potwierdź, że działają jak przed
   zmianą.
5. Zaktualizuj `HUB_SETUP.md` i odhacz w `README.md`.

## ⚠️ Pułapka narzędzia, która trafi CIĘ szczególnie mocno

Podgląd przeglądarki w tym środowisku ma `visibilityState === "hidden"` i
**nigdy nie odpala `requestAnimationFrame`** — animacje framer-motion nie
postępują. Ten moduł dotyka **wyłącznie animowanych menu**, więc uderzysz w to
od pierwszego kliknięcia.

Jak to wygląda (zmierzone przy Module 24 na `Popover`): otwarte menu stoi na
`opacity: 0.85` i `scale: 0.994` zamiast dojść do 1 — jest **prześwitujące**,
widać przez nie treść pod spodem. Wygląda jak zepsute tło albo zły `z-index`.
**To artefakt narzędzia, nie błąd.** W prawdziwej przeglądarce menu jest
nieprzezroczyste.

Co robić:
- Zrzut ekranu **wymusza klatkę** — żeby animacja postąpiła, klikaj i rób
  `screenshot`, nie `wait`. Kilka zrzutów pod rząd domyka animację.
- Sprawdzaj `getComputedStyle(el).opacity` przez `javascript_tool`, zanim
  uznasz cokolwiek za błąd wizualny.
- **Nie „naprawiaj" `Popover`/`AnimatePresence`** pod ten objaw.

Szczegóły: `HUB_SETUP.md` → „Moduł 23", ostatnia sekcja.

## Kontekst z Modułu 24 (przydatny tutaj)

`NotificationBell.tsx` to najświeższy przykład użycia `Popover` z nietypowym
kształtem treści (lista przewijalna, nagłówek z akcją, `width={340}`,
`triggerClassName="flex"`). Jeśli szukasz wzorca „jak zbudować bogatszy panel w
`Popover`, a nie samą listę opcji" — zacznij od tego pliku.
