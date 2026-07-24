# iPad — wynik: siatka KPI (partia 2) + naprawa crasha paska bocznego. Stan i przekazanie

> Sesja 2026-07-24, kontynuacja `31-wynik-skroty-i-notatnik-naprawy.md`.
> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`. Ta sesja NIE
> dotknęła panelu webowego (`poltechnickx-website`) — same zmiany w apce.
> Commit: `567bd86`.

## Zakres (ustalony z właścicielem na starcie)

Pytanie na starcie: które sekcje Pulpitu/Statystyk dostają siatkę? Wybór
właściciela — **tylko karty KPI**, próg **760pt / 2 kolumny** (ten sam co
dwupanelowy układ Leadów/Projektów/Klientów).

- **Pulpit** — sekcja „Wskaźniki" (przychód w tym miesiącu, zaległe, oferty
  ważone — waluty osobno, bez sumowania).
- **Statystyki** — „Zdrowie projektów" (Na dobrej drodze/Zagrożony/Zerwany)
  i „Wskaźniki" (6 kart KPI: czas do 1. odpowiedzi, konwersja, DSO, leady z
  polecenia, godziny pracy, opinie).
- **Świadomie POZA zakresem**: listy robocze (leady po terminie, kamienie,
  poczta do obsługi, ostatnie notatki, kontakty nurture) — zostają jedną
  kolumną, bo to naturalnie listy do przewijania, nie kafle.

## Co zrobiono

### Siatka kart KPI

Dwie kolumny na szerokim iPadzie (≥760pt kolumny treści), jedna kolumna
(jak dotąd) wąsko — iPhone, pionowy iPad, mniejsze okno w Slide Over.

### Crash przy przeciąganiu paska bocznego (znaleziony PRZEZ tę zmianę, nie zgłoszony wcześniej)

Pierwsza wersja użyła `LazyVGrid`. Właściciel zgłosił: „aplikacja się
wysypuje, kiedy jest w trybie poziomym i chce wyciągnąć belkę boczną".

**Diagnoza** — ściągnięty crash log z iPada
(`xcrun devicectl device info files --domain-type systemCrashLogs`,
pliki `LeggeraHub-2026-07-24-162746.ips`/`...-162758.ips`, dwa identyczne
crashe pod rząd): `EXC_BREAKPOINT` w `_assertionFailure`, stos przez
`-[UICollectionView _updateVisibleCellsNow:]` →
`-[UICollectionViewCompositionalLayout invalidateLayoutWithContext:]` →
wywołane z `_UISplitViewControllerAdaptiveImpl
_prepareTransitionToLayout:` — czyli dokładnie z wnętrza interaktywnej
tranzycji `NavigationSplitView` przy przeciąganiu paska.

**Przyczyna**: `LazyVGrid` renderuje się przez WŁASNY, zagnieżdżony
`UICollectionViewCompositionalLayout` wewnątrz wiersza `List` (sam `List`
też jest `UICollectionView` od kilku wersji SwiftUI). W trakcie
interaktywnego przeciągania paska bocznego (ciągła zmiana szerokości
kolumny treści w trakcie animacji) zagnieżdżony collection view dostawał
`invalidateLayout` W TRAKCIE przejścia adaptacyjnego splitu i padał na
asercji.

**Pierwsza próba naprawy** (niewystarczająca) — zamiana `LazyVGrid` na
zwykły `HStack` par. Usunęła zagnieżdżony collection view, ale sekcja
WCIĄŻ zmieniała LICZBĘ wierszy `List` (N osobnych wierszy wąsko → jeden
zbiorczy wiersz szeroko) w reakcji na `onGeometryChange` odpalający się
przy KAŻDEJ klatce przeciągania — to wciąż struktura, którą `List` musi
przeliczyć w trakcie tej samej interaktywnej tranzycji.

**Ostateczna naprawa** — `kartyKpi()` w `UkladIpad.swift`: sekcja
zwraca ZAWSZE dokładnie jeden widok (`VStack`), więc liczba wierszy
`List` w tej sekcji jest STAŁA niezależnie od szerokości. Zmienia się
tylko to, co jest W ŚRODKU tego jednego wiersza (zwykły `VStack`/`HStack`,
nie `UICollectionView`) — SwiftUI przelicza to bez dotykania modelu
wierszy listy. Wąsko dokładany jest ręczny `Divider()` zamiast separatora
`List` (bo teraz to jeden wiersz, nie N osobnych).

**Lekcja na przyszłość**: `LazyVGrid`/`LazyHGrid` wewnątrz wiersza `List`
na iPadzie w `NavigationSplitView` jest ryzykowne, jeśli cokolwiek w tej
liście reaguje na żywą szerokość kolumny (interaktywne przeciąganie paska
bocznego). Bezpieczniejszy wzorzec: ręczny `HStack`/`VStack` (bez
własnego collection view) + STAŁA liczba wierszy `List` niezależnie od
stanu wynikającego z geometrii.

## Weryfikacja

Build Release, `devicectl install` + `launch` na iPadzie
(`3CCA9321-4215-5229-A506-C204CB802F37`). UI zweryfikowane przez
mirroring ekranu w QuickTime (`Nowe nagranie filmowe` → źródło „Ekran:
iPad (Patryk)") — mirroring jest TYLKO podglądem, bez dotyku, więc
nawigację po ekranie robił właściciel ręcznie. Właściciel powtórzył
DOKŁADNIE gest, który wcześniej crashował (przeciąganie krawędzi paska,
nie tylko przycisk zwijania) — potwierdził, że działa. Brak nowych
plików `LeggeraHub-*.ips` po naprawie.

## Mapa plików (zmienione tej sesji)

- `LeggeraHub/Views/UkladIpad.swift` — `kartyKpi()` (siatka/stos, zawsze
  jeden wiersz `List`), `czytajSzerokiUklad()` (próg 760pt przez
  `onGeometryChange`), `kartaKpi()` (obwódka szkła dla trybu siatki).
- `LeggeraHub/Views/StatystykiView.swift` — `zdrowieProjektow`,
  `wskaznikiSekcja`/`kpiElementy` na `kartyKpi()`.
- `LeggeraHub/Views/PulpitView.swift` — `wskazniki`/`wskaznikiElementy` na
  `kartyKpi()`.

## Następne partie (bez zmian od `31-wynik-*.md`)

3. **Drag & drop.**
4. Drobiazgi: pole szukania w liście za bardzo w prawo; FAB w wąskim
   wariancie iPada jest w pasku (toolbar), nie jako FAB.

Osobno, poza kolejką: tłumaczenie maili (Ollama) — osobny brief
backendowy, świadomie odłożone.

Zacznij kolejną sesję od potwierdzenia z właścicielem, że bierzemy
partię 3 (Drag & drop) albo partię 4 (drobiazgi) — i jak zwykle:
`git status`/`git log` PRZED rozpoczęciem pracy (patrz
`rownolegle-sesje-git-kolizja` w pamięci).
