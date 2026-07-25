# Prompt do wklejenia w nowym czacie

Budujemy **Moduł 52 — „Łowca leadów"** (generator leadów, który przesiewa
zamiast zasypywać).

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/plany-modulow/52-generator-leadow.md` — cały brief. Sekcja „Decyzje
  właściciela — ROZSTRZYGNIĘTE 2026-07-25" jest zamknięta: **nie pytaj o nią
  ponownie** (zakres = CEIDG + biała lista MF + strony firm; automat = dzienny
  cron do skrzynki, z przyciskiem „Poluj teraz" obok; obszar = Mazowsze;
  lokalny model TYLKO po przyjęciu kandydata, sito bez AI).
- `CLAUDE.md` — zasady projektu, w szczególności bramka migracji
  (`schemaUpToDate`/`markSchemaApplied`), `inMigration()` dla nie-DDL w
  migracji, oraz to, że właściciel nie programuje.
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → „Stan po module Leady" —
  skąd ten moduł się wziął i dlaczego kandydat NIE jest leadem.

**Stan wejściowy:** brief napisany, decyzje podjęte, **zero kodu**. Panel i
apka (`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`) czyste i
zsynchronizowane z originem.

**Blokada częściowa:** `CEIDG_TOKEN` zakłada właściciel (Biznes.gov.pl →
dane.biznes.gov.pl → klucz mailem → zmienna w Vercelu). Zapytaj na wejściu,
czy token już jest:
- **jest** → buduj cały potok i przejedź jedno polowanie na
  `test-dane.biznes.gov.pl`, potem na produkcji;
- **nie ma** → buduj wszystko, co go nie potrzebuje (tabele, `lib/leadHunter.ts`
  z sitem + testy `npm test`, skrzynka kandydatów w panelu i w apce, cron ze
  ślepym przebiegiem), a etapy E1/E2 zweryfikuj na sztucznych danych w
  dev-bazie (PGlite) i oznacz jasno, co zostało do potwierdzenia na żywo.

**Kolejność, którą proponuję** (zmień, jeśli widzisz lepszą — uzasadnij):
1. Tabele (`lead_hunts`, `lead_candidates`, `lead_blacklist`) w
   `ensureHubSchema()` z bramką migracji + seed jednego polowania w dev-bazie.
2. `lib/leadHunter.ts` — dyskwalifikatory, wagi, progi A/B/C, uzasadnienia.
   **Testy od razu** (`node --test` + `tsx`, jak w Audycie 6): to czysta reguła
   biznesowa, dokładnie ta kategoria, dla której wprowadziliśmy testy.
3. Klient CEIDG (`lib/ceidg.ts`) z **licznikiem żądań w BAZIE** (nie w pamięci
   procesu — Vercel ubija instancję; limity 50/3 min i 1000/60 min, odstęp
   ≥3,6 s, 180 s blokady liczonej od ostatniego żądania).
4. Potok E1–E4 jako jedno wywołanie z twardym stopem ~240 s i kursorem
   (`POST /api/leads/hunt/run`, `CRON_SECRET`) + „Poluj teraz" w panelu.
5. Skrzynka kandydatów: panel (zakładka „Kandydaci (N)" w `/admin/leads`) i
   apka (lista + swipe „Weź"/„Odrzuć" + to samo w menu przytrzymania).
   „Weź" tworzy leada ze `zrodlo_kategoria = "Automatyczne wyszukiwanie"`,
   nazwą polowania i oceną w `zrodlo`, sygnałami w notatce.
6. Zaczepka z Ollamy po przyjęciu kandydata (wzorem Modułów 7/8/48–50).
7. Liczniki pętli poprawy: konwersja per ocena łowcy + top powodów odrzucenia.
8. RODO: retencja kandydatów 30 dni, czarna lista tylko NIP + nazwa + powód,
   zapisy do `docs/DO-PRAWNIKA-I-TLUMACZA.md`.

**Weryfikacja:** `npx tsc --noEmit -p tsconfig.json` + `npm test` (panel),
`xcodebuild` (apka; przy błędzie stempla uruchom `Skrypty/stempel-wersji.sh`),
podgląd na żywo (`preview_start name:"dev"`), symulator z
`SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny` + `SIMCTL_CHILD_LEGGERA_DEV_TOKEN=dev`.
Na koniec commit + push obu repo i wgranie na fizyczne urządzenia
(iPhone `1F379FD8-EFA4-55F7-BDB6-7E9CC8B5BEBD`,
iPad `3CCA9321-4215-5229-A506-C204CB802F37`).

**Uwaga na koniec:** to moduł, który ma działać latami bez przebudowy. Jeśli w
trakcie budowy zobaczysz, że któraś decyzja z briefu nie da się utrzymać
(np. limity CEIDG nie pozwolą na sensowną porcję dzienną), powiedz to wprost i
zaproponuj poprawkę — nie obchodź problemu po cichu.
