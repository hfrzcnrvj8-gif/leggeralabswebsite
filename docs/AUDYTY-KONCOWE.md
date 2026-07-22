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
- **Uwierzytelnianie jednym hasłem.** To świadome ograniczenie zakresu
  (`CLAUDE.md`), nie luka — ale przy firmie z klientami warto zapytać
  właściciela ponownie, czy nadal mu to wystarcza.
- **Adres e-mail konta Vercel** — dziś to pośrednik Apple, który nie przyjmuje
  poczty od innych nadawców (odkryte 2026-07-20). Tym kanałem przyjdzie
  ostrzeżenie o przejęciu konta albo problemie z płatnością. **Do wymiany.**

# Audyt 2 — Dane osobowe i RODO

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
