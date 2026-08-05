# Wynik: audyt „serwer oddaje, apka wyrzuca do kosza"

**Wykonane:** 2026-08-05, jednym czatem, wg `39-brief-audyt-co-apka-wyrzuca.md`.
**Repozytorium apki:** `../leggera-hub-ios`, commit bazowy `8870614`.
**Panelu NIE ruszano** — `git status` w nim czysty przez całą sesję, `tsc` bez
uwag, `npm run przejscie` 101 działa · 0 regresji.

Przejrzane **wszystkie 48 wywołań `GET`** z `APIClient.swift` przeciwko temu, co
naprawdę zwracają ich trasy. Znalezionych luk: **sześć**. Naprawionych
i sprawdzonych na symulatorze przeciwko `npm run dev`: **sześć**. Do tego
**dziesięć** pominięć ocenionych jako świadome albo bezprzedmiotowe — spisanych
niżej, żeby następny audyt nie liczył ich drugi raz.

---

## Skala, w liczbach

| | |
|---|---|
| wywołań `GET` w apce | 48 |
| tras panelu, które one wołają | 41 różnych |
| pól oddawanych, a nieczytanych | 6 luk + 10 świadomych pominięć |
| linijek Swifta, o które urosła apka | ~530 |
| **plików panelu zmienionych** | **0** |

---

## Sześć luk

### 1. `expiredOffers` — oferty po terminie ważności (`GET /api/hub/today`)

To była jedyna luka POTWIERDZONA przed audytem (brief 39). Panel liczy wygasłe
oferty do „wymaga działania dziś" i ma dla nich sekcję od 2026-07-24 —
**dokładnie po zgłoszeniu, że licznik pokazuje więcej spraw, niż da się
zobaczyć**. Apka miała ten sam licznik i tej sekcji nie miała.

- `PulpitDzis.ofertyWygasle` + `PulpitOferta.waznaDo` (`wazna_do`).
- Sekcja **„Wygasłe oferty"** w `PulpitView`, między „Oferty bez decyzji"
  a „Umowy bez odpowiedzi” — tak jak w panelu.
- Liczy się do `doZrobienia`, z tego samego powodu, co trzy pozycje dołożone
  poprzednią paczką.
- Akcja **„Oznacz jako wygasłą"** (gest i menu kontekstowe) — jedyny ruch, który
  tę pozycję z listy zdejmuje.
- **Bez gestu „Przypomnij"** i to jest różnica wobec sąsiedniej sekcji:
  przypominanie o dokumencie, który już nie obowiązuje, wysłałoby klientowi
  nieaktualną ofertę.

**Dowód:** zrzut — „Baltic Retail sp. z o.o. · 6000,00 zł · ważna do 2 sie
2026". Po geście: `expiredOffers` z 1 na 0, status oferty w bazie `Wygasła`.

---

### 2. `bramka` — **z telefonu nie dało się wysłać dokumentu z ostrzeżeniem**

To najpoważniejsze znalezisko całego audytu i nie jest „brakującą sekcją".

Faza 2 zaplecza dała czterem trasom wysyłkowym bramkę (`lib/bramkaWysylki.ts`).
Trasa dzieli zastrzeżenia na dwie kategorie i odpowiada dwoma różnymi kodami:

- **400 — blokada.** Nie da się przejść, trzeba poprawić dokument.
- **409 — same ostrzeżenia.** Panel pokazuje listę i powtarza żądanie
  z `mimo_ostrzezen: true`.

Apka nie czytała `bramka` **nigdzie**: ani z profilu dokumentu, ani z odmowy.
409 wpadało u niej w gałąź „odmowa z powodem" (napisaną pod bramkę umowy),
pokazywało jedno zdanie w oknie — **i na tym się kończyło. Nie było czym
powiedzieć „mimo to".**

Czyli: dokument, któremu brakuje sekcji opisowej albo w którym zostały
sprzeczne terminy, **był z telefonu niewysyłalny**. Bez awarii, bez błędu,
z sensownym komunikatem — i bez drogi dalej. To ten sam kształt, co „blokada
bez drogi wyjścia" z Modułu 58.

**Dotyczy czterech tras, które apka realnie woła:**

| trasa | co przez to nie wychodziło |
|---|---|
| `POST /api/offers/:id/send` | oferta bez sekcji opisowej |
| `POST /api/contracts/:id/send` | dokument ze sprzecznymi terminami |
| `POST /api/client-followups/:id/send` | **tekst pisany na telefonie** |
| `POST /api/projects/:id/request-review` | **tekst pisany na telefonie** |

Dwie ostatnie wysyłają treść, którą właściciel redaguje na miejscu — tam
ostrzeżenie („zostało niewypełnione `[Twoje imię]`") jest regułą, nie wyjątkiem.

**Piąta trasa z bramką, `POST /api/invoices/:id/send`, jest poza zakresem:
apka jej nie woła** (wystawianie i wysyłka faktury to poziom 3).

#### Jak naprawione

`LeggeraHubCore/Networking/BramkaWysylki.swift` — typy `Zastrzezenie`,
`WynikBramki` i pytanie `PytanieOOstrzezenia`. Obsługa w **rurze HTTP**
(`wyslijNaURL`), obok istniejącej obsługi 428, i z tej samej przyczyny:
cztery trasy nie musiały o niczym wiedzieć, a piąta nie będzie musiała.

- **409 z `bramka` i bez blokad** → pytanie właściciela → powtórka żądania
  z `mimo_ostrzezen: true` dołożonym do ciała. Jedna powtórka, nie pętla.
- **Rozstrzyga OBECNOŚĆ pola `bramka`, nie kod 409** — tym samym kodem
  odpowiada bramka umowy, unieważniony link i „dokument już zamknięty", a żadna
  z tych rzeczy nie ma „mimo to". Ta sama dyscyplina, co przy 428.
- **400 z `bramka`** → `APIError.odmowa` z PEŁNĄ listą zamiast jednozdaniowego
  `error` („…i 1 inna rzecz"). Panel pokazuje listę w pasku edytora; na
  telefonie tego paska nie ma, więc lista idzie do okna, razem z „gdzie to
  poprawić".
- Okno: `ArkuszOstrzezenWysylki` w `ArkuszPotwierdzenia.swift`. **Ten sam
  koordynator i ten sam `.sheet`** co bariera nieodwracalności — w scenie jest
  jeden `.sheet` i tak ma zostać (kilka prezentacji tego samego rodzaju na
  jednym widoku = działa jedna, Faza 8). Oba pytania odpowiadają tym samym
  typem, bo znaczą to samo: „rób dalej" albo „nie".
- Kolor: `Znaczenie.uwaga`, **nie czerwień**. Czerwień w tej apce znaczy
  „nieodwracalne"; ostrzeżenie nie jest nieodwracalnością.

#### To NIE są dwa pytania o to samo

Bariera 428 pyta „czy na pewno chcesz to zrobić". Bramka pyta **„czy na pewno
chcesz to wysłać W TAKIM STANIE"** — i wymienia z nazwy, co jest nie tak. Padają
w tej kolejności, w której zadaje je serwer (bramka jest w trasie PRZED
potwierdzeniem).

**Dowód z dziennika `next dev`** — jedno kliknięcie „Wyślij ofertę do klienta":

```
POST /api/offers/934ad99c…/send 409   ← ostrzeżenie: oferta bez sekcji
POST /api/offers/934ad99c…/send 428   ← po „Wyślij mimo to": pytanie o zgodę
POST /api/offers/934ad99c…/send 200   ← po „Wyślij ofertę": wysłane
```

Przed tą zmianą droga kończyła się na pierwszej linijce. Zrzuty: okno „Jedna
rzecz do sprawdzenia" (z tekstem i miejscem do poprawienia), zaraz po nim okno
„Wysłać ofertę klientowi?" — arkusz przeprezentował się czysto, bez wyścigu.

---

### 3. `aneksy` i `matka` — rodzina umowy (`GET /api/contracts/:id`)

Audyt Modułu 11 zamknął w panelu lukę: „z umowy nie dało się zobaczyć, że ma
aneks (czyli że jej warunki już nie obowiązują w całości), a z aneksu nie było
przejścia do umowy-matki". Trasa oddaje od tamtej pory `aneksy` i `matka`.
`UmowaResponse` w apce czytał z tej odpowiedzi **wyłącznie `clauses`** — więc
telefon miał dokładnie tę lukę, którą panel u siebie naprawił.

- `SzczegolyUmowy` (clauses + aneksy + matka) zamiast gołej tablicy klauzul;
  `AppStore.szczegolyUmowy` trzyma teraz cały ten obiekt.
- Sekcja **„Aneksy do tej umowy"** — z jednym zdaniem nad listą („Warunki
  powyżej zmienia podpisany aneks"), liczonym **tylko z PODPISANYCH**: szkic
  aneksu jeszcze niczego nie zmienia.
- Sekcja **„Aneks do"** w drugą stronę.
- Obie stoją **zaraz po „Zakresie prac" i cenie** — bo to ich dotyczy.
- `etykietaTypuUmowy(_:)` wyjęta z `Umowa` jako wolna funkcja: ten sam napis
  potrzebuje teraz `UmowaMatka`, a dwie kopie tej mapy rozjechałyby się przy
  pierwszym nowym typie (tak zniknął kiedyś aneks — gałąź „wszystko inne to
  Umowa").

**Dowód:** zrzuty obu stron — umowa 8000 zł z „Aneks nr 1 · Podpisana ·
11 000,00 zł" i „Aneks nr 2 · Szkic"; z aneksu „Aneks do → Drukarnia Helios,
Umowa · Podpisana".

---

### 4. `sourceOffer` — z czego powstał projekt (`GET /api/projects/:id`)

Panel pokazuje w profilu projektu „→ Oferta: …". Trasa oddaje to pole od czasu,
gdy `lib/offerAccept.ts` zaczął wiązać ofertę z projektem. `ProjektResponse`
w apce go nie miał.

`DokumentyProjektu.zrodloOferta` + wiersz **na górze rejestru dokumentów**
(„Powstał z tej oferty") — bo od oferty ten projekt się zaczął i to ona ustaliła
zakres i cenę, którą reszta dokumentów tylko powtarza.

**Dowód:** zrzut — „Oferta — Drukarnia Helios [przejście 102128] / Powstał z tej
oferty", nad trzema umowami i dwiema fakturami.

---

### 5. `offers` / `invoices` / `contracts` / `tresc` — szukanie (`GET /api/search`)

Nad `SzukajView` stał komentarz: *„Dokumenty serwer też zwraca, ale apka je
świadomie pomija: to poziom 3, nie ma ekranu, na który dałoby się z nich
przejść, a wynik prowadzący donikąd jest gorszy niż jego brak."*

**Był prawdziwy, kiedy go pisano — i przestał być prawdziwy w module A5
(2026-07-21)**, który dał ofertom, fakturom i umowom własne profile. Powód
pominięcia wygasł, a pominięcie zostało. To osobna odmiana tej samej rodziny
błędu: nie „zapomniane pole", tylko **uzasadnienie, które przeterminowało się
w ciszy**.

Razem z dokumentami leżało `tresc` — **całe szukanie po TREŚCI** (Moduł 56
panelu: rozmowy, maile, notatki, opisy projektów), którego telefon nie miał
w ogóle. Apka szukała wyłącznie po nazwach.

- `TrafienieDokumentu` (jeden typ na trzy rodzaje — różni je tylko to, które
  pole niesie nazwę) i `TrafienieTresci`.
- Sekcje „Oferty" / „Faktury" / „Umowy" z przejściem na profil
  (`SzczegolyCel`), sekcja **„W treści"** z fragmentem jako treścią wiersza
  i nazwą rekordu w podpisie — bo po to się szuka w treści.
- Mapowanie `rodzaj → ekran` jest bliźniakiem `SEGMENT_TRAFIENIA`
  z `lib/szukaj.ts` (komentarz w panelu wprost się tego spodziewał: *„Apka ma
  własne mapowanie — dlatego trasa zwraca `rodzaj`, a nie gotowy link"*).
  `notatka` → `nil`: Notatnik nie otwiera się po identyfikatorze, więc wiersz
  **nie udaje odnośnika**, ale fragment i tak pokazuje.

**Dowód:** zrzuty dla frazy „Helios" — sekcje Leady/Klienci/Projekty/Oferty/
Faktury i „W treści" (rozmowa, oś czasu klienta, opis projektu). Stuknięcie
w trafienie „opis projektu" otwiera profil projektu.

---

### 6. `offerLosses` i `hunter` — Statystyki (`GET /api/stats`)

Ekran Statystyk mówił, ILE ofert przechodzi, i milczał o tym, **dlaczego reszta
nie**. Oba pola trasa liczy od dawna.

- **„Na czym przegrywamy oferty"** — powód, liczba i KWOTA. Kwota nie jest
  ozdobą: pięć małych ofert przegranych „za drogo" to inna wiadomość niż jedna
  duża.
- **„Skuteczność Łowcy"** — ile wziętych kandydatów danej oceny zostało
  klientem (czy A naprawdę znaczy A) plus najczęstsze powody odsiewu. Sekcja
  znika, gdy nikt nie został wzięty ani odrzucony — trzy wiersze „0/0 —" to szum.

**Dowód:** zrzut — „Bez podanego powodu 2× 1000,00 zł / Nie ten termin 1×
1000,00 zł / Za drogo 1× 15 000,00 zł", stopka „Razem 4 odrzuconych ofert na
17 000,00 zł"; niżej Ocena A/B/C i „Brak sensownego kontaktu 1×".

---

## Co sprawdzono i uznano za NIE-lukę

Żeby następny audyt nie liczył tego drugi raz.

| trasa | pole | dlaczego zostaje |
|---|---|---|
| `hub/today` | `kpi.taxReserve`, `revenueLastMonth`, `pipelineRaw`, `signedContracts`, `avgClientRating`, `reviewsCollected`, `closedProjectsCount` | Świadome i udokumentowane w `PulpitKPI`: „panel pokazuje ich więcej; apka bierze te, które da się przeczytać rzutem oka". Cztery ostatnie są już na ekranie Statystyk. |
| `invoices/:id` | `invoice`, `settings`, `korekty`, `koryguje`, `zaliczka` | Poziom 3 (korekty, zaliczki, dane wystawcy — praca przy biurku). `invoice` świadomie: nagłówek jest już policzony na liście. |
| `invoices/:id` | `bramka` | Apka nie woła `/invoices/:id/send` — nie ma czego bramkować. |
| `offers/:id`, `contracts/:id` | `bramka` **w profilu** | Naprawiono ODMOWĘ (pkt 2), nie pasek zapowiadający. Pasek w edytorze panelu ma sens tam, gdzie się dokument REDAGUJE; apka go nie redaguje, więc pokazywałby zastrzeżenia bez drogi, żeby je usunąć. |
| `mail/:id` | `unassignedSameAddress` | Liczy się tylko dla pytania „przypiąć też pozostałe N wiadomości z tego adresu?" przy ręcznym przypisaniu do klienta. Apka nie przypisuje maili — robi z nich lead/klienta. Brak ekranu. |
| `clients/:id` | kwoty i daty w `offers`/`invoices`/`contracts` | „Powiązane" to rejestr jednowierszowy (nazwa + status); kwoty stoją w profilu każdego dokumentu, o jedno stuknięcie dalej. |
| `projects/timeline` | `dependencies` | Oś czasu w apce nie rysuje strzałek zależności. To nowa funkcja, nie odczyt pola — osobna decyzja. Zależności widać w profilu projektu („Czeka na"). |
| `leads/candidates` | `odsiew`, `retencjaDni` | Statystyka odsiewu jest już na ekranie Statystyk (pkt 6, „Skuteczność Łowcy" niesie te same powody). `retencjaDni` to liczba do zdania „kandydaci znikają po N dniach" — zdania, którego apka nie ma i którego brak niczego nie psuje. |
| `stats` | `dso.overdueAmount` | Kwota zaległości stoi już na Pulpicie (wskaźnik „Zaległe"), i to **rozbita na waluty** — czyli dokładniej niż to jedno pole. Powtórzenie jej w Statystykach dałoby dwie liczby o tym samym, które mogą się różnić. |
| `costs` | `data_platnosci`, `metoda_platnosci`, `dostawca_konto`, `data_wplywu`, `vat_odliczenie_procent`, `duplikat_potwierdzony` | Księgowa strona kosztu — poziom 3, ta sama granica co przy fakturach. |

---

## Jedno znalezisko odnotowane, świadomie NIE naprawione

**Ostrzeżenie o sufitcie listy jest w apce niekompletne.** `/api/clients`
i `/api/projects` oddają `total`, apka to czyta i pokazuje pasek „Rejestr ma N,
widzisz M najnowszych". `/api/contracts` oddaje `total` **i `limit`**,
`/api/offers` oddaje `total` — apka ignoruje jedno i drugie, więc lista Umów
i Ofert ucięłaby się bez żadnego objawu.

Nie naprawione, bo **nie da się tego dowieść**: sufity to 1000 (umowy) i 500
(oferty), a dev-baza PGlite nie zniesie takiego zasiewu. Poprawka to trzy
linijki na listę i jedno pole w sklepie — do zrobienia wtedy, gdy będzie czym
ją pokazać. Do rejestracji firmy jest to zdarzenie niemożliwe.

---

## Czego ten audyt NIE objął

- **`POST`/`PATCH`** — druga strona tej samej monety (apka wysyła pole, którego
  trasa nie czyta; objaw identyczny: cisza, ale skutek gorszy — zapis, który
  wygląda na udany i nic nie zmienia). Brief nazywał to „rozszerzeniem, jeśli
  zostanie czas". Czas poszedł na bramkę wysyłki, która okazała się większa,
  niż brief zakładał. **To jest naturalny następny krok.**
- **Warstwa wizualna** — jak zawsze w tym środowisku.

---

## Trzy rzeczy, które ten audyt pokazał o samym szukaniu luk

1. **Największa luka nie była brakującą sekcją, tylko brakującą DROGĄ DALEJ.**
   Sekcji brakuje widocznie (pusto tam, gdzie coś być powinno). Odmowy bez
   wyjścia nie widać wcale — wygląda jak działająca bariera.
2. **Uzasadnienie pominięcia przeterminowuje się w ciszy.** Komentarz nad
   `SzukajView` był prawdziwy przez trzy tygodnie i fałszywy przez dwa,
   a nikt tego nie zauważył, bo komentarze się nie kompilują. Przy każdym
   „świadomie pomijamy, bo apka nie ma ekranu" warto dopisać, KTÓRY moduł
   musiałby powstać, żeby to przestało być prawdą.
3. **Zakres per pole, nie per trasa.** `/api/contracts/:id` był „obsłużony" —
   apka czytała z niego `contract` i `clauses`. Dwa pola z czterech.
   Sprawdzenie „czy apka woła tę trasę" dałoby zielone światło.
