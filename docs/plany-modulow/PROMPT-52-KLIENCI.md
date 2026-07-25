# Prompt do wklejenia w nowym czacie

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin, repo
bieżące) i apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`), moduł po module, w
kolejności lejka sprzedaży. Pulpit i Leady są zrobione.

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` — pełny kontekst
  inicjatywy oraz sekcje „Stan po module Pulpit" i „Stan po module Leady"
  (co już poprawione, jakie pułapki wyszły, co świadomie odłożone).
- `docs/plany-modulow/00-mapa-drogi-klienta.md` — mapa etapów, żeby wiedzieć
  względem czego oceniać kompletność.
- `CLAUDE.md` — zasady projektu.

**Teraz bierzemy moduł: Klienci.**

Sprawdź i oceń (potem zaproponuj właścicielowi konkretne poprawki — nie pytaj
ogólnie „co zmienić"):

1. **Parytet między platformami** — panel (`/admin/clients`,
   `ClientsDashboard.tsx` + `ClientDetailPanel.tsx`), iPhone
   (`KlientDetailView.swift`, lista klientów), iPad (`KlienciPanelIpad.swift`).
   Te same statusy, pola, akcje, zakładki?
2. **Czy moduł ma wszystko, co powinien** — porównaj z Modułem 2 (nurture),
   14 (onboarding), 15 (zamknięcie i opinie), 17 (retencja i polecenia).
   Wszystko to jest zbudowane — sprawdź, czy działa na KAŻDEJ platformie.
3. **Poziom premium** — swipe/long-press na liście klientów (wzorem Leadów:
   `LeadKontekstMenu` + swipe „Obsłużone" z `Znaczenie.zrobione`), klikalność
   wierszy, spójność kolorów statusu, filtr w pasku.
4. **Rzeczy nauczone przy Leadach, warte sprawdzenia u Klientów:**
   - Czy któraś ścieżka tworzenia klienta wpisuje coś „na sztywno", co potem
     zasila wskaźnik (u Leadów tak było z kategorią źródła — dwie metryki
     pokazywały zero).
   - Czy akcje tworzące dokumenty (umowa, oferta, faktura z karty klienta) są
     idempotentne i czy zostawiają widoczny ślad na karcie (u Leadów NDA nie
     robiło ani jednego, ani drugiego).
   - Czy apka ma odpowiednik każdej akcji panelu — dowód luki to trasa panelu,
     której `APIClient.swift` nie woła (grep po `/api/clients`).

**Metoda pracy:** zbadaj kod obu repo → zaproponuj konkretne spostrzeżenia →
po akceptacji wprowadź zmiany → `npx tsc --noEmit -p tsconfig.json` + `npm test`
(panel) / `xcodebuild` (apka; przy błędzie stempla uruchom
`Skrypty/stempel-wersji.sh`) → weryfikacja wizualna (panel:
`preview_start name:"dev"`; apka: symulator z `SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny`
+ `SIMCTL_CHILD_LEGGERA_DEV_TOKEN=dev`, plus `SIMCTL_CHILD_LEGGERA_DEV_OPEN_LEAD=1`
/ `LEGGERA_DEV_TAB=...` jako furtki bez dotyku) → commit + push obu repo →
build + `devicectl` na fizyczne iPhone (`1F379FD8-EFA4-55F7-BDB6-7E9CC8B5BEBD`)
i iPad (`3CCA9321-4215-5229-A506-C204CB802F37`) → ocena właściciela.

Zacznij od `git status`/`git log -5` w OBU repo (moduł Leady zostawił obie
gałęzie czyste i zsynchronizowane z originem).
