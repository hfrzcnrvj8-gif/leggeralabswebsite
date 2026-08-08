# Etap 4 — przegląd wyglądu. Lista kontrolna dla właściciela

**Powstała:** 2026-08-06, po etapie 3. Etap 4 z `docs/PLAN-DOMKNIECIA.md`.

> **Idziesz to przejść? Nie czytaj tego pliku — weź `docs/PRZEGLAD-KARTKA.md`.**
> Tam jest sam wsad (trzynaście punktów i dwa pytania), w kolejności wykonania,
> na jedną stronę. **Ten plik jest materiałem dowodowym**: co zmierzone, czym
> i z jakim wynikiem. Zostaje, bo do niego się wraca, gdy kartka wydaje się
> zbyt skrótowa — ale czytanie 313 linii przed pracą jest dokładnie tą
> przeszkodą, przez którą lista stała nietknięta.

---

## Najpierw: zakres się ZMNIEJSZYŁ i to jest dobra wiadomość

Plan domknięcia zakładał, że cały etap 4 jest po Twojej stronie, bo „to
środowisko nie ma prawdziwej przeglądarki i nigdy nie będzie miało". **To
przestało być prawdą 2026-08-06**: podgląd renderuje panel, okno ma
1264×1243 px, animacje chodzą (zmierzone 64 klatki na sekundę), zrzuty ekranu
pokazują to, co widać.

Więc **część mierzalną zrobiłem sam** — jest niżej, razem z tym, co znalazła.
Tobie zostaje to, czego naprawdę nie da się zmierzyć: **wrażenie, papier
i prawdziwe urządzenia**.

---

## CZĘŚĆ A — co już zmierzyłem (nie sprawdzaj tego ponownie)

**Trzynaście ekranów**, każdy przy 1264 px (desktop), najbardziej złożone także
przy 390 px (szerokość iPhone'a): Pulpit, Leady, Klienci, Oferty (edytor),
Faktury, Umowy, Projekty, Kalendarz, Poczta, Katalog, Koszty, Notatnik,
Statystyki, Przypomnienia.

| co sprawdzone | wynik |
|---|---|
| czy coś wychodzi poza ekran na desktopie | **nic**, na żadnym z trzynastu |
| to samo przy oknie 390 px | **dwie usterki, obie naprawione** — patrz niżej |
| czy animacje w ogóle startują | **tak** (to było wcześniej niemierzalne) |
| czy panel się nie sypie w konsoli | bez błędów |
| cele dotykowe 24×24 (WCAG 2.5.8) | **poprawione tam, gdzie się dało** — patrz niżej |

### Dwie usterki widoczne tylko na szerokości telefonu — naprawione

1. **Poczta: przycisk „Nowa wiadomość" był POZA ekranem.** Rząd „Szukaj +
   Synchronizuj + Nowa wiadomość" miał 455 px i jako jeden element nie miał się
   gdzie złamać — przycisk kończył się na 487 px przy oknie 390 px, a poziomego
   paska przewijania nie ma. Czyli **główna akcja Poczty była na telefonie
   nieosiągalna**, bez żadnego objawu poza tym, że jej nie widać.
2. **Kalendarz: trzy filtry rozpychały ekran do 546 px.** Natywny `<select>`
   bierze szerokość od najdłuższej opcji (tu: nazwa klienta), a owijanie rzędu
   nie pomaga, gdy pojedynczy element jest za szeroki. Dziś filtry mieszczą się
   w oknie i skracają tekst.

To jest dokładnie ta rodzina, której nie widać na desktopie — i dlatego warto,
żebyś mimo wszystko przekartkował panel na telefonie (punkt B4).

### Znalezisko z części A — NAPRAWIONE tego samego dnia

**Kwadraciki zaznaczania miały 14×14 px przy regule 24×24** (Klienci 37 sztuk,
Faktury 27, Leady podobnie), do tego przyciski „✕" 12×24 i kółka kanału
kontaktu 16×16. Reguła jest w `CLAUDE.md` i Faza 5 ogłosiła ją domkniętą — ale
mierzyła wtedy Katalog, czyli jedyny ekran bez kwadracików zaznaczania.

Poprawione zgodnie z regułą: **rośnie trafienie, nie rysunek**. Kwadracik dalej
wygląda tak samo, tylko wokół niego wyrasta niewidoczne pudełko 24×24.
Sprawdzone kliknięciem 10 px POZA kwadracikiem — przełącza się.

Po przemieleniu wszystkich trzynastu ekranów doszły jeszcze dwie rodziny
i obie są poprawione: **ikonka „otwórz" w tabelach** (15×15, Koszty, Klienci,
Leady) i **gwiazdka flagi w Poczcie** (13×13). Koszty: 18 celów poniżej progu →
**2**. Poczta: 14 → **8**. Zero kolizji, czyli żadna kontrolka nie kradnie
kliknięcia sąsiadowi.

Czyste bez jednej poprawki: **Umowy, Kalendarz, Katalog, Statystyki**.

Zostały trzy rzeczy, **wszystkie na Twoje oko w części B**:

- **Trzy kontrolki na kartach Projektów** (status 15×15, priorytet **11×9**,
  zdrowie 12×12 — najmniejsze cele w całym panelu). Tego **nie da się naprawić
  rozmiarem trafienia**: sąsiadujące kontrolki dzieli 19 px, więc każde
  powiększenie sprawia, że jedna przechwytuje kliknięcia drugiej — zmierzone
  przy 24 px (17 kolizji), 18 px (2) i 16 px (6). Zamiana chybienia na
  otwarcie CUDZEGO menu jest gorsza od chybienia, więc zmianę wycofałem.
  Prawdziwa naprawa to rozsunąć kontrolki albo powiększyć ikony — czyli
  **decyzja o wyglądzie**. Zobacz na karcie projektu, czy to Ci przeszkadza.
- **Kwadraciki na kartach Tablicy** (nie w Tabeli) — ten sam powód: karty stoją
  za gęsto. Wpisane do `CLAUDE.md` jako jawny wyjątek, z drogą zastępczą (ten
  sam wybór jest w widoku Tabeli). **Sprawdź palcem na iPadzie.**
- **Wiersze list mają 19–21 px wysokości** (np. „Wymaga działania dziś",
  propozycje, pigułki statusu w Poczcie, przypomnienia). Myszą trafiasz bez
  pudła, więc to **decyzja o wyglądzie, nie usterka**.
  **Domierzone 2026-08-07 — cena jest niższa, niż mówiło to zdanie.** Stało tu
  „podniesienie do 24 px zmieniłoby gęstość wszystkich list w panelu"; liczby
  mówią co innego: cel ma 20–22 px, a **sąsiednie wiersze dzieli 31–34 px**, więc
  24 px mieści się w istniejącym odstępie i list nie trzeba rozsuwać. Brakuje
  2–4 px na cel. Warianty i rekomendacja: `docs/DECYZJE-WIZUALNE.md`, punkt 3.

---

## CZĘŚĆ A2 — domierzone 2026-08-06 wieczorem (druga sesja)

Podgląd potwierdzony ponownie: **1264×1243, 61 kl./s, zrzuty renderują**.
Jedno zastrzeżenie do części A: **pierwszy pomiar `requestAnimationFrame`
tuż po nawigacji dał 1 klatkę** — dopiero ustabilizowana strona daje 61,
w dwóch biegach z rzędu. Kto zmierzy za wcześnie, wpisze „rAF zamrożony"
i niepotrzebnie odda robotę Tobie.

Skoro podgląd działa, **z części B dało się zdjąć całe B5, mierzalną połowę
B3 i większość B6**. Wyniki są przy odpowiednich punktach niżej. Zostaje Ci
to, czego naprawdę nie zmierzę: papier, wrażenie i palec na sprzęcie.

---

## CZĘŚĆ B — co możesz sprawdzić tylko Ty

**Gdzie:** panel na `leggeralabs.pl/pl/admin` (świeżo wdrożony) — czyli
prawdziwa przeglądarka, prawdziwe dane, prawdziwy telefon i iPad.

**Jak zgłaszać:** jedno zdanie na sztukę, **z nazwą ekranu**. Nie musisz
diagnozować ani proponować rozwiązania — „na Fakturach przycisk Wystaw ucieka
w prawo, jak zawężę okno" wystarczy w zupełności. Zgłoszenia z etapu 4 wchodzą
partiami w etapie 5.

### B1. Pierwsze wrażenie (5 minut, nie analizuj)

Wejdź na Pulpit i przeklikaj po kolei: Leady → Klienci → Oferty → Faktury →
Projekty → Kalendarz.

- [x] ~~Czy coś **drga, przeskakuje albo doskakuje** przy wejściu na ekran?~~
      **ZMIERZONE 2026-08-06 — nie.** Przesunięcia układu (`layout-shift`,
      ta sama miara, którą liczy Google jako CLS) na dziewięciu ekranach:

      | ekran | przesunięcie | ekran | przesunięcie |
      |---|---|---|---|
      | Pulpit | 0 | Oferty | 0 |
      | Klienci | 0 | Statystyki | 0 |
      | Notatnik | 0 | Poczta | 0,0001 |
      | Kalendarz | 0,0039 | Projekty | 0,0054 |
      | Leady | 0,0059 | | |

      Próg „dobrze" to **0,1**, czyli najgorszy ekran panelu jest **17 razy
      poniżej** progu. Nie ma tu czego szukać okiem.

      **Czego ta liczba NIE obejmuje:** mierzy przeskoki układu, a nie
      „treść pojawia się z opóźnieniem". Ekran, który najpierw jest pusty,
      a potem wypełnia się danymi **w zarezerwowanym miejscu**, da 0 — a i tak
      można to odebrać jako doskakiwanie. Na to patrz sam.
- [ ] Czy któryś ekran wygląda jak **z innej aplikacji** niż reszta?
- [ ] Czy gdziekolwiek **oczy nie wiedzą, gdzie patrzeć najpierw**?

### B2. Czy wiadomo, że coś się dzieje

**Zmierzone lokalnie 2026-08-06 — i to jest DOLNA granica, nie to, co
zobaczysz na `leggeralabs.pl`.** Pulpit: pierwsza treść na ekranie po
**152 ms**, wszystkie cztery żądania do API skończone po **204 ms**
(najwolniejsze: `/api/notifications` 33 ms). Lokalnie nie ma więc czego
pokazywać — ekran jest gotowy, zanim zdążyłby wyglądać na zawieszony.

**Dlaczego to Ciebie nie zwalnia:** te liczby są z PGlite w pamięci procesu
i z `localhost`. Na produkcji dochodzi Neon przez HTTP (jedno żądanie na
zapytanie), zimny start funkcji Vercela i prawdziwe łącze. **Różnica może być
dziesiątki razy większa** i tego stąd nie zmierzę. Punkty niżej sprawdź
na wdrożonym panelu, nie na moich liczbach.

- [ ] Po kliknięciu „Zapisz"/„Wyślij" — **po ilu sekundach** widać, że coś się
      stało? Czy w międzyczasie ekran wygląda jak zawieszony?
- [ ] Przy wolnym łączu (wyłącz Wi-Fi na telefonie i wejdź przez LTE) — czy
      widać **stan ładowania**, czy pustkę udającą „nic nie ma"?
- [ ] Czy komunikaty znikają **zanim zdążysz przeczytać**?

### B3. Wydruki — na PAPIERZE, nie tylko na ekranie

To jest część, której nie zmierzę nigdy, a jest najbardziej „na zewnątrz":
klient dostaje te dokumenty.

**Połowę tego zmierzyłem 2026-08-06 — to zawęża, czego szukać na kartce.**

Pułapka z `CLAUDE.md` („nic, co niesie TREŚĆ, nie może stać na TLE") jest
**sprawdzona na wszystkich czterech wydrukach**: oferta, faktura, umowa,
wezwanie. W każdym z nich pasek marki to `<svg><rect fill="url(#…)">`, kwota to
`<svg><text fill="url(#…)">`, logo to SVG. **Zero** `background-clip: text`,
**zero** elementów niosących tekst na gradiencie w tle. Jedyny gradient-pod-
tekstem to przyciski „Akceptuję ofertę" / „Podpisuję" — a te siedzą w kontenerze
`print:hidden`, więc na papier nie trafiają. Wszystkie cztery mają
`@page { size: A4; margin: 16mm }`.

**Czego NIE zmierzę i na co patrz szczególnie:** tabela pozycji faktury ma
prawdziwy `<thead>`, więc nagłówki kolumn powtórzą się na drugiej stronie — ale
**nigdzie nie ma reguły `break-inside-avoid` poza blokami treści oferty**.
Blok podsumowań („Razem netto / Razem VAT / Do zapłaty") może przy dłuższej
fakturze zostać sam na drugiej stronie. Sprawdź to fakturą na kilkanaście
pozycji.

**A5 potwierdzone na ekranie:** na umowie rubryka po lewej ma nagłówek
„ZLECENIODAWCA / WYKONAWCA" (dwie role w jednym), a po prawej „DRUGA STRONA".
To wciąż czeka na Ciebie jako treść dokumentu prawnego.

Wydrukuj **naprawdę** (albo zapisz do PDF i otwórz w czytniku):

- [ ] **Oferta** — czy pasek marki u góry i kwota są widoczne? Czy logo jest?
- [ ] **Faktura** — to samo, plus: czy tabela pozycji nie łamie się głupio
      między stronami?
- [ ] **Umowa** — czy rubryka podpisów wygląda poważnie? *(Wiadomo już o jednej
      rzeczy: „ZLECENIODAWCA / WYKONAWCA" stoi w jednej rubryce, a role są dwie
      — pozycja A5, czeka na Ciebie od pierwszego przejścia.)*
- [ ] **Wezwanie do zapłaty** — czy wygląda formalnie, czy jak notatka?
- [ ] Wydrukuj jedną rzecz **czarno-białą** — czy wszystko dalej czytelne?

### B4. Telefon i iPad (palcem, nie myszą)

- [ ] Czy da się **trafić palcem** w kwadraciki zaznaczania i małe ikonki?
      (Patrz znalezisko z części A — potwierdź albo zaprzecz z ręką na sprzęcie.)
- [ ] Czy coś **zasłania przycisk**, gdy klawiatura wyjedzie na ekran?
- [ ] Czy na iPadzie w pionie panel wygląda sensownie, czy tylko w poziomie?

### B5. Trzy konkretne rzeczy wiszące od pierwszego przejścia — ✅ ROZSTRZYGNIĘTE 2026-08-06

**Nie sprawdzaj tych trzech.** Przebiegnięte w podglądzie prawdziwymi
kliknięciami i klawiszami, z pomiarem `getBoundingClientRect` /
`elementFromPoint`, nie „na oko".

1. **Escape przy otwartym kole daty — DZIAŁA POPRAWNIE.** Profil leada →
   „Przypomnij mi" → kalendarzyk → Escape: zamknął się **tylko kalendarzyk**,
   profil został otwarty (zmierzone: `Sierpień 2026` znika, „Szczegóły leada"
   zostaje). **Drugi** Escape zamyka profil — czyli łańcuch działa w obie
   strony, nie jest po prostu martwy. Poprawka z pierwszego przejścia
   (`Menu.tsx:170`, `stopPropagation` w fazie przechwytywania) jest realna.
2. **Menu „Wstaw z szablonu" — NIE POTWIERDZA SIĘ.** Oferta → Pozycje →
   „Wstaw z szablonu" → szablon: menu **zamknęło się**, a wszystkie trzy
   wstawione wiersze są widoczne i nic ich nie zasłania. Zgłoszenie dotyczyło
   niemal na pewno innej kontrolki — patrz punkt 3 i akapit pod nim.
3. **Lista kanałów na checkboksie — POTWIERDZONE i NAPRAWIONE.**
   Lista stała dokładnie na „Oznacz jako dzisiejszy kontakt" (menu `x 422–612`,
   checkbox w `(429, 591)`), więc kliknięcie w środek checkboksa ustawiało
   kanał na „Telefon" i zostawiało checkbox nietknięty. Z jedenastu kontrolek
   formularza zakrywało dokładnie tę jedną.
   **Dziś menu otwiera się W GÓRĘ** (`kierunek="gora"`), nad polem treści,
   którego w tym momencie się nie dotyka. Zmierzone po poprawce: odstęp 8 px
   nad wyzwalaczem, **zero przechwyconych kontrolek**, a ten sam klik
   przełącza checkbox i nie rusza kanału. Bliźniak u Klientów tak samo.

**Skala tego problemu była mniejsza, niż napisałem najpierw — i to jest lekcja
warta więcej niż sama poprawka.** Sonda puszczona po CAŁYM panelu pokazała, że
menu zasłaniające kontrolki pod sobą to **norma, nie usterka**: każde menu
statusu na Tablicy leadów przechwytuje kliknięcia 4–8 kontrolkom sąsiednich
kart. Nikomu to nie przeszkadza, bo **nikt nie celuje w cel, którego nie
widzi**. Dlatego zachowania domyślnego NIE zmieniono, a `kierunek="gora"` jest
opcją opt-in dla jednego układu: takiego, w którym menu zakrywa kontrolkę
używaną w tym samym ruchu co ono samo. Miara „ile kontrolek zakrywa" sama
w sobie niczego nie dowodzi — dowodzi dopiero razem z pytaniem, czy ktoś
naprawdę tam celuje.

Z tego samego powodu **menu „Z katalogu" w ofercie zostaje bez zmian**, choć
zakrywa pola *Ilość* i *Cena*: nikt nie edytuje ilości w trakcie wybierania
pozycji z katalogu.

**Przy okazji naprawione:** `PropertyMenu` szacowało własną wysokość
(`liczba pozycji × 30 px`) i nigdy jej nie przemierzało — przy sześciu
pozycjach szacunek był o 9 px za krótki. Przy menu otwieranym w dół to
niewidoczne, ale **każde menu odwrócone w górę przy dolnej krawędzi okna
nachodziło o te 9 px na własny wyzwalacz**. `Popover` miał domiar po
zamontowaniu od dawna, `PropertyMenu` nie. Sprawdzone w oknie 640 px: osiem
menu odwraca się w górę, żadne nie wychodzi poza ekran ani nie nachodzi.

### B6. Oczami klienta — ZMIERZONE 2026-08-06, zostaje Ci JEDNA rzecz

Przebiegnięte na prawdziwych publicznych linkach (oferta, faktura, umowa),
przy oknie **390 px** i na desktopie.

**Czysto — nie sprawdzaj ponownie:**

- Strona wygląda **jak dokument od firmy**, nie jak panel: białe A4 na szarym
  tle, pasek marki, logo, nagłówek z numerem. Zero elementów panelu.
- **Nic nie wychodzi poza ekran przy 390 px** na żadnym z trzech dokumentów
  (`scrollWidth` = 390 = `innerWidth`).
- Przyciski decyzji stoją **poza skalowaniem, w pełnym rozmiarze**:
  „Akceptuję ofertę" 145×36, „Wyślij prośbę o zmianę" 189×38, „Podpisuję"
  171×36. Wszystkie powyżej progu 24×24.
- **Fałszywy alarm oddalony:** checkbox zgody rysuje się 13×13, ale siedzi
  w `<label>` **324×39** i kliknięcie w tekst go przełącza (sprawdzone
  zmianą stanu, nie lekturą kodu). Realny cel dotykowy jest w normie.
- Oferta po terminie ważności nie pokazuje przycisków, tylko zdanie
  „Ta oferta wygasła. Skontaktuj się z nadawcą" — zachowuje się poprawnie.
- „← Zamknij" faktycznie zamyka kartę (sprawdzone: karta zniknęła).

**JEDNA rzecz na Twoją decyzję — czytelność dokumentu na telefonie.**

`DokumentResponsywny` pomniejsza dokument A4 (sztywne 794 px) transformem, żeby
zmieścił się na ekranie. Przy 390 px skala wynosi **0,491**, więc:

| co | na papierze / desktopie | na telefonie (efektywnie) |
|---|---|---|
| tekst pozycji, akapity umowy | 12–13 px | **5,9–6,4 px** |
| drobny druk, etykiety rubryk | 10,5 px | **5,2 px** |
| numer dokumentu (największy element) | 20 px | **9,8 px** |

Na umowie **24 z 54 węzłów tekstu wypada na 6,4 px, a 21 na 5,2 px** — czyli
klient podpisuje dokument, którego bez rozsunięcia palcami nie przeczyta.
Powiększanie gestem **działa** (`viewport` nie blokuje), więc to nie jest awaria,
tylko koszt świadomej decyzji z 2026-07-20 (naprawiała realne zgłoszenie: tabela
pozycji uciekała poza ekran). Komentarz w `DocumentScale.tsx` tej ceny nie
odnotowuje.

**Do rozstrzygnięcia przez Ciebie: czy to zostaje.** Alternatywa (układ
przelewający się na telefonie zamiast pomniejszania A4) jest większą robotą
i była raz odrzucona dla maili, bo rozjeżdżała różne dokumenty na różne sposoby.
**Zobacz to na własnym telefonie i powiedz, czy przeszkadza** — to jedyne
pytanie z B6, które zostało.

---

## Czego ta lista świadomie NIE obejmuje

- **Działania.** Trzy przejścia „na sucho" i siedem audytów sprawdzały, czy
  panel robi to, co ma robić. Tutaj chodzi wyłącznie o to, jak wygląda i jak się
  z tego korzysta.
- **Rzeczy zależnych od rejestracji firmy** (`PO_REJESTRACJI.md`) — nota prawna
  z prawdziwymi danymi, KSeF na produkcji. To nie są usterki wyglądu.
- **Apki iOS.** Ma własną historię przeglądów; ten etap dotyczy panelu.
