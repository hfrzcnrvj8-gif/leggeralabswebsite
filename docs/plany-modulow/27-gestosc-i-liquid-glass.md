# Moduł 27 — Gęstość ekranu + liquid glass w przełącznikach (kontynuacja audytu wizualnego)

> Przeczytaj `docs/plany-modulow/README.md`, `CLAUDE.md` (sekcja „Design
> system") i `HUB_SETUP.md` → „Audyt wizualny" (Moduł 21). Stan zbadany
> 2026-07-16, **zweryfikowany ponownie i skorygowany 2026-07-17** (po Modułach
> 22–26). Numery linii sprawdzone tego dnia — ale i tak potwierdź je gretem,
> zanim na nich oprzesz zmianę. **Rób przez zrzut ekranu → poprawka → zrzut,
> nie z samego kodu.**

## Skąd to się wzięło

Właściciel (2026-07-16), po Module 21, na podstawie zrzutów z centrum
powiadomień macOS: *„liquid glass, tam gdzie zmienia się POKAŻ MNIEJ i WYMAŻ i
te animacje które towarzyszą zmianie tych opcji, to jest właśnie coś co też
chcę mieć u siebie"* oraz *„ciągle w wielu miejscach nie ma pełnego
wykorzystania ekranu tylko jest sporo wolnych przestrzeni"*.

## Otwarte decyzje — ZAPYTAJ właściciela, zanim zbudujesz

Poprzednia wersja briefu ich nie miała, a obie realnie zmieniają zakres:

1. **Czym wypełnić odzyskane miejsce w Fakturach/Ofertach?** Samo zdjęcie
   `max-w` rozciągnie trzy karty KPI na 1576 px i będzie wyglądać GORZEJ niż
   dziś (patrz „Uwaga" niżej). Opcje: (a) dołożyć kolumny KPI —
   `xl:grid-cols-6`, jak Pulpit; (b) wstawić obok KPI wykres/trend, jak mają
   Koszty; (c) zwęzić KPI i podnieść tabelę wyżej. To decyzja produktowa, nie
   techniczna — niech właściciel wybierze.
2. **Jak daleko z liquid glass?** Czy przełączniki mają dostać samo
   przejeżdżające podświetlenie (tanie, spójne z `ViewTabs`), czy pełne szkło
   `.glass` na kontenerze segmentowym (bliżej macOS, ale ryzyko „mgły" —
   CLAUDE.md rezerwuje `.glass` dla chrome).

## Część A — puste przestrzenie

### Realna szerokość treści to 1576 px, nie 1800

Kontener globalny: **`AppShell.tsx:417`** (było `:414`) — `max-w-[1800px]`,
poza `/mail`, które ma `max-w-none`. **Ale zmierzone na oknie 1800 px: treść
ma 1576 px** (sidebar ~200 px + padding). Poprzednia wersja briefu liczyła
pustkę od 1800 i zawyżała ją o ~200 px. Licz od 1576.

### Zmierzone (okno 1800 px, 2026-07-17)

| Plik:linia | Klasa | Zmierzone |
|---|---|---|
| `invoices/InvoicesDashboard.tsx:275` (było `:264`) | `grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-3` | KPI **672 px**, obok **904 px martwej przestrzeni** — najbardziej rażące wizualnie, trzy karty stłoczone w lewych 40% ekranu |
| `offers/OffersDashboard.tsx:196` (bez zmian) | identyczna klasa | identycznie |
| `costs/CostsDashboard.tsx:284` (było `:273`) | `grid grid-cols-2 gap-3 sm:max-w-md lg:w-72 lg:shrink-0` | KPI **288 px**, `shrink-0` potwierdzony — **ale patrz korekta niżej** |
| `stats/StatsDashboard.tsx:83, :102` (bez zmian) | `grid-cols-2 ... lg:grid-cols-3` | kończy się na 3 kolumnach |
| `stats/StatsDashboard.tsx:160` (bez zmian) | `grid gap-4 ... lg:grid-cols-2` | wykresy zostają 2-kolumnowe |
| `DashboardHome.tsx:270, :367` (bez zmian) | `grid gap-4 lg:grid-cols-2` | — |

### ⚠️ KOREKTA 2026-07-17: Koszty NIE są „najostrzejsze"

Poprzedni brief nazywał Koszty najgorszym przypadkiem („sztywne 288 px,
`shrink-0` blokuje wzrost"). **Zmierzone: to nie jest pustka na poziomie
rzędu.** Karty KPI faktycznie stoją na 288 px, ale sąsiednia karta „Trend
wydatków" jest `flex-1` i zabiera całą resztę (~1270 px) — rząd jest pełny.

Pustka w Kosztach jest **wewnątrz** karty trendu: wykres słupkowy jest wąski,
a legenda (`grid min-w-0 flex-1 ... sm:grid-cols-3`, zmierzone **953 px**)
rozciąga jeden wpis „Inne — 295,20 zł" przez cały ekran. To inny problem niż
w Fakturach i inna naprawa. **Najostrzejsze są Faktury/Oferty** (904 px
realnie pustego pasa) — tam zacznij.

### Zostaw w spokoju

`contracts/ContractsDashboard.tsx:162` (`max-w-2xl` na akapicie opisu —
celowe, długa linia tekstu jest nieczytelna) oraz `max-w-*` na kartach modali
(`Modal.tsx`, Moduł 21 — świadoma decyzja). Profil leada/klienta ma świadomie
BEZ `max-w` (Moduł 23) — to już zrobione, nie ruszaj.

### Uwaga implementacyjna

**Samo usunięcie `max-w` to nie koniec** — trzy karty KPI rozciągnięte na
1576 px wyglądają gorzej niż zbite. Trzeba dołożyć kolumny albo zagospodarować
miejsce (patrz Otwarta decyzja 1). **Wzorzec do naśladowania:**
`DashboardHome.tsx:305` — `grid-cols-2 ... lg:grid-cols-6`, jedyna siatka w
panelu skalująca się sensownie.

**Zrzut przed/po obowiązkowy.** Dev-seed nie ma faktur ani kosztów — żeby w
ogóle zobaczyć te widoki z treścią, wstaw rekordy przez API i usuń po
zrzutach (dev-baza to PGlite, izolowana):

```
curl -s -X POST http://localhost:3000/api/costs -H "Content-Type: application/json" \
  -d '{"dostawca_nazwa":"Adobe","kategoria":"Oprogramowanie","kwota_netto":200,"vat_stawka":"23","data_wydatku":"2026-07-12","status":"Opłacony"}'
curl -s http://localhost:3000/api/costs   # → id do DELETE
```

(POST `/api/costs` ignoruje `dostawca_nip` — nie zdziw się pustym NIP-em.)

## Część B — liquid glass w przełącznikach + animacje

Wzorzec z macOS: przycisk „Pokaż mniej"/„Wymaż" na szkle, z płynną zmianą
stanu, nie skokową podmianą.

### Co już mamy (reużywaj, NIE wymyślaj od nowa)

- **`ViewTabs.tsx` — to jest gotowa odpowiedź na „jak animować przełącznik".**
  Podkreślenie przejeżdża przez `layoutId` + kanoniczny spring
  `{ type: "spring", stiffness: 420, damping: 32 }`. Cała Część B to w
  praktyce „rozciągnij ten wzorzec na pozostałe przełączniki".
- `.glass` (`globals.css`) — `blur(16px) saturate(200%)`, komentarz w kodzie
  tłumaczy wartości. Dziś w menu (`Menu.tsx`) i chrome.
- `.bg-brand-accent` + `.pill-active` — gradient marki i jeden stan „wybrane".
- `Popover` (`Menu.tsx`) — od Modułu 25 ma tryb `anchor` + stan kontrolowany.

### Kandydaci — zweryfikowane 2026-07-17

| Miejsce | Stan |
|---|---|
| **`FilterPills.tsx`** (cały plik, 47 linii) | **najlepszy zwrot** — wspólny komponent, jedna zmiana ulepsza Pocztę I Notatnik naraz. Ma TYLKO `transition-colors`, zero framer-motion → aktywna pigułka **przeskakuje**. Kandydat na `layoutId` jak w `ViewTabs`. Użycia: `mail/MailDashboard.tsx:760`, `notes/NotesDashboard.tsx:171` i `:176` |
| `projects/ProjectTimeline.tsx:383-395` (grupowanie) i `:397-408` (zoom) | **dwa** ręcznie sklecone przełączniki segmentowe (`rounded-md` w kontenerze z `border hairline`), oba `.pill-active`, żaden nie animuje. Inny kształt niż `FilterPills` (segment vs wolna pigułka) — nie sklejaj ich na siłę w jeden komponent bez pytania |
| `mail/MailDashboard.tsx:772` (było `:756`) | pasek akcji zaznaczenia (`card-paper sticky ... rounded-full`) — pojawia się/znika bez animacji, kandydat na `AnimatePresence` |
| „Pokaż więcej/mniej" | **sprawdzone: praktycznie nie istnieje.** Jedyne wystąpienie to `FieldChangesTab.tsx:72` („Zwiń"/„Pokaż całość") + zwijanie sidebara (`AppShell.tsx:306`). Jeśli właściciel chce wzorca z macOS, to **nowy** wzorzec, nie ujednolicenie istniejącego |

### 🚨 Pułapka, która ugryzie Cię od pierwszej linii (Moduł 23 już to przerabiał)

`FilterPills` **nie może dostać stałego `layoutId`**. `NotesDashboard.tsx`
renderuje **dwa zestawy jednocześnie** (:171 zakładki, :176 tagi — komentarz w
kodzie mówi wprost „Dwa rzędy pigułek, nie jeden"). Przy wspólnym `layoutId`
framer uzna oba podświetlenia za ten sam element i **podświetlenie przeleci z
rzędu zakładek do rzędu tagów**.

Dokładnie ten błąd `ViewTabs` złapał w Module 23 — dlatego ma dziś prop
`layoutId` z wartością domyślną. Zrób w `FilterPills` tak samo **od razu**:
prop `layoutId`, a każde z trzech użyć podaje własny. Komentarz w
`ViewTabs.tsx:16-22` opisuje ten przypadek — przeczytaj przed zmianą.

### Ostrożnie z `.glass`

CLAUDE.md mówi wprost, że jest zarezerwowana dla chrome i NIE wolno jej
nadużywać na zwykłych kartach. W Module 21 właściciel potwierdził, że karty
modali zostają `.card-paper`. Przełącznik/pasek akcji = chrome, więc szkło
jest OK — ale zweryfikuj wzrokowo, czy nie robi się z tego mgła.

## Czego NIE robić bez pytania

- Nie zmieniaj palety/`tailwind.config.ts`.
- Nie zamieniaj emoji na ikony (znana, świadomie zostawiona niespójność —
  patrz `HUB_SETUP.md` → „Audyt wizualny").
- Nie przebudowuj struktury nagłówków/pasków narzędzi — właściciel świadomie
  odłożył to w Module 21 (trzy różne języki paska zostają).
- Nie sklejaj `FilterPills` z segmentami Osi czasu w jeden komponent bez
  pytania — to dwa różne kształty, nie duplikat.

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json` (pełny `next build` failuje w sandboxie).
2. Zrzuty przed/po dla KAŻDEJ zmiany gęstości — właściciel ocenia wizualnie.
3. Sprawdź na szerokim oknie (`resize_window` 1800×950) ORAZ na wąskim —
   celem jest wykorzystanie miejsca, nie rozjechanie się na małym ekranie.
4. **Regresja pigułek:** po zmianie `FilterPills` otwórz Notatnik i przełącz
   zakładkę ORAZ tag — podświetlenie nie może przeskakiwać między rzędami.
5. Zaktualizuj `HUB_SETUP.md` i odhacz w `README.md`.

## ⚠️ Pułapka narzędzia (dotyczy Części B — całej)

Podgląd przeglądarki ma `visibilityState === "hidden"` i **nigdy nie odpala
`requestAnimationFrame`** — animacje framer-motion nie postępują. Część B to
wyłącznie animacje, więc uderzysz w to od pierwszego kliknięcia: element stoi
na `opacity` ~0.8 zamiast dojść do 1 i wygląda na zepsuty. **To artefakt
narzędzia, nie błąd.**

- Zrzut ekranu **wymusza klatkę** — klikaj i rób `screenshot`, nie `wait`.
- Sprawdzaj `getComputedStyle(el).opacity` przez `javascript_tool`, zanim
  uznasz coś za błąd wizualny.
- **Nie „naprawiaj" `AnimatePresence`/`layoutId` pod ten objaw.**
- `javascript_tool` potrafi zwrócić `window.innerWidth === 0`, gdy strona jest
  w tle — sprawdzanie „czy element mieści się na ekranie" daje wtedy fałszywy
  alarm. Zmierz po `screenshot`.

Szczegóły: `HUB_SETUP.md` → „Moduł 25", ostatnia sekcja.
