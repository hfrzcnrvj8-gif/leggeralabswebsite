# Plan: zaplecze ma działać w całości

**Powstał:** 2026-08-02, po pierwszym przejściu „na sucho"
(`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`). **Punkt startu:** `635f737`.

Kolejność zatwierdzona przez właściciela. Zasada dla Fazy 3 zatwierdzona:
**panel proponuje, właściciel zatwierdza.**

---

## Dlaczego nie zaczynamy od listy poprawek

Przejście dało trzydzieści kilka znalezisk. To **nie jest** trzydzieści kilka
usterek — to **cztery brakujące mechanizmy**, każdy objawiający się w kilku
modułach naraz. Łatane pojedynczo wrócą, dokładnie tak jak rozjazd koloru
wracał dwa razy (`docs/plany-modulow/59-spojnosc-ui.md`).

| brakujący mechanizm | ile znalezisk zamyka |
|---|---|
| jedno przepisanie danych klienta na dokument | 6 |
| jedna bramka „czy to wolno wysłać" | 5 |
| komplet skutków zdarzenia | 5 |
| lista działań nieodwracalnych | 3 |

## Dwie rzeczy, które ustawiają cały plan

### 1. Nic się nie wysypało

Żadne znalezisko nie rzuciło wyjątku. `error_log` jest pusty, ekran *Zdrowie*
pokazałby zieleń. Mail z `[Twoje imię]` wyszedł z kodem 200. Oferta bez
wystawcy — 200. Klient został „Prospektem" po opłaconej fakturze — 200.

Czyli **„wyłapywać błędy na bieżąco" nie może znaczyć „logować wyjątki"**,
bo wyjątków nie ma. Musi znaczyć **kontrolę spójności**: zestaw twardych zdań
o zapleczu, które da się sprawdzić i które muszą być prawdziwe.

### 2. Obecne testy nie mogły tego złapać

`npm test` to **34 pliki, wszystkie nad czystymi funkcjami z `lib/`** —
arytmetyka faktur, daty, walidacja, TOTP. Ani jeden nie dotyka trasy API ani
bazy. 209 przechodzących testów, zero pokrycia tego, gdzie realnie siedzą
błędy: w trasach, w przekazywaniu danych między modułami i w tym, co trasa
zapisuje.

To nie zarzut do tych testów — one pilnują pieniędzy i robią to dobrze.
To wskazanie, czego brakuje obok.

---

## Faza 0 — siatka bezpieczeństwa

**Zanim ruszymy cokolwiek innego.** Dziś jedynym sposobem sprawdzenia, czy
zaplecze działa, jest przeklikanie całej drogi ręcznie. Zajęło to kilka godzin
i trzy razy pomyliłem artefakt narzędzia z błędem panelu.

### 0a. Przejście całej drogi jako test — ✅ ZROBIONE 2026-08-02

`npm run przejscie` (`scripts/przejscie/`, README obok). Pierwszy wynik:
**21 działa · 12 znanych luk · 0 regresji · 1 obejście · 2 pominięte.**

Rozstrzygnięta decyzja techniczna: **`fetch` do działającego `npm run dev`**,
nie PGlite w procesie. Powód: trasy wołają `isAuthed()` przez `next/headers`,
więc poza kontekstem żądania się nie uruchomią — a połowa znalezisk siedzi
właśnie w trasach.

Trzy rzeczy, których nie było widać przed napisaniem:

- **Sprawdzać trzeba powód, nie kod.** Pierwsza wersja uznała lukę A2 za
  naprawioną, bo `/send` zwróciło 400 — ale z powodu pustego e-maila klienta,
  nie braku wystawcy. Rozstrzyga to dopiero sterowana sonda, zmieniająca jedną
  rzecz naraz. Ta sama pułapka czeka w każdej kolejnej fazie.
- **Hamulec publicznych dokumentów (5/60 min) czyni drogę KLIENTA
  niepowtarzalną** — po kilku przebiegach akceptacja i opinia przez publiczny
  link zwracają 429. To dobra decyzja z audytu Modułu 57 i nie osłabiamy jej;
  skrypt dopina te kroki od strony panelu i wypisuje, czego nie sprawdził.
- **Akceptacja od strony panelu nie zapisuje, kto zaakceptował.** Nie nazywam
  tego luką — właściciel odnotowuje wtedy cudzą zgodę, a nie ją składa — ale
  warto to rozstrzygnąć w Fazie 4 przy okazji listy działań nieodwracalnych.

Skrypt mierzy dwie rzeczy, których nie planowałem: **liczbę obejść** (ile razy
trzeba załatać przepływ palcami, żeby dojść do końca — dziś 1, po Fazie 1 ma
być 0) i **liczbę pominięć** (czego przebieg nie sprawdził).

### 0a-bis. Pierwotny opis zakresu

Jedno polecenie przechodzi: lead → wpis w historii → oferta → wysyłka →
akceptacja przez klienta → umowa → podpis → projekt → faktura → wystawienie →
zapłata → opinia. Po **każdym** kroku sprawdza dane, nie kod odpowiedzi.

Przykłady zdań do sprawdzenia (wprost z przejścia):

- po założeniu oferty z leada: `oferta.klient_email == klient.email`
- po wysyłce: `migawka` zawiera blok wystawcy
- po akceptacji: powstał projekt **i** faktura, oba wskazują na tego klienta
- po wygenerowaniu umowy: `umowa.termin_realizacji` nie jest `null`
- po zapłacie: `klient.status != "Prospekt"`

**Do ustalenia w pierwszym kroku:** czy uruchamiamy to na PGlite w procesie
(szybko, bez serwera), czy przez `fetch` do `npm run dev` (wierniej, bo idzie
przez trasy). Skłaniam się do drugiego — bo połowa znalezisk siedzi właśnie
w trasach — ale to decyzja techniczna, nie produktowa, i podejmę ją po
obejrzeniu, jak `lib/dev-db.ts` zachowuje się poza Next.

### 0b. Kontrola spójności jako ekran — ✅ ZROBIONE 2026-08-02

`lib/spojnosc.ts` + czwarty blok w `/api/observability` + sekcja na
`/pl/admin/zdrowie` (pierwsza, na całą szerokość). Osiem reguł, siedem z nich
pilnuje znanych luk, ósma stoi jako czujka nad numeracją faktur.

Reguła jest **zdaniem twierdzącym** („Wygrany lead nie ma już zaplanowanego
przypomnienia”), a ikona mówi, czy jest dziś prawdziwe — dzięki temu lista
czyta się jak opis tego, co zaplecze ma robić, także gdy wszystko jest
zielone. Każde naruszenie wskazuje **konkretny rekord z linkiem**, nie liczbę.

Dwie rzeczy, które wyszły dopiero przy sprawdzaniu na danych:

- **„Poszło do klienta” to `wyslana_at`/`sent_at`, nie `share_token`.**
  Pierwsza wersja reguł kluczowała po tokenie i milczała na wszystkim — bo
  dane z seeda mają status „Wysłana” bez tokenu.
- **Przejście i kontrola spójności złapały się nawzajem na kłamstwie.**
  Przejście raportowało lukę B6, kontrola na tych samych danych — zero
  naruszeń. Rację miała kontrola: skrypt „podpisywał” umowę przez
  `PATCH {status:"Podpisana"}`, trasa to odrzucała (i słusznie: *„Podpisu nie
  ustawia się statusem”*), a skrypt połykał odmowę w ciszy i asertował skutki
  podpisu na **niepodpisanej** umowie. Dwa narzędzia patrzące na to samo
  z dwóch stron są warte więcej niż suma ich części.

### 0b-bis. Pierwotny opis zakresu

Te same zdania, ale uruchamiane na **żywych** danych, nie na testowych.
Wchodzą na istniejący ekran *Zdrowie* (`/pl/admin/zdrowie`) — nowego modułu
nie robimy. Ekran przestaje mówić tylko „czy coś się wywaliło" i zaczyna mówić
„czy zaplecze mówi prawdę".

Reguły z przejścia, na start:

- faktura opłacona ⇒ klient nie jest „Prospektem"
- dokument wysłany ⇒ ma wystawcę w migawce
- projekt z podpisaną umową ⇒ ma termin
- lead „Zamknięte - sukces" ⇒ nie ma żywego `next_followup`
- faktura z projektu, który ma umowę ⇒ `contract_id` nie jest `null`

**Sprawdzenie fazy:** test przechodzi całą drogę i **oblewa** na tych
regułach, które opisuje `PIERWSZE-PRZEJSCIE-NA-SUCHO.md`. Czerwone na starcie
jest wynikiem poprawnym — to znaczy, że siatka łapie.

---

## Faza 1 — jedno przepisanie danych klienta na dokument — ✅ ZROBIONE 2026-08-02

**Zamknęła:** B1 (oferta bierze tylko nazwę), B2 (pusty e-mail na fakturze),
B3 (faktura nie wie o umowie), B4 (formularz leada), B5 (terminy oferty →
umowa), B6 (projekt bez dat, bez statusu, z nazwą od słowa „Oferta").

Powstało `lib/przepisanie.ts` — jedno miejsce, które wie, jak nazywają się
kolumny klienta na dokumencie. Mapa istniała wcześniej w **pięciu kopiach**
(`OfferEditor.pickClient`, `InvoiceEditor.pickClient`, gałąź umowy i gałąź DPA
w `POST /api/contracts`, `acceptOffer`) i każda gubiła co innego. Kto dokłada
nowy rodzaj dokumentu, dokłada wpis do `RODZAJE_DOKUMENTU`.

**Wynik przejścia po fazie: 35 działa · 5 znanych luk · 0 regresji ·
0 obejść · 0 pominiętych** (przed: 21 · 12 · 0 · 1 · 2). Pozostałe pięć luk
to A2 ×2 (Faza 2) oraz C1, C3, C4 (Faza 3). Kontrola spójności na tych samych
danych: trzy reguły Fazy 1 zielone.

### Decyzje właściciela podjęte przy starcie fazy

1. **Kopia + auto-odświeżanie, dopóki dokument jest szkicem.** Dokument
   dostaje komplet przy założeniu; póki jest szkicem, każde otwarcie dociąga
   poprawki z karty klienta (`odswiezDaneKlientaWSzkicu`). Od wysyłki nic już
   nie rusza. Daje efekt „odczyt do wysyłki, kopia od wysyłki" bez
   przepisywania wydruków i stron publicznych. Puste pole karty **nie kasuje**
   tego, co wpisano ręcznie — odświeżanie nie może cofać cudzej roboty.
2. **`contract_id` uzupełniany wstecz** przy generowaniu umowy — tak, i tylko
   tam, gdzie jest jeszcze pusty.
3. **Czas realizacji podaje się w TYGODNIACH od akceptacji**, nie datą (nowa
   kolumna `offers.czas_realizacji_tygodnie`, karta „Realizacja" w edytorze,
   rubryka na wydruku). Tak się realnie mówi klientowi, zanim wiadomo, kiedy
   podpisze; konkretną datę wylicza dopiero umowa.
4. **Akceptacja oferty → projekt „Planowanie"; podpis umowy → „W trakcie"**
   plus daty z umowy. Skutek podpisu jest wspólny dla obu dróg
   (`projektPoPodpisieUmowy`) — nie może zależeć od tego, kto kliknął.

### Czego się przy tym nauczyliśmy

- **Test złapał to, czego kod nie pokazywał.** Pierwsza wersja
  `terminZCzasuRealizacji` sprawdzała datę własnym `/^\d{4}-\d{2}-\d{2}$/`
  i przepuszczała rok „0202" (pułapka `<input type="date">` z `CLAUDE.md`) —
  czyli wpisywała bzdurną datę **na umowę**. Wyszło dopiero z testu
  jednostkowego, nie z przejścia i nie z przeglądarki.
- **Pole trafiło najpierw pod zły nagłówek.** „Czas realizacji" wylądował
  w karcie „WAŻNOŚĆ", a to co innego: ważność jest terminem decyzji KLIENTA,
  czas realizacji obietnicą po NASZEJ stronie. Widać to było dopiero na
  zrzucie, nie w kodzie. Ma własną kartę „Realizacja".
- **Licznik obejść zrobił swoje.** Jedyne obejście (dopisywanie e-maila
  klienta do oferty) zniknęło razem z luką B1 — i to jest ZMIERZONE zero,
  nie brak pomiaru. Mechanizm `obejscie()` zostaje na kolejne fazy.

---

## Faza 2 — jedna bramka „czy to wolno wysłać" — ✅ ZROBIONE 2026-08-02

**Zamknęła:** A1 (mail z `[Twoje imię]`), A2 (dokument bez wystawcy +
migawka), A3 (adres sprzedawcy), A4 (sprzeczny termin z szablonu).

Powstało `lib/bramkaWysylki.ts` — jedna funkcja odpowiadająca „co jest nie tak
z tym dokumentem, zanim wyjdzie", plus `app/[lang]/admin/BramkaWysylki.tsx`
(pasek przy dokumencie + okno przed wysyłką). Pyta ją **siedem** miejsc
wysyłających: trzy edytory, dwie listy, mail zamykający projekt i kontakt
kontrolny na Pulpicie — i, co ważniejsze, **pięć tras**, bo odmowa musi paść
tam, a nie w interfejsie.

**Wynik przejścia po fazie: 47 działa · 3 znane luki · 0 regresji · 0 obejść ·
0 pominiętych** (przed: 35 · 5 · 0 · 0 · 0). Pozostałe trzy luki to C1, C3, C4
— cała Faza 3. Kontrola spójności na czystych danych: reguła „Migawka
wysłanego dokumentu zawiera dane wystawcy" zielona, znacznik `A2` zdjęty.

### Decyzje właściciela podjęte przy starcie fazy

1. **Migawka wystawcy obejmuje też FAKTURĘ**, nie tylko ofertę i umowę.
   Faktura nie miała migawki w ogóle — publiczny link zawsze czytał żywe
   „Dane firmy". Zamraża ją **wystawienie** (nadanie numeru), nie wysyłka: od
   numeru dokument jest niezmienny, a wysyłek bywa kilka.
2. **Panel sam podstawia imię** z „Danych firmy" → „Podpisuje umowy" do
   szkiców maili. Nawiasy, których nie da się wypełnić automatycznie, dalej
   blokują wysyłkę. Puste pole zostawia nawias świadomie — cisza byłaby gorsza.
3. **Pasek w edytorze + okno przed wysyłką.** Pasek mówi o brakach zawczasu,
   okno zatrzymuje w momencie kliknięcia.
4. **Ostrzeżenie przechodzi się jednym kliknięciem** „Wyślij mimo to", bez
   podawania powodu.

### Czego się przy tym nauczyliśmy

- **Test złapał regułę, która nie działała dokładnie na swoim przypadku.**
  Wykrywanie sprzecznych terminów (A4) dzieliło tekst na zdania po kropce —
  i rozbijało „Czas realizacji: ok. 2 tygodnie" na kropce w „ok.", przez co
  fragment z liczbą tracił słowo „realizacji". Reguła milczała dokładnie tam,
  gdzie powstała. Wyszło z testu jednostkowego, nie z kodu i nie z przeglądarki.
- **Backfill migawki omal nie wypuścił prywatnych danych.** Pierwsza wersja
  migracji robiła `to_jsonb(company_settings)` — czyli razem z rezerwą
  podatkową i domyślnymi uwagami edytora, do bloku, który czyta publiczny
  link. Biała lista pól jest jedna (`lib/publicFields.ts`) i obowiązuje też
  po stronie zapisu; publiczne trasy przepuszczają przez nią teraz również
  migawkę, więc żadne przyszłe pole nie wyjdzie tylnymi drzwiami.
- **Siedem miejsc wysyłki, nie cztery.** Plan wymieniał cztery; przy robocie
  wyszły jeszcze dwie listy i kontakt kontrolny z Pulpitu (ten sam szkic
  z „[Twoje imię]", ta sama trasa bez sprawdzenia). Bramka, która obowiązuje
  tylko tam, gdzie akurat zajrzałem, nie jest bramką.
- **Dev-seed umiał zapalić ekran „Zdrowie" na czerwono.** Seed wstawia
  dokumenty prosto `INSERT`-em, więc omija trasy robiące migawkę — siedem
  naruszeń na starcie, wszystkie fałszywe. Czerwień, którą trzeba ignorować,
  przestaje cokolwiek znaczyć, więc seed też dostał migawki.
- **A5 zostaje otwarte.** „ZLECENIODAWCA / WYKONAWCA" w jednej rubryce to
  treść dokumentu prawnego, nie reguła wysyłki — nie mieści się w tej fazie
  i nie ma go w jej zakresie.

### Pierwotny opis zakresu

Dziś każde miejsce sprawdza co innego: oferta blokuje wysyłkę przy braku maila
**klienta**, ale nie przy braku **wystawcy**. Mail zamykający nie sprawdza nic.

Powstaje jedna funkcja odpowiadająca na pytanie „co jest nie tak z tym
dokumentem, zanim wyjdzie" i jedno miejsce w interfejsie, które to pokazuje.
Zwraca listę, nie `true/false` — bo część rzeczy to blokada (brak wystawcy),
a część ostrzeżenie (dwa różne terminy w jednym dokumencie).

Reguły na start:

- **blokada:** brak nazwy/NIP-u wystawcy; nawiasy `[…]` w treści maila; brak
  adresu odbiorcy na umowie
- **ostrzeżenie:** dwa różne terminy w dokumencie; brak sekcji w ofercie
  (panel już to mówi, ale nie przy wysyłce); projekt „W trakcie" w mailu
  mówiącym „zakończony"

Osobno, w tej samej fazie: **migawka obejmuje wystawcę.** Dziś to
`{items, offer, sections}`. Musi być `{…, wystawca}`, inaczej zmiana nazwy
firmy albo numeru konta zmienia wstecz każdy dokument, który klient wciąż może
otworzyć. To jedyne znalezisko z przejścia, które ma skutek prawny.

**Sprawdzenie:** próba wysłania dokumentu bez wystawcy kończy się odmową
**na trasie**, nie tylko w interfejsie (sonda `curl`, wzorem Audytu 1).

---

## Faza 3 — skutki zdarzenia, komplet — jako propozycje — ✅ ZROBIONE 2026-08-02

**Zamknęła:** C1 (opinia nie zamyka projektu), C3 (wygrany lead zostawia
przypomnienie), C4 (klient zostaje „Prospektem"). C2 zamknęła Faza 2 jako
ostrzeżenie bramki.

Powstało `lib/propozycje.ts` — trzy deterministyczne reguły plus decyzje
(`zrób` / `nie teraz` / `przywróć`), `app/api/hub/propozycje` (GET + POST)
i `app/[lang]/admin/Propozycje.tsx` — jedna sekcja wpięta w cztery ekrany:
Pulpit oraz Leady, Klienci i Projekty (zawężona do swojego modułu).

**Wynik przejścia po fazie: 59 działa · 0 znanych luk · 0 regresji ·
0 obejść** (przed: 47 · 3 · 0 · 0). Lista znanych luk z pierwszego przejścia
jest po tej fazie **pusta**.

### Decyzje właściciela podjęte przy starcie fazy

1. **Jedna propozycja na REKORD, nie na zdarzenie.** Klient z trzema
   opłaconymi fakturami dostaje jedną prośbę o przestawienie statusu. Klucz to
   para (reguła, rekord) — ta sama, w której zapisuje się „nie teraz".
2. **„Nie teraz" znaczy „na zawsze" dla tej pary**, nie „za N dni". Do tego
   droga powrotu: „Odłożone (N) — przywróć", bo jedno pomyłkowe kliknięcie nie
   może kasować podpowiedzi bezpowrotnie.
3. **Na razie tylko panel**, bez apki iOS. Trasa jest gotowa do zawołania
   z apki bez zmian po stronie serwera.
4. **Istniejące automaty zostają automatami — z jawną granicą.** Skutek
   wywołany świadomym kliknięciem właściciela i oczywisty (akceptacja oferty →
   lead wygrany) zostaje automatem. Propozycją staje się skutek, który
   przychodzi z zewnątrz (opinia, zapłata) albo nie jest oczywisty (wygrany
   lead z umówionym demo, które i tak może się odbyć).

### Jak to jest zrobione — i dlaczego tak

**Propozycje wyliczają się z DANYCH, nie z zapisu przy zdarzeniu.** Reguła to
zapytanie o stan („klient jest Prospektem, a ma opłaconą fakturę"). Wprost
z lekcji Fazy 2: bramka miała obowiązywać w czterech miejscach, a wysyłek
okazało się siedem. Propozycja zapisywana w trasie obowiązywałaby tylko tam,
gdzie ktoś pamiętał ją dopisać. Stąd za darmo: obie drogi C1 (publiczny
formularz i wpis ręczny) rodzą tę samą propozycję, reguły działają wstecz, a
„jedna na rekord" wychodzi z samego zapytania.

W bazie siedzą **tylko odrzucenia** (`propozycje_decyzje`, klucz główny na
parze reguła+rekord) — samych propozycji nie ma czego trzymać.

**Ekran *Zdrowie* milczy na tym, co właściciel świadomie odłożył**, ale nadal
mówi o propozycjach czekających: czekająca to naprawdę sprzeczny stan, tyle że
z jednoklikowym wyjściem; odrzucona to rozstrzygnięta decyzja, a czerwień
z powodu cudzej świadomej decyzji uczy tylko ignorowania czerwieni.

### Czego się przy tym nauczyliśmy

- **Zamknięcie projektu to nie jeden `UPDATE`.** Przy wejściu w „Wdrożone"
  panel planuje jeszcze dwa kontakty kontrolne (nurture, Moduł 2) i pisze na
  oś klienta — a cały ten komplet siedział WEWNĄTRZ `PATCH /api/projects/:id`.
  Propozycja robiąca sam status po cichu gubiłaby pętlę retencji. Skutek liczy
  teraz jedna funkcja dla obu dróg (`lib/skutkiProjektu.ts`), tym samym
  precedensem co `offerAccept` i `projektPoPodpisieUmowy`.
- **Asercja przeszła przez przypadek.** Pierwsza wersja sprawdzenia „czy
  zaplanował kontakt kontrolny" pytała, czy odpowiedź zawiera słowo „kontakt"
  — i przechodziła na polu `osoba_kontaktowa`. Teraz liczy kontakty przypięte
  do tego projektu i wymaga dokładnie dwóch.
- **`tsc` nie wie nic o więzach bazy.** Czyszczenie przypomnienia leada
  ustawiało `next_action = NULL`, a to kolumna `TEXT NOT NULL DEFAULT ''`.
  Kod się kompilował, typy były czyste, trasa zwracała 500 — wyszło dopiero
  z przejścia.
- **Podgląd w przeglądarce zamrażał animacje** (`document.hidden`, 0 klatek
  rAF), więc odrzucony wiersz zostawał w DOM mimo poprawnego stanu. Rozstrzyga
  przeładowanie strony, nie zrzut ekranu — pomiar rAF odróżnia artefakt
  narzędzia od błędu.

### Pierwotny opis zakresu

**Zasada, zatwierdzona: panel proponuje, właściciel zatwierdza.**

Dziś panel robi jedno i drugie niekonsekwentnie: lead przestawia się sam przy
akceptacji oferty, klient nie przestawia się nigdy. Ujednolicamy w stronę
propozycji.

### Gdzie mieszkają propozycje

**W istniejącym „Wymaga działania dziś"** — na Pulpicie i w module, którego
dotyczą. Nowego modułu nie robimy.

To świadomie **nie jest** „Skrzynka propozycji AI" z
`ai-propozycje-orchestrator-plan` — tamta jest odłożona na koniec i dotyczy
treści generowanych przez model. Tu nie ma modelu: to deterministyczne reguły,
dokładnie w duchu „Świadome decyzje produktowe" z `CLAUDE.md`. Jeśli kiedyś
powstanie tamta skrzynka, będzie można je połączyć — ale nie odwrotnie.

### Kształt propozycji

Jedno zdanie, jeden przycisk „zrób to", jeden „nie teraz". Przykłady:

| zdarzenie | propozycja |
|---|---|
| faktura opłacona | „Drukarnia Helios zapłaciła — przestawić klienta na Aktywny?" |
| klient przysłał opinię | „Opinia przyszła — zamknąć projekt jako Wdrożone?" |
| lead „Zamknięte - sukces" z żywym przypomnieniem | „Lead wygrany, ale ma zaplanowane demo na 5.08 — zdjąć przypomnienie?" |
| projekt „W trakcie", a mail mówi „zakończony" | blokada z Fazy 2, nie propozycja |

„Nie teraz" musi być trwałe — propozycja odrzucona nie wraca następnego dnia.
To jest różnica między pomocnym panelem a natrętnym.

**Sprawdzenie:** po przejściu testowej drogi na Pulpicie stoją dokładnie te
propozycje, których się spodziewamy — ani jednej więcej.

---

## Faza 4 — nieodwracalność i potwierdzenia — ✅ ZROBIONE 2026-08-02

**Zamknęła D1, D3 i D4.** D2 przeniesione do Fazy 5 decyzją właściciela — to
zachowanie listy (sortowanie, przewinięcie, podświetlenie), nie bariera przed
nieodwracalnym skutkiem.

Powstała **jawna lista działań nieodwracalnych** (`lib/nieodwracalne.ts`)
i reguła działająca w obie strony: **co nieodwracalne — pyta, co odwracalne —
nie pyta.**

### Cztery decyzje właściciela

1. **Na liście:** wystawienie faktury i wysyłka do KSeF, wysłanie dokumentu do
   klienta (9 dróg), unieważnienie/wymiana publicznego linku, usunięcie
   **głównego** rekordu (lead, klient, projekt, faktura, oferta, umowa,
   notatka, koszt) plus dwa usunięcia masowe. **Świadomie POZA listą**
   drobiazgi: pozycja faktury, uczestnik wydarzenia, zadanie, kamień milowy,
   przypomnienie, szablon. Repozytorium ma 41 uchwytów `DELETE`; gdyby każdy
   pytał, potwierdzenia klikałoby się na ślepo.
2. **Dwa poziomy.** *Zwykłe* — okno „Na pewno?". *Mocne* — przepisanie frazy
   identyfikującej rekord; zarezerwowane dla czterech rzeczy nie do odkręcenia
   niczym: wystawienie faktury, KSeF, usunięcie klienta, usunięcie projektu
   (oraz masowe usunięcie klientów — przepisuje się LICZBĘ zaznaczonych).
3. **Pyta zawsze** — bez „nie pytaj ponownie" i bez wyłącznika w Ustawieniach.
   Wyłącznik prowadzi do stanu, w którym bariera formalnie jest, a realnie jej
   nie ma, i nikt nie pamięta, kiedy się wyłączyła.
4. **„Dane firmy" dostają Zapisz i Anuluj** (D4) — zmiany siedzą w pamięci,
   zamknięcie z niezapisanymi pyta.

### Bariera mieszka w TRASIE

Trasa odmawia kodem **428** z opisem potwierdzenia; panel dowiaduje się
o barierze dopiero z tej odpowiedzi i z niej bierze treść okna. Panel
FIZYCZNIE nie wie, co jest nieodwracalne — więc lista nie może rozjechać się
na kopię panelową i serwerową (lekcja Fazy 2).

Jedyne, czego trasa nie odsyła, to wymagana fraza: odesłanie jej zamieniłoby
mocne potwierdzenie w formalność. Wartość do przepisania podaje panel, który
ma rekord na ekranie; **porównuje serwer, z danych w bazie.**

**Skutek dla apki iOS:** kontrakt się zmienił, apka tych działań nie potwierdza
i dostanie 428 z czytelnym komunikatem. Decyzja właściciela: szczelnie od razu,
apka do osobnej sesji — brief `docs/natywna-aplikacja/35-brief-potwierdzenia.md`.

### Przy okazji

`lib/shareLinks.ts` czytał kolumny `review_share_token`/`review_share_revoked_at`,
których nie ma w schemacie (są `review_token`/`review_revoked_at`) — „skopiuj
link do formularza opinii" kończyło się **500**, podczas gdy te same przyciski
przy ofercie i umowie działały. Rozjazd był w jednym pliku z poprawnymi
nazwami dwie funkcje wyżej.

---

## Faza 5 — wygląd

**Na koniec, zgodnie z ustaleniem.** Zebrane, żeby nie zginęły:

- `.glass` traci `backdrop-filter` w **zbudowanym** CSS (zostaje tylko
  `-webkit-`) → chrome bez rozmycia
- okna `useUI().confirm/prompt` renderują się poza `.admin-linear` i są
  **jasne** w ciemnym panelu
- wiersz „Daty" wychodzi poza kartę projektu (`x` 1030–1113 wobec karty do
  1102)
- nazwa kamienia milowego ucięta w pół słowa, bez wielokropka
- otwarty próg 24×24 w Katalogu (`CatalogDashboard.tsx`) — trzeci moduł
  z rzędu to odnotowuje, patrz `HANDOFF.md`

---

## Czego w tym planie NIE ma

- **Rejestracji firmy** i wszystkiego z `PO_REJESTRACJI.md` — to bramka
  nietechniczna, poza zakresem.
- **Nowych punktów użycia lokalnego LLM** — pięć zbudowanych wystarcza.
- **Skrzynki propozycji AI** — odłożona, patrz Faza 3.
- **Modułu 16** (wsparcie posprzedażowe) — do pierwszego klienta.
- **Przeprowadzki na NAS** poza etapem 1.
- Kafla „Przychód (ten miesiąc)" pokazującego brutto — **to decyzja
  produktowa właściciela, nie usterka.** Do rozstrzygnięcia osobno.

---

## Jak poznamy, że skończone

Jedno polecenie przechodzi całą drogę od leada do opinii, sprawdza dane po
każdym kroku i kończy się na zielono. Ekran *Zdrowie* na żywych danych nie
zgłasza żadnej niespójności. Dokument bez wystawcy nie wychodzi — i odmawia
tego trasa, nie interfejs.

Wtedy, i dopiero wtedy, zabieramy się za wygląd.
