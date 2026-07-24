# Prompt do wklejenia w nowym czacie

Kontynuujemy dopracowanie aplikacji natywnej Leggera Hub na **iPada** (repo apki:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`, panel: bieżące repo strony).

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/natywna-aplikacja/29-wynik-partie-1-3-skroty-tydzien-rok.md` (najnowszy stan,
  pułapki złapane, mapa plików — czytaj TEN, nie 22),
- `docs/natywna-aplikacja/22-ipad-hybryda-i-adaptacyjny.md` (fundament: hybryda,
  adaptacyjny układ, sedno techniczne sprzed partii 1-3),
- pamięć: `apka-ipad-pelny-desktop-hybryda`, `apka-ipad-szkielet-adaptacyjny`,
  `apka-ipad-partie-1-3`, `ipad-devicectl-trust-friction`.

**Stan:** iPad ma działać jak pełny komputer w terenie. Zbudowane i wgrane na
fizycznego iPada (Release): panel boczny, adaptacyjny układ list-detail
(Leady/Projekty/Klienci — poziomo dwa panele, pionowo jedna kolumna, jak Apple
Mail), wbudowany pełny panel (Faktury/KSeF/Statystyki) przez mostek auth
`WKWebView`, podgląd dokumentów (oferty/umowy/faktury), FAB gradient-kontur,
Kalendarz z siatką godzin na poziomie tygodnia i widokiem Roku 1:1 ze wzorca
Apple (4 kolumny, skróty miesięcy, złote kółko na dziś), bez skrótów w
etykietach. Właściciel po ostatniej partii: zaakceptował widok Roku.

**Zasady krytyczne (z 22-*.md i 29-*.md):** na iPada buduj RELEASE; nie
zagnieżdżaj `NavigationSplitView`; wgrywanie CLI przez `devicectl` (device id
`3CCA9321-4215-5229-A506-C204CB802F37`); wariant `project-telefon.yml`; iPhone
NIE regresuj (ta sama apka, adaptuje układ). **Świeży install czasem wymaga
ponownego zaufania profilowi na urządzeniu** (patrz `ipad-devicectl-trust-
friction`) — nie rób kosmetycznego re-stampu wersji za każdą drobną poprawką,
tylko gdy i tak buduje się coś nowego do przetestowania. `Color`/`Rectangle`
bez podanej wysokości/szerokości na danej osi łapczywie zajmuje całą
zaproponowaną przestrzeń (złapane dwa razy: puste komórki siatki miesiąca,
gutter osi godzin w siatce tygodnia) — zawsze dawaj jawny wymiar albo
`.fixedSize(horizontal:vertical:)`.

**Następne partie (wybierz z właścicielem, sugestia — od góry):**
1. Poczta jak Apple Mail (przyciski funkcyjne: odpowiedz/przekaż/flaga/przenieś).
2. Apple Pencil (Scribble → kanwa PencilKit w notatkach → adnotacje na dokumentach).
3. Skróty klawiaturowe (⌘N/⌘F/⌘1–5).
4. Siatki wielokolumnowe (Pulpit/Statystyki — dziś jedna rozciągnięta kolumna).
5. Drag & drop.
6. Drobiazgi: pole szukania w liście za bardzo w prawo; spójność FAB w wąskim wariancie.

Zacznij od potwierdzenia, którą partię bierzemy, i pracuj metodą tego projektu:
mała paczka → build → weryfikacja zrzutem (symulator, patrz skalowanie
współrzędnych tap w `29-*.md`) → wgranie na iPada → ocena właściciela → commit+push.
