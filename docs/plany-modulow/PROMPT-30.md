# Prompt do nowego czatu — Moduł 30

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `30-powiazanie-z-klientem.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/30-powiazanie-z-klientem.md`. Najpierw
przeczytaj ten plik, `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md`,
potem zaproponuj plan i zapytaj o otwarte decyzje (brief ma sekcję „Do
rozstrzygnięcia z właścicielem" — nie zgaduj za mnie), dopiero potem działaj.

Ten brief powstał z audytu Modułu 29 (2026-07-17) i jest DRUGIM z trzech
(32 → 30 → 31). Moduł 32 jest zamknięty. Nie rób 31 przy okazji — ma osobny czat.

Uwagi, które oszczędzą Ci czasu:

* Brief ma na górze sekcję **„PRZECZYTAJ NAJPIERW — weryfikacja briefu w kodzie"**
  z trzema sprostowaniami (A/B/C), dopisaną po ponownym sprawdzeniu kodu. Bez
  niej zbudujesz rzeczy, które już istnieją. Mimo to **sprawdź wszystko sam
  gretem** — audyt 29 wykazał, że dokumentacja tego projektu bywa nieaktualna
  (HUB_SETUP.md twierdził „brak KSeF", gdy KSeF działał od miesiąca), a te
  sprostowania też są tylko dokumentem.
* Pytanie 1 („co znaczy `client_id`: migawka czy powiązanie?") wygląda na
  otwarte, ale kod już odpowiedział: robi OBA naraz i ma to opisane w
  komentarzu. Zapytaj mnie o potwierdzenie, nie o wybór architektury — i **nie
  przebudowuj migawki danych nabywcy**, jest poprawna księgowo.
* Dziura jest węższa, niż brzmi tytuł: trasa „lead → oferta → akceptacja →
  projekt + faktura" linkuje poprawnie. Problem otwiera się tylko przy starcie
  **bez leada** („+ Dodaj ofertę"/„+ Dodaj fakturę").
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe" i `HUB_SETUP.md`. Brak AI w logice, emoji zamiast ikon, panel
  jednoosobowy, **miękkie podpowiedzi zamiast bramek** — to wybory, nie błędy.
  Powiązanie z klientem ma być podpowiadane, nie wymuszane.
* Migracje: każda `create*Schema()` musi mieć `schemaUpToDate()` +
  `markSchemaApplied()`, a każde zapytanie nie-DDL w migracji (np. `INSERT`
  backfillu) MUSI iść przez `inMigration()` z `lib/migration-ctx.ts` — inaczej
  w dev zakleszcza seeder i wszystkie `/api/*` wiszą kilkadziesiąt sekund.
* Nie mam dostępu do produkcyjnej bazy z poziomu Claude — jeśli pytanie 4
  (powiązanie wstecz istniejących rekordów) wyjdzie na „tak", zaprojektuj to
  jako ekran/akcję w panelu do mojego ręcznego zatwierdzenia, nie jako
  jednorazowy skrypt SQL.
* Podgląd lokalny: `preview_start name:"dev"` (PGlite + dev-login, bez hasła).
  Jeśli inny czat trzyma już serwer na tym katalogu, nie zabijaj go — otwórz
  `preview_start url:"http://localhost:3000/pl/admin"`, to ten sam kod.
  Współrzędne klików i piksele zrzutu to dwie różne skale — skalibruj sondą,
  zanim uznasz cokolwiek za błąd (HUB_SETUP.md → „Moduł 28", ostatnia sekcja).
* Czysta logika (np. „czy ten rekord jest powiązany") jest tańsza i pewniejsza
  do sprawdzenia sondą w `tsx` niż klikaniem — patrz jak zweryfikowano
  `isOverdue()` w Module 32 (HUB_SETUP.md → „Moduł 32" → Weryfikacja).

Weryfikacja: `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
`next build` failuje w sandboxie). Ścieżka na żywo: utwórz ofertę z ekranu Ofert
(NIE z leada) → zaakceptuj → sprawdź, czy projekt trafia na kartę klienta i czy
zaplanował się kontakt retencyjny. Na koniec zapisz wynik w HUB_SETUP.md i
odhacz w README.md.
