# Wynik: płynność, haptyka i „premium" (Faza 15)

> Wykonane 2026-07-21 wg `19-brief-plynnosc-i-haptyka.md`. Repo apki:
> `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`, commit `4a5b515`,
> **wydanie 52** wgrane na iPhone'a 15 Pro Max.
>
> Metoda: grep + build + telefon. Trzy ustalenia briefu okazały się nieścisłe
> i są sprostowane niżej — dokumentacja tego projektu bywała nieprawdziwa,
> więc każde zdanie ma tu linię kodu albo pomiar.

## Streszczenie

Zgłoszenie („przejścia szarpane, klatkujące, zupełnie nie jak Apple") miało
trzy przyczyny i brief trafnie je rozdzielił. **Wskazał jednak złe miejsce
naprawy przy pierwszej z nich** — poprawienie tego, co wskazywał, nie
zmieniłoby na ekranie nic.

Zrobione w kolejności z briefu: najpierw jedno źródło (`Ruch.swift`), potem
rozprowadzanie. Haptyka nie została rozpisana po 53 widokach, tylko wpięta
w **wspólne gardła** `AppStore` — dzięki temu nowa akcja przechodząca tamtędy
dostaje ją sama z siebie, zamiast czekać, aż ktoś pamiętał.

## Sprostowania briefu (pomiar, nie lektura)

### 1. Przyczyna „najpierw START, potem wybór zadania" była gdzie indziej

Brief: *„`ProjektDetailView` ma `.transition(.opacity.combined(with: .scale))`
przy `PrzyciskWyboruZadania` — ale nic tej zmiany nie animuje"*.

Nieprawda. Animacja jest — `ProjektDetailView.swift:748`, sprężyna 0.42/0.82 —
i działa poprawnie przy start/stop stopera. Prawdziwy skok siedział piętro
niżej: `StoperPasek.swift:257` miał gołe

```swift
.opacity(store.szczegolyProjektu[projektID] == nil ? 0 : 1)
```

Przycisk **stoi w układzie od początku** i przeskakuje z 0 na 1 w chwili, gdy
dojdą dane — bo ta wartość nie stała w niczyim `value:`. Gdyby pójść za
briefem, właściciel zobaczyłby dokładnie ten sam skok.

Nauka na przyszłość: **`transition` bez `animation` i `opacity` bez `animation`
dają ten sam objaw.** Widok martwego `transition` nie jest dowodem, że to on
odpowiada za skok.

Ten sam mechanizm złapany przy okazji obok: blok „Dziś" na profilu projektu ma
`.transition(.opacity)`, ale pojawia się przy nadejściu danych, czego również
nikt nie pilnował. Naprawione drugim `value:`.

### 2. Sprężyn wpisanych z palca były trzy, nie jedna

Brief wskazywał `StoperPasek.swift:183`. Ta sama para 0.42/0.82 stała też
w `ProjektDetailView.swift:750`, a w wariancie 0.32/0.82 w `LicznikCzasu.swift:84`.
Do tego **13 użyć `.snappy` w czterech odmianach** (goła, 0.18, 0.24, 0.25).
Żadna z tych różnic nie była decyzją — każda była tym, co akurat wpisano.

### 3. Kręciołek był wzorcem, nie przeoczeniem

Brief: wzorzec optymistyczny „nie jest używany w stoperze". Zgadza się, ale
skala jest większa: `wTrakcie → ProgressView → czekaj` występuje w **24 plikach
widoków**, a `nanies()` istnieje wyłącznie w Poczcie (2 wołania). To nie jest
„o stoperze zapomniano", tylko „Poczta jako jedyna to dostała".

### 4. Haptyki było 0 — to się potwierdziło

Jedyne trafienie grepa (`SzybkaAkcja.swift:5`) to słowo „Haptic" w komentarzu.

## Co zostało zrobione

### Jedno źródło: `LeggeraHub/Views/Ruch.swift`

Bliźniak `lib/motion.ts` panelu, ta sama rola i ta sama krzywa.

| Stała | Rola | Odpowiednik w panelu |
|---|---|---|
| `Ruch.plynny` | tween: przełączanie ekranów, wejście treści | `TWEEN` / `EASE_LIQUID` |
| `Ruch.sprezyna` | domyślna: karty, kapsuła stopera, układ | `SPRING` |
| `Ruch.dotyk` | reakcja na palec: wciśnięcie, filtr, przełącznik | — (potrzeba iOS-owa) |
| `Ruch.licznik` | ŚWIADOMY wyjątek: cyfry mają „dojechać" | `SPRING_SOFT` |

Plus `.gotowe(_:)` — modyfikator na treść czekającą na dane, czyli lekarstwo
na klasę błędów z punktu 1, i `AnyTransition.wejscieTresci`.

Po zmianie w apce **nie ma ani jednej sprężyny ani krzywej wpisanej z palca**
(grep: 0 wystąpień `.snappy`, `.spring(response:`, `.easeInOut` poza `Ruch.swift`).

### Haptyka — wariant B, wybrany przez właściciela

Decyzja właściciela 2026-07-21: **haptykę dostaje każda zmiana danych wywołana
palcem**; nawigacja, filtry, wybory w menu i przełączanie zakładek milczą.

Kluczowa decyzja wykonawcza: **sygnał mieszka w `AppStore`, nie przy
przyciskach.** Rdzeń zgłasza `odczuj?(.zmiana/.akcja/.sukces/.odmowa)`,
a `Dotyk.zagraj` w warstwie iOS to odgrywa — `LeggeraHubCore` nie importuje
UIKit-a i nie zacznie. Ten sam wzorzec haczyka, co Wyspa i przypomnienia.

Powód: reguła nadrzędna briefu brzmi „wszędzie tak samo", a haptyka wpisywana
przy każdym przycisku łamie ją z definicji — rozjechałaby się po 53 plikach
dokładnie tak, jak rozjechały się sprężyny. Sygnał stoi przy **wspólnych
gardłach**, więc jedno miejsce obsługuje wiele akcji:

| Gardło | Ile akcji |
|---|---|
| `wyslijZmianeWiadomosci` | 5 (status, folder, odłożenie, screener, gwiazdka) |
| `akcjaProjektu` | 8 (kamienie, zasoby, zależności, checklista) |
| `wyslijIObsluz` | 3 (odpowiedź, przekazanie, nowa wiadomość) |

Razem **31 punktów zgłoszenia** w rdzeniu. Nazwy niosą **znaczenie, nie siłę**
(`zmiana`/`akcja`/`sukces`/`odmowa`) — ten sam zabieg, co `Znaczenie` przy
kolorze, i z tego samego powodu: „lekka/średnia" każdy dobiera na wyczucie.

Trzy świadome pominięcia, żeby nikt ich nie „naprawił":

- **`bladLeadow` (65 miejsc) — bez haptyki.** To głównie ciche awarie
  wczytywania w tle; telefon w kieszeni na słabym zasięgu wibrowałby sam
  z siebie. Haptyka jest odpowiedzią na dotyk, nie alarmem. Odmowa leci
  z `bladAkcji` (7 miejsc) i z bramki umowy 409.
- **Kasowanie idzie przez `zmiana`, nie `akcja`.** W tej apce każdy gest
  „Usuń" ma potwierdzenie w dialogu — mocny sygnał plus dialog to dwa
  ostrzeżenia o jednym czynie.
- **Menu po przytrzymaniu i „przeciągnij, żeby odświeżyć"** mają haptykę
  systemową; własna dałaby podwójne stuknięcie.

### Stoper reaguje pod palcem

`startStopera`/`stopStopera` zmieniają stan **przed** żądaniem
(`AktywnyStoper(niepotwierdzony:)`) i cofają go, gdy zaplecze odmówi.
Kręciołek zniknął — ikona przełącza się przez `.symbolEffect(.replace)`,
a `wTrakcie` pilnuje już tylko podwójnego stuknięcia.

Dwie rzeczy zrobione świadomie inaczej, niż podpowiada odruch:

- **Wyspy ani przypomnień nie zakładamy na obietnicę** — zostają w gałęzi
  sukcesu. Live Activity założona i cofnięta sekundę później zostawia migot
  na Dynamic Island.
- **Cofnięcie przy STOPIE jest ważniejsze niż przy starcie.** Pomiar leci
  wtedy dalej na serwerze, więc zgaszony licznik kłamie w stronę, która
  kosztuje: właściciel przestaje mierzyć czas, który wejdzie na fakturę.

## Runda druga — po testach właściciela na wydaniu 52

Wydanie **53** (`b460285`). Właściciel zgłosił pięć rzeczy; haptykę ocenił
jako dobrą („generalnie czuć, myślę że jest w porządku"), a w animacjach nie
znalazł nic, co kłuje w oczy.

### „Na dwie raty" WRÓCIŁO — bo to nigdy nie był problem animacji

Najważniejsze ustalenie tej rundy i **porażka pierwszego podejścia**.
Faza 15 poprawiła sposób, w jaki treść się pojawia, a właściciel dalej widział
to samo. Pomiar `.task` pokazał dlaczego:

```swift
.task {
    await store.odswiezProjekty()   // podróż 1
    await store.odswiezStoper()     // podróż 2 — rusza dopiero po pierwszej
}
```

Ekran malował się po pierwszej odpowiedzi i **drugi raz** po drugiej. Żadne
przejście tego nie ukryje, bo to nie brak przejścia, tylko dwa osobne momenty
przyjścia danych.

Zmierzone: **11 miejsc** czekało szeregowo. Najgorsze „Więcej" — **pięć**
żądań z rzędu, czyli pięć liczników doskakujących jeden po drugim.

| Ekran | Było |
|---|---|
| Projekty (lista) | projekty → stoper |
| Projekt (profil) | szczegóły → czas → klient |
| Więcej | powiadomienia → notatki → koszty → faktury → oferty |
| Kalendarz, Notatnik, Koszt, Powiązanie, Faktura, Oferta | po 2–3 |

Naprawa: `async let` + jeden wspólny `await`. Po zmianie **zero** szeregowych.

Świadomie zostawione szeregowo i opisane w kodzie: klient w profilu projektu
(jego id znamy dopiero ze szczegółów) — to zależność, nie przeoczenie.

**Lekcja, szersza niż ta faza:** rdzeń robił to dobrze od audytu A11
(`AppStore.start()` używa `async let`). Wzorca nie uogólniono na ekrany. To
trzeci raz w tym projekcie ten sam kształt — patrz N10 („jedno miejsce zrobione
dobrze, jedenaście pominiętych") i Moduły 30/31.

### Powiadomienia nie prowadziły donikąd

Zgłoszenie: *„jeżeli na jakieś kliknę, to ono jest jako zrobione, ale nie
przenosi mnie do samego zadania"*. Znowu ten sam wzorzec: `entity`/`entityID`
przychodziły z panelu, były **dekodowane**, komentarz nad nimi mówił wprost
„cel nawigacji" — i **żaden kod ich nie czytał**.

Doszło `Nawigacja.CelPowiadomienia` + mapowanie będące bliźniakiem
`notificationHref()` z panelu, konsumowane przez cztery stosy nawigacji.
Dwie rzeczy 1:1 z panelem: koszty prowadzą na listę (nie na rekord — w panelu
`/costs/<id>` to 404), a **umowy nie mają celu**, bo są poziomem 3 i apka ich
nie ma. Wtedy wiersz nie dostaje strzałki — element wyglądający na klikalny
i nieklikalny czyta się jak usterka.

### Ikona wyboru zadania „źle się renderowała"

Dwie przyczyny naraz i obie usunięte: podmiana symbolu bez `contentTransition`
(przeskok klatki) oraz zmiana szerokości kapsuły, gdy dochodzi plakietka „1".

Trzecia była **moja własna z pierwszej rundy**: `gotowe()` skalowało element
(`scaleEffect 0.96 → 1`), a pod spodem stoi `.szklo(...)`, czyli materiał
systemowy — skalowanie każe mu przeliczyć rozmycie i element wygląda przez
chwilę na rozmazany. `gotowe()` jest teraz samą przezroczystością.

### Poczta: gest w lewo działał tylko na części wiadomości

Oba przyciski z lewej krawędzi stały pod warunkiem `doOdpowiedzi`, więc przy
wiadomości obsłużonej lewa krawędź **nie robiła nic**. Gest, który czasem nie
istnieje, uczy, że go nie ma.

Decyzja właściciela: przy obsłużonej — powrót „Do odpowiedzi" **oraz**
„Zignoruj". To drugie odblokowuje trzeci status modelu (`MailStatus.zignorowany`),
którego apka dotąd nigdzie nie ustawiała — kolejne „pole jest, nikt go nie wysyła".

### Menu po długim przytrzymaniu

Właściciel zapytał, czy tak miało być. Tak — to brief 18, świadomie odłożony
do osobnego czatu (ustalenie z początku tej sesji).

## Runda trzecia — wydania 55 i 56

### „Na dwie raty" — dopiero trzecie podejście trafiło

Dwa pierwsze celowały obok i warto wiedzieć, w co dokładnie:

| Podejście | Co poprawiłem | Dlaczego nie pomogło |
|---|---|---|
| 1 (wyd. 52) | przejście pojawiania się treści | treść i tak przychodziła w dwóch momentach |
| 2 (wyd. 54) | `async let` zamiast `await` po `await` | szybciej, ale **równolegle ≠ jednocześnie** — dwie odpowiedzi nadal wracają osobno |
| 3 (wyd. 55) | **jeden próg renderowania** | trafione |

Prawdziwa przyczyna była w kształcie widoku, nie w sieci:

```swift
private var projekt: Projekt? { szczegoly?.projekt ?? store.projekty.first {…} }
if let projekt { nagłówek; czasPracy; status; klient      // z PAMIĘCI — 0 ms
    if let szczegoly { zadania; kamienie; zasoby; … }     // dopiero po sieci
```

Wejście z listy dawało `projekt` natychmiast, więc pół strony stało od razu.
**Ekran był z założenia dwuetapowy.** Teraz próg jest jeden (`szczegoly`), a lista
Projektów dostała własny (`komplet`), bo jej wiersze i znacznik stopera to dwie
różne trasy. Koszt: krótki kręciołek przy pierwszym wejściu; powrót na
odwiedzony rekord jest natychmiastowy, bo komplet siedzi w pamięci.

**Lekcja:** gdy właściciel mówi „doskakuje etapami", najpierw policz **progi
renderowania w widoku**, potem `await`-y, a animacje na końcu. Ja zrobiłem
odwrotnie i kosztowało to dwa wydania.

### Powiadomienia — regresja wprowadzona przez własną poprawkę

Wersja 54 działała (przełączenie zakładki), ale „wstecz" wracało do korzenia
obcej zakładki — bo **iOS nie ma cofania między zakładkami**. Wersja 55 miała
to naprawić linkiem kierowanym wartością i **przestała przenosić w ogóle**:
`navigationDestination(for: SzczegolyCel.self)` istnieje wyłącznie w stosie
„Więcej", a `DzwonekPaska` otwiera Powiadomienia w tym stosie, w którym akurat
jesteśmy. Link bez zarejestrowanego celu **nie robi nic — bez błędu i bez śladu**.

Wersja 56: link z zamknięciem (`WidokCelu`), działa w każdym stosie, „wstecz"
wraca do Powiadomień. Zniknął też `simultaneousGesture`, który zjadał aktywację
linku w `List` — wpis gaśnie teraz przy otwarciu celu (`.task` na widoku celu).

### Dev-seed kłamał przy weryfikacji

Trzy z czterech powiadomień w `lib/dev-db.ts` miały `entity_id = NULL`, więc apka
**poprawnie** nie robiła z nich odnośnika — a zrzut wyglądał jak dowód usterki.
Produkcja podaje `entityId` przy każdym z dziesięciu rodzajów (`notify({...})`).
Seed poprawiony. To druga odsłona ustalenia N3 z audytu: **dev-seed, który nie
odwzorowuje produkcji, testuje coś, czego nie ma.**

### Przycisk wyboru zadania — trzy przyczyny, jedna moja

Renderowanie naprawiła stała geometria (wyd. 55), ale rezerwacja miejsca na
plakietkę **tylko po prawej** zsunęła ikonę z osi — zgłoszone zrzutem
(„popraw, żeby było symetrycznie"). Wersja 56: plakietka jest **nakładką**, nie
elementem rzędu; kapsuła to koło z ikoną na środku.

Zmierzone na zrzucie z symulatora, nie ocenione okiem: kapsuła **155 × 155 px**,
środek ikony w osi X = **93,5** = środek kapsuły. W pionie 2,5 px różnicy —
to własny środek ciężkości symbolu „warstw", nie układ.

## Czego ta faza NIE zrobiła

- **Nie przeczesano wszystkich 53 widoków** pod kątem „treść doskakuje przy
  nadejściu danych". Naprawione są dwa **zmierzone** miejsca na ekranie ze
  zgłoszenia. Narzędzie (`.gotowe(_:)`) istnieje, więc następny przebieg jest
  tani — ale to osobna robota i nie udawajmy, że jest zrobiona.
- **Nie ruszono `TykajacyCzas` ani Live Activity** (zakaz z briefu).
- **Nie ruszono „poziomu 3"** (faktury, korekty, KSeF, oferty, umowy).
- **Optymistyczny pozostaje tylko stoper i poczta.** Pozostałe 22 pliki
  z `wTrakcie → ProgressView` czekają dalej. Odhaczanie zadań było już
  optymistyczne wcześniej.
- **A1 (cicha utrata błędów) nadal otwarte** — niezależne od tej fazy.

## Jak to zweryfikowano

| Rzecz | Jak |
|---|---|
| Zero sprężyn z palca po zmianie | grep, 0 wystąpień poza `Ruch.swift` |
| Haczyk haptyki realnie wstrzyknięty (nie martwy kod) | grep: `store.odczuj =` w `LeggeraHubApp.swift:95` |
| Build i instalacja | `xcodebuild` + `devicectl`, wydanie **52** (`4a5b515`) |
| Apka wstaje na telefonie, bez crasha | proces 19231 żywy po starcie, zero świeżych wpisów w CrashReporter |
| **Płynność i haptyka w odczuciu** | **NIE zweryfikowane przez Claude — z definicji.** Symulator nie ma haptyki w ogóle, a płynności nie widać na zrzucie. To ocena właściciela z telefonem w ręku |

Ostatni wiersz jest najważniejszy: cel tej fazy („ma być premium") jest
odczuciem, a nie liczbą, i jedynym testem jest telefon w ręku właściciela.
