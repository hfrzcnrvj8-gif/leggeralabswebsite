# Prompt do wklejenia w nowym czacie

Kontynuujemy dopracowanie aplikacji natywnej Leggera Hub na **iPada** (repo apki:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`, panel: bieżące repo strony).

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/natywna-aplikacja/34-wynik-partia3-drag-and-drop.md` (wynik tej
  sesji — reorder okazał się już gotowy, drag-to-reschedule w Kalendarzu
  zbudowany i scommitowany po sześciu rundach debugowania, systemowy
  drag & drop ZABLOKOWANY i wycofany — przeczytaj sekcję „Zablokowane"
  PRZED próbą kolejnego podejścia),
- `docs/natywna-aplikacja/33-brief-drag-and-drop.md` (pierwotny brief —
  cztery kandydaci na „drag & drop", tabela nakład/ryzyko),
- `docs/natywna-aplikacja/32-wynik-siatka-kpi-i-naprawa-crasha-splitu.md`
  (partia 2: siatka KPI + złapany i naprawiony crash `LazyVGrid` w `List`
  przy przeciąganiu paska bocznego — ta sama rodzina ryzyka co drag & drop),
- pamięć: `apka-ipad-pelny-desktop-hybryda`, `apka-ipad-szkielet-adaptacyjny`,
  `apka-ipad-partie-1-3`, `ipad-lazygrid-w-liscie-crash-splitu`,
  `ipad-devicectl-trust-friction`, `modul-33-drag-and-drop`,
  `rownolegle-sesje-git-kolizja` (patrz niżej — sprawdzaj zawsze na starcie).

**Stan:** iPad ma działać jak pełny komputer w terenie. Zrobione i
scommitowane: partia 1 (skróty klawiaturowe, moduł Apple Pencil), partia 2
(siatka kart KPI), partia 3 (reorder — już istniał; drag-to-reschedule w
Kalendarzu widoku dnia, iPad+iPhone; pastylka dodawania w Kalendarzu;
etykieta godziny przy kresce „teraz"). Commit `c5ad225`.

**Partia 3, czwarty kandydat — systemowy drag & drop (zdjęcie z Zdjęć/Plików
→ załącznik notatki w Notatniku) — NIE działa, próba wycofana.** Trzy różne
podejścia (`.onDrop` na `Section`, na osobnym widoku wewnątrz `Section`, na
korzeniu całego `Form`) dały identyczny objaw: apka w ogóle nie dostaje
zdarzenia upuszczenia (potwierdzone diagnostycznym komunikatem, który nigdy
się nie odpalił). Źródło przeciągnięcia działa (miniaturka unosi się pod
palcem, prawdziwy Split View na fizycznym urządzeniu — nie mirroring
QuickTime, ten NIE przyjmuje dotyku, pierwsza błędna hipoteza tej sesji).
Robocza hipoteza: `Form`/`List` mają własną maszynerię drop-delegate (do
`.onMove`), która może przechwytywać zdarzenie na poziomie `UITableView`
zanim dotrze do zagnieżdżonego `.onDrop`. **Wymaga sesji z Xcode
podłączonym NA ŻYWO do urządzenia** (Console/breakpoint), nie zdalnego
zgadywania przez zrzuty ekranu — spróbuj też nowszy `.dropDestination(for:)`
(Transferable) zamiast `.onDrop(of:isTargeted:perform:)`, nie wypróbowany
w poprzedniej sesji. Pełny opis prób w `34-wynik-*.md`.

**Ważna lekcja — równoległe sesje.** Właściciel czasem ma uruchomioną
drugą sesję (albo świeżo zamkniętą, ale niescommitowaną) nad TYM SAMYM
tematem. Jeśli `git status`/`git diff` pokazuje zmiany w plikach, których
Ty nie dotknąłeś, ZAPYTAJ właściciela, czy to równoległa sesja, ZANIM
zaczniesz to poprawiać, nadpisywać albo commitować — patrz
`rownolegle-sesje-git-kolizja` w pamięci. Nie zakładaj domyślnie, że
niescommitowane zmiany to Twoja własna, zapomniana robota.

**Zasady krytyczne:** na iPada buduj RELEASE; nie zagnieżdżaj
`NavigationSplitView`; wgrywanie CLI przez `devicectl` (iPad
`3CCA9321-4215-5229-A506-C204CB802F37`, iPhone
`1F379FD8-EFA4-55F7-BDB6-7E9CC8B5BEBD`); wariant `project-telefon.yml`;
iPhone NIE regresuj (ta sama apka, adaptuje układ — widok dnia Kalendarza
jest WSPÓLNY dla obu, sprawdzaj to przed zakładaniem, że coś jest
„tylko na iPada"). **Nowy plik w apce wymaga `xcodegen generate` PRZED
buildem** — sam plik na dysku nie wystarczy, `.xcodeproj` trzeba
przegenerować, inaczej `xcodebuild` mówi „cannot find X in scope" mimo
poprawnego kodu. **Stempel wersji starzeje się między buildami tej samej
sesji**, jeśli po drodze poszedł commit — błąd „Stempel wskazuje rewizję
X, a repozytorium stoi na Y" nie jest usterką, tylko sygnałem, żeby
odpalić `Skrypty/stempel-wersji.sh` jeszcze raz. **Świeży install
regularnie wymaga ponownego zaufania profilowi na urządzeniu** (patrz
`ipad-devicectl-trust-friction`) — w tej sesji zdarzało się to praktycznie
po KAŻDYM świeżym installcie na obu urządzeniach, nie tylko czasem; nie
próbuj diagnozować dlaczego, po prostu poproś właściciela o ponowne
zaufanie w Ustawienia → Ogólne → VPN i zarządzanie urządzeniem.
`Color`/`Rectangle` bez podanej wysokości/szerokości na danej osi
łapczywie zajmuje całą zaproponowaną przestrzeń — zawsze dawaj jawny
wymiar albo `.fixedSize(horizontal:vertical:)`. Zapisany PNG w skali
`UIScreen.main.scale` trzeba wczytywać z TĄ SAMĄ jawną skalą
(`UIImage(data:scale:)`), nigdy przez `UIImage(contentsOfFile:)` (daje
`scale = 1`, rozmiar wychodzi 2× za duży). **Jakikolwiek widok, który
reaguje na żywą geometrię/szerokość wewnątrz `List` na iPadzie (siatki,
drag & drop), trzymaj ZE STAŁĄ liczbą wierszy `List`** — patrz
`32-wynik-*.md` i `ipad-lazygrid-w-liscie-crash-splitu`.

**Gesty przeciągnięcia w `List`/`ScrollView` — dwie sprawdzone pułapki
(partia 3):** (1) dwa konkurujące rozpoznawacze gestów na jednym widoku
(np. `LongPressGesture.sequenced(before:)` obok osobnego `.onTapGesture`)
dają zauważalną zwłokę przy puszczeniu palca — użyj JEDNEGO `DragGesture`
z własnym zegarem zbrojenia, tap wykryty ręcznie w `onEnded` po małym
przesunięciu. (2) `.gesture()` (nie `.simultaneousGesture`/
`.highPriorityGesture`) na widoku wewnątrz `ScrollView` rywalizuje o
dotyk z przewijaniem — użyj `.highPriorityGesture`. Pełne uzasadnienia i
kod w `34-wynik-*.md`.

**Symulator bywał niestabilny w poprzednich sesjach** (logowanie gubiło stan
pola hasła, tapy przestawały trafiać) — jeśli nie masz potwierdzenia, że to
naprawione, nie ufaj zrzutom z symulatora bez zastrzeżeń. Backend zawsze da
się zweryfikować deterministycznie przez `curl`; UI ostatecznie weryfikuj na
fizycznym urządzeniu (`devicectl`). Mirroring w QuickTime (`Nowe nagranie
filmowe` → źródło „Ekran: iPad (Patryk)") pokazuje ekran żywo, ale NIE
przyjmuje dotyku — to tylko podgląd, nawigację robi właściciel ręcznie.
**Ten sam problem dotyczy zrzutów ekranu z Maca pokazujących mirroring —
sprawdź WPROST ze źródłem zrzutu, zanim zdiagnozujesz coś jako „to nie
jest prawdziwe urządzenie", jeśli właściciel twierdzi inaczej.**

**iPady (ten model) fizycznie NIE MAJĄ Taptic Engine** — `UIImpactFeedbackGenerator`
jest tam cichym no-opem sprzętowym niezależnie od kodu. iPhone (15 Pro Max)
ma pełną haptykę. Nie obiecuj wibracji na iPadzie i nie trać czasu na jej
„naprawianie" tam — to ograniczenie sprzętu.

Reszta kolejki (bez zmian, drobiazg nieruszony w tej sesji):
1. Systemowy drag & drop (patrz wyżej — wymaga żywej sesji Xcode).
2. Drobiazg: pole szukania w liście za bardzo w prawo.

Osobno, poza kolejką: tłumaczenie maili (Ollama, lokalny model) — wymaga
własnego briefu backendowego (nowa trasa panelu), odłożone świadomie jako
osobny temat.

Zacznij od sprawdzenia `git status`/`git log` PRZED rozpoczęciem pracy
(patrz ostrzeżenie o równoległych sesjach), i pracuj metodą tego projektu:
mała paczka → build → weryfikacja (backend `curl`, UI na fizycznym
urządzeniu) → wgranie na oba urządzenia → ocena właściciela → commit+push.
