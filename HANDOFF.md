# Handoff — stan na 2026-08-06, po etapie 2 (audyt 1B)

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- **Panel:** na wierzchu **etapu 2 planu domknięcia (Audyt 1B — przyrost
  tras)**; pod spodem przegląd szwów i etap 1. `tsc` czysto, `npm test`
  **352/352**, `npm run przejscie` **116 działa · 0 regresji**. Etap 2 **nie
  zmienił zachowania panelu ani w jednym miejscu** — dołożył wyłącznie
  narzędzie pomiarowe `scripts/sonda-401.ts` i dokument wyniku. Przegląd szwów
  (pod spodem) ZMIENIŁ zachowanie w pięciu miejscach, patrz niżej.
- **Apka** (`../leggera-hub-ios`, osobne repo i osobny `origin`): na wierzchu
  **`255dc84`**. Buduje się, `swift test` w `LeggeraHubCore` daje **9/9**.
  Ani etap 1, ani przegląd szwów apki nie dotykały.
- `npm run przejscie`: **116 działa · 0 znanych luk · 0 regresji · 0 obejść ·
  0 pominiętych**, powtarzalne (trzy biegi pod rząd dają to samo). Sufit:
  łączny limit hamulca (60/60 min) ogranicza to do ~5 przebiegów na godzinę;
  po `npm run dev` od nowa wraca komplet.

Jeśli `git log` pokazuje co innego — ktoś pracował po drodze, sprawdź co
(`git log` PRZED `git add`; równoległa sesja już raz wchłonęła cudze zmiany).

**Obie listy znanych luk są puste** (pierwsze i drugie przejście). Każde nowe
`⚠ ZNANA LUKA` w przejściu jest czymś, co dopiero co dołożyliśmy — a każda
`✗ REGRESJA` psuje build.

## Oba plany są ZAMKNIĘTE

| plan | powstał po | fazy / kroki | stan |
|---|---|---|---|
| `docs/PLAN-ZAPLECZE.md` | pierwsze przejście „na sucho" (droga, która się UDAJE) | 0a–5 | ✅ 2026-08-02 |
| `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` | drugie przejście (droga, która się NIE udaje) | 1–5 | ✅ 2026-08-05 |

Każdy z nich ma na końcu pliku **podsumowanie całości** — lekcje, które przeżyją
plan, i pełną listę tego, czego świadomie nie zrobił. Drugi plan ma tam też
propozycję, czym powinno być **trzecie przejście**.

W skrócie: 22 znaleziska drugiego przejścia to były **cztery brakujące
mechanizmy** — publiczny dokument zna swój stan, szablon mówi tylko to, co
potwierdzają dane, „warunki obowiązujące" jako jedno miejsce, porażka jest
zdarzeniem jak każde inne. Plus sześć drobiazgów kroku 5, nowa powierzchnia dla
klienta (odrzucenie oferty ze swojej strony) i jedna zmiana w hamulcu.

## Co jest następnym krokiem

**PLAN DOMKNIĘCIA (`docs/PLAN-DOMKNIECIA.md`) — pięć etapów, idziemy po kolei.**
Etapy 1 i 2 ✅ zamknięte. **NASTĘPNY: etap 3 — sytuacje krytyczne, których
jeszcze nie przechodziliśmy. Brief gotowy, z rekonesansem:
`docs/ETAP-3-BRZEGI-BRIEF.md`.** Etap 4 (przegląd UI prawdziwymi oczami)
należy do właściciela i może iść równolegle — to jedyny etap, którego nie da
się zrobić z tego środowiska.

**Co dał rekonesans do etapu 3** (czytane z kodu, NIE zmierzone — brief etapu 2
nauczył, że rekonesans myli się w obie strony):

- **Kontroli współbieżności nie ma żadnej** — zero `If-Match`/`ETag`, zero
  `UPDATE … AND updated_at = …`. Ostatni zapis wygrywa po cichu.
- **Ratuje to granularność PATCH-a:** trasy piszą pole po polu
  (`if ("tytul" in body)`), a edytor oferty wysyła samą różnicę. Więc dwie
  karty w RÓŻNE pola prawdopodobnie się nie zadepczą — groźny jest ten sam
  kawałek treści, a najbardziej **pozycje faktury/oferty**. Nie wiadomo, czy
  wszystkie edytory są granularne.
- **401 w trakcie pracy przeładowuje stronę** (`dane.ts`), kasując
  niezapisany formularz bez ostrzeżenia. Ale to gardło ODCZYTU: w panelu jest
  **190 wywołań POST/PATCH i ANI JEDNO nie idzie przez `pobierzJSON`**. Co
  widzi właściciel, gdy sesja wygaśnie w połowie formularza — nie wiadomo.
  Sesję da się unieważnić bez czekania: zmiana `ADMIN_PASSWORD` w `.env.local`
  + restart (token to `sha256(hasło:sekret)`).

Scenariusz „dwie karty" wymaga **decyzji nietechnicznej właściciela**, zanim
cokolwiek naprawimy: blokada rekordu, ostrzeżenie „ktoś zmienił to
w międzyczasie", czy „ostatni wygrywa, ale powiedz o tym". Brief o tym mówi.

**0. Etap 2 planu domknięcia — AUDYT 1B (przyrost tras) — ZROBIONY 2026-08-06.**
Wynik: **`docs/AUDYT-1B-PRZYROST.md`**. Brief: `docs/ETAP-2-BEZPIECZENSTWO-BRIEF.md`.

**Zero dziur, zero zmian w zachowaniu panelu.** Wszystkie **266 uchwytów HTTP**
(188 plików) mają rozstrzygnięcie: **252 chronione** — sonda bez ciastka dostaje
401 — i **14 publicznych świadomie**, każdy z nazwanym mechanizmem zamiast
`isAuthed()` (token w linku, sekret crona, hamulec formularza). Wzorzec
`if (!(await isAuthed()))` utrzymał się przez **39 nowych plików tras**
i 83 zmienione. Trzy rzeczy poza listą tras też czysto: biała lista
`lib/publicFields.ts` wytrzymała 52 nowe kolumny, wszystkie 5 publicznych tras
zapisujących jest pod hamulcem (próg 5/60 min nietknięty), nowe trasy nie
logują danych osobowych.

**Trzecia metoda upadła — i to jest lekcja tego etapu.** Audyt 1 nauczył, że
grep po PLIKU kłamie; rekonesans, że grep po UCHWYCIE kłamie tak samo. Teraz
wyszło, że **ten sam błąd „plik ≠ uchwyt" popełnił brief ostrzegający przed
nim**: pisał „8 × `public/[token]`", a uchwytów jest **10**. Lista 21 uchwytów
z rekonesansu też była niepełna — brakowało crona `mail/outbox/run`.
**Rozstrzyga wyłącznie pomiar na żywej trasie.**

**Druga lekcja, warta więcej niż wynik:** przy trasach chronionych SEKRETEM
(`calendar/ics`, `backup/ping`, trzy crony) **401 z powodu źle zadanego pytania
jest nie do odróżnienia od 401 z powodu ochrony**. Pierwsze podejście strzelało
do `ics` parametrem `?secret=` zamiast `?token=` i do `backup/ping` sekretem
w ciele zamiast w nagłówku — obie oddały 401 i wyglądało to na poprawną
ochronę. **Trasa chroniona sekretem wymaga dowodu DWUSTRONNEGO:** że bez
sekretu odmawia i że z poprawnym wpuszcza. Wszystkie pięć sprawdzono tak.

**Narzędzie zostaje w repo: `scripts/sonda-401.ts`.** Zaczyna od
samosprawdzenia i **odmawia biegu przy włączonym `DEV_ADMIN_BYPASS`** (kod
wyjścia 2) — bez tego pokazałoby komplet zieleni i fałszywie uspokoiło.
Uruchamiając je: wyłącz bypass w `.env.local`, **zrestartuj `npm run dev`**,
a po skończeniu **przywróć `=1`** (wymaga go `npm run przejscie`).

**0a. Przegląd SZWÓW między modułami — ZROBIONY 2026-08-06.**
Wynik: **`docs/SZWY-MIEDZY-MODULAMI.md`**. Zlecony pytaniem właściciela („czy
to naprawdę jeden system?"), poza planem domknięcia.

**Inna rodzina pytań niż wszystkie audyty przed nim:** tamte patrzyły W GŁĄB
modułu, ten na STYKI. Kręgosłup (lead → oferta → umowa → projekt → faktura →
zapłata → opinia) okazał się spięty i przechodzi go harness. **Wszystkie pięć
dziur leżało po jednej stronie — przy PIENIĄDZACH WYCHODZĄCYCH**, i wszystkie
są naprawione:

1. **rentowność projektu liczyła koszty w obcej walucie po nominale** (1000 EUR
   wchodziło jako 1000 zł, zysk zawyżony o 3300) — BŁĄD, nie brak; ta sama
   rodzina co rabat z audytu Projektów;
2. **faktura od dostawcy po terminie nie odzywała się nigdzie** poza własnym
   modułem — dziś Pulpit („Do zapłaty po terminie"), licznik, poranny mail
   i Kalendarz;
3. **Statystyki nie znały kosztów** (`grep -c costs` = 0) — dziś koszty, zysk
   i dwa trendy;
4. **Kalkulator był wyspą** (`lib/dobor.ts` importował jeden plik — własny
   ekran) — dziś „Przenieś do oferty" zakłada szkic z rekomendacją jako blokiem
   treści; pozycji cennika świadomie NIE wstawia (widełki to nie jedna cena);
5. koniec okresu umowy nie stał w Kalendarzu — dziś stoi.

**Lekcja:** audyt modułu nie znajdzie dziury na szwie, bo każdy moduł z osobna
robił swoje poprawnie. Tanie sprawdzenie: weź pole, które jeden moduł zapisuje,
i policz `grep -rl`, ile plików je CZYTA. Jeden = wyspa. Ta komenda znalazła
trzy z pięciu dziur.

**Apki nie dotykano.** Nowe rodzaje wpisów w Kalendarzu (`cost`, `contract`)
apka pokaże neutralnie (`RodzajTerminu(rawValue:) ?? .nieznany`), a sekcji
kosztów na Pulpicie i kafli w Statystykach po prostu nie ma — do dołożenia,
gdy przyjdzie kolej na apkę.

**0. Etap 1 planu domknięcia — ZROBIONY 2026-08-05.**
Wynik: **`docs/ETAP-1-WYNIK.md`**, dokument dla właściciela:
**`docs/CO-MAM.md`**. Brief: `docs/ETAP-1-PRZEWODNIK-BRIEF.md`.

Etap NIE polegał na pisaniu przewodnika — przewodnik już istniał w panelu
(ekran *Instrukcje*, `lib/instrukcje.ts`, dziś 276 wpisów, 14 modułów). Polegał
na sprawdzeniu, czy **nadal mówi prawdę**. Nie mówił: **12 zdań nieprawdziwych
i 9 mechanizmów, o których nie wiedział.** Wszystko poprawione, zachowania
panelu nie ruszono.

**Przyczyna warta zapamiętania:** `lib/instrukcje.ts` nie był zmieniany od
`e441246` (2026-08-02), a weszło po nim **51 commitów** — pięć faz zaplecza
i dwa przejścia „na sucho". **Tanie sprawdzenie na przyszłość:**
`git log -1 -- lib/instrukcje.ts`, potem `git rev-list --count <ten>..HEAD`.
Kilkadziesiąt commitów = instrukcja już kłamie, pytanie tylko gdzie.

**Druga lekcja:** cały rozdział o Pulpicie był napisany z ekranu **apki**
(sekcja „Nadzór", przycisk „+", menu „…"), a czyta się go głównie w panelu —
i żadnej z tych trzech rzeczy w panelu nie ma. Rozdział pisany „z jednego
urządzenia" kłamie na drugim.

**TRZY RZECZY CZEKAJĄ NA DECYZJĘ WŁAŚCICIELA** (`ETAP-1-WYNIK.md`, sekcja C):

1. **Windykacja wysyła maile do klienta BEZ kliknięcia** — +3 dni uprzejmie,
   +10 stanowczo, **+21 formalne wezwanie do zapłaty z odsetkami**. To jedyne
   takie miejsce w panelu i stoi w sprzeczności z obietnicą „nic nie wychodzi
   bez Twojego kliknięcia". Trzy warianty do wyboru w wyniku; poprawka (jeśli
   będzie) idzie etapem 5. **Nie zmieniaj tego sam.**
2. **Godziny automatów mogą być w UTC** — Vercel odpala crony w UTC, więc
   `0 6 * * *` to 7:00 zimą / 8:00 latem w Polsce. Nie da się tego sprawdzić
   z tego środowiska; właściciel ma potwierdzić obserwacją.
3. **„14 reguł kontroli spójności" to nieprawda — jest 13.** Poprawione
   w dokumentach (ten plik i `CO-MAM.md`); `lib/spojnosc.ts` nietknięty,
   reguły nie brakuje.

**1. Trzecie przejście: DRUGI ROK OBROTOWY — ZROBIONE 2026-08-05.**
Wynik: **`docs/TRZECIE-PRZEJSCIE-DRUGI-ROK.md`**. Brief:
`docs/TRZECIE-PRZEJSCIE-DRUGI-ROK-PLAN.md`.

Z czterech podejrzeń briefu: **dwa potwierdzone i naprawione** (faktura
cykliczna „co miesiąc 31." uciekała na 3. dzień miesiąca, a każde spóźnienie
crona przesuwało serię na stałe), **jedno sprawdzone i czyste** (retencja —
po raz pierwszy przeszła przez rzeczywisty upływ okna), **jedno odłożone**
(numeracja faktur, patrz niżej). Obie tabele cykliczne mają teraz `kotwica`,
a arytmetyka jest bliźniakiem tej z Kalendarza. `npm test` **349/349**,
`npm run przejscie` **109 działa · 0 regresji** — nowe zdania sprawdzone
kontrolnie przez tymczasowe cofnięcie poprawki.

**OTWARTE — wymaga decyzji księgowej, nie kodu:** rok w numerze faktury bierze
się z zegara serwera, nie z `data_wystawienia`, więc szkic z datą 31.12
wystawiony 2 stycznia dostaje numer z nowego roku. Świadomie nietknięte
(sprawy księgowe idą na sam koniec, po rejestracji).

**Pułapka środowiska złapana przy okazji:** trasy `/api/*` potrafią zacząć
oddawać **404** po restarcie `next dev` — także nietykane, przy czystym `tsc`,
działającej stronie głównej i pliku obecnym w gicie (raz wszystkie naraz, raz
pojedyncza trasa `…/issue` przy działającym rodzeństwie). To uszkodzony cache
Turbopacka; `rm -rf .next` i start od nowa. **Zdarzyło się dwa razy jednego
dnia** — nie szukaj wtedy usterki w swoim kodzie.

**1b. Trzecie przejście: AWARIE I BRZEGI — ZROBIONE 2026-08-05.**
Wynik: **`docs/TRZECIE-PRZEJSCIE-AWARIE-I-BRZEGI.md`**.

Jedno znalezisko: **dwa kliknięcia „Zarejestruj wpłatę" dawały dwie wpłaty**
(zmierzone: 2460 zł na fakturze wartej 1230 zł) i **nic tego nie zgłaszało** —
faktura pokazuje „Opłacona", co jest prawdą, więc nikt do niej nie wraca,
a nadpłata zawyża przychód w Statystykach. Naprawa **nie jest barierą przy
zapisie** (wpłata jest odwracalna, a reguła Fazy 4 mówi „co odwracalne, nie
pyta"), tylko **kolejną regułą kontroli spójności** — zapis zostaje wolny,
skutek przestaje być niewidoczny. (Reguł jest po niej **13**, nie 14 — ten
plik pisał wcześniej „czternastą"; policzone w kodzie w etapie 1.)

Czyste: akceptacja oferty, oba podpisy umowy, wystawienie faktury (wyścig nie
dał dziury w numeracji), brak `RESEND_API_KEY` (rzuca, nie udaje sukcesu).
**Niesprawdzone:** zerwane żądanie w połowie wysyłki maila — dev nie ma
skrzynki, więc bezpiecznik odcisku jest przeczytany, ale nie przebiegnięty.

`npm run przejscie` **111 działa · 0 regresji**, trzy przebiegi pod rząd.

Panel powstał w lipcu 2026 i **nigdy nie przeżył 31 grudnia**. Przez tę datę
przechodzą: numeracja faktur (reset z rokiem), retencja (24 mies. / 6 lat),
faktury i koszty cykliczne. Oba przejścia „na sucho" trwały po dziesięć minut
zegarowych, więc żadne nie mogło tego zobaczyć. Punkt (b) z końca
`docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`; punkty (a) i (c) wymagają prawdziwej
przeglądarki i tu ich nie zrobimy.

**Wykonalność sprawdzona przed napisaniem briefu:** w kodzie NIE MA
wstrzykiwania daty, zegara nie da się przesunąć — ale retencja liczy się
SQL-em (`now() - interval`), a cykliczne wyzwala `next_run <= today`, więc
**postarzenie DANYCH** działa tak samo jak upływ czasu. To jest metoda tej roboty.

Cztery podejrzenia z dowodem w kodzie (żadne nie potwierdzone przebiegiem):
rok numeru z zegara zamiast z daty wystawienia (**A1 — wymaga Twojej decyzji,
numer faktury to dokument fiskalny**), `nextRunAfter` przelewa 31. dzień
miesiąca na następny (ta sama rodzina, którą Kalendarz już raz naprawiał),
`next_run` liczony od dnia nadrobienia crona zamiast od kotwicy, retencja nigdy
nieprzeszła przez rzeczywisty upływ okna.

**2. Audyt „apka wysyła, trasa nie czyta" — ZROBIONY 2026-08-05. PUSTO.**
Wynik: **`docs/natywna-aplikacja/42-wynik-audyt-co-apka-wysyla.md`**.
Brief: `41-brief-audyt-co-apka-wysyla.md`.

Przejrzane **wszystkie 75 wywołań `POST`/`PATCH`** apki (16 ładunków
słownikowych, 43 `struct Body`, 6 multipart) przeciwko 63 trasom panelu.
**Zero pól wysyłanych, a nieczytanych. Zero zmian w kodzie — w obu repo.**

Sprawdzone nie tylko lekturą: sondy różnicowe `PATCH`-em z ciałem skopiowanym
z apki (przypomnienie — komplet 16 pól, katalog — 11 pól) zmieniły w bazie
**wyłącznie to, co miały**, plus jeden przebieg przez apkę na symulatorze
(„+tydzień" na leadzie → `next_followup` w bazie).

Trzy fałszywe alarmy po drodze (pole czytane pętlą, pole zagnieżdżone w warunku
innego pola, trasa parametryczna `[kind]`) są opisane w wyniku — powtórzą się.

**Dlaczego pusto, skoro odczyt miał sześć luk:** brak skutku przy ZAPISIE boli
od razu (właściciel widzi po odświeżeniu, że nie weszło), brak informacji przy
ODCZYCIE nie boli nigdy. Plus zapis ma jedno gardło (`APIClient.swift`), a
odczyt rozłazi się po dwudziestu ekranach. **Następnym razem szukaj tam, gdzie
brak skutku jest niewidoczny.**

Jedna obserwacja poboczna do zapamiętania: `reminders.lokalizacja_promien` to
**kolumna bez pisarza** — nikt jej nie ustawia, a edycja przypomnienia z apki
nadpisuje ją `NULL`-em. Dziś bez skutku (zawsze jest `NULL`); gdyby powstała
kontrolka promienia, zaczęłaby ją kasować w ciszy.

**Apka jest domknięta wobec panelu.** Obie strony monety sprawdzone (punkty 2
i 3), a **paczka brakujących ekranów z drugiego przejścia jest ZROBIONA** —
wszystkie siedem pozycji (poziom windykacji, „WYNIKA Z" z aneksem, `akcjaAlt`,
dwie sekcje Pulpitu, odrzucenie oferty przez klienta, „Odpowiedź na wersję N",
propozycja o rozjeździe). Lista w `PLAN-PO-DRUGIM-PRZEJSCIU.md` mówiła co
innego do 2026-08-05 wieczorem, kiedy sprawdzono ją pozycja po pozycji
i skreślono. **Nie planuj tej paczki drugi raz.**

**3. Audyt „serwer oddaje, apka wyrzuca do kosza" — ZROBIONY 2026-08-05.**
Wynik i dowody: **`docs/natywna-aplikacja/40-wynik-audyt-co-apka-wyrzuca.md`**.
Brief, wg którego szedł: `39-brief-audyt-co-apka-wyrzuca.md`.

Przejrzane **wszystkie 48 wywołań `GET`** apki przeciwko temu, co naprawdę
zwracają ich trasy. **Sześć luk, wszystkie naprawione i sprawdzone na
symulatorze**; dziesięć pominięć ocenionych jako świadome i spisanych, żeby
następny audyt nie liczył ich drugi raz. Panelu nie ruszano.

| # | luka | co przez to nie działało |
|---|---|---|
| 1 | `expiredOffers` (`hub/today`) | oferty po terminie ważności — licznik je liczył, sekcji nie było |
| 2 | `bramka` (4 trasy `/send`) | **z telefonu nie dało się wysłać dokumentu z ostrzeżeniem** |
| 3 | `aneksy` / `matka` (`contracts/:id`) | z umowy nie było widać, że ma aneks; z aneksu — do której umowy |
| 4 | `sourceOffer` (`projects/:id`) | z czego powstał projekt |
| 5 | `offers`/`invoices`/`contracts`/`tresc` (`search`) | szukanie po dokumentach i **po treści rozmów/maili** |
| 6 | `offerLosses`, `hunter` (`stats`) | „na czym przegrywamy" i skuteczność sita Łowcy |

**Najpoważniejsza (#2) nie była brakującą sekcją, tylko brakującą DROGĄ DALEJ.**
Trasa odmawiała wysyłki dokumentu z samymi ostrzeżeniami kodem 409 i czekała na
powtórkę z `mimo_ostrzezen: true`; apka tego nie umiała, więc pokazywała powód
i kończyła. Ślepy zaułek, bez awarii i bez objawu. Sprawdzone w dzienniku:
`409 → 428 → 200` na jedno kliknięcie. Opis w README apki („Bramka wysyłki").

**Odnotowane, świadomie nie naprawione:** ostrzeżenie o sufitcie listy działa
w apce dla Klientów i Projektów, a `/api/contracts` i `/api/offers` też oddają
`total` — apka je ignoruje. Nie naprawione, bo nie da się tego dowieść: sufity
to 1000 i 500 rekordów, a dev-baza tyle nie zniesie. Trzy linijki na listę,
do zrobienia, gdy będzie czym pokazać.

**Naturalny następny krok:** druga strona tej samej monety — `POST`/`PATCH`,
w których apka wysyła pole, którego trasa nie czyta. Objaw identyczny (cisza),
skutek gorszy: zapis, który wygląda na udany i nic nie zmienia. Ten audyt tego
nie objął — czas poszedł na bramkę wysyłki, która okazała się większa, niż
brief zakładał.

**3. Apka — paczka ZROBIONA 2026-08-05** (kontekst, nie robota).
Wszystkie pięć pozycji z briefu
`37-brief-dogonic-panel.md` jest w apce i sprawdzone na symulatorze przeciwko
`npm run dev` + `npm run przejscie`. Wynik i dowody:
**`docs/natywna-aplikacja/38-wynik-apka-dogania-panel.md`**.

| # | co | stan |
|---|---|---|
| 1 | ekran „Propozycje" (6 reguł, jedna z `akcjaAlt`) | ✅ tylko Pulpit — decyzja właściciela; zero nowych żądań |
| 2 | dwie sekcje Pulpitu (`projektyZagrozone`, `zapomnianeSzkiceUmow`) | ✅ (szkice umów bez dowodu z danych — patrz niżej) |
| 3 | wybór poziomu windykacji | ✅ + pierwszy cel testowy w repo apki (9 testów) |
| 4 | karta „Odpowiedź na wersję N" na ofercie | ✅ |
| 5 | rubryka „Wynika z" na fakturze | ✅ z aneksem i kwotą obowiązującą |

Po drodze wyszły **trzy usterki, których brief nie znał**, wszystkie naprawione:
`?odrzucone=1` doklejone do ścieżki dawało 404 (martwy przycisk „przywróć");
poziom windykacji kłamał zaraz po wysyłce (nagłówek faktury się nie odświeżał);
**bloki treści oferty nie pokazywały się w apce NIGDY** — `pobierzOferte` nie
dekodowało `sections`, choć widok je rysował.

Jedyna rzecz z tej paczki **bez dowodu z danych**: sekcja „Zapomniane szkice
umów". Reguła panelu wymaga `created_at < dziś`, a dev-baza PGlite żyje
w pamięci procesu `next dev`, więc lokalnie nie da się takiego szkicu zrobić
(brief mylnie twierdził, że zostawia go `npm run przejscie`). Pierwszy dowód
przyjdzie z produkcji.

**Odłożone świadomie:** propozycje w listach modułów (dziś tylko Pulpit).
`SekcjaPropozycji` przyjmuje stan z zewnątrz, więc to dołożenie żądania
`?modul=`, a nie przebudowa.

**4. Trzecie przejście „na sucho"** — jeśli wolisz iść dalej sprawdzaniem niż
budowaniem. Propozycja zakresu stoi na końcu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`:
(a) oczami klienta w PRAWDZIWEJ przeglądarce, na telefonie i desktopie, po
polsku i po niemiecku; (b) drugi rok obrotowy (numeracja, retencja, faktury
cykliczne przez zmianę roku); (c) awarie i brzegi. **Czego robić NIE musi:
przechodzić ręcznie tego, co robi `npm run przejscie`.**

**5. Rejestracja firmy** — odłożona decyzją właściciela do odwołania. To jest
jedyny krok, który realnie zmienia stan projektu, i jest nietechniczny.

## Jak pracować w tym repo (skrót, reszta w CLAUDE.md)

- `npm run dev` w jednym oknie, `npm run przejscie` w drugim. Dev-baza to
  PGlite w pamięci procesu — **restart serwera = czysta baza** (i nowe id
  rekordów, więc stare linki przestają działać).
- `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
  `next build` failuje w sandboxie z EPERM). **`tsc` nie wie nic o więzach
  bazy** ani o SQL-u w szablonach.
- `npm test` — 340 testów nad czystymi funkcjami z `lib/`.
- **Każda nowa trasa w `app/api` jest domyślnie OTWARTA** —
  `if (!(await isAuthed()))` sprawdzaj per uchwyt HTTP, nie per plik.
- **Podgląd w środowisku Claude to karta ukryta 0×0**: `requestAnimationFrame`
  daje zero klatek, `read_page` zwraca pustą stronę, menu i modale mają
  `opacity: 0`, choć są otwarte i klikalne. Sprawdzaj przez `innerText` /
  `aria-*` / `getComputedStyle`, nie przez zrzut ekranu.
- Kończąc: `rm -f .git/index.lock && git add -A && git commit && git push`.

---

## Co jest otwarte (nie ruszać przy okazji)

- **Rejestracja firmy** — `PO_REJESTRACJI.md`, osiemnaście punktów. Blokuje KSeF
  test → produkcja, prawdziwe dane w nocie prawnej, plan Vercel Pro (Hobby
  zabrania użytku komercyjnego), przeprowadzkę na NAS. **To nie są braki do
  naprawienia przed rejestracją.**
- **Warstwa wizualna obu przejść** — żadne z nich jej nie sprawdzało, bo w tym
  środowisku pomiary byłyby zgadywaniem. Wymaga prawdziwej przeglądarki.
  Konkretnie zostały z tego trzy rzeczy z sekcji F pierwszego przejścia:
  (1) czy Escape przy otwartym kole daty zostawia profil otwarty; (2) czy menu
  „Wstaw z szablonu" naprawdę zostaje otwarte; (3) czy lista kanałów
  zasłaniająca checkbox faktycznie przeszkadza.
- **A5 z pierwszego przejścia** — „ZLECENIODAWCA / WYKONAWCA" w jednej rubryce
  na wydruku umowy, a role są dwie. Treść dokumentu prawnego, nie reguła
  wysyłki.
- **Kafel „Przychód (ten miesiąc)"** pokazuje brutto. Decyzja produktowa do
  rozstrzygnięcia, nie usterka.
- **Czy porzucenie świeżo zeskanowanego paragonu ma pytać** — `koszt-usun` jest
  na liście nieodwracalnych, więc „Anuluj" w skanerze prosi o potwierdzenie
  usunięcia szkicu. Trasa nie odróżnia szkicu sprzed minuty od kosztu sprzed
  miesiąca. Decyzja po stronie panelu, do rozstrzygnięcia.
- **Jeden przebieg kontrolny potwierdzeń na PRODUKCJI** (atrapa klienta →
  usunięcie tą samą drogą) — nie da się go wykonać stąd, bo apka w DEBUG celuje
  w produkcję, a wejście wymaga hasła wpisanego na urządzeniu. Ruch właściciela.
- **Moduł 54, ostatni krok** (pliki klienta na NAS) — czeka na Moduł 55, ten na
  rejestrację.
- **`CEIDG_TOKEN` w Vercelu** — bez niego Łowca leadów nie ma skąd brać
  kandydatów. Ruch właściciela.
- **Włączenie 2FA na produkcji** — silnik gotowy od Modułu 41. Drogi powrotu:
  papierowe kody zapasowe + ten sam sekret na drugim urządzeniu (NIE
  „wyłącznik w Vercelu").
- ~~Osierocony katalog `.claude/worktrees/fervent-ishizaka-7aec37/`~~ —
  **usunięty 2026-08-05** (`git worktree remove` + `prune`, 7,4 MB). Sprawdzone
  przed skasowaniem: drzewo czyste, a jego ostatni commit `ca48013` jest
  w historii `main`, więc nic nie zginęło. `git worktree list` pokazuje już
  tylko katalog główny.

## Czego NIE zaczynać bez wyraźnej prośby

- **Orchestrator propozycji AI** („Skrzynka propozycji AI") — odłożony na
  koniec. Propozycje z Fazy 3 to co innego: deterministyczne reguły, bez modelu.
- **Nowy punkt użycia lokalnego LLM** poza pięcioma zbudowanymi.
- **Zamiana istniejących automatów na propozycje** — granica jest ustalona
  i zapisana w `CLAUDE.md`.
- **Dokładanie potwierdzeń do działań odwracalnych** — reguła Fazy 4 działa
  w obie strony i jest zapisana w `CLAUDE.md`.
- **Rozpychanie `OFFER_STATUSES`** (np. o „Zastąpiona") — rozstrzygnięte
  2026-08-05 na „nie": fakt zastąpienia niesie `superseded_at`, a nowa wartość
  dotknęłaby mapy koloru, filtra, wagi w pipelinie i bliźniaczej mapy w apce.
- **Rozluźnianie hamulca publicznych dokumentów „bo przeszkadza w sondzie"** —
  próg 5/60 min jest decyzją z Audytu 1. Krok 5 zmienił WYŁĄCZNIE to, co się
  liczy (pomyłki zamiast wszystkiego) i że sukces zeruje licznik.
- **Zmiana sortowania list, żeby nowe rekordy szły na górę** — rozstrzygnięte
  w Fazie 5 na „nie" (przewijamy i podświetlamy).
- **Moduł 16 — wsparcie posprzedażowe.** Do pierwszego klienta.
- **Przeprowadzka na NAS** poza etapem 1.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Uczciwa etykieta stanu

**Kompletny funkcjonalnie, przeaudytowany, nieużywany produkcyjnie.** Trzy
narzędzia, które sprawdzają DANE, a nie kod — przejście „na sucho" (116 zdań,
obie drogi), kontrola spójności na ekranie *Zdrowie* (13 reguł) i `error_log` —
pokazują zero. Zaplecze domknięte na obu drogach, wygląd zrobiony na desktopie.
Wersja tego akapitu dla właściciela, po ludzku i z listą „czego te liczby NIE
obejmują": **`docs/CO-MAM.md`**.

Czego dalej nie ma: ani jednego prawdziwego klienta, ani jednej faktury
wystawionej naprawdę, ani jednego sprawdzenia wyglądu w prawdziwej przeglądarce.
Następny krok, który zmienia stan projektu, jest nietechniczny: rejestracja
działalności.
