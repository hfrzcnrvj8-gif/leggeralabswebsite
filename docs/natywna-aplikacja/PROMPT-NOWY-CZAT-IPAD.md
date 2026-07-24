# Prompt do wklejenia w nowym czacie

Kontynuujemy dopracowanie aplikacji natywnej Leggera Hub na **iPada** (repo apki:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`, panel: bieżące repo strony).

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/natywna-aplikacja/30-wynik-poczta-apple-mail-i-apple-pencil.md`
  (najnowszy stan, pułapki złapane, mapa plików — czytaj TEN, nie 29),
- `docs/natywna-aplikacja/29-wynik-partie-1-3-skroty-tydzien-rok.md`
  (partie 1-3: skróty, tydzień, Rok — sprzed poprzedniej sesji),
- `docs/natywna-aplikacja/22-ipad-hybryda-i-adaptacyjny.md` (fundament:
  hybryda, adaptacyjny układ, sedno techniczne),
- pamięć: `apka-ipad-pelny-desktop-hybryda`, `apka-ipad-szkielet-adaptacyjny`,
  `apka-ipad-partie-1-3`, `ipad-devicectl-trust-friction`.

**Stan:** iPad ma działać jak pełny komputer w terenie. Od tej sesji dodatkowo
zbudowane i wgrane na oba fizyczne urządzenia (iPad + iPhone, Release):
**Poczta jak Apple Mail** (jawny górny pasek flaga/przekaż/przenieś na iPadzie,
„Powiąż" jako pierwszy slot dolnej pastylki na OBU platformach, eksport PDF
wiadomości, podsumowanie wątku AI — domknięta luka Modułu 49) oraz
**Apple Pencil** (kanwa PencilKit z pełnym paskiem narzędzi Apple w Notatniku,
zsynchronizowana z panelem; adnotacje na Ofertach/Umowach jako nowa notatka —
świadomie BEZ auto-powiązania klient/lead, bo `Oferta`/`Umowa` w apce nie mają
`client_id`). Szczegóły i uzasadnienia w `30-wynik-*.md`.

**Zasady krytyczne (z `22-*.md`, `29-*.md` i `30-*.md`):** na iPada buduj
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
jawny wymiar albo `.fixedSize(horizontal:vertical:)`.

**Symulator bywał niestabilny w poprzedniej sesji** (logowanie gubiło stan
pola hasła, tapy przestawały trafiać nawet na świeżym symulatorze) —
właściciel zlecił w tle osobną sesję ustabilizowania logowania w
symulatorze dev (`task_2228eff0`); sprawdź jej wynik, zanim zaufasz
zrzutom z symulatora bez zastrzeżeń. Backend zawsze da się zweryfikować
deterministycznie przez `curl` niezależnie od stanu symulatora.

**Następne partie (wybierz z właścicielem, sugestia — od góry, macOS
świadomie na koniec, poza tą kolejką):**
1. Skróty klawiaturowe (⌘N/⌘F/⌘1–5 nawigacja/akcje) — najmniejsza,
   najbardziej mechaniczna partia.
2. Siatki wielokolumnowe (Pulpit/Statystyki — dziś jedna rozciągnięta
   kolumna na całej szerokości iPada).
3. Drag & drop.
4. Drobiazgi: pole szukania w liście za bardzo w prawo; spójność FAB
   w wąskim wariancie.

Osobno, nie w tej kolejce: **tłumaczenie maili** (Ollama, lokalny model) —
wymaga własnego briefu backendowego (nowa trasa panelu), odłożone
świadomie jako osobny temat.

Zacznij od potwierdzenia, którą partię bierzemy, i pracuj metodą tego
projektu: mała paczka → build → weryfikacja (backend `curl`, UI na
fizycznym urządzeniu) → wgranie na oba urządzenia → ocena właściciela →
commit+push.
