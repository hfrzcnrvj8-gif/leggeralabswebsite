# Audyty końcowe — zanim uznamy system za skończony

> Dokument planistyczny, spisany **2026-07-20** na wyraźne zlecenie właściciela.
> Nie jest to lista rzeczy do zrobienia teraz — to **umowa z samym sobą**, co
> musi zostać sprawdzone, zanim panel i aplikacja natywna zostaną uznane za
> gotowe do wieloletniego używania.

## Kiedy to uruchamiamy

> ### ✅ BRAMKA OTWARTA — 2026-07-22
>
> Warunek został spełniony. Moduły panelu domknięte (otwarty został tylko
> Moduł 16 „wsparcie posprzedażowe", świadomie odłożony do realnej potrzeby),
> fazy aplikacji natywnej domknięte, Moduły 37 i 38 zamknięte tego samego dnia.
> **Audyty ruszają w kolejności wg ryzyka — zaczyna Audyt 4.**
> Brief wykonawczy: `docs/plany-modulow/39-audyt-obserwowalnosc.md`.

Po domknięciu **obu** rzeczy naraz:

- wszystkie moduły panelu (`docs/plany-modulow/`),
- wszystkie fazy aplikacji natywnej (`docs/natywna-aplikacja/00-plan.md`).

**Nie wcześniej.** Audyt na ruchomym celu daje ustalenia, które dezaktualizują
się przed wdrożeniem — mieliśmy to już przy audycie z 2026-07-12, gdzie główne
ustalenie (brak KSeF) przestało być prawdą w ciągu doby.

**Ale też nie później.** Rejestracja działalności to naturalny termin graniczny:
od tego dnia w systemie siedzą prawdziwe dane prawdziwych klientów, a część
ustaleń przestaje być techniczna i staje się prawna (patrz `PO_REJESTRACJI.md`).

## Cel, słowami właściciela

> „żeby to działało teraz i działało zawsze, a jeżeli coś się gdzieś psuje albo
> jest zagrożenie, to wszystko ma swoje logi i jesteśmy w stanie szybko
> namierzyć miejsca problematyczne"

To są **dwa różne cele** i trzeba je rozdzielić, bo wymagają czego innego:

1. **Żeby działało** — poprawność, bezpieczeństwo, wydajność.
2. **Żeby dało się naprawić, gdy przestanie** — obserwowalność, logi, alerty,
   procedury odtworzenia.

Drugi jest dziś **wyraźnie słabszy** i to on wymaga najwięcej pracy. Panel ma
**95** miejsc logujących błędy, ale nie ma niczego, co by je zbierało, przechowywało
i o nich powiadamiało. Szczegóły w Audycie 4.

## Zasady prowadzenia (wnioski z trzech poprzednich audytów)

Były już trzy: 4-wymiarowy (2026-07-12), przepływów end-to-end (2026-07-13)
i drogi klienta (Moduł 29, 2026-07-17). Czego nauczyły:

1. **Dokumentacja kłamie — weryfikuj gretem, nie pamięcią.** `CLAUDE.md`
   twierdził, że migracja emoji→ikony jest skończona; nie była. Trzy sesje
   ogłosiły „poziom 1 kompletny", gdy nie był. Każde ustalenie audytu ma się
   opierać na odczycie kodu albo na uruchomieniu, nigdy na opisie.
2. **Sprawdzaj, czy coś WOŁA kod, nie czy kod istnieje.** Cztery razy w tym
   projekcie pole i funkcja istniały, a nikt ich nie wywoływał (Moduł 30, 31,
   WhatsApp w apce, `list_unsubscribe_url`). Grep po definicji to za mało —
   grep po użyciu.
3. **Zielony build nie jest dowodem.** Wszystkie najpoważniejsze błędy tego
   projektu kompilowały się bez zarzutu: wyścig kasujący przypomnienia, martwe
   `.sheet` w SwiftUI, niedziałające odtwarzanie kopii. Dowodem jest
   uruchomienie i obejrzenie wyniku.
4. **Nie powtarzaj poprzednich audytów.** Przeczytaj ich ustalenia najpierw.

---

# Audyt 1 — Bezpieczeństwo i dostęp

> ### ✅ WYKONANY — 2026-07-22
>
> Wyniki: **`docs/AUDYT-1-WYNIKI.md`**.
>
> W skrócie: brak hamulca na `POST /api/admin/login` (zmierzone: 30 prób →
> 30× 401, zero 429) **naprawiony** — 5 prób / 15 min, licznik w bazie,
> odcisk zamiast adresu IP, alarm w dziennym mailu. Ten sam hamulec objął
> publiczny formularz kontaktowy (5/60 min).
>
> Lista „9 tras bez `isAuthed()`" okazała się nieprawdziwa: jest ich **14
> plików / 16 uchwytów** — poprzednia powstała gretem po pliku, a pięć tras
> wspomina `isAuthed()` w komentarzu. Wszystkie 16 przejrzane pojedynczo,
> każda ma uzasadnienie i własną ochronę.
>
> Otwarte: publiczna umowa wydaje adres IP podpisującego, publiczna faktura
> wydaje drugi token (`SELECT *` z czarną listą pól). Nowe briefy: **40**
> (unieważnianie linków) i **41** (drugi składnik TOTP — właściciel poprosił
> o 2FA, znosząc zapis „jedno hasło" z `CLAUDE.md`).
>
> **Następny wg ryzyka: Audyt 3 (niezawodność, kopie, powrót po awarii).**

**Pytanie:** kto i czym może się dostać do danych, i co się stanie, gdy jeden
z tych kluczy wycieknie.

- **Inwentarz sekretów.** Wypisz KAŻDY sekret (env Vercela, `.env` na NAS-ie,
  Keychain w apce, tokeny urządzeń) — gdzie leży, co odblokowuje, kto ma
  dostęp. Dziś nie ma takiej listy w jednym miejscu.
- **Zasada najmniejszych uprawnień.** Kopie zapasowe już mają konto
  tylko-do-odczytu (2026-07-20). Sprawdź, czy pozostałe integracje też —
  szczególnie KSeF i skrzynka az.pl.
- **Rotacja.** Czy da się wymienić każdy sekret bez przestoju? Spisz procedurę
  dla trzech najważniejszych: bazy, skrzynki, hasła administratora.
- **Powierzchnia ataku tras API.** **148 tras / 210 uchwytów** (74 GET, 78 POST,
  33 DELETE, 25 PATCH), stan 2026-07-22. Sprawdź, czy KAŻDA zaczyna się od
  `isAuthed()` albo świadomie jest publiczna (formularz kontaktowy, podpis
  oferty przez token). Trasy publiczne wypisz jawnie — to najkrótsza lista,
  jaką warto znać na pamięć.
- **Tokeny w linkach.** Oferty, umowy i wezwania chodzą po linkach z tokenem.
  Sprawdź długość, losowość i to, czy wygasają.
- **Uwierzytelnianie jednym hasłem.** ~~To świadome ograniczenie zakresu~~ —
  zapytany 2026-07-22 właściciel **poprosił o drugi składnik (TOTP)**.
  Zapis „jedno hasło" w `CLAUDE.md` przestaje obowiązywać; brief:
  `docs/plany-modulow/41-drugi-skladnik-totp.md`.
- **Adres e-mail konta Vercel** — pośrednik Apple. **Przyczyna ustalona
  2026-07-22 i inna, niż zapisano 07-20** (tamten opis — „nie przyjmuje
  poczty od innych nadawców" — był błędny): pośrednik działał poprawnie,
  ale przekazywał na `kontakt@patrykpiecyk.pl`, czyli adres, którego rekord
  MX wskazuje na **Vercela** — hosting stron bez serwera poczty. Poczta nie
  ginęła w spamie, tylko nie miała gdzie dojść. Naprawione tego samego dnia.
  Szczegóły i sposób weryfikacji: `docs/AUDYT-1-WYNIKI.md`.

# Audyt 2 — Dane osobowe i RODO

> ### ✅ WYKONANY — 2026-07-23
>
> Wyniki: **`docs/AUDYT-2-WYNIKI.md`**.
>
> W skrócie: mapa oparta na **schemacie** — 51 tabel, ~22 z danymi osób, plus
> dokąd wychodzą (kopie NAS + off-site = cała baza AES-256, logi Vercela,
> `error_log`, az.pl, KSeF-test, Resend, publiczne linki, lokalny Ollama).
> Najostrzejszy brak — **`field_changes`** trzymał surowe stare/nowe e-maile
> i telefony, bez retencji, bez FK, i **przeżywał usunięcie osoby** (zmierzone
> uruchomieniem) — **naprawione** (kasowane jawnie z osobą).
>
> Retencja: brief mylił się co do dwóch „luk" — `error_log` i `rate_limit_hits`
> **już** mają retencję (500 wpisów + `oczyscTekst()`; 24 h + odcisk). Realne
> luki były trzy: leady, klienci, `field_changes`. **Leady bez konwersji →
> 24 mies. od kontaktu, automatycznie** (`purgeStaleLeads`, wykluczenia chronią
> faktury/umowy/klienta/projekt; zweryfikowane uruchomieniem: stary usunięty,
> świeży i „z fakturą" zostają). **Klienci → bez auto** (faktury 5 lat).
> Logi **nie** wypuszczają danych osobowych (sprawdzone gretem po użyciu).
>
> Prawo do usunięcia: kaskady sprawdzone uruchomieniem; **kopie rozwiązują się
> same w ≤4 tyg.** (retencja). Procedura ręczna, bez przycisku „na zapas".
> Lokalne AI (Ollama) udokumentowane jako **przewaga prywatności**. Treść
> prawna → `docs/DO-PRAWNIKA-I-TLUMACZA.md`; pozycje porejestracyjne →
> `PO_REJESTRACJI.md`.
>
> **Następny wg ryzyka: Audyt 6 (poprawność kodu / dług techniczny).**

**Pytanie:** jakie dane trzymamy, jak długo, gdzie się kopiują i czy umiemy je
usunąć na żądanie.

- **Mapa danych osobowych.** Które z **49** tabel zawierają dane osób? Dokąd te
  dane wyciekają dalej: kopie na NAS-ie, logi Vercela, maile, KSeF, lokalny
  model AI.
- **Retencja.** Poczta ma 24 miesiące, kopie 7 dni + 4 tygodnie. A leady,
  klienci, logi kontaktu, kronika powiadomień? Każdy zbiór potrzebuje
  odpowiedzi „jak długo i dlaczego".
- **Prawo do usunięcia.** Czy da się usunąć wszystkie dane jednej osoby —
  łącznie z kopiami zapasowymi i archiwum poczty? Dziś **nie ma na to
  procedury**. To jest realny obowiązek, nie teoria.
- **Logi.** Czy w logach lądują adresy e-mail, treści wiadomości, numery NIP?
  Logi to też zbiór danych osobowych.
- **Zgodność z polityką prywatności.** Ustalenia tego audytu muszą trafić do
  `docs/DO-PRAWNIKA-I-TLUMACZA.md`, a nie zostać w kodzie.
- **Lokalne AI.** Ollama chodzi na Macu właściciela — dane nie opuszczają
  jego sprzętu, i to jest mocna strona do udokumentowania, nie tylko do
  sprawdzenia.

# Audyt 3 — Niezawodność, kopie i powrót po awarii

> ### ✅ WYKONANY — 2026-07-23
>
> Wyniki: **`docs/AUDYT-3-WYNIKI.md`**.
>
> W skrócie: skrypt odtwarzający kopię (`odtworz.sh`) miał **cichy błąd** —
> przy złym haśle szyfrującym kończył się słowem „Gotowe" i kodem 0, nie wgrawszy
> ani jednej tabeli (brak `pipefail`, tak jak w `kopia.sh`). Złapane
> **uruchomieniem w Dockerze**, nie lekturą; naprawione (zły klucz → twardy błąd
> po polsku). Odtworzenie na syntetycznej bazie przejechane end-to-end — dane
> wracają co do znaku.
>
> Pięć punktów awarii dostało procedurę powrotu (Neon, Vercel, NAS, az.pl,
> Ollama). **Ollama i az.pl potwierdzone gretem po użyciu jako izolowane** —
> ich awaria degraduje tylko swój moduł, nie wywraca panelu. Kod stoi w GitHubie
> **i** lokalnie na Macu — nie ginie z Vercelem.
>
> Decyzje właściciela: off-site = **drugi dysk ręcznie** (bez automatu w chmurze,
> do rozważenia po rejestracji); RPO **do 24 h** (kopia raz na dobę zostaje);
> RTO **do ~1 dnia** (procedura ręczna); **brak drugiej osoby** → runbook „dla
> przyszłego Ciebie". Otwarte: właściciel ma **zmierzyć czas prawdziwego
> odtworzenia** z NAS-a (Claude nie ma tam dostępu).
>
> **Następny wg ryzyka: Audyt 2 (dane osobowe i RODO).**

**Pytanie:** co się stanie, gdy padnie każdy pojedynczy element — i czy
umiemy z tego wrócić.

- **Odtworzenie kopii „na sucho".** Kopie działają od 2026-07-20 i były raz
  odtworzone. Powtórz to podczas audytu; kopia nieodtworzona od pół roku jest
  z powrotem tylko nadzieją.
- **Scenariusze katastrofy — spisz procedurę dla każdego:**
  - Neon kasuje bazę / kończy darmowy plan → odtwarzamy z NAS-a. **Ile to
    trwa? Nikt tego nie mierzył.**
  - Konto Vercel niedostępne (przejęte, zablokowane za komercyjne użycie na
    planie Hobby) → gdzie stoi kod, jak szybko wdrożyć gdzie indziej.
  - NAS pada → kopie znikają. **Czy jest kopia kopii poza domem?** Dziś nie.
  - Skrzynka az.pl niedostępna → co przestaje działać (załączniki są
    pobierane na żądanie, więc przestają być dostępne).
- **Pojedyncze punkty awarii.** Wypisz je wprost. Podejrzani: Neon, Vercel,
  az.pl, NAS, Mac Studio (Ollama).
- **Czynnik ludzki.** System obsługuje jedna osoba, która nie programuje.
  Spisz, co ma zrobić ktoś inny, gdyby właściciel był niedostępny przez
  miesiąc. To nie jest scenariusz katastroficzny, tylko choroba albo urlop.

# Audyt 4 — Obserwowalność: logi i wykrywanie problemów

> ### ✅ WYKONANY — 2026-07-22
>
> Wyniki: **`docs/AUDYT-4-WYNIKI.md`**. Opis wdrożenia: `HUB_SETUP.md`
> → „Audyt 4 — obserwowalność".
>
> W skrócie: z 95 miejsc logujących błędy na alarm zasługiwało ~25 — reszta
> była albo już widoczna (41 tras zwraca 500 z powodem), albo szumem.
> Powstały `error_log`, `automation_runs` i alarm mailowy z wyciszaniem;
> nadzór wychodzi także z pingu NAS-a, żeby przeżył śmierć crona.
>
> Awarie interfejsu też są już łapane (`instrumentation.ts`, `error.tsx`,
> `global-error.tsx`) — dla panelu, nie dla strony publicznej.
>
> **Następny wg ryzyka: Audyt 1 (bezpieczeństwo)** — zaczyna od braku
> ograniczenia prób logowania, opisanego w briefie 39.

**To jest najsłabszy obszar i najbliższy temu, o co właściciel prosił wprost.**

Stan na 2026-07-20, sprawdzony, nie założony:

| Co | Stan |
|---|---|
| Miejsc logujących błędy w kodzie | **95** (`console.error`) + 18 (`log`/`warn`) — zmierzone ponownie 2026-07-22 |
| System zbierający te błędy | **brak** |
| Powiadomienie, gdy coś padnie | **tylko dla kopii zapasowych** |
| Retencja logów | logi Vercela na planie Hobby — **liczona w godzinach** |

Znaczy to, że **awaria o 3:00 jest do rana niewidoczna i nie do odtworzenia**.
Panel może się psuć tygodniami, a jedynym objawem będzie „jakoś dziwnie
działa".

Do rozstrzygnięcia w audycie:

- **Zbieranie błędów.** Czy wprowadzamy narzędzie (Sentry i podobne mają
  darmowe progi wystarczające dla jednej osoby), czy własne, prostsze
  rozwiązanie: tabela `error_log` + ta sama droga meldunku, co przy kopiach.
  Drugie ma zaletę — zero nowych usług i zero nowych kosztów, zgodnie
  z preferencją właściciela („jak najwięcej lokalnie").
- **Rozszerzyć wzorzec z kopii zapasowych.** Mechanizm zbudowany 2026-07-20
  (meldunek → ocena stanu → pas na Pulpicie → linia w dziennym mailu) jest
  gotowym wzorcem dla KAŻDEGO cichego procesu. Kandydaci: synchronizacja
  poczty, cron dzienny, KSeF, kolejka wysyłki odłożonej, faktury cykliczne.
  **Zasada: każdy proces, który chodzi bez patrzenia, musi umieć się poskarżyć.**
- **Zdrowie systemu jednym rzutem oka.** Jeden ekran albo jedna sekcja
  w dziennym mailu: kiedy ostatnio zadziałał każdy automat.
- **Co MA trafiać do logów, a co nie.** Dziś nie ma reguły. Potrzebna: bez
  danych osobowych, z identyfikatorem pozwalającym powiązać zdarzenia,
  z jasnym rozróżnieniem „błąd" od „sytuacja przewidziana".
- **Alarmy, które nie kłamią.** Próg nieaktualności kopii to 36 h, celowo nie
  24 h — fałszywe alarmy uczą ignorowania ostrzeżeń. Ta sama ostrożność
  obowiązuje przy każdym nowym alarmie.

# Audyt 5 — Wydajność i koszty

> ### ✅ WYKONANY — 2026-07-23
>
> Wyniki: **`docs/AUDYT-5-WYNIKI.md`**. Brief: `docs/plany-modulow/45-audyt-5-wydajnosc.md`.
>
> W skrócie: przy jednym użytkowniku i zerze klientów **nic nie jest wolne ani
> drogie**, a **żaden z trzech tropów briefu nie okazał się realnym problemem** —
> dwa opierały się na nieaktualnych limitach Vercela. **Zero zmian w kodzie** —
> poprawny wynik to „znaj progi, nie optymalizuj na zapas".
>
> **`maxDuration` 120/90 s a Hobby:** trop NIEAKTUALNY. Z fluid compute
> (domyślne) Hobby daje dziś **300 s** (nie 60 s — to era sprzed fluid compute),
> więc wszystkie deklaracje mieszczą się z zapasem; przekroczenie i tak dałoby
> widoczny **504**, nie ciche. **Bramka migracji NIE odrosła** (zmierzone
> uruchomieniem): Pulpit **14 zapytań danych** na ciepło, bramka ścina 242
> migracje → **2** na zimny start, pokrycie **24/24** schematów. **„2 crony
> wyczerpane" — nieaktualne:** Hobby daje 100 cronów, ścianą jest
> **częstotliwość** (raz/dobę); Pro kupuje cron co-minutę. **Apka nie odpytuje
> w tle** (brak `BGTaskScheduler`/timerów) — koszt baterii/transferu skaluje się
> z użyciem.
>
> **Rachunek:** pewne przyszłe koszty = **~20 USD/mies. Vercel Pro** (bo Hobby
> zabrania użytku komercyjnego — to wyzwalacz, nie cron/czas) **+ 99 USD/rok
> Apple Developer** (właściciel założy przy rejestracji). Neon i Resend zostają
> darmowe do realnego ruchu klientów. **Odczyty paneli 2026-07-23 domknięte:**
> fluid compute **włączone** (limit 300 s realny), wszystkie darmowe plany
> głęboko w zielonym (max — Vercel Active CPU 13 %), przy czym liczby są z fazy
> testów apki, nie realnego użytku.
>
> **Następny i OSTATNI wg ryzyka: Audyt 7 (czy to nadal jest ten produkt).**

- **Zapytania do bazy.** `neon()` to jedno żądanie HTTP na zapytanie —
  bramka migracji (2026-07-15) powstała, bo panel robił ich 156 na zimny
  start. Sprawdź, czy nie odrosło. Podejrzani: Pulpit, lista Poczty.
- **Czas funkcji.** Synchronizacja IMAP i pobieranie załączników zbliżają się
  do limitu. Zmierz najwolniejsze trasy.
- **Rozmiar bazy** wobec progów darmowego planu Neona — i co się stanie po
  ich przekroczeniu.
- **Rachunek całości.** Vercel Pro (po rejestracji), Neon, Resend, konto
  Apple Developer. Właściciel ma znać sumę miesięczną **zanim** przyjdzie
  pierwszy rachunek.
- **Apka natywna:** zużycie baterii i transferu przy odpytywaniu.

# Audyt 6 — Poprawność kodu i dług techniczny

> ### ✅ WYKONANY — 2026-07-23
>
> Wyniki: **`docs/AUDYT-6-WYNIKI.md`**. Brief: `docs/plany-modulow/44-audyt-6-kod.md`.
>
> W skrócie: wprowadzono **pierwsze testy automatyczne** (32, `node --test` +
> `tsx` — jedyna nowa zależność), **wyłącznie dla czystych reguł biznesowych**
> dublowanych z apką; udowodnione, że **biją na regresji** (red-first). Parytet
> panel↔apka sprawdzony **arytmetyką** (repo `leggera-hub-ios` otwarte): telefon,
> snooze/wysyłka i `parseQuickAdd` **zgodne**; złapano **jeden realny rozjazd** —
> reguła „wymaga działania dziś" (`isOverdue`) liczyła dni przez floor z północy
> UTC, apka kalendarzowo → tuż po północy panel i telefon mówiły o leadzie dwie
> różne rzeczy. **Naprawione po stronie panelu** (`daysBetweenISO`, zrównane z
> apką i własnym helperem).
>
> Martwy kod: **9 potwierdzonych martwych eksportów** (grep po użyciu),
> udokumentowane, nieusunięte (bywają rusztowaniem — `list_unsubscribe_url`
> z briefu **ożył**, ma dziś 23 użycia). `lib/db.ts` (2597 linii) — **zostaje**
> (regularny schemat, nie plątanina). Zależności: **6 CVE Next.js + sharp**
> flagowane high, ale **realna ekspozycja niska** (apka nie używa `next/image`/
> rewrites/Edge/Server Actions); **brak załatanego Next 16** (jedyna „naprawa"
> npm = downgrade do 14 — odrzucone), patch 16.2.11 zastosowany, pełna
> aktualizacja odłożona jako decyzja właściciela.
>
> **Następny wg ryzyka: Audyt 5 (wydajność i koszty).**

**Największa pojedyncza słabość: 342 pliki, 148 tras API i ZERO testów
automatycznych** (zmierzone ponownie 2026-07-22 — `package.json` nie ma nawet
skryptu `test`).

Cała weryfikacja w tym projekcie jest ręczna — `curl`, zrzuty ekranu,
oglądanie. Działa to zaskakująco dobrze (wyłapało wszystkie poważne błędy),
ale ma jedną wadę nie do obejścia: **nie chroni przed regresją**. Nikt nie
zauważy, że poprawka z lipca zepsuła coś z marca, dopóki się na to nie
natknie.

- **Rozstrzygnąć, czy wprowadzamy testy** — i jeśli tak, to wyłącznie dla
  reguł biznesowych, które dublują się między panelem a apką i już raz się
  rozjechały: `parseQuickAdd`, terminy snooze i wysyłki, normalizacja
  numerów telefonu, reguła „wymaga działania dziś", ocena stanu kopii.
  **Nie testy interfejsu** — tam ręczne oglądanie zrzutów jest skuteczniejsze.
- **Parytet panel ↔ apka.** Każda reguła istniejąca w dwóch miejscach jest
  kandydatem na rozjazd. Zrób ich listę.
- **`lib/db.ts` ma 2392 linie.** Rozważ podział — ale tylko jeśli utrudnia
  pracę, nie dla samej liczby.
- **Zależności.** 18 produkcyjnych. Sprawdź nieaktualne i takie ze znanymi
  podatnościami.
- **Martwy kod.** Cztery udokumentowane przypadki „pole jest, nikt go nie
  woła" sugerują, że jest ich więcej.
- **Znane, świadomie odłożone niespójności:** znaki typograficzne (`✕`, `★`)
  obok ikon Tablera; emoji ⏰ w Poczcie mimo reguły z Modułu 33.

# Audyt 7 — Czy to nadal jest ten produkt

> ### ✅ WYKONANY — 2026-07-23 — OSTATNI, SERIA DOMKNIĘTA
>
> Wyniki: **`docs/AUDYT-7-WYNIKI.md`**. Brief: `docs/plany-modulow/46-audyt-7-produkt.md`.
>
> W skrócie: rozmowa produktowa, nie kod — **zero zmian w kodzie**, i to
> poprawny wynik. Trzy rozstrzygnięcia właściciela: **(1) AI** — reguła „zero
> AI" (otwarta 07-19) rozszerzona: kształt „model proponuje → właściciel
> zatwierdza" wchodzi na **trzy nowe punkty** (kategoria kosztu → podsumowanie
> wątku poczty → szkic notatki z rozmowy), zawsze lokalny Ollama, nigdy chmura,
> jako **decyzja i osobne briefy**, nie kod tej sesji; twarda granica bez zmian.
> **(2) Żywotność modułów** — **nic nie odstawiamy**: wszystko wdrożone po
> wspólnej konsultacji, część jeszcze niewykorzystana → „uśpione świadomie",
> przegląd po pierwszych klientach („zero klientów" ≠ „martwe"). **(3) Dwa
> front-endy** — **oba zostają**, plan macOS/iPadOS aktualny; koszt parytetu
> pod kontrolą (testy + krótki audyt drugiej platformy). Brak nowych pozycji
> prawnych. **Wszystkie siedem audytów domknięte** — umowa z 2026-07-20
> spełniona; następny kamień to rejestracja działalności (`PO_REJESTRACJI.md`).

Audyt techniczny odpowiada „czy działa". Ten pyta **„czy to jest jeszcze to,
czego potrzebujesz"** — i jest ważniejszy, niż się wydaje, bo panel rósł rok
i część decyzji zapadła w innych okolicznościach.

- **Reguła „zero AI" jest OTWARTA** od 2026-07-19. Właściciel sam ją odblokował
  argumentem: *„jako integrator lokalnych LLM sam nie korzystam w moim własnym
  produkcie — to słaba autoreklama"*. Ta rozmowa ma się odbyć podczas audytów.
  Pytanie nie brzmi „czy AI", tylko **„czy kształt »model proponuje, właściciel
  zatwierdza« da się rozszerzyć bez oddawania modelowi decyzji"**.
- **Co się faktycznie używa.** Po roku część modułów może być martwa. Warto
  wiedzieć, zanim zacznie się je utrzymywać z rozpędu.
- **Dwa front-endy.** Panel i apka to trwały koszt, nazwany wprost w planie.
  Sprawdź, czy nadal się opłaca.

---

## Jak to poprowadzić

**Jeden audyt = jeden czat.** Siedem obszarów to za dużo na jedną sesję —
zmęczenie kontekstu daje pobieżne ustalenia, a te są gorsze niż ich brak, bo
usypiają czujność.

**Kolejność wg ryzyka**, nie wg numeracji: **4 (obserwowalność) → 1
(bezpieczeństwo) → 3 (niezawodność) → 2 (RODO) → 6 (kod) → 5 (koszty) →
7 (produkt)**.

Obserwowalność idzie pierwsza, bo bez niej **kolejne audyty pracują na ślepo** —
nie da się ocenić, czy coś się psuje, gdy nic tego nie zapisuje.

**Wynik każdego audytu:** lista ustaleń z priorytetem, każde poparte
odczytem kodu albo uruchomieniem, plus wprost wypisane „sprawdzone i jest
dobrze" — bo to też jest wynik. Ustalenia wymagające decyzji nietechnicznej
idą do właściciela **wprost, po polsku**, a nie są rozstrzygane samodzielnie.

## Czego ten audyt NIE ma robić

- **Nie dobudowywać funkcji.** Pytanie brzmi „czy to, co jest, działa i da się
  utrzymać", nie „czego brakuje".
- **Nie przepisywać działającego kodu** dlatego, że dałoby się ładniej.
- **Nie odkrywać na nowo świadomych decyzji.** Zanim uznasz coś za błąd,
  sprawdź `CLAUDE.md` i sekcje „świadomie odłożone" — spory kawałek tego,
  co wygląda na brak, jest wyborem.
