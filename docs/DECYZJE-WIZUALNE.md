# Trzy decyzje wizualne — materiał do wyboru

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
