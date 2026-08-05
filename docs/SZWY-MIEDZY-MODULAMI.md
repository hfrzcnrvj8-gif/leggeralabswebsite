# Szwy między modułami — czy to jeden system

**Powstał:** 2026-08-06, na pytanie właściciela: „czy faktycznie wszystko ze
sobą współpracuje i czy to jest naprawdę pełnoprawny system, który jako jedna
aplikacja może mocno zautomatyzować obsługę klienta od początku do końca?".

**Czym to różni się od wszystkiego wcześniej.** Siedem audytów końcowych
i kilkanaście audytów modułów patrzyło **W GŁĄB** modułu: czy Faktury robią
dobrze to, co robią Faktury. Ten przegląd patrzy na **STYKI** — czy to, co
kończy jeden moduł, naprawdę zaczyna następny. To inna rodzina pytań i dała
inne wyniki.

**Metoda:** sonda na żywej bazie, nie lektura. Każde zdanie niżej ma pod sobą
albo zmierzoną liczbę, albo `grep -c` z wynikiem zero.

---

## Odpowiedź w dwóch zdaniach

**Kręgosłup obsługi klienta jest jednym systemem** i to jest dowiedzione:
`npm run przejscie` przechodzi 116 zdań na żywych danych od pierwszego kontaktu
do zapłaconej faktury i prośby o opinię, a dane przepisują się między modułami
same.

**Druga połowa bilansu nie była obywatelem tego systemu.** Wszystkie trzy
znalezione dziury leżały po tej samej stronie — przy **pieniądzach
wychodzących**. Panel pilnował pieniędzy przychodzących z czterech powierzchni
i wysyłał o nie trzy maile sam; o wychodzących nie mówił nic poza własną listą
modułu Koszty. Wszystkie trzy naprawione tego samego dnia.

---

## Co trzyma (sprawdzone przebiegiem, nie lekturą)

Te szwy przechodzi harness i każdy z nich jest osobnym zdaniem, które potrafi
upaść:

- akceptacja oferty **jedną operacją** zakłada projekt, szkic faktury i zamyka
  leada sukcesem — dwa kliknięcia naraz nie zakładają dwóch projektów;
- umowa przepisuje z oferty zakres, kwotę, walutę i termin;
- podpis umowy uruchamia projekt, wpisuje mu termin i datę startu;
- wystawienie faktury zamraża dane sprzedawcy i zamyka treść;
- pełna wpłata przestawia fakturę na „Opłaconą" i rodzi propozycję
  przestawienia klienta na „Aktywnego";
- opinia klienta rodzi propozycję domknięcia projektu, a domknięcie planuje
  kontakty kontrolne +14 i +90 dni — **pętla wraca do nowej sprzedaży**.

---

## Dziura 1 — rentowność projektu liczyła koszty w obcej walucie po nominale

**To był błąd, nie brak funkcji.**

Zmierzone: koszt **1000 EUR z kursem 4,30** (czyli 4300 zł) podpięty do
projektu wchodził do rentowności jako **1000 zł**. Zysk zawyżony o 3300 zł.
Flaga `ma_inne_waluty` milczała, bo patrzyła wyłącznie na faktury.

Rozjazd był w obrębie jednej bazy: `app/api/projects/[id]/route.ts` liczyło
gołe `SUM(kwota_netto)`, podczas gdy moduł Koszty i eksport dla księgowej
liczyły `wPln()` — czyli kwotę razy kurs, z pominięciem wpisów bez kursu. Dwa
ekrany podawały dwie różne kwoty tego samego kosztu i **żaden nie wyglądał na
zepsuty**.

To ta sama rodzina, co rabat pominięty w tej samej sumie (audyt Projektów,
2026-07-31): jedna suma, trzy wskaźniki naraz (koszty, zysk, efektywna stawka
godzinowa), zero objawów.

**Naprawione.** Suma mnoży przez kurs i wyrzuca koszt w obcej walucie bez
kursu, a profil projektu pisze pod kwotą, ilu kosztów nie objął. Zdanie
w przejściu sprawdzone kontrolnie — po tymczasowym cofnięciu poprawki upada
z komunikatem „rentowność policzyła 1000 zamiast 4300".

## Dziura 2 — niezapłacona faktura od dostawcy nie odzywała się nigdzie

Zmierzone: koszt 8000 zł, nieopłacony, 20 dni po terminie → **zero trafień** na
Pulpicie, w Kalendarzu, w porannym mailu i w dzwonku. Widać go było wyłącznie
po otwarciu modułu Koszty.

Ironia jest zapisana w samym kodzie: kolumna `termin_platnosci` ma nad sobą
komentarz „bez tego pola nieopłacona faktura od dostawcy mogła leżeć dowolnie
długo i nic o niej nie przypominało (Moduł 63)". Pole dodano — i nikt poza
własnym modułem nigdy go nie przeczytał.

**Naprawione.** Koszt po terminie trafia teraz na Pulpit (sekcja „Do zapłaty po
terminie", zaraz pod „Zaległymi fakturami" — te dwie rzeczy czyta się razem),
do licznika „wymaga działania dziś", do porannego maila i na siatkę Kalendarza
jako nowy rodzaj wpisu. **Nikomu niczego nie wysyła** — to przypomnienie dla
właściciela, nie dla dostawcy.

## Dziura 3 — Statystyki nie znały kosztów w ogóle

Zmierzone: `grep -c "costs" app/api/stats/route.ts` → **0**. Ekran nazwany
„wskaźniki zdrowia biznesu" odpowiadał wyłącznie na pytanie, ile firma
sprzedała. Rentowność istniała tylko per projekt (i była zepsuta — patrz
dziura 1), więc na pytanie „czy ja na tym zarabiam" nie odpowiadało nic.

**Naprawione.** Doszły dwa kafle (koszty i zysk w oknie 12 miesięcy) i dwa
wykresy trendu. Zysk jest **różnicą dwóch policzonych trendów**, świadomie nie
osobnym zapytaniem — żeby nie dało się go rozjechać z żadnym z nich. Przejście
sprawdza to wprost: „zysk to przychód minus koszty, policzone z tych samych
liczb".

## Dziura 4 — Kalkulator doboru był wyspą

Zmierzone: `lib/dobor.ts` importował **dokładnie jeden plik** — własny ekran.
Rekomendacja sprzętu, czyli cena usługi flagowej, nie miała żadnej drogi do
oferty ani do katalogu. Jedynym wyjściem był wydruk PDF, więc liczby ustalone
przy kliencie przepisywało się do oferty z kartki. To był najdroższy ręczny
przepis w całym łańcuchu.

**Naprawione.** Przycisk „Przenieś do oferty" zakłada szkic oferty
i wkłada rekomendację jako blok treści (sprzęt, model, widełki kosztu,
uzasadnienie), po czym od razu ten szkic otwiera.

**Czego świadomie NIE robi: nie wstawia pozycji cennika.** Kalkulator podaje
widełki („50–68 tys."), a pozycja oferty ma jedną cenę — zamiana jednego na
drugie byłaby zgadywaniem w dokumencie, który klient podpisuje. Ceny dalej
składa się z Katalogu. Zdanie o niewiążącym charakterze wyceny idzie razem
z treścią i pilnuje go test.

## Dziura 5 (drobna) — koniec umowy nie stał w Kalendarzu

Pulpit miał sekcję „Umowy dobiegające końca" od 2026-07-27, Kalendarz o umowach
nie wiedział nic — a to jedyna rzecz w panelu, która po terminie **przedłuża
się sama** i której się potem nie odkręci. **Naprawione:** koniec okresu
obowiązywania podpisanej umowy stoi w kalendarzu, z rozróżnieniem „Koniec
umowy" / „Umowa przedłuży się sama".

---

## Co przy okazji wyszło o samych instrukcjach

Jedno zdanie z etapu 1 było nieprawdziwe: instrukcja mówiła „bez kursu koszt
zapisze się, ale nie wejdzie do sum". Sonda: trasa **odmawia zapisu** (bramka
z audytu Modułu 63). Zdanie było prawdziwe tylko dla importu z KSeF. Poprawione
razem z resztą.

---

## Czego ten przegląd NIE objął

- **Szwu Poczty** — dev nie ma skrzynki, więc „mail od znanego adresu dopina
  się do klienta" zna tylko kod, nie sonda.
- **Apki** — nie dotykana. Nowe rodzaje wpisów w Kalendarzu (`cost`,
  `contract`) apka pokaże neutralnie, bo ma zaprojektowany odwrót na nieznany
  rodzaj (`RodzajTerminu(rawValue:) ?? .nieznany`). Sekcja „Do zapłaty po
  terminie" na Pulpicie i kafle kosztów w Statystykach są dziś **tylko
  w panelu** — apka je zignoruje, dopóki ktoś ich tam nie dołoży. To jest
  świadome odłożenie, nie awaria.
- **Wyglądu tych zmian w prawdziwej przeglądarce** — jak zawsze, etap 4.

## Lekcja, która przeżyje ten przegląd

**Audyt modułu nie znajdzie dziury na szwie**, bo każdy moduł z osobna robił
swoje poprawnie: Koszty liczyły kursy dobrze i miały termin płatności,
Kalkulator liczył dobór dobrze, Statystyki liczyły przychód dobrze. Nikt nie
pytał, czy to, co jeden moduł wie, dociera do drugiego.

**Praktyczne sprawdzenie na przyszłość:** wziąć pole, które jeden moduł zapisuje
(`termin_platnosci`, `kurs_pln`, wynik kalkulatora) i policzyć `grep -rl`, ile
plików je CZYTA. Jeden — to wyspa. Ta jedna komenda znalazła trzy z pięciu
dziur z tej listy.
