# Moduł 50 — AI: szkic notatki z rozmowy/maila

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md`,
> `docs/AUDYT-7-WYNIKI.md` (punkt „b" — audyt już zasygnalizował, że ten
> punkt „wymaga źródła i ścieżki zapisu-po-zatwierdzeniu", w odróżnieniu od
> a/c), `docs/plany-modulow/26-notatnik.md` (Notatnik, Moduł 26) i
> `docs/plany-modulow/07-ai-szkice-mailowe.md`/`49-ai-podsumowanie-watku.md`
> (wzorce techniczne). Trzeci i ostatni z briefów Audytu 7 (kolejność
> c → a → **b** — celowo ostatni, bo jest jedynym z trójki, który wymaga
> nowej decyzji produktowej, nie tylko rozszerzenia gotowego przepływu).

## Ten brief jest inny niż 48/49 — więcej pytań niż gotowej decyzji

W przeciwieństwie do kategorii kosztu (rozszerza istniejący OCR) i
podsumowania wątku (rozszerza istniejące wątkowanie + ma gotowe dane),
„szkic notatki z rozmowy" **nie ma dziś gotowego źródła treści ani gotowej
ścieżki zapisu** — sprawdzone w kodzie, nie założone:

- **Telefonia/quick-log nie ma transkrypcji.** `QuickLogView.tsx` zapisuje
  `text` wpisany **ręcznie przez właściciela** (placeholder: „użyj mikrofonu
  na klawiaturze, żeby podyktować") do `lead_activity`/`client_activity` —
  **nie do `notes`**. Nie ma nagrania ani transkrypcji rozmowy, z której
  model mógłby coś streścić — jest tylko to, co właściciel i tak już sam
  napisał. AI mogłoby co najwyżej **rozwinąć/sformatować** ten krótki wpis w
  dłuższą notatkę — to inna, mniej wartościowa funkcja niż „streść mi
  rozmowę".
- **Webhook VoIP (Moduł 3) jest niepodłączony** („właściciel nie ma jeszcze
  konta VoIP") — nie ma dziś żadnego realnego źródła audio/tekstu połączeń.
- **Mail ma gotową treść** (`mail_messages.body_text`, ten sam kontekst co
  w Module 7/49) — to jedyne źródło, które dziś realnie istnieje i nadaje
  się do „szkicu notatki" bez dodatkowej infrastruktury.
- **Notatki (`lib/notes.ts`) mają już `client_id`/`lead_id`** (Moduł 22/26),
  ale **nie mają pola „źródło"** (skąd notatka pochodzi — z którego maila/
  wpisu na osi) — dziś schemat `notes` to `tytul, tresc, tagi, pinned,
  archived_at, client_id, lead_id, project_id, event_id`, nic więcej.
- **Nie ma dziś przycisku „Nowa notatka" poza `NotesDashboard.tsx`** —
  żeby szkic wylądował w notatce z prewypełnionym `client_id`/`lead_id`
  z poziomu maila albo osi kontaktu, trzeba dobudować punkt wejścia, który
  dziś nie istnieje niezależnie od AI.

## DECYZJA DO ZAPYTANIA: zawęzić v1 do źródła „mail", odłożyć „rozmowa telefoniczna"

Rekomendacja (do potwierdzenia z właścicielem, nie zakładaj bez pytania):
**v1 obsługuje tylko „szkic notatki z maila"** — ten sam wzorzec co Moduł 49
(treść maila + kontekst klienta → model → tekst), ale wynikiem jest **szkic
notatki do zapisania w Notatniku**, nie odpowiedź do wysłania. Ścieżka
„notatka z rozmowy telefonicznej" zostaje **świadomie odłożona** do czasu,
aż będzie z czego generować szkic (dyktowanie w quick-logu jest już dziś
tekstem wpisanym ręcznie — AI nie dodaje tu wartości „streszczenia z
niczego", tylko ewentualne rozwinięcie, co jest inną, mniejszą funkcją do
osobnego rozstrzygnięcia).

**Jeśli właściciel to potwierdzi**, nazwa funkcji w UI powinna to odzwierciedlać
(„Szkic notatki z maila", nie generyczne „Szkic notatki z rozmowy" — nie
obiecuj czegoś, czego panel jeszcze nie robi).

## Plan techniczny (wariant: źródło = mail)

### Krok 1 — czy notatka potrzebuje pola „źródło"?
Zapytaj właściciela: czy notatka utworzona ze szkicu maila powinna
pamiętać, z którego maila powstała (żeby dało się do niego wrócić)?
Jeśli tak: `ALTER TABLE notes ADD COLUMN IF NOT EXISTS source_mail_id UUID
REFERENCES mail_messages(id) ON DELETE SET NULL` (wzorem innych FK w
`lib/db.ts`, bramka migracji jak zawsze). Jeśli nie: pomiń ten krok, notatka
zostaje zwykłą notatką bez śladu pochodzenia — prościej, ale nie da się
później „wrócić do źródła" jednym kliknięciem.

### Krok 2 — `lib/note-draft.ts` (nowy, wzorem `lib/mail-draft.ts`)
- `NOTE_DRAFT_MODEL`, `NOTE_DRAFT_SYSTEM` (instrukcja: krótka notatka do
  CRM, po polsku, rzeczowa — nie treść maila przepisana, tylko **istota**:
  ustalenia, terminy, następne kroki, jeśli są w treści), `buildNoteDraftPrompt()`
  reużywający ten sam kontekst klienta co `mail-draft.ts:15-20`
  (`MailDraftClientContext`).

### Krok 3 — endpoint
- `POST /api/mail/[id]/draft-note` (admin-only, `runtime = "nodejs"`) —
  reużywa zapytanie o mail + kontekst klienta z `draft-reply/route.ts`
  (linie ~26-34), woła `ollamaGenerate()`, zwraca `{ draft: string }` albo
  `503` przy niedostępności modelu (ten sam kontrakt co wszędzie indziej).

### Krok 4 — UI: `MailDetailPanel.tsx`
- Przycisk „Szkic notatki" obok „✨ Zaproponuj szkic" / „Podsumuj wątek".
  Klik → `POST .../draft-note` → **nie wypełnia pola odpowiedzi** — otwiera
  mały formularz/modal z proponowaną treścią notatki, edytowalny, z
  prewypełnionym `client_id`/`lead_id` z powiązania maila (jeśli mail jest
  dopięty do klienta/leada — jeśli nie, notatka zostaje bez powiązania,
  jak dziś w `NotesDashboard.tsx`).
- Zatwierdzenie → `POST /api/notes` (istniejący endpoint, bez zmian) z
  treścią (ew. `source_mail_id`, jeśli Krok 1 wybrał „tak"). **Zapis
  następuje wyłącznie po kliknięciu „Zapisz notatkę"** — model nigdy nie
  tworzy notatki sam.

### Krok 5 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: mail dopięty do klienta → „Szkic notatki" → sensowna, krótka treść
  → edycja → zapis → notatka widoczna w Notatniku (i na osi klienta, jeśli
  Moduł 30 to tam pokazuje). Mail bez powiązania → szkic i zapis działają,
  notatka bez `client_id`/`lead_id`, jak ręczne dodawanie dziś. Wyłącz
  Ollamę → kontrolowany komunikat, ręczne dodawanie notatki działa
  normalnie.

## Otwarte decyzje (zapytaj właściciela — WIĘCEJ niż zwykle, to najbardziej otwarty z trójki)

1. **Potwierdzenie zawężenia do źródła „mail"** — czy to akceptowalny zakres
   v1, czy właściciel jednak chce ścieżkę „z rozmowy telefonicznej" mimo
   braku transkrypcji (wtedy funkcja to raczej „rozwiń mój wpis w
   quick-logu", nie „streść rozmowę" — inna obietnica, do jasnego nazwania).
2. **Pole `source_mail_id`** (Krok 1) — czy warto, czy to zbędna złożoność
   na start.
3. **Gdzie ląduje UI szkicu** — mały modal w `MailDetailPanel.tsx` (jak wyżej),
   czy pełny przeskok do Notatnika z prewypełnionym polem? Modal jest mniej
   kroków, ale Notatnik ma już swój edytor (`EditableTextarea` z Modułu 26) —
   do rozstrzygnięcia, żeby nie budować drugiego, równoległego edytora
   notatek.
4. **Czy notatka ze szkicu ma jakiś tag/oznaczenie** („z AI"), żeby
   właściciel later widział, które notatki powstały tą ścieżką? Zero-AI
   dotąd nie miało takiego rozróżnienia (notatka to notatka) — do
   potwierdzenia, czy to potrzebne, czy nadmiarowe.

## Definicja ukończenia

- „Szkic notatki" przy mailu (dopiętym lub nie do klienta/leada) daje
  krótką, rzeczową, edytowalną propozycję treści notatki.
- Notatka zapisuje się w Notatniku wyłącznie po ręcznym zatwierdzeniu —
  model nigdy nie zapisuje sam.
- Niedostępność modelu nie blokuje ręcznego dodawania notatek jak dziś.
- Ścieżka „notatka z rozmowy telefonicznej" jest jasno udokumentowana jako
  **poza zakresem v1** (albo zbudowana, jeśli właściciel w Otwartej decyzji
  #1 zdecyduje inaczej) — nie cichy brak, tylko świadome odłożenie z
  powodem zapisanym tutaj.
- `tsc` czysty, zweryfikowane na dev, `HUB_SETUP.md` zaktualizowany.
- **`CLAUDE.md` → „Świadome decyzje produktowe"**: zdanie „Nie rozszerzaj
  tego wyjątku na inne miejsca bez wyraźnej prośby" przy regule AI jest już
  nieaktualne od 2026-07-23 (Audyt 7) — zaktualizowane w tej samej sesji, w
  której napisano wszystkie trzy briefy (48/49/50), więc ten krok jest już
  zrobiony i nie trzeba go powtarzać przy budowie tego modułu — sprawdź
  tylko, czy status a/c w tym akapicie zgadza się ze stanem faktycznym
  (zbudowane/niezbudowane) w chwili, gdy realizujesz ten brief.
