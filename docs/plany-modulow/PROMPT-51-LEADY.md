# Prompt do wklejenia w nowym czacie

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin,
repo bieżące) i apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`), moduł po module, w
kolejności lejka sprzedaży.

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` — pełny kontekst
  inicjatywy, co zrobione w poprzednim czacie (Pulpit: kolejność menu na
  wszystkich platformach, swipe/long-press na Pulpicie, dwie luki z mapy
  drogi klienta domknięte, brief Modułu 16 odświeżony) i pułapki tej sesji
  (kalibracja dotyku w symulatorze, stempel wersji, zaufanie profilowi).
- `docs/plany-modulow/00-mapa-drogi-klienta.md` — mapa etapów, żeby wiedzieć
  względem czego oceniać kompletność.
- `CLAUDE.md` — zasady projektu (właściciel nie programuje, pracuje wyłącznie
  przez Ciebie, kończy sesję `git commit && git push`).

**Teraz bierzemy moduł: Leady.**

Sprawdź i oceń (potem zaproponuj właścicielowi konkretne poprawki — nie
pytaj ogólnie "co zmienić"):

1. **Kolejność/nawigacja spójna między platformami** — panel
   (`/admin/leads`, Kanban+Tabela), iPhone (`LeadsListView.swift` +
   `LeadDetailView.swift`), iPad (`LeadyPanelIpad.swift`, trójkolumnowy
   split). Czy widoki mają te same statusy/pola/akcje.
2. **Czy moduł ma wszystko, co powinien mieć** — porównaj z
   `docs/plany-modulow/01-podpowiedzi-leadow.md`,
   `02-nurture-automatyczny.md`, `03-kanaly-kontaktu.md`, Moduł 11 (NDA).
   Wszystko to powinno być już zbudowane — sprawdź, czy faktycznie działa
   na KAŻDEJ platformie, nie tylko w panelu.
3. **Poziom premium (Linear/Things)** — czy `LeadsListView`/`LeadRow` na
   apce ma już swipe-to-resolve / long-press (wzorem tego, co dodaliśmy na
   Pulpicie w poprzednim czacie — `Znaczenie.zrobione`, kontekstowe menu z
   tą samą akcją co swipe) — jeśli nie, dodaj analogicznie. Sprawdź klikalność
   każdego wiersza, spójność kolorów statusu.
4. Skaner wizytówek (apka, tylko telefon — sensowne, nie oczekuj go na
   webie/iPadzie), import/duplikat-detekcja leadów.

**Metoda pracy** (jak w poprzednim czacie): zbadaj kod obu repo → zaproponuj
konkretne spostrzeżenia → po akceptacji wprowadź zmiany → `npx tsc --noEmit
-p tsconfig.json` (panel) / `xcodebuild` (apka) → weryfikacja wizualna
(panel: `preview_start name:"dev"`; apka: symulator z
`LEGGERA_DEV_BACKEND=lokalny` do iteracji, fizyczne urządzenie do oceny
końcowej) → commit + push obu repo → build + `devicectl` wgranie na
fizyczne iPhone (`1F379FD8-EFA4-55F7-BDB6-7E9CC8B5BEBD`) i iPad
(`3CCA9321-4215-5229-A506-C204CB802F37`) → ocena właściciela.

Zacznij od `git status`/`git log -5` w OBU repo, żeby potwierdzić stan
sprzed startu (poprzedni czat zostawił obie gałęzie czyste, zsynchronizowane
z originem).
