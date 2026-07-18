# Inwentarz API — Projekty, Czas, Notatnik, Kalendarz, Powiadomienia, Wyszukiwarka

Część inwentarza API panelu Leggera Hub dla natywnej aplikacji iOS. Dokument
jest samowystarczalny — opisuje kształty danych wyprowadzone wprost z kodu
(`app/api/**` + `lib/*.ts`), bez potrzeby zaglądania do repo strony.

Konwencje wspólne dla wszystkich tras:

- **Auth**: o ile nie zaznaczono inaczej, każda trasa jest admin-only — serwer
  sprawdza cookie sesji (`isAuthed()`), brak = `401 {"error":"unauthorized"}`.
  Panel jest jednoosobowy (jedno hasło, brak ról).
- **Daty dzienne** to stringi `YYYY-MM-DD`. Serwer waliduje je funkcją
  `isPlausibleDateString()` (regex `^\d{4}-\d{2}-\d{2}$` + rok 2000–2100);
  niepoprawna data = `400`. Timestampy (`created_at`, `updated_at`,
  `started_at` itd.) to ISO timestamptz z bazy.
- **Błędy**: `{"error": "..."}` z odpowiednim statusem (400/401/404/409/500).
  Treść błędów bywa po polsku i nadaje się do pokazania użytkownikowi.
- **PATCH-e są częściowe**: aktualizowane są tylko pola obecne w body
  (sprawdzanie `"pole" in body`). Pola nieobecne zostają nietknięte.
- Identyfikatory to UUID (string).
- **Poziom w apce**: 1 = pełna funkcja mobilnie (pulpit, leady, klienci,
  notatki, powiadomienia, poczta), 2 = podgląd/lekkie akcje (projekty +
  stoper, faktury, oferty/umowy), 3 = tylko desktop.

## Spis tras

| Metoda | Ścieżka | Po co | Poziom |
|---|---|---|---|
| GET | /api/projects | Lista projektów (Kanban) z licznikami zadań | 2 |
| POST | /api/projects | Nowy projekt (opcjonalnie z szablonu) | 2 |
| GET | /api/projects/timeline | Projekty + kamienie pod oś czasu (Gantt-lite) | 3 |
| GET | /api/projects/[id] | Pełny profil projektu (zadania, log, kamienie, rentowność…) | 2 |
| PATCH | /api/projects/[id] | Edycja pól projektu (z bramką umowy) | 2 |
| DELETE | /api/projects/[id] | Usunięcie projektu | 2 |
| POST | /api/projects/[id]/tasks | Dodanie zadania (checklisty) | 2 |
| PATCH | /api/projects/[id]/tasks/[taskId] | Odhaczenie / edycja zadania | 2 |
| DELETE | /api/projects/[id]/tasks/[taskId] | Usunięcie zadania | 2 |
| POST | /api/projects/[id]/tasks/reorder | Nowa kolejność zadań | 3 |
| POST | /api/projects/[id]/activity | Ręczny wpis do logu projektu | 2 |
| POST | /api/projects/[id]/milestones | Dodanie kamienia milowego | 2 |
| PATCH | /api/projects/[id]/milestones/[milestoneId] | Edycja kamienia | 2 |
| DELETE | /api/projects/[id]/milestones/[milestoneId] | Usunięcie kamienia | 2 |
| POST | /api/projects/[id]/milestones/reorder | Nowa kolejność kamieni | 3 |
| POST | /api/projects/[id]/resources | Dodanie linku-zasobu | 2 |
| DELETE | /api/projects/[id]/resources/[resourceId] | Usunięcie linku | 2 |
| POST | /api/projects/[id]/dependencies | Dodanie zależności między projektami | 3 |
| DELETE | /api/projects/[id]/dependencies | Usunięcie zależności | 3 |
| POST | /api/projects/[id]/onboarding | Dodanie punktu checklisty onboardingu (lub seed domyślnej) | 2 |
| PATCH | /api/projects/[id]/onboarding/[itemId] | Odhaczenie / edycja punktu onboardingu | 2 |
| DELETE | /api/projects/[id]/onboarding/[itemId] | Usunięcie punktu onboardingu | 2 |
| POST | /api/projects/[id]/review | Ręczne wpisanie opinii klienta przez właściciela | 3 |
| POST | /api/projects/[id]/review-link | Wygenerowanie/odczyt linku publicznego formularza opinii | 3 |
| POST | /api/projects/[id]/request-review | Wysyłka maila z podsumowaniem + prośbą o opinię | 3 |
| GET | /api/projects/review/public/[token] | Dane publicznego formularza opinii (bez logowania) | — (publiczna, poza apką) |
| POST | /api/projects/review/public/[token]/submit | Zapis opinii przez klienta (bez logowania) | — (publiczna, poza apką) |
| GET | /api/time?project_id= | Wpisy czasu dla projektu | 2 |
| POST | /api/time | Ręczny wpis czasu | 2 |
| POST | /api/time/start | Start stopera (zatrzymuje poprzedni) | 2 |
| POST | /api/time/stop | Stop stopera | 2 |
| GET | /api/time/active | Aktualnie działający stoper | 2 |
| PATCH | /api/time/[id] | Edycja wpisu czasu | 2 |
| DELETE | /api/time/[id] | Usunięcie wpisu czasu | 2 |
| GET | /api/notes | Lista notatek (z archiwum, przypięte pierwsze) | 1 |
| POST | /api/notes | Nowa notatka | 1 |
| GET | /api/notes/[id] | Jedna notatka (do bezpośredniego linku) | 1 |
| PATCH | /api/notes/[id] | Edycja notatki (treść, tagi, pin, archiwum, powiązania) | 1 |
| DELETE | /api/notes/[id] | Trwałe usunięcie notatki | 1 |
| GET | /api/notes/[id]/activity | Log notatki | 1 |
| POST | /api/notes/[id]/activity | Wpis do logu notatki | 1 |
| DELETE | /api/notes/[id]/activity/[activityId] | Usunięcie wpisu z logu | 1 |
| POST | /api/notes/[id]/promote | „Przekuj w projekt" (idempotentne) | 1 |
| POST | /api/notes/[id]/schedule | „Do kalendarza" (idempotentne) | 1 |
| GET | /api/events?month= | Wydarzenia kalendarza w miesiącu | 1 |
| POST | /api/events | Nowe wydarzenie | 1 |
| PATCH | /api/events/[id] | Edycja wydarzenia | 1 |
| DELETE | /api/events/[id] | Usunięcie wydarzenia | 1 |
| GET | /api/events/deadlines?month= | Wyliczone terminy z innych modułów (read-only nakładka) | 1 |
| GET | /api/calendar/ics?token= | Subskrybowalny feed .ics (auth tokenem w URL) | — (konsumuje ap. kalendarza) |
| GET | /api/calendar/ics-info | Czy subskrypcja ICS skonfigurowana + token | 3 |
| GET | /api/hub/today | Agregat pulpitu „co dziś" + KPI | 1 |
| GET | /api/links/orphans | Dokumenty bez klienta + propozycje powiązania | 3 |
| POST | /api/links/orphans | Zatwierdzenie jednego powiązania wstecz | 3 |
| GET | /api/search?q= | Globalne wyszukiwanie (paleta Cmd+K) | 1 |
| GET | /api/notifications | Kronika powiadomień + licznik nieprzeczytanych | 1 |
| PATCH | /api/notifications | Oznaczenie przeczytanego (jedno / wszystkie) | 1 |
| GET | /api/recurring | Lista szablonów faktur cyklicznych | 3 |
| POST | /api/recurring | Nowy szablon faktury cyklicznej | 3 |
| PATCH | /api/recurring/[id] | Edycja szablonu | 3 |
| DELETE | /api/recurring/[id] | Usunięcie szablonu | 3 |

---

# Projekty

## GET /api/projects
- **Po co**: Lista wszystkich projektów pod widok Kanban/listę, z agregatami postępu checklisty.
- **Auth**: admin-only.
- **Żądanie**: brak parametrów.
- **Odpowiedź**: `{ projects: Project[] }` — każdy rekord to pełny wiersz `projects` (patrz typ `Project` niżej) plus `task_total: number` i `task_done: number` (agregat z `project_tasks`). Sort: `created_at DESC`.
- **Reguły biznesowe**: `task_total`/`task_done` są TYLKO na liście — endpoint pojedynczego projektu ich nie zwraca (tam liczy się z pełnej listy `tasks`).
- **Poziom w apce**: 2.

## POST /api/projects
- **Po co**: Utworzenie projektu — ręcznie albo z szablonu (kamienie + zadania + daty rozwijane po stronie serwera).
- **Auth**: admin-only.
- **Żądanie** (JSON): `tytul` (string, wymagane, max 300), `opis` (string, max 4000), `status` (string, domyślnie `"Pomysł"`), `priorytet` (string, domyślnie `"Normalny"`), `termin` (string data, opcjonalne — tu BEZ walidacji isPlausibleDateString, w odróżnieniu od PATCH), `lead_id` (string|null), `template` (string — id szablonu: `"www"` | `"automatyzacja"` | `"audyt"`).
- **Odpowiedź**: `{ ok: true, id: string }`.
- **Reguły biznesowe**:
  - Szablon: `start` = dziś, `termin` = dziś + największy `dayOffset`; każdy kamień = dziś + jego `dayOffset`, z zadaniami pod kamieniem. Opis z szablonu tylko, gdy własny pusty.
  - KAŻDY nowy projekt dostaje automatycznie domyślną 5-punktową checklistę onboardingową (`DEFAULT_ONBOARDING_ITEMS`).
  - `client_id` NIE jest tu ustawiane w ogóle — projekt ręczny startuje bez klienta (istotne dla bramki umowy, patrz PATCH).
- **Poziom w apce**: 2.

## GET /api/projects/timeline
- **Po co**: Lekki endpoint pod oś czasu (Gantt-lite w stylu Linear Roadmap) — projekty spłaszczone z kamieniami, bez obciążania listy Kanbana.
- **Auth**: admin-only.
- **Żądanie**: brak.
- **Odpowiedź**: `{ projects: [...], dependencies: [...] }` gdzie projekt = `{ id, tytul, status, zdrowie, priorytet, start, termin, created_at, kolor, ikona, task_total: number, task_done: number, milestones: {id, nazwa, termin}[] }` (kamienie posortowane po `position`), a `dependencies` = `{ project_id, depends_on_id }[]` (WSZYSTKIE zależności, globalnie).
- **Reguły biznesowe**: pasek na osi kolorowany jest WG STATUSU (mapa `PROJECT_STATUS_HEX`), nie wg ręcznego `kolor`. „Cykle" na osi to czysto wizualny rytm 14-dniowy, bez danych w bazie.
- **Poziom w apce**: 3.

## GET /api/projects/[id]
- **Po co**: Pełny profil projektu — wszystko, co pokazuje panel szczegółów (5 zakładek).
- **Auth**: admin-only.
- **Żądanie**: brak. 404 gdy projekt nie istnieje.
- **Odpowiedź**:
  ```
  {
    project: Project,                    // pełny wiersz projects
    tasks: ProjectTask[],                // position ASC
    activity: ProjectActivity[],         // created_at DESC
    milestones: ProjectMilestone[],      // position ASC
    resources: ProjectResource[],        // position ASC
    onboarding: ProjectOnboardingItem[], // position ASC
    dependencies: { depends_on_id: string }[],
    rentownosc: {
      przychod_netto: number,            // suma netto faktur projektu (PLN, bez proform/szkiców/anulowanych)
      koszty_netto: number,              // suma kwota_netto kosztów projektu
      zysk_netto: number,
      ma_inne_waluty: boolean            // true = są pominięte faktury nie-PLN
    },
    sourceOffer: { id: string, tytul: string } | null  // oferta, z której akceptacji powstał projekt
  }
  ```
- **Reguły biznesowe**: rentowność liczona świadomie tylko w PLN (v1). `sourceOffer` = null dla projektów ręcznych. Efektywna stawka godzinowa = `zysk_netto / (suma minut z /api/time / 60)` — liczy klient.
- **Poziom w apce**: 2.

## PATCH /api/projects/[id]
- **Po co**: Częściowa edycja projektu; serwer sam dopisuje wpisy „system" do logu przy zmianach śledzonych pól.
- **Auth**: admin-only.
- **Żądanie** (JSON, każde pole opcjonalne): `tytul`, `opis`, `status`, `priorytet`, `zdrowie` (stringi), `termin`, `start` (data `YYYY-MM-DD` walidowana `isPlausibleDateString`, pusty string = wyczyszczenie na null), `lead_id`, `client_id`, `kolor` (hex, max 20 zn.), `ikona` (emoji, max 16 zn.) — puste stringi w polach-referencjach/kolorze/ikonie czyszczą na null.
- **Odpowiedź**: `{ ok: true, activity: ProjectActivity[] }` (odświeżony log, created_at DESC). Błędy: `400 invalid termin/start`, `409` przy bramce umowy (patrz niżej).
- **Reguły biznesowe** (kluczowe dla apki):
  - **Bramka umowy (TWARDA, jedyna w panelu)**: przejście na status `"W trakcie"` dla projektu, który MA `client_id`, wymaga istnienia umowy `contracts` z `project_id = ten projekt`, `typ = 'umowa'`, `status = 'Podpisana'`. Bez niej `409` z komunikatem po polsku (pokazać użytkownikowi). Projekty bez `client_id` (robota wewnętrzna) przechodzą bez bramki.
  - Zmiany `status`/`priorytet`/`zdrowie`/`termin`/`start` generują wpisy `kind: "system"` w `project_activity` („Status: X → Y").
  - Zmiana statusu loguje też zdarzenie na osi klienta (jeśli `client_id`).
  - Wejście w status zamknięty (`"Wdrożone"` — jedyny w `CLOSED_PROJECT_STATUSES`) przy podpiętym kliencie automatycznie planuje 2 kontakty nurture (+14 i +90 dni) — idempotentnie po `project_id` (powrót do „Wdrożone" nie duplikuje).
  - `zdrowie` to RĘCZNA, niezależna od statusu oś (projekt może być „W trakcie" i „Zagrożony" naraz).
- **Poziom w apce**: 2 (zmiana statusu/zdrowia to „lekka akcja"; apka musi obsłużyć 409 bramki).

## DELETE /api/projects/[id]
- **Po co**: Usuwa projekt; zadania/log/kamienie/zasoby kasują się kaskadowo.
- **Auth**: admin-only. **Żądanie**: brak. **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 2 (raczej z potwierdzeniem; można odłożyć na 3).

## POST /api/projects/[id]/tasks
- **Po co**: Dodaje zadanie do checklisty projektu, opcjonalnie pod kamień.
- **Auth**: admin-only.
- **Żądanie**: `{ text: string (wymagane, max 500), milestone_id?: string|null }`.
- **Odpowiedź**: `{ ok: true, tasks: ProjectTask[] }` (cała odświeżona lista, position ASC).
- **Reguły**: `position` = liczba istniejących zadań (dokładane na koniec).
- **Poziom w apce**: 2.

## PATCH /api/projects/[id]/tasks/[taskId]
- **Po co**: Odhaczenie / edycja tekstu / przepięcie zadania pod inny kamień.
- **Auth**: admin-only.
- **Żądanie**: dowolny podzbiór z `{ done: boolean, text: string (max 500), milestone_id: string|null }`.
- **Odpowiedź**: `{ ok: true }` (bez odświeżonej listy — apka aktualizuje lokalnie).
- **Poziom w apce**: 2 (odhaczanie zadań to główna mobilna akcja projektowa).

## DELETE /api/projects/[id]/tasks/[taskId]
- **Po co**: Usuwa zadanie. **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 2.

## POST /api/projects/[id]/tasks/reorder
- **Po co**: Zapis nowej kolejności zadań po drag&drop.
- **Auth**: admin-only.
- **Żądanie**: `{ ids: string[] }` — id zadań w docelowej kolejności (position = indeks).
- **Odpowiedź**: `{ ok: true, tasks: ProjectTask[] }`.
- **Poziom w apce**: 3.

## POST /api/projects/[id]/activity
- **Po co**: Ręczny wpis do dziennika projektu (obok automatycznych „system").
- **Auth**: admin-only.
- **Żądanie**: `{ text: string (wymagane, max 4000) }`. 404 gdy projekt nie istnieje.
- **Odpowiedź**: `{ ok: true, activity: ProjectActivity[] }` (created_at DESC). Wpis dostaje `kind: "note"` (domyślne w bazie).
- **Poziom w apce**: 2.

## POST /api/projects/[id]/milestones
- **Po co**: Dodaje kamień milowy.
- **Auth**: admin-only.
- **Żądanie**: `{ nazwa: string (wymagane, max 200), termin?: string|null }` (termin tu bez walidacji isPlausibleDateString; PATCH już waliduje).
- **Odpowiedź**: `{ ok: true, milestones: ProjectMilestone[] }`.
- **Poziom w apce**: 2.

## PATCH /api/projects/[id]/milestones/[milestoneId]
- **Po co**: Zmiana nazwy / terminu kamienia.
- **Auth**: admin-only.
- **Żądanie**: podzbiór `{ nazwa: string (max 200), termin: string (isPlausibleDateString, pusty = null) }`. Błąd: `400 invalid termin`.
- **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 2.

## DELETE /api/projects/[id]/milestones/[milestoneId]
- **Po co**: Usuwa kamień; zadania spod niego NIE są kasowane — wracają do puli „bez kamienia" (`milestone_id` → null).
- **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 2.

## POST /api/projects/[id]/milestones/reorder
- **Po co**: Kolejność kamieni po drag&drop. Analogiczne do tasks/reorder.
- **Żądanie**: `{ ids: string[] }`. **Odpowiedź**: `{ ok: true, milestones: ProjectMilestone[] }`.
- **Poziom w apce**: 3.

## POST /api/projects/[id]/resources
- **Po co**: Dodaje link-zasób do projektu (Figma, dokument, notatki).
- **Auth**: admin-only.
- **Żądanie**: `{ etykieta: string (wymagane, max 200), url: string (wymagane, max 1000) }`.
- **Odpowiedź**: `{ ok: true, resources: ProjectResource[] }`.
- **Poziom w apce**: 2 (otwieranie linków mobilnie jak najbardziej; dodawanie może być odłożone).

## DELETE /api/projects/[id]/resources/[resourceId]
- **Po co**: Usuwa link. **Odpowiedź**: `{ ok: true }`. **Poziom**: 2.

## POST /api/projects/[id]/dependencies
- **Po co**: Dodaje zależność „ten projekt zależy od poprzednika" (strzałka na osi czasu).
- **Auth**: admin-only.
- **Żądanie**: `{ depends_on_id: string }`.
- **Odpowiedź**: `{ ok: true, dependencies: { depends_on_id: string }[] }`. Błędy 400: self-zależność („Projekt nie może zależeć od samego siebie.") i odwrotność już istniejąca (cykl). Duplikat = cicho ignorowany (ON CONFLICT DO NOTHING).
- **Poziom w apce**: 3.

## DELETE /api/projects/[id]/dependencies?depends_on_id=...
- **Po co**: Usuwa zależność. Parametr w QUERY, nie w body.
- **Odpowiedź**: `{ ok: true, dependencies: {...}[] }`. **Poziom**: 3.

## POST /api/projects/[id]/onboarding
- **Po co**: Dodaje punkt checklisty onboardingowej ALBO wsiewie całą domyślną (dla projektów sprzed modułu).
- **Auth**: admin-only.
- **Żądanie**: `{ tekst: string (max 500) }` LUB `{ seedDefaults: true }` (wtedy `tekst` niepotrzebny).
- **Odpowiedź**: `{ ok: true, onboarding: ProjectOnboardingItem[] }`.
- **Reguły**: niedomknięta checklista generuje w UI miękką podpowiedź (`ONBOARDING_INCOMPLETE_HINT`) — informacyjną, NIGDY nie blokuje przejścia do realizacji.
- **Poziom w apce**: 2.

## PATCH /api/projects/[id]/onboarding/[itemId]
- **Żądanie**: podzbiór `{ done: boolean, tekst: string (max 500) }`. **Odpowiedź**: `{ ok: true }`. **Poziom**: 2.

## DELETE /api/projects/[id]/onboarding/[itemId]
- **Odpowiedź**: `{ ok: true }`. **Poziom**: 2.

## POST /api/projects/[id]/review
- **Po co**: Właściciel wpisuje opinię klienta RĘCZNIE (zebraną np. telefonicznie) — obejście publicznego formularza.
- **Auth**: admin-only.
- **Żądanie**: `{ jakosc: 1-5 (int), terminowosc: 1-5, komunikacja: 1-5, comment?: string (max 4000), consentCaseStudy?: boolean, consentName?: string (max 200, WYMAGANE gdy consentCaseStudy=true) }`. Błędy 400 z polskim komunikatem.
- **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**: w odróżnieniu od publicznego submit — BEZ blokady „tylko raz" (właściciel może poprawić). Zdarzenie na osi klienta logowane tylko przy PIERWSZYM zapisie. Zgoda bez dowodu IP/user-agent (niższy standard dowodowy, świadomie). Tekst zgody zapisywany jako snapshot wg `project.jezyk` (pl/en/de).
- **Poziom w apce**: 3.

## POST /api/projects/[id]/review-link
- **Po co**: Zapewnia (generuje przy pierwszym wywołaniu) token publicznego formularza opinii i zwraca gotowy URL.
- **Auth**: admin-only.
- **Żądanie**: brak body. Idempotentne — zawsze ten sam token.
- **Odpowiedź**: `{ ok: true, url: string }` (postać `https://…/pl/opinia/<token>`).
- **Poziom w apce**: 3.

## POST /api/projects/[id]/request-review
- **Po co**: Wysyła klientowi maila z podsumowaniem projektu i linkiem do formularza opinii. Treść ZAWSZE zredagowana/zatwierdzona przez właściciela — panel nic nie wysyła sam.
- **Auth**: admin-only.
- **Żądanie**: `{ body: string }` — pełna treść maila (wymagane). Temat maila serwer buduje sam wg `project.jezyk`.
- **Odpowiedź**: `{ ok: true }`. Błędy 400: brak treści / projekt bez klienta / klient bez e-maila; 500 przy błędzie wysyłki.
- **Reguły**: po wysyłce ustawia `review_requested_at` i loguje `review_requested` na osi klienta. Status „Wdrożone" bez `review_requested_at` generuje w UI miękką podpowiedź.
- **Poziom w apce**: 3.

## GET /api/projects/review/public/[token]
- **Po co**: Dane publicznego formularza opinii dla klienta.
- **Auth**: **BEZ logowania** — token w URL pełni rolę hasła-w-linku.
- **Odpowiedź**: `{ project: { tytul, client_nazwa: string|null, review_submitted_at, review_rating_jakosc, review_rating_terminowosc, review_rating_komunikacja, review_comment, review_consent_case_study, jezyk } }`. 404 gdy zły token. Niepusty `review_submitted_at` = formularz pokazuje „dziękujemy" zamiast pól.
- **Poziom w apce**: — (renderowane w przeglądarce klienta, poza apką właściciela).

## POST /api/projects/review/public/[token]/submit
- **Po co**: Klient zapisuje opinię (3 oceny 1–5 + komentarz) i opcjonalną zgodę na case study.
- **Auth**: **BEZ logowania** (token).
- **Żądanie**: jak w `/review` (jakosc/terminowosc/komunikacja/comment/consentCaseStudy/consentName). Komunikaty błędów w języku projektu (pl/en/de).
- **Odpowiedź**: `{ ok: true }`; `409` gdy opinia już zapisana (claim-style UPDATE `WHERE review_submitted_at IS NULL` — chroni przed podwójnym submitem).
- **Reguły**: zapisuje dowód zgody (IP z `x-forwarded-for`, user-agent, snapshot tekstu zgody wg języka). Loguje `review_collected` na osi klienta i tworzy powiadomienie (`kind: "review_collected"`, dedupe po project_id).
- **Poziom w apce**: — (publiczna).

# Czas pracy (Moduł 19)

## GET /api/time?project_id=...
- **Po co**: Wszystkie wpisy czasu jednego projektu (ręczne + stoperowe).
- **Auth**: admin-only.
- **Żądanie**: query `project_id` (wymagane, 400 bez niego).
- **Odpowiedź**: `{ ok: true, entries: TimeEntry[] }` — sort `entry_date DESC, created_at DESC`. `minutes` przychodzi jako float (może być ułamkowe dla krótkich sesji stopera, np. `0.42`).
- **Reguły**: sumując czas pomiń wpis z `source: "timer"` i `ended_at: null` (działający stoper nie ma jeszcze finalnych minut) — tak robi `sumMinutes()`.
- **Poziom w apce**: 2.

## POST /api/time
- **Po co**: Ręczny wpis czasu („2h przy projekcie X").
- **Auth**: admin-only.
- **Żądanie**: `{ project_id: string (wymagane), minutes: number (wymagane, > 0, zaokrąglane do int), task_id?: string|null, entry_date?: "YYYY-MM-DD" (niepoprawna/nieobecna → dziś), note?: string (max 500) }`.
- **Odpowiedź**: `{ ok: true, entries: TimeEntry[] }` (cała odświeżona lista projektu). Wpis dostaje `source: "manual"`, `started_at`/`ended_at` = null.
- **Poziom w apce**: 2.

## POST /api/time/start
- **Po co**: Start stopera dla projektu (opcjonalnie konkretnego zadania).
- **Auth**: admin-only.
- **Żądanie**: `{ project_id: string (wymagane), task_id?: string|null }`.
- **Odpowiedź**: `{ ok: true, active: TimeEntry, stopped_previous: { id, project_id, minutes: number } | null }`.
- **Reguły biznesowe (kluczowe)**: **co najwyżej JEDEN stoper naraz** (panel jednoosobowy). Jeśli inny stoper chodzi, serwer sam go zatrzymuje i zwraca w `stopped_previous` — apka MUSI o tym poinformować użytkownika (nie znikać cicho). Minuty liczone z dokładnością do setnych (krótkie sesje nie zaokrąglają się do „1 min").
- **Poziom w apce**: 2 (stoper to wprost wymieniona mobilna akcja poziomu 2).

## POST /api/time/stop
- **Po co**: Zatrzymuje globalnie działający stoper.
- **Auth**: admin-only. **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true, stopped: { id, project_id, minutes: number } | null }` (null = nic nie chodziło; to NIE błąd).
- **Poziom w apce**: 2.

## GET /api/time/active
- **Po co**: Aktualny stoper do wskaźnika w chrome aplikacji (na każdym ekranie).
- **Auth**: admin-only.
- **Odpowiedź**: `{ ok: true, active: (TimeEntry & { project_tytul: string, task_text: string|null }) | null }`.
- **Reguły**: czas bieżący apka liczy sama z `started_at` (serwer nie zwraca live-licznika).
- **Poziom w apce**: 2.

## PATCH /api/time/[id]
- **Po co**: Edycja wpisu czasu (minuty, zadanie, data, notatka).
- **Auth**: admin-only.
- **Żądanie**: podzbiór `{ minutes: number > 0 (int), task_id: string|null, entry_date: "YYYY-MM-DD" (isPlausibleDateString), note: string (max 500) }` — niepoprawne wartości NIE dają błędu, tylko zachowują starą wartość. 404 gdy wpis nie istnieje.
- **Odpowiedź**: `{ ok: true, entries: TimeEntry[] }` (lista projektu wpisu).
- **Poziom w apce**: 2.

## DELETE /api/time/[id]
- **Po co**: Usuwa wpis czasu. 404 gdy brak.
- **Odpowiedź**: `{ ok: true, entries: TimeEntry[] }`. **Poziom**: 2.

# Notatnik (Moduł 26)

## GET /api/notes
- **Po co**: Cała lista notatek — łącznie z archiwalnymi; podział na zakładki (Wszystkie/Przypięte/Archiwum) robi klient.
- **Auth**: admin-only.
- **Odpowiedź**: `{ notes: Note[] }` — sort `pinned DESC, updated_at DESC`. Każdy rekord zawiera pola pochodne z JOIN-ów: `project_tytul: string|null` (tytuł projektu z przekucia), `event_data: string|null` (data wydarzenia z „Do kalendarza"), `log_text: string` (wpisy logu sklejone spacją — TYLKO do wyszukiwania, nie do wyświetlania).
- **Reguły**: zakładki wg `matchesTab()`: „archived" = `archived_at != null`; archiwalne niewidoczne we „Wszystkie" i „Przypięte". Pól pochodnych nie odsyłać PATCH-em. Bez stronicowania (skala setek rekordów).
- **Poziom w apce**: 1.

## POST /api/notes
- **Po co**: Nowa notatka.
- **Auth**: admin-only.
- **Żądanie**: `{ tytul?: string (max 300), tresc?: string (max 8000), tagi?: string (CSV, max 500), client_id?: string|null, lead_id?: string|null }` — wymagane jest co najmniej JEDNO z `tytul`/`tresc`.
- **Odpowiedź**: `{ ok: true, id: string }`.
- **Reguły**: `client_id`/`lead_id` to oś „czyj to rekord" — wzajemnie wyłączne przy ręcznym wyborze (obiekt z `linkValueFor()` czyści drugie pole).
- **Poziom w apce**: 1.

## GET /api/notes/[id]
- **Po co**: Jedna notatka pod bezpośredni link/deep link.
- **Auth**: admin-only.
- **Odpowiedź**: `{ note: Note }` (z `project_tytul` i `event_data`, bez `log_text`). 404 gdy brak.
- **Poziom w apce**: 1.

## PATCH /api/notes/[id]
- **Po co**: Częściowa edycja notatki.
- **Auth**: admin-only.
- **Żądanie**: podzbiór `{ tytul, tresc, tagi (stringi), client_id: string|null, lead_id: string|null, pinned: boolean, archived: boolean }`.
- **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**:
  - `archived: true/false` w API → serwer sam ustawia/kasuje znacznik `archived_at` (klient nie wysyła daty). Archiwum jest domyślnym „usuwaniem"; trwałe usunięcie schowane w zakładce Archiwum.
  - Edycja `tytul`/`tresc`/`tagi` podbija `updated_at` (i sortowanie); zmiana powiązania i pin — ŚWIADOMIE NIE (porządkowanie nie wypycha notatki na górę).
  - `client_id`+`lead_id` wysyłać RAZEM (jednym obiektem, wyłączność już rozstrzygnięta po stronie klienta). `project_id`/`event_id` NIE są edytowalne — ustawiają je wyłącznie promote/schedule.
- **Poziom w apce**: 1.

## DELETE /api/notes/[id]
- **Po co**: Trwałe usunięcie (w UI dostępne tylko z Archiwum). **Odpowiedź**: `{ ok: true }`. **Poziom**: 1.

## GET /api/notes/[id]/activity
- **Po co**: Log notatki (datowane dopiski pod treścią).
- **Odpowiedź**: `{ activity: NoteActivity[] }` (created_at DESC). **Poziom**: 1.

## POST /api/notes/[id]/activity
- **Żądanie**: `{ text: string (wymagane, max 4000) }`. 404 gdy notatka nie istnieje.
- **Odpowiedź**: `{ ok: true, activity: NoteActivity[] }`. **Poziom**: 1.

## DELETE /api/notes/[id]/activity/[activityId]
- **Odpowiedź**: `{ ok: true }`. **Poziom**: 1.

## POST /api/notes/[id]/promote
- **Po co**: „Przekuj w projekt" — tworzy projekt z tytułu/treści notatki, z dziedziczeniem powiązań.
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true, id: string (id projektu), existing: boolean }`.
- **Reguły biznesowe (kluczowe)**:
  - **Idempotencja NA SERWERZE**: `notes.project_id` jest jedynym źródłem prawdy. Gdy już ustawione → `200` z `existing: true` i istniejącym id (to NIE błąd — apka otwiera istniejący projekt). Podwójny tap/drugi ekran nie zrobi duplikatu.
  - Kolumna ma ON DELETE SET NULL — po skasowaniu projektu notatkę da się przekuć ponownie.
  - Nowy projekt: status „Pomysł", priorytet „Normalny", dziedziczy `lead_id`+`client_id` notatki, dostaje domyślną checklistę onboardingową. Do logu notatki trafia „Przekuto w projekt.".
- **Poziom w apce**: 1.

## POST /api/notes/[id]/schedule
- **Po co**: „Do kalendarza" — tworzy wydarzenie z notatki, z dziedziczeniem powiązań (client/lead/project).
- **Auth**: admin-only.
- **Żądanie**: `{ data: "YYYY-MM-DD" (wymagane, isPlausibleDateString), godzina?: "HH:MM"|null }`.
- **Odpowiedź**: `{ ok: true, id: string (id wydarzenia), existing: boolean }`.
- **Reguły**: idempotencja identyczna jak promote, źródłem prawdy `notes.event_id`. Tytuł wydarzenia = tytuł notatki (fallback „Notatka"), opis = treść (do 2000 zn.). Log notatki dostaje wpis z datą po polsku.
- **Poziom w apce**: 1.

# Kalendarz

## GET /api/events?month=YYYY-MM
- **Po co**: Ręczne wydarzenia kalendarza w danym miesiącu (domyślnie bieżący).
- **Auth**: admin-only.
- **Żądanie**: query `month` w formacie `YYYY-MM` (niepoprawny/nieobecny → bieżący miesiąc).
- **Odpowiedź**: `{ events: HubEvent[] }` — sort `data ASC, godzina ASC NULLS LAST`.
- **Reguły**: dopasowanie po NAKŁADANIU się zakresu z miesiącem (wielodniowe wydarzenie zaczęte w poprzednim miesiącu nadal jest widoczne). Rozwinięcie na dni: `[data, data_koniec]` włącznie; `data_koniec <= data` traktować jak jednodniowe; limit 366 dni.
- **Poziom w apce**: 1.

## POST /api/events
- **Po co**: Nowe wydarzenie (całodniowe, z godziną albo wielodniowe).
- **Auth**: admin-only.
- **Żądanie**: `{ tytul: string (wymagane, max 300), data: "YYYY-MM-DD" (wymagane, isPlausibleDateString), opis?: string (max 2000), godzina?: "HH:MM"|null, data_koniec?: string|null (isPlausibleDateString, NIE może być przed data → 400), czas_trwania_min?: number|null (1–1440, inaczej null), lead_id?, project_id?, client_id?: string|null }`.
- **Odpowiedź**: `{ ok: true, id: string }`.
- **Reguły**: `godzina` = null → wydarzenie całodniowe. `czas_trwania_min` ma sens tylko z godziną (siatka bez niego zakłada 60 min). Quick-add („jutro 14:00 call") parsowany deterministycznie PO STRONIE KLIENTA (`parseQuickAdd()` w lib/events.ts — bez AI, świadoma zasada) — API dostaje już rozłożone pola.
- **Poziom w apce**: 1.

## PATCH /api/events/[id]
- **Po co**: Częściowa edycja wydarzenia.
- **Żądanie**: podzbiór pól z POST (`tytul`, `opis`, `data` — pusta ignorowana, `godzina` — pusta czyści na null, `data_koniec` — pusta czyści, `czas_trwania_min` — poza zakresem czyści, `lead_id`/`project_id`/`client_id` — puste czyszczą). Walidacja dat jak w POST (400).
- **Odpowiedź**: `{ ok: true }`. **Poziom**: 1.

## DELETE /api/events/[id]
- **Odpowiedź**: `{ ok: true }`. **Poziom**: 1.

## GET /api/events/deadlines?month=YYYY-MM
- **Po co**: WYLICZONE terminy z innych modułów nakładane na kalendarz: płatności faktur, terminy projektów, kamienie milowe, przypomnienia o leadach/klientach, zalogowane telefony i maile. Wyłącznie do odczytu — kalendarz ich nie tworzy ani nie kasuje.
- **Auth**: admin-only.
- **Żądanie**: query `month` (jak wyżej).
- **Odpowiedź**: `{ deadlines: Deadline[] }` gdzie:
  ```
  Deadline = {
    id: string,          // syntetyczny, stabilny ("inv-<id>", "prj-<id>", "mst-", "led-", "cli-", "call-led-", "call-cli-", "mail-led-", "mail-cli-")
    data: "YYYY-MM-DD",
    tytul: string,       // gotowy do wyświetlenia, po polsku ("Płatność — FV/…", "Kamień — X (Projekt)")
    kind: "invoice" | "project" | "milestone" | "lead" | "client" | "call" | "call-missed" | "email",
    href: string,        // ścieżka panelu webowego, np. "/admin/projects/<id>" — apka mapuje na własny ekran
    client_id: string | null,
    lead_id: string | null,
    project_id: string | null
  }
  ```
- **Reguły**: faktury tylko `Wystawiona`/`Po terminie` bez proform; projekty i kamienie tylko z projektów niewdrożonych; kamień „nieukończony" = ma niezrobione zadanie ALBO nie ma zadań w ogóle; leady tylko otwarte. `call-missed` = połączenie z `wynik = "nieodebrane"` (osobny, czerwony rodzaj). Powiązania `client_id`/`lead_id`/`project_id` służą łączonym filtrom kalendarza.
- **Poziom w apce**: 1.

## GET /api/calendar/ics?token=...
- **Po co**: Subskrybowalny feed .ics ręcznych wydarzeń (Apple/Google Calendar) — okno od -30 do +365 dni.
- **Auth**: **NIE cookie** — token w query porównywany z env `CALENDAR_ICS_SECRET`. Fail-closed: brak env = 500 (endpoint zablokowany, nie cicho publiczny); zły token = 401.
- **Odpowiedź**: body typu `text/calendar` (RFC 5545). Wydarzenia z godziną = DATE-TIME „floating" (czas lokalny, bez TZID); bez godziny = DATE (DTEND wyłączny, +1 dzień). Tylko ręczne wydarzenia — bez wyliczonych deadline'ów (świadomie).
- **Poziom w apce**: — (konsumuje aplikacja kalendarza systemu, nie nasza apka; natywna apka może zamiast tego użyć /api/events).

## GET /api/calendar/ics-info
- **Po co**: Mówi panelowi, czy subskrypcja ICS jest skonfigurowana, i zwraca token do złożenia URL-a.
- **Auth**: admin-only (token widzi tylko właściciel).
- **Odpowiedź**: `{ configured: boolean, token: string | null }`.
- **Poziom w apce**: 3.

# Pulpit

## GET /api/hub/today
- **Po co**: Jeden agregat „co dziś" + KPI — zasila cały pulpit (i dzienny mail). Najważniejszy endpoint poziomu 1.
- **Auth**: admin-only.
- **Żądanie**: brak.
- **Odpowiedź** (kształt góry; typy Lead/Client/Invoice/Offer w inwentarzach innych modułów):
  ```
  {
    overdueLeads: Lead[],              // pełne wiersze leads z miniętym next_followup, status otwarty
    overdueClients: Client[],          // j.w. dla clients
    dueProjects: Project[],            // pełne wiersze projects: termin <= dziś, status != "Wdrożone"
    overdueInvoices: InvoiceRow[],     // Invoice + netto/vat/brutto/zaplacono (float), po terminie, bez proform
    draftInvoices: InvoiceRow[],       // szkice właściwych faktur z treścią, utworzone przed dziś
    overdueMilestones: { id, nazwa, termin, project_id, projekt: string }[],  // kamienie po terminie, nieukończone
    expiredOffers: (Offer & { kwota: number })[],
    staleContracts: (wybrane pola Contract & { client_nazwa: string|null, silenceDays: number })[],  // wysłane, niepodpisane ≥ tydzień
    dueFollowups: { id, client_id, project_id: string|null, due_date, powod, client_nazwa }[],       // nurture do zrobienia
    pendingMails: { id, from_addr, from_name, subject, received_at, client_nazwa: string|null, lead_nazwa: string|null }[],  // przychodzące, status 'nowy'
    todayEvents: HubEvent[],           // wydarzenia z dzisiejszą datą
    recentNotes: Note[],               // 5 ostatnich po updated_at (bez pól pochodnych JOIN-ów)
    kpi: {
      revenueThisMonth: [string, number][],   // pary [waluta, kwota brutto]
      revenueLastMonth: [string, number][],
      outstanding: [string, number][],        // zaległe brutto - zapłacono, per waluta
      pipeline: number,                       // oferty ważone prawdopodobieństwem (PLN)
      pipelineRaw: number,                    // surowa suma otwartych ofert
      taxReserve: { vat: number, pit: number, zus: number },  // z netto PLN bież. miesiąca
      avgClientRating: number | null,         // średnia średnich ocen z opinii (1-5)
      signedContracts: number | null,         // odsetek projektów z klientem mających podpisaną umowę (null = brak takich projektów)
      reviewsCollected: number,
      closedProjectsCount: number
    },
    counts: { leads: number, clients: number, projects: number, invoices: number, offers: number }
  }
  ```
- **Reguły biznesowe**: proformy nie liczą się do żadnego KPI. Przychód liczony wg daty wystawienia, nie wpłat. Rezerwa podatkowa tylko z PLN. `overdueMilestones` są widoczne NIEZALEŻNIE od terminu całego projektu. `dueFollowups` (nurture automatyczny) i `overdueClients` (ręczny next_followup) to dwa osobne strumienie — scalane dopiero w UI, każdy z własnym powodem.
- **Poziom w apce**: 1 (pulpit = rdzeń mobilny).

# Powiązania (Moduł 30)

## GET /api/links/orphans
- **Po co**: Lista ofert i faktur bez `client_id` („sieroty") + deterministyczne propozycje powiązania z klientem (po NIP, potem po nazwie — nigdy rozmyte, nigdy AI).
- **Auth**: admin-only.
- **Odpowiedź**: `{ orphans: OrphanRow[], clients: { id, nazwa, nip }[] }` gdzie `OrphanRow = { rodzaj: "offer"|"invoice", id, etykieta: string (tytuł oferty / numer faktury), klient_nazwa, klient_nip, propozycja: { clientId, clientNazwa, pewnosc: "nip"|"nazwa" } | null }`. GET niczego nie zapisuje.
- **Reguły**: propozycja tylko przy JEDNOZNACZNYM dopasowaniu (dokładny NIP albo dokładna znormalizowana nazwa, dokładnie jeden kandydat); niejednoznaczność → `propozycja: null`. Projekty świadomie nie mają własnej pozycji na liście (nie mają migawki `klient_*`) — naprawiają się przez ofertę.
- **Poziom w apce**: 3.

## POST /api/links/orphans
- **Po co**: Zatwierdzenie JEDNEGO powiązania (świadomie brak trybu „powiąż wszystkie" — każde to ludzka decyzja).
- **Auth**: admin-only.
- **Żądanie**: `{ rodzaj: "offer"|"invoice", id: string, client_id: string }` (400 przy brakach, 404 gdy klient nie istnieje).
- **Odpowiedź**: `{ ok: true }`.
- **Reguły**: UPDATE zawsze z `AND client_id IS NULL` (nigdy nie nadpisze istniejącego powiązania). Powiązanie oferty naprawia kaskadowo także jej projekt i fakturę (oferta trzyma `project_id`/`invoice_id`), jeśli te też są sierotami. Loguje zdarzenie na osi klienta.
- **Poziom w apce**: 3.

# Wyszukiwarka

## GET /api/search?q=...
- **Po co**: Globalne wyszukiwanie do palety poleceń (Cmd+K) — po CRM i dokumentach naraz. Proste ILIKE (skala jednoosobowej firmy).
- **Auth**: admin-only.
- **Żądanie**: query `q`; przy `q` krótszym niż 2 znaki zwraca komplet pustych tablic (200, nie błąd).
- **Odpowiedź**: `{ leads: Lead[], clients: Client[], projects: Project[], notes: Note[], events: HubEvent[], offers: {id,tytul,status,klient_nazwa}[], invoices: {id,numer:string|null,status,klient_nazwa}[], contracts: {id,typ:"umowa"|"nda",status,klient_nazwa}[] }` — każda kategoria max 6 wyników. CRM zwracany pełnymi wierszami (`SELECT *`), dokumenty wąskimi.
- **Reguły**: pola przeszukiwane: leady (firma, branża), klienci (nazwa, branża), projekty (tytuł, opis), notatki (tytuł, treść, tagi), wydarzenia (tytuł, opis), oferty (tytuł, nazwa klienta), faktury (NUMER, nazwa klienta), umowy (nazwa klienta, zakres prac).
- **Poziom w apce**: 1.

# Powiadomienia (Moduł 24)

## GET /api/notifications
- **Po co**: Kronika zdarzeń pod dzwonek — woła ją każdy ekran panelu, więc lista i licznik w jednym wejściu.
- **Auth**: admin-only.
- **Odpowiedź**: `{ notifications: Notification[], unread: number }` — max 50 wpisów (`NOTIFICATIONS_LIMIT`), created_at DESC; `unread` = liczba z `read_at IS NULL` (globalnie, nie tylko z tych 50).
- **Reguły biznesowe**: dzwonek to KRONIKA, nie skrzynka zadań — „przeczytane" wygasza wpis, nie kasuje. Retencja 30 dni (cron czyści starsze). Nawigacja z wpisu wg `entity`+`entity_id`: `/admin/<leads|mail|invoices|clients|offers|contracts|projects>/<id>`; wyjątek `entity: "cost"` → lista `/admin/costs` (koszty nie mają podstrony rekordu); `entity: null` = wpis bez celu nawigacji.
- **Poziom w apce**: 1 (docelowo źródło push).

## PATCH /api/notifications
- **Po co**: Oznaczenie przeczytania.
- **Auth**: admin-only.
- **Żądanie**: `{ id: string }` (jedno) ALBO `{ all: true }` (wszystkie); inaczej 400.
- **Odpowiedź**: świeże `{ notifications, unread }` (jak GET).
- **Reguły**: `read_at` ustawiane tylko raz (powtórne kliknięcie nie nadpisuje momentu pierwszego przeczytania — kiedyś zdecyduje o push).
- **Poziom w apce**: 1.

# Faktury cykliczne

## GET /api/recurring
- **Po co**: Lista szablonów faktur cyklicznych, z których cron generuje szkice gdy nadejdzie `next_run`.
- **Auth**: admin-only.
- **Odpowiedź**: `{ recurring: RecurringInvoice[] }` — sort `active DESC, next_run ASC`; `pozycje` sparsowane do tablicy obiektów, `termin_dni` jako number.
- **Poziom w apce**: 3.

## POST /api/recurring
- **Po co**: Nowy szablon.
- **Auth**: admin-only.
- **Żądanie**: `{ nazwa (max 200), klient_nazwa (300), klient_nip (30), klient_ulica (300), klient_kod (20), klient_miasto (200), klient_kraj (100), klient_email (200) — stringi; waluta (domyślnie "PLN"), jezyk: "pl"|"en"|"de" (domyślnie "pl"), termin_dni: number ≥ 0 (domyślnie 14), cykl: "miesiecznie"|"kwartalnie"|"rocznie" (domyślnie "miesiecznie"), next_run: "YYYY-MM-DD" (domyślnie dziś), pozycje: RecurringItem[] }`.
- **Odpowiedź**: `{ ok: true, id }`; 500 z komunikatem przy błędzie zapisu.
- **Reguły**: kolejny `next_run` liczony w MIESIĄCACH kalendarzowych (nie dniach) — „co miesiąc" od 31. trzyma dzień miesiąca z naturalnym obcięciem. Cron generuje tylko SZKIC — właściciel i tak ręcznie wystawia/wysyła.
- **Poziom w apce**: 3.

## PATCH /api/recurring/[id]
- **Po co**: Częściowa edycja szablonu — te same pola i walidacje co POST (w tym `active: boolean` do pauzowania).
- **Odpowiedź**: `{ ok: true }`. **Poziom**: 3.

## DELETE /api/recurring/[id]
- **Odpowiedź**: `{ ok: true }`. **Poziom**: 3.

---

# Typy danych

Wyprowadzone z `lib/projects.ts`, `lib/notes.ts`, `lib/events.ts`,
`lib/time-tracking.ts`, `lib/notifications.ts`, `lib/recurring.ts`,
`lib/links.ts`. Wszystkie id to UUID-stringi; `created_at`/`updated_at` to
timestamptz ISO.

## Project

```
{
  id: string,
  tytul: string,
  opis: string,
  status: string,        // enum niżej
  priorytet: string,     // enum niżej
  zdrowie: string,       // enum niżej — RĘCZNA oś, niezależna od statusu
  start: string | null,        // YYYY-MM-DD
  termin: string | null,       // YYYY-MM-DD
  lead_id: string | null,
  client_id: string | null,    // podpięty klient; włącza bramkę umowy i nurture
  kolor: string | null,        // hex akcentu (paleta PROJECT_COLORS)
  ikona: string | null,        // EMOJI (świadomy wyjątek od ikon Tablera; domyślnie "📁")
  jezyk: "pl" | "en" | "de",   // język formularza opinii; dziedziczony z oferty, ręczne = "pl"
  created_at: string,
  updated_at: string,
  // Zamknięcie i opinia (Moduł 15):
  review_token: string | null,
  review_requested_at: string | null,
  review_rating_jakosc: number | null,        // 1-5
  review_rating_terminowosc: number | null,   // 1-5
  review_rating_komunikacja: number | null,   // 1-5
  review_comment: string,
  review_submitted_at: string | null,
  review_consent_case_study: boolean,
  review_consent_text: string | null,     // snapshot treści zgody
  review_consent_name: string | null,
  review_consent_ip: string | null,
  review_consent_user_agent: string | null,
  // Tylko na liście GET /api/projects i /timeline:
  task_total?: number,
  task_done?: number
}
```

Enumy projektu:

- `status`: `"Pomysł"` | `"Planowanie"` | `"W trakcie"` | `"Testy / review"` | `"Wdrożone"` | `"Wstrzymane"`. Zamknięty jest tylko `"Wdrożone"`. Kolory statusów (hex): Pomysł `#64748b`, Planowanie `#8b5cf6`, W trakcie `#4ea7fc`, Testy / review `#E0A93B`, Wdrożone `#10b981`, Wstrzymane `#f97316`.
- `priorytet`: `"Niski"` | `"Normalny"` | `"Wysoki"` | `"Krytyczny"`.
- `zdrowie`: `"Na dobrej drodze"` | `"Zagrożony"` | `"Zerwany"` (ręczne, w stylu Linear).
- Projekt „po terminie" (`isProjectOverdue`): `termin <= dziś` i status ≠ „Wdrożone".
- Szablony projektu (`template` w POST): `"www"`, `"automatyzacja"`, `"audyt"`.
- Paleta `kolor`: `#7C3AED #E0A93B #4ea7fc #22D3EE #10b981 #f59e0b #ef4444 #ec4899 #8b5cf6 #64748b` (domyślny `#4ea7fc`).
- Paleta `ikona`: 16 emoji `📁 🌐 ⚙️ 🔍 🚀 📊 💼 🎨 📝 🤖 💡 🔧 📦 🎯 🛠️ 📈`.

## ProjectTask

```
{ id: string, project_id: string, text: string, done: boolean,
  position: number, milestone_id: string | null, created_at: string }
```

## ProjectActivity

```
{ id: string, project_id: string, text: string,
  kind: "note" | "system",   // "note" = ręczny wpis, "system" = automatyczny log zmiany (renderować dyskretnie)
  created_at: string }
```

## ProjectMilestone

```
{ id: string, project_id: string, nazwa: string,
  termin: string | null, position: number, created_at: string }
```

## ProjectResource

```
{ id: string, project_id: string, etykieta: string, url: string,
  position: number, created_at: string }
```

## ProjectOnboardingItem

```
{ id: string, project_id: string, tekst: string, done: boolean,
  position: number, created_at: string }
```

## TimeEntry

```
{
  id: string,
  project_id: string,
  task_id: string | null,
  source: "manual" | "timer",
  entry_date: string,            // YYYY-MM-DD
  started_at: string | null,     // tylko timer
  ended_at: string | null,       // timer z ended_at == null = AKTYWNY stoper
  minutes: number,               // float; ułamkowe dla krótkich sesji stopera; 0 dla aktywnego
  note: string,
  created_at: string
}
```

Reguły: co najwyżej jeden aktywny stoper globalnie. Suma czasu pomija aktywny
stoper. Formatowanie: poniżej minuty sekundy („42 s"), potem „X min", „H godz.
M min".

## Note

```
{
  id: string,
  tytul: string,
  tresc: string,
  tagi: string,                  // CSV, np. "pomysł, marketing"
  client_id: string | null,      // wzajemnie wyłączne z lead_id (ręczny wybór)
  lead_id: string | null,
  project_id: string | null,     // ustawiane TYLKO przez /promote (ślad, nie pole edycji)
  event_id: string | null,       // ustawiane TYLKO przez /schedule
  pinned: boolean,
  archived_at: string | null,    // niepuste = w archiwum
  created_at: string,
  updated_at: string,
  // pochodne (tylko GET, nie odsyłać PATCH-em):
  project_tytul?: string | null,
  event_data?: string | null,
  log_text?: string | null       // tylko lista; wyłącznie do wyszukiwania
}
```

Zakładki (`NoteTab`): `"all"` | `"pinned"` | `"archived"` — archiwalne widoczne
tylko w „archived".

## NoteActivity

```
{ id: string, note_id: string, text: string, created_at: string }
```

## HubEvent (wydarzenie kalendarza)

```
{
  id: string,
  tytul: string,
  opis: string,
  data: string,                    // YYYY-MM-DD
  godzina: string | null,          // "HH:MM"; null = całodniowe
  data_koniec: string | null,      // koniec zakresu wielodniowego, WŁĄCZNIE; null = jednodniowe
  czas_trwania_min: number | null, // 1-1440; sens tylko z godziną; null → siatka zakłada 60 min
  lead_id: string | null,
  project_id: string | null,
  client_id: string | null,
  created_at: string
}
```

## Deadline (wyliczony termin, tylko GET /api/events/deadlines)

```
{ id: string, data: "YYYY-MM-DD", tytul: string,
  kind: "invoice" | "project" | "milestone" | "lead" | "client" | "call" | "call-missed" | "email",
  href: string, client_id: string | null, lead_id: string | null, project_id: string | null }
```

## Notification

```
{
  id: string,
  kind: NotificationKind,          // tekst w bazie (dokładanie rodzaju bez migracji)
  title: string,
  body: string,
  entity: "lead" | "mail" | "invoice" | "cost" | "client" | "offer" | "contract" | "project" | null,
  entity_id: string | null,
  read_at: string | null,          // null = nieprzeczytane
  created_at: string
}

NotificationKind = "lead_new" | "mail_new" | "mail_nudge" | "invoice_paid"
  | "invoice_reminder" | "invoice_dunning" | "recurring_invoice" | "recurring_cost"
  | "offer_accepted" | "contract_signed" | "review_collected"
```

Stałe: limit listy 50, retencja 30 dni. Wiek pokazywany względnie („2 godz.
temu"), powyżej tygodnia — data dzienna.

## RecurringInvoice

```
{
  id: string,
  nazwa: string,
  klient_nazwa: string, klient_nip: string, klient_ulica: string,
  klient_kod: string, klient_miasto: string, klient_kraj: string, klient_email: string,
  waluta: string,                          // domyślnie "PLN"
  jezyk: "pl" | "en" | "de",
  termin_dni: number,                      // domyślnie 14
  pozycje: RecurringItem[],
  cykl: "miesiecznie" | "kwartalnie" | "rocznie",
  next_run: string,                        // YYYY-MM-DD
  active: boolean,
  created_at: string, updated_at: string
}

RecurringItem = { nazwa: string, ilosc: number, jednostka: string,
                  cena_netto: number, vat_stawka: string }   // "23", "8", "zw", "np"…
```

## LinkValue / LinkKind (słownik powiązań, Moduł 22/30)

```
LinkKind  = "client" | "lead" | "project"
LinkValue = { client_id?: string|null, lead_id?: string|null, project_id?: string|null }
```

Reguła ręcznego wyboru: wybór jest WYŁĄCZNY w obrębie oferowanych rodzajów —
wybranie klienta czyści leada i odwrotnie; `null` czyści wszystko. Wyjątek:
automatyczne dziedziczenie (akceptacja oferty, promote/schedule notatki)
ustawia kilka pól naraz jako ślad pochodzenia. Priorytet odczytu przy obu
ustawionych: klient przed leadem.
