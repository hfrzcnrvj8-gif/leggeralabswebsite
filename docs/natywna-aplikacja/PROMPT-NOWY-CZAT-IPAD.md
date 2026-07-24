# Prompt do wklejenia w nowym czacie

Kontynuujemy dopracowanie aplikacji natywnej Leggera Hub na **iPada** (repo apki:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`, panel: bieżące repo strony).

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/natywna-aplikacja/31-wynik-skroty-i-notatnik-naprawy.md` (najnowszy
  stan: partia 1 skrótów + naprawy Notatnika/Pencila, pułapki złapane, mapa
  plików — czytaj TEN, nie 30),
- `docs/natywna-aplikacja/30-wynik-poczta-apple-mail-i-apple-pencil.md`
  (Poczta jak Apple Mail + fundament modułu Pencil, sprzed poprzedniej sesji),
- `docs/natywna-aplikacja/22-ipad-hybryda-i-adaptacyjny.md` (fundament:
  hybryda, adaptacyjny układ, sedno techniczne),
- pamięć: `apka-ipad-pelny-desktop-hybryda`, `apka-ipad-szkielet-adaptacyjny`,
  `apka-ipad-partie-1-3`, `ipad-devicectl-trust-friction`,
  `rownolegle-sesje-git-kolizja` (patrz niżej — WAŻNE tej sesji).

**Stan:** iPad ma działać jak pełny komputer w terenie. Partia 1 (skróty
klawiaturowe: ⌘1–5 nawigacja, ⌘F szukaj, ⌘N nowy element, ⌘K szukaj wszędzie,
dyskretna legenda w sidebarze przy podłączonej klawiaturze) jest **zrobiona,
zweryfikowana na obu fizycznych urządzeniach i scommitowana**. Przy okazji
domknięty (po serii zgłoszeń właściciela) moduł Apple Pencil w Notatniku:
nawigacja na iPadzie, podgląd rysunku z pinch-zoom, prawdziwe Cofnij/Ponów,
kontynuacja rysunku, pastylka „Powiąż/Nowa notatka/Nowy rysunek" zamiast
rozwijanego menu. Szczegóły, uzasadnienia i świadomie odłożone rzeczy (zoom
w samym edytorze rysowania, surowe dane PencilKit zamiast PNG) w
`31-wynik-*.md`.

**Ważna lekcja tej sesji — równoległe sesje.** Właściciel czasem ma
uruchomioną drugą sesję (albo świeżo zamkniętą, ale niescommitowaną) nad
TYM SAMYM tematem. Jeśli `git status`/`git diff` pokazuje zmiany w plikach,
których Ty nie dotknąłeś, ZAPYTAJ właściciela, czy to równoległa sesja,
ZANIM zaczniesz to poprawiać, nadpisywać albo commitować — patrz
`rownolegle-sesje-git-kolizja` w pamięci. Nie zakładaj domyślnie, że
niescommitowane zmiany to Twoja własna, zapomniana robota.

**Zasady krytyczne (z `22-*.md`, `30-*.md` i `31-*.md`):** na iPada buduj
RELEASE; nie zagnieżdżaj `NavigationSplitView`; wgrywanie CLI przez
`devicectl` (iPad `3CCA9321-4215-5229-A506-C204CB802F37`, iPhone
`1F379FD8-EFA4-55F7-BDB6-7E9CC8B5BEBD`); wariant `project-telefon.yml`;
iPhone NIE regresuj (ta sama apka, adaptuje układ). **Nowy plik w apce
wymaga `xcodegen generate` PRZED buildem** — sam plik na dysku nie
wystarczy, `.xcodeproj` trzeba przegenerować, inaczej `xcodebuild` mówi
„cannot find X in scope" mimo poprawnego kodu. **Stempel wersji starzeje
się między buildami tej samej sesji**, jeśli po drodze poszedł commit —
błąd „Stempel wskazuje rewizję X, a repozytorium stoi na Y" nie jest
usterką, tylko sygnałem, żeby odpalić `Skrypty/stempel-wersji.sh` jeszcze
raz. Świeży install czasem wymaga ponownego zaufania profilowi na
urządzeniu (patrz `ipad-devicectl-trust-friction`) — nie rób kosmetycznego
re-stampu za każdą drobną poprawką, tylko gdy i tak buduje się coś nowego
do przetestowania. `Color`/`Rectangle` bez podanej wysokości/szerokości na
danej osi łapczywie zajmuje całą zaproponowaną przestrzeń — zawsze dawaj
jawny wymiar albo `.fixedSize(horizontal:vertical:)`. Każdy nowy ekran
„Więcej" (`WiecejView.Cel`) musi mieć JAWNIE ustalone, czy sam niesie
`NavigationStack`, czy polega na zewnętrznym (`wymagaZewnetrznegoStosu`
w `PanelBoczny.swift`) — domyślne założenie „to `*View`, więc na pewno ma
własny stos" jest fałszywe (Notatnik/Rejestr nie miały, stąd martwa
nawigacja na iPadzie, naprawione tej sesji). Zapisany PNG w skali
`UIScreen.main.scale` trzeba wczytywać z TĄ SAMĄ jawną skalą
(`UIImage(data:scale:)`), nigdy przez `UIImage(contentsOfFile:)` (daje
`scale = 1`, rozmiar wychodzi 2× za duży).

**Symulator bywał niestabilny w poprzednich sesjach** (logowanie gubiło stan
pola hasła, tapy przestawały trafiać) — właściciel zlecił w tle osobną
sesję ustabilizowania logowania w symulatorze dev (`task_2228eff0`); jeśli
nie masz potwierdzenia, że to naprawione, nie ufaj zrzutom z symulatora bez
zastrzeżeń. Backend zawsze da się zweryfikować deterministycznie przez
`curl`; UI ostatecznie weryfikuj na fizycznym urządzeniu (`devicectl`),
tak jak w tej i poprzednich sesjach.

**Bierzemy partię 2 — siatki wielokolumnowe.** Dziś Pulpit/Statystyki to
jedna rozciągnięta kolumna na całej szerokości iPada, mimo dużo miejsca
w poziomie (te same widoki co iPhone, bez adaptacji do szerokiego ekranu).
Zakres do ustalenia z właścicielem na starcie — m.in.: które sekcje
Pulpitu/Statystyk dostają siatkę (karty KPI? sekcje z listami?), ile
kolumn i przy jakiej szerokości się przełącza (por. próg 760pt już użyty
w `LeadyPanelIpad`/`ProjektyPanelIpad`/`KlienciPanelIpad` dla układu
dwupanelowego), czy to ma być `LazyVGrid` czy coś bardziej złożonego.

Reszta kolejki (bez zmian):
3. Drag & drop.
4. Drobiazgi: pole szukania w liście za bardzo w prawo; FAB w wąskim
   wariancie iPada jest w pasku (toolbar), nie jako FAB.

Osobno, poza kolejką: tłumaczenie maili (Ollama, lokalny model) — wymaga
własnego briefu backendowego (nowa trasa panelu), odłożone świadomie jako
osobny temat.

Zacznij od potwierdzenia zakresu partii 2 z właścicielem (pytania wyżej),
sprawdź `git status`/`git log` PRZED rozpoczęciem pracy (patrz ostrzeżenie
o równoległych sesjach), i pracuj metodą tego projektu: mała paczka →
build → weryfikacja (backend `curl`, UI na fizycznym urządzeniu) →
wgranie na oba urządzenia → ocena właściciela → commit+push.
