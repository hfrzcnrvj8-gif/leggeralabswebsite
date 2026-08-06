# Etap 3 — sytuacje krytyczne, których jeszcze nie przechodziliśmy

**Wykonany:** 2026-08-06. **Brief:** `docs/ETAP-3-BRZEGI-BRIEF.md`.
**Punkt startu:** panel `6e1163a`, apka `255dc84` (nietknięta).

**Wynik w jednym zdaniu:** cztery scenariusze — **trzy przebiegnięte, jeden
niewykonalny i wiadomo dlaczego**; znaleziono **dwie rzeczy, które kłamały**,
obie naprawione — a decyzja właściciela „wykryj i powiedz, nie blokuj" została
**zbudowana tego samego dnia**, nie odłożona.

| # | scenariusz | stan | co wyszło |
|---|---|---|---|
| 1 | dwie karty na tym samym rekordzie | ✅ przebiegnięty | granularność PATCH-a ratuje różne pola; **9 z 16 rodzajów rekordów odpowiadało „zapisano" na zapis, który nic nie zapisał** |
| 2 | wygaśnięcie sesji w połowie pracy | ✅ przebiegnięty na żywym edytorze | **treść oferty ginęła w kompletnej ciszy**; 243 miejsca zapisu, ani jedno nie rozpoznawało 401 |
| 3 | zerwane żądanie w połowie wysyłki maila | ✅ przebiegnięty na atrapie SMTP | bezpiecznik odcisku **działa** — pierwszy raz uruchomiony, nie tylko przeczytany |
| 4 | odtworzenie bazy z kopii | ⊘ niewykonalny stąd | nie ma czego odtwarzać (kopie nie są uruchomione) i nie ma czym (brak `psql`/`pg_dump`, Docker nie działa) — sprawdzono za to **czujkę**, która ma o tym krzyczeć |

`tsc` czysto · `npm test` **365/365** (było 352) · `npm run przejscie`
**123 działa · 0 regresji** (było 116). Nowe zdania sprawdzone kontrolnie przez
tymczasowe cofnięcie poprawki — w obie strony: że wykrywanie łapie rozjazd
i że nie krzyczy bez powodu.

---

## Metodologia: rekonesans znów pomylił się w obie strony

Brief ostrzegał, że jego własny rekonesans jest **czytany z kodu, nie
zmierzony**. Słusznie:

| co pisał rekonesans | co pokazał pomiar |
|---|---|
| „190 wywołań `POST`/`PATCH` w UI panelu" | **243** (a po dołożeniu paska — 244) |
| „401 w trakcie pracy PRZEŁADOWUJE stronę" | **nie przeładowuje** — to gardło ODCZYTU, a zapisy nie idą przez nie; przeładowania nie było ani razu |
| „hipoteza (b): przeładowanie i utrata treści" | rzeczywistość: **cisza i ekran, który dalej pokazuje niezapisany tekst** |
| „pozycje faktury/oferty — zapis bywa »skasuj i wstaw od nowa«" | **nie jest** — każda pozycja to osobny `INSERT`/`UPDATE`; dublowania nie ma |
| „nie wiadomo, czy wszystkie edytory są granularne" | **wszystkie sprawdzone są** (oferta, umowa, faktura, klient, projekt, notatka, koszt) |

To już **trzeci raz z rzędu**, gdy liczba wzięta z greta okazuje się nieprawdą
(Audyt 1: pliki kontra trasy; etap 2: pliki kontra uchwyty; teraz: 190 kontra
243). Wniosek na przyszłość jest ten sam i chyba już ostateczny: **liczba
z greta jest hipotezą, nie wynikiem.**

Za to jedno ustalenie rekonesansu potwierdziło się co do joty: **kontroli
współbieżności nie ma żadnej.** Zero `If-Match`, zero `ETag`, zero
`UPDATE … AND updated_at = …`. Sprawdzone też po stronie odpowiedzi: trasa
`GET /api/offers/:id` nie oddaje ani `ETag`, ani `Last-Modified`.

---

## Scenariusz 1 — dwie karty na tym samym rekordzie

### Co zmierzono

Świeża oferta, trzy pozycje, żądania puszczane równolegle przez `Promise.all`.

| próba | wynik |
|---|---|
| karta A: tytuł, karta B: uwagi (równocześnie) | **oba przeżyły** — trasa dotyka wyłącznie pól, które przyszły |
| obie karty: ten sam tytuł | wygrał ostatni; **obie dostały `200 {"ok":true}`** — przegrany nie wie, że przegrał |
| karta B zapisuje pole ze STAREGO ekranu | zapisuje tylko swoje pole; praca karty A zostaje |
| dwie karty dodają pozycję równocześnie | pozycje unikalne, bez dubla |
| dwie karty zmieniają kolejność równocześnie | pozycje unikalne, ale kolejność wychodzi **mieszana** — nie taka, jakiej chciała którakolwiek |
| druga karta po zmianie w pierwszej | pokazuje nieaktualny ekran **bez końca** — nic go nie odświeża, żadnego ostrzeżenia |

**Zastrzeżenie do dwóch prób równoległych.** Dev-baza to PGlite w jednym
procesie, więc żądania szeregują się same. Na produkcji (Neon, `neon()` =
osobne połączenie HTTP na zapytanie) wyścig o `MAX(position) + 1` jest
teoretycznie możliwy. Skutek byłby kosmetyczny (dwie pozycje na tym samym
miejscu w kolejności), więc **świadomie nie naprawiane** — ale zapisane tutaj,
żeby nie musieć tego drugi raz odkrywać.

### Znalezisko 1 — „zapisano" bez zapisu (naprawione)

Najpoważniejsza rzecz z całego etapu, i to nie z powodu wyścigu, tylko
**usunięcia**. Karta A kasuje rekord, karta B dalej go edytuje:

`UPDATE … WHERE id = …` na nieistniejący wiersz to w SQL-u poprawne zapytanie —
zmienia zero wierszy i nie zgłasza błędu. Trasa odpowiadała `{"ok":true}`,
panel pisał „Zapisano".

Sonda przeszła **16 rodzajów rekordów**. Kłamało **9**:

| kłamało (naprawione) | mówiło prawdę od początku |
|---|---|
| klient, projekt, lead | oferta, umowa, faktura, notatka, koszt, przypomnienie |
| pozycja oferty, **blok treści oferty** | pozycja faktury |
| zadanie, kamień milowy, punkt startowy projektu | |
| osoba kontaktowa klienta | |

Dwie rzeczy warte zapamiętania:

- **Bliźniaki się rozjechały.** Pozycja FAKTURY sprawdzała istnienie od
  początku, pozycja OFERTY nie — ten sam kształt kodu, dwa różne zachowania.
  To ta sama rodzina co „`LeadDetailPanel` jest bliźniakiem
  `ClientDetailPanel`" z `CLAUDE.md`.
- **Kod o tym wiedział i wzruszał ramionami.** W `api/clients/[id]/route.ts`
  stał komentarz: *„Brak wiersza = klient skasowany w międzyczasie; UPDATE-y
  niżej i tak nic nie trafią"*. Prawda — tylko że wniosek powinien brzmieć
  „więc powiedz o tym", a nie „więc nic nie rób".

**Naprawa:** `lib/brakRekordu.ts` — jedna funkcja, jedno zdanie po polsku
(„Nie zapisano — ten rekord (klient) już nie istnieje. Mógł zostać usunięty
w innym oknie panelu. Odśwież ekran."), kod **404**. Wpięta w dziewięć tras.
Świadomie **nie dotyczy `DELETE`** — usunięcie czegoś, czego nie ma, kończy się
dokładnie tym, o co prosił wołający.

Sonda po naprawie: **0 kłamiących z 16.**

Sama sonda **nie została w repo** — przechodziła 16 rodzajów rekordów, a do
przejścia weszły dwa reprezentatywne zdania (pozycja oferty i klient), bo one
pilnują REGUŁY, a nie listy. Regułę zapisano w `CLAUDE.md`, więc następna trasa
ma gdzie ją przeczytać. Gdyby kiedyś trzeba było przejść wszystkie szesnaście
od nowa: utwórz → usuń (z nagłówkiem `x-potwierdzenie`, jeśli trasa go żąda) →
`PATCH`; **usunięcie musi oddać 200, inaczej wynik `PATCH`-a nic nie znaczy** —
pierwsze podejście dało cztery fałszywe „❌", bo `DELETE` odbijał się o 428
i rekord wciąż żył.

### Znalezisko 2 — „wykryj i powiedz" (zbudowane tego samego dnia)

Na pytanie „co zrobić z ostatnim zapisem, który wygrywa po cichu" właściciel
wybrał **„wykryj i powiedz, nie blokuj"**. Blokada rekordu i pytanie
„nadpisać?" zostały odrzucone. **Zbudowane** — nie odłożone na etap 5.

**Jak to działa.** Karta przy odczycie rekordu zapamiętuje `updated_at`, przy
zapisie dokleja go w nagłówku `x-znany-stan`, a trasa porównuje. Gdy się różni:
**zapis i tak przechodzi**, a w odpowiedzi wraca jedno zdanie („Zapisano — ale
ten rekord (oferta) zmienił się w międzyczasie w innym oknie panelu. Odśwież
ekran, żeby zobaczyć całość."), które panel pokazuje w toaście.

Trzy decyzje, które są tu regułą:

- **Toast, nie pasek.** Rozjazd to ZDARZENIE (zapis się udał, nic nie
  przepadło), a wygasła sesja to STAN (dopóki się nie zalogujesz, każdy zapis
  idzie w próżnię). Dlatego jedno znika samo, a drugie nie.
- **Brak nagłówka = cisza.** Apka, skrypt i cron nie wysyłają znacznika, więc
  nie dostają ostrzeżeń. Brak wiedzy to nie jest powód do alarmu.
- **Zmiana pozycji rusza znacznik DOKUMENTU.** Bez tego mechanizm byłby ślepy
  na najczęstszy przypadek („zmieniasz cenę w jednym oknie i opis w drugim"),
  bo `offer_items` ma własne życie. Retencja ofert liczy od `updated_at` i to
  jest tu poprawne: dokument był ruszany, więc nie jest „bez ruchu".

**Zasięg:** oferta (nagłówek, pozycje, bloki treści), faktura (nagłówek,
pozycje), klient, projekt, lead, notatka, koszt. **Poza zasięgiem świadomie:
umowa i przypomnienie** — nie mają kolumny `updated_at`, a dorobienie jej
znaczyłoby dopisanie `updated_at = now()` do każdego `UPDATE` w tych trasach.
Znacznik, który rusza się tylko czasem, jest gorszy od jego braku: kłamałby
w obie strony.

### Błąd, który złapał dopiero przebieg — po raz DRUGI tego dnia

Pierwsza wersja dawała **fałszywy alarm**: trzy zapisy z rzędu w jednej karcie,
nikogo innego w pobliżu, a panel przy drugim krzyczał „ktoś zmienił to w innym
oknie". Powód: własny zapis rusza `updated_at`, a karta dalej trzymała znacznik
sprzed **własnej** poprzedniej zmiany.

Naprawa: trasa oddaje po zapisie nowy `updated_at`, a karta go przyjmuje.
**Fałszywy alarm jest gorszy niż brak mechanizmu** — ostrzeżenie, które pada
bez powodu, uczy je ignorować, więc kasuje mechanizm bez kasowania kodu.
Dlatego w przejściu stoją **trzy** zdania, nie jedno: wykrywa · nie krzyczy bez
powodu · milczy, gdy nie ma znacznika.

**Druga pułapka z tego samego przebiegu, warta zapamiętania:** strażnik
`window.fetch` zakładany w `useEffect` providera **spóźniał się**. Efekty
Reacta lecą od dzieci do rodzica, więc pierwszy odczyt edytora przechodził OBOK
strażnika i karta nigdy nie zapamiętywała znacznika — trasa odpowiadała
poprawnie na żądanie z nagłówkiem, tylko panel nagłówka nie wysyłał. Instalacja
przeniesiona na **import modułu**.

---

## Scenariusz 2 — wygaśnięcie sesji w połowie pracy

### Co zmierzono (na żywym edytorze, nie z kodu)

Panel otwarty w przeglądarce, `window.fetch` podmieniony tak, żeby każdy zapis
dostawał `401` — dokładnie takie, jakie oddaje `isAuthed()`. Potem zwykła
edycja: wpisz tekst, kliknij obok.

| edytowane pole | co zobaczył właściciel | co było w bazie |
|---|---|---|
| tytuł oferty | „Nie udało się zapisać." przez 3,4 s, potem nic | stara wartość |
| **treść oferty (blok „Zakres prac")** | **nic — ani jednego znaku** | stara wartość |

W obu przypadkach: **żadnego przeładowania** (hipoteza briefu była błędna)
i **ekran dalej pokazywał wpisany tekst**. Czyli najgorszy z możliwych stanów:
panel wygląda, jakby wszystko było zapisane, a nie jest — i dowiadujesz się
o tym dopiero po odświeżeniu, kiedy praca już przepadła.

Liczby: **243 miejsca zapisu w UI panelu, w ŻADNYM nie pada 401.** Komunikat
(gdy w ogóle był) mówił „nie udało się" — czyli sugerował sieć i zachęcał do
klikania jeszcze raz, co nie mogło pomóc.

### Naprawa: straż sesji

Właściciel wybrał **jedno wspólne gardło dla wszystkich 243 zapisów**.
Zrobione tak: `app/[lang]/admin/strazSesji.ts` zakłada podgląd na
`window.fetch` **raz**, przy pierwszym renderze panelu, i zapala pasek przy
każdej odpowiedzi 401 na zapis do `/api`.

**Dlaczego opakowanie, a nie 243 poprawki.** Bo poprawka w 243 miejscach
byłaby skończona w 240 — a poprawka wzorca, która staje w połowie modułu, ma
w tym repo już własną lekcję (audyt Notatnika). Opakowanie daje jedną regułę,
która obejmuje też **miejsce zapisu, które powstanie jutro**. Jest wąskie:
niczego nie zmienia w przebiegu żądania, tylko podgląda kod odpowiedzi.
Wyjątki (`GET`, `/api/admin/*`, obce domeny) mają **własne testy** —
`test/strazSesji.test.ts`, 5 zdań — bo wyjątek bez testu to wyjątek, który
następna poprawka skasuje bez objawu (strażnik zacząłby krzyczeć „sesja
wygasła" przy **błędnym haśle** na ekranie logowania).

Pasek (`PasekSesji.tsx`) robi trzy rzeczy i każda jest decyzją:

1. **Nie znika sam.** Toast gaśnie po 3,4 s, a to jest STAN, nie zdarzenie:
   dopóki się nie zalogujesz, każdy kolejny zapis idzie w próżnię.
2. **Loguje na miejscu** (hasło + kod 2FA, gdy włączone), **bez przeładowania
   strony**. Ekran, na którym pasek się zapala, trzyma zwykle tekst, którego
   nie ma w bazie — wysłanie właściciela na stronę logowania znaczyłoby
   „zostaw tę pracę".
3. **Mówi wprost, co jest niezapisane** i żeby NIE odświeżać.

**Koniec z samoczynnym przeładowaniem przy 401.** `dane.ts` i siedem ekranów
robiło `window.location.reload()`, żeby pokazać formularz logowania. To kasuje
niezapisany formularz bez ostrzeżenia — i to dokładnie w chwili, w której jest
co kasować. Wszystkie osiem zamienione na zgłoszenie do straży.

### Błąd złapany PO napisaniu poprawki

Pierwsza wersja poprawki cofała optymistyczny podgląd (`load()`) przy KAŻDEJ
odmowie — w tym przy 401. Przebieg w przeglądarce pokazał absurd: pasek mówił
„to, co masz na ekranie, zostaje", a pole obok **już pokazywało starą treść
z bazy**. Poprawka zabierała dokładnie to, dla czego powstała.

Rozstrzygnięte w jednym miejscu (`odmowaZapisu()` w `dane.ts`): przy 401
**nie cofamy podglądu i nie pokazujemy toasta** (mówi o tym pasek, a dwa
komunikaty o tym samym uczą ignorować oba); przy każdej innej odmowie —
cofamy i pokazujemy powód z trasy.

Warto to zapamiętać jako regułę pracy: **poprawkę widoczną na ekranie trzeba
obejrzeć na ekranie.** `tsc` przechodził, testy przechodziły, a poprawka robiła
coś przeciwnego do zamiaru.

### Miejsca, które milczały — dopisane

Przy okazji 14 zapisów przestało milczeć przy odmowie: treść i kolejność bloków
oferty, pozycje oferty i faktury, wpłata, kolejność kamieni i zadań, dwa
przeciągnięcia na osi czasu, usunięcie przypomnienia, nazwa i kolor listy,
usunięcie rysunku z notatki, przełącznik polowania. Plus trzy pętle, które
kończyły się optymistycznym podsumowaniem niezależnie od wyniku („Dodano
N firm", „propozycje wróciły na listę", „zaktualizowano N wiadomości") —
dziś liczą odmowy i mówią prawdę.

---

## Scenariusz 3 — zerwane żądanie w połowie wysyłki maila

**Pierwszy raz uruchomiony.** Bezpiecznik z `lib/mailGuard.ts` był dotąd tylko
przeczytany, bo dev nie ma skrzynki. Postawiona **atrapa serwera SMTP**
(~80 linii na `node:net`, tyle dialektu, ile mówi nodemailer) plus `MAIL_*`
w `.env.local` wskazujące na `127.0.0.1`. Kopia do folderu „Wysłane" (IMAP)
padała — i dobrze, bo trasa traktuje to jako **ostrzeżenie, nie błąd**, więc
przy okazji sprawdziła się i ta gałąź.

| próba | odpowiedź | ile maili doszło |
|---|---|---|
| zwykła wysyłka | `200` | 1 |
| ta sama treść drugi raz | `409` „została już wysłana — sprawdź folder Wysłane" + `id` tamtej wiadomości | 0 |
| **żądanie zerwane po 2,5 s** (atrapa zwleka 8 s) | klient dostaje `AbortError`; serwer kończy wysyłkę | 1 |
| ponowienie **w trakcie** lotu pierwszej | `409` „poprzednia próba jeszcze trwa" | 0 |
| ponowienie **po** zakończeniu | `409` „została już wysłana" + `id` | 0 |
| **SMTP leży** | `502` z powodem (`ECONNREFUSED`) | 0 |
| ponowienie po powrocie SMTP | `200` | 1 |

**Razem w scenariuszu zerwania: 1 mail u klienta.** Dokładnie tyle, ile
powinno. I druga połowa dowodu, równie ważna: **nieudana wysyłka NIE blokuje
ponowienia** — bramka zwalnia się po błędzie, więc awaria dostawcy nie zamyka
drogi na dziesięć minut.

Atrapa **nie zostaje w repo** (żyła jedną sesję, wymaga podmiany `.env.local`
i restartu). W przejściu zostało zdanie, które da się sprawdzić zawsze: że
wysyłka bez skonfigurowanej skrzynki **odmawia zamiast udawać sukces**.

---

## Scenariusz 4 — odtworzenie bazy z kopii

**Nie da się tu sprawdzić.** Trzy niezależne powody, każdy wystarczający:

1. **Nie ma czego odtwarzać.** Kopie na NAS nie są uruchomione — Pulpit mówi
   to wprost („Kopie zapasowe bazy nie są jeszcze uruchomione"), a przeprowadzka
   na NAS czeka na rejestrację firmy (`docs/`, `PO_REJESTRACJI.md`).
2. **Nie ma czym.** Ten Mac nie ma `psql` ani `pg_dump`, a demon Dockera nie
   działa; `odtworz.sh` wymaga obu.
3. **Nie ma z czego.** Do produkcyjnej bazy (Neon) nie ma stąd dostępu — to
   stała pułapka tego środowiska, zapisana w `CLAUDE.md`.

Same skrypty **były** sprawdzone w Audycie 3 (2026-07-23) — tam wyszedł
i został naprawiony błąd, przez który `odtworz.sh` przy złym haśle wypisywał
„Gotowe" i kod 0, nie odtworzywszy ani jednej tabeli.

**Co dało się sprawdzić i zostało sprawdzone: czujka.** Bo skoro nie umiemy
dziś odtworzyć kopii, to jedyne, co nas chroni, to pewność, że panel
KRZYKNIE, gdy kopie przestaną się robić. Przebieg przez `POST /api/backup/ping`:

| stan | co pokazuje Pulpit |
|---|---|
| przed jakimkolwiek meldunkiem | `brak` — „Kopie zapasowe bazy nie są jeszcze uruchomione." |
| meldunek udany | `ok` — „Ostatnia kopia: przed chwilą (nas-atrapa)." |
| meldunek nieudany | `blad` — „Ostatnia kopia się nie udała" **+ cytat powodu** |

Trzeciego stanu (`przestarzale`, po 36 godzinach ciszy) nie da się wywołać bez
dostępu do bazy — liczy go czysta funkcja `ocenKopie`, pokryta testami
(`test/kopie.test.ts`).

**Do zrobienia po rejestracji, nie wcześniej:** uruchomić kopie i **odtworzyć
jedną z nich do pustej bazy testowej**. Dopóki tego nie było, zdanie „mamy
kopie zapasowe" jest nadzieją, nie faktem — i tak trzeba je czytać.

---

## Co zostało otwarte

1. **Umowa i przypomnienie poza wykrywaniem rozjazdu** — brak kolumny
   `updated_at`, patrz wyżej. Do rozważenia, gdyby okazało się potrzebne.
2. **Wyścig o `MAX(position) + 1`** przy dwóch kartach dodających pozycję —
   niewidoczny w dev (PGlite szereguje), teoretycznie możliwy na Neonie, skutek
   kosmetyczny. Świadomie nie ruszane.
3. **Odtworzenie kopii** — patrz wyżej, po rejestracji.
4. **Apka nie zna paska sesji.** Ma własną drogę (`APIClient.swift`, ustalenie
   A1) i własne komunikaty. Etap 3 apki nie dotykał.
