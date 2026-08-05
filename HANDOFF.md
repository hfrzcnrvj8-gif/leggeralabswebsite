# Handoff — stan na 2026-08-05, po obu audytach apki (odczyt i zapis)

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- **Panel:** na wierzchu **wyniku audytu „apka wysyła, trasa nie czyta"**
  (poprzednio `d2655b0`). Repozytorium czyste i wypchnięte, `tsc` czysto,
  `npm test` **340/340**. Ostatnia sesja **nie zmieniła ani jednego pliku
  kodu** — sam dokument wyniku.
- **Apka** (`../leggera-hub-ios`, osobne repo i osobny `origin`): na wierzchu
  **`d5c40c6`** „Apka czyta to, co serwer oddaje: bramka wysyłki, wygasłe
  oferty, rodzina umowy, szukanie po treści". Buduje się, `swift test`
  w `LeggeraHubCore` daje **9/9**.
- `npm run przejscie`: **101 działa · 0 znanych luk · 0 regresji · 0 obejść ·
  0 pominiętych**. Od kroku 5 wynik jest **powtarzalny** — dwa i trzy biegi pod
  rząd dają to samo (wcześniej drugi bieg tracił drogę klienta na godzinę, bo
  udane żądania też zjadały hamulec). Sufit: łączny limit hamulca (60/60 min)
  ogranicza to do ~5 przebiegów na godzinę; po `npm run dev` od nowa wraca
  komplet.

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

**Pułapka środowiska złapana przy okazji:** wszystkie `/api/*` potrafią zacząć
oddawać **404** po restarcie `next dev` — także trasy nietykane, przy czystym
`tsc` i działającej stronie głównej. To uszkodzony cache Turbopacka;
`rm -rf .next` i start od nowa. Nie szukaj wtedy usterki w swoim kodzie.

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
- **Osierocony katalog `.claude/worktrees/fervent-ishizaka-7aec37/`** po
  porzuconej sesji — ma starą kopię `lib/offers.ts` i myli `grep`. Git go
  ignoruje. Do skasowania przy okazji.

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
narzędzia, które sprawdzają DANE, a nie kod — przejście „na sucho" (101 zdań,
obie drogi), kontrola spójności na ekranie *Zdrowie* i `error_log` — pokazują
zero. Zaplecze domknięte na obu drogach, wygląd zrobiony na desktopie.

Czego dalej nie ma: ani jednego prawdziwego klienta, ani jednej faktury
wystawionej naprawdę, ani jednego sprawdzenia wyglądu w prawdziwej przeglądarce.
Następny krok, który zmienia stan projektu, jest nietechniczny: rejestracja
działalności.
