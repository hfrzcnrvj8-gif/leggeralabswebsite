# Prompt do nowego czatu — Audyt 5 (wydajność i koszty)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `45-audyt-5-wydajnosc.md`.)

---

Przeprowadź Audyt 5 opisany w `docs/plany-modulow/45-audyt-5-wydajnosc.md`.
Najpierw przeczytaj ten brief, sekcję „Audyt 5" w `docs/AUDYTY-KONCOWE.md`, oraz
ustalenia poprzednich audytów: `docs/AUDYT-1-WYNIKI.md`, `docs/AUDYT-2-WYNIKI.md`,
`docs/AUDYT-3-WYNIKI.md`, `docs/AUDYT-4-WYNIKI.md`, `docs/AUDYT-6-WYNIKI.md` —
żeby nie diagnozować drugi raz tego, co już rozstrzygnięte. Potem zaproponuj
plan, dopiero potem działaj.

To Audyt 5 z kolejności wg ryzyka (4 ✅ → 1 ✅ → 3 ✅ → 2 ✅ → 6 ✅ → **5** → 7),
jeden audyt = jeden czat. Pytanie: **ile to kosztuje miesięcznie, zanim przyjdzie
pierwszy rachunek, i czy coś zbliża się do limitu, zanim się o niego uderzy.**

Uwagi, które oszczędzą Ci czasu:

* **Duża część tego audytu to LICZBY, których Claude nie zmierzy stąd** —
  rozmiar bazy, bieżące zużycie planów i ceny widzi właściciel w panelach
  Neon/Vercel/Resend/Apple. To pomiary + zebranie widełek, nie grep. Pytaj
  wprost, po polsku.
* **Zapytania i czas MIERZ uruchomieniem, nie szacuj z kodu.** Stan zastany
  (zmierzony 2026-07-23, zweryfikuj): Pulpit `/api/hub/today` = 9 `ensure*Schema`
  + 13 zapytań; dzienny cron `/api/leads/notify` = 11 + 23; `neon()` = 1 HTTP na
  zapytanie. Bramka migracji (2026-07-15) miała to ściąć — **sprawdź, czy nie
  odrosło**.
* **Trop `maxDuration`:** 15 tras je ustawia, w tym 2× 120 s i 1× 90 s — a plan
  Hobby tnie funkcje do 60 s. Rozstrzygnij, czy Vercel to honoruje, czy funkcje
  po cichu przekraczają limit (podejrzani: sync IMAP, załączniki, KSeF, OCR).
* **Nie optymalizuj na zapas.** Przy jednym użytkowniku i zerze klientów „za
  wolno/za drogo" może w ogóle nie istnieć — poprawnym wynikiem może być „nic
  nie rób, tylko wiedz, gdzie są progi i co wymusi Vercel Pro".
* **Zielony build/tsc nie jest dowodem** (zasada z pięciu audytów). Dowód to
  pomiar i uruchomienie. Jest `npm test` (Audyt 6) — jeśli ruszasz regułę,
  dopisz/uruchom test.
* Produkcyjna baza, panele dostawców i NAS — **poza zasięgiem Claude**; oznacz
  „⏳ do wykonania przez właściciela".

Główny produkt: `docs/AUDYT-5-WYNIKI.md` (wzorem poprzednich). Po zakończeniu
odhacz Audyt 5 w `AUDYTY-KONCOWE.md` i README, wskaż następny (**Audyt 7 — czy
to nadal jest ten produkt**), pozycje finansowe/porejestracyjne →
`PO_REJESTRACJI.md`. Jeden audyt = jeden czat, nie wchodź w Audyt 7.
