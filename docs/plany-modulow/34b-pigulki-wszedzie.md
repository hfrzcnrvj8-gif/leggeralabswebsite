# Moduł 34b — Rozsuwane pigułki na wszystkich paskach (dokończenie)

> Przeczytaj `docs/plany-modulow/README.md` i `CLAUDE.md`.
> Brief powstał 2026-07-17, zaraz po Module 34.

## Po co ten moduł: panel jest w połowie drogi i to nasza wina

Moduł 34 dał panelowi dwie rzeczy: **dymek** (`Tooltip.tsx`) i **rozsuwaną
pigułkę** (`ExpandingIconButton.tsx` — ikona po najechaniu rozsuwa się w
podpisaną pigułkę, wzorem Centrum powiadomień macOS; właściciel wskazał ten
efekt wprost). Ale pigułki podpięto **tylko pod pasek Leadów**.

Efekt: najeżdżasz na ikonę w Leadach — ładna pigułka. Na tę samą ikonę w
Fakturach — stary systemowy prostokąt po sekundzie. **To dokładnie ten stan
„migracja kawałkami rozjedzie panel na pół drogi", przed którym ostrzega
`CLAUDE.md`.** Właściciel powiedział wprost: *„wygląd ma być spójny"*.

To runda **mechaniczna**: ten sam komponent, ta sama podmiana. Zero nowych
decyzji produktowych.

## Zinwentaryzowane 2026-07-17 (liczby zweryfikowane)

Pigułki ma dziś **wyłącznie** `leads/LeadsDashboard.tsx`. W panelu zostało
**154 natywnych `title=`**.

| Pasek | ile `title=` |
|---|---|
| `invoices/InvoicesDashboard` | 13 |
| `offers/OffersDashboard` | 9 |
| `costs/CostsDashboard` | 6 |
| `contracts/ContractsDashboard` | 4 |
| `projects/ProjectsDashboard` | 3 |
| `clients/ClientsDashboard` | 2 |
| `notes/NotesDashboard` | 2 |

## ❗ NIE zamieniaj wszystkich 154 — te `title=` to CZTERY różne rzeczy

To jest sedno tego briefu. Sprawdzone na konkretnych przykładach:

**1. Ikona BEZ podpisu w pasku narzędzi → `ExpandingIconButton` (pigułka).**
Np. „Dodaj klienta", „Rejestr sprzedaży", „Faktury cykliczne", „Dane firmy",
„Nowa faktura", „Szablony ofert", „Nowy dokument", „Opcje widoku", „Dodaj
projekt". Tu pigułka ma sens: obok jest wolne miejsce, a treść to krótka
**etykieta**.

**2. Przycisk, który MA już widoczny podpis → po prostu USUŃ `title`.**
Przykład: `ClientsDashboard.tsx:274` — `<button title="Filtry">` renderujące
`<IconFilter /> Filtry`. Dymek powtarzający napis, który i tak widać, to czysty
szum. Nie dawaj tu pigułki — nie ma czego rozsuwać.

**3. Objaśnienie, czyli ZDANIE → `Tooltip` (dymek), nie pigułka.**
Przykład: `InvoicesDashboard.tsx:322` — `title` na **całej karcie KPI**: *„Ile
dni po terminie wisi najstarsza nieopłacona faktura. Progi eskalacji: 3 dni —
uprzejme przypomnienie, 10 — stanowcze, 21 — formalne wezwanie do zapłaty."*
Tego się nie „rozsuwa" — pigułka podpisuje ikonę, dymek tłumaczy. Podobnie
`OffersDashboard.tsx:249/253/262` i `NotesDashboard.tsx:131`.

**4. Akcja w WIERSZU tabeli → `Tooltip`, nie pigułka.**
Przykład: `InvoicesDashboard.tsx:495` — `title="Podgląd / wydruk"` na ikonie
w wierszu. Pigułka rozsuwa się **w lewo, nad sąsiadów** — w pasku narzędzi
zasłania puste miejsce, ale w wierszu zasłoniłaby dane faktury. Tu dymek.

**5. `Truncate` (`components.tsx:307`) — natywny `title` ZOSTAJE.**
Tam `title` niesie **pełną, uciętą treść** komórki, a nie etykietę kontrolki.
To poprawne użycie natywnego dymka i jedno z niewielu miejsc, gdzie długi tekst
systemowy jest OK. **Nie ruszaj.**

## Podział ról (zapamiętaj to jednym zdaniem)

> **Pigułka podpisuje ikonę. Dymek tłumaczy stan albo znaczenie.**

## Jak to zrobić (wzorzec z Leadów)

`leads/LeadsDashboard.tsx` — gotowy przykład do skopiowania:
```tsx
<ExpandingIconButton label="Znajdź nowe leady" icon={<IconSparkles size={15} />} onClick={…} />
<ExpandingIconButton label="Eksport CSV" icon={<IconFileExport size={15} />} href="/api/leads/export" />
```
- `href` → renderuje `<a>` (pobieranie pliku), inaczej `<button>`.
- `disabled` i `ariaLabel` są w API komponentu.
- Podpis trafia do `aria-label` — **usuń stary `title`**, żeby nie było dwóch
  dymków naraz (natywny + nasz).
- Komponent sam trzyma ramkę 24×24 px, więc pasek się nie rozjeżdża.

Ikona z **dodatkowym menu** pod prawym przyciskiem (jak eksport w Leadach) jest
owinięta w `<span className="relative block h-6 w-6 shrink-0" onContextMenu={…}>`
— powiel ten wzorzec, jeśli gdzieś dokładasz menu.

## Do rozstrzygnięcia z właścicielem (dwa pytania, oba drobne)

1. **Czy pigułki także w wierszach tabel?** Brief zakłada: NIE (dymek), bo
   rozsuwanie zasłania dane wiersza. Ale ikon akcji w wierszach jest sporo
   (Podgląd/wydruk, Usuń, Zmień status) — jeśli właściciel woli spójność „każda
   ikona rozsuwa się tak samo", to zmienia zakres.
2. **Co z długimi objaśnieniami na KPI** (te 2–3 zdania o progach windykacji)?
   Dymek `Tooltip` ma `max-w-[260px]` — zmieści się, ale będzie wysoki.
   Zostawiamy jako dymek, czy to raczej kandydat na ikonę „i" obok liczby?

## ⚠️ Pułapki podglądu — przeczytaj, zanim zdiagnozujesz „błąd"

- **Karta podglądu bywa `hidden` → `requestAnimationFrame` = 0 kl./s → animacje
  `framer-motion` nie startują**: treść stoi na `opacity: 0`, przełączniki widoku
  wyglądają na zepsute. **Artefakt, nie bug** (kosztował pół godziny 2026-07-17).
  **Zawsze zaczynaj od `tabs_create`** — świeża karta jest `visible`, ~50 kl./s.
  Szczegóły: `HUB_SETUP.md` → „Moduł 34", pamięć `podglad-rAF-zamrozony`.
- **Sama pigułka NIE zależy od `framer-motion`** — animuje ją czysty CSS
  (`max-width` + `opacity`), więc działa nawet przy zamrożonym rAF. Jeśli się nie
  rozsuwa, to jest prawdziwy błąd, nie artefakt.
- **`grid-cols-[0fr]` → `[1fr]` NIE działa w tym komponencie** (popularna sztuczka
  na animowanie szerokości) — pigułka jest `absolute`, więc nie ma „wolnej
  przestrzeni", którą `fr` wypełnia; track wychodzi 0 px nawet przy ręcznym
  wymuszeniu. Dlatego jest `max-width`. **Nie „popraw" tego z powrotem.**
- Klikaj przez `ref` z `read_page`, nie po współrzędnych (zrzut 800×450 vs okno
  1600×900).
- Panel `/admin` jest **jednomotywowy (ciemny)** — nie szukaj jasnego wariantu.

## Weryfikacja

`npx tsc --noEmit -p tsconfig.json` po każdej paczce + **obowiązkowy przegląd
wizualny na świeżej karcie**: najedź na ikony w Klientach, Fakturach, Kosztach,
Ofertach, Umowach, Projektach i Notatniku — pigułka ma się rozsuwać w lewo,
**ikona nie może drgnąć**, a sąsiedzi nie mogą się przesunąć. Sprawdź też, że
nigdzie nie wyskakuje stary natywny dymek obok nowego (= został `title`).
