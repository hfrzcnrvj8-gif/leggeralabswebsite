# Brief: domknięcie poziomu 1 + Projekty ze stoperem

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od przeczytania
> `00-plan.md` (cały) i `inwentarz/02-projekty-hub.md` (sekcje „Projekty",
> „Czas pracy", „Notatnik", `GET /api/hub/today`, „Powiadomienia",
> „Wyszukiwarka"). Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`
> (GitHub: `hfrzcnrvj8-gif/leggera-hub-ios`, prywatne).

**Decyzja właściciela (2026-07-19):** po domknięciu Poczty idziemy w **Projekty
ze stoperem**, a nie w iPada — mimo że tabela faz stawia iPada wcześniej.
Powód: stoper jest realnie lepszy na telefonie niż przy biurku, a iPad to nowy
rozmiar ekranu bez nowej funkcji. Nie wracaj do kolejności z tabeli.

---

## Część A (najpierw): trzy luki poziomu 1

Zdanie „poziom 1 kompletny" z poprzedniej sesji było **przedwczesne** —
sprawdzone gretem dopiero po fakcie. To są luki poziomu 1, więc mają
pierwszeństwo przed czymkolwiek z poziomu 2. Każda jest mała.

### A1. Ekran „Dziś" nie woła `GET /api/hub/today`

Dziś `PulpitView` liczy się **sam** z listy leadów i klientów
(`leadyWymagajaceDzialania` + `klienciWymagajacyDzialania`). Panel ma gotowy
agregat, który widzi też projekty po terminie, faktury, wydarzenia i notatki.
Efekt: apka pokazuje mniej, niż powinna, i **cicho** — nic nie wygląda na zepsute.

Podepnij `GET /api/hub/today`. Zachowaj lokalne liczenie jako zapas, gdy trasa
padnie, ale **źródłem prawdy ma być serwer** — inaczej powstaje drugie miejsce,
w którym mieszka definicja „co dziś", i te dwa miejsca się rozjadą.

### A2. Brak Notatnika

„Szybka notatka" jest wprost w poziomie 1 planu. Trasy: `GET/POST /api/notes`,
`PATCH /api/notes/[id]`. Na telefonie to głównie **dopisywanie i czytanie** —
pełna edycja tagów, powiązań i archiwum może zostać na desktopie.

Warte uwagi: `POST /api/notes/[id]/promote` („przekuj w projekt") jest
**idempotentne po stronie serwera** (Moduł 26) — apka nie musi się bać dwukliku.

### A3. Brak kroniki powiadomień i globalnego szukania

`GET/PATCH /api/notifications` (dzwonek + „przeczytane") oraz
`GET /api/search?q=` (odpowiednik palety Cmd+K).

**Uwaga na pomylenie pojęć:** to NIE są powiadomienia push. Push wymaga konta
Apple Developer i jest świadomie odłożony na koniec. Tu chodzi o listę zdarzeń
w samej apce, która działa bez żadnego konta.

---

## Część B: Projekty (poziom 2 — podgląd i lekkie akcje)

Zakres poziomu 2 to **podgląd + lekkie akcje**, nie zarządzanie projektem
z telefonu. Konkretnie:

- **Lista projektów** — `GET /api/projects` (zwraca `task_total`/`task_done`,
  więc pasek postępu masz za darmo; te pola są TYLKO na liście).
- **Profil projektu** — `GET /api/projects/[id]`: zadania, kamienie milowe, log,
  zasoby (linki do otwarcia), onboarding.
- **Odhaczanie zadań** — `PATCH /api/projects/[id]/tasks/[taskId]`. Inwentarz
  nazywa to „główną mobilną akcją projektową". Zrób to gestem, nie formularzem.
- **Zmiana statusu i zdrowia** — `PATCH /api/projects/[id]`.
- **Ręczny wpis do logu** — `POST /api/projects/[id]/activity`.

**Świadomie POZA zakresem** (poziom 3, praca przy biurku): oś czasu / Gantt,
zmiana kolejności zadań i kamieni, zależności między projektami, prośba
o opinię klienta, usuwanie projektu.

### Dwie reguły biznesowe, których nie wolno przenieść „na oko"

1. **Bramka umowy — TWARDA, jedyna taka w panelu.** Przejście na status
   `"W trakcie"` dla projektu, który **ma `client_id`**, wymaga podpisanej
   umowy. Bez niej serwer zwraca **409** z komunikatem po polsku.
   Apka **musi ten komunikat pokazać** — 409 nie jest awarią, tylko odmową
   z powodem. Projekty bez klienta (robota wewnętrzna) przechodzą bez bramki.
   Nie próbuj przewidywać bramki po stronie apki: nie masz danych o umowach,
   a zgadywanie skończy się blokowaniem projektów, które przejść mogą.
2. **„Zdrowie" to oś NIEZALEŻNA od statusu** (Na dobrej drodze / Zagrożony /
   Zerwany) i ustawiana RĘCZNIE. Projekt bywa „W trakcie" i „Zagrożony"
   jednocześnie. Nie łącz tych dwóch pól w jeden przełącznik.

## Część C: Stoper

To jest powód, dla którego ten moduł wyprzedził iPada. Trasy: `POST /api/time/start`,
`POST /api/time/stop`, `GET /api/time/active`, `GET /api/time?project_id=`.

### Cztery rzeczy, na których łatwo się przewrócić

1. **Co najwyżej JEDEN stoper naraz.** Start nowego **sam zatrzymuje**
   poprzedni, a serwer zwraca go w `stopped_previous`. Apka **musi o tym
   powiedzieć** („Zatrzymano stoper przy projekcie X — 42 min"). Ciche
   zniknięcie cudzego pomiaru czasu jest dokładnie tym rodzajem błędu, który
   właściciel odkryje tydzień później na fakturze.
2. **Serwer nie zwraca licznika na żywo** — apka liczy upływ sama z
   `started_at`. Wskaźnik ma być widoczny **na każdym ekranie** (inwentarz mówi
   „w chrome aplikacji"), inaczej stoper będzie chodził zapomniany.
3. **`stop` bez działającego stopera zwraca `{ stopped: null }` i to NIE jest
   błąd.** Nie pokazuj alertu.
4. **Sumując czas pomiń wpis z `source: "timer"` i `ended_at: null`** —
   działający stoper nie ma jeszcze finalnych minut. Tak robi `sumMinutes()`
   w panelu; policzenie go do sumy da zawyżone raporty.

Minuty bywają **ułamkowe** (np. `0.42`) — krótkie sesje celowo nie zaokrąglają
się do „1 min". Nie rzutuj ich na `Int` przy wyświetlaniu sumy.

**Do rozstrzygnięcia z właścicielem, nie samodzielnie:** czy stoper ma chodzić
przy zamkniętej apce / po restarcie telefonu. Serwer trzyma `started_at`, więc
technicznie czas leci dalej — pytanie jest o to, czego właściciel oczekuje,
gdy zapomni zatrzymać. To pytanie po polsku, bez żargonu.

---

## Jak pracować (to samo, co się sprawdziło)

- Buduj i **oglądaj sam w symulatorze**: `xcodegen generate` →
  `xcodebuild -project LeggeraHub.xcodeproj -scheme LeggeraHub -destination
  'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/dd build` →
  `simctl install` → `simctl launch` → `simctl io <dev> screenshot`.
- Do oglądania ekranów bez dotyku służą furtki DEBUG (README apki):
  `LEGGERA_DEV_TOKEN`, `LEGGERA_DEV_TAB`, `LEGGERA_DEV_OPEN_MAIL` itd.
  **Dołóż analogiczne dla Projektów** — bez nich nie zobaczysz profilu.
- Panel lokalnie: `npm run dev` w repo strony. PGlite siedzi **w pamięci**,
  więc restart serwera reseeduje dane testowe — przydatne, gdy zepsujesz stan
  seeda, testując PATCH-e.
- **Trasy zapisu sprawdzaj curlem** w dokładnie tym kształcie, którego używa
  apka. Bramkę umowy (409) i `stopped_previous` da się wywołać z terminala.
- `LeggeraHubCore` **nie importuje SwiftUI ani UIKit**. Od tego zależy, czy
  wersja na Maca będzie tania.
- Reguły wyglądu: jeden akcent na ekran, prawdziwy Liquid Glass
  (`glassEffect`), gradient wyłącznie na ikonach, tekst biały, bez systemowej
  czerwieni. Szczegóły w pamięci projektu (`apka-jezyk-wizualny`).

## Lekcja, którą warto mieć z tyłu głowy

Trzy razy z rzędu w tym projekcie ten sam błąd: **pole istniało po jednej
stronie, a nikt go nie wysyłał po drugiej** (Moduł 30, Moduł 31, teraz pole
`nowe` w synchronizacji poczty, przez które apka zawsze mówiła „brak nowych
wiadomości"). Sprawdzaj, czy coś **woła** kod — nie czy kod istnieje. I czytaj
trasę serwera, zanim napiszesz do niej klienta.

---

## Prompt otwierający kolejny czat

```
Kontynuujemy aplikację natywną Leggera Hub. Przeczytaj
docs/natywna-aplikacja/00-plan.md oraz
docs/natywna-aplikacja/02-brief-projekty-stoper.md, potem zrób
Część A (luki poziomu 1), Część B (Projekty) i Część C (stoper).
Repo apki: /Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios.
```
