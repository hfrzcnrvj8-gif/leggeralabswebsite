# Moduł 27 — Gęstość ekranu + liquid glass w przełącznikach (kontynuacja audytu wizualnego)

> Przeczytaj `docs/plany-modulow/README.md`, `CLAUDE.md` (sekcja „Design
> system") i `HUB_SETUP.md` → „Audyt wizualny" (Moduł 21). Stan zbadany
> 2026-07-16 — nie badaj od nowa. **Rób przez zrzut ekranu → poprawka →
> zrzut, nie z samego kodu.**

## Skąd to się wzięło

Właściciel (2026-07-16), po Module 21, na podstawie zrzutów z centrum
powiadomień macOS: *„liquid glass, tam gdzie zmienia się POKAŻ MNIEJ i WYMAŻ i
te animacje które towarzyszą zmianie tych opcji, to jest właśnie coś co też
chcę mieć u siebie"* oraz *„ciągle w wielu miejscach nie ma pełnego
wykorzystania ekranu tylko jest sporo wolnych przestrzeni"*.

## Część A — puste przestrzenie (konkrety, zmierzone)

Kontener globalny: `AppShell.tsx:414` — `max-w-[1800px]` (poza `/mail`, które
ma `max-w-none`). Czyli na szerokim monitorze jest ~1800 px, a te widoki tego
nie wykorzystują:

| Plik:linia | Klasa | Problem |
|---|---|---|
| `invoices/InvoicesDashboard.tsx:264` | `grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-3` | KPI kończą się na 672 px — zostaje ~1100 px pustki |
| `offers/OffersDashboard.tsx:196` | `grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-3` | identycznie |
| `costs/CostsDashboard.tsx:273` | `grid grid-cols-2 gap-3 sm:max-w-md lg:w-72 lg:shrink-0` | **najostrzejsze** — sztywne 288 px, `shrink-0` blokuje wzrost |
| `stats/StatsDashboard.tsx:83, :102` | `grid-cols-2 ... lg:grid-cols-3` | kończy się na 3 kolumnach |
| `stats/StatsDashboard.tsx:160` | `grid gap-4 ... lg:grid-cols-2` | wykresy zostają 2-kolumnowe |
| `DashboardHome.tsx:270, :367` | `grid gap-4 lg:grid-cols-2` | — |

**Wzorzec do naśladowania:** `DashboardHome.tsx:305` — `grid-cols-2 ...
lg:grid-cols-6`, jedyna siatka skalująca się sensownie.

**Zostaw w spokoju:** `contracts/ContractsDashboard.tsx:162` (`max-w-2xl` na
akapicie opisu — celowe, długa linia tekstu jest nieczytelna) oraz `max-w-*`
na kartach modali (`Modal.tsx`, Moduł 21 — świadoma decyzja).

**Uwaga:** samo usunięcie `max-w` to nie koniec — trzy karty KPI rozciągnięte
na 1800 px wyglądają gorzej niż zbite. Trzeba dołożyć kolumny
(`xl:grid-cols-6`) albo zagospodarować odzyskane miejsce. **Zrzut przed/po
obowiązkowy.**

## Część B — liquid glass w przełącznikach + animacje

Wzorzec z macOS: przycisk „Pokaż mniej"/„Wymaż" na szkle, z płynną zmianą
stanu i morfowaniem etykiety, nie skokową podmianą.

Co już mamy po Module 21 (reużywaj, nie wymyślaj od nowa):
- `.glass` (`globals.css`) — `blur(16px) saturate(200%)`, komentarz w kodzie
  tłumaczy, czemu te wartości. Dziś używana w menu (`Menu.tsx`) i chrome.
- `.bg-brand-accent` + `.pill-active` — gradient marki jako akcent i jeden
  stan „wybrane" w całym panelu.
- `ViewTabs.tsx` — podkreślenie przejeżdżające przez `layoutId`.
- Spring `{ type: "spring", stiffness: 420, damping: 32 }` — kanon
  (`Modal.tsx`, `ui.tsx`).

Kandydaci na „szklany przełącznik z animacją":
- segmentowane kontrolki osi czasu (`ProjectTimeline.tsx:383-405` —
  grupowanie/zoom); dziś mają `.pill-active`, ale sam segment nie animuje
  przejścia między opcjami (kandydat na `layoutId` jak w `ViewTabs`)
- pigułki filtrów Poczty (`MailDashboard.tsx`) i tagów Notatnika
- pasek akcji zaznaczenia (`MailDashboard.tsx:756` — `card-paper sticky`),
  pojawia się/znika bez animacji
- przyciski „Pokaż więcej/mniej" — sprawdź, czy w panelu w ogóle istnieją;
  jeśli nie, to kandydat na nowy wzorzec (np. zwijanie długich list)

**Ostrożnie z `.glass`:** CLAUDE.md mówi wprost, że jest zarezerwowana dla
chrome i NIE wolno jej nadużywać na zwykłych kartach. W Module 21 właściciel
potwierdził, że karty modali zostają `.card-paper`. Przełącznik/pasek akcji
= chrome, więc szkło jest OK — ale zweryfikuj wzrokowo, czy nie robi się z
tego mgła.

## Czego NIE robić bez pytania

- Nie zmieniaj palety/`tailwind.config.ts`.
- Nie zamieniaj emoji na ikony (znana, świadomie zostawiona niespójność —
  patrz `HUB_SETUP.md` → „Audyt wizualny").
- Nie przebudowuj struktury nagłówków/pasków narzędzi — właściciel świadomie
  odłożył to w Module 21 (trzy różne języki paska zostają).

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json`.
2. Zrzuty przed/po dla KAŻDEJ zmiany gęstości — właściciel ocenia wizualnie.
3. Sprawdź na szerokim oknie (~1800 px) ORAZ na wąskim — celem jest
   wykorzystanie miejsca, nie rozjechanie się na małym ekranie.
4. Zaktualizuj `HUB_SETUP.md` i odhacz w `README.md`.
