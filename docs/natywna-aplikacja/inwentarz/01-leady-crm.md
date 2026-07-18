# Inwentarz API — Leady, Klienci, Kontakty, Telefonia, Admin

Specyfikacja samowystarczalna — pisana dla aplikacji natywnej (SwiftUI), która NIE ma dostępu
do kodu backendu. Backend: Next.js App Router na Vercelu, baza Postgres (Neon). Wszystkie
odpowiedzi to JSON (chyba że zaznaczono CSV). Daty zapisywane jako `YYYY-MM-DD` (string);
znaczniki czasu (`created_at` itd.) jako ISO 8601 z bazy.

Konwencja błędów: `401 {"error":"unauthorized"}` przy braku autoryzacji,
`400 {"error":"..."}` przy złym żądaniu, `404 {"error":"not found"}`, `500 {"error":"..."}`.

## Spis tras

| Metoda | Ścieżka | Po co | Poziom |
|---|---|---|---|
| POST | `/api/admin/login` | Logowanie: cookie (web) lub token per-urządzenie (apka) | 1 |
| POST | `/api/admin/logout` | Wylogowanie / unieważnienie tokenu urządzenia | 1 |
| GET | `/api/admin/devices` | Lista urządzeń zalogowanych tokenem | 1 |
| DELETE | `/api/admin/devices/:id` | Odebranie urządzeniu dostępu | 1 |
| GET | `/api/leads` | Lista wszystkich leadów | 1 |
| POST | `/api/leads` | Utworzenie leada (PUBLICZNE — formularz na stronie) | 1 |
| GET | `/api/leads/:id` | Jeden lead + jego log aktywności | 1 |
| PATCH | `/api/leads/:id` | Edycja pól leada | 1 |
| DELETE | `/api/leads/:id` | Usunięcie leada | 1 |
| POST | `/api/leads/:id/activity` | Wpis do logu kontaktu (+ opcjonalna aktualizacja dat) | 1 |
| DELETE | `/api/leads/:id/activity/:activityId` | Usunięcie jednego wpisu logu | 1 |
| GET | `/api/leads/:id/changes` | Audyt zmian pól leada | 2 |
| POST | `/api/leads/:id/promote` | „Utwórz klienta" z leada (idempotentne) | 1 |
| POST | `/api/leads/discover` | Auto-wyszukiwanie firm (OpenStreetMap) | 3 |
| GET | `/api/leads/export` | Eksport CSV rejestru leadów | 3 |
| GET | `/api/leads/notify` | Dzienny raport (TYLKO cron Vercela, `CRON_SECRET`) | 3 |
| POST | `/api/leads/notify` | Ręczne wysłanie dziennego raportu | 3 |
| GET | `/api/clients` | Lista klientów (+ średnia ocen) | 1 |
| POST | `/api/clients` | Utworzenie klienta (ręczne / z leada) | 1 |
| GET | `/api/clients/:id` | Klient + scalony feed + powiązane rekordy | 1 |
| PATCH | `/api/clients/:id` | Edycja pól karty klienta | 1 |
| DELETE | `/api/clients/:id` | Usunięcie klienta (powiązania odpinane, nie kasowane) | 2 |
| POST | `/api/clients/:id/activity` | Wpis do historii kontaktu klienta | 1 |
| DELETE | `/api/clients/:id/activity/:activityId` | Usunięcie jednego wpisu historii | 1 |
| GET | `/api/clients/:id/changes` | Audyt zmian pól klienta | 2 |
| PATCH | `/api/client-followups/:id` | Oznaczenie kontaktu nurture jako obsłużonego | 1 |
| GET | `/api/client-followups/:id/draft` | Szkic wiadomości retencyjnej (nurture) | 1 |
| POST | `/api/client-followups/:id/send` | Wysłanie zaakceptowanej wiadomości nurture | 1 |
| GET | `/api/contacts/lookup` | Dopasowanie leada/klienta po numerze telefonu | 1 |
| POST | `/api/telefonia/webhook` | Webhook VoIP — automatyczny log połączenia (token w URL) | 3 |

---

## Autoryzacja — fundament logowania apki

Panel jest jednoosobowy: jedno hasło administratora (`ADMIN_PASSWORD`), brak ról i
wielu użytkowników. Backend akceptuje DWA równoległe kanały uwierzytelnienia,
sprawdzane w `isAuthed()` przy każdym żądaniu admin-only:

1. **Cookie sesji** (panel webowy): `leggera_admin_session`, httpOnly, secure,
   sameSite=lax, ważne 30 dni. Wartość = SHA-256(`hasło:sekret`). Apka NIE używa.
2. **Token per-urządzenie** (aplikacja natywna): nagłówek
   `Authorization: Bearer <token>`. Token to 64 znaki hex (32 losowe bajty).
   W bazie leży wyłącznie jego SHA-256 — pełną wartość apka widzi **jeden raz**,
   w odpowiedzi logowania; musi ją schować w Keychain. Jeśli nagłówek Bearer jest
   obecny, jest sprawdzany PRZED cookie. Każde poprawne użycie aktualizuje
   `last_used_at` urządzenia. Token odwołany (`revoked_at` ustawione) → 401.

Uwaga: `Authorization: Bearer` jest też używane przez `/api/leads/notify` (GET) z
`CRON_SECRET` — to osobny mechanizm, nie tokeny urządzeń.

## POST /api/admin/login
- **Po co**: Logowanie. Dwa tryby rozpoznawane po treści body — przeglądarkowy
  (cookie) i natywny (token per-urządzenie).
- **Auth**: publiczna (to jest właśnie punkt wejścia).
- **Żądanie** (JSON body):
  - `password` (string, wymagane) — hasło administratora.
  - `device` (string, opcjonalne) — nazwa urządzenia, np. `"iPhone Patryka"`.
    Niepusty string włącza tryb natywny. Ucinane do 100 znaków.
- **Odpowiedź**:
  - Tryb natywny (jest `device`): `{ ok: true, device_id: string(uuid), token: string(64 hex) }`
    — cookie NIE jest ustawiane. Token pojawia się TYLKO tutaj.
  - Tryb webowy (brak `device`): `{ ok: true }` + Set-Cookie sesji.
  - Złe hasło / brak: `401 { error: "invalid credentials" }`.
- **Reguły biznesowe**: każde logowanie z `device` tworzy NOWY wiersz w
  `device_tokens` (nie nadpisuje starych) — ponowne logowanie na tym samym
  telefonie zostawia stary token jako osobne urządzenie na liście. Apka powinna
  logować się raz i trzymać token; przy 401 pokazać ekran logowania od nowa.
- **Poziom w apce**: 1.

## POST /api/admin/logout
- **Po co**: Wylogowanie bieżącej sesji/urządzenia.
- **Auth**: żadna wprost (działa na tym, co żądanie niesie) — apka wysyła swój Bearer.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true }` (zawsze, nawet bez tokenu).
- **Reguły biznesowe**: gdy żądanie niesie `Authorization: Bearer`, token TEGO
  urządzenia dostaje `revoked_at = now()` w bazie (trwałe — kolejne żądania z nim
  dostaną 401). Przy cookie — kasuje cookie. Apka po wylogowaniu musi też usunąć
  token z Keychain.
- **Poziom w apce**: 1.

## GET /api/admin/devices
- **Po co**: Lista urządzeń zalogowanych tokenem (aplikacja natywna) — ekran
  „urządzenia z dostępem" / zarządzanie zgubionym telefonem.
- **Auth**: admin-only (`isAuthed()` — cookie lub Bearer).
- **Żądanie**: brak parametrów.
- **Odpowiedź**: `{ devices: Device[] }`, sortowane po `last_used_at` malejąco:
  - `id` string (uuid)
  - `device_name` string
  - `created_at` string (timestamp)
  - `last_used_at` string | null (timestamp)
  - `revoked_at` string | null (timestamp; ≠ null = dostęp odebrany)
  Hashe tokenów NIGDY nie są zwracane.
- **Reguły biznesowe**: wiersze odwołane zostają na liście jako ślad — apka
  powinna je pokazywać jako „odebrano dostęp", nie ukrywać.
- **Poziom w apce**: 1.

## DELETE /api/admin/devices/:id
- **Po co**: Odebranie urządzeniu dostępu jednym kliknięciem (zgubiony telefon),
  bez zmiany hasła.
- **Auth**: admin-only.
- **Żądanie**: `:id` = id urządzenia z listy. Brak body.
- **Odpowiedź**: `{ ok: true }` (idempotentne — ponowne wywołanie nic nie zmienia,
  UPDATE ma warunek `revoked_at IS NULL`).
- **Reguły biznesowe**: ustawia `revoked_at = now()`; wiersz zostaje. Kolejne
  żądania z tokenem tego urządzenia → 401. UWAGA: apka może tym odwołać token,
  którym sama się właśnie autoryzuje — wtedy następne żądanie dostanie 401.
- **Poziom w apce**: 1.

---

## Leady

## GET /api/leads
- **Po co**: Cała lista leadów (żywy rejestr — bez paginacji, sort po
  `created_at` malejąco). Podstawa widoku kanban/tabeli.
- **Auth**: admin-only.
- **Żądanie**: brak parametrów.
- **Odpowiedź**: `{ leads: Lead[] }` — pełne wiersze (patrz typ **Lead** niżej).
- **Reguły biznesowe**: filtrowanie/wyszukiwanie odbywa się PO STRONIE klienta
  (panel tak robi). Do wyliczania „wymaga działania dziś" patrz reguła
  `isOverdue` w sekcji Typy danych.
- **Poziom w apce**: 1.

## POST /api/leads
- **Po co**: Utworzenie leada. Obsługuje zarówno publiczny formularz kontaktowy
  na stronie marketingowej, jak i „+ Dodaj lead" z panelu.
- **Auth**: **PUBLICZNA — celowo bez auth** (żeby formularz na stronie mógł
  wywołać wprost; świadomy, niskoryzykowny kompromis).
- **Żądanie** (JSON body; wszystkie stringi, obcinane do limitów):
  - `firma` (wymagane, niepuste; max 300)
  - `osoba_kontaktowa` (200), `branza` (200), `kontakt` (300, deprecated),
    `telefon` (100), `email` (200), `www` (200),
    `ulica` (300), `kod` (20), `miasto` (200), `kraj` (100),
    `zrodlo_kategoria` (100), `zrodlo` (200),
    `status` (100; domyślnie `"Do kontaktu"` gdy puste),
    `notatki` (4000),
    `ostatni_kontakt` (string daty lub pomijane → null).
- **Odpowiedź**: `{ ok: true, id: string(uuid) }`; `400 { error: "firma is required" }`.
- **Reguły biznesowe**:
  - Jeśli podano niepusty `email` — backend od razu próbuje dopiąć do leada
    nieprzypisaną korespondencję z modułu Poczta (rematch; błędy łykane).
  - **Powiadomienie (dzwonek) tworzy się TYLKO gdy `zrodlo_kategoria ===
    "Formularz na stronie"`** (kind `lead_new`). Lead dodany ręcznie z panelu
    powinien iść z `zrodlo_kategoria: "Ręcznie dodane"` — wtedy dzwonek milczy
    (decyzja: powiadomienia tylko dla zdarzeń z zewnątrz).
  - Formularz publiczny wysyła status `"Nowe zgłoszenie ze strony"` — taki lead
    jest zawsze „wymaga działania dziś" aż do zmiany statusu.
  - Duplikaty: NIE ma blokady po stronie serwera. Panel przed dodaniem robi
    miękkie ostrzeżenie porównując znormalizowane nazwy firm (bez diakrytyków,
    interpunkcji, wielkości liter; trafienie = identyczne albo jedna zawiera
    drugą). Apka powinna zrobić to samo lokalnie na liście z GET /api/leads.
- **Poziom w apce**: 1.

## GET /api/leads/:id
- **Po co**: Profil leada — rekord + pełny log aktywności.
- **Auth**: admin-only.
- **Odpowiedź**: `{ lead: Lead, activity: Activity[] }` (aktywność sortowana
  `created_at` malejąco). Audyt zmian pól celowo NIE jest tu dołączany — osobny
  endpoint `/changes`, dociągany dopiero po otwarciu zakładki.
- **Poziom w apce**: 1.

## PATCH /api/leads/:id
- **Po co**: Edycja dowolnego podzbioru pól leada — wysyłasz tylko te klucze,
  które zmieniasz.
- **Auth**: admin-only.
- **Żądanie** (JSON body — każde pole opcjonalne; obecność klucza = zapis):
  - stringi: `firma`, `osoba_kontaktowa`, `branza`, `kontakt`, `telefon`,
    `email`, `www`, `linkedin_url`, `ulica`, `kod`, `miasto`, `kraj`,
    `zrodlo_kategoria`, `zrodlo`, `status`, `notatki`,
    `next_action` (ucinane do 500)
  - daty: `ostatni_kontakt`, `next_followup` — string `YYYY-MM-DD`; pusty
    string/`""` = wyczyść (null); niepoprawna/nierealna data (walidacja
    `isPlausibleDateString`, m.in. rok 4-cyfrowy w sensownym zakresie) →
    `400 { error: "invalid ostatni_kontakt" | "invalid next_followup" }`.
  - `client_id` (string uuid lub null/`""` = odepnij) — powiązanie z ISTNIEJĄCYM
    klientem; celowo nie trafia do audytu zmian.
- **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**:
  - `status` NIE jest walidowany serwerowo względem listy — apka MUSI wysyłać
    wyłącznie wartości z `STATUSES` (patrz Typy danych), inaczej zepsuje kanban.
  - Zmiana `email` na niepusty → automatyczny rematch nieprzypisanej poczty.
  - Każdy PATCH zapisuje audyt zmienionych pól (Moduł 23) — porównanie
    stara/nowa wartość; widoczne potem w `GET /:id/changes`.
- **Poziom w apce**: 1.

## DELETE /api/leads/:id
- **Po co**: Usunięcie leada (wraz z jego `lead_activity` — kaskada w bazie).
- **Auth**: admin-only.
- **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 1.

## POST /api/leads/:id/activity
- **Po co**: Dopisanie wpisu do logu kontaktu („zadzwoniłem, obiecał odpowiedź
  do piątku") i — w tym samym żądaniu — opcjonalna aktualizacja
  `ostatni_kontakt`/`next_followup` leada. To jest serce „szybkiego logowania
  rozmowy" w apce.
- **Auth**: admin-only.
- **Żądanie** (JSON body):
  - `text` (string, wymagane, niepuste; max 4000)
  - `kanal` (opcjonalne; jedna z `CONTACT_CHANNELS`: `"telefon" | "email" |
    "whatsapp" | "linkedin" | "spotkanie" | "inne"`; inna wartość → null)
  - `kierunek` (opcjonalne; `"wychodzacy" | "przychodzacy"`; inna wartość → null)
  - `wynik` (opcjonalne; `"odebrane" | "nieodebrane"`; sens tylko dla telefonu)
  - `czas_trwania_sek` (number, opcjonalne) — zapisywany TYLKO gdy
    `wynik === "odebrane"`; zaokrąglany, obcinany do 86400 s; w innym wypadku null.
  - `ostatni_kontakt` (string daty, opcjonalne) — gdy poprawna, aktualizuje leada;
    razem z nią `ostatni_kanal` leada dostaje wartość `kanal` (jeśli podany).
  - `next_followup` (opcjonalne) — **obecność klucza ma znaczenie**: pusty
    string = wyczyść przypomnienie ORAZ wyzeruj `next_action`; poprawna data =
    ustaw datę i zapisz `next_action` (z body, max 500). Klucza brak = nie ruszaj.
  - `next_action` (string, opcjonalne) — zapisywany tylko razem z ustawianym
    `next_followup`.
- **Odpowiedź**: `{ ok: true, activity: Activity[] }` — CAŁY zaktualizowany log
  (malejąco po `created_at`). `404` gdy leada nie ma.
- **Reguły biznesowe**: niepoprawna data w `ostatni_kontakt`/`next_followup`
  jest PO CICHU ignorowana (wpis logu i tak powstaje) — apka powinna walidować
  daty przed wysyłką.
- **Poziom w apce**: 1 (kluczowa funkcja mobilna).

## DELETE /api/leads/:id/activity/:activityId
- **Po co**: Usunięcie jednego wpisu logu (poprawka literówki itp.).
- **Auth**: admin-only.
- **Odpowiedź**: `{ ok: true }`. Nie cofa zmian `ostatni_kontakt`/`next_followup`,
  które wpis wykonał przy tworzeniu.
- **Poziom w apce**: 1.

## GET /api/leads/:id/changes
- **Po co**: Log zmian pól leada (audyt, Moduł 23) — „kiedy i z czego na co".
- **Auth**: admin-only.
- **Odpowiedź**: `{ changes: FieldChange[] }` — max 300 najnowszych:
  `{ id, field, old_value: string|null, new_value: string|null, created_at }`.
  `field` to surowa nazwa kolumny (np. `zrodlo_kategoria`) — apka powinna mieć
  własną mapę polskich etykiet.
- **Poziom w apce**: 2 (zakładka podglądowa).
- **Uwaga UI**: panel pokazuje wartości ucięte do 80 znaków z „pokaż całość".

## POST /api/leads/:id/promote
- **Po co**: Ręczne „Utwórz klienta" z leada — gdy realna rozmowa trwa, zanim
  powstała oferta (druga, automatyczna ścieżka awansu to utworzenie pierwszej
  oferty dla leada).
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**:
  - lead już ma klienta: `{ ok: true, id: <client_id>, alreadyExisted: true }`
  - utworzono: `{ ok: true, id: <nowy client_id> }`
  - `404` gdy leada nie ma.
- **Reguły biznesowe**: **idempotentne** — nigdy nie tworzy duplikatu. Kopiuje
  do klienta: firma→nazwa, branza, telefon, email, www, ulica, kod, miasto,
  kraj, osoba_kontaktowa, linkedin_url, zrodlo, zrodlo_kategoria, notatki;
  ustawia `clients.lead_id` i `leads.client_id` (dwukierunkowe powiązanie).
  Dopisuje zdarzenie systemowe `client_created` („Ręcznie utworzony z leada")
  na osi czasu klienta.
- **Poziom w apce**: 1.

## POST /api/leads/discover
- **Po co**: Auto-wyszukiwanie realnych firm danej branży w okolicy przez
  darmowe dane OpenStreetMap (Nominatim + Overpass) i dopisanie ich jako leady.
- **Auth**: admin-only.
- **Żądanie** (JSON body):
  - `branza` (string, wymagane) — MUSI być jedną z obsługiwanych:
    `"Kancelaria prawna"`, `"Biuro rachunkowe"`, `"Kancelaria notarialna"`,
    `"Klinika stomatologiczna / prywatna"`, `"Biuro nieruchomości"`,
    `"Firma doradcza / consulting"` — inaczej `400`.
  - `lokalizacja` (string, wymagane) — np. `"Warszawa, Wilanów"`.
  - `ile` (number, opcjonalne) — limit dodanych, klamrowane do 1..15, domyślnie 8.
- **Odpowiedź**: `{ ok: true, added: number, skipped: number, leads: [{ firma: string }] }`;
  `400` z polskim komunikatem przy złej branży / nieznalezionej lokalizacji;
  `502` przy błędzie Overpass.
- **Reguły biznesowe**: promień 6 km od zgeokodowanego punktu; duplikaty
  pomijane po dokładnej (case-insensitive) nazwie firmy; nowe leady dostają
  `status: "Do kontaktu"`, `zrodlo_kategoria: "Automatyczne wyszukiwanie"`,
  `zrodlo: <lokalizacja>`. Może trwać do 30 s (maxDuration).
- **Poziom w apce**: 3 (desktop).

## GET /api/leads/export
- **Po co**: Eksport rejestru leadów do CSV (np. dla księgowej).
- **Auth**: admin-only.
- **Żądanie** (query): opcjonalne `?ids=uuid1,uuid2,...` — zawęża do podanych
  rekordów (id niepasujące do wzorca uuid są odfiltrowane; pusta lista po
  filtracji = CSV z samymi nagłówkami, celowo NIE „cały rejestr").
- **Odpowiedź**: plik `text/csv` (`Content-Disposition: attachment;
  filename="leady_<data>.csv"`), kolumny: Firma, Osoba kontaktowa, Branża,
  Telefon, Email, WWW, Ulica, Kod, Miasto, Kraj, Źródło, Status, Ostatni
  kontakt, Przypomnij mi, Notatki.
- **Poziom w apce**: 3.

## GET /api/leads/notify
- **Po co**: Dzienny raport-cron — jeden mail spinający cały panel + efekty
  uboczne (przypomnienia o fakturach, generowanie faktur/kosztów cyklicznych,
  sync poczty, retencja). Wywoływane raz dziennie przez Vercel Cron.
- **Auth**: **NIE dla apki** — wymaga `Authorization: Bearer <CRON_SECRET>`
  (sekret crona, nie token urządzenia). Fail-closed: brak `CRON_SECRET` w env →
  500 i blokada.
- **Odpowiedź**: `{ ok: true, sent: true, overdue, total, invoiceReminders,
  recurringGenerated, recurringCostsGenerated }`.
- **Reguły biznesowe** (ważne, bo to samo robi POST poniżej): wysyła mail na
  `kontakt@leggeralabs.pl` z sekcjami: leady wymagające działania (reguła
  `isOverdue`), klienci z ręcznym przypomnieniem, kontakty nurture wymagalne,
  maile do odpowiedzi, wątki bez odpowiedzi, projekty/kamienie po terminie,
  umowy czekające na podpis, faktury-szkice, dzisiejszy kalendarz. Po drodze:
  automatyczne przypomnienia mailowe o zaległych fakturach (eskalacja +3/+10/+21
  dni, poziom 3 = formalne wezwanie), generowanie szkiców faktur i kosztów
  cyklicznych, sync skrzynki IMAP + retencja poczty (24 mies.) i powiadomień
  (30 dni), powiadomienia `mail_nudge` o milczących wątkach.
- **Poziom w apce**: 3 (apka tego nie woła).

## POST /api/leads/notify
- **Po co**: Ręczne „Wyślij raport teraz" — dokładnie ten sam pipeline co cron.
- **Auth**: admin-only (`isAuthed()` — apka MOŻE to wywołać Bearerem urządzenia).
- **Żądanie**: brak body.
- **Odpowiedź**: jak GET.
- **Reguły biznesowe**: UWAGA — to nie jest „tylko mail": każde wywołanie może
  realnie wysłać klientom przypomnienia o fakturach i wygenerować dokumenty
  cykliczne. Nie podpinać pod przypadkowy gest.
- **Poziom w apce**: 3.

---

## Klienci

## GET /api/clients
- **Po co**: Lista klientów do kanbanu/tabeli, z dociągniętą średnią oceną
  z opinii po projektach.
- **Auth**: admin-only.
- **Odpowiedź**: `{ clients: Client[] }` (sort `created_at` malejąco). Każdy
  wiersz = typ **Client** + `avg_rating: number|null` (średnia trzech ocen
  1–5 ze wszystkich zebranych opinii; null gdy brak opinii — to pole liczone,
  nie kolumna).
- **Poziom w apce**: 1.

## POST /api/clients
- **Po co**: Ręczne utworzenie klienta — z modułu Klienci (kontakt „gotowy" z
  polecenia) albo z leada.
- **Auth**: admin-only.
- **Żądanie** (JSON body, wszystko opcjonalne):
  - `nazwa` (300), `nip` (30), `ulica` (300), `kod` (20), `miasto` (200),
    `kraj` (100), `email` (200), `telefon` (100), `www` (200), `branza` (200)
  - `status` — jedna z `CLIENT_STATUSES` (`"Prospekt" | "Aktywny" | "Uśpiony" |
    "Stracony"`); inna/brak → `"Prospekt"`.
  - `lead_id` (uuid, opcjonalne) — powiązanie z leadem.
- **Odpowiedź**: `{ ok: true, id: string(uuid) }`.
- **Reguły biznesowe**: gdy podano `lead_id` a `nazwa` pusta — dane startowe
  (firma, branza, telefon, email, www) kopiowane z leada; leadowi ustawiane
  `client_id`. Niepusty email → rematch nieprzypisanej poczty. UWAGA: ta trasa
  (inaczej niż `/promote`) NIE jest idempotentna i NIE kopiuje adresu/źródła/
  osoby kontaktowej — do awansu leada preferuj `POST /api/leads/:id/promote`.
- **Poziom w apce**: 1.

## GET /api/clients/:id
- **Po co**: Pełny profil klienta: rekord + JEDEN scalony chronologiczny feed
  (notatki klienta + historia z leada sprzed awansu + zdarzenia systemowe) +
  powiązane oferty/faktury/projekty/umowy + kartoteka korespondencji.
- **Auth**: admin-only.
- **Odpowiedź**: `{ client, feed, offers, invoices, projects, contracts, mail }`:
  - `client`: typ **Client** (surowy wiersz, bez `avg_rating`).
  - `feed`: tablica scalona, sort `created_at` malejąco, każdy element:
    `{ id, created_at, kind, text, amount: number|null, kanal, kierunek, wynik,
    czas_trwania_sek, related_id: string|null, mail_message_id: string|null,
    source: "client"|"lead"|"system" }`. Dla wpisów ręcznych `kind === "note"`;
    dla systemowych `kind` = jedna z `CLIENT_EVENT_KINDS` (patrz Typy danych),
    `amount` np. kwota wpłaty, `related_id` = id powiązanego rekordu
    (oferta/faktura/projekt/umowa — cel wg mapy `CLIENT_EVENT_TARGET`).
    `source: "lead"` = wpis sprzed awansu (UI pokazuje z tagiem).
  - `offers`: `{ id, tytul, status, wazna_do, created_at }[]`
  - `invoices`: `{ id, numer, status, typ_dokumentu, created_at }[]`
  - `projects`: `{ id, tytul, status, termin, created_at }[]`
  - `contracts`: `{ id, typ, status, project_id, accepted_at, created_at }[]`
  - `mail`: `{ id, subject, kierunek, status, received_at }[]` (max 100 najnowszych)
- **Reguły biznesowe**: audyt zmian osobno w `/changes` (leniwe dociąganie).
- **Poziom w apce**: 1 (podgląd powiązanych rekordów — poziom 2, ale feed i
  wizytówka to rdzeń mobilny).

## PATCH /api/clients/:id
- **Po co**: Edycja pól karty klienta (podzbiór — wysyłasz co zmieniasz).
- **Auth**: admin-only.
- **Żądanie** (JSON body; obecność klucza = zapis):
  - stringi z limitami: `nazwa` (300), `nip` (30), `ulica` (300), `kod` (20),
    `miasto` (200), `kraj` (100), `email` (200), `telefon` (100), `www` (200),
    `linkedin_url` (300), `next_action` (500), `branza` (200), `notatki` (4000)
  - `status` — waliduje względem `CLIENT_STATUSES`; niepoprawna wartość jest
    PO CICHU zamieniana na `"Prospekt"` (uwaga: to inna semantyka niż u leadów).
  - daty `ostatni_kontakt`, `next_followup` — jak u leada: pusty string = null,
    niepoprawna → `400`.
- **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**: zmiana `email` → rematch poczty; każdy PATCH zapisuje
  audyt zmian (widoczny w `/changes`). Pola `zrodlo`/`zrodlo_kategoria`/
  `osoba_kontaktowa` NIE są edytowalne tą trasą (kopiowane raz przy awansie).
- **Poziom w apce**: 1.

## DELETE /api/clients/:id
- **Po co**: Usunięcie klienta.
- **Auth**: admin-only.
- **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**: powiązane leady/oferty/faktury/projekty NIE są usuwane —
  tylko odpinane (`client_id → NULL`, ON DELETE SET NULL). Historia
  aktywności/zdarzeń klienta znika razem z nim.
- **Poziom w apce**: 2 (akcja rzadka; w apce co najwyżej z potwierdzeniem).

## POST /api/clients/:id/activity
- **Po co**: Wpis do historii kontaktu klienta — identyczny kontrakt jak
  `POST /api/leads/:id/activity` (kanał, kierunek, wynik, czas trwania,
  opcjonalna aktualizacja `ostatni_kontakt`/`next_followup`/`next_action`).
- **Auth**: admin-only.
- **Żądanie**: jak u leada (`text` wymagane; reszta identyczna).
- **Odpowiedź**: `{ ok: true, activity: ClientActivity[] }` — UWAGA: zwraca
  tylko `client_activity` (bez wpisów z leada i zdarzeń systemowych) — po
  dopisaniu wpisu apka powinna raczej odświeżyć cały `GET /api/clients/:id`,
  żeby feed pozostał scalony.
- **Poziom w apce**: 1 (szybkie logowanie rozmowy).

## DELETE /api/clients/:id/activity/:activityId
- **Po co**: Usunięcie jednego wpisu historii kontaktu klienta.
- **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**: usuwa tylko wpisy `client_activity` — wpisów z leada
  (source `"lead"`) i zdarzeń systemowych (source `"system"`) NIE da się tędy
  usunąć; apka nie powinna pokazywać na nich przycisku usuwania.
- **Poziom w apce**: 1.

## GET /api/clients/:id/changes
- **Po co**: Audyt zmian pól klienta — jak u leada.
- **Auth**: admin-only.
- **Odpowiedź**: `{ changes: FieldChange[] }` (max 300, malejąco).
- **Poziom w apce**: 2.

---

## Nurture (client-followups)

Kontekst: po przestawieniu projektu na „Wdrożone" backend sam planuje DWA
kontakty retencyjne (`client_followups`): **+14 dni** („kontakt kontrolny:
referencja/opinia") i **+90 dni** („kontakt kontrolny: kolejna automatyzacja") —
`NURTURE_OFFSETS`, deterministycznie, zero AI. Kontakt wymagalny =
`due_date <= dziś` i `done_at IS NULL` — takie pokazuje Pulpit i dzienny mail.
Panel NIGDY nie wysyła nic sam: model draft → edycja → jawne „wyślij".

## PATCH /api/client-followups/:id
- **Po co**: Oznaczenie zaplanowanego kontaktu nurture jako obsłużonego
  (przycisk „Obsłużone" na Pulpicie) — np. gdy kontakt odbył się telefonicznie.
- **Auth**: admin-only. **Żądanie**: brak body. **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**: ustawia `done_at = now()`; bez maila, bez zdarzenia na
  osi. Idempotentne.
- **Poziom w apce**: 1.

## GET /api/client-followups/:id/draft
- **Po co**: Wygenerowanie (bez wysyłki) szkicu wiadomości retencyjnej do
  przejrzenia/edycji.
- **Auth**: admin-only.
- **Odpowiedź**: `{ text: string, days: 14|90, clientEmail: string|null }`.
  `404` gdy followup nie istnieje.
- **Reguły biznesowe**: wariant (14 vs 90 dni) rozpoznawany po polu `powod`
  followupa (dopasowanie do `NURTURE_OFFSETS`; nieznany powód → 90). Język
  szkicu = język projektu (`pl`/`en`/`de`, domyślnie pl). Wariant 14-dniowy
  zawiera link do formularza opinii (`/pl/opinia/<token>`; token projektu
  tworzony idempotentnie przy tym wywołaniu) — POMIJANY, jeśli opinia już
  zebrana. Oba warianty kończą się prośbą o polecenie. Treść generowana
  szablonem, zero LLM.
- **Poziom w apce**: 1.

## POST /api/client-followups/:id/send
- **Po co**: Wysłanie klientowi mailem ZAAKCEPTOWANEJ (możliwie edytowanej)
  treści kontaktu nurture i oznaczenie followupa jako obsłużonego.
- **Auth**: admin-only.
- **Żądanie** (JSON body): `body` (string, wymagane, niepuste) — finalna treść
  zatwierdzona przez właściciela.
- **Odpowiedź**: `{ ok: true }`; `400 { error: "Brak treści wiadomości." }`;
  `400` z komunikatem gdy klient nie ma e-maila; `404`; `500 { error: "Błąd
  wysyłki: ..." }`.
- **Reguły biznesowe**: temat maila backend układa SAM z języka projektu i
  wariantu 14/90 (apka nie wysyła tematu). Po udanej wysyłce: `done_at = now()`
  + zdarzenie systemowe `nurture_contact_sent` na osi klienta. Wysyłka
  wyłącznie po jawnym kliknięciu użytkownika.
- **Poziom w apce**: 1.

---

## Kontakty i telefonia

## GET /api/contacts/lookup
- **Po co**: Dopasowanie leada/klienta po numerze telefonu — pod mobilną
  „szybką notatkę" (zadzwonił ktoś → kim jest → od razu wpis do logu).
- **Auth**: admin-only.
- **Żądanie** (query): `?telefon=...` — dowolny format zapisu (spacje,
  myślniki, +48/48/0 — normalizowane).
- **Odpowiedź**: `{ matches: ContactMatch[] }`,
  `ContactMatch = { type: "lead"|"client", id: string, nazwa: string }`.
- **Reguły biznesowe**: porównanie po OSTATNICH 9 cyfrach numeru; numer krótszy
  niż 6 cyfr → zawsze pusta lista. **Klienci przed leadami** (aktualniejsza
  relacja). Może być wiele trafień — apka daje wybór; przy zero trafień
  proponuje utworzenie leada.
- **Poziom w apce**: 1.

## POST /api/telefonia/webhook
- **Po co**: Automatyczne logowanie połączeń od dostawcy VoIP. Endpoint gotowy,
  ale JESZCZE NIEUŻYWANY (brak konta VoIP) — nazwy pól payloadu do dopasowania
  przy podłączaniu konkretnego dostawcy.
- **Auth**: **token w query stringu**: `?token=<TELEFONIA_WEBHOOK_SECRET>` (nie
  nagłówek — dostawcy VoIP zwykle pozwalają skonfigurować tylko URL).
  Fail-closed: brak sekretu w env → 500 i blokada. NIE dla apki — apka używa
  `GET /api/contacts/lookup` + `POST .../activity`.
- **Żądanie** (JSON body):
  - `telefon` (string, wymagane) — numer drugiej strony
  - `kierunek` (`"wychodzacy"|"przychodzacy"`, opcjonalne)
  - `wynik` (`"odebrane"|"nieodebrane"`, opcjonalne)
  - `czas_trwania_sek` (number, opcjonalne; tylko przy `wynik="odebrane"`)
  - `opis` (string, opcjonalne; domyślnie „Połączenie (automatycznie z VoIP)")
- **Odpowiedź**: `{ matched: false }` (status 200!) gdy numer nikogo nie
  dotyczy; `{ matched: true, type: "lead"|"client", id }` po zapisie.
- **Reguły biznesowe**: bierze PIERWSZE trafienie z lookupu (klient przed
  leadem); dopisuje wpis aktywności z `kanal="telefon"` i aktualizuje
  `ostatni_kontakt = dziś` + `ostatni_kanal = "telefon"` rekordu.
- **Poziom w apce**: 3 (integracja serwer-serwer; opisany dla kompletności).

---

# Typy danych

## Lead

| Pole | Typ | Uwagi |
|---|---|---|
| `id` | string (uuid) | |
| `firma` | string | wymagane przy tworzeniu |
| `osoba_kontaktowa` | string | |
| `branza` | string | wolny tekst |
| `kontakt` | string | DEPRECATED — zlepek sprzed rozbicia na telefon/email/www; tylko stare wpisy |
| `telefon` | string | dowolny format zapisu |
| `email` | string | |
| `www` | string | |
| `linkedin_url` | string | puste = brak przycisku |
| `ulica`, `kod`, `miasto`, `kraj` | string | adres |
| `zrodlo_kategoria` | string | z listy SOURCE_CATEGORIES; puste dla starych leadów |
| `zrodlo` | string | szczegóły źródła, wolny tekst (dla starych leadów całe źródło) |
| `status` | string | z listy STATUSES (serwer NIE waliduje!) |
| `ostatni_kontakt` | string(data) \| null | `YYYY-MM-DD` |
| `next_followup` | string(data) \| null | ręczne przypomnienie |
| `next_action` | string | PO CO jest przypomnienie (max 500) |
| `ostatni_kanal` | string \| null | denormalizacja z ostatniego wpisu logu (ContactChannel) |
| `notatki` | string | max 4000 |
| `client_id` | string \| null | ustawiony = awansował na Klienta |
| `created_at`, `updated_at` | string (timestamp) | |

**STATUSES leada** (dokładne stringi, kolejność = kolumny kanbanu):
1. `Nowe zgłoszenie ze strony`
2. `Do kontaktu`
3. `Napisano - czeka na odpowiedź`
4. `Przypomnienie wysłane`
5. `Rozmowa umówiona`
6. `Pilotaż w trakcie`
7. `Zamknięte - sukces`
8. `Odrzucone / brak zainteresowania`

**SOURCE_CATEGORIES**: `WWW`, `Polecenie`, `Networking`, `Zimny telefon`,
`Formularz na stronie`, `Automatyczne wyszukiwanie`, `Ręcznie dodane`, `Inne`.
Etykieta źródła do wyświetlenia: `zrodlo_kategoria || zrodlo || "—"`.

**Reguła „wymaga działania dziś" (`isOverdue`)** — apka MUSI ją odtworzyć 1:1,
bo to jedyne źródło Pulpitu i dziennego maila:
1. `status === "Nowe zgłoszenie ze strony"` → zawsze TAK.
2. Jeśli `next_followup` ustawione ORAZ (status nie jest zamknięty LUB status
   to dokładnie `"Odrzucone / brak zainteresowania"`) → TAK gdy
   `next_followup <= dziś` (porównanie stringów ISO, data lokalna).
   Zamknięte = `"Zamknięte - sukces"` i `"Odrzucone / brak zainteresowania"`;
   wyjątek dla „Odrzucone" jest celowy (przypomnienie „wróć za parę miesięcy"),
   „Zamknięte - sukces" celowo BEZ wyjątku (retencję prowadzi nurture).
3. Status zamknięty (bez ust. przypomnienia) → NIE.
4. `status === "Napisano - czeka na odpowiedź"` i od `ostatni_kontakt` minęły
   ≥ 4 dni → TAK. Każdy inny przypadek → NIE.

**Mapa procesu 15 kroków** (`LEAD_STATUS_STEP` — podświetlenie „jesteś tu"):
statusy 1–4 → krok 2 (Pierwszy kontakt), `Rozmowa umówiona` → 3,
`Pilotaż w trakcie` → 4, `Zamknięte - sukces` → 6,
`Odrzucone / brak zainteresowania` → 15 (Nurture). Miękka ściągawka, nie maszyna stanów.

Panel pokazuje też statyczne podpowiedzi „co zwykle dalej" per status
(`LEAD_STATUS_HINT`) — czysto informacyjne, nigdy nie blokują akcji.

## Activity (log leada) / ClientActivity (log klienta)

| Pole | Typ | Uwagi |
|---|---|---|
| `id` | string (uuid) | |
| `lead_id` / `client_id` | string | rodzic |
| `text` | string | max 4000 |
| `kanal` | ContactChannel \| null | |
| `kierunek` | ContactDirection \| null | |
| `wynik` | CallOutcome \| null | tylko dla kanal="telefon" |
| `czas_trwania_sek` | number \| null | tylko gdy wynik="odebrane"; ≤ 86400 |
| `created_at` | string (timestamp) | |

(`client_activity` ma dodatkowo `mail_message_id: string|null` — powiązanie z
wiadomością z modułu Poczta; widoczne w feedzie klienta.)

**ContactChannel**: `telefon`, `email`, `whatsapp`, `linkedin`, `spotkanie`,
`inne` (etykiety: Telefon/Email/WhatsApp/LinkedIn/Spotkanie/Inne).
**ContactDirection**: `wychodzacy` („Ja → oni"), `przychodzacy` („Oni → ja").
**CallOutcome**: `odebrane`, `nieodebrane` (kolory jak dziennik iPhone'a:
zielony/czerwony).

## Client

| Pole | Typ | Uwagi |
|---|---|---|
| `id` | string (uuid) | |
| `nazwa` | string | |
| `nip` | string | |
| `ulica`, `kod`, `miasto`, `kraj` | string | |
| `email`, `telefon`, `www`, `linkedin_url` | string | |
| `osoba_kontaktowa` | string | kopiowana z leada przy awansie; nieedytowalna PATCH-em |
| `zrodlo`, `zrodlo_kategoria` | string | kopiowane z leada; nieedytowalne PATCH-em |
| `branza` | string | |
| `status` | ClientStatus | walidowany serwerowo (zła wartość → „Prospekt") |
| `ostatni_kontakt` | string(data) \| null | |
| `next_followup` | string(data) \| null | |
| `next_action` | string | max 500 |
| `ostatni_kanal` | string \| null | ContactChannel |
| `notatki` | string | max 4000 |
| `lead_id` | string \| null | z jakiego leada powstał |
| `created_at`, `updated_at` | string (timestamp) | |
| `avg_rating` | number \| null | TYLKO w GET /api/clients (pole liczone) |

**ClientStatus** (relacyjna oś — osobna od tego, czy klient coś kupił):
`Prospekt`, `Aktywny`, `Uśpiony`, `Stracony`.
Mapa procesu: Prospekt→3, Aktywny→10, Uśpiony→15, Stracony→15.

**Reguła „klient wymaga działania dziś" (`isClientOverdue`)**: TYLKO gdy
`status !== "Stracony"` ORAZ `next_followup` ustawione ORAZ
`next_followup <= dziś`. Żadnych sztywnych reguł czasowych per status
(inaczej niż u leadów).

## ClientEvent (zdarzenia systemowe na osi klienta)

`{ id, client_id, kind, text, amount: number|null, related_id: string|null, created_at }`

**CLIENT_EVENT_KINDS** (i do jakiego modułu linkuje `related_id` —
`CLIENT_EVENT_TARGET`; null = brak celu):

| kind | cel linku |
|---|---|
| `client_created` | — |
| `offer_created`, `offer_sent`, `offer_accepted` | oferty |
| `invoice_issued`, `invoice_sent`, `invoice_reminder`, `payment_received`, `invoice_paid`, `invoice_dunning_sent` | faktury |
| `project_status_changed`, `review_requested`, `review_collected`, `nurture_contact_sent` | projekty |
| `nurture_scheduled` | — |
| `contract_created`, `contract_sent`, `contract_signed`, `nda_created` | umowy |

`kind` w bazie to zwykły tekst — apka powinna mieć fallback (kropka/ikona
ogólna) na nieznane wartości.

## ClientFollowup (kontakt nurture)

`{ id, client_id, project_id: string|null, due_date: string(data), powod: string,
created_at, done_at: string|null }` — `done_at` puste = do zrobienia.
`powod` to jedna z dwóch wartości `NURTURE_OFFSETS`:
`"kontakt kontrolny: referencja/opinia"` (+14 dni) lub
`"kontakt kontrolny: kolejna automatyzacja"` (+90 dni).

## FieldChange (audyt zmian, Moduł 23)

`{ id, field: string, old_value: string|null, new_value: string|null, created_at }`
— `field` to surowa nazwa kolumny; wartości znormalizowane (null ≈ ""), max
4000 znaków. Panel ucina podgląd do 80 znaków. Panel nie zapisuje „kto" —
jednoosobowy z założenia.

## Device (token urządzenia)

`{ id: string(uuid), device_name: string, created_at, last_used_at: string|null,
revoked_at: string|null }` — `revoked_at != null` = dostęp odebrany; wiersz
zostaje jako ślad. Sam token istnieje w bazie wyłącznie jako SHA-256.

## ContactMatch

`{ type: "lead" | "client", id: string, nazwa: string }` — klienci zawsze przed
leadami w wynikach.
