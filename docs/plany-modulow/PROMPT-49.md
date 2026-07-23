# Prompt do nowego czatu — Moduł 49 (AI: podsumowanie wątku poczty)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `49-ai-podsumowanie-watku.md`.)

---

Zbuduj Moduł 49 opisany w `docs/plany-modulow/49-ai-podsumowanie-watku.md`.
Najpierw przeczytaj ten brief, `docs/plany-modulow/07-ai-szkice-mailowe.md`
(wzorzec do naśladowania — ten sam endpoint-kształt i ten sam komponent UI,
inny tekst wynikowy), oraz `docs/AUDYT-7-WYNIKI.md` (punkt „a"). Potem
zaproponuj plan, dopiero potem działaj. **Zalecane, żeby Moduł 48 (kategoria
kosztu) był już zbudowany** — nie jest twardą zależnością techniczną, ale to
kolejność ustalona w audycie (c → a → b).

Uwagi, które oszczędzą Ci czasu:

* `GET /api/mail/[id]` zwraca dziś `thread`, ale **tylko metadane, bez
  `body_text`** — nowy endpoint `summarize-thread` musi dociągnąć treść
  osobnym zapytaniem po `thread_id`, nie rozszerzać tego GET-a.
* Wzorzec endpointu generującego tekst przez Ollamę: skopiuj szkielet
  `app/api/mail/[id]/draft-reply/route.ts` (Moduł 7) niemal 1:1.
* To **tylko czytanie** — wynik w readonly bloku w `MailDetailPanel.tsx`,
  NIE w edytowalnym polu odpowiedzi (`replyText`). Model niczego nie
  wysyła, niczego nie zapisuje w bazie.
* Przycisk widoczny tylko gdy `thread.length > 0` (pasek wątku już dziś
  renderuje się na tym samym warunku).
* Guardrail lokalnego Ollamy jak wszędzie: `raw == null` → `503` + polski
  komunikat.
* `npx tsc --noEmit -p tsconfig.json` po zmianach, zweryfikuj na dev na
  realnym wieloetapowym wątku, nie tylko kompilacją.

Po zakończeniu zaktualizuj `HUB_SETUP.md` (nowa podsekcja przy Module 4b/7)
i `CLAUDE.md` → „Świadome decyzje produktowe" (zmień status punktu „a" na
„zbudowane"). Jeden moduł = jeden czat — nie wchodź w Moduł 50 (szkic
notatki) w tej samej sesji.
