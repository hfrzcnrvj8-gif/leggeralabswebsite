# Prompt do wklejenia w nowym czacie — moduł KLIENCI

> Zaktualizowany 2026-07-25, po zbudowaniu Modułu 52 („Łowca leadów").
> Poprzednia wersja tego pliku powstała przed łowcą i nie znała jego lekcji.

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin, repo
bieżące) i apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`), moduł po module, w
kolejności lejka sprzedaży. **Pulpit i Leady są zrobione** — Leady domknięte
Modułem 52, który dołożył im „Łowcę leadów" (skrzynkę kandydatów).

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` — pełny kontekst
  inicjatywy oraz sekcje „Stan po module Pulpit" i „Stan po module Leady"
  (co już poprawione, jakie pułapki wyszły, co świadomie odłożone).
- `docs/plany-modulow/00-mapa-drogi-klienta.md` — mapa etapów, żeby wiedzieć
  względem czego oceniać kompletność.
- `HUB_SETUP.md` → sekcja „Moduł 52" — co dokładnie dostały Leady na koniec
  i jakie lekcje z tego wyszły (lista niżej).
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

## Cztery lekcje z Leadów, warte sprawdzenia u Klientów

Wszystkie cztery to **realne błędy złapane przy Modułach 51 i 52**, nie teoria:

1. **„Na sztywno" w kodzie cicho psuje wskaźniki.** U Leadów kategoria źródła
   była wpisywana na stałe na WSZYSTKICH ścieżkach tworzenia — dwie metryki
   lejka pokazywały przez to zero, bez żadnego objawu awarii. Sprawdź, czy
   któraś ścieżka tworzenia klienta (panel, apka, awans z leada, akceptacja
   oferty) nie wpisuje czegoś na sztywno w pole, po którym potem coś liczymy.
2. **Idempotencja i widoczny ślad.** U Leadów „Przygotuj NDA" nie miało ani
   jednego, ani drugiego: drugie kliknięcie robiło drugi dokument, a karta
   leada nie wiedziała, że NDA w ogóle istnieje. Każda akcja tworząca dokument
   z karty klienta (umowa, oferta, faktura, projekt) musi mieć oba.
3. **Dowód luki w apce to trasa panelu, której `APIClient.swift` nie woła** —
   grep po `/api/clients`. Odwrotnie NIE działa: „trasa niewołana" nie zawsze
   znaczy „funkcja niewidoczna" (bywa dostępna inną drogą).
4. **Kolor niesie znaczenie i łatwo go okłamać.** Przy Module 52 pierwszy
   komunikat o SUKCESIE w apce wyszedł w czerwonej ramce z trójkątem
   ostrzegawczym, bo kolejka komunikatów była kolejką awarii. Naprawione
   (`Komunikat.Rodzaj` = `.awaria` / `.sukces`, domyślnie `.awaria`) — ale
   **sprawdź, czy Klienci nie mają tego samego problemu**: udana akcja pokazana
   jak błąd albo dwa różne kolory na to samo znaczenie.

## Czego przy Klientach NIE ruszamy bez pytania

- **Retencja i podstawy RODO** — klienci świadomie NIE mają auto-usuwania
  (faktury: 5 lat obowiązku podatkowego, Audyt 2). Nie „naprawiaj" tego.
- **Rzeczy z `PO_REJESTRACJI.md`** — firma nie jest jeszcze zarejestrowana,
  więc braki prawne z tego pliku są świadomie odłożone, nie są defektem.

**Metoda pracy:** zbadaj kod obu repo → zaproponuj konkretne spostrzeżenia →
po akceptacji wprowadź zmiany → `npx tsc --noEmit -p tsconfig.json` + `npm test`
(panel) / `xcodebuild` (apka; **przy błędzie stempla uruchom
`Skrypty/stempel-wersji.sh`**, a po dodaniu nowego pliku `.swift` — `xcodegen
generate`) → weryfikacja wizualna (panel: `preview_start name:"dev"`; apka:
symulator z `SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny` +
`SIMCTL_CHILD_LEGGERA_DEV_TOKEN=dev`, plus `SIMCTL_CHILD_LEGGERA_DEV_OPEN_LEAD=1`
/ `LEGGERA_DEV_TAB=...` jako furtki bez dotyku) → commit + push obu repo →
build + `devicectl` na fizyczne iPhone (`1F379FD8-EFA4-55F7-BDB6-7E9CC8B5BEBD`)
i iPad (`3CCA9321-4215-5229-A506-C204CB802F37`) → ocena właściciela.

**Dwie uwagi o środowisku, świeże z Modułu 52:**
- Dev-baza (PGlite) jest **w pamięci** — restart `npm run dev` = świeży seed.
  Jeśli funkcji nie da się obejrzeć, bo brakuje wiersza, dopisz go do
  `ensureSeeded()` w `lib/dev-db.ts`, zamiast uznawać ekran za pusty.
- Zrzuty z podglądu przeglądarki potrafią pokazać **element, którego już nie ma
  w DOM** (artefakt narzędzia). Gdy zrzut kłóci się z pomiarem — rozstrzyga
  `getComputedStyle` / `getBoundingClientRect`, nie obrazek.

Zacznij od `git status` / `git log -5` w OBU repo (Moduł 52 zostawił obie
gałęzie czyste i zsynchronizowane z originem: panel `d12e611`, apka `dcbb6c9`).
