# Krok 5: drobiazgi i harness na drogę porażki

Robimy **krok 5** — ostatni z `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`. Przeczytaj go
w całości, a zwłaszcza **wszystkie cztery sekcje „Co się okazało przy robocie"**
(kroki 1–4). To są pułapki, które już kosztowały czas — trzy z nich po dwa razy.

Poza tym:
- `CLAUDE.md` — zasady pracy i pułapki środowiska
- `docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`, sekcje **A3, C1, D1, D2, D5, D6**
- `HUB_SETUP.md` → „Krok 4 planu po drugim przejściu" (co dokładnie stoi
  w kodzie po ostatnim kroku)

## Punkt startu

Ostatni commit `4645dd2` „Plan: krok 4 zamknięty" (sam krok 4 to `41ae95c`).
Repo czyste i wypchnięte. `tsc` czysto, `npm test` **336/336**,
`npm run przejscie` **68 działa · 0 regresji · 0 pominiętych**.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu (równoległa sesja już raz wchłonęła cudze zmiany).

## Problem jednym zdaniem

Zostały drobiazgi wokół **odrzuconej oferty i jej nowej wersji** — plus jedyna
rzecz w tym planie, która daje klientowi nową powierzchnię (C1) — a przede
wszystkim: **trzecie przejście na sucho nie ma czego uruchomić**, bo harness zna
tylko drogę, która się udaje.

## Co jest do zrobienia

Uwaga na wstępie: **przeszedłem te sześć znalezisk po kodzie, zanim napisałem
ten brief.** Wszystkie sześć nadal jest — ale trzy z nich mają inny kształt, niż
sugeruje plan, a jedno zderza się z decyzją, którą kod już podjął i uzasadnił
w komentarzu. Czytaj opisy niżej, nie samą tabelę w planie.

### C1 — klient odrzuca ofertę ze swojej strony

**Największy kawałek i jedyny, który daje klientowi nową powierzchnię** —
dlatego został wyjęty z kroku 1 do osobnego kroku (inny rodzaj ryzyka).

Dobra wiadomość: **cały szkielet już stoi i nie trzeba go wymyślać.**
`app/api/offers/public/[token]/comment/route.ts` („poproszę o zmianę") to
niemal gotowy wzorzec nowej trasy — hamulec, sprawdzenie unieważnionego linku,
`notify()`, `logZdarzenieDokumentu`. Skopiuj jego kształt, nie wymyślaj własnego.

Po stronie strony klienta (`app/[lang]/admin/offers/[id]/print/OfferPrint.tsx`)
oba istniejące bloki akcji siedzą pod jednym warunkiem — `ocena.mozna`
z `ocenAkceptacje(offer)` (krok 1) — i całość jest w `{token && (…)}`, żeby
podgląd w panelu nie pokazywał przycisków klienta. Nowy przycisk ma trafić
dokładnie tam, pod ten sam warunek, i mieć teksty we wszystkich trzech językach
(`t.acceptButton` ma bliźniaki `pl/en/de` w tym samym pliku).

Lista powodów: `OFFER_REJECT_REASONS` w `lib/offers.ts` — **to są ETYKIETY
(„Za drogo"), nie slugi**. Sonda kroku 4 wysłała `"za-drogo"`, trasa słusznie
odrzuciła wartość i zapisała sam komentarz, a czerwień w sondzie wyglądała jak
usterka panelu. Zapis idzie w te same kolumny co odrzucenie z panelu
(`powod_odrzucenia`, `komentarz_odrzucenia`, `odrzucona_at`).

**Trzy rzeczy zadziałają SAME, jeśli zapiszesz to w te same kolumny** — i to
jest test, czy zrobiłeś to dobrze:
1. oś klienta i log leada — jedno wywołanie
   `logZdarzenieDokumentu(sql, celDokumentu(offer), "offer_rejected", …)`,
2. propozycja `odrzucona-oferta-domyka-leada` policzy się sama, bo reguły są
   liczone z DANYCH, nie zapisywane przy zdarzeniu,
3. `ocenAkceptacje()` od razu zablokuje akceptację tym samym linkiem.

Pułapka, która wróciła w kroku 1 i w kroku 2: publiczny GET filtruje pola
**białą listą** (`OFFER_PUBLIC_FIELDS`, `ZAWSZE_ZYWE` w `lib/publicFields.ts`).
Jeśli strona ma cokolwiek pokazać po odrzuceniu, sprawdź obie listy.

### A3 — kod ma tu SWOJE zdanie i trzeba je najpierw przeczytać

**To nie jest przeoczenie.** `app/api/offers/[id]/version/route.ts` ustawia
poprzedniczce `status = 'Wygasła'` z jawnym uzasadnieniem w komentarzu:

> Świadomie NIE „Odrzucona" — nikt jej nie odrzucił, została zastąpiona,
> a wrzucenie tego do statystyki przegranych fałszowałoby powody porażek.

Ten argument jest sensowny i dotyczy **oferty, która nie była odrzucona**.
Problem jest węższy, niż mówi plan: ten `UPDATE` jest **bezwarunkowy**, więc
przykrywa też ofertę, którą klient NAPRAWDĘ odrzucił. Dwie różne sytuacje
dostają jeden status — to znowu „jedno pole niesie dwa pytania" (krok 3, A7):
*dlaczego przestała obowiązywać* kontra *czy klient powiedział nie*.

Zanim dołożysz status `Zastąpiona`: `superseded_at` **już istnieje i już jest
ustawiane**. Sprawdź, czy nie wystarczy przestać nadpisywać `Odrzucona` (czyli
zawęzić `UPDATE` do ofert nieodrzuconych) i liczyć „zastąpiona" z tej kolumny.
Nowa wartość w `OFFER_STATUSES` dotyka mapy koloru (`lib/kolorStanu.ts`),
filtra, wagi w ważonym pipelinie, `CLOSED_OFFER_STATUSES`, `ocenAkceptacje()`
**oraz bliźniaczej mapy w apce iOS** — pamięć projektu: „rozjazd koloru wrócił
DRUGI raz". To jest decyzja właściciela, nie Twoja (patrz niżej).

### D2 — nowa wersja gubi cztery pola, nie trzy

Sprawdzone w `INSERT INTO offers` w `version/route.ts`. Przenoszone są:
`tytul, lead_id, client_id, klient_*, jezyk, waluta, uwagi, parent_offer_id,
wersja` plus pozycje i sekcje. **Nie są przenoszone:** `wazna_do`,
`czas_realizacji_tygodnie`, `roi_godziny`, `roi_stawka`.

`czas_realizacji_tygodnie` to **nie kosmetyka** — od kroku 3 (A6) niesie termin,
który wchodzi na UMOWĘ i na PROJEKT przy podpisie. Zgubiony tutaj znika
z dokumentu, nie z podglądu.

Drugie: `parent_offer_id` **jest zapisywane**, więc dane na odsyłacz do wersji 1
i na powód jej odrzucenia już są — brakuje wyłącznie użycia ich w edytorze.

### D1 — przycisk akceptacji nie pyta o stan oferty

Sprawdzone w `OfferEditor.tsx`: gałąź rozdziela się **wyłącznie** po
`accepted` (`status === 'Zaakceptowana'`). Na szkicu i na ofercie **odrzuconej**
głównym `.btn-primary` jest „Akceptuj ofertę" — dokładnie jak w znalezisku.

Przy okazji, i to jest osobna rzecz: karta „WAŻNOŚĆ" liczy „Wygasa za N dni"
pod warunkiem `offer.wazna_do && !expired` — **bez pytania o `ocenAkceptacje()`**.
Krok 1 naprawił to na stronie KLIENTA (`OfferPrint`), ale edytor w panelu dalej
odlicza na ofercie odrzuconej i zastąpionej. Funkcja jest, tylko nie jest tu
wołana — ten sam kształt co B4 w kroku 4.

`.btn-primary` to jedno CTA na widok (`CLAUDE.md`), więc to nie jest „dodaj
drugi przycisk", tylko „przenieś wyróżnienie" zależnie od stanu.

### D5 — mechanizm już istnieje i jest wołany w JEDNYM miejscu

To najciekawsze z sześciu. Porównaj dwa hamulce:

| | logowanie | dokumenty publiczne |
|---|---|---|
| co liczy | tylko **nieudane** próby | **każde** żądanie |
| po sukcesie | `wyczyscPoUdanej()` zeruje licznik | nic |

`wyczyscPoUdanej` (`lib/rateLimit.ts`) istnieje i jest wołane **wyłącznie**
w `app/api/admin/login/route.ts`. Cztery trasy publiczne — akceptacja oferty,
prośba o zmianę, podpis umowy, formularz opinii — wołają `odnotujProbe`
**przed** walidacją, bezwarunkowo, i nigdy nie czyszczą.

Skutek: próg to **5 żądań na 60 minut z jednego adresu, wspólny dla wszystkich
dokumentów**. Klient, który trzy razy pomyli się przy wpisywaniu nazwiska, ma
dwie próby na podpisanie umowy — a komunikat („Zbyt wiele prób. Spróbuj
ponownie za 60 min.") nie mówi mu, co zrobić.

### D6 — jedno miejsce, nie dwa

`app/[lang]/admin/RejectDialog.tsx` — chipy powodu mają zaznaczenie wyłącznie
klasą, bez `aria-pressed`. `app/[lang]/admin/offers/RejectDialog.tsx` to sam
re-eksport, więc poprawka w jednym pliku obsługuje Oferty i Umowy naraz.
Najmniejsze z sześciu.

### Harness — droga porażki w `scripts/przejscie/przejscie.ts`

**To jest właściwy powód, dla którego ten krok istnieje.** Dopisać drugą drogę:
odrzucenie oferty, nowa wersja, dwa aneksy, zdrowie projektu, eskalacja
windykacji — tak samo jak `npm run przejscie` powstał po pierwszym przejściu,
żeby trzecie nie musiało sprawdzać tego samego ręcznie.

Sonda kroku 4 (napisana i skasowana) sprawdzała 27 rzeczy; jej wynik opisuje
`HUB_SETUP.md` → „Krok 4 … → Sprawdzenie". Trzy sprawdzenia z niej warto
przenieść co do joty:
1. **log leada po odrzuceniu** ma pięć wpisów, w tym `offer_rejected` z powodem,
2. **oś klienta pokazuje odrzucenie DOKŁADNIE raz** — regresja byłaby tu cicha,
   bo duble wyglądają jak „bogatsza historia",
3. **reguła MILCZY**, gdy lead ma żywą ofertę albo umówione przypomnienie.

Pamiętaj o czterech stanach harnessu (`DZIAŁA / REGRESJA / ZNANA LUKA /
NAPRAWIONE`) — sprawdzenia rzeczy jeszcze nienaprawionych oznaczaj jako lukę
z numerem, nie jako regresję.

## Do rozstrzygnięcia z właścicielem (zapytaj wprost, na starcie)

1. **Czy klient, który sam odrzuci ofertę, ma dostać jakąś wiadomość?** Po
   akceptacji idzie dziś mail potwierdzający. Po odrzuceniu — cisza czy jedno
   zdanie „dziękujemy za odpowiedź"? To wychodzi do klienta, więc decyzja
   należy do właściciela.
2. **A3: zawęzić `UPDATE` czy dołożyć status `Zastąpiona`?** Pokaż oba koszty —
   zawężenie to jedna linijka, nowy status dotyka też apki iOS — i poproś
   o wybór. **Nie decyduj sam**, kod ma tu spisane zdanie i jest ono sensowne.
3. **D5: czy nieudana walidacja ma liczyć się do hamulca, i jaki ma być próg?**
   Dziś 5 żądań na godzinę wspólnie dla wszystkich dokumentów z jednego adresu.
   Zaproponuj: liczyć tylko nieudane + `wyczyscPoUdanej` po sukcesie, jak przy
   logowaniu.

## Jak pracować (to się sprawdziło w krokach 1–4)

- **Sprawdź, czy mechanizm naprawdę nie istnieje, zanim go napiszesz.** W tym
  kroku to dotyczy trzech znalezisk naraz: `wyczyscPoUdanej` (D5),
  `ocenAkceptacje` (D1, druga część) i `superseded_at` (A3) — wszystkie już są.
- **„Coś się przy tym ruszyło" to nie dowód, że ruszyło się to, o co chodzi.**
- **Jedno pole potrafi nieść dwa pytania** (krok 3, A7; w tym kroku — A3)
  i jedna funkcja potrafi odpowiadać na dwa różne (krok 4:
  `CLOSED_PROJECT_STATUSES` znaczyło naraz „zamknięte" i „nikt nad tym nie
  pracuje"). Zanim rozszerzysz warunek, sprawdź, ilu pytaniom służy dzisiaj.
- **Warunek pisz przez wyliczenie dozwolonego, nie wykluczanie zakazanego.**
- **Propozycje licz z DANYCH, log pisz przy ZDARZENIU.** Od kroku 4 log idzie
  jednym pomocnikiem `logZdarzenieDokumentu` na obie osie naraz — dokładając
  nową trasę dokumentową, użyj jego, nie `logClientEvent`.
- **Sonda jest kodem i kłamie tak samo jak panel.** W kroku 3 dwa razy, w kroku
  4 dwa razy (`powod_odrzucenia` jako slug zamiast etykiety; `related_id`
  wymagane od wpisu, który nie dotyczy dokumentu). Zanim zaczniesz naprawiać
  panel, sprawdź, czy sonda pyta o to, o co myślisz.
- **Uruchom sondę też PO POŁUDNIU.** Krok 4 znalazł dwa błędy dat wyłącznie
  dlatego, że przejście poszło o 00:40: dzień z `slice(0, 10)` na znaczniku UTC
  i `addDaysISO` gubiące dobę na zmianie czasu. Oba były niewidoczne przez 22
  godziny na dobę. Dokładając arytmetykę dat — dopisz test na DOSŁOWNYCH datach
  przechodzących przez 25.10.
- **Dev-baza żyje między przebiegami sondy** (i kasuje się przy przeładowaniu
  modułów serwera). Sprawdzenia typu „reguła umilkła" zawężaj do rekordów
  bieżącego przebiegu. **Uwaga w tym kroku:** hamulec (D5) też trzyma stan
  w bazie — po sondzie hamulca kolejne żądania publiczne dostaną 429, więc albo
  testuj go na końcu, albo licz się z tym przy kolejnym przebiegu.
- **Ekran, który świeci zawsze, uczy tylko go ignorować.**
- **Dowodem jest to, co widać w panelu i w danych**, nie to, że kod wygląda
  dobrze. Wydruki i Pulpit renderują się po stronie klienta, więc `curl` na HTML
  nic nie pokaże — otwórz stronę w podglądzie i czytaj przez `innerText`.
- **W tym podglądzie `requestAnimationFrame` daje 0 klatek** (karta jest
  `hidden`), więc menu i modale mają `opacity: 0`, choć są otwarte i klikalne.
  Sprawdzaj przez `innerText` / `aria-*`, nie przez zrzut ekranu. Przy D6 to
  akurat wygodne: `aria-pressed` zmierzysz wprost.
- Po każdej paczce zmian: `npx tsc --noEmit -p tsconfig.json`, `npm test`,
  `npm run przejscie`. Ostatnie musi pokazać **0 regresji i 0 pominiętych**.

## Czego NIE robić

- Nie zamieniaj istniejących automatów na propozycje bez pytania (granica
  z `CLAUDE.md`, „Panel proponuje, właściciel zatwierdza"). W szczególności
  `ostatni_kontakt` po wysyłce jest AUTOMATEM od kroku 4 — to decyzja
  właściciela, nie przeoczenie.
- Nie ruszaj `lib/process.ts` ani map `*_STATUS_STEP` — kroki procesu są
  funkcją statusu i naprawiają się same.
- Nie dokładaj modelu AI. Propozycje to deterministyczne reguły SQL.
- Nie rozpychaj `OFFER_STATUSES` bez decyzji właściciela (patrz A3).
- Nie rozluźniaj hamulca „bo przeszkadza w sondzie" — to jest zabezpieczenie
  publicznych tras (Audyt 1). Zmiana ma wynikać z decyzji właściciela z pkt 3,
  nie z wygody testowania.

## Na koniec

Zaktualizuj tabelę w `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` (krok 5 → ✅ z numerem
commita) i dopisz sekcję „Co się okazało przy robocie", tak jak przy krokach
1–4. Dopisz też sekcję do `HUB_SETUP.md`.

**To ostatni krok tego planu.** Napisz krótkie podsumowanie całości: co zamknęły
cztery brakujące mechanizmy, co zostało otwarte i co powinno być trzecim
przejściem na sucho. Świadomie otwarte zostają co najmniej:

- **A5 z PIERWSZEGO przejścia** — na wydruku umowy rubryka
  „ZLECENIODAWCA / WYKONAWCA" jest jedna, a role dwie,
- **warstwa wizualna** — drugie przejście jej nie sprawdzało, bo w tym
  środowisku `rAF` daje zero klatek; wymaga prawdziwej przeglądarki,
- **apka iOS** — nie pokazuje drugiej akcji propozycji (krok 4), dwóch nowych
  sekcji Pulpitu (krok 4), rozwijacza windykacji (krok 2) ani rubryki z aneksem
  (krok 3). Trasy oddają komplet; to jedna spójna paczka roboty po stronie apki
  i warto ją spisać jako osobny brief.

Podaj polecenia do commita i pusha oraz skasuj ten plik (`PROMPT-KROK-5.md`).

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
