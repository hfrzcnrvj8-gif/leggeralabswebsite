# Prompt do wklejenia w nowym czacie

Kontynuujemy dopracowanie aplikacji natywnej Leggera Hub na **iPada** (repo apki:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`, panel: bieżące repo strony).

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/natywna-aplikacja/22-ipad-hybryda-i-adaptacyjny.md` (pełny stan + sedno techniczne + mapa plików),
- pamięć: `apka-ipad-pelny-desktop-hybryda`, `apka-ipad-szkielet-adaptacyjny`.

**Stan:** iPad ma działać jak pełny komputer w terenie. Zbudowane i wgrane na
fizycznego iPada (Release): panel boczny, adaptacyjny układ list-detail
(Leady/Projekty/Klienci — poziomo dwa panele, pionowo jedna kolumna, jak Apple
Mail), wbudowany pełny panel (Faktury/KSeF/Statystyki) przez mostek auth
`WKWebView`, podgląd dokumentów (oferty/umowy/faktury), FAB gradient-kontur,
Kalendarz z wyższymi komórkami. Właściciel po ostatniej partii: „poki co wygląda
dobrze".

**Zasady krytyczne (z 22-*.md):** na iPada buduj RELEASE; nie zagnieżdżaj
`NavigationSplitView`; wgrywanie CLI przez `devicectl` (device id
`3CCA9321-4215-5229-A506-C204CB802F37`) po re-stemplowaniu wersji; wariant
`project-telefon.yml`; iPhone NIE regresuj (ta sama apka, adaptuje układ).

**Następne partie (wybierz z właścicielem, sugestia — od góry):**
1. Bez skrótów na iPadzie (globalny sweep etykiet, np. „tydz."→„tydzień").
2. Kalendarz — dopieszczenie Apple (poziom + wydarzenia jako paski w komórkach).
3. Poczta jak Apple Mail (przyciski funkcyjne).
4. Apple Pencil (Scribble → kanwa PencilKit w notatkach → adnotacje na dokumentach).
5. Skróty klawiaturowe (⌘N/⌘F/⌘1–5), siatki wielokolumnowe (Pulpit/Statystyki), drag&drop.
6. Drobiazgi: pole szukania w liście za bardzo w prawo; spójność FAB w wąskim wariancie.

Zacznij od potwierdzenia, którą partię bierzemy, i pracuj metodą tego projektu:
mała paczka → build → weryfikacja zrzutem → wgranie na iPada → ocena właściciela.
