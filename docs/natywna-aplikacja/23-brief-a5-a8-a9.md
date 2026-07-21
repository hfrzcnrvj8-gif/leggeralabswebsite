# Brief: trzy ostatnie pozycje audytu apki (A5, A8, A9)

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Spisany 2026-07-21, zaraz po zamknięciu ustalenia A1. **Osobny czat.**
> Stan wyjściowy: commit `4e4e0a5` (po dwóch furtkach DEBUG dopisanych do
> weryfikacji A1). Symulator: iPhone 17, `D97247DC-8E70-4E2E-AA90-646727C68398`
> (booted na koniec poprzedniej sesji — może już nie żyć, zweryfikuj).
>
> A1 był **ostatnim otwartym długiem** z audytu Fazy 11½/13.4. A5, A8, A9 nie
> są usterkami — to świadomie odłożony, nazwany zakres (audyt: „każde to
> własna paczka pracy, patrz Część B, gdzie mają wyceny"). Właściciel
> zdecydował: jeden moduł, wszystkie trzy naraz, jeden nowy czat.

## Skąd to się wzięło

`docs/natywna-aplikacja/08-wynik-audytu-apki.md` (Faza 11½, 2026-07-19/20),
sekcje A5/A8/A9 (linie 72–121) i Część B (linia 227+, wyceny). Stan
zmierzony poniżej jest **świeży** (sprawdzony dziś, nie przepisany z audytu)
— audyt ma prawie rok sesji różnicy i część rzeczy się ruszyła (np. A8
częściowo zamknięte przy okazji zupełnie innego zgłoszenia).

## A5 — Umowy: sygnał bez akcji

**Problem, zmierzony dziś:** `PulpitView.swift:376-387` (`sekcjaUmow`) pokazuje
sekcję „Umowy bez odpowiedzi" — listę umów/NDA czekających na klienta, ale
KAŻDY wiersz to zwykły `wiersz(...)`, nie `NavigationLink`. Nieklikalne.
Apka nie woła `/api/contracts` ani razu (grep: zero wystąpień poza tym
jednym odczytem agregatu Pulpitu). Do tego bramka umowy (409, `AppStore.
zmienPolaProjektu`) blokuje zmianę statusu projektu z komunikatem po polsku
w `odmowaBramki` — apka mówi „nie możesz, bo brakuje umowy" i nie daje
**żadnej** drogi, żeby ten brak naprawić z telefonu.

**Co jest gotowe po stronie panelu** (sprawdzone dziś, `app/api/contracts/`):
- `GET /api/contracts` — lista (typ `umowa`/`nda`, status, klient, daty).
- `GET /[id]`, `PATCH /[id]` — szczegóły + edycja pól zmiennych.
- `POST /[id]/send` — wysyłka do klienta (mailem, jak oferty/faktury).
- `POST /[id]/accept` — ręczne oznaczenie akceptacji (np. podpis papierowy).
- `GET/POST /public/[token]` — publiczny podgląd + akceptacja przez klienta
  (ten sam wzorzec co publiczny link faktury/oferty).

**Precedens z tego samego projektu**: Faktury i Oferty są w apce **poziomem
2** — podgląd + proste akcje (opłacona/wyślij/przypomnienie), **edycja
pozycji zostaje poziomem 3** (przy biurku). `Finanse.swift` komentuje to
wprost przy każdym modelu. Umowy pasują do dokładnie tego samego wzorca:
lista + podgląd (tylko do odczytu) + „Wyślij" + widoczny status akceptacji.
Tworzenie umowy z oferty, edycja klauzul, generowanie PDF — zostają przy
biurku, tak jak reszta poziomu 3.

**Otwarta decyzja na start tamtego czatu**: czy iść dokładnie tym wzorcem
(Umowy jako trzeci moduł „poziomu 2", analogiczny do Faktur/Ofert) — to jest
moja rekomendacja, bo domyka lukę „bramka bez wyjścia" najmniejszym możliwym
zakresem — czy właściciel chce czegoś węższego (np. sam podgląd statusu bez
wysyłki) albo szerszego. **Nie zakładaj odpowiedzi, zapytaj wprost.**

Szacunek audytu: **1 sesja**. Kształt pracy (jeśli poziom 2): `Contract`
model w rdzeniu (bliźniak `Oferta`/`Faktura`), `APIClient.pobierzUmowy/
pobierzUmowe/wyslijUmowe`, `AppStore` odpowiedniki, `UmowyView` (lista +
szczegóły) wpięty pod „Więcej", i — kluczowe — `sekcjaUmow` na Pulpicie
dostaje `NavigationLink` zamiast gołego wiersza.

## A8 — dane nie odświeżają się po długim czasie w tle

**Stan zmierzony dziś** (`LeggeraHub/LeggeraHubApp.swift:193-224`,
`onChange(of: faza)` przy `.active`) — **częściowo już zamknięte**, ale nie
przez ten moduł: cztery rzeczy się dziś dzieją, nie trzy jak w audycie:

1. `blokada.scenaNaWierzchu()` (Face ID),
2. `odbierzOdczyt()` (odczyt OCR dokończony w tle),
3. `Task { await odswiezKolejke() }` (kolejka wysyłki maila),
4. `Task { await store.odswiezStoper() }` — **dopisane 2026-07-21**, ale z
   zupełnie innego powodu: zgłoszenie „po Stop na Wyspie apka nadal pokazuje
   chodzący stoper". To jest DOKŁADNIE wzorzec, o którym audyt A8 mówił
   („dołożenie czwartej to jedna linia w miejscu, które już jest") — tyle że
   dołożona czwarta linia naprawiła tylko stoper, nie resztę.

**Co nadal jest nieaktualne po powrocie z wielogodzinnego tła**: Pulpit
(agregat `/api/hub/today` — ma wprawdzie `pulpitNieaktualny`, ale ta flaga
podnosi się tylko po AKCJI w apce, nie po prostu z upływem czasu), Leady,
Klienci, Poczta, Projekty, Faktury, Oferty — żadna z tych list nie ma
mechanizmu „za stara, odśwież przy powrocie". Telefon leżący w kieszeni cały
dzień pokaże po odblokowaniu wczorajszy stan wszystkiego oprócz stopera, bez
żadnego znaku, że dane są nieaktualne.

**Otwarta decyzja**: co dokładnie ma się odświeżać i jak agresywnie.
Kandydaci do przemyślenia na starcie tamtego czatu:
- Próg czasowy (np. „jeśli w tle dłużej niż N minut, odśwież aktywną
  zakładkę") — potrzebuje znacznika czasu wyjścia w tło, którego dziś nie ma.
- Odświeżenie WYŁĄCZNIE aktywnej zakładki (tańsze, ale reszta i tak będzie
  nieaktualna przy przełączeniu) vs. oznaczenie WSZYSTKICH zasobów jako
  `pulpitNieaktualny`-podobnie (każdy ekran odświeża się sam przy wejściu).
- Ustalenie A1 dało dokładnie potrzebną infrastrukturę: `Zasob`/`wykonaj`
  już rozróżnia „nie wiem" od „pusto" per moduł — warto to wykorzystać, a nie
  wymyślać drugi mechanizm obok.

Szacunek: nie wyceniony wprost w audycie, ale mniejszy niż A5 — to głównie
projekt jednego mechanizmu (nie 57 wywołań do przerobienia jak w A1).

## A9 — usuwanie wpłaty niemożliwe z telefonu

**Problem:** „Oznacz jako opłaconą" (`AppStore.oznaczFaktureOplacona`) jest
z telefonu **nieodwracalne** — pomyłkowe kliknięcie (zła faktura, zdublowany
tap) wymaga wejścia do panelu na komputerze, żeby cofnąć.

**Co jest gotowe po stronie panelu**, sprawdzone dziś:
`DELETE /api/invoices/:id/payments/:paymentId` (`app/api/invoices/[id]/
payments/[paymentId]/route.ts`) — usuwa wiersz `invoice_payments`, zwraca
`{ ok: true }`.

**Znalezisko przy tej weryfikacji, nie z audytu — WAŻNE, sprawdź na
starcie:** ta trasa **nie przelicza statusu faktury z powrotem**. Siostrzana
trasa `POST /payments` (rejestracja wpłaty) po dopisaniu wiersza liczy sumę
wpłat i podbija status na „Opłacona", jeśli pokrywa brutto — `DELETE` nie ma
symetrycznej logiki w drugą stronę. Skutek: usunięcie wpłaty, która wcześniej
domknęła fakturę, zostawi `status = 'Opłacona'` na fakturze, która już nie
jest w pełni zapłacona. **To jest błąd panelu, nie tylko brakująca funkcja
apki** — istnieje już dziś, niezależnie od tego, czy apka kiedykolwiek
zawoła tę trasę (gdyby panel miał gdzieś przycisk kasujący wpłatę, ma ten
sam problem). Sprawdź czy panel w ogóle ma taki przycisk w UI; jeśli tak,
to dwa repozytoria, nie jedno.

Naprawa panelu: po `DELETE`, przeliczyć sumę pozostałych wpłat vs. brutto i
cofnąć status na `OPEN_STATUSES` (albo najbliższy sensowny), analogicznie do
logiki w `POST`. To małe, ale musi wejść PRZED albo RAZEM z częścią apki —
inaczej apka dostanie poprawną kasację wpłaty i niepoprawny status na ekranie.

Szacunek audytu: **~15 linii + jedna funkcja w `APIClient`**, do tego teraz
dochodzi poprawka panelu (rozmiar podobny).

## Czego NIE ruszać

- **Reszta „poziomu 3"** — KSeF, korekty, zaliczki, edycja pozycji
  faktur/ofert, wystawianie nowych dokumentów. A5 dotyka WYŁĄCZNIE podglądu
  i wysyłki umów, nie całego modułu finansowego.
- **`TykajacyCzas` / Live Activity** — nietknięte (ten sam zakaz co w A1).
- **`AppStore.swift`** — po A1 ma 2121 linii i jest w dobrym stanie; nie
  dziel go przy okazji tego modułu.
- **Haptyka / `Ruch.swift`** — nowe akcje (Wyślij umowę, Usuń wpłatę) powinny
  dostać `Waga.akcja` przez `wykonaj` (wzorzec z A1) i odpowiednie `odczuj?`
  zgodnie z regułą Fazy 15 (zapis/wysyłka/kasowanie = ma haptykę), ale nie
  wymyślaj nowych kategorii haptyki.

## Jak weryfikować

- **A5, A9**: zwykła weryfikacja na `LEGGERA_DEV_BACKEND=lokalny` (panel
  lokalny, dane dev-seed) — to są normalne, działające ścieżki sieciowe, nie
  scenariusze awaryjne. Zrzuty z symulatora wystarczą.
- **A9, konkretnie**: przetestuj na fakturze, która ZOSTAŁA domknięta jedną
  wpłatą pokrywającą całość — usuń tę wpłatę i sprawdź, czy status faktury
  faktycznie wraca do „Wystawiona"/„Po terminie" (to jest test na
  znalezisko wyżej, nie tylko na to, czy przycisk usuwania działa).
- **A8**: wymaga realnego czekania (przenieś apkę w tło na symulatorze,
  poczekaj, wróć) — nie da się tego przyspieszyć furtką `LEGGERA_DEV_*` bez
  dopisania nowej (rozważ furtkę ustawiającą sztuczny „czas wyjścia w tło" na
  przeszłość, jeśli mechanizm oprze się na progu czasowym — tym razem
  zaplanuj furtkę WCZEŚNIEJ, nie po fakcie, tak jak `LEGGERA_DEV_SEARCH`
  musiał być dopisany po fakcie przy A1).

## Powtarzalny wzorzec tego projektu

Przy A9 już się to potwierdziło, zanim moduł się zaczął: **kontrakt trasy
bywa niesymetryczny** (POST liczy, DELETE nie) — to ta sama rodzina błędów,
co N3/N4 z audytu 13.4 panelu („trasa, która czyta, musi wołać tę samą
migrację co trasa, która pisze"). Sprawdzaj oba kierunki, nie zakładaj, że
istniejąca trasa robi to, czego apka od niej oczekuje — przeczytaj kod
trasy, nie tylko jej nazwę.
