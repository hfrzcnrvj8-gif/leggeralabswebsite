# Kartka na jedno posiedzenie z panelem

**Powstała:** 2026-08-08. To jest **cały wsad etapu 5** wyjęty z części B
`docs/PRZEGLAD-UI-LISTA.md` — czternaście rzeczy do sprawdzenia i dwa pytania
do rozstrzygnięcia. Tamten plik zostaje jako materiał dowodowy (313 linii,
w większości „już zmierzone"); **tu jest sama robota, w kolejności wykonania.**

**Ile to trwa:** 35–45 minut, z czego 10 czeka na drukarkę.

**Po co:** bez tych zdań etap 5 nie ma czego poprawiać. Przy okazji domykają
się dwie rzeczy, które od dwóch dni czekają na Twój palec i Twoje oko:
kwadraciki na Tablicy (punkt 2 w `docs/DECYZJE-WIZUALNE.md`) i czy nowy Pulpit
faktycznie się czyta.

**Jak zgłaszać:** jedno zdanie na sztukę, **z nazwą ekranu**. Nie diagnozuj
i nie proponuj rozwiązania — „na Fakturach przycisk Wystaw ucieka w prawo, jak
zawężę okno" wystarczy w zupełności. Zdanie „wszystko ok" też jest wynikiem.

---

## Krok 1 — Wydruki na PAPIERZE (~10 min, zacznij od tego)

Zacznij tutaj, bo drukarka mieli w tle, a Ty w tym czasie robisz krok 2.

**Skąd wziąć dokumenty:** jednym poleceniem, przy działającym `npm run dev`:

```bash
npm run wydruki
```

Zakłada komplet w lokalnej bazie i wypisuje **cztery gotowe adresy** —
otwierasz, klikasz „Drukuj / Zapisz PDF". Faktura ma **15 pozycji** (sam
klikałbyś je po jednej — popover „Z katalogu" zamyka się po każdej) i jest
25 dni po terminie, żeby dało się wydrukować także wezwanie. Nic nie wychodzi
do nikogo i nic nie ląduje w prawdziwych danych. Dev-baza żyje w pamięci
serwera, więc **odpal to w tej samej minucie, w której siadasz do drukowania**
— restart `npm run dev` kasuje te dokumenty.

Wydrukuj **naprawdę** (albo zapisz do PDF i otwórz w czytniku — nie oglądaj
w przeglądarce):

- [ ] **Oferta** — czy pasek marki u góry, kwota i logo są widoczne?
- [ ] **Faktura na kilkanaście pozycji** — to jedyna rzecz z wydruków, której
      nie zmierzyłem: czy blok **„Razem netto / Razem VAT / Do zapłaty"** nie
      zostaje sam na drugiej stronie? Nagłówki kolumn powtórzą się poprawnie,
      to sprawdzone.
- [ ] **Umowa** — czy rubryka podpisów wygląda poważnie? *(Wiadomo już
      o jednym: „ZLECENIODAWCA / WYKONAWCA" stoi w jednej rubryce, a role są
      dwie — pozycja A5. Nie musisz tego zgłaszać drugi raz.)*
- [ ] **Wezwanie do zapłaty** — czy wygląda formalnie, czy jak notatka?
      *(Otworzy się z przerywaną ramką „PODGLĄD" u góry — to znaczy, że pismo
      nie zostało wysłane. Ramka zostaje na wydruku świadomie, żeby kartka
      z drukarki nie była nie do odróżnienia od pisma, które naprawdę poszło.)*
- [ ] **Jeden dokument czarno-biały** — czy wszystko dalej czytelne?

---

## Krok 2 — Pięć minut na wdrożonym panelu, NIE analizuj (~5 min)

Wejdź na `leggeralabs.pl/pl/admin` i przeklikaj po kolei:
**Pulpit → Leady → Klienci → Oferty → Faktury → Projekty → Kalendarz.**

Pierwsze wrażenie, nie audyt. Trzy pytania:

- [ ] Czy któryś ekran wygląda **jak z innej aplikacji** niż reszta?
- [ ] Czy gdziekolwiek **oczy nie wiedzą, gdzie patrzeć najpierw**?
- [ ] **Pulpit po przebudowie** (4 kafle zamiast 8, trzy wielkości liczb):
      czy czegoś **szukasz wzrokiem i nie znajdujesz**? Zdjęte zostały „Wymaga
      działania dziś" (to samo, co w nagłówku strony), „Opinie klientów"
      i „Leady z polecenia" (są w Statystykach). Cofnięcie jest wciąż tanie.

---

## Krok 3 — Czy widać, że coś się dzieje (~5 min, na wdrożonym panelu)

Lokalnie panel maluje Pulpit w 152 ms, więc nie ma tu czego pokazać — ale to
PGlite w pamięci i `localhost`. Na produkcji dochodzi baza po HTTP i budzenie
się funkcji Vercela. **Te trzy pytania mają sens wyłącznie na `leggeralabs.pl`.**

- [ ] Po kliknięciu **„Zapisz" / „Wyślij"** — po ilu sekundach widać, że coś
      się stało? Czy w międzyczasie ekran wygląda jak zawieszony?
- [ ] **Wyłącz Wi-Fi na telefonie, wejdź przez LTE** — czy widać, że się
      ładuje, czy pustkę udającą „nic tu nie ma"?
- [ ] Czy komunikaty (te zielone/czerwone paski) **znikają, zanim zdążysz je
      przeczytać**?

---

## Krok 4 — Palcem: telefon i iPad (~10 min)

To jedyna część, której nie da się zrobić myszą, i to tutaj rozstrzyga się
otwarta decyzja.

- [ ] **Tablica leadów, kwadraciki zaznaczania w rogu kart** — trafiasz palcem,
      czy zdarza Ci się chybić albo zaznaczyć sąsiednią kartę? **To rozstrzyga
      punkt 2 z `docs/DECYZJE-WIZUALNE.md.`** Chybisz choć raz → rozsuwam karty
      o 4 px. Nie trafisz problemu → zostaje jak jest, bo ten sam wybór masz
      w widoku Tabeli, gdzie wiersze są luźniejsze.
- [ ] Czy coś **zasłania przycisk, gdy wyjedzie klawiatura**? (Najbardziej
      podejrzane: dodawanie notatki, szybki wpis rozmowy, formularz leada.)
- [ ] Czy **iPad w pionie** wygląda sensownie, czy tylko w poziomie?
- [ ] **Otwórz na telefonie publiczny link do umowy** (ten, który dostaje
      klient) — czy da się to przeczytać **bez rozsuwania palcami**? Zmierzone:
      dokument jest pomniejszany do 49%, więc akapity umowy mają efektywnie
      5,9–6,4 px, a drobny druk 5,2 px. Powiększanie gestem działa, więc to nie
      awaria, tylko cena decyzji z lipca. **Twoje pytanie: czy przeszkadza.**

---

## Czego świadomie NIE sprawdzasz

Żeby nie tracić czasu na to, co już ma odpowiedź w liczbach:

- czy coś **drga albo przeskakuje** przy wejściu na ekran (zmierzone na
  dziewięciu ekranach: najgorszy jest 17 razy poniżej progu),
- czy coś **wychodzi poza ekran** (trzynaście ekranów, desktop i szerokość
  telefonu — dwie usterki znalezione i naprawione),
- **Escape przy kalendarzyku**, **menu „Wstaw z szablonu"**, **lista kanałów
  na checkboksie** — całe B5, przebiegnięte prawdziwymi kliknięciami,
- czy **pasek marki i kwota** znikają na wydruku (wszystkie cztery dokumenty
  są SVG, zero `background-clip: text`),
- **publiczne dokumenty poza tym jednym pytaniem o czytelność** — nic nie
  wychodzi poza ekran, przyciski decyzji są pełnowymiarowe, wygasła oferta
  zachowuje się poprawnie.

---

## Co potem

Wklej mi listę zdań w dowolnej formie — jedno zdanie na sztukę, z nazwą
ekranu. Z tego robię **etap 5** (poprawki wchodzą partiami, nie wszystkie
naraz). Zdania z kroku 4 rozstrzygają przy okazji punkt 2 decyzji wizualnych,
a z kroku 2 — czy hierarchia Pulpitu zostaje.

Pełny materiał dowodowy, gdyby coś tu było za skrótowe:
`docs/PRZEGLAD-UI-LISTA.md` (części A i A2 — co zmierzone i czym).
