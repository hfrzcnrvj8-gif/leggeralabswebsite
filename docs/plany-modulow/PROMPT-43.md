# Prompt do nowego czatu — Audyt 2 (dane osobowe i RODO)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `43-audyt-2-rodo.md`.)

---

Przeprowadź Audyt 2 opisany w `docs/plany-modulow/43-audyt-2-rodo.md`.
Najpierw przeczytaj ten brief, sekcję „Audyt 2" w `docs/AUDYTY-KONCOWE.md`,
oraz ustalenia poprzednich audytów: `docs/AUDYT-1-WYNIKI.md` (publiczne trasy
wydawały adres IP podpisującego — naprawione w Module 40, ale ująć w mapie;
`rate_limit_hits` trzyma odciski SHA-256 zamiast IP), `docs/AUDYT-4-WYNIKI.md`
(`oczyscTekst()` czyści e-mail/NIP/telefon/konto z `error_log` — log to zbiór
danych osobowych; NIE buduj tego drugi raz) i `docs/AUDYT-3-WYNIKI.md`
(retencja kopii 7 dni + 4 tygodnie, off-site to nowe miejsce z danymi).
Potem zaproponuj plan, dopiero potem działaj.

To Audyt 2 z kolejności wg ryzyka (4 ✅ → 1 ✅ → 3 ✅ → **2** → 6 → 5 → 7),
jeden audyt = jeden czat. Pytanie: jakie dane trzymamy, jak długo, gdzie się
kopiują i czy umiemy je usunąć na żądanie. To ostatni audyt techniczny przed
rejestracją firmy, który ma wprost prawną wagę — od rejestracji RODO staje się
obowiązkiem z sankcją, nie teorią.

Uwagi, które oszczędzą Ci czasu:

* **Mapa danych osobowych to rdzeń audytu.** Które z ~49 tabel zawierają dane
  osób i dokąd te dane wyciekają dalej: kopie na NAS-ie + off-site, logi
  Vercela, `error_log`, maile (az.pl), KSeF, lokalny model AI (Ollama). Policz
  i przejrzyj `CREATE TABLE` w `lib/db.ts` — **nie zgaduj z listy modułów**.
* **Prawo do usunięcia — dziś nie ma procedury.** Sprawdź URUCHOMIENIEM, co się
  dzieje przy usunięciu klienta/leada w dev-bazie (PGlite): co zostaje
  osierocone (faktury? maile? notatki?). Kopie rozwiązują się częściowo same
  (retencja → usunięta osoba wypada w ≤4 tygodnie) — **to czysta odpowiedź, ale
  nazwij ją wprost**, nie zakładaj.
* **Retencja: część zbiorów już ma regułę** (poczta 24 mies., kopie 7 dni + 4
  tyg., powiadomienia 30 dni) — nie ruszaj. Brakuje: leady, klienci, logi
  kontaktu, `field_changes`, `error_log`, `rate_limit_hits`. Gdzie reguły nie
  ma — to MOJA decyzja (napięcie „RODO każe usuwać / prawo podatkowe każe
  trzymać faktury 5 lat" jest realne).
* **Trzy rzeczy wymagają MOJEJ decyzji — zapytaj wprost, nie zakładaj**
  (szczegóły w briefie): (1) retencja leadów i klientów; (2) prawo do usunięcia
  — ręczna procedura czy przycisk „Usuń wszystkie dane osoby" w panelu;
  (3) co budować teraz jako kod, a co odłożyć na po rejestracji.
* **Treść prawną dopisuj do `docs/DO-PRAWNIKA-I-TLUMACZA.md`** — ten dokument
  ISTNIEJE (Moduł 29), nie zakładaj nowej listy i nie zostawiaj treści prawnej
  w kodzie.
* **Lokalne AI (Ollama) to MOCNA strona, nie luka** — dane nie opuszczają Maca
  właściciela, nie idą do chmury żadnego dostawcy LLM. Udokumentuj jako przewagę
  prywatności.
* **Zielony build nie jest dowodem** i **dokumentacja kłamie** — każde
  ustalenie opieraj na odczycie schematu, uruchomieniu albo grepie po UŻYCIU
  (nie po definicji).
* Jeśli coś trzeba dołożyć w kodzie (np. czyszczenie starych leadów, jeśli je
  wybiorę): bramka migracji (`schemaUpToDate()`/`markSchemaApplied()`), nie-DDL
  w migracji owinięte w `inMigration()`, nadzór przez istniejący mechanizm
  z Audytu 4 (nie nowy automat). `useUI()` zamiast `window.confirm`. Nie buduj
  nic „na zapas".
* Firma NIE jest zarejestrowana — nie traktuj świadomie odłożonych pozycji
  prawnych (`PO_REJESTRACJI.md`, `CLAUDE.md` → „Świadome decyzje produktowe")
  jako luk do naprawienia teraz.

Środowisko: `npm run dev`, logowanie pominięte (`DEV_ADMIN_BYPASS` w
`.env.local`), dane z PGlite (`lib/dev-db.ts`) — **produkcyjna baza, Neon i NAS
są poza Twoim zasięgiem**, wszystko, co ich dotyka (prawdziwe usunięcie
z produkcji, przegląd realnych kopii), idzie przeze mnie. Jeśli inny czat trzyma
serwer, nie zabijaj go — otwórz `preview_start url:"http://localhost:3000/pl/admin"`.
Panel `/admin` jest jednomotywowy — ciemny.

Nie jestem programistą i nie czytam kodu — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. Na koniec oddaj `docs/AUDYT-2-WYNIKI.md`
(wzorem `AUDYT-1-WYNIKI.md`/`AUDYT-3-WYNIKI.md`/`AUDYT-4-WYNIKI.md`), zaktualizuj
`docs/AUDYTY-KONCOWE.md` (odhacz Audyt 2, następny = Audyt 6 poprawność kodu),
dopisz do `PO_REJESTRACJI.md` i `docs/DO-PRAWNIKA-I-TLUMACZA.md` co wyjdzie na
„po rejestracji", odhacz w `docs/plany-modulow/README.md` i podaj mi komendę
do commita.
