# Wynik audytu aplikacji natywnej (Faza 11½)

> Wykonany 2026-07-20 wg `07-brief-audyt-apki.md`. Repo apki:
> `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios` (~15 350 linii Swifta).
> Metoda: pełne czytanie `AppStore.swift` i `APIClient.swift`, grep-owe
> sprawdzenie każdej publicznej metody pod kątem „czy ktoś to WOŁA",
> porównanie 22 par reguł panel ↔ apka, przegląd wszystkich widoków.

## Streszczenie

Fundament jest w dobrym stanie — na tyle, że Faza 11 (macOS) może na nim
stanąć bez przebudowy. **Nie znaleziono ani jednej całkowicie martwej metody
`AppStore`** (udokumentowany wzorzec błędów tego projektu tym razem się nie
powtórzył). Bramka umowy 409, wylogowanie na 401, timeouty per trasa,
defensywne dekodowanie `NUMERIC` z Neona — wszystko zrobione poprawnie.

Znalezione problemy dzielą się na dwie grupy: **cicha utrata błędów**
(jedno wspólne pole błędu dla 12 modułów) i **rozjazdy reguł z panelem**
(pięć realnych, w tym jeden dotyczący czasu, z którego wystawia się faktury).

---

## Część A — ustalenia, wg priorytetu

### A1. WYSOKI — błędy 11 z 12 modułów nikną bez śladu

`AppStore.swift:19` — jedno pole `bladLeadow` przyjmuje komunikat z **59
miejsc** (notatki, kalendarz, rejestr, faktury, poczta…), ale czytają je
tylko `LeadsListView.swift:20` i `EdytorWiadomosciView.swift:396`.

Skutek: nieudany zapis notatki, nieodhaczone zadanie, padnięty kalendarz —
użytkownik widzi „nic się nie stało". Gorzej: błąd z Poczty wyskakuje potem
na ekranie Leadów pod ikoną `wifi.exclamationmark`, jako rzekoma awaria sieci.

*Naprawa*: pole błędu per moduł albo jedna kolejka toastów w chrome (wzorzec
`odmowaBramki` z `GlownaBelka.swift:79` już to robi dobrze).

### A2. WYSOKI — zatruty bufor kalendarza: terminy mogą nie wczytać się nigdy

`AppStore.swift:1364-1373`. Strażnik sprawdza tylko `wydarzeniaMiesiaca[m]
!= nil`, a przypisania są dwa i sekwencyjne. Jeśli pierwsze żądanie przejdzie,
a drugie padnie (timeout, przełączenie WiFi→LTE między nimi), miesiąc zostaje
na stałe oznaczony jako wczytany, bez terminów. Wracają dopiero po
pull-to-refresh albo restarcie apki.

*Naprawa*: strażnik na oba słowniki, albo przypisanie obu dopiero po `try await`.

### A3. WYSOKI — `Stoper.format` zaokrągla inaczej niż panel

Zweryfikowane bezpośrednio w obu plikach:

- panel `lib/time-tracking.ts:32` → `Math.round(totalSeconds / 60)` — **zaokrągla**
- apka `Models/Czas.swift:141` → `.rounded(.down)` — **obcina**

90 s: panel „2 min", apka „1 min". 1 godz. 59 min 40 s: panel „2 godz.",
apka „1 godz. 59 min". Komentarz w Swifcie deklaruje „1:1 z `formatDuration()`"
i tego nie dotrzymuje.

To ten sam czas pracy pokazany dwiema liczbami — a jest to czas, na podstawie
którego wystawia się fakturę. Poprawny jest panel.

### A4. WYSOKI — pozycje faktury z rabatem nie sumują się do pokazanej kwoty

`rabatProcent` jest dekodowane (`Models/Finanse.swift:125,145`), ale wiersz
pozycji (`FakturyView.swift:307`) go nie rysuje. Faktura z pozycją
„10 × 1000 zł" i rabatem 20% pokaże pozycje sumujące się do 10 000 zł, a w
sekcji „Kwoty" (liczonej przez serwer) 8 000 zł — bez wyjaśnienia skąd różnica.

Piąty przypadek wzorca „pole jest, nikt go nie pokazuje". Naprawa: jedna linia
w opisie pozycji.

### A5. WYSOKI — Umowy: apka sygnalizuje problem i nie daje żadnego wyjścia

Pulpit pokazuje sekcję „Umowy bez odpowiedzi" (`PulpitView.swift:273-283`),
**nieklikalną**. Apka nie woła `/api/contracts` ani razu, choć panel ma pełny
moduł (`app/api/contracts/`, `/[id]/send`, `/[id]/accept`).

Do tego bramka umowy blokuje zmianę statusu projektu (409) — czyli apka mówi
„nie możesz, bo brakuje umowy" i nie pozwala tej umowy wysłać. Sygnał bez akcji.

### A6. ŚREDNI — cztery kolejne rozjazdy reguł z panelem

| Reguła | Rozjazd | Poprawny |
|---|---|---|
| Etykiety kategorii poczty | apka: „Oferta"/„Inne"; panel: „Zapytanie"/„Rozmowa" | panel |
| KSeF `wyslano` | apka: „czeka na przetworzenie" + **złoty**; panel: „Wysłano" + **cyan** | panel |
| Strefa czasowa (`isOverdue` leada, `poTerminie` projektu) | apka liczy wg strefy telefonu, panel wg Warszawy | patrz niżej |
| Filtr VIP | apka nie sprawdza kierunku/folderu — własny wysłany mail bywa „VIP-em" | panel |

Złoty w panelu znaczy „wymaga uwagi", a nie „w obiegu" — kolor KSeF w apce
mówi coś przeciwnego niż w panelu o tym samym stanie.

Strefa czasowa to jedyny przypadek, gdzie **obie strony mają rację częściowo**:
apka liczy sensowniej (pełne dni kalendarzowe zamiast ułamków dób), ale robi to
w strefie telefonu; panel trzyma się Warszawy, ale `daysSince()` w
`lib/leads.ts:246` liczy w UTC, przecząc sąsiedniemu `todayLocalISO()`.
Objaw: między 00:00 a 02:00 lead „wymaga działania" w apce i nie wymaga
w panelu. Naprawa dotyczy obu repozytoriów.

### A7. ŚREDNI — wyścig przy przełączaniu folderów poczty

`PocztaListView.swift:53-58` odpala nieanulowalne `Task {}` przy każdej zmianie
folderu/filtru. Szybkie Odebrane→Archiwum→Odebrane może skończyć się listą
Archiwum wpisaną do stanu po tym, jak wróciła Odebrane. Ten sam wzorzec w
`AppStore.swift:1305`.

Wzorzec naprawy **już istnieje w projekcie** i działa: `SzukajView.swift:71-74`
(anulowanie poprzedniego zadania + `Task.isCancelled`).

### A8. ŚREDNI — dane nie odświeżają się po powrocie z tła

`GlownaBelka.swift:30` to `TabView`, więc widoki żyją dalej i `.task` odpala
się raz. Jedyny `onChange(of: scenePhase)` (`LeggeraHubApp.swift:105`) obsługuje
wyłącznie Face ID. Telefon leżący w kieszeni cały dzień pokaże po odblokowaniu
wczorajszy Pulpit — bez żadnego znaku, że dane są nieaktualne.

### A9. ŚREDNI — usuwanie wpłaty niemożliwe z telefonu

Trasa w panelu istnieje (`app/api/invoices/[id]/payments/[paymentId]/route.ts:8`,
DELETE), apka jej nie woła. „Oznacz jako opłaconą" jest z telefonu
**nieodwracalne** — pomyłka wymaga wejścia do panelu na komputerze.

### A10. ŚREDNI — jedyna destrukcyjna akcja bez potwierdzenia

`KalendarzView.swift:56-63` — swipe „Usuń" kasuje wydarzenie od razu. Cała
reszta apki pyta (faktury, koszty, subskrypcje, szablony), a Notatnik rozwiązał
to jeszcze lepiej: swipe archiwizuje odwracalnie, kasowanie żyje w Archiwum.

### A11. NISKI — wydajność startu i poczty

- Zimny start = **7 żądań szeregowo**, w tym 2 duplikaty (`/api/leads`
  i `/api/clients` pobierane dwa razy: raz w `start()`/`GlownaBelka`, raz w
  `PulpitView`). Na LTE to 7 kolejnych round-tripów zamiast dwóch fal.
  Naprawa: `async let` + usunięcie duplikatu.
- Każda akcja na poczcie (archiwizuj/odłóż/przepuść) robi PATCH + **pełne**
  `GET /api/mail`. Przejście przez 10 nadawców w screenerze = 20 żądań i 10
  przeskoków listy pod palcem. Wzorzec optymistyczny (`nanies()`,
  `AppStore.swift:568`) już istnieje — te cztery metody go nie używają.
- `odswiezPoczte()` gubi frazę wyszukiwania (`AppStore.swift:394`) — akcja
  podczas szukania podmienia listę na pełny folder, a pole nadal pokazuje frazę.

### A12. NISKI — sieć: powód błędu jest odrzucany

`APIClient.swift:56` — `case siec(String)` niesie powód, którego **żadna**
ścieżka nie pokazuje. Brak internetu, timeout 20 s i błąd DNS dają jeden
nierozróżnialny komunikat „Brak połączenia z panelem". Nie ma też
`waitsForConnectivity` ani żadnego ponowienia, więc żądanie złapane w momencie
przełączenia WiFi→LTE po prostu ginie.

### A13. NISKI — drobiazgi

- `LEGGERA_DEV_TAB` ma **dwóch** konsumentów (`GlownaBelka.swift:109` i
  `LeadDetailView.swift:55` jako zakładka profilu leada) — README zna jednego;
  nie da się użyć obu naraz.
- `LEGGERA_DEV_WIECEJ` wygasza `OPEN_INVOICE/OFFER/COST` (`WiecejView.swift:132`,
  kolejność warunków) — wygląda na zepsutą furtkę, a jest niedopatrzenie.
- Pola dekodowane i nieużywane: `ProjektSzczegoly.onboarding`, `.rentownosc`,
  `Faktura.reminderLevel`, `PulpitUmowa.status`, `WynikKontaktuZMaila.typ/.id`
  (przez to nie da się przejść do leada utworzonego z maila).
- `KlientDetailView` nie ma edycji pól — NIP-u ani adresu klienta nie da się
  poprawić z telefonu, choć Lead ma pełny formularz. Prawdopodobnie świadome,
  ale warte potwierdzenia.
- `KalendarzView` jako jedyna duża lista bez `ContentUnavailableView` (17
  innych widoków je ma).

### A14. Czy dzielić `AppStore.swift`?

**Jeszcze nie — i nie z powodu rozmiaru.** 22 sekcje `// MARK:` są uczciwie
poukładane, nazwy się nie zderzają, znajdowanie rzeczy działa. Analogia do
`lib/db.ts` w panelu jest trafna: dzielić tylko jeśli utrudnia.

Co **realnie** przeszkadza, to duplikacja: **64 kopie** `catch
APIError.nieautoryzowany { await wyczyscSesje() }` i **59 kopii** budowania
komunikatu błędu. To ~130 linii kopiuj-wklej i 64 miejsca, gdzie łatwo pominąć
`catch`.

Zalecana kolejność: **najpierw jeden helper** `wykonaj<T>(_:)` (łapie 401, 409
i resztę) — skraca plik o ~400 linii bez ruszania struktury. Dopiero gdyby to
nie wystarczyło: cięcie na `extension AppStore` w osobnych plikach (Poczta
384–844 to jedyny kandydat, który sam się prosi), **nie** na osobne klasy —
osobne store'y zepsują Pulpit, który czyta leady + klientów + agregat naraz.

### Co sprawdzono i wyszło DOBRZE

- **Zero martwych metod** `AppStore` — każda ma realnego wołającego.
- **Bramka umowy (409)**: pełna, poprawna ścieżka od `APIClient:1291` po
  dedykowany alert w chrome, z dosłownym komunikatem serwera.
- **401 → wylogowanie**: konsekwentne we wszystkich 64 miejscach;
  `wyczyscSesje` czyści komplet 22 pól, przypomnienia i token.
- **Żadna z 11 flag `laduje*` nie może zawisnąć na `true`** — sprawdzone
  wszystkie ścieżki wyjścia.
- **Timeouty per trasa** (20 s / 70 s wysyłka / 90 s IMAP / 110 s OCR) —
  przemyślane i uzasadnione komentarzami.
- **Kursor rejestru**: dedup po `id` (kursor serwera jest włączny) + twarde
  zakończenie na pustej stronie. Poprawne.
- **Defensywne dekodowanie `NUMERIC`** (Double albo String) we wszystkich
  modelach finansowych — znany rozjazd Neona obsłużony konsekwentnie.
- **Pułapka `<input type="date">` w apce nie występuje** — wszystkie 7 pól to
  natywne `DatePicker` związane z `Date`. Rok „0202" jest tu strukturalnie
  niemożliwy; to problem wyłącznie panelu.
- **13 z 22 par reguł zgodnych co do joty** — m.in. `parseQuickAdd`,
  `waLink`/`linkedinLink`, `Snooze.opcje`, `isInvoiceOverdue`, `isOfferExpired`,
  wszystkie listy statusów i etykiet.
- **Wszystkie 12 furtek DEBUG działa** i każda ma poprawne `#if DEBUG` — w
  Release tego kodu fizycznie nie ma.
- **Brak jakiegokolwiek pollingu** — apka nie odpytuje serwera w tle ani razu.
- **`SzczegolyCel`** po przeniesieniu na poziom pliku jest zdrowe — żaden
  `NavigationLink` nie trafia w brak destynacji.
- **Kwoty nie są liczone w Swifcie** (poza `pozostaloDoZaplaty` z
  zaokrągleniem) — decyzja z Fazy 10 utrzymana.

### Reguły panelu, których apce brakuje

- `daysOverdue()` + `reminderLevelForDays()` — apka pokazuje, jaki poziom
  przypomnienia poszedł, ale nie umie powiedzieć „należy się już poziom 2".
  Windykacja to jedyne miejsce, gdzie apka mogłaby realnie przypomnieć o
  pieniądzach.
- `overdueReason()` / `clientOverdueReason()` — apka mówi ŻE lead zalega, nie
  DLACZEGO.
- `relativeDeadline()` — „za 3 dni" / „3 dni po terminie"; apka ma suche
  „po terminie" bez liczby.
- `LEAD_STATUS_HINT` / `CLIENT_STATUS_HINT` — cała warstwa „mentora" nie
  istnieje w apce.

---

## Część B — kandydaci na nowe funkcje

**To NIE jest lista zleceń.** Każdy wymaga decyzji właściciela.

### B1. Live Activity / Dynamic Island dla stopera — ZIELONE ŚWIATŁO

Wszystkie trzy obawy sprawdzone i żadna się nie potwierdziła:

- **Osobny target NIE jest potrzebny.** `Widzet` to już
  `com.apple.widgetkit-extension` (`project.yml:44-73`) — dokładnie ten typ,
  w którym mieszka `ActivityConfiguration`. Zamiana `@main Widget` na
  `WidgetBundle` to ~6 linii (`Widzet/Widzet.swift:146`).
- **Płatne konto Apple NIE jest wymagane.** Lokalne Live Activity
  (`Activity.request()`/`.update()` z wnętrza apki) nie ma żadnego
  entitlementu — wystarczy `NSSupportsLiveActivities` w Info.plist głównej
  apki (dziś go brak; idzie przez `project.yml:31-38`). Płatne konto dotyczy
  tylko zdalnej aktualizacji push-tokenem, której stoper nie potrzebuje.
- **Aktualizacje cykliczne niepotrzebne.** `Text(timerInterval:)` tyka sam po
  stronie systemu z jednej daty startu, a `AktywnyStoper.poczatek`
  (`Models/Czas.swift:87`) już ją daje.

Wpięcie jest gotowe: `AppStore` używa wstrzykiwanych domknięć
`zaplanujPrzypomnienia`/`skasujPrzypomnienia` (`AppStore.swift:1200-1201`)
wołanych w trzech miejscach. `uruchomWyspe`/`zakonczWyspe` wchodzą tym samym
wzorcem, w te same punkty. Zero przebudowy. Bonus: `odswiezStoper()` już
obsługuje „stoper wystartował z panelu webowego" — Wyspa odziedziczy to za darmo.

**Szacunek: jedna sesja, ~150-200 linii.**

Ryzyka: Dynamic Island jest tylko na iPhone 14 Pro+ (na starszych Live Activity
działa, ale wyłącznie na ekranie blokady); wariant `project-telefon.yml` buduje
bez rozszerzeń, więc tam Wyspy nie będzie (znane ograniczenie, jak dziś z
widżetem); przycisk „Stop" prosto z Wyspy wymaga `AppIntent` (iOS 17+, dostępne).

### B2. Liczba spraw z Pulpitu na Wyspie — ODRADZAM jako osobną Live Activity

Nie z powodu kosztu, tylko dlatego, że **wyjdzie zepsute**. Live Activity ma
z definicji skończony czas życia — iOS ubija ją po ~8 godzinach. Stoper wpasowuje
się idealnie (ma początek i koniec), ale licznik spraw to stan permanentny:
musiałby wisieć wiecznie, a system go zdejmie. Do tego aktualizacja liczby
wymagałaby albo działającej apki, albo push-tokenu (czyli płatnego konta).

Dynamic Island pokazuje wyłącznie *aktywne* Live Activity — nie jest powierzchnią
na stały wskaźnik. Tę rolę pełni **już istniejący widżet ekranu głównego**
(`Widzet.swift:44-66`, odświeżanie co 30 min z `GET /api/hub/today`).

**Kompromis w zasięgu ręki**: rozwinięty stan Wyspy stopera może pokazać
`doZrobienia` jako drugą linię. Jeden mechanizm, +30 min pracy — ale widoczne
tylko, gdy stoper chodzi.

### B3. Kod QR z danymi przelewu na koszcie — ZIELONE ŚWIATŁO

Kluczowe ryzyko („czy w bazie w ogóle jest numer konta") wypada pomyślnie:

- Kolumna istnieje: `lib/db.ts:1348` — `costs.dostawca_konto`
- API ją zwraca: `app/api/costs/route.ts:18` i `app/api/costs/[id]/route.ts:24`
- Panel ją wypełnia (`CostEditor.tsx:414`), a OCR paragonu nawet odczytuje z
  walidacją 26 cyfr (`lib/costs-ocr.ts:112`), z weryfikacją Białą Listą MF

**Po stronie panelu i bazy nie trzeba dokładać niczego** — rzadka sytuacja
w tym projekcie.

Brief miał rację co do apki: `Models/Cost.swift` dekoduje 12 pól i
`dostawca_konto` wśród nich nie ma. To ~3 linie do dodania; serwer już wysyła.

Payload: **polski standard ZBP** (`buildPolishQrPayload`, `lib/documents.ts:99`),
nie EPC — ten drugi jest wyłącznie dla EUR (`:81`). QR w SwiftUI bez żadnej
zewnętrznej zależności: `CoreImage` + `CIQRCodeGenerator`.

**Szacunek: pół sesji.** Podział: pole w modelu (~3 linie), port
`buildPolishQrPayload` jako czysta funkcja w rdzeniu (~30 linii — świadomie
w rdzeniu, żeby dało się sprawdzić bez symulatora), generator + widok (~60 linii).

Pułapki: dane do QR muszą iść przez `.isoLatin1`, nie `.utf8`; wynik ma ~23×23 px
i wymaga skalowania `CGAffineTransform` **przed** rasteryzacją plus
`.interpolation(.none)`, inaczej bank kodu nie odczyta; nazwa odbiorcy jest
ucinana do 20 znaków (to standard, nie bug); starsze koszty mają puste konto
(`DEFAULT ''`), więc widok musi to powiedzieć wprost, a nie rysować pusty kod.
Weryfikacja końcowa wymaga prawdziwego telefonu z aplikacją bankową — symulator
pokaże tylko, że kod się wygenerował.

### B4. Pozostali kandydaci

| Kandydat | Stan | Praca |
|---|---|---|
| **Umowy w apce** (patrz A5) | serwer gotowy, apka nie ma ekranu | 1 sesja |
| **Usuwanie wpłaty** (A9) | trasa DELETE gotowa | ~15 linii + funkcja w APIClient |
| **Podgląd paragonu** | serwer gotowy (`api/costs/[id]/attachment`, treść w bazie — bez IMAP-u); wzorzec `ZalacznikiSekcja.swift` do powtórzenia | pół sesji |
| **Siri: „zatrzymaj stoper"** | `startStopera`/`stopStopera` w APIClient gotowe; `ProjektEntity` bliźniakiem `LeadEntity` | pół sesji |
| **Siri: koszt z paragonu** | `openAppWhenRun` prosto do `KosztZParagonuView` | drobne |
| **Siri: „oznacz fakturę opłaconą"** | **odradzam** — akcja pieniężna bez potwierdzenia na ekranie | — |

Podgląd paragonu ma jedno ograniczenie: `Cost` niesie tylko `zalacznikNazwa`,
bez typu MIME i rozmiaru — ikonę trzeba zgadnąć z rozszerzenia, rozmiaru nie da
się pokazać bez zmiany serwera.

---

## Do przekazania Audytowi 6 panelu (`docs/AUDYTY-KONCOWE.md`)

Punkt 6 tamtego audytu („parytet panel ↔ apka — zrób listę reguł istniejących
w dwóch miejscach") jest **wykonany tutaj**: 22 pary sprawdzone, 13 zgodnych,
5 z rozjazdem (A3, A6), 4 istniejące tylko w panelu. Nie robić drugi raz.

Jedno ustalenie dotyczy **wyłącznie panelu** i wyszło przy okazji:
`parsePgTimestamp()` (`lib/dates.ts:107`) jest wołany tylko z `lib/backup.ts:49`,
podczas gdy `notificationAge()` (`lib/notifications.ts:103`) i `daysSinceISO()`
(`lib/dates.ts:86`) robią `new Date(createdAt)` na `TIMESTAMPTZ` — dokładnie ta
pułapka, którą komentarz przy `parsePgTimestamp` opisuje jako „wyszła już dwa
razy". Apka ma to zrobione odpornie. Do sprawdzenia, czy te trasy zwracają
surowy format Postgresa.
