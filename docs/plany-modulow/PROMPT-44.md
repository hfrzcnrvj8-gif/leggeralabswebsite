# Prompt do nowego czatu — Audyt 6 (poprawność kodu i dług techniczny)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `44-audyt-6-kod.md`.)

---

Przeprowadź Audyt 6 opisany w `docs/plany-modulow/44-audyt-6-kod.md`. Najpierw
przeczytaj ten brief, sekcję „Audyt 6" w `docs/AUDYTY-KONCOWE.md`, oraz
ustalenia poprzednich audytów: `docs/AUDYT-1-WYNIKI.md`, `docs/AUDYT-2-WYNIKI.md`,
`docs/AUDYT-3-WYNIKI.md`, `docs/AUDYT-4-WYNIKI.md` — żeby nie diagnozować drugi
raz tego, co już rozstrzygnięte. Potem zaproponuj plan, dopiero potem działaj.

To Audyt 6 z kolejności wg ryzyka (4 ✅ → 1 ✅ → 3 ✅ → 2 ✅ → **6** → 5 → 7),
jeden audyt = jeden czat. Pytanie: czy to, co jest, działa i da się utrzymać
przez lata bez regresji — nie „czego brakuje".

Uwagi, które oszczędzą Ci czasu:

* **Największa słabość: ZERO testów automatycznych** (zmierzone 2026-07-23:
  390 plików, 155 tras / 217 uchwytów, `package.json` bez skryptu `test`).
  Cała weryfikacja jest ręczna — działa dobrze, ale **nie chroni przed
  regresją**. Sedno audytu: czy to zmieniamy i dla których reguł.
* **Testy — jeśli w ogóle, to WYŁĄCZNIE reguły biznesowe** dublujące się
  panel↔apka, które już raz się rozjechały: `parseQuickAdd`, terminy snooze
  i wysyłki, normalizacja telefonów, „wymaga działania dziś", ocena stanu kopii.
  **Nie testy interfejsu.** Test musi realnie **czerwienić się** na znanym
  rozjeździe, inaczej jest bezwartościowy.
* **Apka natywna to OSOBNE repo** (tu 0 plików `.swift`) — parytet panel↔apka
  jest cross-repo. Zdecyduj ze mną, czy sięgamy do kodu apki, czy tylko
  wypisujemy reguły panelu „do pilnowania".
* **Martwy kod: grep po UŻYCIU, nie po definicji.** Cztery udokumentowane
  przypadki „pole jest, nikt go nie woła" sugerują, że jest ich więcej. Usuwaj
  dopiero po potwierdzeniu, że nikt nie woła (i pamiętaj: `rm` w sandboxie bywa
  zablokowany — wtedy nadpisz `export {};` i poproś mnie o ręczne usunięcie).
* **`lib/db.ts` ma 2597 linii** — rozważ podział TYLKO jeśli utrudnia pracę, nie
  dla samej liczby. To świadomie jeden plik (migracje z bramką).
* **Zależności: 18 produkcyjnych** — sprawdź nieaktualne i podatne
  (`npm outdated`, `npm audit`). `next ^16` / `react ^19`: major to osobny,
  większy ruch, nie drobna łatka.
* **Znane, świadomie odłożone niespójności** (NIE naprawiać jako błędy): znaki
  typograficzne `✕`/`★` obok ikon Tablera, emoji ⏰ w Poczcie. Wypisz jako
  „znane i odłożone".
* **Trzy rzeczy wymagają MOJEJ decyzji — zapytaj wprost, nie zakładaj:**
  (1) czy w ogóle wprowadzamy testy (zmiana filozofii + pierwsza zależność
  testowa); (2) zakres parytetu apka (cross-repo czy tylko lista); (3) czy
  dzielić `lib/db.ts`.
* **Zielony build/tsc nie jest dowodem** i **dokumentacja kłamie** — każde
  ustalenie opieraj na grepie po użyciu, arytmetyce (nie nazwie „1:1
  z panelem") albo uruchomieniu.
* **Nie dobudowuj funkcji, nie przepisuj działającego kodu „bo ładniej", nie
  odkrywaj na nowo świadomych decyzji** (`CLAUDE.md` → „Świadome decyzje
  produktowe" i sekcje „świadomie odłożone").

Środowisko: `npm run dev`, logowanie pominięte (`DEV_ADMIN_BYPASS` w
`.env.local`), dane z PGlite (`lib/dev-db.ts`) — produkcyjna baza, Neon i NAS
są poza Twoim zasięgiem. Jeśli inny czat trzyma serwer, nie zabijaj go — otwórz
`preview_start url:"http://localhost:3000/pl/admin"`. Panel `/admin` jest
jednomotywowy — ciemny.

Nie jestem programistą i nie czytam kodu — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. Na koniec oddaj `docs/AUDYT-6-WYNIKI.md`
(wzorem `AUDYT-1-WYNIKI.md`/`AUDYT-2-WYNIKI.md`/`AUDYT-3-WYNIKI.md`/
`AUDYT-4-WYNIKI.md`), zaktualizuj `docs/AUDYTY-KONCOWE.md` (odhacz Audyt 6,
następny = Audyt 5 wydajność i koszty), odhacz w `docs/plany-modulow/README.md`
i podaj mi komendę do commita.
