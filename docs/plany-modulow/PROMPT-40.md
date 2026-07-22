# Prompt do nowego czatu — Moduł 40 (unieważnianie linków + białe listy pól)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `40-uniewaznianie-linkow.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/40-uniewaznianie-linkow.md`. Najpierw
przeczytaj ten plik, `CLAUDE.md` i `docs/AUDYT-1-WYNIKI.md` (ustalenia 5, 6
i 8 — stamtąd wziął się cały ten moduł), potem zaproponuj plan, dopiero potem
działaj.

To **domknięcie Audytu 1**, nie nowy pomysł. Audyt znalazł trzy rzeczy i dwie
z nich świadomie zostawił do zrobienia razem, bo dotykają tych samych pięciu
tras. Nie szukaj ich od nowa — są opisane, z numerami linii.

Uwagi, które oszczędzą Ci czasu:

* **Zakres jest przesądzony, decyzje właściciela już zapadły.** Tokeny
  **zostają wieczne** — automatyczne wygasanie zostało rozważone i odrzucone
  (faktura sprzed dwóch lat ma się dalej otwierać). Dochodzi ręczny przycisk
  „Unieważnij link". Nie wracaj do tej dyskusji.
* **Sześć zapytań, nie cztery.** Trzy z tych tras ZAPISUJĄ (`offers/…/accept`,
  `contracts/…/accept`, `projects/review/…/submit`). Unieważnienie blokujące
  tylko odczyt pozwalałoby dalej **podpisać umowę** starym linkiem — czyli
  byłoby połowiczne dokładnie tam, gdzie boli najbardziej.
* **Pułapka nr 1 — „Wygeneruj nowy" zwróci stary token.** Pięć funkcji
  `ensure*ShareToken()` (`lib/db.ts:1522+`) zaczyna się od
  `if (existingToken) return existingToken;`. Nowy token trzeba wpisać wprost
  `UPDATE`-em razem z wyzerowaniem `revoked_at`. Inaczej przycisk wygląda,
  jakby działał, i oddaje ten sam martwy link.
* **Pułapka nr 2 — strony publiczne re-używają komponentów wydruku z
  `/admin`.** `app/[lang]/faktura/[token]/page.tsx` importuje `InvoicePrint`,
  `umowa` i `nda` importują `ContractPrint`. Ten sam komponent działa w dwóch
  trybach (panel: pełny wiersz z `/api/invoices/[id]`; publicznie: token).
  Dlatego biała lista pól musi być wyprowadzona **z komponentu wydruku**, nie
  z typu w `lib/`. Pole pominięte przez pomyłkę **nie wywali błędu** — wydruk
  pokaże pustą rubrykę u klienta.
* **Nie kasuj tokenu przy unieważnianiu.** Pusty `share_token` jest
  nieodróżnialny od „nigdy nie wysłany", a kolejne „Wyślij" wygeneruje nowy
  i cicho przywróci dostęp. Od tego jest osobna kolumna `revoked_at`.
* **Bramka migracji obowiązuje** — każda zmiana schematu w istniejącej
  `create*Schema()`, ze `schemaUpToDate()` / `markSchemaApplied()`. Bez tego
  panel wykonuje 150+ zapytań przy zimnym starcie. Zapytanie nie-DDL wewnątrz
  migracji owijaj w `inMigration()`.
* **410 Gone, nie 404** — druga strona ma wiedzieć, że dokument istnieje,
  tylko dostęp odebrano. Strony publiczne muszą to rozróżnić i pokazać
  sensowny ekran, nie „nie znaleziono".
* `useUI()` → `confirm()`, **nigdy** `window.confirm`. Daty przez
  `formatPlDate()`, nigdy surowy ISO z bazy. Ikony `@tabler/icons-react`,
  nie emoji (mapy w `app/[lang]/admin/icons.tsx`). Animacje wyłącznie ze
  stałych w `lib/motion.ts` (`SPRING` / `EASE_LIQUID`), nigdy z palca.
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe". Panel jednoosobowy, brak AI w logice, „zdrowie" projektu
  ręczne — to wybory, nie błędy.

**Weryfikacja — `tsc` tu nic nie udowodni.** Wymagane minimum:

1. Otwórz publiczny link **przed** unieważnieniem (działa) i **po** nim
   (410 + czytelny ekran), a potem po „Wygeneruj nowy" (nowy link działa,
   **stary dalej nie**). To ostatnie jest sednem — sprawdź je naprawdę.
2. Spróbuj **podpisać** umowę i **wysłać** opinię unieważnionym linkiem —
   obie trasy zapisujące muszą odmówić.
3. Obejrzyj **wszystkie cztery wydruki** (faktura, wezwanie, oferta, umowa)
   po zmianie białych list. Brakujące pole nie rzuci błędu, tylko zostawi
   pustą rubrykę — jedyny sposób to zobaczyć.
4. `npx tsc --noEmit -p tsconfig.json` po każdej paczce (pełny `next build`
   failuje w sandboxie z EPERM).

Serwer dev: `npm run dev`, logowanie pominięte (`DEV_ADMIN_BYPASS` w
`.env.local`), dane z PGlite (`lib/dev-db.ts`) — produkcyjna baza jest poza
zasięgiem. Jeśli inny czat trzyma serwer, **nie zabijaj go** — otwórz
`preview_start url:"http://localhost:3000/pl/admin"`, to ten sam kod. Panel
`/admin` jest **jednomotywowy — ciemny**, nie szukaj jasnego wariantu.

**Nie jestem programistą i nie czytam kodu** — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. Na koniec zaktualizuj `HUB_SETUP.md`,
dopisz wynik w `docs/AUDYT-1-WYNIKI.md` (sekcja „Co zostaje otwarte" — te
pozycje właśnie się zamykają), odhacz w `docs/plany-modulow/README.md`
i podaj mi komendę do commita.
