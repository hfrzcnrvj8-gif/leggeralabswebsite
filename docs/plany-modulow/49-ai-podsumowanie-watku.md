# Moduł 49 — AI: podsumowanie długiego wątku poczty

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md`,
> `docs/AUDYT-7-WYNIKI.md` (punkt „a"), **`docs/plany-modulow/06-ai-infrastruktura-ollama.md`**
> (fundament) i **`docs/plany-modulow/07-ai-szkice-mailowe.md`** (wzorzec do
> naśladowania 1:1 — ten sam endpoint-kształt, ten sam komponent UI, inny
> tekst wynikowy). Drugi z trzech briefów Audytu 7 (kolejność c → **a** → b).

## Problem (nietechnicznie)

Długi wątek mailowy (kilkanaście wiadomości tam i z powrotem) trzeba dziś
przeczytać od początku, żeby zorientować się „na czym stanęło". Pasek
wątku w `MailDetailPanel.tsx` (Moduł 4b) już dziś pokazuje listę wiadomości
wątku — **świadomie minimalnie**, tylko tyle, żeby zidentyfikować i
przeskoczyć (cytat z kodu: „pełny składany widok konwersacji to NIE jest
zakres tej rundy"). Streszczenie modelem to dokładnie ten brakujący krok:
jedno kliknięcie, żeby wiedzieć, o co chodzi w wątku, zanim się w niego
wejdzie — **tylko czytanie, model niczego nie wysyła ani nie zapisuje.**

## Co już istnieje i można ponownie użyć (zweryfikowane w kodzie)

- **Wątkowanie jest gotowe** (Moduł 4b): `mail_messages.thread_id`,
  dopasowanie po `References`/`In-Reply-To` z fallbackiem po temacie w
  oknie 35 dni (`resolveThreadId()`, `lib/mailSync.ts`).
- **`GET /api/mail/[id]/route.ts`** (linie ~55-71) zwraca dziś `thread` —
  ale **tylko metadane** wiadomości wątku (`subject`, `from_addr`,
  `kierunek`, `folder`, `status`, `received_at`), **bez `body_text`**.
  Podsumowanie potrzebuje treści — nowy endpoint musi dociągnąć
  `body_text` osobnym zapytaniem po `thread_id`, nie rozszerzać tego GET-a
  (który dziś celowo zwraca lekki obiekt do zwykłego podglądu paska wątku).
- **Wzorzec endpointu generującego tekst przez Ollamę już istnieje**:
  `app/api/mail/[id]/draft-reply/route.ts` (Moduł 7, 76 linii) — ten sam
  szkielet (`isAuthed()`, `runtime = "nodejs"`, `maxDuration`, własny
  `TIMEOUT_MS`, `ollamaGenerate()`, `raw == null → 503`) kopiuje się prawie
  1:1 do nowego endpointu, tylko zapytanie SQL i prompt są inne.
- **Wzorzec przycisku AI w `MailDetailPanel.tsx` już istnieje**:
  `requestDraft()` (stan `draftLoading`, wywołanie `POST .../draft-reply`,
  wypełnienie `replyText`) obok przycisku „✨ Zaproponuj szkic"
  (`IconSparkles`). Nowy przycisk „Podsumuj wątek" idzie tym samym torem —
  różnica: wynik trafia do **nowego, tylko-do-odczytu** stanu (np.
  `summary`), NIE do edytowalnego pola treści odpowiedzi (to podsumowanie
  do przeczytania, nie szkic do wysłania).

## DECYZJA: przycisk przy pasku wątku, wynik w readonly bloku, tylko gdy wątek ma ≥ 2 wiadomości

Przycisk „Podsumuj wątek" pojawia się **tylko gdy `thread.length > 0`**
(pasek wątku już dziś renderuje się warunkowo dokładnie na tym warunku —
`MailDetailPanel.tsx`, ok. linii 621-647) — jedna wiadomość bez odpowiedzi
nie ma czego streszczać. Klik → `POST /api/mail/[id]/summarize-thread` →
tekstowe podsumowanie w spokojnym, wyraźnie odróżnionym bloku (np. ramka z
ikoną, jak istniejące bloki „Model AI niedostępny") — **nie edytowalne, nie
kopiowane automatycznie nigdzie**. Właściciel czyta i wraca do normalnej
pracy z mailem; jeśli chce coś z tego wkleić do odpowiedzi, robi to ręcznie
(zaznacz-kopiuj), model nie robi tego za niego.

## Kontekst przekazywany do modelu

- Wszystkie wiadomości wątku (macierzysta + `thread`), posortowane
  chronologicznie, z `body_text` każdej, `from_name`/`kierunek` (żeby model
  wiedział kto pisał — właściciel czy kontakt).
- Instrukcja systemowa: krótkie streszczenie po polsku (kilka zdań, nie
  przepisywanie wątku), skup się na **aktualnym stanie** rozmowy („na czym
  stanęło", jakie ustalenia/pytania są otwarte) — nie chronologiczna
  relacja punkt po punkcie.
- Ten sam jawny zakaz zmyślania faktów co w Module 7 (żadnych dat/kwot/
  ustaleń spoza treści wiadomości).

## Plan techniczny

### Krok 1 — `lib/mail-summary.ts` (nowy, wzorem `lib/mail-draft.ts`)
- `SUMMARY_MODEL`, `SUMMARY_SYSTEM` (instrukcja jak wyżej), `buildSummaryPrompt(messages)`
  składający wiadomości wątku w jeden prompt w kolejności chronologicznej.

### Krok 2 — `app/api/mail/[id]/summarize-thread/route.ts` (nowy)
- `isAuthed()`, `runtime = "nodejs"`, `maxDuration` dopasowany do długości
  wątku (dłuższy niż pojedynczy szkic — więcej tekstu do przetworzenia;
  ustal empirycznie na dev, `draft-reply` ma dziś ~60s jako punkt wyjścia).
- Zapytanie SQL: wszystkie wiadomości z tym samym `thread_id` (macierzysta +
  `thread`) z `body_text`, `ORDER BY received_at ASC`.
- `ollamaGenerate({ model, prompt, system, timeoutMs })` → `raw == null` →
  `503` z komunikatem „Model AI chwilowo niedostępny — przeczytaj wątek
  ręcznie"; inaczej `NextResponse.json({ summary: raw })`.

### Krok 3 — `MailDetailPanel.tsx`
- Przycisk „Podsumuj wątek" przy pasku wątku (obok/pod istniejącym
  warunkiem `thread.length > 0`, linie ~621-647).
- Stan `summaryLoading`/`summary` (analogicznie do `draftLoading`), readonly
  blok wyniku, czytelny komunikat błędu przy niedostępności modelu.
- Ten sam komponent obsługuje i panel podglądu (`MailDashboard.tsx`), i
  samodzielną podstronę (`app/[lang]/admin/mail/[id]/MailDetail.tsx`) — nowy
  przycisk pokrywa oba wejścia bez dodatkowej pracy.

### Krok 4 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: wątek z kilkoma wiadomościami (skorzystaj z dev-seedu albo realnej
  korespondencji, jeśli jest w dev-bazie) → „Podsumuj wątek" → sensowne
  streszczenie po polsku, nie halucynuje dat/kwot spoza treści. Wątek z
  jedną wiadomością → przycisk niewidoczny. Wyłącz Ollamę → kontrolowany
  komunikat, reszta panelu (czytanie, odpowiadanie) działa normalnie.

## Otwarte decyzje (zapytaj właściciela)

1. **Limit długości wątku** przekazywanego do modelu — bardzo długie wątki
   (kilkadziesiąt wiadomości) mogą przekroczyć rozsądny kontekst modelu;
   do ustalenia: ucinać najstarsze wiadomości, czy podsumowywać wszystko i
   zaakceptować dłuższy czas odpowiedzi.
2. **Czy podsumowanie ma być zapamiętane** (np. do czasu nowej wiadomości w
   wątku), czy generowane na żądanie za każdym kliknięciem? Rekomendacja:
   na żądanie, bez zapisu w bazie — to „tylko czytanie", zero nowego stanu
   trwałego, prościej i bezpieczniej (RODO — nic nowego nie ląduje w bazie
   poza tym, co i tak tam już jest).
3. **Który model** — czy ten sam co do szkiców (Moduł 7), czy inny lepiej
   radzący sobie ze streszczeniami dłuższego tekstu.

## Definicja ukończenia

- „Podsumuj wątek" przy wątku z ≥ 2 wiadomościami daje krótkie, trafne
  streszczenie po polsku w readonly bloku, bez zmyślonych faktów.
- Niedostępność modelu nie blokuje czytania/odpowiadania na maile.
- Model niczego nie wysyła i niczego nie zapisuje — czysta funkcja
  odczytowa.
- `tsc` czysty, zweryfikowane na dev na realnym wątku, `HUB_SETUP.md`
  zaktualizowany (nowa podsekcja przy Module 4b/7). `CLAUDE.md` → „Świadome
  decyzje produktowe" już wymienia ten punkt jako zdecydowany-lecz-
  niezbudowany (zaktualizowane 2026-07-23, gdy powstały wszystkie trzy
  briefy naraz) — po zbudowaniu zmień tam status z „decyzja" na
  „zbudowane", link do tego pliku zostaje.
