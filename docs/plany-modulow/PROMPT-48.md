# Prompt do nowego czatu — Moduł 48 (AI: kategoria kosztu)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `48-ai-kategoria-kosztu.md`.)

---

Zbuduj Moduł 48 opisany w `docs/plany-modulow/48-ai-kategoria-kosztu.md`.
Najpierw przeczytaj ten brief, `docs/plany-modulow/08-ai-ocr-koszty.md`
(fundament — to rozszerzenie już działającego OCR-u, nie nowy przepływ),
oraz `docs/AUDYT-7-WYNIKI.md` (punkt „c", skąd wzięła się ta decyzja). Potem
zaproponuj plan, dopiero potem działaj.

To pierwszy z trzech briefów AI z Audytu 7 (kolejność c → a → b, ten jest
„c" — najmniejszy). Rozszerza JSON, o który `lib/costs-ocr.ts` już dziś pyta
model przy odczycie paragonu, o pole `kategoria` — **żadnego nowego
endpointu**.

Uwagi, które oszczędzą Ci czasu:

* Zamknięta lista kategorii to `COST_CATEGORIES` w `lib/costs.ts` — model
  musi wybrać z niej, nie wymyślać własną (serwer i tak wymusi „Inne" przy
  czymkolwiek spoza listy — patrz `app/api/costs/[id]/route.ts`).
* Jest już **inna, deterministyczna** podpowiedź kategorii (`GET
  /api/costs/hints`, po historii NIP-u dostawcy) — nie duplikuj jej wizualnie,
  rozstrzygnij z właścicielem, która wygrywa, gdy obie istnieją (brief,
  „Otwarte decyzje" #1-2).
* Guardrail lokalnego Ollamy: `raw == null` (model niedostępny) → `503` +
  polski komunikat, formularz zostaje w pełni edytowalny — dokładnie jak
  reszta pól OCR dziś.
* `npx tsc --noEmit -p tsconfig.json` po zmianach, zweryfikuj na dev na
  realnym zdjęciu paragonu (`preview_start`), nie tylko kompilacją.

Po zakończeniu zaktualizuj `HUB_SETUP.md` (dopisek do sekcji Modułu 8) i
`CLAUDE.md` → „Świadome decyzje produktowe" (zmień status punktu „c" z
„zdecydowane, do zbudowania" na „zbudowane"). Jeden moduł = jeden czat — nie
wchodź w Moduł 49 (podsumowanie wątku) w tej samej sesji.
