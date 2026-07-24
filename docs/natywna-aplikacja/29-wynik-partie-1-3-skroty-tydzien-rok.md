# iPad — wynik partii 1-3 (skróty, tydzień, rok). Stan i przekazanie

> Sesja 2026-07-23/24, kontynuacja Fazy 9 z `22-ipad-hybryda-i-adaptacyjny.md`.
> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`. Commity
> `3c49f62`, `de0b6db`, `ff4458e`, `a836ffc` na `main`.

## Co zrobiono

### Partia 1 — bez skrótów na iPadzie

- `KalendarzView.swift`: nagłówek tygodnia „tydz. 30" → „tydzień 30".
- `KalkulatorDoboruView.swift`: „Wzrost 12–24 mies." → „...miesiące".
- Audyt całego repo pod kątem podobnych skrótów: reszta jest celowa i
  zostaje bez zmian — litery dni tygodnia w siatce miesiąca/tygodnia
  (`pn wt śr...`, 7 kolumn nie pomieści pełnych nazw, dokładnie jak w
  Kalendarzu Apple), skróty księgowe VAT (`szt.`, `zw.`, `np.`).
  Świadomie NIE ruszono „os." w Kalkulatorze doboru (np. „z 5 os.") —
  rozwinięcie na „osób" byłoby niepoprawne gramatycznie dla liczb 2–4
  (powinno być „osoby"), a w kodzie nie ma helpera do polskiej odmiany
  liczebników. Mała, osobna poprawka, jeśli ktoś kiedyś zechce.

### Partia 2 — Kalendarz, poziom tygodnia: siatka godzin (iPad)

- Nowy `RozpiskaTygodnia` (`KalendarzView.swift`) — siedmiokolumnowa siatka
  godzin na poziomie tygodnia, **tylko iPad** (`klasaSzerokosci == .regular`).
  iPhone zostaje przy starym pasku dni + liście (`glownaLista`), bez zmian.
  Własny nagłówek dni (gutter osi godzin + `KomorkaDniaPrzycisk` x7),
  pasek wielodniowych/całodniowych wydarzeń, kompaktowe chipy
  terminów/przypomnień pod paskiem (nie pełne wiersze jak w widoku dnia —
  nie mieszczą się w 7 wąskich kolumnach), blok każdego wydarzenia z
  godziną — tap otwiera edycję, długie przytrzymanie godziny dodaje nowe
  wydarzenie o tej porze.
- Logika pasków wielodniowych **wyciągnięta** z `SiatkaMiesiaca` do
  współdzielonego `PaskiTygodniowe` (enum, statyczne `Pas`/`Segment`/
  `przypiszTory`/`segmentyDlaTygodnia`/`segmentKomorki`) — to samo
  wydarzenie wygląda identycznie w siatce miesiąca i w siatce tygodnia,
  jeden algorytm przydziału torów zamiast dwóch kopii.
- `SiatkaMiesiaca` przy okazji: jednodniowe wydarzenia na iPadzie dostają
  TAKI SAM pasek z tytułem jak wielodniowe (wcześniej — tylko kropka).
  Cyjanowa kropka „wydarzenie" pod cyfrą dnia wyłączona na iPadzie (pasek
  już to pokazuje, kropka by dublowała).
- `+`/FAB na poziomie miesiąca i tygodnia: teraz ZAWSZE pyta „Wydarzenie
  czy przypomnienie?" (istniejący `pytanieCoDodac`) zamiast wjeżdżać
  prosto w wydarzenie — ujednolicone z długim przytrzymaniem dnia, które
  już tak robiło.
- **Pułapka złapana i naprawiona:** `Color.clear.frame(width: szerokoscOsi)`
  BEZ podanej wysokości w gutterze osi godzin łapczywie zajmował CAŁĄ
  zaproponowaną wysokość (ten sam mechanizm co stary, już naprawiony bug
  pustych komórek siatki miesiąca — `Color`/`Rectangle` bez ograniczenia
  na danej osi bierze tyle, ile zaproponuje rodzic). Efekt: ogromne puste
  przerwy między nagłówkiem, paskami a siatką godzin na fizycznym iPadzie
  (nie w symulatorze — różnica prawdopodobnie w Dynamic Type/wersji iOS).
  Naprawa: `.fixedSize(horizontal: false, vertical: true)` na tych
  `Color.clear`. Jeśli ktoś w przyszłości doda kolejny gutter/spacer w tym
  pliku — pamiętać o tym samym zabiegu.

### Partia 3 (część) — widok Rok jak Kalendarz Apple

Właściciel przysłał zrzut natywnego Kalendarza Apple jako wzorzec. Zmiany
w `MiniMiesiac`:
- Skrót miesiąca (Sty/Lut/Mar/…/Gru) zamiast pełnej nazwy — ten sam
  wyjątek od reguły „bez skrótów" co litery dni tygodnia (gęsta siatka
  dwunastu miesięcy, nie oszczędność miejsca na telefonie).
- Doszedł rząd liter dni tygodnia (P W Ś C P S N — identyczny zestaw jak
  w Kalendarzu Apple, zaskoczenie: poniedziałek i piątek dzielą „P", to
  zamierzone po obu stronach).
- Dziś jako WYPEŁNIONE złote kółko (nie sama złota cyfra) — kolor
  zaczerpnięty ze słownika apki („dziś" = złoto wszędzie indziej), nie
  skopiowana czerwień Apple.
- Siatka roku: 4 kolumny na iPadzie (3 na iPhonie, bez zmian) —
  `.flexible(minimum: 140, maximum: 240)` na `GridItem`, żeby miniatura
  nie rozciągała się na 1/3-1/4 CAŁEJ szerokości ekranu (druga część tej
  samej pułapki „flexible bez maximum" — wewnętrzna siatka dni w
  `MiniMiesiac` jest TEŻ `.flexible()`, więc cyfry rozjeżdżały się po
  całej szerokiej karcie).

## Operacyjne — zapamiętać na przyszłość

- **Wgrywanie na iPada bywało tarciem tej sesji**: świeży
  `devicectl device install` kilka razy z rzędu wymagał PONOWNEGO
  zaufania profilowi na urządzeniu (Ustawienia → Ogólne → VPN i
  zarządzanie urządzeniem), mimo że profil był już wcześniej zaufany.
  Prawdopodobnie darmowe konto deweloperskie re-signuje krótkotrwałym
  certyfikatem przy każdym buildzie. Jeśli to się powtórzy: nie szukać
  błędu w kodzie, po prostu poprosić właściciela o ponowne zaufanie
  (czasem ekran „Zweryfikuj" wisi bez błędu — pomaga sprawdzenie/
  przełączenie Wi-Fi, weryfikacja łączy się z serwerami Apple). Patrz
  pamięć `ipad-devicectl-trust-friction`.
- Z tego powodu: **nie warto** za każdą drobną poprawką robić pełnego
  cyklu re-stamp (`Skrypty/stempel-wersji.sh`) + rebuild + reinstall tylko
  po to, żeby Ustawienia apki nie pokazywały „+ niezapisane zmiany" — jeśli
  poprzedni, już zaakceptowany build działa i kod jest zacommitowany w
  git, to wystarczy. Re-stamp ma sens, gdy i tak buduje się coś nowego do
  przetestowania.
- Weryfikacja w symulatorze: `xcrun simctl launch` z
  `SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny` +
  `SIMCTL_CHILD_LEGGERA_DEV_HASLO=devhaslo` (device: iPad Pro 13-inch M5,
  `2F47BE48-8BF3-40BC-BE9C-18E8EEC28B91` w tej sesji, ale symulatory się
  zmieniają między maszynami/wersjami Xcode — sprawdź `xcrun simctl list
  devices`). Świeży install czasem wymaga JEDNEGO dodatkowego `launch` bez
  reinstalla (sesja/token się gubi po instalacji). Lokalny panel
  (`npm run dev`, port 3000) bywa flaky — jeśli `curl` do
  `localhost:3000/api/admin/login` nie odpowiada, uruchom przez
  `preview_start name:"dev"` i spróbuj ponownie.
- Tap-coordinates w zrzutach z symulatora: obraz wyświetlany w tym
  narzędziu bywa w INNEJ skali niż punktowa przestrzeń dotyku podana przez
  `attach` (np. 1500×2000 wyświetlane vs 1032×1376 punktów na iPad Pro
  13") — współrzędną odczytaną ze zrzutu trzeba przemnożyć przez
  ~0.688 przed `tap`, inaczej trafia się w zły element.

## Mapa plików (dodane/zmienione tej sesji)

- `LeggeraHub/Views/KalendarzView.swift` — `RozpiskaTygodnia` (nowy),
  `PaskiTygodniowe` (nowy, wyciągnięty z `SiatkaMiesiaca`), `MiniMiesiac`
  (skrót miesiąca, litery dni, wypełnione kółko), `widokRoku` (4 kolumny
  iPad + limit szerokości), `planszaPoziomu`/`body` (routing iPad-tydzień
  do `RozpiskaTygodnia`), `dodajNaDzien`/FAB (pytanie wydarzenie/
  przypomnienie).
- `LeggeraHub/Views/KalkulatorDoboruView.swift` — „miesiące" zamiast „mies.".

## Następne partie (renumerowane, z oryginalnej listy w `22-*.md`)

1. **Poczta jak Apple Mail** (przyciski funkcyjne: odpowiedz/przekaż/
   flaga/przenieś w widoku wiadomości).
2. **Apple Pencil** (Scribble wszędzie → kanwa PencilKit w notatkach →
   adnotacje na dokumentach; decyzja o przechowywaniu rysunku —
   obrazek czy lokalnie — do podjęcia z właścicielem).
3. **Skróty klawiaturowe** (⌘N/⌘F/⌘1–5 nawigacja/akcje).
4. **Siatki wielokolumnowe** (Pulpit/Statystyki — dziś jedna rozciągnięta
   kolumna na całej szerokości iPada).
5. **Drag & drop.**
6. Drobiazgi: pole szukania w liście siedzi trochę za bardzo w prawo; FAB
   w wąskim wariancie iPada jest w pasku (toolbar), nie jako FAB (spójność
   orientacji do rozważenia).

Zacznij nowy czat od pytania, którą partię bierzemy — pracuj metodą tego
projektu: mała paczka → build → weryfikacja zrzutem (symulator) → wgranie
na iPada → ocena właściciela → commit+push.
