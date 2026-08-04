# Krok 4: porażka jest zdarzeniem jak każde inne

Robimy **krok 4** z `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`. Przeczytaj go w całości —
zwłaszcza „Trzy rzeczy, które ustawiają cały plan" (punkt 3 jest wprost o tym
kroku) oraz **wszystkie trzy sekcje „Co się okazało przy robocie"** (kroki 1, 2
i 3). To są pułapki, które już kosztowały czas — dwie z nich po dwa razy.

Poza tym:
- `CLAUDE.md` — zasady pracy i pułapki środowiska
- `docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`, sekcje **B1, B2, B3, B4** — znaleziska
  z dowodami

## Punkt startu

Ostatni commit `1d421cb` „Plan: krok 3 zamknięty". Repo czyste i wypchnięte.
`tsc` czysto, `npm test` **318/318**, `npm run przejscie`
**68 działa · 0 regresji · 0 pominiętych**.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu (równoległa sesja już raz wchłonęła cudze zmiany).

## Problem jednym zdaniem

Panel zna komplet skutków drogi, która się **udaje**, i ani jednego skutku
drogi, która się **nie udaje**. Akceptacja oferty sama przestawia lead na
„Zamknięte - sukces" (`lib/offerAccept.ts`). Odrzucenie nie robi **nic** — lead
zostaje w „Do kontaktu" z podpowiedzią „Zrób pierwszy ruch", po tym jak oferta
wyszła, została otwarta i wróciła z odmową.

## Co jest do zrobienia

Uwaga na wstępie: **przeszedłem te cztery znaleziska po kodzie, zanim napisałem
ten brief.** Dwa z nich mają inną przyczynę, niż sugeruje plan — czytaj opisy
niżej, nie samą tabelę w planie.

### B1 — odrzucona oferta nie zostawia śladu poza samą ofertą

**To nie jest brakujące wywołanie — to brakujący ADRESAT.** Trasa odrzucenia
(`app/api/offers/[id]/route.ts:144`) **woła** `logClientEvent`. Tyle że:

1. `logClientEvent` (`lib/db.ts:1923`) jest **cichym no-opem, gdy `clientId`
   jest `null`** — a oferta na leadzie, z którego nie zrobiono jeszcze karty
   klienta, nie ma `client_id`. Wtedy zdarzenie nie ląduje **nigdzie**.
2. Nawet gdy `client_id` jest, wpis idzie na oś **klienta**. Lead ma własny log
   (`lead_activity`) i własną kartę, na którą się zagląda — a do `lead_activity`
   **nie pisze ani jedna trasa dokumentowa**. Sprawdzone: pisarzy jest czterech
   i wszyscy to „prawdziwy kontakt" — ręczny wpis (`api/leads/[id]/activity`),
   webhook telefonii, `lib/mailSync.ts` i przejęcie kandydata z Łowcy.

Nie ma bliźniaka `logClientEvent` dla leada. Napisz go (`logLeadActivity`
w `lib/db.ts`, obok tamtego) i wołaj z tych samych miejsc. Dobra wiadomość:
`GET /api/clients/:id` **już dziś scala** `client_events` + `client_activity`
+ `lead_activity` leada, z którego klient powstał (komentarz w `lib/db.ts:1824`)
— więc wpis do `lead_activity` pokaże się w obu miejscach bez drugiej roboty.

**Mapa procesu „2/15" NIE jest osobną usterką.** `LEAD_STATUS_STEP`
(`lib/leads.ts:243`) to czysta funkcja statusu: `"Do kontaktu" → 2`. Mapa mówi
prawdę o statusie, który nikt nie ruszył. Napraw status, mapa naprawi się sama —
nie ruszaj `lib/process.ts`.

Skutek statusowy (lead → „Zamknięte - porażka" albo kontakt za 3 miesiące) to
**propozycja**, zgodnie z planem i granicą z `CLAUDE.md`. Ale **sam wpis do logu
jest automatem** — log to nie zmiana stanu, tylko zapis tego, co się stało.

### B2 — projekt „Zagrożony"/„Zerwany" nie istnieje poza własną kartą

Najtańsze z czterech i jedyne bez pułapki. Pulpit pobiera `SELECT * FROM
projects` (`app/api/hub/today/route.ts:80`), więc kolumnę `zdrowie` **ma już
w ręku** — po prostu nikt z niej nic nie liczy. Sekcja jest bliźniakiem
`dueProjects` (ta sama trasa, linia 182), a w `DashboardHome.tsx` wchodzi obok
„Projekty z minionym terminem".

Drugi objaw: przy zdrowiu „Zerwany" `status` zostaje „W trakcie", więc projekt
liczy się wszędzie jako praca w toku. To propozycja domknięcia, nie automat.

### B3 — karta klienta nie wie o niczym, co się wydarzyło

**Tu jest decyzja do podjęcia, nie usterka do naprawienia — patrz „Do
rozstrzygnięcia" niżej.** `ostatni_kontakt` ma dziś **sześciu** pisarzy
i wszyscy są tej samej natury: ręczny wpis, webhook telefonii, synchronizacja
poczty. Żaden nie jest zdarzeniem dokumentowym — i to jest **obrona**, nie
przeoczenie: wystawienie faktury nie jest rozmową z klientem.

Dwie rzeczy, których NIE ruszaj, bo działają:
- **`status` klienta ma już propozycję** (`oplacony-klient-aktywny`,
  `lib/propozycje.ts`). W drugim przejściu milczała, bo faktura nie była
  **opłacona** — reguła zachowała się poprawnie. Nie „naprawiaj" jej.
- **„3/15" to znów czysta funkcja statusu** (`CLIENT_STATUS_STEP`
  w `lib/clients.ts`), dokładnie jak przy leadzie.

### B4 — nic nie przypomina o niepodpisanym aneksie

**Plan formułuje to mylnie i łatwo tu dopisać regułę, która już istnieje.**
Sprawdzone: „Umowy czekające na podpis" (`staleContracts`,
`app/api/hub/today/route.ts:201`) używa `isContractStale`, które wymaga
`sent_at` — i **nie filtruje po `typ`**. Czyli **wysłany aneks już dziś się
tam pokazuje.**

Aneks nr 2 z drugiego przejścia był **`Szkic`**. Nigdy nie został wysłany. Luka
brzmi więc: *„dokument, który zacząłem i o którym zapomniałem"*, a nie
*„dokument wysłany i niepodpisany"*. Bliźniak istnieje i jest tuż obok:
`draftInvoices` (ta sama trasa, linia 234) — szkice faktur z treścią, starsze
niż dzisiejszy. Przyłóż ten sam kształt do umów i aneksów.

## Do rozstrzygnięcia z właścicielem (zapytaj wprost, na starcie)

- **Które zdarzenia liczą się jako „kontakt"?** Wysłanie oferty i wysłanie
  wezwania to wiadomość, która poszła do klienta — to wygląda na kontakt.
  Wystawienie faktury albo podpisanie umowy w panelu to czynność własna
  właściciela — to raczej nie. Od odpowiedzi zależy, co robi B3 i czy
  `ostatni_kontakt` w ogóle ma się zmieniać automatycznie, czy tylko
  propozycją.
- **Czy „Zerwany" projekt ma domykać się sam?** Plan mówi: propozycja.
  Warto potwierdzić, bo to jedyny z czterech skutków, który zamyka rekord.

## Jak pracować (to się sprawdziło w krokach 1, 2 i 3)

- **Sprawdź, czy mechanizm naprawdę nie istnieje, zanim go napiszesz.** W kroku
  3 dwa z czterech znalezisk to był warunek zawężony do jednego przypadku, nie
  brak mechanizmu. W tym kroku B4 to reguła, która już istnieje, tylko pyta
  o inny stan.
- **„Coś się przy tym ruszyło" to nie dowód, że ruszyło się to, o co chodzi.**
  W kroku 3 podpis umowy zmieniał STATUS projektu, więc `projektPoPodpisieUmowy`
  wyglądało na działające — a termin, o który chodziło, nie ruszył się ani razu.
- **Jedno pole potrafi nieść dwa pytania.** Zanim przestawisz jednolinijkowy
  błąd, sprawdź, czy to samo pole nie odpowiada gdzieś indziej poprawnie.
- **Warunek pisz przez wyliczenie dozwolonego, nie wykluczanie zakazanego.**
- **Propozycje licz z DANYCH, log pisz przy ZDARZENIU.** To są dwie różne
  zasady i łatwo je pomylić. Reguła propozycji jest zapytaniem o stan bazy
  (`lib/propozycje.ts`, nagłówek pliku wyjaśnia, dlaczego) — dzięki temu działa
  wstecz i żadna droga jej nie omija. Log jest odwrotnie: zapisu „klient otworzył
  ofertę" nie da się odtworzyć po fakcie, więc musi powstać w chwili zdarzenia,
  przez wspólny pomocnik wołany ze wszystkich dróg.
- **Sonda jest kodem i kłamie tak samo jak panel.** W kroku 3 dwa razy pod rząd
  czerwień pochodziła z sondy: raz skrót przez `POST /api/contracts` (nie
  zapisuje `project_id` ani `client_id` z body — dopinaj `PATCH`-em), raz zły
  klucz odpowiedzi (`GET /api/clients/:id` oddaje oś czasu jako **`feed`**, nie
  `events`). Zanim zaczniesz naprawiać panel, sprawdź, czy sonda pyta o to,
  o co myślisz.
- **Dev-baza żyje między przebiegami sondy** (i kasuje się przy każdym
  przeładowaniu modułów serwera). Sprawdzenia typu „reguła umilkła" zawężaj do
  rekordów bieżącego przebiegu — inaczej pierwszy bieg jest zielony, a każdy
  następny czerwony bez powodu.
- **Ekran, który świeci zawsze, uczy tylko go ignorować.** Każda nowa
  propozycja i reguła potrzebuje warunku, który odsiewa normalną pracę.
- **Dowodem jest to, co widać w panelu i w danych**, nie to, że kod wygląda
  dobrze. Wydruki i Pulpit renderują się po stronie klienta, więc `curl` na HTML
  nic nie pokaże — otwórz stronę w podglądzie i czytaj `get_page_text`.
- **W tym podglądzie `requestAnimationFrame` daje 0 klatek** (karta jest
  `hidden`), więc menu i modale mają `opacity: 0`, choć są otwarte i klikalne.
  Sprawdzaj przez `innerText` / `aria-*`, nie przez zrzut ekranu.
- Po każdej paczce zmian: `npx tsc --noEmit -p tsconfig.json`, `npm test`,
  `npm run przejscie`. Ostatnie musi pokazać **0 regresji i 0 pominiętych**.

## Czego NIE robić

- Nie bierz się przy okazji za krok 5 — w szczególności **nie dopisuj drogi
  porażki do `scripts/przejscie/przejscie.ts`**. To jest jawnie krok 5.
- Nie zamieniaj istniejących automatów na propozycje bez pytania (granica
  z `CLAUDE.md`, sekcja „Panel proponuje, właściciel zatwierdza").
- Nie ruszaj `lib/process.ts` ani map `*_STATUS_STEP` — „2/15" i „3/15" to
  objawy statusu, nie usterki mapy.
- Nie dokładaj modelu AI. Propozycje to deterministyczne reguły SQL.
- C1 (klient odrzuca ofertę ze swojej strony) **nie należy do tego kroku** —
  jest w kroku 5, bo to nowa powierzchnia dla klienta, inny rodzaj ryzyka.

## Na koniec

Zaktualizuj tabelę w `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` (krok 4 → ✅ z numerem
commita) i dopisz sekcję „Co się okazało przy robocie", tak jak przy krokach
1–3 — zwłaszcza to, co Cię zaskoczyło. Dopisz też sekcję do `HUB_SETUP.md`.

Podaj polecenia do commita i pusha oraz skasuj ten plik (`PROMPT-KROK-4.md`).
Napisz też brief na krok 5 — przy kroku 3 zabrakło go i trzeba było wracać.

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
