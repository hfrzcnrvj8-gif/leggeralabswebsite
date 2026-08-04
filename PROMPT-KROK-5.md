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

Ostatni commit: krok 4 (`KROK4`). Repo czyste i wypchnięte.
`tsc` czysto, `npm test` **336/336**, `npm run przejscie`
**68 działa · 0 regresji · 0 pominiętych**.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu (równoległa sesja już raz wchłonęła cudze zmiany).

## Problem jednym zdaniem

Zostały drobiazgi wokół **odrzuconej oferty i jej nowej wersji** — plus jedyna
rzecz w tym planie, która daje klientowi nową powierzchnię (C1) — a przede
wszystkim: **trzecie przejście na sucho nie ma czego uruchomić**, bo harness zna
tylko drogę, która się udaje.

## Co jest do zrobienia

Uwaga: **nie przeszedłem tych sześciu znalezisk po kodzie przed napisaniem tego
briefu** (w odróżnieniu od briefu na krok 4). Traktuj opisy niżej jako punkt
wyjścia, nie jako ustalenia — pierwsze, co zrób, to sprawdź w kodzie, czy każde
z nich w ogóle jeszcze jest. Kroki 1–4 zamknęły po drodze rzeczy, których nie
było w ich zakresie.

### C1 — klient odrzuca ofertę ze swojej strony

**Największy kawałek i jedyny, który daje klientowi nową powierzchnię** —
dlatego został wyjęty z kroku 1 do osobnego kroku (inny rodzaj ryzyka).

Decyzja właściciela z 2026-08-04 (pkt 3 w planie): przycisk „Rezygnujemy" na
publicznej stronie oferty, lista powodów **ta sama co w panelu**
(`OFFER_REJECT_REASONS` w `lib/offers.ts` — uwaga: to ETYKIETY, nie slugi;
sonda kroku 4 się na tym przejechała) plus pole na komentarz. Zapis w te same
kolumny (`powod_odrzucenia`, `komentarz_odrzucenia`, `odrzucona_at`).

Trzy rzeczy, o których łatwo zapomnieć, a wszystkie już istnieją i mają zadziałać
same, jeśli zapiszesz to w te same kolumny:
- **oś klienta i log leada** — od kroku 4 idzie to jednym wywołaniem
  `logZdarzenieDokumentu(sql, celDokumentu(offer), "offer_rejected", …)`,
- **propozycja `odrzucona-oferta-domyka-leada`** policzy się sama, bo reguły są
  liczone z DANYCH, nie zapisywane przy zdarzeniu,
- **hamulec** (`lib/rateLimit.ts`) — to jest trasa publiczna.

Uwaga na `ocenAkceptacje()` z kroku 1: strona i serwer mają liczyć to samo,
a publiczny GET filtruje pola BIAŁĄ LISTĄ (`OFFER_PUBLIC_FIELDS`, `ZAWSZE_ZYWE`
w `lib/publicFields.ts`). Dokładając cokolwiek, co strona ma pokazać — sprawdź
obie listy. Ta pułapka wróciła w kroku 1 i w kroku 2.

### A3 — nowa wersja przepisuje poprzedniej status `Odrzucona → Wygasła`

Powód odrzucenia zostaje w bazie, ale status, po którym liczy się skuteczność
i filtruje listę, mówi co innego. Do rozważenia osobny stan `Zastąpiona`
zamiast pożyczania „Wygasłej".

**Zanim dołożysz status:** `OFFER_STATUSES` ma dziś pięć wartości i każdy nowy
dotyka mapy koloru (`lib/kolorStanu.ts`), filtra, wagi w ważonym pipelinie
(`OFFER_STATUS_WEIGHT`), `CLOSED_OFFER_STATUSES`, `ocenAkceptacje()` **oraz
bliźniaczej mapy w apce iOS**. Pamięć projektu: „rozjazd koloru wrócił DRUGI
raz". Alternatywa bez nowego statusu: zostawić „Wygasła" i liczyć „zastąpiona"
z `superseded_at`, które i tak już jest — sprawdź, czy to nie wystarczy, ZANIM
zaczniesz rozpychać wyliczenie.

### D2 — nowa wersja gubi połowę treści

Zeruje `wazna_do`, `czas_realizacji_tygodnie` i cały blok ROI. Przenieść je
razem z resztą (`app/api/offers/[id]/version/route.ts`), a w edytorze wersji 2
pokazać powód odrzucenia poprzedniej i odsyłacz do niej.

Uwaga: `czas_realizacji_tygodnie` **niesie termin na umowę i na projekt**
(krok 3, A6), więc jego zgubienie to nie kosmetyka — to termin, który potem
wchodzi do dokumentu.

### D1 — kolejność akcji na ofercie

Na szkicu i na ofercie **odrzuconej** głównym przyciskiem jest „Akceptuj ofertę".
Wyróżnić to, co jest następnym krokiem w danym stanie. `.btn-primary` to
jedno CTA na widok (`CLAUDE.md`) — więc to nie jest „dodaj drugi przycisk",
tylko „przenieś wyróżnienie".

### D5 — komunikat hamulca

„Zbyt wiele prób. Spróbuj ponownie za 60 min." ma mówić klientowi, CO ZROBIĆ.
Do rozstrzygnięcia z właścicielem: czy próby odrzucone walidacją (pusty podpis,
brak zgody) mają się w ogóle liczyć do limitu — dziś prawdopodobnie tak, a to
znaczy, że klient z literówką sam sobie zamyka drzwi na godzinę.

### D6 — `aria-pressed` na chipach powodu odrzucenia

Najmniejsze. Chip jest przyciskiem-przełącznikiem, a czytnik ekranu nie wie,
który jest wybrany.

### Harness — droga porażki w `scripts/przejscie/przejscie.ts`

**To jest właściwy powód, dla którego ten krok istnieje.** Dopisać drugą drogę:
odrzucenie oferty, nowa wersja, dwa aneksy, zdrowie projektu, eskalacja
windykacji — tak samo jak `npm run przejscie` powstał po pierwszym przejściu,
żeby trzecie nie musiało sprawdzać tego samego ręcznie.

Sonda kroku 4 (napisana i skasowana) sprawdzała 27 rzeczy i jest dobrym
szkieletem — jej zawartość opisuje `HUB_SETUP.md` → „Krok 4 … → Sprawdzenie".
Trzy rzeczy z niej, które warto przenieść co do joty:
1. **log leada po odrzuceniu** ma pięć wpisów, w tym `offer_rejected` z powodem,
2. **oś klienta pokazuje odrzucenie DOKŁADNIE raz** (regresja tu byłaby cicha —
   duble wyglądają jak „bogatsza historia"),
3. **reguła MILCZY**, gdy lead ma żywą ofertę / umówione przypomnienie.

Pamiętaj o trzech stanach harnessu (`DZIAŁA / REGRESJA / ZNANA LUKA /
NAPRAWIONE`) — nowe sprawdzenia dla rzeczy jeszcze nienaprawionych oznaczaj
jako lukę z numerem, nie jako regresję.

## Do rozstrzygnięcia z właścicielem (zapytaj wprost, na starcie)

- **Czy oferta odrzucona przez klienta ma go o czymś poinformować?** Dziś po
  akceptacji idzie mail potwierdzający. Po odrzuceniu przez klienta — cisza,
  czy jedno zdanie „dziękujemy za odpowiedź"? To wychodzi do klienta, więc
  decyzja jest jego.
- **A3: nowy status `Zastąpiona` czy liczenie z `superseded_at`?** Pokaż koszt
  obu (nowy status dotyka też apki iOS) i poproś o wybór.
- **D5: czy nieudana walidacja ma liczyć się do hamulca?**

## Jak pracować (to się sprawdziło w krokach 1–4)

- **Sprawdź, czy mechanizm naprawdę nie istnieje, zanim go napiszesz.** W kroku
  3 dwa z czterech znalezisk to był warunek zawężony do jednego przypadku,
  a w kroku 4 B4 okazało się regułą, która już istnieje, tylko pyta o inny stan.
- **„Coś się przy tym ruszyło" to nie dowód, że ruszyło się to, o co chodzi.**
- **Jedno pole potrafi nieść dwa pytania** (krok 3, A7) i jedna funkcja potrafi
  odpowiadać na dwa różne (krok 4: `CLOSED_PROJECT_STATUSES` znaczyło naraz
  „zamknięte" i „nikt nad tym nie pracuje"). Zanim rozszerzysz warunek, sprawdź,
  ilu pytaniom służy dzisiaj.
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
  godziny na dobę. Jeśli dokładasz arytmetykę dat — dopisz test na DOSŁOWNYCH
  datach przechodzących przez 25.10.
- **Dev-baza żyje między przebiegami sondy** (i kasuje się przy przeładowaniu
  modułów serwera). Sprawdzenia typu „reguła umilkła" zawężaj do rekordów
  bieżącego przebiegu.
- **Ekran, który świeci zawsze, uczy tylko go ignorować.** Każda nowa reguła
  potrzebuje warunku, który odsiewa normalną pracę.
- **Dowodem jest to, co widać w panelu i w danych**, nie to, że kod wygląda
  dobrze. Wydruki i Pulpit renderują się po stronie klienta, więc `curl` na HTML
  nic nie pokaże — otwórz stronę w podglądzie i czytaj przez `innerText`.
- **W tym podglądzie `requestAnimationFrame` daje 0 klatek** (karta jest
  `hidden`), więc menu i modale mają `opacity: 0`, choć są otwarte i klikalne.
  Sprawdzaj przez `innerText` / `aria-*`, nie przez zrzut ekranu.
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

## Na koniec

Zaktualizuj tabelę w `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` (krok 5 → ✅ z numerem
commita) i dopisz sekcję „Co się okazało przy robocie", tak jak przy krokach
1–4. Dopisz też sekcję do `HUB_SETUP.md`.

**To ostatni krok tego planu.** Napisz krótkie podsumowanie całości: co zamknęły
cztery brakujące mechanizmy, co zostało otwarte (m.in. **A5 z PIERWSZEGO
przejścia** — „ZLECENIODAWCA / WYKONAWCA", jedna rubryka dwie role — oraz
warstwa **wizualna**, świadomie niesprawdzona, bo `rAF` w tym środowisku nie
działa) i co powinno być trzecim przejściem na sucho.

Podaj polecenia do commita i pusha oraz skasuj ten plik (`PROMPT-KROK-5.md`).

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
