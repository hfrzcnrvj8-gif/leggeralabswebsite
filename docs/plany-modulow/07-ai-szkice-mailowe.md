# Moduł 7 — AI: szkice odpowiedzi mailowych (dodatek do Modułu 4)

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md` i
> **`docs/plany-modulow/06-ai-infrastruktura-ollama.md`** (fundament — musi być
> zbudowany i działać PRZED tym modułem) oraz
> **`docs/plany-modulow/04-skrzynka-mailowa.md`** (musi istnieć skrzynka
> mailowa w panelu — bez niej nie ma czego "szkicować").

## Problem (nietechnicznie)

Moduł 4 (poczta) daje wgląd w maile i możliwość odpowiedzi z panelu, ale
pisanie każdej odpowiedzi od zera to wciąż czas. Krótki, kontekstowy szkic
("dziękuję za wiadomość, potwierdzam termin X, w razie pytań piszcie") jako
punkt startowy — do poprawienia, nie do wysłania jednym klikiem — realnie
przyspiesza codzienną korespondencję.

## DECYZJA: szkic do edycji, NIGDY auto-wysyłka

Zgodnie z filozofią całego panelu ("miękko, nigdy za właściciela"): przycisk
**"Zaproponuj szkic"** w widoku odpowiadania na maila (Moduł 4) wypełnia pole
treści proponowanym tekstem — właściciel go czyta, poprawia, dopiero wtedy
klika "Wyślij". Model nigdy nie wysyła nic sam. To zmienia wcześniejszą
decyzję "Zero AI" z briefu Modułu 4 — świadomie, na wyraźną prośbę
właściciela (2026-07-14), i tylko w tym jednym, punktowym miejscu (generowanie
tekstu do wysyłki), NIE w logice dopasowania/kolejkowania maili (to zostaje
deterministyczne, jak było).

**Model:** lokalny przez `lib/ollama.ts` (Moduł 6). Rekomendacja: model
średniej wielkości z dobrą jakością pisania po polsku (do ustalenia z
właścicielem które ma pobrane/przetestowane na Macu — jakość polskiego tekstu
mocno zależy od modelu).

## Kontekst przekazywany do modelu (żeby szkic był trafny, nie generyczny)

Prompt składa się z (wszystko deterministycznie zebrane przez kod, model
dostaje gotowy kontekst, nie grzebie sam w bazie):
- Treść maila, na który odpowiadamy (`mail_messages.body_text`).
- Krótki kontekst klienta/leada, jeśli mail jest dopięty: nazwa firmy,
  branża, status, ewentualnie ostatnia notatka z osi kontaktu.
- Instrukcja systemowa: ton (rzeczowy, uprzejmy, po polsku), długość (krótko),
  podpis właściciela, **jawny zakaz zmyślania faktów** (dat/kwot/ustaleń,
  których nie ma w dostarczonym kontekście — model ma prosić o dopisanie
  szczegółu, a nie zgadywać).

## Plan techniczny

### Krok 1 — endpoint szkicu
- `POST /api/mail/[id]/draft-reply` (admin-only, `runtime = "nodejs"`):
  zbiera kontekst (mail + ew. klient/lead), buduje prompt, woła
  `ollamaGenerate()` (Moduł 6), zwraca `{ draft: string }` albo
  `{ error: "..." }` gdy model niedostępny (patrz fallback w Module 6).

### Krok 2 — UI
- W widoku odpowiadania na maila (Moduł 4, `MailThread`/`ReplyBox` czy jak
  się ostatecznie nazwie): przycisk "✨ Zaproponuj szkic" obok pola treści.
  Klik → `POST .../draft-reply` → wypełnia `<textarea>` proponowaną treścią
  (właściciel może dalej edytować normalnie, to zwykły tekst w polu, nie
  osobny "AI-only" tryb).
- Stan ładowania (kilka sekund — lokalny model to nie jest natychmiastowe)
  + czytelny komunikat przy niedostępności modelu (nie błąd-crash, tylko
  "Model AI chwilowo niedostępny — napisz ręcznie").
- Nigdy nie blokuj przycisku "Wyślij", jeśli szkic się nie udał — to zawsze
  dodatek.

### Krok 3 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: zamockowany/przykładowy mail → klik "Zaproponuj szkic" → sensowna
  treść w polu. Wyłącz Ollamę → sprawdź komunikat o niedostępności, reszta
  panelu (w tym ręczne pisanie i wysyłka) działa normalnie.

## Otwarte decyzje (zapytaj właściciela)
1. **Który model** z Ollamy do tego zadania (jakość polskiego, szybkość).
2. **Ton/długość domyślna** szkicu — do dopracowania na żywych przykładach
   z prawdziwej korespondencji właściciela.
3. Czy szkic ma uwzględniać też **historię wcześniejszej korespondencji** z
   tym klientem (dłuższy kontekst = lepszy szkic, ale więcej tokenów/wolniej).

## Definicja ukończenia
- Przycisk "Zaproponuj szkic" w widoku odpowiadania na maila generuje
  sensowny, edytowalny tekst po polsku, w kontekście maila i (jeśli dopięty)
  klienta.
- Wysyłka zawsze wymaga ręcznego kliknięcia "Wyślij" — model nigdy nie
  wysyła sam.
- Niedostępność modelu nie blokuje odpowiadania na maile.
- `tsc` czysty, zweryfikowane na dev, `HUB_SETUP.md` zaktualizowany.
