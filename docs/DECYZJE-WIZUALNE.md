# Trzy decyzje wizualne — materiał do wyboru

> **STAN NA 2026-08-07 WIECZOREM: właściciel odpowiedział „1 i 1".**
> **Punkty 1 i 3 są WDROŻONE i zmierzone** (szczegóły na końcu pliku).
> Punkt 2 czeka na jego palec przy etapie 5 — bez zmian w kodzie.
> Reszta dokumentu zostaje w formie, w jakiej zapadła decyzja.

**Do czego to jest:** trzy pytania „jak ma wyglądać" czekały na Ciebie od etapu 4,
opisane jednym zdaniem każde. Zmierzyłem je, żebyś odpowiadał na konkret, a nie
na opis. Przy każdym punkcie jest stan faktyczny w liczbach, warianty i moja
rekomendacja. **Wystarczy, że odpowiesz „1", „2" albo „3" przy każdym.**

Wszystkie liczby zmierzone 2026-08-07 w oknie 1280×720 na lokalnym panelu.

> **Skąd bierze się próg 24×24 px.** To standard dostępności (WCAG 2.5.8):
> cel mniejszy niż 24×24 px trafia się palcem na chybił trafił. W panelu
> obowiązuje domyślnie od Fazy 5 — te trzy punkty to ostatnie miejsca, które
> zostały poza nim, bo każde wymaga decyzji o wyglądzie, nie tylko o kodzie.

---

## 1. Trzy kontrolki na kartach Projektów

**Gdzie to jest:** *Projekty → Tablica*, lewy dolny róg każdej karty. Pod ikonką
statusu stoją obok siebie dwie kropki: priorytet i zdrowie projektu.

**Stan zmierzony:**

| kontrolka | rozmiar | uwaga |
|---|---|---|
| Zmień status | 15 × 15 px | osobny wiersz, 39 px wyżej |
| **Priorytet** | **10,5 × 9 px** | najmniejszy cel w całym panelu |
| Zdrowie | 12 × 12 px | tuż obok priorytetu |

Priorytet i zdrowie stoją obok siebie: **8,5 px między krawędziami, 19,75 px
między środkami**.

**Dlaczego to boli.** Priorytet ma 9 px wysokości — to mniej niż litera w
podpisie pod nim. Myszą trafia się w niego z drugiego albo trzeciego podejścia,
palcem praktycznie nie.

**Czego NIE da się zrobić.** Samo powiększenie obszaru trafienia do 24×24 bez
ruszania układu jest wykluczone: pudełka sąsiadów zaszłyby na siebie o ok. 4 px
i jedna kontrolka zaczęłaby kraść kliknięcia drugiej. **Otwarcie CUDZEGO menu
jest gorsze niż chybienie** — dlatego ta poprawka została w etapie 4 wycofana.

**Ile jest miejsca.** Wiersz na karcie ma **261 px**, obie kontrolki zajmują
razem **22,5 px**. Miejsca jest ponad dziesięć razy więcej, niż potrzeba.

**Warianty:**

1. **Rozsunąć, rysunki bez zmian.** Każda kontrolka dostaje niewidzialne pudełko
   24×24 px, same kropki zostają drobne. Karta wygląda prawie tak samo, a
   trafienie przestaje być loterią. Kontrolki zajmą ~52 px zamiast 22,5 px —
   w wierszu na 261 px to niewidoczna różnica.
2. **Rozsunąć i powiększyć rysunki** do 14–16 px, czyli do wielkości ikonki
   statusu. Widać je wyraźnie z odległości, ale karta robi się bardziej
   „zajęta" — a Pulpit i tablice właśnie odchudzaliśmy.
3. **Zostawić jak jest.** Wtedy dopisuję trzeci jawny wyjątek do zasad projektu,
   z powodem i drogą zastępczą (te same trzy rzeczy zmienia się też w profilu
   projektu, gdzie kontrolki są pełnowymiarowe).

**Moja rekomendacja: 1.** Problem jest w *trafianiu*, nie w *widoczności* —
kropki i tak czyta się kolorem, nie kształtem. Wariant 1 rozwiązuje trafianie
i nie zmienia wyglądu karty.

---

## 2. Kwadraciki zaznaczania na kartach Tablicy

**Gdzie to jest:** *Leady → Tablica* i *Klienci → Tablica*, kwadracik w rogu
karty, którym zaznacza się kilka rekordów naraz.

**Stan zmierzony:** rysunek **14 × 14 px**, pudełko trafienia **24 × 24 px**
(dołożone w etapie 4 jedną regułą CSS, bez opakowywania dziewiętnastu miejsc).
Dwa sąsiednie kwadraciki na Tablicy dzieli **20 px** — czyli mniej niż 24, więc
ich pudełka teoretycznie zachodzą na siebie o ok. 4 px.

**Tu NIE mam dla Ciebie wiarygodnego pomiaru i mówię to wprost.** Test kliknięcia
w podglądzie przeglądarki przestał być rozstrzygający — kwadracik nie pojawia się
w stosie elementów pod własnym środkiem, co jest artefaktem narzędzia, nie
panelu. Nie zbuduję rekomendacji na pomiarze, któremu sam nie ufam.

**Co to znaczy praktycznie:** albo nic (bo i tak celujesz w środek kwadracika),
albo raz na jakiś czas zaznaczysz kartę o jedną wyżej.

**Moja rekomendacja: to jest pytanie do Twojego palca, nie do mojego pomiaru.**
Masz je już na liście etapu 5 (punkt B4 — telefon i iPad palcem). Przejdź
Tablicę leadów palcem i zaznacz kilkanaście kart:

- ani razu nie trafiłeś obok → zamykamy temat jako nieistniejący,
- trafiłeś obok choć raz → mam gotową poprawkę (rozsunięcie kart o 4 px, nic
  poza tym).

---

## 3. Wysokość wierszy list

Chodzi o listy kompaktowe: „Wymaga działania dziś", propozycje, pigułki statusu
w Poczcie, przypomnienia. Notatka z etapu 4 mówiła, że podniesienie ich celów do
24 px **„zmieniłoby gęstość wszystkich list w panelu"**. Zmierzyłem to i **cena
jest znacznie mniejsza, niż zakładała notatka**.

**Stan zmierzony:**

| lista | wysokość celu | odstęp między wierszami | brakuje do 24 px |
|---|---|---|---|
| „Wymaga działania dziś" (Leady) | **22 px** | **31 px** | 2 px |
| Propozycje (Projekty) | **20 px** | **34 px** | 4 px |

To jest sedno: **cel ma 20–22 px, a wiersze dzieli 31–34 px.** Podniesienie celu
do 24 px mieści się w istniejącym odstępie — sąsiednie wiersze nie zaczną sobie
kraść kliknięć i **nie trzeba rozsuwać list**. Notatka zakładała, że trzeba;
liczby mówią, że nie.

Dla porównania widok *Leady → Tabela* (te szerokie wiersze, których notatka nie
dotyczyła) ma jeszcze więcej luzu: wiersz 41–73 px przy zawartości 14–16 px.

**Warianty:**

1. **Podnieść cele do 24 px w listach kompaktowych.** Odstępy między wierszami
   zostają, gęstość list się nie zmienia — rośnie tylko obszar trafienia,
   o 2–4 px na cel. Wizualnie nie do zauważenia.
2. **Zostawić.** Myszą trafiasz bez pudła i dziś to jest prawda — problem
   pojawia się dopiero palcem na telefonie i iPadzie.

**Moja rekomendacja: 1.** To najtańsza z trzech decyzji: 2–4 px na cel, zero
zmian w gęstości, zero zmian w wyglądzie.

---

## Czego od Ciebie potrzebuję

| punkt | pytanie | moja rekomendacja |
|---|---|---|
| 1 | kontrolki na kartach Projektów | **1** — rozsunąć, rysunki bez zmian |
| 2 | kwadraciki na Tablicy | **sprawdź palcem** przy okazji etapu 5 |
| 3 | cele w listach kompaktowych | **1** — podnieść o 2–4 px, bez zmiany gęstości |

Punkty 1 i 3 wdrożę od razu po Twojej odpowiedzi. Punkt 2 czeka na Twoje
zgłoszenie albo na jego brak — jedno i drugie jest rozstrzygnięciem.

---

## Co zostało wdrożone (2026-08-07, po decyzji „1 i 1")

### Punkt 1 — kontrolki na kartach Projektów ✅

Rozsunięte, rysunki bez zmian. Priorytet i zdrowie stoją teraz w osobnym rzędzie
**bez odstępu**, każde w pudełku 24×24 — dzięki temu ich środki dzieli **dokładnie
24 px**: próg trafiony, a pudełka się nie stykają. `gap-2` w rzędzie wyżej dałoby
32 px i dwie kropki wyglądałyby na niepowiązane ze sobą.

Zmierzone po zmianie na Tablicy Projektów:

| co | przed | po |
|---|---|---|
| priorytet | 10,5 × 9 px | **24 × 24** |
| zdrowie | 12 × 12 px | **24 × 24** |
| zmień status | 15 × 15 px | **24 × 24** |
| odstęp środków priorytet↔zdrowie | 19,75 px | **24 px** |
| kolizje pudełek | 17 | **0** |

Wszystkie **81 wyzwalaczy** na ekranie ma 24×24. Test kliknięcia w środek i we
wszystkie cztery rogi: **ani razu „SĄSIAD"** — żadna kontrolka nie przechwytuje
kliknięć drugiej. Kliknięcie w priorytet otworzyło właściwe menu (Niski /
Normalny / Wysoki / Krytyczny), sprawdzone prawdziwym kliknięciem w przeglądarce.

Mechanizm: nowy prop `celDotykowy` w `PropertyMenu`. **Opt-in** — ten sam
komponent stoi w kilkunastu miejscach, gdzie wyzwalacze sąsiadują ciaśniej niż
24 px i pudełka zaczęłyby sobie kraść kliknięcia.

### Punkt 3 — cele w listach kompaktowych ✅

Podniesione do 24 px w czterech listach: propozycje (zdanie + trzy pastylki
decyzji), „Wymaga działania dziś" u Leadów i u Klientów, pastylki statusu
w Poczcie, wiersze Przypomnień.

**Odstępy między wierszami nietknięte** — rośnie sam cel, o 2–4 px. Zdanie
propozycji: było 20 px, jest **dokładnie 24**. Akcja „Oznacz jako obsłużone":
było 22 px, jest **24**.

Sonda po zmianie — liczba celów poniżej progu na ekranie (pomijając te, które
mają pudełko `::before`):

| ekran | przed | po |
|---|---|---|
| Pulpit | — | **0** |
| Leady | — | **0** |
| Projekty | — | **0** |
| Poczta | 9 | **0** |
| Przypomnienia | 4 | **0** |
| Kalendarz | — | **0** |

`tsc` czysto · `npm test` **371/371** · `npm run przejscie` **125 działa,
0 regresji**.

### Punkt 2 — bez zmian w kodzie

Czeka na Twój palec przy etapie 5. Jak trafisz obok choć raz — poprawka to
rozsunięcie kart o 4 px.

### Domiar na szerokości telefonu (390 px)

Sprawdzenie po wdrożeniu, na prośbę właściciela. **Zmiany trzymają się na wąskim
ekranie** — 36 wyzwalaczy na Tablicy Projektów, żaden nie ściśnięty (`shrink-0`
działa), 0 kolizji, nigdzie nie przewija w bok. To nie jest oczywiste: przy
`flex` bez `shrink-0` pudełko 24×24 daje się zgnieść do 17 px i poprawka znika
bez śladu w kodzie.

**Telefon pokazał dwa cele, których desktop NIE pokazywał** — oba naprawione:

| co | gdzie | było | jest |
|---|---|---|---|
| nagłówek „Wymaga działania dziś" (jest rozwijaczem listy) | Leady | 18,8 px | **24** |
| znak „Leggera Hub" w pasku | każdy ekran | 19,5 px | **24** |

Pierwszy należał do listy, którą właśnie poprawialiśmy. Drugi to chrome, ale
próg obowiązuje w CAŁYM panelu, a najbliższa kontrolka jest 160 px dalej, więc
nie było tu czego rozstrzygać — sam pomiar wystarczył. Oba są widoczne wyłącznie
na telefonie, bo górny pasek panelu ma `md:hidden`.

**Wynik końcowy przy 390 px — celów poniżej progu:**

| ekran | wynik |
|---|---|
| Pulpit · Leady · Projekty · Poczta | **0** |

**Lekcja, która się powtórzy:** desktop nie wystarcza. To trzeci raz w tym
tygodniu, gdy wąski ekran pokazał usterkę niewidoczną na szerokim (wcześniej:
przycisk Poczty 97 px poza ekranem i ucięta nazwa klienta w apce).

### Domiar na szerokościach iPada — i jedno NOWE pytanie

Sprawdzone trzy szerokości: **834×1194** (pion), **1194×834** (poziom),
**507×1194** (połówka przy podziale ekranu).

**Wdrożone zmiany trzymają się wszędzie:** Projekty 36 wyzwalaczy 24×24 i zero
kolizji, Pulpit 0 celów poniżej progu, Klienci 0, nigdzie nie przewija w bok.
Przy 507 px tabela zamienia się w karty z pełnowymiarowymi przyciskami, więc
drobne ikony tam w ogóle nie istnieją.

**Ale iPad pokazał widok, którego wcześniejsza sonda NIE objęła: `Leady →
Tabela`.** Na telefonie ten widok zamienia się w karty, a na desktopie miałem
włączoną Tablicę — więc tabela wypadła ze sprawdzenia i moje wcześniejsze
„Leady: 0" jej nie dotyczyło. To mój błąd metody, nie zmiana w kodzie.

Zmierzone w wierszu tabeli (834 i 1194 px, tak samo):

| co | rozmiar |
|---|---|
| nazwa rekordu (odnośnik do profilu) | 165,9 × **16 px** |
| „Otwórz profil" | 15 × 15 px, **ale ma już pudełko 24×24** |
| **„Usuń"** | **14 × 14 px, bez pudełka** |

**I to jest sedno: „Usuń" stoi 22,5 px od „Otwórz profil".** Samo dołożenie
pudełka 24×24 dałoby zachodzenie o 1,5 px — czyli dokładnie sytuacja z punktu 1,
tylko że **sąsiadem jest tu usuwanie rekordu**. To znaczy, że nie jest to
poprawka mechaniczna: wymaga rozsunięcia tych dwóch ikon, czyli decyzji
o wyglądzie wiersza tabeli.

**Nie ruszam tego bez Twojego słowa.** Warianty, gdy zechcesz to rozstrzygnąć:

1. **Rozsunąć „Otwórz profil" i „Usuń" o ~4 px i dać obu pudełka 24×24** —
   ta sama recepta, która zadziałała na kartach Projektów.
2. **Zostawić.** Myszą trafiasz; palcem na iPadzie „Usuń" jest celem 14×14
   tuż obok „Otwórz profil".

Uwaga łagodząca: usunięcie leada jest działaniem nieodwracalnym, więc trasa
i tak pyta o potwierdzenie — pomyłka nie kasuje rekordu bez pytania.
