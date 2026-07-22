# Prompt do nowego czatu — Audyt 3 (niezawodność, kopie, powrót po awarii)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `42-audyt-3-niezawodnosc.md`.)

---

Przeprowadź Audyt 3 opisany w `docs/plany-modulow/42-audyt-3-niezawodnosc.md`.
Najpierw przeczytaj ten brief, sekcję „Audyt 3" w `docs/AUDYTY-KONCOWE.md`,
oraz ustalenia poprzednich audytów: `docs/AUDYT-4-WYNIKI.md` (kopie mają już
wykrywanie ciszy i ping z NAS-a — NIE buduj tego drugi raz) i
`docs/AUDYT-1-WYNIKI.md` (łańcuch dostępu Vercel→GitHub→Apple→skrzynka,
ustalenie 12). Potem zaproponuj plan, dopiero potem działaj.

To Audyt 3 z kolejności wg ryzyka (4 ✅ → 1 ✅ → **3** → 2 → 6 → 5 → 7), jeden
audyt = jeden czat. Pytanie: co się stanie, gdy padnie każdy pojedynczy
element — i czy umiemy z tego wrócić. Robimy to teraz, przed pierwszym
klientem: od tej chwili awaria to „cudze dane są niedostępne", nie „mój panel
nie działa".

Uwagi, które oszczędzą Ci czasu:

* **Kopie zapasowe ISTNIEJĄ i mają nadzór** (`scripts/kopia-zapasowa/`,
  `lib/backup.ts`, `/api/backup/ping`, Audyt 4). Audyt 3 nie pisze ich od zera
  — **ćwiczy powrót** i **domyka to, czego brak**: kopię poza domem i spisane
  procedury awaryjne.
* **Trzy rzeczy są dziś nierozstrzygnięte i wymagają MOJEJ decyzji — zapytaj
  wprost, nie zakładaj** (szczegóły w briefie, sekcja „Co rozstrzygnąć”):
  (1) kopia poza domem (off-site) — dziś jej nie ma, pożar/kradzież NAS-a =
  utrata wszystkiego; przedstaw opcje z kosztem; (2) ile danych możemy stracić
  (dziś do 24 h — kopia raz na dobę) i ile godzin przestoju jest OK;
  (3) czynnik ludzki — czy jest ktoś, kto miałby zadziałać, gdybym był
  niedostępny miesiąc.
* **Odtworzenie kopii trzeba NAPRAWDĘ wykonać i ZMIERZYĆ, nie przeczytać.**
  Podział pracy jest wymuszony: **nie masz dostępu do NAS-a ani do hasła
  szyfrującego**, więc prawdziwą kopię odtwarzam ja, krok po kroku wg
  `scripts/kopia-zapasowa/README.md` (przygotuj mi tę instrukcję bez żargonu
  i każ zmierzyć czas — to brakująca liczba). Ty w tym czasie **udowodnij, że
  sam skrypt `odtworz.sh` działa end-to-end**: zrób syntetyczną bazę w
  Dockerze, `pg_dump`, zaszyfruj testowym kluczem, przepuść przez `odtworz.sh`,
  potwierdź, że dane wracają, zmierz czas. „Niedziałające odtwarzanie kopii"
  było już raz cichym błędem w tym projekcie — dlatego uruchomienie, nie
  lektura. Obraz Dockera to **`postgres:17`, NIE `-alpine`** (alpine nie ma
  `openssl`, deszyfrowanie padnie).
* **Wypisz każdy pojedynczy punkt awarii z procedurą powrotu** (co przestaje
  działać, jak zauważę, co robię, ile trwa): Neon, Vercel, NAS, skrzynka
  poczty (az.pl — załączniki są na żądanie z IMAP, więc padają razem z nią),
  Mac Studio (Ollama — sprawdź w kodzie, czy jego awaria naprawdę nie wywraca
  reszty panelu, a nie zakładaj tego).
* **Nie opieraj powrotu na dostępie do Vercela jako pewniku** — ten dostęp
  idzie przez łańcuch GitHub→Apple→skrzynka, zerwany przez pół roku bez objawu
  (ustalenie 12 Audytu 1). Plan Hobby dokłada ryzyko: komercyjny użytek łamie
  warunki, konto może zostać zablokowane (przejście na Pro → `PO_REJESTRACJI.md`).
* **Zielony build nie jest dowodem** i **dokumentacja kłamie** — każde
  ustalenie opieraj na uruchomieniu albo grepie po UŻYCIU (nie po definicji).
* Jeśli coś trzeba dołożyć w kodzie (np. kopia off-site, jeśli ją wybiorę):
  bramka migracji (`schemaUpToDate()`/`markSchemaApplied()`), nie-DDL w
  migracji owinięte w `inMigration()`, nadzór przez istniejący mechanizm z
  Audytu 4 (nie nowy automat — Audyt 4 ostrzegał przed mnożeniem tego, co
  trzeba pilnować). `useUI()` zamiast `window.confirm`. Nie buduj nic „na
  zapas".
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe" (np. brak modelu AI w logice, plan Hobby do czasu rejestracji).

Środowisko: `npm run dev`, logowanie pominięte (`DEV_ADMIN_BYPASS` w
`.env.local`), dane z PGlite (`lib/dev-db.ts`) — **produkcyjna baza, Neon i NAS
są poza Twoim zasięgiem**, wszystko, co ich dotyka, idzie przeze mnie. Docker
jest dostępny lokalnie do testu `odtworz.sh`. Jeśli inny czat trzyma serwer,
nie zabijaj go — otwórz `preview_start url:"http://localhost:3000/pl/admin"`.
Panel `/admin` jest jednomotywowy — ciemny.

Nie jestem programistą i nie czytam kodu — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. Na koniec oddaj `docs/AUDYT-3-WYNIKI.md`
(wzorem `AUDYT-1-WYNIKI.md`/`AUDYT-4-WYNIKI.md`), zaktualizuj
`docs/AUDYTY-KONCOWE.md` (odhacz Audyt 3, następny = Audyt 2 RODO), dopisz do
`PO_REJESTRACJI.md` co wyjdzie na „po rejestracji", odhacz w
`docs/plany-modulow/README.md` i podaj mi komendę do commita.
