# Prompt do nowego czatu — Moduł 50 (AI: szkic notatki z maila)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `50-ai-szkic-notatki.md`.)

---

Zbuduj Moduł 50 opisany w `docs/plany-modulow/50-ai-szkic-notatki.md`.
Najpierw przeczytaj ten brief **w całości** (jest bardziej otwarty niż
zwykle — więcej pytań do właściciela niż gotowej decyzji), plus
`docs/plany-modulow/26-notatnik.md` i `docs/AUDYT-7-WYNIKI.md` (punkt „b").
**Moduły 48 (kategoria kosztu) i 49 (podsumowanie wątku) są już zbudowane**
(2026-07-23) — traktuj `lib/costs-ocr.ts`+`CostEditor.tsx` i
`lib/mail-summary.ts`+`app/api/mail/[id]/summarize-thread/route.ts`+
`MailDetailPanel.tsx` jako ŻYWE wzorce do naśladowania (dokładniejsze niż
sam tekst briefów 07/49, bo to już działający, zweryfikowany kod w tym
repo) — nie zaczynaj wzorca od zera. **Zacznij od pytań właściciela z
sekcji „Otwarte decyzje" — zwłaszcza #1 (potwierdzenie, że v1 obsługuje
wyłącznie źródło „mail", nie „rozmowa telefoniczna")** — dopiero potem plan
i kod.

Uwagi, które oszczędzą Ci czasu:

* **Nie ma dziś transkrypcji rozmów telefonicznych** — quick-log zapisuje
  tekst wpisany ręcznie przez właściciela, nie nagranie. „Szkic notatki z
  rozmowy" bez tego źródła to w praktyce co innego niż „streszczenie" —
  brief rekomenduje zawężenie do maila (gotowa treść: `mail_messages.body_text`).
* Notatki (`lib/notes.ts`) mają dziś `client_id`/`lead_id`, ale **brak pola
  „źródło"** — czy dodawać `source_mail_id` to osobna decyzja właściciela
  (brief, Krok 1 i „Otwarte decyzje" #2).
* Zapis następuje **wyłącznie po ręcznym zatwierdzeniu** przez
  `POST /api/notes` (istniejący endpoint) — model generuje tylko szkic.
* Guardrail lokalnego Ollamy jak wszędzie: `raw == null` → `503` + polski
  komunikat, ręczne dodawanie notatek dalej działa.
* `npx tsc --noEmit -p tsconfig.json` po zmianach, zweryfikuj na dev (mail
  dopięty do klienta i mail bez powiązania — oba przypadki).

Po zakończeniu zaktualizuj `HUB_SETUP.md` i `CLAUDE.md` → „Świadome decyzje
produktowe" (zmień status punktu „b" na „zbudowane" — sprawdź, czy status
„a"/"c" tam zapisany zgadza się ze stanem faktycznym, mogły się zmienić
między czatami). To **ostatni** z trzech briefów AI z Audytu 7 — po nim
całe rozszerzenie z Audytu 7 jest domknięte.
