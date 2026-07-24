# Wynik: Drag & drop (partia 3 roadmapy iPada)

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`. Sesja
> 2026-07-24, kontynuacja `33-brief-drag-and-drop.md`.

## Scommitowane (`c5ad225`)

Właściciel wybrał trzech z czterech kandydatów z briefu (bez kanbanu):
reorder kamieni/zadań, drag-to-reschedule w Kalendarzu, systemowy drag & drop.

1. **Reorder kamieni/zadań w projekcie** — okazał się już zbudowany i
   scommitowany od `e7d2800` (sprzed tej sesji). Brief 33 go nie znalazł,
   bo grepował `\.onMove(` z otwierającym nawiasem — kod używa
   `.onMove { }` jako trailing closure, bez nawiasu. **Lekcja**: grepuj
   składnię SwiftUI bez końcowego nawiasu (`.onMove`, `.onDrag`, `.onDrop`,
   `.draggable`, `.dropDestination` też mają warianty trailing-closure).

2. **Drag-to-reschedule w Kalendarzu** — widok dnia (`RozpiskaDnia`,
   wspólny dla iPada i iPhone'a). Przytrzymaj kartę (0,45 s), przeciągnij,
   puść — przyciąga do :00/:15/:30/:45 (bezwzględne znaczniki zegara, NIE
   krok 15 min od niewyrównanej minuty startu — pierwsza wersja miała tu
   błąd, dawała np. „15:23"). Powtarzające się wydarzenia wyłączone z gestu
   (PATCH przestawia całą serię). Sześć rund testowania na żywo, żeby
   dojść do działającej wersji — patrz „Pułapki" niżej.

3. **Drobiazgi**: „+" w Kalendarzu (iPad) zamieniony na pastylkę
   (Nowe wydarzenie / Nowe przypomnienie, zawsze widoczne, wzorzec
   `PastylkaDodawaniaNotatki`). Właściciel świadomie zrezygnował z
   trzeciego slotu („Wydarzenie całodniowe" okazało się identyczne z
   istniejącym — formularz już domyślnie otwiera się bez godziny).
   Kreska „teraz" dostała etykietę z aktualną godziną (jak w Kalendarzu
   Apple).

## Pułapki złapane przy drag-to-reschedule (wszystkie naprawione)

- **Dwa konkurujące rozpoznawacze gestów na jednej karcie**
  (`LongPressGesture.sequenced(before:)` + osobny `.onTapGesture`) dawały
  zauważalną zwłokę przy puszczeniu palca — UIKit czeka, aż jeden
  „przegra". Fix: JEDEN `DragGesture(minimumDistance: 0)` z własnym
  zegarem zbrojenia (Task + sleep 450 ms) zamiast `LongPressGesture`, tap
  wykryty ręcznie w `onEnded` (mały ruch = edycja).
- **`.gesture` (nie `.simultaneousGesture`/`.highPriorityGesture`) na
  karcie wewnątrz `ScrollView`** rywalizowało z przewijaniem — też dawało
  zwłokę. Fix: `.highPriorityGesture`.
- **Przyciąganie względem WŁASNEJ minuty startu, nie zegara** — wydarzenie
  zaczęte o 13:08 lądowało zawsze na „:08/:23/:38/:53". Fix: licz
  bezwzględną docelową minutę (`docelowaMinuta`), zaokrągloną do 15 min
  od zera, nie od punktu startu.
- **Brak podglądu godziny podczas ciągnięcia** — karta wizualnie stała w
  innym miejscu niż jej etykieta czasu (etykieta = stara godzina, dopóki
  serwer nie potwierdzi). Właściciel odczytał to jako „nieprecyzyjne".
  Fix: żywy podgląd (`podgladMinuta`, kolor złoty) — ta sama formuła w
  `onChanged` i `onEnded`, żeby miejsce puszczenia = miejsce zapisu.
- **Wyścig przy powtórnym złapaniu TEJ SAMEJ karty** zanim pierwsze
  przesunięcie zdążyło się potwierdzić z serwerem — spóźniona odpowiedź
  kasowała stan NALEŻĄCY już do drugiego przeciągnięcia (złota etykieta
  zawieszona na zawsze). Fix: licznik `pokolenie`, nie tylko `id`
  wydarzenia — reset stanu tylko jeśli pokolenie się zgadza.
- **iPad (ten model) fizycznie nie ma Taptic Engine** — `UIImpactFeedbackGenerator`
  jest tam cichym no-opem sprzętowym, niezależnie od kodu. Na iPhonie (15
  Pro Max) haptyka działa w pełni: „tik" przy każdym mijanym progu 15 min
  (nie tylko start/koniec) + `.prepare()` z wyprzedzeniem (bez tego
  pierwszy `impactOccurred()` w sesji bywał spóźniony/słaby).
- **`RozpiskaDnia` jest WSPÓLNA dla iPada i iPhone'a** (widok dnia nie
  gałęzi po `klasaSzerokosci`) — funkcja zbudowana „dla iPada" automatycznie
  działa też na telefonie. Warto to sprawdzać PRZED pytaniem właściciela,
  czy chce osobnej wersji na telefon.

## Zablokowane — systemowy drag & drop (NIE scommitowane, wycofane)

Czwarty kandydat: zdjęcie z Zdjęć/Plików (Split View) → załącznik notatki
w Notatniku (ten sam slot co rysunek Pencil, `store.wyslijRysunekNotatki`).
**Nie udało się uruchomić w tej sesji.** Trzy podejścia, wszystkie z
identycznym objawem — `.onDrop` w ogóle nie dostaje zdarzenia upuszczenia
(potwierdzone diagnostycznym komunikatem w `obsluzUpuszczoneZdjecie`,
który nigdy się nie odpalił):

1. `.onDrop` przypięty do `Section` wewnątrz `Form` — brak reakcji.
2. Osobny widok (`VStack` z `.contentShape(Rectangle())`) z `.onDrop`
   wewnątrz tej samej `Section` — brak reakcji.
3. `.onDrop` na korzeniu całego `Form` (`NotatkaDetailView.body`) —
   brak reakcji.

Źródło przeciągnięcia (miniaturka zdjęcia/zrzutu ekranu) POTWIERDZONE
działające — unosi się pod palcem, prawdziwy Split View na fizycznym
iPadzie (nie mylić z mirroringiem QuickTime na Macu, który NIE przyjmuje
żadnego dotyku — to była pierwsza, błędna hipoteza w tej sesji, zanim
właściciel pokazał zrzut z samego iPada). Problem jest więc PO STRONIE
ODBIORU w apce, głębszy niż kolejność modyfikatorów SwiftUI.

**Robocza hipoteza na następną sesję**: `Form`/`List` w SwiftUI na iPadOS
mają własną, wbudowaną maszynerię drop-delegate (do reorderu wierszy przez
`.onMove`), która może przechwytywać zdarzenie upuszczenia na poziomie
`UITableView`, zanim dotrze do jakiegokolwiek zagnieżdżonego `.onDrop`
— niepotwierdzone, wymaga sesji z Xcode podłączonym NA ŻYWO do urządzenia
(Console/breakpoint w `obsluzUpuszczoneZdjecie`), nie zdalnego zgadywania
przez zrzuty ekranu i nagrania wideo. Warto też sprawdzić nowszy
`.dropDestination(for:)` (Transferable) zamiast `.onDrop(of:isTargeted:perform:)`
— nie wypróbowane w tej sesji.

**Stan repo**: kod tej próby WYCOFANY (`git checkout`) — `NotatnikView.swift`
wrócił do stanu sprzed sesji. Nic nieukończonego nie zostało w repo.

## Do zrobienia w kolejnej sesji

1. Systemowy drag & drop (patrz wyżej) — potrzebuje żywej sesji debugowania,
   nie zdalnej.
2. Drobiazg z kolejki (nieruszony): pozycja pola szukania w liście za
   bardzo w prawo.
3. Osobno, poza kolejką: tłumaczenie maili (Ollama) — wymaga briefu
   backendowego, świadomie odłożone.

## Operacyjne (bez zmian)

`ipad-devicectl-trust-friction` uderzył WIELOKROTNIE w tej sesji — na
obu urządzeniach (iPad i iPhone), praktycznie po każdym świeżym install.
Weryfikacja przez `xcrun devicectl device install app` + `process launch`
działa niezawodnie technicznie; zaufanie profilu na urządzeniu jest
osobnym, ręcznym krokiem właściciela za każdym razem, bez wzorca kiedy
dokładnie jest potrzebne ponownie.
