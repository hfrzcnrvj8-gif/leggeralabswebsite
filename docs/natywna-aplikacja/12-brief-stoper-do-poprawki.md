# Brief: stoper — przyciski i pasek powiadomienia OD NOWA

> Brief pod **jeden osobny czat**. Repo apki:
> `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Powstał 2026-07-20 po sesji, w której to samo poprawiano pięć razy i nadal
> jest źle. **Przeczytaj sekcję „Czego NIE próbować" przed pierwszą zmianą.**

## Stan: funkcja działa, wygląd jest do wyrzucenia

Live Activity stopera jest zbudowana, wpięta i działa na telefonie właściciela
(start/stop, ekran blokady, Dynamic Island, liczba spraw z Pulpitu, przycisk
Stop). **Logiki nie ruszaj.** Do poprawki jest wyłącznie warstwa wizualna,
i to w dwóch miejscach.

## Zadanie 1 — przyciski stopera w apce (NIE ZOSTAŁO ZROBIONE)

Właściciel podał to wprost i nie zostało wykonane — poprzednia sesja zbudowała
zamiast tego zwykły przycisk na całą szerokość:

> „start/stop to miały być **małe okrągłe przyciski w tyle liquid glass, po
> lewej stronie**, które **po wciśnięciu mają się rozszerzyć o czas stopera**"

Czyli: mały okrągły przycisk ▶ (szkło) → po dotknięciu **rozwija się w poziomie
w kapsułę** pokazującą tykający czas i stan zatrzymania. Zachowanie
morfujące, nie podmiana jednego widoku na drugi.

**Zanim zaczniesz budować — dopytaj właściciela o:**

1. Czy w stanie rozwiniętym ma być widoczny osobny przycisk stop, czy całe
   rozwinięcie jest przyciskiem stopu?
2. Gdzie dokładnie „po lewej stronie" — w karcie „Czas pracy" na profilu
   projektu, w pasku chrome, czy w obu?
3. Czy zielony/czerwony zostaje (poprzednia decyzja z tej samej sesji), czy
   szkło ma być neutralne, a kolor tylko na ikonie?
4. **Poproś o zrzut ekranu wzorca**, jeśli istnieje. To jest najważniejszy
   punkt tej listy — poprzednia sesja utonęła dokładnie na tym, że budowała
   z opisu słownego zamiast z obrazka.

Techniczne: `matchedGeometryEffect` albo animowana zmiana `frame` w jednym
widoku; szkło przez istniejący modyfikator `.szklo(_:dotyk:)` (`Marka.swift`).
Licznik bierz z istniejącego `LicznikCzasu` (`LeggeraHub/Views/LicznikCzasu.swift`)
— nie buduj czwartej kopii.

## Zadanie 2 — pasek na ekranie blokady (Live Activity)

Objaw, który wraca mimo pięciu poprawek: **czas i przycisk „Stop" nie stoją na
wspólnej krawędzi.** Czas ląduje gdzieś w środku prawej połowy, „Stop" przy
samej krawędzi, i całość czyta się jako rozjechana.

Plik: `Widzet/StoperWyspa.swift`, widok `WidokNaBlokadzie`.

### Czego NIE próbować (wszystko sprawdzone i odrzucone 2026-07-20)

| Próba | Skutek |
|---|---|
| dwa niezależne `VStack` w `HStack` | zegar wyżej niż nazwa, brak wspólnej linii |
| `.fixedSize()` na liczniku | znika licznik **i cały wiersz pod nim** |
| `.layoutPriority(1)` na liczniku | znika **nazwa projektu** |
| `.frame(maxWidth:)` na liczniku | kolumna za ciasna, licznik traci wyrównanie |
| `.frame(minWidth: 150)` + `Grid` | stan obecny — nadal nie na wspólnej krawędzi |
| gradient zamiast koloru pełnego | bez wpływu na układ (odrzucone z innych powodów) |

Przyczyna źródłowa: `Text(timerInterval:)` **rysuje system**, a jego szerokość
idealna liczona jest dla najdłuższego odczytu mieszczącego się w podanym
zakresie dat. Stąd wszystkie te dziwne zachowania układu.

**Sugerowany kierunek, którego jeszcze nie sprawdzono:** skrócić zakres dat
(dziś 12 h → np. 1 h z przeliczaniem) albo zbudować wiersz na `ZStack`
z jawnym `alignment: .trailing` zamiast walczyć z rozkładem szerokości.
Zweryfikuj zrzutem, nie rozumowaniem.

## Sufity platformy — NIE walcz z nimi

Sprawdzone doświadczalnie, nie z dokumentacji:

- **Setnych sekundy nie da się pokazać w Live Activity ani w widżecie.** System
  rysuje odczyt sam. Zegar Apple'a pokazuje `00:00,46`, bo jest aplikacją
  systemową i nie używa publicznego API. Wewnątrz apki setne działają
  (`Stoper.licznikSetne` + `TimelineView(.animation)`).
- **Ekran blokady przestaje pokazywać sekundy po ~3 minutach** („13:--”).
  Dowód: ten sam pomiar w tej samej chwili — blokada `13:--`, Dynamic Island
  `14:34`. Krótkie zrzuty (poniżej 3 min) pokazują sekundy i wyglądają jak
  dowód, że „naprawione" — to pułapka, która w poprzedniej sesji zmyliła
  dwukrotnie.

## Jak pracować, żeby nie powtórzyć poprzedniej sesji

Poprzednia sesja spaliła dwie godziny na tym, co miało zająć kwadrans. Powody,
konkretnie:

1. **Zaczęła budować bez wzorca wizualnego.** Właściciel powiedział „jak
   w Zegarze Apple'a", sesja odczytała to jako kolory, a chodziło o kształt
   i zachowanie przycisków. **Najpierw poproś o zrzut albo o opis docelowego
   zachowania, dopiero potem pisz kod.**
2. **Iterowała na symulatorze**, a właściciel oglądał telefon. Zrzuty
   z symulatora bywały zgodne, a na telefonie było źle. **Weryfikuj na
   urządzeniu** (procedura wgrania w README apki, sprawdzona i działa).
3. **Wyciągała wnioski z serii prób testujących to samo.** Cztery warianty
   szerokości to nie są cztery niezależne dowody. Efekt: dwie sprzeczne
   diagnozy wpisane do dokumentacji jako fakt, jedna publicznie wycofana
   i potem przywrócona.
4. **Nie zapytała, kiedy skończyć.** Właściciel powtarzał „nadal źle" pięć
   razy. Po drugim „nadal źle" **zatrzymaj się i poproś o wzorzec**, zamiast
   próbować szóstego wariantu.

## Prompt otwierający kolejny czat

```
Przeczytaj docs/natywna-aplikacja/12-brief-stoper-do-poprawki.md, potem
CLAUDE.md i README apki. Zajmujemy się WYŁĄCZNIE wyglądem stopera — logika
działa, nie ruszaj jej.

Zanim napiszesz choć linijkę kodu: zadaj mi pytania z Zadania 1 i poproś
o zrzut wzorca. Poprzednia sesja zaczęła budować z opisu słownego i spaliła
dwie godziny.

Potem: małe okrągłe przyciski start/stop w szkle po lewej, rozwijające się
po wciśnięciu o czas stopera, oraz wyrównanie czasu i przycisku Stop na
pasku powiadomienia. Weryfikuj na moim telefonie, nie na symulatorze.
```
