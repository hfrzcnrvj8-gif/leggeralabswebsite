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

## Otwarte decyzje (zadaj właścicielowi PRZED budową)

1. **Zakres v1:** tylko CEIDG + biała lista MF (najszybsza droga do
   działającego sita), czy od razu z analizą stron firm (E3 — więcej sygnałów,
   ale więcej ruchomych części)?
2. **Ile automatu:** dzienny cron dokładający kandydatów do skrzynki
   (rekomendacja — „ma działać samo"), czy tylko przycisk „Poluj teraz"?
3. **Obszar i branże rdzenia:** Radom + Warszawa, całe Mazowsze, czy cała
   Polska (wdrożenia i tak są zdalne)? Lista PKD do potwierdzenia — powyżej
   jest propozycja z pięciu kodów.
4. **Lokalny model do „zaczepki":** czy po przyjęciu kandydata Ollama ma
   proponować jedno zdanie „co konkretnie zautomatyzować u tej firmy" na
   podstawie treści jej strony (do zatwierdzenia, jak Moduły 7/8/48–50), czy
   v1 zostaje w 100% bez modelu?
