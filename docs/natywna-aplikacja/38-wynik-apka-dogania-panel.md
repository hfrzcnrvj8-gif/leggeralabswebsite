# Wynik: apka dogoniła panel po dwóch planach zaplecza

**Wykonane:** 2026-08-05, jednym czatem, wg `37-brief-dogonic-panel.md`.
**Repozytorium apki:** `../leggera-hub-ios`, commit bazowy `07b0e56`.
**Panelu NIE ruszano** — `git status` w nim czysty, `tsc` bez uwag.

Wszystkie **pięć** pozycji z briefu zrobione i sprawdzone na symulatorze
przeciwko `npm run dev` + `npm run przejscie`. Przy okazji wyszły **trzy
usterki, których brief nie znał** — opisane niżej, bo dwie z nich to ta sama
rodzina błędu, którą to repo łapie regularnie („kod wygląda dobrze i nic nie
robi").

---

## Decyzje właściciela podjęte na starcie

Brief 36 zostawiał cztery pytania. Trzy z nich rozstrzygnięte 2026-08-05:

| pytanie | decyzja | skutek |
|---|---|---|
| Gdzie mieszkają Propozycje | **tylko Pulpit** | zero nowych żądań; moduły dołożymy, jeśli okaże się, że propozycje umykają |
| Jak wygląda „Nie teraz" | **dwa przyciski pod zdaniem** | jak w panelu; machnięcie palcem odpada — decyzja jest trwała, a gest robi się odruchowo |
| Kolor akcji | **neutralny** | cyjan w apce znaczy „Trwa, w toku" (`Znaczenie.wToku`); wzięcie go tu dałoby jednemu kolorowi dwa znaczenia |

Czwarte (iPad) rozstrzygnęło się samo: sekcja mieszka w `PulpitView`, który na
iPadzie jest tym samym widokiem — nie powstał żaden `*PanelIpad`, więc pułapka
„widok iPada we wspólnej mapie" nie ma jak wystąpić.

**Kolor dopisany do słownika w README apki** — cicha zmiana roli koloru jest
gorsza niż zła rola.

---

## 1. Ekran „Propozycje" (Pulpit)

| plik | rola |
|---|---|
| `LeggeraHubCore/Models/Propozycja.swift` | `Propozycja`, `StanPropozycji`, `OdrzuconaPropozycja`, `DecyzjaPropozycji` |
| `LeggeraHubCore/Models/Pulpit.swift` | pole `propozycje` w `PulpitDzis` (właściwość + `CodingKeys` + `init(from:)`) |
| `LeggeraHubCore/Networking/APIClient.swift` | `zdecydujOPropozycji`, `odrzuconePropozycje` |
| `LeggeraHubCore/Store/AppStore.swift` | `propozycje`, `zdecydujOPropozycji`, `przywrocOdlozonePropozycje` |
| `LeggeraHub/Views/PropozycjeSekcja.swift` | sekcja + `SzczegolyCel.zPropozycji(modul:rekordId:)` |
| `LeggeraHub/Views/Marka.swift` | `PrzyciskDecyzji` — neutralna kapsuła, próg trafienia 24 pt |

**Reguł nie ma w apce.** Zdanie, napis akcji i napis drugiej drogi przychodzą
z serwera gotowe; apka zna tylko `modul` i `rekordId` (żeby otworzyć swój ekran
przez `WidokCelu`) oraz cztery wartości `decyzja`. Nowa reguła w panelu pojawi
się na telefonie bez zmiany ani jednej linijki Swifta.

**Komunikat serwera idzie dosłownie** do kolejki chrome (`store.zglos`), także
przy odmowie 409 — z jednego gardła w sklepie, razem z haptyką.

### Sprawdzone na danych, nie „na oko"

| co | dowód |
|---|---|
| sześć reguł się rysuje | zrzut: 5 propozycji z trzech reguł naraz (dev-baza po `przejscie`) |
| `akcjaAlt` daje DWA przyciski | „Zamknij lead" + „Kontakt za 3 mies." + „Nie teraz" |
| „zrób to" zmienia stan | projekt `459f2c9e`: status `W trakcie` → **`Wstrzymane`** |
| `zrob-alt` idzie INNĄ drogą | lead `34ed0cde`: status BEZ zmiany, `next_followup` = `2026-11-03`, `next_action` = „Wrócić do tematu…" |
| „nie teraz" przeżywa restart | po ubiciu i ponownym starcie apki propozycja NIE wróciła, nagłówek dalej „Odłożone (1)" |
| „przywróć" działa | propozycja wróciła, licznik 23 → 24 |
| 409 nie kłamie | projekt zamknięty `curl`em w panelu, potem kliknięty w apce → serwer 409, lista odświeżona, żadnego „brak połączenia" |

---

## 2. Dwie nowe sekcje Pulpitu

`projektyZagrozone` → sekcja **„Projekty zagrożone"** (z kropką koloru zdrowia
z `ProjektZdrowie.kolor`, wspólnej mapy apki).
`zapomnianeSzkiceUmow` → sekcja **„Zapomniane szkice umów"**.

Obie liczą się do `doZrobienia`, tak jak w panelu liczą się do
`totalActionable` — licznik, który pokazuje mniej niż widać niżej na ekranie,
uczy nie ufać licznikowi.

> **Brief mylił się w jednym miejscu.** „Kształt elementów jest ten sam co
> w sekcjach, które apka już rysuje… wystarczy nowa właściwość" — nieprawda dla
> szkiców umów. `staleContracts` niesie `silenceDays`, a `zapomnianeSzkiceUmow`
> **`draftAgeDays`**. Dekodowanie ich jako tego samego pola dałoby wszędzie
> „szkic od 0 dni" i nic by tego nie zgłosiło. `PulpitUmowa` ma teraz osobne,
> opcjonalne `wiekSzkicuDni`.

**Weryfikacja niepełna i trzeba to powiedzieć wprost:** „Projekty zagrożone"
widać na zrzucie z prawdziwymi danymi (`Leggera Source — Zagrożony · W trakcie ·
termin 29 wrz 2026`). „Zapomnianych szkiców umów" **nie dało się wyprodukować
lokalnie**: reguła panelu wymaga `created_at < dziś`, a dev-baza PGlite żyje
w pamięci procesu `next dev`, więc każdy rekord powstaje dzisiaj. Brief
twierdził, że „przejście zostawia zapomniany szkic umowy" — nie zostawia
(sprawdzone: `zapomnianeSzkiceUmow: 0` po dwóch przebiegach). Sekcja jest
bliźniakiem sąsiedniej, sprawdzonej, i dekoduje własne pole, ale **pierwszy
prawdziwy dowód przyjdzie z produkcji.**

---

## 3. Wybór poziomu windykacji

- `LeggeraHubCore/Models/Windykacja.swift` — `PoziomWindykacji`,
  `PoziomyWindykacji`, `Windykacja.poziomy/dniZwloki/poziomZDniZwloki`.
  Bliźniak `poziomyWindykacji()` z `lib/invoices.ts`, arytmetyka na SAMYCH
  datach ISO (nie `Calendar` na `Date` — to rozjazd z Audytu 6).
- `LeggeraHub/Views/WyborPoziomuWindykacji.swift` — okno wyboru, jedno dla
  trzech ekranów (lista faktur, profil faktury, Pulpit).
- `PulpitFaktura` dostała `reminderLevel` — bez tego to samo działanie
  z Pulpitu wysyłałoby zawsze poziom podpowiadany, a z profilu dawało wybór.

### Pierwszy cel testowy w repozytorium apki

`LeggeraHubCore/Tests/LeggeraHubCoreTests/WindykacjaTests.swift`, **9 testów,
wszystkie zielone** (`cd LeggeraHubCore && swift test`). Brief kazał dołożyć
test „obok tego, co już tam jest" — a nie było tam nic: pakiet nie miał celu
testowego w ogóle. Zakres świadomie wąski: tylko CZYSTE reguły przepisane
z panelu. Widoków stąd nie sprawdzamy, od tego jest symulator.

### To okno NIE jest drugim „na pewno?"

Do dziś stało tu pytanie „Wysłać przypomnienie o płatności?" z jednym
przyciskiem — a trasa i tak pyta drugi raz (428, bo mail jest nieodwracalny).
**Dwa pytania pod rząd o to samo to dokładnie ten dług, który sprzątała Faza 4**
(README: „Osiem własnych okien »na pewno?« ZNIKŁO") — przy fakturach zostało
przeoczone. Teraz okno pyta o co INNEGO: **który list ma pójść**. A gdy
dozwolony poziom jest tylko jeden, okna nie ma wcale — apka wysyła, a jedynym
pytaniem zostaje arkusz zgody.

### Sprawdzone

FV 92/2026, **25 dni po terminie, `reminder_level = 0`**:
- okno pokazało trzy poziomy z „Wezwanie do zapłaty — **podpowiadane**",
- wybrane **uprzejme** przypomnienie → arkusz 428 → wysłane,
- w bazie `reminder_level = 1`, w logu maila „przypominam o płatności"
  (a nie wezwanie) — **to jest sedno znaleziska C2**,
- po ponownym otwarciu okno dopisało „Do klienta wyszło już: uprzejme
  przypomnienie",
- po wysłaniu poziomu 2 **„Uprzejme przypomnienie" ZNIKŁO z listy** —
  eskalacja nie cofa się w dół.

---

## 4. Karta „Odpowiedź na wersję N" (oferta)

`PoprzedniaWersjaOferty` + sekcja w `OfertaDetailView`, wysoko — zaraz pod
nagłówkiem, bo to kontekst do czytania całej reszty. Bez koloru: odmowa
POPRZEDNIEJ wersji jest przeszłością, a nie stanem tej oferty.

Zrzut: „Odpowiedź na wersję 1 · Za drogo — Zarząd uciął budżet, chcą sam PoC ·
Klient odmówił 5 sie 2026" + odnośnik do wersji 1. Gdy poprzedniczka nie
została odrzucona, tylko zastąpiona — zdanie brzmi „Poprzednia wersja nie
została odrzucona — zastąpiłeś ją sam" (rozstrzyga `odrzucona_at`, nie status).

---

## 5. Rubryka „Wynika z" (faktura)

`Faktura` dostała `offerID`/`contractID`, `FakturaSzczegoly` — `warunki`
(`WarunkiZlecenia`). Sekcja pokazuje ofertę, umowę i — **tylko gdy to on ustala
kwotę** — aneks, ze zdaniem serwera („Aneks nr 1 z 05.08.2026") i kwotą
obowiązującą. Tylko do odczytu: powiązania przepina się w panelu.

Zrzut z FV 93/2026: Oferta · Umowa `UM-2026-0375EC` · Aneks nr 1, „Obowiązuje
11 000,00 zł".

---

## Trzy usterki znalezione po drodze (brief ich nie znał)

### A. `?odrzucone=1` doklejone do ścieżki dawało 404

`wyslij(_:)` idzie przez `appendingPathComponent`, które traktuje cały napis
jako JEDEN segment i koduje znak zapytania:
`/api/hub/propozycje%3Fodrzucone=1` → **404**. Objaw był mylący — pod palcem
wyglądało to na martwy przycisk „Odłożone — przywróć", nie na zły adres.
Rozstrzygnął dziennik `next dev`, nie czytanie kodu. Adres składa teraz
`URLComponents`, tak jak w szukaniu.

### B. Poziom windykacji kłamał zaraz po wysyłce

`wczytajFakture` dociąga wyłącznie SZCZEGÓŁY; `reminder_level` siedzi
w nagłówku z listy `/api/invoices`, której nikt nie odświeżał. Po wysłaniu
poziomu 2 okno dalej oferowałoby poziom 1, a serwer odbijałby go 400-tką.
Sklep zapisuje teraz poziom zwrócony przez serwer (`max` z obecnym — serwer mógł
wysłać wyższy, niż prosiliśmy, i tylko on to wie).

### C. Bloki treści oferty NIGDY się nie pokazywały

`OfertaSzczegoly` ma pole `sekcje` od 2026-07-27, `OfertaDetailView` rysuje
z niego sekcję „Treść oferty" — a `pobierzOferte` **nie dekodowało `sections`
ani `contract`**. Bloki pojawiały się wyłącznie po dołożeniu bloku z telefonu
i znikały przy następnym wejściu na profil. Ani błędu, ani pustego stanu.
Naprawione przy okazji `poprzednia` (ta sama struktura odpowiedzi) — widać na
zrzucie oferty wersji 2 („ZAKRES PRAC — Wdrożenie lokalnego modelu…").

Do tego jedna pomyłka złapana na zrzucie: wiersz „Umowa" pokazywał numer
ANEKSU (`zrodlo.reference`), bo `zrodlo` przy podpisanym aneksie wskazuje
aneks. Numer umowy-matki jest w osobnym `warunki.umowa.reference`.

---

## Czego NIE zrobiono

- **Trzy rzeczy z listy „nie rób"** — odrzucenie oferty przez klienta, ikona
  dla `offer_rejected`, hierarchia akcji na ofercie. Sprawdzone i potwierdzone:
  nie ma tam nic do zrobienia.
- **Propozycje w listach modułów** — świadomie odłożone (decyzja właściciela).
  `SekcjaPropozycji` przyjmuje `StanPropozycji` z zewnątrz, więc wpięcie jej
  w moduł to dołożenie żądania `?modul=`, nie przebudowa.
- **Banera z komunikatem serwera nie widać na żadnym zrzucie.** Wisi 4 sekundy,
  a obrót „stuknij → zrób zrzut" w tym środowisku trwa dłużej. Treść przechodzi
  do tej samej kolejki chrome, z której korzysta cała reszta apki
  (`store.zglos`), a skutek każdej decyzji sprawdzony w danych — ale to jedyny
  punkt z tej paczki, którego nie potwierdza obrazek.
- **Haptyki nie da się sprawdzić w symulatorze** — jej tam nie ma w ogóle
  (README). Sygnał stoi w jednym gardle sklepu, razem z resztą akcji.

## Weryfikacja lokalna — dwie rzeczy, które kosztowały czas

- **`LEGGERA_DEV_HASLO` przegrało wyścig z odzyskiwaniem sesji** i apka
  została na ekranie logowania. Pewniejsza droga: wybij token `curl`em
  i podaj go przez `LEGGERA_DEV_TOKEN`.
- **Logowanie tą samą nazwą urządzenia unieważnia poprzedni token** — apka,
  która akurat działa, wylatuje do ekranu logowania w środku sprawdzania.
  Przy kolejnych przebiegach dawaj nazwy `Sym-1`, `Sym-2`…
