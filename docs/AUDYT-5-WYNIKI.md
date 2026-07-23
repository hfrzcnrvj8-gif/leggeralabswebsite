# Audyt 5 — wydajność i koszty: wyniki (2026-07-23)

Szósty z siedmiu audytów końcowych (kolejność wg ryzyka: 4 → 1 → 3 → 2 → 6 →
**5** → 7). Zakres: `docs/AUDYTY-KONCOWE.md` → „Audyt 5", brief wykonawczy:
`docs/plany-modulow/45-audyt-5-wydajnosc.md`.
Poprzednie: `docs/AUDYT-4/1/3/2/6-WYNIKI.md`.

**Pytanie audytu, słowami właściciela:** „ile to kosztuje miesięcznie, zanim
przyjdzie pierwszy rachunek" i „czy coś zbliża się do limitu, zanim się o niego
uderzy".

Każde ustalenie techniczne jest poparte **uruchomieniem albo aktualną
dokumentacją dostawcy**, nigdy pamięcią modelu (ceny i limity się zmieniają — to
wprost reguła tego audytu). Liczby z paneli właściciela (rozmiar bazy, bieżące
zużycie) są poza zasięgiem Claude i oznaczone **⏳ do wykonania przez
właściciela**.

> **Najważniejszy wniosek z góry:** przy jednym użytkowniku i zerze klientów
> **nic nie jest ani wolne, ani drogie**, a **żaden z trzech „tropów" z briefu
> nie okazał się realnym problemem** — dwa były wręcz oparte na nieaktualnych
> limitach Vercela. Poprawnym wynikiem tego audytu jest **„nic nie optymalizuj,
> tylko wiedz, gdzie są progi i co wymusi Vercel Pro"** — dokładnie ten wariant,
> który brief dopuszczał jako prawidłowy. **Zero zmian w kodzie.**

---

## Ustalenia — kolejność wg ryzyka

### 1. Trop `maxDuration` 120/90 s na Hobby — NIEAKTUALNY, to nie jest problem ✅ ROZSTRZYGNIĘTE

**Brief podejrzewał najostrzej:** plan Hobby tnie funkcje do 60 s, więc
deklaracje `maxDuration = 120` (skan wizytówki, OCR) i `90` (sync IMAP) mogą być
po cichu nieegzekwowane, a funkcja przekraczać limit „bez objawu". **Sprawdzone
w aktualnej dokumentacji Vercela (obie strony `last_updated: 2026-07-01`) —
założenie jest nieaktualne o całą epokę.**

Z **fluid compute** (włączonym **domyślnie** dla nowych projektów) limity czasu
funkcji są dziś takie:

| Plan | Domyślny | Maksimum |
|---|---|---|
| **Hobby** | **300 s (5 min)** | **300 s (5 min)** |
| Pro / Enterprise | 300 s | 800 s (+ 1800 s w becie) |

Historyczny limit Hobby „10 s domyślnie / 60 s max" pochodzi sprzed fluid
compute. **Dziś Hobby daje 300 s.** Wobec tego wszystkie 15 deklaracji w kodzie
mieści się z ogromnym zapasem:

- `maxDuration = 120` — skan wizytówki, OCR paragonu → **w limicie** (120 < 300);
- `maxDuration = 90` — sync IMAP → **w limicie** (90 < 300);
- 11× `maxDuration = 60`, 1× `30` → **w limicie**.

Co więcej, **przekroczenie NIE jest ciche** — wbrew obawie briefu. Gdy funkcja
przekroczy swój `maxDuration`, Vercel zwraca **504 `FUNCTION_INVOCATION_TIMEOUT`**
(udokumentowane). Byłby to widoczny błąd (toast u właściciela + `error_log`
z Audytu 4), nie „przekroczenie bez objawu".

**Fluid compute POTWIERDZONE włączone (panel właściciela, 2026-07-23):** panel
Vercela pokazuje pozycje **„Fluid Active CPU"** i **„Fluid Provisioned Memory"** —
istnieją tylko przy włączonym fluid compute. **Limit 300 s jest więc realny, nie
domniemany.** Temat zamknięty.

**Realny czas tych tras i tak zależy od I/O, nie od CPU:** sync IMAP i pobieranie
załączników spędzają większość czasu **czekając na serwer az.pl**, a OCR/skan —
**czekając na lokalny model Ollama** na Macu właściciela. W modelu fluid compute
czas czekania na I/O **nie liczy się do płatnego „active CPU"** (patrz ust. 6) —
więc nawet 90-sekundowy sync jest tani.

### 2. Bramka migracji NIE odrosła — Pulpit 14 zapytań na ciepło, bramka ścina 242→2 ✅ SPRAWDZONE URUCHOMIENIEM

**Brief kazał sprawdzić, czy liczba zapytań na zimny start „nie odrosła"** po
bramce migracji z 2026-07-15 (powstała, bo panel robił 156 zapytań na zimny
start). **Zmierzone uruchomieniem** — instrumentacja na sterowniku PGlite
(monkeypatch `query`, łapie KAŻDE zapytanie: migracje, seed, dane), bramka
włączona przez `VERCEL_GIT_COMMIT_SHA` jak na produkcji:

| Scenariusz | Zapytań (Pulpit `/api/hub/today`) | Jak często |
|---|---|---|
| **Pierwsze żądanie po każdym wdrożeniu** | ~2 (bramka) + **242** (migracje) + 14 (dane) | **raz na deploy** |
| **Każdy kolejny zimny start funkcji** | 2 (bramka) + **14** (dane) = **~16** | na zimny start |
| **Instancja ciepła** (zwykły ruch) | **14** (dane) | większość żądań |

**Bramka działa dokładnie jak zaprojektowano.** Mechanika (odczytana w całości
w `lib/db.ts`): `appliedVersions` to **jeden cache'owany na proces** promise —
`loadAppliedVersions()` robi 2 zapytania (`CREATE TABLE IF NOT EXISTS
schema_state` + `SELECT`) i zapamiętuje wynik; każde `schemaUpToDate(name)` po
nim czeka na ten sam cache = **0 dodatkowych zapytań**. Gdy wersja się zgadza,
`create*Schema` wraca natychmiast, nie dotykając 242 migracji. Zmierzone:
powtórne `ensure*Schema` w tym samym procesie = **0 zapytań** (cache promisów).

**Pokrycie bramki jest kompletne — sprawdzone gretem strukturalnie:** wszystkie
**24 schematy** mają parę `schemaUpToDate("…")` na wejściu i
`markSchemaApplied("…")` na wyjściu (24 = 24). **Żaden schemat nie „prześlizgnął
się" bez bramki** — to była realna obawa (nowa `create*Schema` bez tych dwóch
linii cicho przywróciłaby 242 zapytania na każdy zimny start).

**Doprecyzowanie liczb z briefu (zmierzone, nie przepisane):**
- Pulpit: brief mówił „9 `ensure*Schema` + 13 zapytań" → realnie **9 ensure +
  14 zapytań danych** (dodatkowe to `automation_runs` z nadzoru automatów, Audyt
  4). Różnica o 1, bez znaczenia.
- Dzienny cron `/api/leads/notify`: brief „11 + 23" → zmierzone **26 zapytań
  danych** na ciepło. Urosło o 3 (retencja leadów z Audytu 2, umowy z Modułu
  31). **Chodzi raz na dobę** — 26 zapytań × 1/dobę = koszt znikomy.
- Lista Poczty `/api/mail`: **2 zapytania** danych na ciepło (lista + liczniki).
  W dev `runDueOutbox` nie pyta bazy (brak skrzynki); na produkcji dokłada ~1
  (sprawdzenie kolejki wysyłki) → ~3.

**Dodatkowa obserwacja o wydajności (odczytana z kodu, nie zmierzona czasowo):**
Pulpit odpala 12 z 14 zapytań przez **`Promise.all`** (równolegle), więc mimo że
`neon()` = 1 HTTP na zapytanie, czas ściany ≈ **jedna runda do bazy**, nie suma
14. To dobra decyzja architektoniczna, nie do ruszania. (Rzeczywistej latencji do
Neona z tej sesji nie zmierzę — to produkcja; przy tej samej strefie regionu jest
rzędu milisekund.)

### 3. „Limit 2 cronów wyczerpany" — nieaktualny; Hobby daje 100 cronów, ściana to CZĘSTOTLIWOŚĆ ⚠️ KOREKTA

Poprzednie audyty i pamięć (`vercel-plan-hobby`, Audyt 4 ust. 5,
`PO_REJESTRACJI.md` pkt 13) powtarzały: „Hobby daje **maksymalnie 2** zadania
cron, limit wyczerpany". **Aktualna dokumentacja Vercela (`last_updated:
2026-06-16`) mówi inaczej** — to ta sama lekcja co zawsze („weryfikuj
dokumentacją, nie pamięcią"):

| | Liczba cronów / projekt | Minimalny interwał | Precyzja |
|---|---|---|---|
| **Hobby** | **100** | **raz na dobę** | co godzina (±59 min) |
| Pro | 100 | co minutę | co minutę |

Czyli: **liczba cronów NIE jest ścianą** (projekt używa 2 ze 100 możliwych).
Ścianą jest **częstotliwość — Hobby pozwala każdemu cronowi chodzić najwyżej raz
na dobę**, a wyrażenie częstsze (`0 * * * *`) **failuje przy wdrożeniu**. To
właśnie ten limit — nie „brak slotu" — wymusił obejście „kolejkę wysyłki
odłożonej ruszamy przy wejściu w Pocztę" (`app/api/mail/outbox/run` + `runDueOutbox`
w `GET /api/mail`).

**Konsekwencja dla wcześniejszych ustaleń:**
- Audyt 4 nie dał nadzorowi własnego crona „bo 2/2" — w rzeczywistości **mógł
  dodać trzeci cron dobowy** (miejsca jest 98). To, czego naprawdę brakowało, to
  cron **częstszy niż dobowy** — i tego Hobby nie da niezależnie od liczby.
  Obejście (ping z NAS-a) było i tak słuszne z innego powodu (przeżywa śmierć
  crona), więc nic do zmiany.
- **Co realnie kupuje Pro:** cron **co minutę** zamiast raz na dobę. To
  odblokowałoby prawdziwą kolejkę wysyłki odłożonej (bez obejścia „przy wejściu
  w Pocztę"), częstszy sync poczty i osobny, częsty cron nadzoru.

**Nie zmieniam kodu ani `vercel.json`** — 2 crony dobowe działają, a obejście
kolejki jest świadome i dobre. To ustalenie porządkuje tylko fałszywy zapis „2/2
wyczerpane" w dokumentacji projektu (poprawione niżej).

### 4. Apka natywna NIE odpytuje w tle — koszt baterii/transferu skaluje się z użyciem ✅ SPRAWDZONE

**Brief:** zużycie baterii i transferu przy odpytywaniu (polling). **Sprawdzone
gretem w repo `leggera-hub-ios` (po użyciu, nie po nazwie):**

- **Brak `BGTaskScheduler` / `BGAppRefreshTask` / `BGProcessingTask`** — zero
  trafień. Apka **w ogóle nie budzi się w tle, żeby odpytać serwer.**
- **Brak cyklicznych timerów** (`Timer.scheduledTimer`, `repeats: true`,
  `Timer.publish`) — zero trafień. Nie ma pętli „odpytaj co N sekund".
- **Odświeżanie jest inicjowane WYŁĄCZNIE:**
  1. **przez użytkownika** — `.refreshable` (pull-to-refresh) na 16 ekranach;
  2. **przy starcie apki** — jeden `.task` woła `store.start()` → `odswiezPulpit()`
     (jeden zagregowany strzał do `/api/hub/today`);
  3. **przy powrocie na pierwszy plan** — `scenePhase == .active` **tylko podnosi
     flagi „nieaktualne"**, komentarz w kodzie wprost: *„Tanie: samo podniesienie
     flag, zero sieci tutaj"*; każdy ekran dociąga się leniwie dopiero przy
     `onAppear`. Jest nawet jawny dedup podwójnego pobrania przy zimnym starcie
     (`AppStore.swift`: „Bez tego `onAppear` i `.task` wysyłają DWA…").

**Werdykt:** to **najbardziej oszczędny możliwy wzorzec** — koszt baterii i
transferu jest **proporcjonalny do tego, jak często właściciel otwiera apkę i
pociąga listę**, a nie do zegara. Przy jednym użytkowniku to praktycznie zero
kosztu w tle. Nic do optymalizacji; gdyby cokolwiek, to raczej pochwała
projektu. (Transfer pojedynczego odświeżenia Pulpitu = jedna odpowiedź JSON
z `/api/hub/today`; agregat, nie N osobnych żądań.)

### 5. Rozmiar bazy wobec progów Neona ⏳ LICZBA OD WŁAŚCICIELA + oszacowanie

**Liczby poda właściciel z panelu Neon** (Claude nie ma dostępu do produkcyjnej
bazy). Progi **darmowego** planu Neon (aktualny cennik, sprawdzony 2026-07-23):

| Zasób (Free) | Limit | Co po przekroczeniu |
|---|---|---|
| **Storage** | **0,5 GB / projekt** | compute **zawiesza się** do następnego cyklu |
| **Compute** | **100 CU-godzin / projekt / mies.** | jw. |
| **Egress (transfer)** | **5 GB** | jw. |
| Projekty | 100 | — |

**Oszacowanie (nie pomiar produkcji):** Audyt 3 zmierzył syntetyczną bazę
projektu jako **~1 MB**, a realna baza z jednym użytkownikiem i zerem klientów
jest tego samego rzędu. To **~0,2 %** progu 0,5 GB storage — zapas ogromny.
Największym pojedynczym zbiorem będzie z czasem **poczta** (`mail_messages`
z pełną treścią, retencja 24 mies.) i **załączniki** — ale te trzymają w bazie
**tylko metadane** (bajty pobierane na żądanie z IMAP, decyzja kosztowa
właściciela, patrz pamięć `zalaczniki-na-zadanie-imap`), więc nie puchną.

**Realny znak zapytania to nie storage, lecz `compute` (CU-godziny).** `neon()`
w trybie HTTP budzi compute na czas zapytania; przy bezczynności compute
**autozawiesza się**. Przy jednym użytkowniku + 2 crony dobowe zużycie CU-godzin
powinno być daleko pod 100/mies., ale **to jedyna liczba warta zerknięcia w
panelu**, bo rośnie z ruchem, nie z rozmiarem danych.

**Odczyt paneli właściciela (2026-07-23) — wszystko głęboko w zielonym:**

- **Neon** — plan Free potwierdzony (0,5 GB storage, „scales to zero when
  inactive", autoscale do 2 CU, region AWS US East 2). Panel pokazywał
  inkluzje planu, nie procent zużycia storage — ale przy bazie ~1 MB to i tak
  nierelewantne.
- **Vercel (ostatnie 30 dni)** — najwyższe zużycie to **Fluid Active CPU
  31 min 24 s / 4 h = ~13 %**; reszta poniżej 6 %: Function Invocations 34K/1M,
  Edge Requests 56K/1M, Fast Data Transfer 1,08/100 GB, Fluid Provisioned Memory
  4,5/360 GB-h. **Fluid compute potwierdzone włączone** (patrz ust. 1).
- **Resend** — 7/3000 miesięcznie, 1/100 dziennie. Jedyna pozycja na limicie:
  **domeny 1/1** (Free daje jedną domenę nadawczą) — druga wymusiłaby Pro, mało
  prawdopodobne przy jednej firmie.

**Ważna uwaga właściciela:** to liczby z fazy **tworzenia i testów apki**, nie
realnego użytku — realny ruch będzie wyższy. Ale zapas jest tak duży (najwyższe
13 %), że nawet 6–8× wzrost mieści się w darmowych planach. Po przekroczeniu Free
pierwszy płatny plan Neona **Launch** jest **metered** (wg cennika ~$0,106/CU-h,
$0,35/GB-mies. storage) — przy tej skali rzędu **centów**. (Cennik Neona bywa
rewidowany — potwierdzić w panelu przy ewentualnym przejściu.)

### 6. Model kosztów funkcji Vercela — płatny jest „active CPU", nie czekanie ⚠️ DO WIEDZY

Istotne dla intuicji „czy długie funkcje są drogie". Na Pro Vercel liczy
**active CPU time** (milisekundy realnie liczącego procesora) + **provisioned
memory time**. **Czekanie na I/O — zapytanie do bazy, wywołanie modelu AI,
pobranie z IMAP — NIE liczy się do active CPU** (wprost w dokumentacji). Skutek:
najwolniejsze trasy projektu (sync IMAP 90 s, OCR 120 s) są wolne, bo **czekają**,
a nie liczą — więc w modelu Pro **tanie**. Na Hobby funkcje są **darmowe w
ramach limitów**. To domyka obawę „długie funkcje = drogo": nie w tym modelu.

---

## Rachunek całości — ile to kosztuje miesięcznie

Główny „ludzki" produkt audytu. Ceny **z aktualnych cenników (2026-07-23)**;
bieżące zużycie i decyzje — ⏳ właściciel.

| Usługa | Dziś | Po rejestracji firmy | Co wymusza koszt |
|---|---|---|---|
| **Vercel** | **0 zł** (Hobby) | **~20 USD/mies.** (Pro, 1 użytkownik) | **Użytek komercyjny** — Hobby jest „personal, non-commercial" (cennik wprost). Rejestracja firmy → Hobby nie do obrony. **To jest jedyny twardy wyzwalacz Pro**, nie cron ani czas funkcji. |
| **Neon (baza)** | **0 zł** (Free) | **0 zł**, dopóki < 0,5 GB / 100 CU-h / 5 GB egress | Przekroczenie progu Free (patrz ust. 5). Przy jednym kliencie długo nierealne. Launch = metered (centy). |
| **Resend (mail)** | **0 zł** (Free, zmierzone 7/3000 mies.) | **0 zł**, dopóki < 3 000 maili/mies. i < 100/dobę | Wolumen maili. Dziś: dzienny raport (1/dobę) + sporadyczne powiadomienia leadów. Pro (50 000/mies., $20) dopiero przy realnym wolumenie. **Uwaga:** domeny 1/1 na Free — druga domena nadawcza też wymusiłaby Pro. |
| **Apple Developer** | **0 zł** (darmowe konto) | **99 USD/rok** (~8 USD/mies.) — **potwierdzone** | Dystrybucja apki. Właściciel **założy konto przy rejestracji działalności** (decyzja 2026-07-23). Dziś apka podpisywana darmowym kontem, działa na jego telefonie. |
| **az.pl (poczta)** | już opłacana | bez zmian | Hosting skrzynki — istniejący koszt, poza tym audytem. |
| **Domeny** (`leggeralabs.pl` itd.) | już opłacane | bez zmian | Istniejący koszt, poza tym audytem. |
| **NAS Ugreen, Mac Studio (Ollama)** | sprzęt własny | 0 zł/mies. | Jednorazowy sprzęt właściciela, nie subskrypcja (Audyt 2/3). |

**Suma miesięczna — scenariusz „po rejestracji, przed pierwszym klientem":**
**~20 USD/mies. (Vercel Pro) + ~8 USD/mies. (Apple 99 USD/rok, potwierdzone) ≈
28 USD/mies.** Neon i Resend zostają na darmowych planach do czasu realnego
ruchu klientów. **Odczyty paneli 2026-07-23 potwierdziły: wszystkie darmowe
plany głęboko w zielonym** (najwyższe zużycie — Vercel Active CPU na 13 %) — i to
przy liczbach z fazy testów, więc zapas na realny ruch jest duży.

**Kiedy to zacznie rosnąć:** dopiero wolumen prawdziwych klientów (dużo maili →
Resend Pro $20; duża baza/ruch → Neon metered). Oba mają **wyraźny próg
darmowy**, a nie „licznik od pierwszego dnia" — więc pierwszy rachunek nie
zaskoczy. **Nie ma dziś żadnej pozycji, która cicho nabija koszt.**

---

## Sprawdzone i jest dobrze

To też jest wynik audytu.

- **Bramka migracji działa i jest kompletna** — 24/24 schematy bramkowane,
  zimny start ścięty z 242 do 2 zapytań schematu (zmierzone uruchomieniem).
- **Pulpit zrównolegla 12 zapytań przez `Promise.all`** — czas ściany ≈ jedna
  runda do bazy, nie suma. Dobra decyzja, nie ruszać.
- **`maxDuration` mieści się w limicie Hobby (300 s)** z ogromnym zapasem;
  przekroczenie i tak dałoby widoczny 504, nie ciche.
- **Apka nie ma żadnego pollingu w tle** — najbardziej oszczędny wzorzec baterii
  i transferu; koszt skaluje się z użyciem, nie z zegarem.
- **Model kosztów fluid compute nie karze czekania na I/O** — długie trasy
  (IMAP/OCR) są tanie, bo czekają, a nie liczą.
- **Każda usługa ma wyraźny próg darmowy**, nie licznik-od-zera — pierwszy
  rachunek nie zaskoczy.
- **Załączniki trzymane jako metadane, treść na żądanie z IMAP** — świadoma
  decyzja kosztowa, która trzyma rozmiar bazy w ryzach (pamięć
  `zalaczniki-na-zadanie-imap`).

---

## Jak to zweryfikowano (nie „skompilowało się")

`tsc` tu nic nie dowodzi — nie było zmian w kodzie. Dowód to **uruchomienie i
aktualna dokumentacja dostawców**:

1. **Liczba zapytań — instrumentacja sterownika PGlite.** Monkeypatch
   `PGlite.prototype.query` (obie kopie: ESM i CJS — dev-db dostaje build CJS
   przez `require`, co złapałem po pierwszym pomiarze pokazującym 0), bramka
   włączona `VERCEL_GIT_COMMIT_SHA`. Uruchomione realne uchwyty `GET`. Wynik:
   Pulpit 14 danych / 242 migracji (raz), Poczta 2, cron 26. Skrypt jednorazowy
   (scratchpad), usunięty po pomiarze; drzewo git czyste.
2. **Bramka ścina do 2** — powtórne `ensure*Schema` w tym samym procesie: **0
   zapytań** (cache promisów). Pokrycie 24/24 policzone gretem
   (`schemaUpToDate` = `markSchemaApplied` = 24).
3. **`maxDuration` na Hobby** — dwie strony dokumentacji Vercela
   (`/docs/functions/configuring-functions/duration` i `/docs/functions/limitations`,
   obie `last_updated: 2026-07-01`): **Hobby 300 s default i max** z fluid
   compute; przekroczenie → 504. Nie z pamięci modelu.
4. **Limity cronów** — `/docs/cron-jobs/usage-and-pricing` (`2026-06-16`):
   Hobby 100 cronów, **raz na dobę**, częstsze failują przy deployu.
5. **Ceny** — cenniki Vercel (Pro $20/user, Hobby „non-commercial"), Neon (Free
   0,5 GB / 100 CU-h / 5 GB), Resend (Free 3 000/mies., 100/dobę) — pobrane
   2026-07-23, nie z pamięci.
6. **Apka bez pollingu** — grep po użyciu w `leggera-hub-ios`: zero
   `BGTaskScheduler`/`Timer.scheduledTimer`/`repeats: true`; odświeżanie tylko
   `.refreshable` / `.task` startowy / flagi przy `scenePhase`.

---

## Odpowiedzi właściciela z paneli (2026-07-23) — ⏳ zamknięte

Wszystkie cztery ⏳ z tej sesji domknięte odczytami/decyzją właściciela:

1. **Neon** ✅ — plan Free potwierdzony (0,5 GB, autoscale 2 CU, scales-to-zero).
   Zużycie storage nierelewantne (baza ~1 MB). Zielone.
2. **Vercel Fluid Compute** ✅ **włączone** — panel pokazuje „Fluid Active CPU"
   (31 min 24 s / 4 h = 13 %) i „Fluid Provisioned Memory". Limit 300 s
   potwierdzony. Reszta pozycji < 6 %.
3. **Resend** ✅ — 7/3000 miesięcznie, 1/100 dziennie. Zielone. Jedyna pozycja na
   limicie: domeny 1/1 (druga wymusiłaby Pro).
4. **Apple Developer** ✅ — właściciel **założy konto przy rejestracji
   działalności** (99 USD/rok). Przeniesione z „opcjonalne" na potwierdzony koszt.

**Uwaga właściciela do zapamiętania:** liczby są z fazy **tworzenia i testów
apki**, nie realnego użytku — realny ruch będzie wyższy. Zapas jednak duży
(max 13 %), więc próg darmowy nie jest zagrożony na tej skali.

**Decyzja produktowa, którą audyt rozstrzyga:** **nie optymalizuj niczego
teraz.** Nic nie jest wolne ani drogie (potwierdzone panelami). Jedyne pewne
przyszłe koszty to **~20 USD/mies. Vercel Pro** (bo Hobby zabrania użytku
komercyjnego) **+ 99 USD/rok Apple** przy rejestracji; wszystko inne rusza
dopiero z prawdziwym ruchem klientów i ma wyraźny próg darmowy.

---

## Co zostaje otwarte

- **Odczyty paneli Neon/Vercel/Resend** — ✅ **domknięte 2026-07-23** (wszystko
  w zielonym, fluid compute potwierdzone). Do ponownego zerknięcia dopiero gdy
  przyjdzie realny ruch klientów (liczby były z fazy testów).
- **Vercel Pro + Apple Developer przy rejestracji** — dwa pewne przyszłe koszty
  (~20 USD/mies. + 99 USD/rok); zapisane w `PO_REJESTRACJI.md`.
- **Resend: druga domena nadawcza** — wymusiłaby Pro (dziś 1/1); mało
  prawdopodobne, do wiedzy.

## Czego ten audyt NIE obejmował

Zgodnie z zasadą „jeden audyt = jeden czat":

- **Audyt 7 (czy to nadal jest ten produkt)** — **następny i ostatni w kolejce.**
  Pyta „czy to jeszcze to, czego potrzebujesz", nie „czy działa/ile kosztuje".
  Tam wraca m.in. otwarta reguła „zero AI" i pytanie o dwa front-endy (panel +
  apka) jako trwały koszt.
- **Realny czas najwolniejszych tras na produkcji** (sync IMAP przy dużej
  skrzynce, pobranie dużego załącznika) — zależy od az.pl i wielkości skrzynki,
  mierzalne tylko na produkcji. Zapas do limitu 300 s jest jednak tak duży, że
  nie jest to ryzyko na tej skali.
- **Optymalizacja czegokolwiek** — świadomie poza zakresem: nic tego nie
  wymaga przy jednym użytkowniku (zasada briefu „nie optymalizuj na zapas").
