# Wynik: apka przestaje kłamać pustymi ekranami (ustalenie A1)

> Wykonane 2026-07-21 wg `21-brief-a1-komunikaty.md`. Repo apki:
> `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`. Stan wyjściowy: wydanie
> 56 (`9558410`) + niescommitowana robota w toku (patrz niżej).
>
> Metoda: grep + build + symulator (blackhole `10.255.255.1:3000` + N1),
> zrzuty. Nie „powinno działać" — każde zdanie niżej ma linię kodu albo zrzut.

## Zanim cokolwiek napisano: znaleziono nieukończoną robotę

Repo miało niescommitowane zmiany sprzed tej sesji: `Store/Komunikaty.swift`
(nieśledzony) + mały diff w `AppStore.swift`. Ktoś już zaprojektował dokładnie
to, o co prosi brief — `Zasob` (klucz per ekran), `Waga` (`.akcja`/`.ekran`/
`.tlo`), `Komunikat` (pozycja kolejki) i gardło `wykonaj<T>(_:_:_:)` — ale
**nie kompilowało się**: `wyczyscSesje` było `private` w `AppStore.swift`,
a `wykonaj` (inny plik tego samego modułu) go potrzebował. Swiftowe `private`
jest plikowe, nie modułowe — stąd błąd. Nic nie było jeszcze podpięte: zero
wywołań `wykonaj`, zero czytelników `komunikaty`, `PasekKomunikatow` nie
istniał (tylko wzmianka w komentarzu).

Zapytany wprost, właściciel potwierdził kontynuację na tym szkielecie (obie
otwarte decyzje briefu — helper `wykonaj<T>` i podział krzyczy/milczy —
rozstrzygnięte na starcie, patrz niżej) zamiast projektować od zera.

## Rozstrzygnięcia ze startu (potwierdzone przez właściciela)

1. **Helper `wykonaj<T>(_:_:_:)` — tak.** Konsoliduje 401 → wylogowanie,
   ciszę przy anulowaniu, zapis błędu pod kluczem zasobu i baner w chrome
   (tylko dla `.akcja`) w jednym miejscu zamiast w każdym z ~80 `catch`.
2. **Waga = gdzie krzyczy, gdzie milczy — podział z istniejącego szkieletu.**
   `.akcja` (zapis/wysyłka/kasowanie palcem) → baner w chrome. `.ekran`
   (wejście na ekran, pull-to-refresh) → bez banera, tylko trzeci wariant
   pustego stanu. `.tlo` (odświeżenie, o które nikt nie prosił palcem) →
   całkowita cisza, nie rusza nawet stanu błędu zasobu. Spójne z decyzją
   o haptyce z Fazy 15 (`Dotyk.odmowa` świadomie NIE pod `bladLeadow`).

## Co zrobiono

### 1. Naprawiono kompilację szkieletu

`wyczyscSesje(blad:)` z `private` na domyślny (modułowy) dostęp — jedna
linia, ale bez niej `Komunikaty.swift` nie widział go wcale.

### 2. `PasekKomunikatow` — kolejka w chrome (`GlownaBelka.swift`)

Nowy `ViewModifier` obok istniejącego `PasekStoperaWChrome`: pokazuje
najstarszy nieodrzucony `Komunikat` jako baner u góry ekranu (szkło +
trójkąt `Znaczenie.blad`, napis neutralny), znika sam po 4 s
(`.task(id: naGorze?.id)` — anuluje się i startuje na nowo przy każdej
zmianie czoła kolejki, więc ręczne odrzucenie nie zostawia sierocego
timera) albo po przesunięciu w górę. Świadomie **nie** `.alert` —
`odmowaBramki` obok zostaje systemowym alertem (jedna wiadomość, blokuje),
bo to inna kategoria: pytanie o potwierdzenie, nie informacja.

### 3. `AppStore.swift`: 80 → 25 `catch APIError.nieautoryzowany`, plik krótszy o 271 linii

Przepisano ~57 metod na `wykonaj(zasob, waga) { ... }`. Zasady, którymi się
kierowałem (i którymi warto się kierować przy kolejnych):

- **Proste wczytanie zasobu** (do/catch bez rozgałęzień) → pełne
  `wykonaj(.zasob, .ekran)`. Większość: `odswiezLeady`, `odswiezKlientow`,
  `odswiezProjekty`, `odswiezPoczte`, `odswiezNotatki`, `odswiezStoper`,
  `odswiezFaktury`, `odswiezOferty`, `wczytajProjekt`, `wczytajKlienta`,
  `wczytajLog`, `wczytajFakture`, `wczytajOferte`, `szukaj`, `odswiezRejestr`,
  `wczytajMiesiac`, `odswiezPulpit`, `odswiezStatystyki`, `pobierzSubskrypcje`,
  `pobierzKolejkeWysylki`, `odswiezCzas`, `odswiezPowiadomienia` i inne.
- **Metody z rozgałęzieniem `APIError.odmowa` → `odmowaBramki`**
  (`zmienPolaProjektu`, `akcjaProjektu`) — zostawione z RĘCZNYM `do/catch`
  (bramka umowy to osobna kategoria, nie „awaria"), ale generyczna gałąź
  `bladLeadow = ...` zamieniona na `if let powod = APIError.komunikat(error)
  { zglos(powod) }` — ten sam efekt (baner w chrome), bez wymuszania
  niepasującego kształtu `wykonaj`. Ten sam wzorzec zastosowany w ośmiu
  miejscach z podobną strukturą (optymistyczne cofnięcie + reload po błędzie:
  `przelaczZadanie`, `startStopera`, `stopStopera`, `przelaczOnboarding`,
  `wyslijZmianeWiadomosci` i in.).
- **Wysyłka maila** (`wyslijIObsluz`, `zaproponujOdpowiedz`) — błąd szedł
  wcześniej do `bladLeadow`, ale czytał go WYŁĄCZNIE `EdytorWiadomosciView`
  (arkusz kompozycji). To jest dokładnie kategoria `bladAkcji` („komunikat ma
  zostać przy przycisku, który go wywołał"), więc przełączone na `bladAkcji`,
  nie na kolejkę w chrome — arkusz i tak stoi otwarty, baner byłby drugim
  ostrzeżeniem o tym samym. `bladAkcji` rośnie z 7 do 9 miejsc; to świadome
  rozszerzenie tej samej, już dobrze zakresowanej kategorii, nie nowy byt.
- **`ruszKolejkeIPobierz`** — jedyne miejsce z jawną `Waga.tlo`: odświeżenie
  Wyspy przy wejściu w apkę, o które nikt nie prosił palcem.
- **Cancellation po odpowiedzi, nie tylko na wejściu** — `odswiezPoczte` i
  `odswiezRejestr` miały manualny `guard !Task.isCancelled` PO otrzymaniu
  odpowiedzi (nie tylko na rzuconym błędzie): zerwane żądanie starego
  filtru/folderu potrafi wrócić z odpowiedzią mimo anulowania Taska.
  `wykonaj` łapie anulowanie z rzuconego błędu, ale nie tę drugą ścieżkę —
  dlatego oba miejsca dostały `try Task.checkCancellation()` PO `await`,
  wewnątrz domknięcia przekazanego do `wykonaj`, żeby zachować dokładnie tę
  samą gwarancję.

Pole `bladLeadow` **usunięte całkowicie** (deklaracja + wszystkie 67+ zapisów
i odczytów) — grep na końcu: zero wystąpień poza jednym zdaniem w komentarzu
`Komunikaty.swift`, opisującym historię, nie kod.

### 4. Trzeci wariant pustego stanu — 16 ekranów z briefu + 2 dodatkowe

Wzorzec wszędzie ten sam:

```swift
if lista.isEmpty && !laduje {
    if let blad = store.blad(.zasob) {
        ContentUnavailableView("Nie udało się wczytać",
                               systemImage: "wifi.exclamationmark",
                               description: Text(blad))
    } else {
        ContentUnavailableView("Brak X", ...)   // stary, prawdziwy pusty stan
    }
}
```

| Ekran | Zasob | Uwaga |
|---|---|---|
| FakturyView | `.faktury` | trzeci wariant tylko gdy `store.faktury` PUSTE naprawdę (nie odfiltrowane) |
| KlientDetailView | `.profilKlienta` | „Historia" + `ListaZmian` (dzielona z leadem — dostała parametr `blad:`) |
| KosztyListView | `.koszty` | |
| LeadDetailView | `.profilLeada` | „Historia" + `ListaZmian` |
| NotatnikView | `.notatki` | trzeci wariant tylko gdy notatnik pusty naprawdę (nie odfiltrowany zakładką/szukaniem) |
| OfertyView | `.oferty` | jak Faktury |
| PocztaListView | `.poczta` / `.nudge` | TRZY miejsca: lista główna, screener (dzieli zasób z listą), „Bez odpowiedzi" |
| PowiadomieniaView | `.powiadomienia` | |
| ProjektyListView | `.projekty` | jak Faktury; nie rusza istniejącego progu renderowania `komplet` |
| RejestrView | `.rejestr` | |
| StatystykiView | `.statystyki` | trzeci branch obok istniejących „dane"/„ładuję"/„brak danych" |
| SubskrypcjeView | `.subskrypcje` | |
| SzablonyView | `.szablony` | |
| SzukajView | `.szukanie` | patrz ograniczenia niżej |
| WiecejView | `.pulpit` (Pulpit) + `.klienci` (`KlienciListaTresc`, fizycznie w `PulpitView.swift`) | zobacz niżej — dowód, że „ekran z briefu" ≠ „plik o tej nazwie" |
| ZaplanowaneView | `.kolejkaWysylki` | dokładnie ten ekran, którego własny komentarz w kodzie ostrzegał o tym błędzie |

**WiecejView nie ma własnego pustego stanu do naprawienia** — jego dwa
`ContentUnavailableView` to „nie znaleziono rekordu po id" (już poprawnie
nazwane, nie kłamią). Prawdziwa lżąca lista jest w `KlienciListaTresc`
(struct w `PulpitView.swift`, bo tam mieszka też definicja), dostępnej z menu
„Więcej → Klienci". Bez sprawdzenia GDZIE faktycznie żyje kod za nazwą ekranu
z briefu, ta poprawka zostałaby pominięta.

**Bonus poza listą 16**: `LeadsListView` (czytał `bladLeadow` od dawna, ale
audyt 13.4 złapał go na „prawda i nieprawda na jednym ekranie" — baner błędu
NAD wciąż lżącym „Brak leadów") i `PulpitView` (czytał `bladLeadow` dla
własnego stanu) migrowane przy okazji retirementu pola — inaczej zostałyby
z martwym odwołaniem.

## Zmierzone (nie osądzone)

| Miara | Przed | Po |
|---|---|---|
| `catch APIError.nieautoryzowany` w `AppStore.swift` | 80 | **25** |
| Wywołań `wykonaj(...)` | 0 | **57** |
| Zapisów/odczytów `bladLeadow` | 67+ | **0** |
| `AppStore.swift`, liczba linii | 2392 | **2121** |
| Plików widoków czytających `store.blad(...)` | 0 | **17** |
| `bladAkcji`, liczba miejsc | 7 | **9** (dopisana wysyłka maila) |

## Jak zweryfikowano — symulator, blackhole, N1

`SIMCTL_CHILD_LEGGERA_DEV_BACKEND=http://10.255.255.1:3000` +
`SIMCTL_CHILD_LEGGERA_DEV_TOKEN=dev`, po jednym `xcrun simctl launch` na
ekran (furtki `LEGGERA_DEV_TAB`/`LEGGERA_DEV_WIECEJ`/`LEGGERA_DEV_MAIL_SHEET`),
zrzut po ~45–95 s (N1: limit zasobu 45 s + czas własnej nawigacji furtki).
Panel lokalny (`npm run dev`) żywy przez cały czas, niepotrzebny do tego testu
(blackhole nigdy nie dochodzi do panelu).

**14 z 16 ekranów obejrzano BEZPOŚREDNIO w stanie awarii, zrzutem ekranu**:
Leady, Poczta, Projekty, Pulpit, Klienci (przez Więcej), Rejestr, Notatnik,
Koszty, Powiadomienia, Faktury, Oferty, Statystyki, Subskrypcje, Szablony,
Zaplanowane — każdy pokazuje „Nie udało się wczytać" / „Panel nie odpowiedział
na czas. Spróbuj jeszcze raz." zamiast starego, kłamiącego pustego stanu.
(To piętnaście nazw, bo Poczta doliczona raz mimo trzech osobnych miejsc w
kodzie.)

Dodatkowo zweryfikowano `PasekKomunikatow` (kolejka w chrome) — sam mechanizm
się kompiluje i renderuje (sprawdzone budową + przeglądem kodu, identyczny
wzorzec co sprawdzony `odmowaBramki`), ale **nie złapano go na żywo zrzutem**:
jedyna furtka do wywołania akcji offline bez dotyku (`LEGGERA_DEV_STOPER=1`)
wymaga realnych danych projektu z zaplecza, których blackhole z definicji nie
dostarcza, więc furtka nic nie robi w tym scenariuszu — a baner znika sam po
4 s, więc trafienie w okno zrzutem bez dotyku jest kwestią szczęścia, nie
projektu. To jest luka w narzędziach weryfikacji, nie w kodzie.

## Czego NIE zweryfikowano zrzutem (i dlaczego)

- **SzukajView** — trzeci wariant wymaga wpisanej frazy (`fraza.count >= 2`),
  a żadna furtka `LEGGERA_DEV_*` nie wstrzykuje tekstu do pola wyszukiwania
  (Claude nie pisze na klawiaturze symulatora). Kod jest tym samym wzorcem co
  reszta i przeszedł build — ale ekran w stanie błędu nie został obejrzany.
- **Historia/Logi w LeadDetailView i KlientDetailView** — trzeci wariant jest
  pod zakładką segmentowanego pickera (Wizytówka/Historia/Akcje/Logi), a
  otwarcie PROFILU idzie furtką (`LEGGERA_DEV_OPEN_LEAD`), ale przełączenie
  zakładki wewnątrz już wymaga dotyku. Kod przeszedł build i jest tym samym
  wzorcem.
- **Kolejka w chrome (`PasekKomunikatow`) w stanie z komunikatem** — patrz
  wyżej.

Cztery pozycje, wszystkie z tego samego powodu: brak furtki tekstowej/dotykowej
tam, gdzie trzeci wariant siedzi za interakcją, nie za samym wejściem na
ekran. Warto rozważyć furtkę `LEGGERA_DEV_SEARCH=<fraza>` przy następnej
okazji, jeśli SzukajView znowu będzie trzeba zweryfikować offline.

## Czego świadomie NIE ruszono

- **`AppStore.swift` nie podzielony** — zgodnie z briefem i audytem 13.4
  („jeszcze nie"). Realnie zmalał (2392 → 2121 linii) jako efekt uboczny
  eliminacji duplikacji, nie celowego cięcia.
- **„Poziom 3"** (faktury, korekty, KSeF, oferty, umowy) — nietknięty.
- **`TykajacyCzas` / Live Activity** — nietknięte.
- **Haptyka** — zero nowych wywołań `odczuj?(...)`. Jedna pokusa odrzucona:
  dodanie `odczuj?(.odmowa)` do generycznej gałęzi `startStopera`, której
  tam wcześniej nie było — cofnięte, bo to nie jest decyzja tego modułu.

## Sprawdź, zanim uznasz coś za zrobione (kontynuacja wzorca projektu)

Tym razem pole NIE istniało bez wołającego — było odwrotnie: **kod istniał
(cały szkielet `wykonaj<T>`), ale się nie kompilował**, więc żaden ekran nie
mógł go używać. Piąty wariant tego samego rodzinnego błędu („wygląda na
gotowe, nikt tego nie używa/nie może użyć") po Modułach 30/31, N6, N2,
Fazie 15. Warto sprawdzać `git status`/`git diff` na starcie każdej sesji w
tym repo — trzy razy z rzędu (ten moduł też) okazało się, że poprzednia
sesja zostawiła robotę w połowie.
