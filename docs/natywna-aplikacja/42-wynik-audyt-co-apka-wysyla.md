# Wynik: audyt „apka wysyła, trasa nie czyta"

**Wykonane:** 2026-08-05, jednym czatem, wg `41-brief-audyt-co-apka-wysyla.md`.
**Repozytorium apki:** `../leggera-hub-ios`, commit bazowy `d5c40c6`.
**Zmienionych plików kodu: ZERO** — ani w panelu, ani w apce. `git status`
czysty w obu repozytoriach przez całą sesję.

## Wynik jednym zdaniem

**Pusto. Nie znaleziono ani jednego pola, które apka wysyła, a trasa ignoruje.**

Brief przewidywał, że tak może być, i tak wyszło. Poniżej: co dokładnie
sprawdzono (żeby następny audyt nie robił tego trzeci raz), trzy fałszywe
alarmy po drodze, jedna obserwacja poboczna — i próba odpowiedzi na pytanie,
DLACZEGO ta strona monety jest zdrowa, skoro druga miała sześć luk.

---

## Skala, w liczbach

| | |
|---|---|
| wywołań `POST` / `PATCH` w apce | 54 / 21 |
| ładunków słownikowych (klucze bez kontroli kompilatora) | 16 — **wszystkie sprawdzone** |
| inline `struct Body: Encodable` | 43 — **wszystkie sprawdzone** |
| ładunków `multipart/form-data` | 6 — sprawdzone |
| tras panelu, które to pokrywa | 63 różne |
| **pól wysyłanych, a nieczytanych** | **0** |
| plików zmienionych | **0** |

Cztery ładunki (`clients/:id`, `costs/:id`, `projects/:id`, `events/:id`)
sprawdził już autor briefu — nie liczono ich drugi raz, ale ich wołających
w widokach przejrzano ponownie, bo słownik bywa budowany poza `APIClient.swift`.

---

## Co sprawdzono i z jakim wynikiem

### Ładunki słownikowe (16/16 czyste)

Te były priorytetem: klucz jest tu zwykłym stringiem, więc literówka nie daje
żadnego objawu — ani przy kompilacji, ani w czasie działania.

| ładunek | trasa | klucze | wynik |
|---|---|---|---|
| `zmienNotatke` | `PATCH /api/notes/:id` | `tytul`, `tresc`, `pinned`, `archived`, `client_id`, `lead_id` | czyste |
| `zmienWiadomosc` | `PATCH /api/mail/:id` | `status`, `move`, `flagged`, `muted`, `snoozeUntil`, `senderDecision`, `nudgeDismissed` | czyste |
| `zmienPrzypomnienie` | `PATCH /api/reminders/:id` | 16 kluczy (tytuł, notatka, termin, godzina, priorytet, lista, flaga, 3× powiązanie, 3× lokalizacja, przy wyjściu, cykl, koniec serii) | czyste |
| `zmienListePrzypomnien` | `PATCH /api/reminders/lists/:id` | `nazwa`, `kolor` | czyste |
| `zmienLeada` | `PATCH /api/leads/:id` | 15 kluczy z czterech ekranów | czyste |
| `utworzLeada` | `POST /api/leads` | 8 kluczy + `www` z rozszerzenia „Udostępnij" | czyste |
| `utworzKlienta` | `POST /api/clients` | 13 kluczy | czyste |
| `dodajKomponent` / `zapiszKomponent` | `POST`/`PATCH /api/catalog` | 11 kluczy | czyste |
| `zapiszTrescOferty` | `PATCH /api/offers/:id` | `uwagi`, `wazna_do`, `waluta`, `roi_godziny`, `roi_stawka` | czyste |
| `zmienStatusOferty` / `zmienStatusUmowy` | `PATCH /api/offers|contracts/:id` | `status`, `powod_odrzucenia`, `komentarz_odrzucenia` | czyste |
| `zmienKamien`, `przestawKamienie`, `przestawZadania` | trasy projektu | `nazwa`, `termin`, `ids` | czyste |
| `zmienProjekt`, `zmienKlienta`, `zapiszKoszt`, `zmienWydarzenie` | — | — | sprawdzone w briefie |

### `struct Body` — najpierw to, co WYCHODZI DO KLIENTA (czyste)

| trasa | pola | wynik |
|---|---|---|
| `POST /api/mail/compose`, `/api/mail/:id/forward` | `to`, `subject`, `text`, `cc`, `bcc`, `podpis`, `attachments` | czyste |
| `POST /api/mail/:id/reply` | `text`, `subject`, `cc`, `podpis` | czyste |
| `POST /api/mail/schedule` | `to`, `cc`, `bcc`, `subject`, `text`, `sendAt`, `podpis`, `replyToMessageId` | czyste |
| `POST /api/events/:id/invite` i `/cancel-invite` | `to`, `subject`, `text`, `podpis` | czyste |
| `POST /api/invoices/:id/remind` | `poziom` | czyste |
| `POST /api/client-followups/:id/send` | `body` | czyste |
| `POST /api/projects/:id/request-review` | `body` | czyste |
| `POST /api/projects/:id/review` | `jakosc`, `terminowosc`, `komunikacja`, `comment`, `consentCaseStudy`, `consentName` | czyste |

### Reszta `struct Body` (czyste)

`mail-templates` (POST i PATCH), `mail/:id/to-task`, `mail/:id/create-lead`,
`create-client`, `hub/propozycje`, `notifications`, `notes` (POST), `notes/:id/schedule`,
`projects/:id/tasks` (POST i PATCH), `activity`, `onboarding` (POST i PATCH),
`resources`, `dependencies`, `milestones` (POST i reorder), `time/start`,
`clients/:id/contacts` (POST i PATCH), `leads/:id/activity`, `clients/:id/activity`,
`leads/candidates/:id/reject`, `contracts` (POST), `offers` (POST), `invoices` (POST),
`invoices/:id/payments`, `offers/:id/accept`, `offers/:id/sections` (POST i PATCH),
`share-links/:kind/:id`, `events` (POST).

---

## Trzy fałszywe alarmy — i czym każdy był

Warto je spisać, bo każdy zabrał kilka minut i każdy powtórzy się przy
następnym audycie tej rodziny.

1. **`roi_godziny` / `roi_stawka` „nieczytane" w `PATCH /api/offers/:id`.**
   Trasa czyta je **pętlą po tablicy nazw** (`for (const pole of ["roi_godziny",
   "roi_stawka"])`), nie osobnym `if ("roi_godziny" in body)`. Grep po nazwie
   pola trafiał tylko w `UPDATE`. Dokładnie to, przed czym ostrzegał brief:
   szukaj ODCZYTU z ciała, a odczyt nie zawsze wygląda jak `"pole" in body`.

2. **`powod_odrzucenia` „nieczytany" w umowach.** Czytany, ale **wewnątrz
   bloku `if ("status" in body)`** — bo ma sens wyłącznie razem ze statusem
   „Odrzucona". Pole zagnieżdżone w warunku innego pola wypada z każdego
   płaskiego przeglądu.

3. **`action` „nieczytany" w `/api/share-links/offer/:id`.** Trasa nie istnieje
   pod tą ścieżką — jest **parametryczna**: `app/api/share-links/[kind]/[id]/`.
   Sprawdzenie „czy plik istnieje" dało fałszywy wynik, a nie błąd.

---

## Jedna obserwacja poboczna (nie luka, nie do naprawiania teraz)

**`reminders.lokalizacja_promien` to kolumna bez pisarza.** Trasa ją czyta
(`POST` i `PATCH /api/reminders`), apka czyta ją przy zakładaniu geofencu
(`GeofencePrzypomnien.swift`, z domyślną 100 m, gdy pusto) — ale **żaden
interfejs jej nie wysyła**: ani panel, ani apka. Wartość jest zawsze `NULL`.

Sprawdzone dlatego, że wyglądało to na kandydata do luki odwrotnej: `PATCH`
zapisuje lokalizację **w komplecie** (`nazwa`, `lat`, `lon`, `promien`), więc
edycja przypomnienia z telefonu ustawia promień na `NULL` przy każdym zapisie.
Ponieważ nikt go nigdy nie ustawia, jest to nadpisanie `NULL` przez `NULL` —
bez skutku. **Gdyby kiedyś powstała kontrolka promienia (po którejkolwiek
stronie), edycja z telefonu zaczęłaby go kasować w ciszy.** To jest warunek do
zapamiętania, nie usterka do naprawienia dziś.

---

## Czym to sprawdzono (poza czytaniem kodu)

Samo porównanie nazw kluczy nie łapie rodziny „klucz czytany, ale wartość cicho
podmieniana" — tej, która dała znaleziska w audytach Katalogu i Kosztów. Dlatego
poza lekturą wykonano:

**1. Sondy różnicowe** (`npm run dev`, dev-baza PGlite) — `PATCH` ciałem
**dokładnie takim, jakie buduje apka**, ze zrzutem rekordu przed i po:

- **Przypomnienie, komplet 16 pól, zmieniony tylko tytuł** → w bazie zmienił się
  **wyłącznie tytuł**. Lista, flaga, priorytet, termin nietknięte. To jest test
  na „częściowość, która nie jest częściowa" i przechodzi.
- **Komponent katalogu, komplet 11 pól** → zmieniło się tylko to, co inne
  w ciele. Widełki, waluta, VAT, jednostka i koszt zakupu przeżyły.

**2. Przebieg przez apkę** (symulator iPhone 17, `LEGGERA_DEV_BACKEND=lokalny`,
`LEGGERA_DEV_TOKEN=dev`) — profil leada → „Akcje" → **„+tydzień"**, czyli
`PATCH` z dwoma polami naraz. Różnica w bazie zaraz po kliknięciu:

```
next_followup: None -> '2026-08-12'
updated_at:    15:39:18 -> 15:44:25
```

`next_action` nie zmieniło się, bo apka wysłała tam wartość, która już tam była
(`""`) — zgodnie z kodem. Zapis z telefonu dociera do bazy w całości.

**Ograniczenie tej weryfikacji:** przez apkę przeszła **jedna** ścieżka zapisu,
nie wszystkie. Pola tekstowe i przełączniki w arkuszach edycji nie przyjmowały
sterowania w tym środowisku (klawiatura programowa nie wchodzi przy podłączonej
sprzętowej symulatora; tapy w przyciski i pastylki działają, w wiersze list
i pola tekstowe nie). Pozostałe ładunki potwierdzono sondą `curl` z ciałem
skopiowanym z kodu apki — **to jest sonda, nie przebieg**, i tak należy to
czytać.

---

## Dlaczego pusto — czyli czego ten audyt nauczył o samym szukaniu

Poprzedni audyt (odczyt) znalazł sześć luk. Ten (zapis) znalazł zero. To nie
jest przypadek ani zasługa staranności — to **różnica w tym, co wymusza
zgodność**:

1. **Klucz w zapisie ma po drugiej stronie kolumnę i skutek, którego autor
   szuka.** Kto dopisuje pole do formularza, robi to PO TO, żeby się zapisało,
   i pierwszy raz, gdy je kliknie, zobaczy, że nie działa — po odświeżeniu.
   Pole w odczycie może być latami oddawane przez trasę i nigdy nie
   przeczytane, bo **nikt nie czeka na jego pojawienie się**. Brak wyniku boli
   od razu; brak informacji nie boli nigdy.

2. **Zapis ma jedno gardło, odczyt ma dwadzieścia ekranów.** Ładunki zapisu
   schodzą się w `APIClient.swift` (75 wywołań w jednym pliku), a każdy
   przechodzi przez `AppStore.wykonaj`. Odczyt rozłazi się po widokach, gdzie
   pominięte pole to po prostu brakująca sekcja — czyli nic.

3. **Panel przeszedł już tę drogę.** Trasy zapisu były przedmiotem audytów
   Modułów 57, 61, 62, 63, 65, 66 — to stamtąd pochodzą dwufazowe `PATCH`-e,
   `czytajPolaKatalogu` z semantyką częściowej aktualizacji i odmowy zamiast
   cichych no-opów. Apka trafiła na trasy, które ktoś już wyprostował.

**Wniosek do następnego audytu tej rodziny: szukaj tam, gdzie brak skutku jest
niewidoczny.** Kierunek „apka → serwer" ma sprzężenie zwrotne (właściciel widzi,
że zapis nie wszedł), kierunek „serwer → apka" go nie ma. To drugi jest wart
przeglądania i to on dał sześć luk.

---

## Czego ten audyt NIE objął

- **`DELETE`** — bez ciała, poza zakresem z definicji.
- **Poziom 3 świadomie pominięty w apce** (KSeF, korekty, edycja pozycji
  faktury) — nie ma czego porównywać, apka tych tras nie woła.
- **Warstwa wizualna** — jak zawsze w tym środowisku.
- **Przebieg przez apkę dla wszystkich 63 tras** — patrz ograniczenie wyżej.

---

## Propozycja następnego kroku

Brief przewidywał to i wskazywał: **drugi rok obrotowy** (punkt (b) z
`docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`) — numeracja faktur przez zmianę roku,
retencja danych, faktury cykliczne przechodzące przez 31 grudnia. Da się to
zrobić w tym środowisku, bo `npm run przejscie` już umie budować scenariusze.

**To jest robota po stronie PANELU, nie apki** — i wymaga zgody właściciela
przed przełączeniem repozytorium.
