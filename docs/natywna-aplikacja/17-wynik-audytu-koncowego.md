# Wynik audytu końcowego aplikacji (Faza 13.4)

> Wykonany 2026-07-21 wg `16-brief-audyt-koncowy-apki.md`. Repo apki:
> `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios` (89 plików, ~22 650 linii).
> Poprzednik: `08-wynik-audytu-apki.md` (Faza 11½). Numeracja ustaleń jest
> ciągła — „A1" znaczy tu to samo, co tam.
>
> Metoda: pomiar (grep + build + zrzuty z symulatora), nie czytanie komentarzy.
> Każde ustalenie niżej ma albo linię kodu, albo zrzut, albo obie rzeczy.

## Streszczenie

Fundament jest dobry i to się nie zmieniło. **Nie znaleziono ani jednej
martwej metody `AppStore`** — trzeci audyt z rzędu bez tego. Wszystkie 21 furtek
`LEGGERA_DEV_*` udowodniono jako DEBUG-only twardo: `strings` na binarce
Release daje **zero** wystąpień. Osiem z dziewięciu poprawek z audytu 11½
weszło i trzyma się.

Znaleziono jednak coś **poważniejszego niż A1**, i to poprawka z poprzedniego
audytu je wprowadziła: **apka na niedostępnym zapleczu nie przestawała czekać
nigdy**. Zmierzone: ekran Leadów kręcił kręciołkiem od 09:37 do 09:45 i dalej —
bez błędu, bez timeoutu, bez wyjścia. Kluczowe jest to, że ta usterka
**unieważniała także tę obsługę błędów, która w apce jest**: `LeadsListView`
czyta `bladLeadow` poprawnie, ale komunikat nie miał skąd przyjść, skoro
żądanie nigdy się nie kończyło.

Drugi motyw to A1, który znów urósł i został **zmierzony inaczej niż dotąd**:
nie „ile miejsc pisze do jednego pola", tylko „ile ekranów potrafi skłamać".
**19 ekranów pokazuje pusty stan, 16 z nich nie czyta żadnego pola błędu.**

Trzeci: **panel lokalny był całkowicie zepsuty** i nikt tego nie zauważył —
każda trasa `/api/*` zwracała 500. To dyskwalifikowało zdanie „zweryfikowane na
panelu lokalnym" z ostatnich dwóch faz.

Czwarty motyw dorzucił sam właściciel w trakcie sesji i okazał się trafniejszy
niż połowa tego, co znalazł grep: **licznik spraw na Pulpicie nie schodził po
obsłużeniu maila** (N10). To A8 w najdotkliwszej postaci — liczba, na której
opiera się cały pierwszy ekran, potrafiła kłamać przez cały dzień.

W tej sesji naprawiono: ustalenia **N1** (timeout), **N2** (Wyspa przy
wylogowaniu), **N3** i **N4** (panel lokalny), **N5** (kolor), **N6** (martwy
kod), **N7** (opinie), **N10** (licznik Pulpitu). **A1 zostaje otwarte
świadomie** — właściciel wybrał
kształt rozwiązania (jedna kolejka w chrome), ale to osobna paczka pracy.

---

## Część A — ustalenia, wg priorytetu

### N1. KRYTYCZNY — żądanie mogło czekać **7 dni**, nie 20 sekund ✅ NAPRAWIONE

`APIClient.swift:163` ustawiał `waitsForConnectivity = true` i **nie** ustawiał
`timeoutIntervalForResource`, którego wartość domyślna to **7 dni**. Komentarz
nad tą linią twierdził wprost coś przeciwnego:

> „Limit `timeoutIntervalForRequest` (20 s) nadal obowiązuje od chwili, gdy
> połączenie realnie ruszy — więc to nie jest furtka do wiszenia
> w nieskończoność."

To zdanie było nieprawdziwe. `waitsForConnectivity` nie honoruje limitu
żądania, dopóki połączenie **w ogóle nie ruszy** — a właśnie „nie ruszyło" jest
tym, co się dzieje, gdy panel jest niedostępny.

**Dowód (pomiar, nie rozumowanie).** Symulator,
`LEGGERA_DEV_BACKEND=http://10.255.255.1:3000` (adres, który pochłania pakiety
bez odpowiedzi — czyli realny „panel padł / zły WiFi", nie „port zamknięty"):

| Czas | Stan ekranu Leadów |
|---|---|
| 09:37:17 | start apki |
| 09:38:03 | sam kręciołek |
| 09:45:00 | **sam kręciołek, bez zmian** |

Trzy niezależne przebiegi (Leady, Zaplanowane, `127.0.0.1:3999`) dały to samo.

Skutki były dwa i oba gorsze niż A1: właściciel na słabym zasięgu dostawał
ekran, który nigdy niczego nie powie **i nigdy się nie podda**; a poprawne
obsługi błędów w trzech widokach były martwe, bo `catch` nie miał kiedy
zadziałać.

*Naprawa* (`APIClient.swift`): dwie sesje zamiast jednej, bo
`timeoutIntervalForResource` jest własnością **sesji**, a nie żądania, więc
jeden limit musiałby być albo za długi dla listy leadów, albo za krótki dla
wysyłki maila:

- `session` — limit zasobu **45 s** (trasy zwykłe, własny timeout 20 s),
- `sesjaDluga` — limit zasobu **120 s** dla trzech tras, które z natury trwają:
  synchronizacja IMAP (90 s), wysyłka SMTP (70 s), szkic od lokalnego modelu
  (70 s). Ucięcie wysyłki po 45 s zrywałoby połączenie po tym, jak mail już
  poszedł — czyli w najgorszym możliwym momencie.

Dwa pobierania załączników (mail, koszt) chodzą przez `URLSession.shared`
i nigdy nie miały tego problemu — `shared` nie ma włączonego
`waitsForConnectivity`.

**Dowód naprawy:** ten sam scenariusz, 10:37:57 → **10:38:42** (45 s) i na
ekranie staje „Panel nie odpowiedział na czas. Spróbuj jeszcze raz."

### A1. WYSOKI — cicha utrata błędów. OTWARTE, kształt rozwiązania wybrany

Stan zmierzony 2026-07-21:

| Miara | 11½ | dziś |
|---|---|---|
| przypisań do `bladLeadow` | 59 | **67** |
| widoków czytających `bladLeadow` | 2 | 3 |
| **ekranów z pustym stanem** | — | **19** |
| **z tego czytających JAKIEKOLWIEK pole błędu** | — | **3** |

Nowy sposób pomiaru jest ważniejszy od starego. Pytanie nie brzmi „ile miejsc
pisze do wspólnego pola", tylko **„ile ekranów potrafi powiedzieć »nic nie ma«,
kiedy naprawdę znaczy »nie wiem«"**. Odpowiedź: 16 z 19.

Najostrzejszy przykład, bo ekran sam siebie opisuje: `ZaplanowaneView` — jego
własny komentarz otwiera się zdaniem „niewidoczna kolejka to najgorszy rodzaj
kolejki", po czym przy padniętej sieci ekran pokazuje **„Nic nie czeka.
Odłożone wiadomości pojawią się tutaj, zanim polecą."** Bo `pobierzKolejkeWysylki()`
(`AppStore.swift:559`) w `catch` pisze do `bladLeadow` i **zwraca `[]`** — a ten
widok `bladLeadow` nie czyta.

Po naprawie N1 widać to jeszcze wyraźniej: na zrzucie z Leadów stoi teraz
komunikat o błędzie **i pod nim** „Brak leadów — Gdy pojawi się zgłoszenie,
zobaczysz je tutaj". Prawda i nieprawda na jednym ekranie.

Trzy istniejące pola są dobrze pomyślane i nie są długiem — `bladAkcji`
(arkusze, Faza 13.1), `odmowaBramki` (409, `GlownaBelka.swift:79`), `bladLeadow`
(awarie). Problem jest w tym, że to trzecie obsługuje dwanaście modułów naraz.

**Decyzja właściciela (2026-07-21): jedna kolejka komunikatów w chrome**, wzorem
`odmowaBramki`, zamiast dwunastu pól modułowych. Do wykonania w osobnej paczce.
Uwaga do tamtej pracy, wynikająca z pomiaru wyżej: **sama kolejka nie wystarczy**.
Trzeba przy okazji dać pustym stanom trzeci wariant — „nie udało się wczytać"
obok „pusto" i „ładuję" — inaczej 16 ekranów dalej będzie mówić „nic nie ma".

### N2. WYSOKI — Wyspa kolejki wysyłki zostawała na wylogowanym telefonie ✅ NAPRAWIONE

`AppStore.wyczyscSesje` (`:107-108`) gasiła przypomnienia i Wyspę **stopera**,
ale nie Wyspę **kolejki wysyłki** (czwarty typ aktywności, Faza 13.3 #2).
`KolejkaWyspaSterowanie.zakonczWszystkie()` istniało i nie miało ani jednego
wołającego spoza własnego pliku.

Skutek: po wylogowaniu na Dynamic Island zostawała godzina wysyłki maila,
o którym to urządzenie nie ma już prawa nic wiedzieć — **i zostawała tam na
stałe**, bo odświeżenie (`RootView.odswiezKolejke`) ma `guard store.sesja ==
.zalogowany`. Znikała dopiero, gdy iOS ubijał aktywność po ~8 h.

*Naprawa*: nowe domknięcie `AppStore.zakonczWyspeKolejki`, wstrzykiwane tym
samym wzorcem i w tym samym miejscu co reszta (`LeggeraHubApp.podepnijStoper`),
wołane z `wyczyscSesje`.

Sprawdzone przy okazji i **DOBRZE**: Wyspa odczytu zdjęcia gasi się sama po
zakończeniu transferu (okno na osierocenie to tylko trwający odczyt), a Wyspa
stopera jest sprzątana poprawnie w każdej ścieżce — `odswiezStoper()` woła
`zakonczWyspe?()` **przed** każdą decyzją, więc aktywność osierocona przez
ubicie apki ginie przy pierwszym wejściu na Projekty.

### N3. WYSOKI (panel) — dev-seed padał, panel lokalny zwracał 500 na WSZYSTKIM ✅ NAPRAWIONE

`lib/dev-db.ts` wstawia wiersze do `time_entries`, ale nie wołał
`ensureTimeSchema()`. Ponieważ PGlite jest **w pamięci** (brak `dataDir`), seed
odpala się od nowa przy każdym `npm run dev`, a `seedPromise` jest cache'owany —
więc jeden błąd w seederze kładzie **wszystkie** trasy `/api/*` na cały czas
życia procesu.

Zmierzone przy starcie tej sesji: `GET /api/leads` → **500**, `42P01
relation "time_entries" does not exist`.

Wpis czasu doszedł 2026-07-20 razem z danymi do Statystyk (commit `6abb977`) —
`ensureTimeSchema()` nie doszedł. Ten sam plik ma zresztą przy kosztach
komentarz opisujący **dokładnie ten scenariusz** jako złapany „na własnej
skórze"; pułapka wróciła mimo ostrzeżenia napisanego dzień wcześniej.

To ustalenie ma konsekwencję poza sobą: **zdanie „zweryfikowane na panelu
lokalnym" z Faz 13.2 i 13.3 nie mogło być prawdziwe w takiej formie**, w jakiej
środowisko wygląda dziś. Warto o tym pamiętać, czytając tamte tabelki.

### N4. WYSOKI (panel) — `GET /api/costs` zwracał 500 na świeżej bazie ✅ NAPRAWIONE

`app/api/costs/route.ts` SELECT-uje `c.client_id, c.lead_id`, a wołał wyłącznie
`ensureCostsSchema()`. Te dwie kolumny zakłada `ensureLinksSchema()` — i robi to
poprawnie sąsiedni `app/api/costs/[id]/route.ts`, który został zrobiony dobrze
od początku. Trasa listy została pominięta.

Zmierzone: `42703 column c.client_id does not exist`, całe Koszty w apce
niedostępne. Na produkcji jest to **utajone** (migracja „links" dawno tam
poszła), ale każda nowa baza — dev, kopia, odtworzenie z backupu na NAS-ie —
dostaje 500.

*Naprawa*: `await ensureLinksSchema()` w `GET`.

### N5. ŚREDNI — Ustawienia łamały słownik koloru najgłośniejszym elementem ekranu ✅ NAPRAWIONE

`UstawieniaView.swift:65` — `Button(role: .destructive)` na „Wyloguj to
urządzenie", bez `.tint`. To jaskrawa systemowa czerwień, czyli dokładnie to,
co README zakazuje („`role: .destructive` jest zakazane"), a `Marka.swift`
punkt 3 opisuje jako usunięte: *„Czerwień znika. »Wyloguj« to nie kasowanie
danych"*. Do tego stopka tuż pod przyciskiem mówi wprost, że nic nie ginie.

To odpowiedź na pytanie z briefu („czy słownika trzymają się ekrany zbudowane
PO 2026-07-20"): Ustawienia powstały **2026-07-21**, dzień po audycie koloru,
i regułę złamały.

**Dowód pomiarem, nie okiem** — najbardziej czerwony piksel napisu:

| | RGB |
|---|---|
| przed | `(255, 66, 69)` — systemowa czerwień |
| po | `(139, 39, 47)` — `Color.ciemnaCzerwien` (#8B272F) |

Reszta 15 wystąpień `role: .destructive` w apce jest **w porządku i została
bez zmian**: to przyciski w `confirmationDialog` (gdzie systemowa czerwień jest
konwencją Apple i dotyczy realnego kasowania) albo gesty w bok, które i tak mają
jawne `.tint(.ciemnaCzerwien)` obok.

### N6. ŚREDNI — martwy kod: dziennik notatki i stara wersja kropek kalendarza ✅ NAPRAWIONE

Trzy rzeczy bez ani jednego wołającego:

| Co | Gdzie | Dlaczego jest martwe |
|---|---|---|
| `pobierzDziennikNotatki` | `APIClient:1247` | apka nigdy nie umiała pokazać dziennika notatki |
| `dopiszDoDziennikaNotatki` | `APIClient:1255` | …ani nic do niego dopisać |
| `NotatkaWpisLogu` | `Notatka.swift:106` | model używany wyłącznie przez te dwie metody |
| `dniZTrescia(miesiac:)` | `AppStore:1937` | zastąpione przez `rodzajeDni` przy przebudowie siatki kalendarza 2026-07-20, nieusunięte |

Pierwsze trzy to ten sam wzorzec, co Moduły 30/31, tylko o piętro wyżej: nie
„pole jest, nikt go nie wysyła", a „cała warstwa sieci jest, nikt jej nie woła".
Trasa `/api/notes/:id/activity` w panelu istnieje i działa — jeśli dziennik
notatki ma kiedyś trafić na telefon, wraca razem z ekranem, nie przed nim.

Audyt 11½ szukał martwych metod `AppStore` (nie znalazł — i dziś też nie ma).
Ten szukał także w `APIClient` i **tam** je znalazł: to jedyne miejsce, gdzie da
się napisać kompletną funkcję i nie zauważyć, że nikt jej nie używa.

### N7. ŚREDNI — Statystyki: procent pokrycia udawał ocenę ✅ NAPRAWIONE

`StatystykiView.swift:130`:

```swift
wartosc: s.reviews.avgClientRating.map { "%.1f/5" } ?? procent(s.reviews.pct)
```

Slot obok etykiety **„Opinie klientów"** czyta się jako **ocena**. Gdy średniej
nie ma, wpadało tam `pct`, czyli **pokrycie** — „60%" znaczyło „6 z 10
zamkniętych projektów ma opinię", a wyglądało jak „klienci oceniają na 60%".
Panel (`StatsDashboard.tsx:126`) stawia w tym miejscu „—" i ma rację; liczba
zebranych opinii stoi w podpisie, gdzie nie da się jej pomylić z oceną.

*Naprawa*: `?? "—"`, plus gwiazdka przy ocenie (`★ 4,5/5`), tak jak w panelu.

### N10. WYSOKI — licznik Pulpitu nie schodził po obsłużeniu maila ✅ NAPRAWIONE

**Zgłoszenie właściciela, nie znalezisko audytu** (2026-07-21, już po napisaniu
reszty tego dokumentu): *„wchodzę w mail, ustawiam że mail jest obsłużony,
a na pulpicie ciągle pozostaje tyle samo spraw do obsłużenia"*.

Potwierdzone w kodzie i to jest **A8 w najbardziej dotkliwej postaci**.
`doZrobienia` (`Pulpit.swift:304`) sumuje osiem kolejek naraz, w tym
`maileDoObslugi`, i liczy je **serwer** (`/api/hub/today`). Widoki żyją
w `TabView`, więc `.task` Pulpitu odpala się **raz na uruchomienie apki** —
akcja w zakładce Poczta zmieniała tablicę `poczta`, ale agregatu nie ruszała
nic. Ta sama cisza dotyczyła opłacenia faktury, zalogowania rozmowy, zmiany
statusu projektu i dodania wydarzenia.

Ciekawe, że wzorzec naprawy **już był w pliku**: kontakty nurture wołają
`odswiezPulpit()` zaraz po akcji (`AppStore:1265,1280`). Nikt tego nie
uogólnił — czyli znów „jedno miejsce zrobione dobrze, jedenaście pominiętych".

*Naprawa*: flaga `pulpitNieaktualny` + `oznaczPulpitDoOdswiezenia()`, wołane
z ośmiu miejsc mutujących (wspólne gardło zmian maila załatwia pięć akcji
naraz), a `PulpitView.onAppear` odświeża agregat, jeśli flaga stoi.

Świadomie **flaga, nie odświeżanie po każdej akcji**: przejście przez dziesięciu
nadawców w screenerze to byłoby dziesięć zapytań `/api/hub/today`, których nikt
w tej chwili nie ogląda. Przy okazji `odswiezPulpit()` dostało
`guard !ladujePulpit`, bo `onAppear` i `.task` przy zimnym starcie wysyłały dwa
identyczne żądania w tej samej chwili. Nieudane odświeżenie **nie** kasuje
flagi — inaczej jedna awaria sieci zamrażałaby licznik do końca sesji.

**Dowód (kliknięte w symulatorze, nie wyrozumowane):** Pulpit „12" → Poczta →
otwarcie „Zapytanie o wdrożenie" → „obsłużone" → powrót na Pulpit → **„11"**,
a wiadomość zniknęła z sekcji „Poczta do obsługi".

To ustalenie zmienia też ocenę **A8**: nie jest już „średnie, dane bywają
nieświeże", tylko „licznik, na którym opiera się cały Pulpit, potrafi kłamać
przez cały dzień". Reszta A8 (pełne odświeżenie po powrocie z tła po wielu
godzinach) zostaje otwarta.

### N8. NISKI — auto-podpowiedź NIP zgaduje tam, gdzie panel odmawia

`KosztDetailView.swift:39` bierze `store.klienci.first { normalizujNip(...) == nip }`.
Panel (`lib/links.ts:208-211`) w tej samej sytuacji jest ostrożniejszy:

```ts
if (byNip.length === 1) return { ... , pewnosc: "nip" };
if (byNip.length > 1) return null;   // NIP jest unikalny z natury — dwa trafienia
                                     // znaczą, że kartoteka ma duplikat. Nie zgadujemy.
```

Przy dwóch klientach z tym samym NIP-em (ta sama firma wpisana dwa razy —
sytuacja realna, nie teoretyczna) apka zaproponuje **losowego** z nich, panel nie
zaproponuje żadnego. Sama normalizacja jest zgodna co do joty (`filter(\.isNumber)`
↔ `replace(/\D/g,"")`).

Zostawione **świadomie do decyzji**, bo poprawka to jedna linia, ale zmienia
zachowanie funkcji, którą właściciel zdążył polubić. Naprawa: `filter` zamiast
`first`, i podpowiedź tylko przy dokładnie jednym trafieniu.

### N9. NISKI — README nie zna dwóch wartości własnej furtki

`LEGGERA_DEV_WIECEJ` przyjmuje także `statystyki` i `ustawienia`
(`WiecejView.swift:30`), a lista w README kończy się na `oferty`. Drobiazg, ale
tej samej rodziny, co `LEGGERA_DEV_TAB` z audytu 11½: furtka, której nie ma
w instrukcji, wygląda jak zepsuta.

Poza tym **komplet się zgadza**: 21 furtek w kodzie, 21 w README, zero
w jedną i zero w drugą stronę.

---

## Co z audytu 11½ jest nadal otwarte

Sprawdzone w kodzie, nie w notatkach:

| | Rzecz | Stan |
|---|---|---|
| A2 | zatruty bufor kalendarza | ✅ naprawione |
| A3 | zaokrąglanie czasu ≠ panel | ✅ naprawione |
| A4 | rabat na pozycji faktury | ✅ naprawione |
| A6 | etykiety poczty, kolor KSeF, filtr VIP | ✅ naprawione |
| A6 | **strefa czasowa** (`wymagaDzialania` liczy wg strefy telefonu) | ⏳ otwarte |
| A7 | wyścig przy przełączaniu folderów | ✅ naprawione |
| A10 | usuwanie wydarzenia bez potwierdzenia | ✅ naprawione |
| A11 | zimny start szeregowo + duplikaty | ✅ naprawione |
| A11 | **pełny `GET /api/mail` po każdej akcji poczty** | ⏳ otwarte |
| A12 | powód błędu sieci odrzucany | ✅ naprawione |
| A13 | `LEGGERA_DEV_WIECEJ` wygaszało `OPEN_INVOICE` | ✅ naprawione |
| **A5** | **Umowy: sygnał bez akcji** (`api/contracts` — 0 wywołań) | ⏳ otwarte |
| **A8** | **brak odświeżenia danych po powrocie z tła** | ⏳ otwarte |
| **A9** | **usuwanie wpłaty niemożliwe z telefonu** | ⏳ otwarte |
| A13 | `KlientDetailView` bez edycji pól; pola dekodowane i nieużywane | ⏳ otwarte |

A8 zostało **częściowo domknięte przez N10**: licznik Pulpitu odświeża się teraz
po każdej akcji, która go zmienia. Otwarta zostaje druga połowa — telefon
leżący w kieszeni cały dzień nadal pokaże po odblokowaniu wczorajszy stan, bo
`RootView.onChange(of: faza)` przy `.active` robi trzy rzeczy (blokada, odbiór
odczytu, kolejka) i nie odświeża danych. Dołożenie czwartej to jedna linia
w miejscu, które już jest.

## Co sprawdzono i wyszło DOBRZE

- **Zero martwych metod `AppStore`** — trzeci audyt z rzędu. 134 publiczne
  symbole, każdy ma realnego wołającego.
- **Furtki DEBUG udowodnione twardo**: build Release + `strings` na binarce →
  **0 wystąpień `LEGGERA_DEV`**. To nie jest już „każda ma `#if DEBUG`", tylko
  „w wersji dla właściciela tego kodu fizycznie nie ma".
- **Sprzątanie Wysp stopera i odczytu** — poprawne w każdej ścieżce, łącznie
  z ubiciem apki (patrz N2).
- **Kolejka wysyłki jako całość** jest solidnie zrobiona: `przyjmijIstniejaca()`
  odzyskuje aktywność po restarcie procesu (bez tego powstawałaby druga Wyspa
  dla tego samego maila), anulowanie odświeża Wyspę, wiersz wypadły z okna 50
  pozycji gasi ją po cichu zamiast zmyślać finał, a `staleDate` jest powtarzany
  przy każdej aktualizacji.
- **Kontrakty tras kształtowania projektu** (zadania, kamienie, zasoby,
  zależności) zgodne z panelem co do nazw pól i metod.
- **`role: .destructive` poza jednym miejscem** używane poprawnie — w dialogach
  potwierdzenia i zawsze z jawnym `.tint` przy gestach.
- **`WybranePowiazanie`** trzyma kolory 1:1 z `DEADLINE_STYLE` panelu, a różne
  kontrakty (wydarzenie/koszt biorą projekt, notatka nie) są udokumentowane
  i przestrzegane.

## Świadomie NIE naprawione

| Co | Dlaczego |
|---|---|
| **A1 — kolejka komunikatów w chrome** | Kształt wybrany przez właściciela 2026-07-21, ale to osobna paczka: dotyka 67 miejsc zapisu i ~19 pustych stanów. Robienie tego „przy okazji" audytu skończyłoby się połowicznie, a A1 połowicznie już raz zrobiono (`bladAkcji`, Faza 13.1). |
| **N8 — podpowiedź NIP** | Jedna linia, ale zmienia zachowanie działającej funkcji. Do decyzji właściciela: czy przy duplikacie NIP-u w kartotece apka ma zgadywać, czy milczeć jak panel. |
| **A5, A8, A9** | Nie są usterkami, tylko brakującym zakresem (Umowy) albo funkcją do dołożenia. Każde to własna paczka pracy — patrz „Część B" audytu 11½, gdzie mają wyceny. |
| **A6 — strefa czasowa** | Naprawa dotyczy OBU repozytoriów (panel liczy `daysSince()` w UTC, przecząc sąsiedniemu `todayLocalISO()`). Objawia się wyłącznie między 00:00 a 02:00 albo przy podróży za granicę. Idzie do Audytu 6 panelu, nie tutaj. |
| **Wyloguj w `confirmationDialog`** | Zostawiony z `role: .destructive`. To standardowy dialog systemowy, gdzie czerwony przycisk potwierdzenia jest konwencją iOS-a; zmiana odróżniłaby go od wszystkich pozostałych dialogów w apce. Zgłoszenie dotyczyło przycisku widocznego na liście i ten został poprawiony. |
| **Podział `AppStore.swift`** | 2165 linii, bez zmiany od 11½. Odpowiedź ta sama: **jeszcze nie**. 22 sekcje `// MARK:` trzymają się, nazwy się nie zderzają. Realnym długiem jest duplikacja (64 kopie `catch APIError.nieautoryzowany`), a ta rozwiąże się przy A1 — helper `wykonaj<T>(_:)` i kolejka komunikatów to ta sama robota. Dzielić dopiero, gdyby po A1 nadal przeszkadzał. |
| **„Poziom 3"** | Faktury, korekty, KSeF, oferty, umowy — nietknięte, zgodnie z briefem (`Finanse.swift:17-18`). |
| **Stała Wyspa Pulpitu, lokalizacja, Apple Watch, dzielenie na targety** | Odrzucone wcześniej, bez nowych argumentów. |

## Czego ten audyt NIE mógł sprawdzić

Bez dotyku i bez czasu na czekanie — lista niezmieniona od briefu, żadna z tych
rzeczy nie zamknęła się w symulatorze:

- rozwinięta Wyspa (długie przytrzymanie) i karta na ekranie blokady — dla
  wszystkich trzech typów aktywności,
- **dwie–trzy Live Activity naraz** (brief pytał wprost; kod na to pozwala, ale
  nikt tego nie widział),
- realne stuknięcie „Stop" na Wyspie stopera,
- zachowanie Live Activity po ~8 h,
- prawdziwa wysyłka SMTP z kolejki (dev nie ma skrzynki IMAP),
- Siri, Share Extension i widżet po ostatnich zmianach,
- Face ID: pełny cykl blokada → karencja → powrót,
- **N1 na prawdziwym modemie** — poprawka jest zweryfikowana na symulatorze;
  tryb samolotowy i słaby zasięg na telefonie mogą zachować się inaczej niż
  wirtualna sieć Maca.

To jest treść jednej sesji z telefonem w ręku i nie ma sensu jej dzielić.

## Do przekazania Audytowi panelu (`docs/AUDYTY-KONCOWE.md`)

Trzy rzeczy wyszły przy okazji i dotyczą **wyłącznie panelu**:

1. **N3 i N4 są objawami jednej reguły**, której panel nie ma spisanej:
   *trasa, która SELECT-uje kolumnę, musi wołać migrację, która tę kolumnę
   zakłada — nie migrację tabeli, w której kolumna mieszka.* `costs.client_id`
   należy do „links", nie do „costs". Warto przejść tak wszystkie trasy, a nie
   tylko tę jedną; ja poprawiłem ten jeden potwierdzony przypadek.
2. **Dev-seed potrzebuje własnego strażnika.** Dopóki jeden brakujący
   `ensure*Schema()` kładzie cały panel lokalny i nikt tego nie zauważa przez
   dobę, „zweryfikowane lokalnie" jest zdaniem bez pokrycia.
3. **Strefa czasowa** (A6 wyżej) — `lib/leads.ts:246` liczy `daysSince()` w UTC,
   przecząc sąsiedniemu `todayLocalISO()`.
