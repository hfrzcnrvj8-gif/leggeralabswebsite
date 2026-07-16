# Moduł 25 — Menu kontekstowe (prawy przycisk) i rozwijane w całym panelu

> Przeczytaj `docs/plany-modulow/README.md` i `CLAUDE.md`. Stan zbadany
> 2026-07-16 — nie badaj od nowa.

## Skąd to się wzięło

Właściciel (2026-07-16): *„mamy też bardzo mało rozsuwanych menu albo
możliwości kliknięcia prawą myszą żeby coś wywołać. Chciałbym żebyś sprawdził
gdzie takie implementacje mogłyby być pomocne u nas."*

## Stan faktyczny

**`onContextMenu` nie występuje w kodzie ANI RAZU.** Grep po
`onContextMenu|contextmenu` w `app/`, `components/`, `lib/` → zero trafień.
Prawy przycisk daje dziś natywne menu przeglądarki. Zielone pole, brak kolizji.

**`Menu.tsx` (315 linii) eksportuje:** `Popover` (:37), `PropertyMenu` (:172),
`MenuRow` (:139), `MenuLabel` (:164), `MenuDivider` (:168), typ `MenuOption`
(:25). Oba menu renderują przez `createPortal` do `<body>`, `z-[200]`, klasa
`admin-linear glass`, zamykanie mousedown/Esc, `PropertyMenu` ma nawigację
klawiaturą (:227-245).

## Kluczowa przeszkoda techniczna

**`Popover` NIE da się dziś otworzyć w pozycji kursora:**
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

## Kandydaci — gdzie prawy przycisk realnie pomoże

Miejsca, gdzie dziś trzeba trafić w mały przycisk:

| Miejsce | Linia | Ukryte za małym celem |
|---|---|---|
| `invoices/InvoicesDashboard.tsx` | :424-452 | **najlepszy zwrot** — trzy ikony 15 px obok siebie: podgląd, usuń szkic, anuluj |
| `leads/KanbanBoard.tsx` | :128-137 | „✕" — krzyżyk ~11 px w rogu karty |
| `leads/KanbanBoard.tsx` | :151-155 | `StatusTag` w `<span onClick={stopPropagation}>` |
| `leads/TableView.tsx` | :210, :220-221 | status + usuń |
| `mail/MailDashboard.tsx` | :1139-1155 | grupa 4 przycisków akcji wiersza |
| `costs/CostsDashboard.tsx` | :339 | usuń (ikona) |
| `clients/*`, `projects/ProjectKanban.tsx` | — | ten sam wzorzec |

**Uwaga implementacyjna:** karty Kanban mają `onClick` na całej karcie
(`leads/KanbanBoard.tsx:101`) i `stopPropagation` na przyciskach wewnątrz.
`onContextMenu` nie wejdzie w konflikt z lewym klikiem, ale **musi robić
`preventDefault()`**, inaczej wyskoczy natywne menu przeglądarki.

## Zakres

1. Rozszerzyć `Popover` o tryb kotwiczony w punkcie + kontrolowany stan.
2. Wspólny hook/komponent menu kontekstowego oparty o powyższe.
3. Wdrożyć na 2-3 najlepszych kandydatach (faktury, karty Kanban, wiersze
   Poczty) — **jako skrót, nie jedyną drogę**: istniejące przyciski zostają
   (odkrywalność), prawy przycisk je dubluje.
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
4. Zaktualizuj `HUB_SETUP.md` i odhacz w `README.md`.
