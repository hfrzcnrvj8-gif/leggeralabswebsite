# Plan domknięcia — od „kompletne" do „gotowe dla klienta"

**Powstał:** 2026-08-05, po zamknięciu trzeciego przejścia.
**Po co:** panel i apka są funkcjonalnie kompletne i przeaudytowane, ale trzy
rzeczy zostały nietknięte: **wygląd oglądany prawdziwymi oczami**, **przyrost
tras od ostatniego audytu bezpieczeństwa** i **przewodnik dla właściciela**.
Ten plan je domyka, w kolejności.

**Zasada:** każdy etap ma jasne kryterium ukończenia i wiadomo, KTO go wykonuje.
Część da się zrobić wyłącznie po Twojej stronie — to środowisko nie ma
prawdziwej przeglądarki i nigdy nie będzie miało.

---

## Etap 1 — Przewodnik: co to potrafi i jak z tego korzystać

**Kto:** ja. **Czas:** jedna sesja. **Dlaczego pierwszy:** bez tego etap 4
(Twój przegląd) byłby błądzeniem po ekranach.

Czego dziś nie ma: **przeglądu z góry**. Instrukcje w panelu (Moduł 53) mają
272 wpisy i tłumaczą każdy moduł z osobna — ale nie odpowiadają na pytanie
„co ja właściwie mam i od czego zacząć rano".

Powstanie:

1. **`docs/PRZEWODNIK.md`** — jeden dokument, po ludzku:
   - co panel potrafi, modułami, w jednym zdaniu na moduł;
   - **trzy ścieżki dnia**: „przyszedł nowy lead", „klient chce ofertę",
     „faktura nie została zapłacona" — krok po kroku, z nazwami przycisków;
   - co robi sam z siebie, bez Ciebie (cron o 6:00, przypomnienia, retencja,
     dokumenty cykliczne, propozycje) — **to jest najmniej oczywista część
     i najczęściej zaskakuje**;
   - czego panel świadomie NIE robi i dlaczego (żadnego modelu AI w decyzjach,
     brak automatycznego wysyłania czegokolwiek do klienta bez kliknięcia);
   - co jest na telefonie, a co zostaje przy biurku (poziom 3).
2. **Podsumowanie stanu** — co zbudowano, co przetestowano i czym (liczby:
   testy, przejścia, audyty), i co świadomie zostało otwarte.

**Skończone, gdy:** przeczytasz i powiesz, czego w tym brakuje albo co jest
niezrozumiałe.

---

## Etap 2 — Bezpieczeństwo: sprawdzenie PRZYROSTU

**Kto:** ja. **Czas:** jedna sesja.

Audyt 1 (2026-07-22, `docs/AUDYT-1-WYNIKI.md`) sprawdził 195 wywołań
`isAuthed()` w 149 plikach i zamknął temat. **Od tamtej pory repozytorium
urosło do 188 plików tras i 266 uchwytów HTTP.** Przybyło około czterdziestu
plików — Łowca leadów, Klienci (Moduł 54), Oferty (57), Aneks (58),
propozycje, potwierdzenia, obserwowalność.

`CLAUDE.md` ostrzega wprost: **każda nowa trasa w `app/api` jest domyślnie
OTWARTA**, bo `proxy.ts` wyłącza `/api` ze swojego zakresu. Zapomniana linijka
nie daje żadnego objawu — build przechodzi, panel działa.

Zakres:

1. **Sprawdzenie per uchwyt HTTP, nie per plik** (lekcja Audytu 1: grep po
   pliku kłamał — 9 kontra 16 tras). Różnica 266 − 257 to punkt wyjścia, nie
   wynik: część tras jest publiczna świadomie (formularz kontaktowy, publiczne
   dokumenty klienta, cron z własnym sekretem).
2. **Sonda 401 na każdej trasie oznaczonej jako chroniona** — z wyłączonym
   dev-bypassem, bo inaczej sonda kłamie (to też lekcja z audytu Projektów).
3. **Trzy rzeczy poza listą tras:** czy publiczne strony dokumentów nie
   wypuszczają pól, których klient widzieć nie powinien (`lib/publicFields.ts`
   istnieje — sprawdzić, czy obejmuje nowe kolumny); czy hamulce nadal działają
   po zmianach z Kroku 5; czy nowe trasy nie logują danych osobowych.

**Skończone, gdy:** każdy uchwyt HTTP ma rozstrzygnięcie „chroniony" albo
„publiczny świadomie, bo…", a sonda to potwierdza. Wynik do
`docs/AUDYT-1B-PRZYROST.md`.

---

## Etap 3 — Sytuacje krytyczne, których jeszcze nie przechodziliśmy

**Kto:** ja. **Czas:** jedna sesja.

Trzecie przejście zamknęło podwójne kliknięcia. Zostały cztery scenariusze
i **jeden z nich jest niesprawdzony i prawdopodobny**:

1. **Dwie karty edytujące TEN SAM rekord** (nie: to samo działanie — tę samą
   *treść*). Otwierasz ofertę na laptopie i na iPadzie, zmieniasz cenę w jednym
   i opis w drugim, zapisujesz oba. **Dziś prawdopodobnie wygrywa ostatni zapis
   i nikt się nie dowiaduje, że pierwszy przepadł.** To inna rodzina niż
   wszystko, co dotąd sprawdzaliśmy.
2. **Zerwane żądanie w połowie wysyłki maila** — bezpiecznik odcisku istnieje
   i wygląda poprawnie, ale nigdy nie przebiegł, bo dev nie ma skrzynki.
   Wymaga prawdziwej skrzynki albo jej atrapy.
3. **Odtworzenie bazy z kopii zapasowej** — Audyt 3 sprawdzał skrypt, ale kopie
   na NAS nie są jeszcze uruchomione (mówi to Pulpit: „Kopie zapasowe bazy nie
   są jeszcze uruchomione").
4. **Wygaśnięcie sesji w połowie pracy** — czy panel mówi „zaloguj się
   ponownie", czy gubi wpisany formularz.

**Skończone, gdy:** każdy scenariusz ma przebieg albo jawny zapis „nie da się
tu sprawdzić i dlaczego". Nowe zdania w `npm run przejscie`.

---

## Etap 4 — Przegląd UI/UX prawdziwymi oczami (TY)

**Kto:** Ty, w prawdziwej przeglądarce. Ja przygotowuję listę i poprawiam.
**Może iść równolegle z etapami 2–3.**

To jedyna warstwa, której nie sprawdziło żadne z trzech przejść — i jedyna,
której nie mogę sprawdzić sam. To środowisko renderuje stronę w ukrytej karcie
0×0: animacje nie startują, `read_page` zwraca pustkę, modale mają `opacity: 0`
mimo że są otwarte. Każda moja „ocena wyglądu" byłaby zgadywaniem.

Dostaniesz **`docs/PRZEGLAD-UI-LISTA.md`** — listę kontrolną ekran po ekranie,
z konkretnymi pytaniami zamiast „sprawdź, czy ładnie":

- czy coś **drga albo przeskakuje** przy wejściu (najczęstsza rzecz, która
  odbiera wrażenie premium);
- czy przy wolnym łączu widać **stan ładowania**, czy pustkę udającą „nic nie
  ma";
- czy po każdym kliknięciu **wiadomo, że coś się stało** (i po ilu sekundach);
- czy dwa te same rodzaje danych wyglądają **tak samo w różnych modułach**;
- czy da się dojść **samą klawiaturą** tam, gdzie się pracuje najczęściej;
- czy na wąskim oknie coś **wychodzi poza ekran albo zasłania przycisk**;
- czy **wydruki** (oferta, faktura, umowa) wyglądają dobrze na papierze i w PDF.

Plus trzy konkretne rzeczy wiszące od pierwszego przejścia (Escape przy kole
daty, menu „Wstaw z szablonu", lista kanałów zasłaniająca checkbox).

**Skończone, gdy:** przejdziesz listę i oddasz mi zgłoszenia — choćby jednym
zdaniem na sztukę, byle z nazwą ekranu.

---

## Etap 5 — Poprawki z Twojej listy

**Kto:** ja. **Czas:** zależy od tego, co znajdziesz.

Poprawki wchodzą **partiami po module albo po rodzaju**, nie „wszystko naraz" —
tak jak przy Fazie 5, gdzie wzorzec ustalony raz szedł przez cały panel.
Po każdej partii: `tsc`, `npm test`, `npm run przejscie`, commit.

Do tego trzy decyzje produktowe, które i tak trzeba podjąć (kafel „Przychód"
brutto czy netto; rubryka „Zleceniodawca / Wykonawca" na wydruku umowy;
czy porzucenie świeżo zeskanowanego paragonu ma pytać).

**Skończone, gdy:** Twoja lista jest pusta.

---

## Czego ten plan świadomie NIE obejmuje

- **Rejestracji działalności i wszystkiego za nią** (`PO_REJESTRACJI.md`) —
  decyzja: na sam koniec.
- **Przebudów** — to jest domykanie, nie nowy zakres. Jeśli w etapie 4 wyjdzie
  coś, co wymaga przebudowy modułu, trafia na osobną listę i decydujesz.
- **Nowych funkcji.** Moduł 16 (wsparcie posprzedażowe) dalej czeka na
  pierwszego klienta.
