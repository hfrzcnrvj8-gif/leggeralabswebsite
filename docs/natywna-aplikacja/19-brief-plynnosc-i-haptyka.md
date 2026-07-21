# Brief: płynność, haptyka i „premium" (Faza 15)

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Spisany 2026-07-21 na prośbę właściciela, po sesji testów na telefonie.
> **Osobny czat.** Zaczynasz od przeczytania tego pliku i od pomiaru — nie od
> poprawiania pierwszego ekranu, na który trafisz.

## Zgłoszenie, słowo w słowo

> *„ogólnie ciągle mam wrażenie, że przejścia tych funkcji są takie szarpane,
> klatkujące, zupełnie nie jak Apple. Tak samo kiedy wchodzę w Projekty po
> restarcie, to najpierw pojawia się przycisk START, a po chwili dopiero ta
> opcja wybrania czasu — czy na cały projekt, czy na poszczególny moduł — i
> kiedy klikam start, to kręci się przez chwilę kółko, nie ma takiej ładnej
> płynnej animacji jak to mają aplikacje Apple. (…) ma być premium"*

## Stan wyjściowy (zmierzone 2026-07-21, nie oszacowane)

| Rzecz | Wartość |
|---|---|
| **Sprzężenia haptyczne w całej apce** | **0** |
| `withAnimation` | 9 |
| `.animation(…)` | 9 |
| `.transition(…)` | 5 |
| `matchedGeometryEffect` | 1 |
| `contentTransition` | 2 |
| Pliki widoków | **53** |

Zero haptyki jest tu najważniejszą liczbą i najtańszą do naprawienia. W apkach
Apple palec dostaje odpowiedź przy każdej znaczącej akcji; u nas nie dostaje
nic. To połowa wrażenia „premium", zanim ktokolwiek spojrzy na animacje.

## Trzy przyczyny, nie jedna

Zgłoszenie brzmi jak jeden problem, a są trzy — i mają różne naprawy.

### 1. Treść doskakuje etapami, bez przejścia

Ekran renderuje się, gdy dojdzie pierwsza porcja danych, a reszta pojawia się
później — **bez animacji**, więc oko czyta to jako szarpnięcie. Dokładnie ten
przypadek opisał właściciel: „najpierw START, po chwili wybór zadania".

`ProjektDetailView` ma tu nawet `.transition(.opacity.combined(with: .scale))`
przy `PrzyciskWyboruZadania` — ale **nic tej zmiany nie animuje**, więc
przejście nie ma jak zadziałać. `transition` bez `animation` to martwy zapis
i warto poszukać, ile jest takich miejsc.

### 2. Akcje czekają na serwer zamiast reagować od razu

„Start" pokazuje kręciołek do odpowiedzi z sieci. Wzorzec optymistyczny
(zareaguj natychmiast, cofnij przy odmowie) **istnieje już w tej apce** —
`AppStore.nanies()` w module Poczty — i nie jest używany w stoperze, przy
odhaczaniu zadań ani przy statusach.

Uwaga: to nie znaczy „udawaj sukces zawsze". Bramka umowy (409) musi dalej
umieć cofnąć zmianę i pokazać powód.

### 3. Brak haptyki

Zero na 53 pliki. Do rozstrzygnięcia w tamtym czacie **z właścicielem**: gdzie
haptyka niesie informację, a gdzie byłaby hałasem. Propozycja na start (nie
zlecenie): start/stop stopera, odhaczenie zadania, udana wysyłka, odmowa
bramki, przeciągnięcie w bok, otwarcie menu po przytrzymaniu (to ostatnie iOS
robi sam — nie dokładać).

## Reguła nadrzędna

**Wszędzie tak samo.** Haptyka na Projektach, ale nie na Poczcie, jest gorsza
niż jej brak: uczy, że jej nie ma, więc przestaje się ją zauważać także tam,
gdzie jest. To główny powód, dla którego to osobna faza, a nie dopisek do
bieżącej pracy.

Drugie: **`lib/motion.ts` panelu ma jedno źródło płynności** (`EASE_LIQUID`,
`SPRING`) — apka nie ma odpowiednika i sprężyny są wpisywane z palca
(`StoperPasek.swift:183` to `.spring(response: 0.42, dampingFraction: 0.82)`
wklepane w miejscu). Pierwszym krokiem powinien być bliźniak `Ruch.swift`
w rdzeniu albo w `Views/`, a dopiero potem rozprowadzanie go po ekranach.
Panel przeszedł dokładnie tę drogę w Module 36 i warto z niej skorzystać.

## Czego NIE robić

- **Nie ruszać `TykajacyCzas`** ani niczego w Live Activity: czas rysuje tam
  system i cztery iteracje zostały już na tym zmarnowane (patrz komentarze
  w `Widzet/StoperWyspa.swift`).
- **Nie animować dla samej animacji.** Apple jest płynne, bo ruch niesie
  ciągłość (skąd–dokąd), a nie dlatego, że wszystko się rusza.
- **Nie dokładać haptyki do akcji destrukcyjnych bez potwierdzenia** —
  potwierdzenie zostaje, haptyka go nie zastępuje.
- **Nie ruszać „poziomu 3"** (faktury, korekty, KSeF, oferty, umowy).

## Jak weryfikować

- **Symulator nie odda płynności** — animacje potrafią tam klatkować niezależnie
  od kodu, a haptyki nie ma w ogóle. **Weryfikacja idzie na telefon.**
- Build wgrywa się kablem, a apkę da się uruchomić na wybranym ekranie zdalnie:
  `devicectl` przyjmuje furtki `LEGGERA_DEV_*` przez prefiks `DEVICECTL_CHILD_`.
- Ekran telefonu widać na Macu przez QuickTime (Plik → Nowe nagranie filmu →
  źródło: iPhone) — **tylko podgląd, kliknięcia nie przechodzą**.
- Rozwiniętą Wyspę da się obejrzeć w symulatorze myszą (przytrzymanie ~2 s).
- Numer wydania widać w „Ustawienia → O aplikacji" i przez
  `devicectl device info apps` — przy iteracjach nad wyglądem to jedyny sposób,
  żeby wiedzieć, którą wersję właściciel ma w ręku.

## Stan wyjściowy repo

Wersja **51** (`422aff5`), wgrana na iPhone'a 15 Pro Max. Poprzednia faza
(audyt końcowy) zamknięta w `17-wynik-audytu-koncowego.md`. Otwarty pozostaje
dług **A1** (cicha utrata błędów — właściciel wybrał kształt: jedna kolejka
komunikatów w chrome) oraz brief **menu po przytrzymaniu**
(`18-brief-menu-przytrzymania.md`). Ta faza jest od nich niezależna, ale
kolejność warto ustalić z właścicielem — menu po przytrzymaniu i haptyka
dotykają tych samych wierszy.
