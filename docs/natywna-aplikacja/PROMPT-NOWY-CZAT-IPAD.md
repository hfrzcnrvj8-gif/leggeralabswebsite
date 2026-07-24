# Prompt do wklejenia w nowym czacie

Kontynuujemy dopracowanie aplikacji natywnej Leggera Hub na **iPada** (repo apki:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`, panel: bieżące repo strony).

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/natywna-aplikacja/33-brief-drag-and-drop.md` (brief tej sesji —
  cztery kandydaci na „drag & drop", stan zmierzony w kodzie, ostrzeżenie
  techniczne o ryzyku crasha — przeczytaj PRZED kodowaniem),
- `docs/natywna-aplikacja/32-wynik-siatka-kpi-i-naprawa-crasha-splitu.md`
  (partia 2: siatka KPI + złapany i naprawiony crash `LazyVGrid` w `List`
  przy przeciąganiu paska bocznego — ta sama rodzina ryzyka co drag & drop),
- `docs/natywna-aplikacja/31-wynik-skroty-i-notatnik-naprawy.md` (partia 1:
  skróty klawiaturowe + naprawy Notatnika/Pencila),
- `docs/natywna-aplikacja/22-ipad-hybryda-i-adaptacyjny.md` (fundament:
  hybryda, adaptacyjny układ, sedno techniczne),
- pamięć: `apka-ipad-pelny-desktop-hybryda`, `apka-ipad-szkielet-adaptacyjny`,
  `apka-ipad-partie-1-3`, `ipad-lazygrid-w-liscie-crash-splitu` (WAŻNE —
  drag & drop to ta sama rodzina crasha co siatka KPI), `ipad-devicectl-trust-friction`,
  `rownolegle-sesje-git-kolizja` (patrz niżej — sprawdzaj zawsze na starcie).

**Stan:** iPad ma działać jak pełny komputer w terenie. Zrobione i
scommitowane: partia 1 (skróty klawiaturowe ⌘1–5/⌘F/⌘N/⌘K + moduł Apple
Pencil w Notatniku), partia 2 (siatka kart KPI na Pulpicie/Statystykach na
szerokim iPadzie, ≥760pt/2 kolumny). Partia 2 złapała po drodze crash
niezwiązany z pierwotnym planem: `LazyVGrid` wewnątrz wiersza `List` na
iPadzie wywalał apkę przy interaktywnym przeciąganiu paska bocznego
(`NavigationSplitView`) — naprawione przez ręczny `HStack`/`VStack` ZE
STAŁĄ liczbą wierszy `List` niezależnie od szerokości. Pełny opis i
diagnoza (jak ściągnąć i czytać crash log z `devicectl`) w `32-wynik-*.md`
i pamięci `ipad-lazygrid-w-liscie-crash-splitu`.

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
w `PanelBoczny.swift`). Zapisany PNG w skali `UIScreen.main.scale` trzeba
wczytywać z TĄ SAMĄ jawną skalą (`UIImage(data:scale:)`), nigdy przez
`UIImage(contentsOfFile:)` (daje `scale = 1`, rozmiar wychodzi 2× za duży).
**Jakikolwiek widok, który reaguje na żywą geometrię/szerokość wewnątrz
`List` na iPadzie (siatki, drag & drop), trzymaj ZE STAŁĄ liczbą wierszy
`List`** — patrz `32-wynik-*.md` i `ipad-lazygrid-w-liscie-crash-splitu`,
to konkretna, powtarzalna pułapka, nie jednorazowy przypadek.

**Symulator bywał niestabilny w poprzednich sesjach** (logowanie gubiło stan
pola hasła, tapy przestawały trafiać) — jeśli nie masz potwierdzenia, że to
naprawione, nie ufaj zrzutom z symulatora bez zastrzeżeń. Backend zawsze da
się zweryfikować deterministycznie przez `curl`; UI ostatecznie weryfikuj na
fizycznym urządzeniu (`devicectl`). Mirroring w QuickTime (`Nowe nagranie
filmowe` → źródło „Ekran: iPad (Patryk)") pokazuje ekran żywo, ale NIE
przyjmuje dotyku — to tylko podgląd, nawigację robi właściciel ręcznie.

**Bierzemy partię 3 — Drag & drop.** Pierwotny zapis w roadmapie
(`22-*.md`) to jedno zdanie bez opisu — brief `33-brief-drag-and-drop.md`
rozbija to na CZTERY różne kandydatury (reorder kamieni/zadań w projekcie,
tablica kanban ze zmianą statusu, drag-to-reschedule w Kalendarzu,
systemowy drag & drop międzyaplikacyjny) z tabelą nakład/ryzyko i
rekomendacją zacząć od najmniejszego (reorder). **To pierwsze zadanie tego
czatu**: przejść tę tabelę z właścicielem i ustalić, co realnie bierzemy —
patrz brief po szczegóły i uzasadnienia.

Reszta kolejki (bez zmian):
4. Drobiazgi: pole szukania w liście za bardzo w prawo; FAB w wąskim
   wariancie iPada jest w pasku (toolbar), nie jako FAB.

Osobno, poza kolejką: tłumaczenie maili (Ollama, lokalny model) — wymaga
własnego briefu backendowego (nowa trasa panelu), odłożone świadomie jako
osobny temat.

Zacznij od potwierdzenia zakresu partii 3 z właścicielem (tabela w
`33-brief-drag-and-drop.md`), sprawdź `git status`/`git log` PRZED
rozpoczęciem pracy (patrz ostrzeżenie o równoległych sesjach), i pracuj
metodą tego projektu: mała paczka → build → weryfikacja (backend `curl`,
UI na fizycznym urządzeniu) → wgranie na oba urządzenia → ocena
właściciela → commit+push.
