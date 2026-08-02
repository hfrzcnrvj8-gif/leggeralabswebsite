# Pierwsze przejście „na sucho" — od leada do zapłaconej faktury

**Data:** 2026-08-02. **Środowisko:** lokalne (`npm run dev`, dev-baza PGlite,
dev-login). **Punkt startu:** `635f737`. **Nic nie zostało naprawione** — to
jest lista, nie zestaw poprawek.

> **Ten dokument jest MIGAWKĄ z 2026-08-02 i celowo się go nie aktualizuje.**
> Aktualny stan każdego znaleziska mówią dwa źródła, które nie potrafią się
> zestarzeć, bo sprawdzają dane: `npm run przejscie` (znaczniki `luka`
> w `scripts/przejscie/przejscie.ts`) i ekran *Zdrowie*. Postęp prac opisuje
> `docs/PLAN-ZAPLECZE.md`.
>
> Stan na 2026-08-02, po Fazie 4: **B1–B6, A1–A4, C1–C4 oraz D1, D3 i D4
> zamknięte.** Otwarte zostają A5 (jedna rubryka, dwie role na wydruku umowy —
> nie mieściło się w zakresie Fazy 2, patrz plan), **D2** (nowy lead ląduje
> poza ekranem — decyzją właściciela przeniesione do Fazy 5, bo to zachowanie
> listy, nie bariera), E i F (Faza 5) oraz G (do rozstrzygnięcia osobno).
>
> C1, C3 i C4 są zamknięte **jako propozycje, nie automaty**: panel zauważa
> skutek zdarzenia i pyta, właściciel zatwierdza jednym kliknięciem. Opis
> poniżej („projekt dalej miał status W trakcie") jest więc nadal prawdziwy
> co do samego zapisu — zmieniło się to, że panel o tym mówi i umie to
> naprawić. Patrz `docs/PLAN-ZAPLECZE.md` → Faza 3.

## Co zostało przeprowadzone

Wymyślony klient: **Drukarnia Helios sp. z o.o.** (Kraków, poligrafia), osoba
kontaktowa Marta Zielińska. 40 zapytań ofertowych dziennie przepisywanych
ręcznie, warunek: pliki nie mogą opuszczać firmy → lokalny model.

Pełna droga, każdy krok wyklikany w panelu:

| krok | wynik |
|---|---|
| lead z polecenia | `Drukarnia Helios sp. z o.o.` |
| rozmowa telefoniczna + wpis w historii | kanał telefon, „Oni → ja", przypomnienie 05.08 |
| oferta PoC-first | `OF-2026-1DFAB2`, 8000 zł netto, 3 pozycje, 2 sekcje, ROI |
| wysyłka i akceptacja przez klienta | zaakceptowana przez „Marta Zielińska", 02.08 |
| umowa | `UM-2026-C71994`, zaliczka 50%, termin 28.08, podpisana |
| projekt | `Helios — PoC lokalnego modelu…`, 03.08 → 28.08, Wdrożone |
| faktura | `FV 93/2026`, 8000 netto / 9840 brutto, wysłana, opłacona |
| opinia | 5 / 4 / 5, zgoda na case study, `avg_rating` 4,67 |

**Łańcuch trzyma się w całości.** Akceptacja oferty sama utworzyła projekt
i szkic faktury, „Wygeneruj umowę" domknęła resztę, a graf „SKĄD I DOKĄD"
pokazuje komplet w każdym z czterech modułów. Pulpit policzył wszystko
poprawnie: przychód, `Opinie klientów 4,7/5 (2/2)`, `Leady z polecenia 18,2%`,
`Papier przed pracą 50% (1/2 z umową)`. Serwer poprawnie odmawia zmian na
wystawionej fakturze (`PATCH` → **409**).

To, co niżej, to miejsca, w których musiałem zgadywać, cofać się albo szukać
czegoś, czego nie było widać.

---

## A. To zobaczy klient

### A1. Mail zamykający wyszedł z niewypełnionymi nawiasami
**Najpoważniejsze znalezisko całego przejścia.**

Zakładka *Opinia klienta* → „Zamknięcie projektu i opinia" podstawia gotowy
szkic i daje przycisk **Wyślij mailem**. Kliknąłem. Do klienta poszło —
dosłownie, potwierdzone w logu wysyłki:

```
Co dalej: [uzupełnij, jeśli jest plan na kolejne kroki/wsparcie]
…
Pozdrawiam,
[Twoje imię]
```

Bez ostrzeżenia, bez potwierdzenia, jedno kliknięcie. Panel **zna** imię
właściciela — siedzi w *Dane firmy* → „Podpisuje umowy: Patryk Piecyk" — i tu
go nie używa.

### A2. Dokument do klienta bez danych wystawcy — i migawka tego nie chroni
Oferta została **wysłana i zaakceptowana** z blokiem `WYSTAWCA` równym `—`
i pustą stopką `FIRMA —` / `KONTAKT`. Edytor nie ostrzegał. Co więcej: blokuje
wysyłkę, gdy brakuje maila **klienta**, ale nie gdy brakuje **wystawcy**.

Dane sprzedawcy ustawia się wyłącznie z modułu *Faktury* → **Dane firmy**
(ikona banku bez podpisu w pasku narzędzi). Nic w Ofertach ani Umowach na to
nie wskazuje — trafiłem tam dopiero po obejrzeniu wydruku.

Drugie dno, potwierdzone na danych: **migawka nie obejmuje wystawcy.**
Migawka oferty to `{items, offer, sections}` — bloku „Dane firmy" tam nie ma.
Po uzupełnieniu ustawień ta sama, „zamknięta na stałe" oferta pod linkiem
klienta pokazuje już moje dane. Czyli zmiana nazwy, NIP-u lub numeru konta
zmienia **wstecz** każdy dokument, który klient wciąż może otworzyć.
Najostrzejszy przypadek to faktura.

### A3. Adres sprzedawcy drukuje się na fakturze, ale nie na ofercie i umowie
Adres jest zapisany (`ul. Kalwaryjska 33/5, 30-504 Kraków`). Faktura drukuje go
w całości. Oferta i umowa — tylko nazwę, NIP i e-mail. Na umowie brak adresu
wykonawcy to realna dziura, bo dokument identyfikuje strony. To niespójność
między rodzajami dokumentów, nie globalny brak.

### A4. Szablon oferty wpisał termin sprzeczny z moją sekcją „Terminy"
Szablon „Audyt / PoC AI" dopisał do *Uwag*: „Czas realizacji: ok. 2 tygodnie od
akceptacji". Moja sekcja *Terminy* mówi 3 tygodnie. **Wydruk zawiera oba
zdania.** Nic tego nie sygnalizuje.

Przy okazji: ten sam szablon wstawia **tylko pozycje cenowe**. Panel sam
ostrzega „Bez sekcji oferta jest samym cennikiem" — czyli szablon zostawia
ofertę dokładnie w stanie, przed którym panel ostrzega.

### A5. „ZLECENIODAWCA / WYKONAWCA" — jedna rubryka, dwie role
Na wydruku umowy nasza strona jest podpisana `ZLECENIODAWCA / WYKONAWCA`,
druga `DRUGA STRONA`. Klauzule konsekwentnie mówią „Wykonawca" (my)
i „Zamawiający" (klient). Na dokumencie prawnym to myli.

---

## B. To samo wpisywane drugi raz

### B1. Oferta z leada bierze tylko nazwę klienta
Założenie oferty z leada tworzy kartę klienta z **pełnym** adresem, mailem
i telefonem. W samym dokumencie oferty `klient_ulica`, `klient_kod`,
`klient_miasto`, `klient_email` są **puste** — przeszła tylko nazwa.

Obejście istnieje i jest niewidoczne: trzeba otworzyć picker „Powiązany klient"
i wybrać **ponownie tego samego, już odhaczonego** klienta. Dopiero wtedy dane
wskakują. Sam bym na to nie wpadł, gdyby nie to, że panel zablokował wysyłkę
komunikatem „Uzupełnij e-mail klienta" — czyli wie, że czegoś brakuje, ale nie
mówi, że jest to o jedno kliknięcie dalej.

### B2. E-mail nabywcy pusty na fakturze
`klient_email = ""` na fakturze auto-utworzonej z oferty. Adres pocztowy
przeszedł, mail nie. To dokument, który się **wysyła mailem**.

### B3. Faktura nie wie o umowie
Faktura pokazuje `WYNIKA Z: oferty OF-2026-1DFAB2, umowy — brak —`, choć
podpisana umowa dotyczy dokładnie tego zlecenia i jest widoczna w grafie
tuż nad tym polem (`contract_id = null`). Przyczyną jest kolejność: faktura
powstała przy akceptacji oferty, umowa dopiero potem — i nic ich nie łączy
wstecz.

### B4. Formularz „Nowy lead" ma dwa pola
Firma + skąd przyszedł. Po telefonie od klienta nie ma gdzie wpisać osoby,
telefonu, maila, miasta ani branży. Rekord powstaje pusty, a resztę dopisuje
się w profilu — którego najpierw trzeba poszukać (patrz D2).

### B5. Sekcja „Terminy" z oferty nie idzie do umowy
`zakres_prac` przechodzi z pozycji oferty, `termin_realizacji` zostaje `null`.
Ten sam termin wpisywałem drugi raz.

### B6. Projekt z podpisanej umowy ląduje w „Pomysł", bez dat
Umowa ma termin 28.08. Projekt nie dziedziczy ani startu, ani terminu, i staje
w pierwszej kolumnie tablicy, obok rzeczy, których jeszcze nie sprzedałem.
Nazwę też dostaje po ofercie: `Oferta — Drukarnia Helios sp. z o.o.` — na
liście projektów mam pozycję zaczynającą się od słowa „Oferta".

---

## C. Pętla się nie domyka sama

### C1. Opinia klienta nie zamyka projektu
Po przesłaniu oceny 5/4/5 projekt dalej miał status „W trakcie". Musiałem
przestawić ręcznie. Zakładka nazywa się „Zamknięcie projektu i opinia", ale
zamyka wyłącznie opinię.

### C2. Mail mówi „zakończony", gdy projekt jest „W trakcie"
Ten sam szkic twierdzi „Projekt (…) jest zakończony", a pod nagłówkiem
„Co zrobiliśmy" wypisuje kamień milowy z terminem **28.08.2026** — datą
przyszłą.

### C3. Wygrany lead zostawia żywe przypomnienie
Lead poprawnie przeskoczył na „Zamknięte - sukces" (bardzo dobrze), ale
zachował `next_followup = 2026-08-05` i `next_action = "Rozmowa wideo 5.08
o 10:00 — pokazać demo"`. Zamknięty, wygrany lead dalej ma zaplanowane demo.

### C4. Karta klienta zostaje „Prospektem"
Po podpisanej umowie, opłaconej fakturze i opinii 5/4/5 status klienta to
wciąż `Prospekt`, a `ostatni_kontakt` to `null`. Nic w całym przejściu nie
ruszyło statusu klienta ani jego daty kontaktu.

---

## D. Bariery postawione w złych miejscach

### D1. Wystawienie faktury nie pyta o nic
„Wystaw fakturę" nadaje trwały numer w serii (`FV 93/2026`) i jest
nieodwracalne — dalej można tylko korygować albo anulować. Zero potwierdzenia.
Dla porównania „Oznacz jako podpisaną" na umowie **potwierdzenia wymaga**.
Mocniejsze działanie ma słabszą barierę.

Na plus: przy wystawieniu panel sam uzupełnił daty (wystawienia, sprzedaży,
termin 16.08 z ustawień) — nie trzeba było niczego klikać.

### D2. Nowy lead ląduje poza ekranem
Po „Dodano leada." rekord trafił na **10. pozycję z 11** (sortowanie po
„ostatni kontakt", nowy nie ma żadnego). Lista się nie przewinęła, nic go nie
podświetliło. Musiałem go znaleźć wyszukiwarką. Toast mówi „dodano", ekran nie
pokazuje.

### D3. Modal nie blokuje tego, co pod nim
Przy otwartym oknie „Nazwa kamienia milowego" kliknąłem pigułkę *Status* pod
spodem — i menu statusów się otworzyło. Dwie warstwy interakcji naraz.

### D4. „Dane firmy" nie ma przycisku Zapisz
Modal ma jeden przycisk: **Zamknij**. Zapisuje pole po polu, przy opuszczeniu
pola. Wygląda jak formularz z OK/Anuluj, więc łatwo uwierzyć, że zamknięcie
oznacza anulowanie.

---

## E. Wygląd — rzeczy zmierzone, nie „wydaje mi się"

### E1. „Szkło" nie rozmywa — gubi się w buildzie
Kalendarz „Termin" w umowie (klasa `.glass`) ma tło `rgba(13,14,16,0.82)`
i `backdrop-filter: none`. Tekst klauzul umowy czyta się **przez** siatkę dni.

Przyczyna leży w zbudowanym CSS, nie w źródle. `app/globals.css:105` deklaruje
obie właściwości:

```css
backdrop-filter: blur(16px) saturate(200%);
-webkit-backdrop-filter: blur(16px) saturate(200%);
```

W arkuszu serwowanym przez dev (`/_next/static/chunks/…css`) została **tylko**
wersja `-webkit-`. W przeglądarce podglądu:
`CSS.supports('backdrop-filter','blur(16px)') === true`,
`CSS.supports('-webkit-backdrop-filter','blur(16px)') === false`.
Efekt: `.glass`, `.glass-ios` i `.glass-sheet` renderują się jako
półprzezroczysty prostokąt bez rozmycia — górny pasek, paleta poleceń,
popovery, arkusze.

**Do potwierdzenia przez właściciela w jego Safari i Chrome** — mierzyłem
w przeglądarce podglądu, a ta bywa niereprezentatywna. Ale przyczyna
(brakująca właściwość w serwowanym pliku) jest niezależna od przeglądarki.

### E2. Okna potwierdzeń są jasne w ciemnym panelu
Dialog `useUI().confirm()` renderuje się w portalu **poza** `.admin-linear`
(`element.closest('.admin-linear') === null`), więc dziedziczy jasną paletę
strony publicznej: biała karta, ciemny tekst. To samo dotyczy
`useUI().prompt()` („Nazwa kamienia milowego").

Dotyczy **każdego** potwierdzenia w panelu — czyli akurat tych momentów, które
są nieodwracalne.

### E3. Wiersz „Daty" wychodzi poza kartę projektu
Po wpisaniu obu dat przycisk terminu zajmuje `x = 1030–1113`, a karta
WŁAŚCIWOŚCI kończy się na `x = 1102`. Ostatnie znaki roku są ucięte —
na ekranie widać `28.08.202`.

### E4. Nazwa kamienia milowego ucięta w pół słowa
„Audyt procesów i danyc" — bez wielokropka, bez dymka. W bazie pełne
„…i danych".

---

## F. Drobiazgi, które i tak uwierały

- **Kolumny „Ostatni kontakt" i „Dni" nie odświeżają się** po dodaniu wpisu
  z zaznaczonym „Oznacz jako dzisiejszy kontakt". Baza ma
  `ostatni_kontakt = 2026-08-02`, wiersz pokazuje `—` aż do przeładowania.
  Sąsiednie kolumny (branża, telefon, miasto) odświeżyły się od razu.
- **Umówiona rozmowa wideo nie trafia do Kalendarza.** Profil leada nie ma
  żadnej akcji „dodaj do kalendarza"; jest tylko „Przypomnij mi" — data bez
  godziny. Godzinę 10:00 dało się zapisać wyłącznie jako tekst w polu
  „Następny krok".
- **Formularz „Nowy wpis" czyści po zapisie tylko treść.** Kanał (Telefon)
  i kierunek (Oni → ja) zostają zaznaczone. Drugi wpis z rozpędu pójdzie
  z kanałem poprzedniego.
- **Lista kanałów otwiera się w dół, dokładnie na wierszu „Oznacz jako
  dzisiejszy kontakt"** — pozycja „Telefon" leży na checkboxie.
- **Po kliknięciu chipa „Za 3 dni" pojawia się inline data i przesuwa chipy
  w lewo** — następne kliknięcie trafia w sąsiedni chip.
- **Menu „Wstaw z szablonu" nie zamyka się po wstawieniu** — zasłania wiersze,
  które właśnie dodało.
- **Kroki mapy „15 kroków" nie są klikalne.** Mapa mówi „Oferta (PoC-first)"
  i nie prowadzi do Ofert. Na podstronie leada napis „wszystkie kroki" wygląda
  na link, a klikalny jest cały wiersz nad nim.
- **Escape zamyka cały modal profilu**, nie tylko otwarte menu.
- **Pozycje listy „Skąd przyszedł" nie mają nazw dostępnościowych**
  (`menuitemradio` bez etykiety).

---

## G. Jedna rzecz do rozstrzygnięcia, nie do naprawienia

Kafel **„Przychód (ten miesiąc)"** pokazał `9840,00 zł` — czyli **brutto**
opłaconej faktury. Netto to 8000,00 zł. W polskiej rachunkowości przychód to
kwota netto; VAT jest do przekazania, nie do wydania. Kafel nie ma dymka
mówiącego, którą kwotę liczy — a obok stoi „Rezerwa podatkowa" z osobną
rubryką VAT.

Nie przesądzam, że to błąd — to decyzja produktowa. Ale przy 23% różnicy warto
ją podjąć świadomie i podpisać kafel.

---

## Uwagi metodyczne

- **Dane sprzedawcy uzupełniłem w trakcie przejścia** (`Leggera Labs Patryk
  Piecyk`, NIP i konto z palca), żeby zobaczyć, jak wyglądają wydruki
  z kompletem danych. Firma nie jest zarejestrowana — te wartości są
  prowizoryczne i siedzą wyłącznie w dev-bazie PGlite.
- **Odróżniałem błędy panelu od artefaktów narzędzia.** Kliknięcia po
  współrzędnych i wpisywanie z klawiatury w tym podglądzie regularnie nie
  trafiały; to nie jest wina panelu. Wszystko, co wyżej opisane jako
  „potwierdzone", jest sprawdzone drugim kanałem — `curl` po API, odczyt
  bazy albo `getComputedStyle` — a nie samym zrzutem ekranu.
- **Trzy rzeczy, które podejrzewałem, a które okazały się nieprawdą**
  i dlatego ich tu nie ma: blok ROI rzekomo nieobecny na wydruku (był, tylko
  stawka nie zdążyła się zapisać), „modal zamyka się przy wyborze źródła"
  (to było moje chybione kliknięcie w tło), oraz blokada edycji wystawionej
  faktury jako „tylko CSS" (serwer odrzuca `PATCH` przez 409).
- Powtarzający się w logu dev błąd
  `TypeError: Cannot read properties of null (reading 'removeChild')`
  (426 wystąpień, mniej więcej co 30 s) **nie pochodzi z bieżącej karty**
  panelu — konsola tej karty jest czysta. Nie umiem go przypisać, więc go nie
  liczę do znalezisk; zostawiam jako sygnał do sprawdzenia.
