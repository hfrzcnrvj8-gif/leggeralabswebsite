# Moduł 17 — Retencja i polecenia

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Etap 10 — Retencja i polecenia". Ten moduł **zamyka pętlę** całej mapy
> drogi klienta — zadowolony klient wraca jako nowy lead.

## Kontekst (żeby nie zaczynać od zera)

Relacja z klientem nie kończy się na zapłaconej fakturze. Firmy postrzegane
jako premium nie znikają po zakończeniu projektu — zaplanowany kontakt
2-3 miesiące później ("jak działa wdrożenie? potrzebujecie czegoś
jeszcze?") regularnie generuje kolejne zlecenia i polecenia. Kategoria
źródła leada "Polecenie" **już istnieje** w systemie
(`SOURCE_CATEGORIES`, `lib/leads.ts:114-123`) — ten moduł domyka pętlę,
żeby faktycznie było co do niej wpisywać.

## Stan faktyczny (co już jest — nie budować od zera)

**WAŻNE — zaktualizowane 2026-07-15, po audycie kodu przy okazji Modułu
15**: mechanizm automatycznego przypominania o kontakcie z klientem PO
zamknięciu projektu **już istnieje i działa end-to-end** (zbudowany przy
okazji Modułu 2, ale dotyczy też etapu POzamknięciowego, nie tylko
leadów przed sprzedażą — poprzednia wersja tego briefu błędnie sugerowała,
że trzeba to dopiero zbadać/zbudować):

- **Wyzwalacz i zapis**: gdy status projektu zmienia się na zamknięty
  (`CLOSED_PROJECT_STATUSES`, dziś tylko "Wdrożone"),
  `app/api/projects/[id]/route.ts` (PATCH) wstawia do tabeli
  `client_followups` DWA wiersze wg `NURTURE_OFFSETS`
  (`lib/clients.ts`): **+14 dni** (`powod`: "kontakt kontrolny:
  referencja/opinia") i **+90 dni** (`powod`: "kontakt kontrolny: kolejna
  automatyzacja"). Idempotentnie (po `project_id`), loguje zdarzenie
  `nurture_scheduled` na osi klienta.
- **Odczyt i UI**: `GET /api/hub/today` zwraca `dueFollowups`
  (wymagalne i nieobsłużone — `due_date <= dziś AND done_at IS NULL`),
  pokazywane na Pulpicie w karcie "Klienci wymagający kontaktu" (wspólnie
  z ręcznie ustawionym `next_followup`), z tekstem `powodu` i przyciskiem
  "Obsłużone" (`PATCH /api/client-followups/[id]` ustawia `done_at`).
- **Wniosek**: wyzwalacz, przechowywanie, odczyt i oznaczanie-jako-
  zrobione są GOTOWE. Nie budować tego od nowa.

**Czego faktycznie dziś brakuje** (to jest realny zakres tego modułu):

1. **Szkic wiadomości** — `powod` to dziś tylko krótki tekst na
   Pulpicie ("kontakt kontrolny: referencja/opinia"/"...kolejna
   automatyzacja"), nie ma gotowego, edytowalnego tekstu do wysłania,
   w przeciwieństwie do onboardingu/zamknięcia projektu (Moduły 14/15,
   `buildOnboardingWelcomeMessage()`/`buildProjectClosingSummary()` w
   `lib/projects.ts` — wzór do naśladowania: panel generuje szkic,
   właściciel edytuje i wysyła, nigdy automatycznie).
2. **Pytanie o polecenie** — nigdzie dziś nie ma miejsca, żeby o nie
   poprosić.
3. `client_events`/`logClientEvent()` — istnieje, gotowe do zapisania
   zdarzenia "kontakt retencyjny wykonany"/"zapytano o polecenie" itp.
4. `zrodlo_kategoria` na leadzie (`SOURCE_CATEGORIES`,
   `lib/leads.ts:114-123`) już ma kategorię "Polecenie" i każdy lead ją
   zapisuje — ale ZERO miejsca w kodzie dziś to agreguje/liczy (nie
   Pulpit, nie raport, nigdzie).

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Treść kontaktu retencyjnego** — czy panel podpowiada gotowy szablon
   wiadomości (wzorem Modułów 14/15), czy zostaje całkowicie w gestii
   właściciela? Jeśli szablon — jeden uniwersalny, czy osobny na +14
   (opinia/referencja — uwaga: to się teraz **częściowo pokrywa z
   Modułem 15**, który już ma własny mechanizm proszenia o opinię; do
   ustalenia z właścicielem, czy +14 z tego modułu ma być tym samym
   krokiem, czy odrębnym) i osobny na +90 (kolejna propozycja)?
2. **Pytanie o polecenie** — osobny krok/podpowiedź, czy wpisane w treść
   wiadomości retencyjnej (prawdopodobnie tej z +90 dni, gdy relacja już
   dojrzała)?
3. **Widoczność na Pulpicie** — dziś kontakty retencyjne są w tej samej
   karcie co przeterminowani klienci ("Klienci wymagający kontaktu").
   Wystarczy, czy właściciel chce je jakoś wyróżnić (osobna sekcja/inna
   ikona), żeby odróżnić "klient milczy" od "zaplanowany rutynowy
   kontakt"?
4. **Licznik poleceń** — budować teraz w tym module (mały wskaźnik przy
   Klientach/Leadach), czy świadomie zostawić do Modułu 18 (Pulpit:
   wskaźniki), jak sugerował oryginalny zakres tej mapy?

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki.
- Zero AI/LLM w logice.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

Zaktualizowana po audycie: mechanizm przypominania już istnieje i działa,
więc nie jest częścią definicji ukończenia. Minimum na koniec tego
modułu: kontakt retencyjny (+14/+90 dni) ma gotowy, edytowalny szkic
wiadomości (wzorem Modułu 14/15) zamiast pustego `powodu` do wypełnienia
od zera, jest w nim miejsce na pytanie o polecenie, a właściciel wie
(odpowiedź na pytanie 4), czy licznik poleceń wchodzi w zakres tego
modułu.
