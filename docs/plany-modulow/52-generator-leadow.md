# Moduł 52 — „Łowca leadów": generator, który przesiewa, a nie zasypuje

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i sekcję „Stan po module Leady" w
> `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` (skąd ten brief się wziął).
> Architektura poniżej jest PROPOZYCJĄ do zatwierdzenia — cztery decyzje z
> sekcji „Otwarte decyzje" zadaj właścicielowi, dopiero potem buduj.

## Skąd to się wzięło

Przy audycie modułu Leady (2026-07-25) właściciel zapytał wprost: czy obecny
generator jest dobry i skąd w ogóle brać dobre leady. Obecny
(`POST /api/leads/discover`, `DiscoverPanel.tsx`) stoi na darmowym
OpenStreetMap (Nominatim + Overpass): daje nazwę firmy prawie zawsze, telefon
lub mail tylko wtedy, gdy ktoś je ręcznie wpisał na mapę, i **nic** poza tym.
Bez NIP-u, bez wielkości firmy, bez wieku, bez jakiegokolwiek sygnału, czy ta
firma ma problem, który rozwiązujemy. Obsługuje 6 branż i jeden promień 6 km.
Produkuje więc listę „firmy tego typu w tej okolicy" — najzimniejszy możliwy
materiał, do obdzwonienia na chybił trafił.

**Cel tego modułu:** architektura sita, która raz postawiona działa dalej sama
i dostaje tylko kosmetyczne poprawki (przesunięcie wag, dopisanie PKD), a nie
kolejnych przebudów. Sito ma **odrzucać** firmy, do których nie ma sensu się
odzywać, zostawiać garść realnych kandydatów, **uzasadniać** każdą decyzję i
sortować wynik według szansy.

## DECYZJA ARCHITEKTONICZNA (do potwierdzenia, nie do renegocjacji od zera)

**Rejestry publiczne zamiast mapy, potok zamiast jednego strzału, skrzynka
kandydatów zamiast wrzucania wszystkiego do rejestru leadów.**

Trzy rzeczy, które z tego wynikają i są tu najważniejsze:

1. **Sito jest deterministyczne.** Punkty i dyskwalifikatory to stałe w
   jednym pliku (`lib/leadHunter.ts`), zero LLM w decyzji „czy ten lead jest
   wart kontaktu". Zgodnie z zasadą z `CLAUDE.md`; lokalny model może
   najwyżej napisać zdanie „co tu da się zautomatyzować" jako zaczepkę do
   maila (patrz decyzja 4), nigdy nie decyduje o wpuszczeniu leada.
2. **Kandydat ≠ lead.** Automat nigdy nie dopisuje wiersza do `leads`.
   Odkłada go do `lead_candidates`, a właściciel jednym gestem bierze albo
   odrzuca. Powód jest twardy i świeży: przy Module 51 okazało się, że jedna
   wartość wpisana „na sztywno" przy tworzeniu leada cicho wykrzywiła dwa
   wskaźniki lejka. Automat sypiący 200 zimnych rekordów w rejestr zepsułby
   *wszystkie* wskaźniki konwersji — i to bez żadnego objawu awarii.
3. **Każdy kandydat niesie „dlaczego".** Lista dopasowanych sygnałów z
   punktami. Bez tego właściciel nie zaufa sortowaniu, a sortowanie, któremu
   się nie wierzy, jest bezwartościowe.

## Źródła danych (sprawdzone, nie zgadywane)

### 1. CEIDG — Hurtownia danych, API v3 (rdzeń przesiewu)

`GET https://dane.biznes.gov.pl/api/ceidg/v3/firmy` — **filtruje dokładnie
tym, czym potrzebujemy**: `pkd[]`, `wojewodztwo[]`, `powiat[]`, `gmina[]`,
`miasto[]`, `kod[]`, `datod`/`datdo` (data rozpoczęcia działalności),
`status[]` (`AKTYWNY`, `ZAWIESZONY`, `WYKRESLONY`, …), `page`, `limit`.
Zwraca: nazwa, pełny adres, właściciel (imię, nazwisko, **NIP**, REGON),
`dataRozpoczecia`, `status`, link do szczegółów i `count` (ile w ogóle
spełnia kryteria).

`GET .../v3/firma?nip=…` (szczegóły, 1 żądanie na firmę) dokłada **telefon,
email, www**, `pkdGlowny.symbol`, całą listę PKD, `dataZawieszenia` /
`dataZakonczenia` / `dataWykreslenia`, upadłość, zakazy prowadzenia
działalności.

Wymagania i twarde limity (z dokumentacji integratora, wersja 1.0 z
2024-10-21):
- **Token JWT** w nagłówku `Authorization: Bearer …`; konto na Biznes.gov.pl
  + rejestracja na `dane.biznes.gov.pl` → klucz mailem. **To ruch
  właściciela**, nie Claude (nowa zmienna `CEIDG_TOKEN` w Vercelu).
- **50 żądań / 3 minuty ORAZ 1000 żądań / 60 minut.** Przekroczenie = 180 s
  blokady liczonej **od ostatniego żądania**, więc dobijanie w trakcie
  blokady przedłuża ją w nieskończoność. Zalecany stały odstęp: **3,6 s**.
- Środowisko testowe `test-dane.biznes.gov.pl` (ta sama ścieżka) — do
  pierwszego uruchomienia bez zużywania limitu produkcyjnego.

**Ograniczenie, które trzeba powiedzieć wprost:** CEIDG to **tylko
jednoosobowe działalności**. Spółki z o.o. siedzą w KRS, a darmowe API KRS
wyszukuje po numerze KRS, nie po branży — więc spółek tą drogą nie
przesiejemy. Dla segmentu docelowego (kancelarie, biura rachunkowe, gabinety,
biura nieruchomości) JDG to i tak większość rynku; spółki zostają przy OSM,
poleceniu i ręcznym dodaniu. Rejestr REGON w paczkach GUS jako źródło spółek
= osobny, większy temat na v2.

### 2. Biała lista podatników VAT (MF) — sygnał „firma żyje"

`lib/mf.ts` → `lookupNip()` **już istnieje** w panelu (bezpłatne, bez klucza).
Po NIP-ie z CEIDG daje `statusVat` i adres do porównania. Czynny VAT to
najprostszy dostępny dowód, że firma realnie handluje, a nie tylko widnieje w
rejestrze.

### 3. Strona firmy (sygnały „da się tu coś zautomatyzować")

Pobranie **samej strony głównej** (jedno żądanie, timeout 6 s, `robots.txt`
respektowany, brak crawlowania w głąb) i deterministyczne wyrażenia na HTML:
formularz kontaktowy, adres e-mail w treści, słowa „cennik/abonament/pakiet",
sekcja „kariera/praca", ślad CMS-a, komunikat „strona w budowie". To są
najbliższe dostępne przybliżenia pytania „czy ta firma ma powtarzalny proces
i pieniądze". Zero AI na tym etapie.

### 4. OSM (obecny generator) — zostaje, w nowej roli

Nie kasujemy `POST /api/leads/discover`. Przestaje być głównym źródłem, a
staje się **uzupełniaczem kontaktu**: gdy CEIDG nie oddał telefonu/maila
(przedsiębiorca ich nie opublikował), dopasowanie po nazwie i mieście czasem
je dołoży. Nazwa polowania w źródle leada dalej powie, skąd przyszedł.

## Sito (propozycja wag — to są POKRĘTŁA, nie prawda objawiona)

Wszystko w `lib/leadHunter.ts`, stałe na górze pliku, z komentarzem „to jest
pokrętło, wolno je kręcić". Dwa poziomy:

**A. Dyskwalifikatory — kandydat nie trafia nawet do skrzynki:**
- status inny niż `AKTYWNY` (zawieszona, wykreślona), upadłość, zakaz
  prowadzenia działalności,
- **brak jakiejkolwiek drogi kontaktu** po całym wzbogaceniu (ani telefon,
  ani e-mail, ani strona) — dziś OSM dokłada takie rekordy i to jest czysty
  śmieć,
- NIP lub znormalizowana nazwa **już jest** w `leads` albo `clients`
  (`findSimilarLead` z `lib/leads.ts` — ta reguła już istnieje, nie pisz
  drugiej),
- NIP na **czarnej liście** (raz odrzucony nie wraca — patrz `lead_blacklist`),
- PKD spoza listy docelowej,
- firma młodsza niż ~18 miesięcy (jeszcze nie ma procesów ani budżetu),
- PKD własnej branży (62.xx / 63.xx — software/IT): albo konkurencja, albo
  zrobią to sobie sami.

**B. Punkty (przykładowe wagi, do skalibrowania po pierwszych przebiegach):**

| Sygnał | Punkty |
| --- | --- |
| PKD w rdzeniu docelowym (69.20 biura rachunkowe, 69.10 kancelarie, 86.2x gabinety, 68.3x nieruchomości, 70.22 doradztwo) | +30 |
| Czynny VAT (biała lista MF) | +15 |
| Publiczny e-mail | +15 |
| Wiek firmy 3–15 lat | +10 |
| Ma stronę WWW | +10 |
| Telefon | +10 |
| Strona ma formularz kontaktowy (powtarzalne zapytania = materiał na automatyzację) | +10 |
| Strona mówi o cenniku/abonamencie/pakietach (powtarzalna usługa) | +10 |
| Więcej niż jeden adres działalności (skala) | +5 |
| Blisko Radomia/Warszawy — spotkanie na żywo możliwe | +5 |
| Strona nie odpowiada albo „w budowie" | −15 |
| Tylko formularz, brak maila (trudniej dotrzeć) | −10 |

Progi: **A ≥ 70**, **B 45–69**, **C < 45**. „C" **jest widoczne**, ale na
końcu i domyślnie zwinięte — ukrywanie ich zamieniłoby sito w czarną skrzynkę,
a właściciel ma widzieć, co odsiewa.

## Struktura danych (trzy tabele, wszystkie w `ensureHubSchema()`)

1. **`lead_hunts` — definicje polowań.** Nazwa, `pkd[]`, obszar
   (województwo/powiat/miasto), zakres daty rozpoczęcia, aktywne tak/nie,
   **kursor** (`page` ostatniej pobranej strony), data ostatniego przebiegu,
   licznik znalezionych/przyjętych. Polowanie definiuje się raz („biura
   rachunkowe, powiat radomski") i chodzi w tle miesiącami.
2. **`lead_candidates` — skrzynka.** Dane firmy (nazwa, NIP, REGON, PKD,
   adres, telefon, e-mail, www), `hunt_id`, `punkty`, `ocena` (A/B/C),
   `sygnaly` JSONB (`[{kod, opis, punkty}]` — to jest „dlaczego"),
   `stan` (`nowy` / `wziety` / `odrzucony`), `powod_odrzucenia`, `lead_id`
   po przyjęciu, znaczniki czasu.
3. **`lead_blacklist` — raz odrzucony nie wraca.** NIP + znormalizowana
   nazwa + powód + data. Sprawdzana w E1, żeby nie płacić limitem CEIDG za
   wzbogacanie kogoś, kogo właściciel już przekreślił.

**Bramka migracji obowiązuje** (`schemaUpToDate` / `markSchemaApplied` —
`CLAUDE.md`), a wszelki `INSERT` w migracji musi iść przez `inMigration()`.

## Potok (każdy etap idempotentny i wznawialny)

- **E1 — zbieranie.** Jedno żądanie listy CEIDG na polowanie (do 50 firm),
  odsiew po czarnej liście i duplikatach, zapis jako `surowy`. Kursor `page`
  rośnie, więc kolejny przebieg bierze kolejną porcję; wyczerpane polowanie
  wraca na `page=0` i łapie nowe firmy (`datod` = data ostatniego przebiegu).
- **E2 — wzbogacanie.** Dla każdego surowego kandydata: szczegóły CEIDG
  (telefon/mail/www/PKD) + biała lista MF. **Sztywny odstęp ≥ 3,6 s**, licznik
  żądań **w bazie**, nie w pamięci procesu (Vercel ubija instancję między
  wywołaniami — licznik w RAM-ie jest fikcją).
- **E3 — strona firmy.** Jedno pobranie strony głównej, deterministyczne
  sygnały.
- **E4 — sito.** Punkty, ocena, uzasadnienie. Zero sieci, w pełni testowalne
  (`npm test` — reguły biznesowe to dokładnie ta kategoria, dla której
  wprowadziliśmy testy w Audycie 6).
- **E5 — skrzynka.** Panel: nowa zakładka „Kandydaci (N)" obok
  Tablica/Tabela w `/admin/leads`, karta z oceną, sygnałami i dwoma
  przyciskami. Apka: lista z **swipe „Weź" / „Odrzuć"** — ta sama para
  (swipe + menu przytrzymania), którą dostały Pulpit i Leady.
  „Weź" tworzy leada: `zrodlo_kategoria = "Automatyczne wyszukiwanie"`,
  `zrodlo` = nazwa polowania + ocena, `branza` z nazwy PKD, notatka = lista
  sygnałów, status „Do kontaktu". „Odrzuć" pyta o powód z krótkiej listy i
  dopisuje do czarnej listy.

**Budżet czasu:** cały przebieg to jedno wywołanie z twardym stopem ~240 s
(Vercel Hobby daje dziś 300 s — Audyt 5) i zapisem kursora, więc przerwanie w
połowie nic nie psuje.

**Automat:** dzienny cron (`CRON_SECRET` już jest, Hobby pozwala raz na dobę)
→ jeden krok każdego aktywnego polowania → jeden wpis w Centrum powiadomień:
„Łowca dołożył 12 kandydatów (3 z oceną A)". **Żadnych maili i żadnej wysyłki
do firm** — panel nadal nie kontaktuje się z nikim sam.

## Jak to się „samo poprawia" bez AI

Dwa liczniki, które zamieniają sito w pętlę uczenia się **przez właściciela**:
1. **Konwersja per ocena łowcy** (A/B/C → ilu zostało klientami) — wzorem
   „konwersji per źródło" z Modułu 51. Po kwartale widać, czy „A" naprawdę
   znaczy A.
2. **Top 5 powodów odrzucenia** — jeśli właściciel 30 razy odrzucił z powodem
   „za mała firma", to znaczy, że próg wieku/rozmiaru jest źle ustawiony.

To jest dokładnie ta „kosmetyczna poprawka co jakiś czas": zmiana kilku liczb
w `lib/leadHunter.ts`, nie przebudowa.

## RODO (obowiązkowe, nie opcjonalne)

Dane JDG z CEIDG **są danymi osobowymi** (imię, nazwisko, adres, NIP osoby
fizycznej). Zapisy do dopisania w polityce prywatności i do
`docs/DO-PRAWNIKA-I-TLUMACZA.md`:
- podstawa: prawnie uzasadniony interes (marketing B2B), źródło: rejestr
  publiczny CEIDG,
- **obowiązek informacyjny przy pierwszym kontakcie** (zdanie w szablonie
  pierwszego maila — nie „kiedyś", od razu),
- retencja: kandydat nieprzyjęty **usuwany po 30 dniach**; na czarnej liście
  zostaje wyłącznie NIP + znormalizowana nazwa + powód (minimalizacja, żeby
  nie trzymać profilu osoby, której nie zamierzamy niczego proponować),
- kandydat przyjęty staje się leadem i podlega istniejącej retencji 24 mies.
  (`LEADS_RETENTION_MONTHS`, `purgeStaleLeads` z Audytu 2).

## Poza zakresem (nie rób bez wyraźnej prośby)

Kupowane bazy danych; scraping LinkedIna (regulamin + ryzyko konta);
jakakolwiek automatyczna wysyłka do kandydatów (to nie maszyna do cold-maili
— panel nic nie wysyła sam, i to zostaje); model AI w decyzji sita; spółki z
KRS/paczek REGON; uczenie maszynowe na historii konwersji.

## Decyzje właściciela — ROZSTRZYGNIĘTE 2026-07-25 (nie pytaj o nie ponownie)

1. **Zakres v1: CEIDG + biała lista MF + strony firm.** Pełne sito od razu,
   z etapem E3 (jedno pobranie strony głównej, deterministyczne sygnały) — bez
   niego ocena opierałaby się prawie wyłącznie na branży i wieku.
2. **Automat: dzienny cron do skrzynki.** Jeden krok każdego aktywnego
   polowania na dobę, jeden wpis w Centrum powiadomień. Przycisk „Poluj teraz"
   dokładamy obok (przydaje się przy kalibracji wag), ale cron jest domyślną
   drogą — „ma działać samo".
3. **Obszar: Mazowsze.** Warszawa razem z Radomiem/Przysuchą w jednym worku —
   duży rynek plus zaplecze i realna możliwość spotkania na żywo (punkt za
   bliskość zostaje w sicie). Cała Polska odpada na starcie właśnie dlatego,
   że zabijałaby ten punkt. Lista PKD: propozycja pięciu kodów z tabeli wyżej
   wchodzi jako punkt startowy i jest pokrętłem, nie ustaleniem na zawsze.
4. **Lokalny model TAK, ale dopiero po przyjęciu kandydata.** Ollama proponuje
   jedno zdanie „co konkretnie zautomatyzować u tej firmy" na podstawie treści
   jej strony; zdanie ląduje w notatce leada po zatwierdzeniu przez
   właściciela, wzorem Modułów 7/8/48–50. **Sito zostaje w 100%
   deterministyczne** — model nie ma wpływu na to, kto wchodzi do skrzynki, i
   nie jest wołany dla kandydatów, których właściciel odrzucił.

## Czego NIE zrobi Claude — jedyna rzecz po stronie właściciela

**Token CEIDG.** Konto na Biznes.gov.pl → rejestracja na `dane.biznes.gov.pl`
→ klucz przychodzi mailem → wrzucenie go do zmiennych środowiskowych Vercela
jako `CEIDG_TOKEN` (i lokalnie do `.env.local`, jeśli chcemy przejechać
polowanie na dev-bazie). Bez tego etapy E1/E2 nie mają jak zapytać rejestru;
sito, skrzynka, testy i UI da się zbudować i sprawdzić wcześniej.

---

## WYKONANE 2026-07-25 — co powstało i czego jeszcze nie da się sprawdzić

Pełny opis: `HUB_SETUP.md` → „Moduł 52". Tu tylko to, co dotyczy tego briefu.

**Zbudowane zgodnie z briefem:** trzy tabele + licznik żądań, sito
`lib/leadHunter.ts` z testami (`npm test`, 21 asercji), klient CEIDG
`lib/ceidg.ts`, potok E1–E4 `lib/leadHunterRun.ts`, trasy API, zakładka
„Kandydaci (N)" w panelu, skrzynka w apce (swipe + menu przytrzymania),
zaczepka z Ollamy po przyjęciu, dwa liczniki pętli poprawy, retencja 30 dni,
zapisy do `docs/DO-PRAWNIKA-I-TLUMACZA.md` (2.1b), cron `0 4 * * *`.

**Jedno świadome odstępstwo:** tabele poszły do własnego
`ensureLeadHunterSchema()`, nie do `ensureHubSchema()` — uzasadnienie
w `HUB_SETUP.md` i w komentarzu przy funkcji.

**Czego NIE dało się sprawdzić i dlaczego.** Właściciel nie ma jeszcze tokenu
CEIDG (stan na dzień budowy), więc **etapy E1 i E2 nie zostały wykonane ani
razu na żywym rejestrze**. Sprawdzone jest wszystko poza nimi: sito (testy),
skrzynka, „Weź"/„Odrzuć", czarna lista, statystyki, cron ze ślepym przebiegiem,
komunikat o braku tokenu — na sztucznych danych w dev-bazie (PGlite), w
podglądzie i na symulatorze.

**Co konkretnie zostaje do potwierdzenia po wpisaniu tokenu** (w tej
kolejności, najlepiej najpierw z `CEIDG_ENV=test`):

1. **Kształt odpowiedzi `/firmy` i `/firma`.** Klient czyta pola defensywnie
   (`txt`/`obj`/`kodPkd`/`adres` w `lib/ceidg.ts`) i przy niespodziance oddaje
   pustą wartość zamiast się wywracać — ale to znaczy, że **rozjazd nazw pól
   objawi się jako kandydaci bez telefonu i bez PKD**, nie jako błąd. Pierwszy
   przebieg trzeba obejrzeć: czy kandydaci mają NIP, kontakt i branżę.
2. **Czy `count` z listy pozwala poprawnie przewinąć kursor** (kiedy polowanie
   uzna się za wyczerpane i wróci na `page=1`).
3. **Czy odstęp 3,8 s wystarcza** — czy w logu nie pojawia się HTTP 429.

Gdyby (1) się nie zgadzało, poprawka jest punktowa: nazwy pól w helperach
`pobierzListe`/`pobierzSzczegoly`, bez ruszania sita, skrzynki i UI.

**Arytmetyka porcji dziennej — sprawdzona, decyzja z briefu się broni.**
Ograniczeniem NIE jest limit rejestru (50/3 min), tylko budżet czasu jednego
wywołania: przy odstępie 3,8 s w 240 s mieści się ~60 żądań, czyli ~60
wzbogaconych firm na dobę. Sam odstęp trzyma nas pod limitem krótkiego okna
(180 s / 3,8 s ≈ 47 żądań < 50), więc do blokady nie dochodzi. Kilkanaście
kandydatów po sicie dziennie to sensowna porcja do przejrzenia przy kawie —
gdyby okazała się za mała, zwiększa się ją **dokładając polowania**, nie
skracając odstęp.
