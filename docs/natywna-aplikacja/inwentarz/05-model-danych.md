# Inwentarz modelu danych — Leggera Hub

Stan na 2026-07-19, źródło prawdy: `lib/db.ts` (idempotentne migracje
`create*Schema()`) + enumy/etykiety w `lib/<moduł>.ts`. Ten dokument jest
samowystarczalny — czytany w repo aplikacji natywnej, bez dostępu do kodu
panelu.

Baza: Postgres (Neon na produkcji, PGlite w dev). Schemat tworzy się sam,
leniwie, przy pierwszym użyciu — **aplikacja natywna NIGDY nie tworzy ani nie
zmienia schematu**; rozmawia wyłącznie z REST-owymi route'ami `/api/*`.

---

## 1. Mapa schematów

Każdy „schemat" to jedna funkcja `create*Schema()` w `lib/db.ts`, bramkowana
wpisem w tabeli `schema_state` (nazwa → wersja kodu). Zależności = jawne
`await ensure*Schema()` na początku funkcji (bo FK wymagają istniejących
tabel docelowych).

| Schemat (nazwa w `schema_state`) | Funkcja | Tworzy tabele | Zależy od |
|---|---|---|---|
| *(maszyneria)* | `loadAppliedVersions()` | `schema_state` | — |
| `leads` | `createSchema()` / `ensureLeadsSchema()` | `leads`, `lead_activity` | — |
| `hub` | `createHubSchema()` | `projects`, `project_tasks`, `project_activity`, `project_milestones`, `project_resources`, `project_onboarding_items`, `project_dependencies`, `notes`, `notes_activity`, `events` | leads |
| `invoices` | `createInvoicesSchema()` | `company_settings`, `invoices`, `invoice_payments`, `invoice_reminders`, `recurring_invoices`, `invoice_items`, `service_catalog` | leads, hub |
| `offers` | `createOffersSchema()` | `offers`, `offer_items` | leads, hub, invoices |
| `offer_templates` | `createOfferTemplatesSchema()` | `offer_templates` (+ seed 4 szablonów przy pierwszym utworzeniu) | — |
| `contracts` | `createContractsSchema()` | `contracts` | leads, hub, clients, offers |
| `clients` | `createClientsSchema()` | `clients`, `client_activity`, `client_events` (+ dokłada kolumnę `client_id` do `leads`, `offers`, `invoices`, `projects`, `events`) | leads, hub, invoices, offers |
| `followups` | `createFollowupsSchema()` | `client_followups` | clients, hub |
| `device_tokens` | `createDeviceTokensSchema()` | `device_tokens` | — |
| `costs` | `createCostsSchema()` | `costs`, `recurring_costs` | hub |
| `time` | `createTimeSchema()` | `time_entries` | hub |
| `mail` | `createMailSchema()` | `mail_messages`, `mail_state`, `mail_senders` (+ dokłada `mail_message_id` do `client_activity` i `lead_activity`) | leads, clients, invoices |
| `mail_folders` | `createMailFoldersSchema()` | `mail_folders` (+ migruje kursor INBOX z `mail_state`) | mail |
| `mail_templates` | `createMailTemplatesSchema()` | `mail_templates` | — |
| `links` | `createLinksSchema()` | `mail_address_links` (+ dokłada `client_id`/`lead_id` do `costs` i `recurring_costs`, `client_id`/`lead_id`/`project_id` do `notes`) | clients, costs, mail |
| `audit` | `createAuditSchema()` | `field_changes` | — |
| `notifications` | `createNotificationsSchema()` | `notifications` | — |

Razem: **40 tabel** (licząc `schema_state`).

---

## 2. Tabele — kolumna po kolumnie

Notacja: **NN** = NOT NULL. FK zapisany jako `→ tabela(kolumna) [ON DELETE …]`.
Wszystkie `id` to TEXT (UUID generowany w JS przez `randomUUID()`), chyba że
zaznaczono inaczej.

### 2.0 `schema_state` — maszyneria migracji

Bramka migracji: który schemat jest już zastosowany w której wersji kodu
(SHA commita z Vercela). Aplikacja natywna nigdy tego nie dotyka.

| Kolumna | Typ | Uwagi |
|---|---|---|
| `name` | TEXT | PRIMARY KEY — nazwa schematu (np. `leads`, `mail`) |
| `version` | TEXT NN | SHA commita / id deploymentu |
| `applied_at` | TIMESTAMPTZ NN | default `now()` |

---

### Moduł Leady (`leads`)

### 2.1 `leads` — potencjalni klienci (pipeline sprzedażowy, kanban)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY (uuid) |
| `firma` | TEXT NN | nazwa firmy |
| `branza` | TEXT NN, default `''` | branża |
| `kontakt` | TEXT NN, default `''` | **deprecated** — zlepione pole (telefon+mail+www) sprzed rozbicia; tylko odczyt starych wpisów |
| `zrodlo` | TEXT NN, default `''` | szczegóły źródła (wolny tekst); dla starych leadów całe nieustrukturyzowane źródło |
| `status` | TEXT NN, default `'Do kontaktu'` | enum — patrz niżej |
| `ostatni_kontakt` | DATE, null | data ostatniego kontaktu |
| `notatki` | TEXT NN, default `''` | wolny tekst |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `next_followup` | DATE, null | jawna data „przypomnij mi" |
| `telefon` | TEXT NN, default `''` | |
| `email` | TEXT NN, default `''` | |
| `www` | TEXT NN, default `''` | |
| `osoba_kontaktowa` | TEXT NN, default `''` | |
| `ulica` | TEXT NN, default `''` | adres |
| `kod` | TEXT NN, default `''` | kod pocztowy |
| `miasto` | TEXT NN, default `''` | |
| `kraj` | TEXT NN, default `''` | |
| `zrodlo_kategoria` | TEXT NN, default `''` | jedna z `SOURCE_CATEGORIES` (niżej); `''` = lead sprzed rozbicia źródła |
| `linkedin_url` | TEXT NN, default `''` | osobne od `www` |
| `next_action` | TEXT NN, default `''` | PO CO jest `next_followup` (opis następnego kroku) |
| `ostatni_kanal` | TEXT, null | denormalizacja: kanał ostatniego wpisu z `lead_activity` (jedna z `CONTACT_CHANNELS`) |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL — ustawiane, gdy lead „awansował" na klienta |

**Statusy leada** (`lib/leads.ts` → `STATUSES`, wartość w bazie = etykieta polska):
`Nowe zgłoszenie ze strony`, `Do kontaktu`, `Napisano - czeka na odpowiedź`,
`Przypomnienie wysłane`, `Rozmowa umówiona`, `Pilotaż w trakcie`,
`Zamknięte - sukces`, `Odrzucone / brak zainteresowania`.
Statusy „zamknięte": `Zamknięte - sukces`, `Odrzucone / brak zainteresowania`.

**Kategorie źródła** (`SOURCE_CATEGORIES`): `WWW`, `Polecenie`, `Networking`,
`Zimny telefon`, `Formularz na stronie`, `Automatyczne wyszukiwanie`,
`Ręcznie dodane`, `Inne`.

### 2.2 `lead_activity` — chronologiczny log kontaktów z leadem

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `lead_id` | TEXT NN | → `leads(id)` ON DELETE CASCADE |
| `text` | TEXT NN | treść wpisu |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `kanal` | TEXT, null | jedna z `CONTACT_CHANNELS`; null = wpis sprzed Modułu 3 |
| `kierunek` | TEXT, null | jedna z `CONTACT_DIRECTIONS` |
| `wynik` | TEXT, null | `CALL_OUTCOMES` — tylko dla `kanal='telefon'` |
| `czas_trwania_sek` | INTEGER, null | czas rozmowy w sekundach (telefon) |
| `mail_message_id` | TEXT, null | → `mail_messages(id)` ON DELETE SET NULL — link do pełnej treści maila |

**Kanały kontaktu** (`lib/contact.ts` → `CONTACT_CHANNELS`, wartość → etykieta):
`telefon` → Telefon, `email` → Email, `whatsapp` → WhatsApp, `linkedin` →
LinkedIn, `spotkanie` → Spotkanie, `inne` → Inne.

**Kierunki** (`CONTACT_DIRECTIONS`): `wychodzacy` → „Ja → oni",
`przychodzacy` → „Oni → ja".

**Wyniki połączeń** (`CALL_OUTCOMES`): `odebrane` → Odebrane,
`nieodebrane` → Nieodebrane.

---

### Moduł Hub (`hub`) — Projekty / Notatnik / Kalendarz

### 2.3 `projects` — projekty/wdrożenia (kanban + oś czasu)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `tytul` | TEXT NN | |
| `opis` | TEXT NN, default `''` | |
| `status` | TEXT NN, default `'Pomysł'` | enum — niżej |
| `priorytet` | TEXT NN, default `'Normalny'` | enum — niżej |
| `termin` | DATE, null | deadline (koniec paska na osi czasu) |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `zdrowie` | TEXT NN, default `'Na dobrej drodze'` | ręczna, osobna oś od statusu (styl Linear) |
| `start` | DATE, null | początek paska na osi czasu |
| `kolor` | TEXT, null | akcent hex, np. `#4ea7fc` (paleta `PROJECT_COLORS`; default w kodzie `#4ea7fc`) |
| `ikona` | TEXT, null | **emoji** z palety `PROJECT_ICONS` (patrz Konwencje) |
| `review_token` | TEXT, null, UNIQUE index | token publicznego formularza opinii |
| `review_requested_at` | TIMESTAMPTZ, null | |
| `review_rating_jakosc` | SMALLINT, null | ocena 1–5 |
| `review_rating_terminowosc` | SMALLINT, null | ocena 1–5 |
| `review_rating_komunikacja` | SMALLINT, null | ocena 1–5 |
| `review_comment` | TEXT NN, default `''` | |
| `review_submitted_at` | TIMESTAMPTZ, null | |
| `review_consent_case_study` | BOOLEAN NN, default `false` | zgoda na case study/referencję |
| `review_consent_text` | TEXT, null | pełny zaakceptowany tekst zgody |
| `review_consent_name` | TEXT, null | e-podpis (imię) |
| `review_consent_ip` | TEXT, null | dowód złożenia |
| `review_consent_user_agent` | TEXT, null | dowód złożenia |
| `jezyk` | TEXT NN, default `'pl'` | `pl`/`en`/`de` (DocLang) — język formularza opinii |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL |

**Statusy projektu** (`PROJECT_STATUSES`): `Pomysł`, `Planowanie`, `W trakcie`,
`Testy / review`, `Wdrożone`, `Wstrzymane`. „Zamknięty" = `Wdrożone`.

**Priorytety** (`PROJECT_PRIORITIES`): `Niski`, `Normalny`, `Wysoki`, `Krytyczny`.

**Zdrowie** (`PROJECT_HEALTHS`): `Na dobrej drodze`, `Zagrożony`, `Zerwany` —
ręczne, niezależne od statusu.

### 2.4 `project_tasks` — checklista zadań projektu

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT NN | → `projects(id)` ON DELETE CASCADE |
| `text` | TEXT NN | |
| `done` | BOOLEAN NN, default `false` | |
| `position` | INTEGER NN, default `0` | ręczna kolejność |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `milestone_id` | TEXT, null | → `project_milestones(id)` ON DELETE SET NULL |

### 2.5 `project_activity` — log aktywności projektu

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT NN | → `projects(id)` ON DELETE CASCADE |
| `text` | TEXT NN | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `kind` | TEXT NN, default `'note'` | `note` (ręczny wpis) / `system` (automatyczny log zmiany pola) |

### 2.6 `project_milestones` — kamienie milowe

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT NN | → `projects(id)` ON DELETE CASCADE |
| `nazwa` | TEXT NN | |
| `termin` | DATE, null | |
| `position` | INTEGER NN, default `0` | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.7 `project_resources` — linki/zasoby przypięte do projektu

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT NN | → `projects(id)` ON DELETE CASCADE |
| `etykieta` | TEXT NN | |
| `url` | TEXT NN | |
| `position` | INTEGER NN, default `0` | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.8 `project_onboarding_items` — checklista onboardingowa (co zebrać od klienta)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT NN | → `projects(id)` ON DELETE CASCADE |
| `tekst` | TEXT NN | |
| `done` | BOOLEAN NN, default `false` | |
| `position` | INTEGER NN, default `0` | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

Domyślne punkty wsiewane przy tworzeniu projektu (`DEFAULT_ONBOARDING_ITEMS`
w `lib/projects.ts`); miękka podpowiedź, nigdy twarda bramka.

### 2.9 `project_dependencies` — zależności między projektami (oś czasu)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT NN | → `projects(id)` ON DELETE CASCADE — projekt „zależny" |
| `depends_on_id` | TEXT NN | → `projects(id)` ON DELETE CASCADE — poprzednik |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| | | UNIQUE (`project_id`, `depends_on_id`) |

### 2.10 `notes` — notatnik

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `tytul` | TEXT NN, default `''` | |
| `tresc` | TEXT NN, default `''` | |
| `tagi` | TEXT NN, default `''` | **CSV w jednym stringu** (świadomie nie typ tablicowy) |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `pinned` | BOOLEAN NN, default `false` | przypięta |
| `archived_at` | TIMESTAMPTZ, null | null = na biurku; wypełnione = w archiwum |
| `event_id` | TEXT, null | → `events(id)` ON DELETE SET NULL — ślad „przekuto w wydarzenie" (skasowanie wydarzenia odblokowuje notatkę) |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |
| `project_id` | TEXT, null | → `projects(id)` ON DELETE SET NULL |

### 2.11 `notes_activity` — log aktywności notatki

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `note_id` | TEXT NN | → `notes(id)` ON DELETE CASCADE |
| `text` | TEXT NN | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.12 `events` — kalendarz

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `tytul` | TEXT NN | |
| `opis` | TEXT NN, default `''` | |
| `data` | DATE NN | dzień wydarzenia (początek zakresu) |
| `godzina` | TEXT, null | `"HH:MM"` jako tekst; null = całodniowe |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |
| `project_id` | TEXT, null | → `projects(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `data_koniec` | DATE, null | null = jednodniowe; wypełnione = zakres [data, data_koniec] włącznie |
| `czas_trwania_min` | INTEGER, null | minuty, tylko przy ustawionej `godzina`; napędza siatkę godzinową |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL |

---

### Moduł Faktury (`invoices`)

### 2.13 `company_settings` — dane sprzedawcy (singleton, `id='default'`)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY, default `'default'` — zawsze dokładnie jeden wiersz |
| `nazwa` | TEXT NN, default `''` | |
| `nip` | TEXT NN, default `''` | |
| `adres` | TEXT NN, default `''` | stary zlepiony adres — fallback |
| `email` | TEXT NN, default `''` | |
| `telefon` | TEXT NN, default `''` | |
| `konto` | TEXT NN, default `''` | numer rachunku |
| `vat_payer` | BOOLEAN NN, default `true` | true = płatnik VAT |
| `zwolnienie_podstawa` | TEXT NN, default `''` | podstawa zwolnienia (na wydruku gdy `vat_payer=false`; w kodzie domyślnie „art. 113 ust. 1 ustawy o VAT") |
| `domyslny_termin_dni` | INTEGER NN, default `14` | |
| `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `bank_nazwa` | TEXT NN, default `''` | |
| `swift` | TEXT NN, default `''` | BIC/SWIFT |
| `ulica` | TEXT NN, default `''` | adres strukturalny |
| `kod` | TEXT NN, default `''` | |
| `miasto` | TEXT NN, default `''` | |
| `kraj` | TEXT NN, default `'PL'` | |
| `domyslne_uwagi` | TEXT NN, default `''` | auto-wstawiane w nowej fakturze |
| `stawka_odsetek_ustawowych` | NUMERIC, null | ręcznie wpisywana, nigdy auto |
| `rezerwa_vat_procent` | NUMERIC NN, default `0` | rezerwa podatkowa |
| `rezerwa_pit_procent` | NUMERIC NN, default `0` | |
| `rezerwa_zus_procent` | NUMERIC NN, default `0` | |

### 2.14 `invoices` — faktury WYCHODZĄCE (sprzedażowe)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `numer` | TEXT, null | null = szkic; UNIQUE (indeks częściowy `WHERE numer IS NOT NULL`) |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |
| `project_id` | TEXT, null | → `projects(id)` ON DELETE SET NULL |
| `klient_nazwa` | TEXT NN, default `''` | **migawka** danych nabywcy (patrz Konwencje) |
| `klient_nip` | TEXT NN, default `''` | migawka |
| `klient_adres` | TEXT NN, default `''` | stary zlepiony adres — fallback |
| `data_wystawienia` | DATE, null | |
| `data_sprzedazy` | DATE, null | |
| `termin_platnosci` | DATE, null | |
| `status` | TEXT NN, default `'Szkic'` | enum — niżej |
| `waluta` | TEXT NN, default `'PLN'` | `PLN`/`EUR`/`USD`/`GBP` |
| `uwagi` | TEXT NN, default `''` | |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `jezyk` | TEXT NN, default `'pl'` | `pl`/`en`/`de` — język wydruku |
| `klient_ulica` / `klient_kod` / `klient_miasto` / `klient_kraj` | TEXT NN, default `''` | adres strukturalny nabywcy (migawka) |
| `odbiorca_nazwa` / `odbiorca_ulica` / `odbiorca_kod` / `odbiorca_miasto` / `odbiorca_kraj` | TEXT NN, default `''` | opcjonalny odbiorca osobny od nabywcy; puste = brak |
| `klient_email` | TEXT NN, default `''` | do wysyłki |
| `share_token` | TEXT, null, UNIQUE index | publiczny podgląd faktury bez logowania |
| `last_reminder_at` | TIMESTAMPTZ, null | |
| `reminder_level` | INTEGER NN, default `0` | 0 = żaden; 1–3 wg `REMINDER_LEVELS` (niżej) |
| `wezwanie_wystawiono_at` | TIMESTAMPTZ, null | formalne wezwanie do zapłaty (poziom 3) |
| `wezwanie_share_token` | TEXT, null, UNIQUE index | osobny token publiczny wezwania |
| `typ_dokumentu` | TEXT NN, default `'faktura'` | `faktura` / `proforma` / `zaliczkowa` |
| `koryguje_id` | TEXT, null | → `invoices(id)` ON DELETE SET NULL — ta faktura koryguje wskazaną; pozycje = stan PO korekcie |
| `przyczyna_korekty` | TEXT NN, default `''` | |
| `typ_korekty` | TEXT NN, default `'1'` | `1` = w dacie faktury pierwotnej, `2` = w dacie korekty, `3` = inna data (FA(3) TypKorekty) |
| `rozlicza_zaliczke_id` | TEXT, null | → `invoices(id)` ON DELETE SET NULL — faktura końcowa (ROZ) odejmuje wskazaną zaliczkę |
| `zamowienie_wartosc` | NUMERIC, null | pełna wartość BRUTTO zlecenia (tylko dla zaliczkowych) |
| `zamowienie_opis` | TEXT NN, default `''` | |
| `kurs_nbp` | NUMERIC, null | kurs NBP dla VAT w walucie obcej |
| `kurs_nbp_data` | DATE, null | |
| `kurs_nbp_tabela` | TEXT, null | numer tabeli NBP |
| `sposob_platnosci` | TEXT NN, default `'przelew'` | `przelew` / `gotowka` / `karta` |
| `ksef_status` | TEXT NN, default `'nie_wyslano'` | `nie_wyslano` / `wyslano` / `przyjeto` / `odrzucono` |
| `ksef_tryb` | TEXT, null | `test` / `prod`; null = nigdy nie wysłano |
| `ksef_numer` | TEXT, null | numer KSeF po przyjęciu |
| `ksef_upo` | TEXT, null | UPO (XML) |
| `ksef_blad` | TEXT NN, default `''` | komunikat przy odrzuceniu |
| `ksef_wyslano_at` | TIMESTAMPTZ, null | |
| `ksef_qr` | TEXT, null | link KOD I do QR na wizualizacji |
| `ceny_brutto` | BOOLEAN NN, default `false` | tryb edytora (UI); **baza zawsze trzyma netto** |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL — powiązanie (nie migawka) |

**Statusy faktury** (`INVOICE_STATUSES`): `Szkic`, `Wystawiona`, `Opłacona`,
`Po terminie`, `Anulowana`. Zamknięte: `Opłacona`, `Anulowana`.

**Typy dokumentu** (`INVOICE_TYPES`): `faktura` → Faktura, `proforma` →
Proforma, `zaliczkowa` → Faktura zaliczkowa.

**Sposoby płatności** (`PAYMENT_METHODS` w `lib/invoices.ts`): `przelew` →
Przelew, `gotowka` → Gotówka, `karta` → Karta.

**Poziomy przypomnień** (`REMINDER_LEVELS`): 1 = po 3 dniach „Uprzejme
przypomnienie", 2 = po 10 dniach „Stanowcze przypomnienie", 3 = po 21 dniach
„Wezwanie do zapłaty".

**Statusy KSeF** (`lib/ksef.ts` → `KSEF_STATUSES`): `nie_wyslano`, `wyslano`,
`przyjeto`, `odrzucono`; tryby (`KSEF_TRYBY`): `test`, `prod`.

### 2.15 `invoice_items` — pozycje faktury

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `invoice_id` | TEXT NN | → `invoices(id)` ON DELETE CASCADE |
| `nazwa` | TEXT NN, default `''` | |
| `ilosc` | NUMERIC NN, default `1` | |
| `jednostka` | TEXT NN, default `'szt.'` | |
| `cena_netto` | NUMERIC NN, default `0` | zawsze netto |
| `vat_stawka` | TEXT NN, default `'23'` | `23`/`8`/`5`/`0`/`zw` (zwolniony)/`np` (nie podlega) — TEKST, nie liczba |
| `position` | INTEGER NN, default `0` | |
| `rabat_procent` | NUMERIC NN, default `0` | rabat % naliczany przed VAT |

### 2.16 `invoice_payments` — wpłaty do faktury (płatności częściowe)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `invoice_id` | TEXT NN | → `invoices(id)` ON DELETE CASCADE |
| `kwota` | NUMERIC NN | |
| `data` | DATE NN | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.17 `invoice_reminders` — historia wysłanych przypomnień/wezwań

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `invoice_id` | TEXT NN | → `invoices(id)` ON DELETE CASCADE |
| `level` | INTEGER NN | 1–3 (patrz `REMINDER_LEVELS`) |
| `kind` | TEXT NN | rodzaj wysyłki (np. przypomnienie/wezwanie) |
| `sent_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.18 `recurring_invoices` — szablony faktur cyklicznych

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `nazwa` | TEXT NN, default `''` | |
| `klient_nazwa` / `klient_nip` / `klient_ulica` / `klient_kod` / `klient_miasto` / `klient_kraj` / `klient_email` | TEXT NN, default `''` | dane nabywcy szablonu |
| `waluta` | TEXT NN, default `'PLN'` | |
| `jezyk` | TEXT NN, default `'pl'` | |
| `termin_dni` | INTEGER NN, default `14` | |
| `pozycje` | JSONB NN, default `'[]'` | `[{nazwa, ilosc, jednostka, cena_netto, vat_stawka}]` — „odbitka" kopiowana do nowej faktury |
| `cykl` | TEXT NN, default `'miesiecznie'` | `miesiecznie` / `kwartalnie` / `rocznie` (`RECURRING_CYCLES`) |
| `next_run` | DATE NN | kiedy wygenerować kolejną |
| `active` | BOOLEAN NN, default `true` | |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.19 `service_catalog` — katalog usług/produktów

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `nazwa` | TEXT NN, default `''` | |
| `cena_netto` | NUMERIC NN, default `0` | |
| `vat_stawka` | TEXT NN, default `'23'` | jak w `invoice_items` |
| `jednostka` | TEXT NN, default `'szt.'` | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

---

### Moduł Oferty (`offers`, `offer_templates`)

### 2.20 `offers` — oferty handlowe

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `tytul` | TEXT NN, default `''` | |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |
| `project_id` | TEXT, null | → `projects(id)` ON DELETE SET NULL — projekt utworzony po akceptacji |
| `invoice_id` | TEXT, null | → `invoices(id)` ON DELETE SET NULL — faktura utworzona po akceptacji |
| `klient_nazwa` / `klient_nip` | TEXT NN, default `''` | **migawka** danych klienta |
| `klient_adres` | TEXT NN, default `''` | stary zlepiony — fallback |
| `wazna_do` | DATE, null | data ważności oferty |
| `status` | TEXT NN, default `'Szkic'` | enum — niżej |
| `uwagi` | TEXT NN, default `''` | |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `jezyk` | TEXT NN, default `'pl'` | `pl`/`en`/`de` |
| `klient_ulica` / `klient_kod` / `klient_miasto` / `klient_kraj` | TEXT NN, default `''` | adres strukturalny (migawka) |
| `klient_email` | TEXT NN, default `''` | |
| `share_token` | TEXT, null, UNIQUE index | publiczny podgląd `/oferta/[token]` |
| `accepted_at` | TIMESTAMPTZ, null | e-podpis akceptacji |
| `accepted_by_name` | TEXT, null | puste = zaakceptowano ręcznie w panelu; wypełnione = klient podpisał sam |
| `accepted_ip` | TEXT, null | |
| `accepted_user_agent` | TEXT, null | |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL |

**Statusy oferty** (`OFFER_STATUSES`): `Szkic`, `Wysłana`, `Zaakceptowana`,
`Odrzucona`, `Wygasła`. Zamknięte: `Zaakceptowana`, `Odrzucona`, `Wygasła`.

### 2.21 `offer_items` — pozycje oferty

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `offer_id` | TEXT NN | → `offers(id)` ON DELETE CASCADE |
| `nazwa` | TEXT NN, default `''` | |
| `ilosc` | NUMERIC NN, default `1` | |
| `jednostka` | TEXT NN, default `'szt.'` | |
| `cena` | NUMERIC NN, default `0` | uwaga: `cena`, nie `cena_netto`; oferty nie rozbijają VAT |
| `position` | INTEGER NN, default `0` | |

### 2.22 `offer_templates` — szablony ofert

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY (seedowane mają czytelne id, np. `seed-audyt-poc`) |
| `nazwa` | TEXT NN, default `''` | |
| `opis` | TEXT NN, default `''` | |
| `pozycje` | JSONB NN, default `'[]'` | `[{nazwa, ilosc, jednostka, cena}]` |
| `uwagi` | TEXT NN, default `''` | |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |

Przy pierwszym utworzeniu tabeli zasiewane 4 szablony (Audyt/PoC AI,
Wdrożenie automatyzacji, Abonament, pusty wzór) — potem w pełni edytowalne.

---

### Moduł Umowy + NDA (`contracts`)

### 2.23 `contracts` — umowy i NDA (jedna tabela, rozróżnia `typ`)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `typ` | TEXT NN, default `'umowa'` | `umowa` → Umowa, `nda` → NDA |
| `status` | TEXT NN, default `'Szkic'` | enum — niżej |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL |
| `project_id` | TEXT, null | → `projects(id)` ON DELETE SET NULL |
| `offer_id` | TEXT, null | → `offers(id)` ON DELETE SET NULL — oferta źródłowa |
| `klient_nazwa` / `klient_nip` / `klient_ulica` / `klient_kod` / `klient_miasto` / `klient_kraj` / `klient_email` | TEXT NN, default `''` | **migawka** danych klienta |
| `zakres_prac` | TEXT NN, default `''` | |
| `cena` | NUMERIC NN, default `0` | |
| `waluta` | TEXT NN, default `'PLN'` | |
| `termin_realizacji` | DATE, null | |
| `uwagi` | TEXT NN, default `''` | |
| `share_token` | TEXT, null, UNIQUE index | publiczny podgląd + e-podpis |
| `accepted_at` | TIMESTAMPTZ, null | |
| `accepted_by_name` | TEXT, null | |
| `accepted_ip` | TEXT, null | |
| `accepted_user_agent` | TEXT, null | |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `jezyk` | TEXT NN, default `'pl'` | tylko „chrome" wydruku; klauzule zawsze po polsku |
| `sent_at` | TIMESTAMPTZ, null | kiedy poszła do podpisu (osobno od `updated_at`, bo od niej liczy się „dni ciszy") |

**Statusy umowy** (`CONTRACT_STATUSES`): `Szkic`, `Wysłana`, `Podpisana`,
`Odrzucona`. Zamknięte: `Podpisana`, `Odrzucona`.

---

### Moduł Klienci (`clients`, `followups`)

### 2.24 `clients` — kontrahenci (CRM)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `nazwa` | TEXT NN, default `''` | |
| `nip` | TEXT NN, default `''` | |
| `ulica` / `kod` / `miasto` / `kraj` | TEXT NN, default `''` | adres |
| `email` | TEXT NN, default `''` | |
| `telefon` | TEXT NN, default `''` | |
| `www` | TEXT NN, default `''` | |
| `branza` | TEXT NN, default `''` | |
| `status` | TEXT NN, default `'Prospekt'` | enum — niżej |
| `ostatni_kontakt` | DATE, null | |
| `next_followup` | DATE, null | |
| `notatki` | TEXT NN, default `''` | |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL — lead, z którego klient powstał |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `linkedin_url` | TEXT NN, default `''` | |
| `next_action` | TEXT NN, default `''` | |
| `ostatni_kanal` | TEXT, null | denormalizacja z `client_activity.kanal` |
| `osoba_kontaktowa` | TEXT NN, default `''` | |
| `zrodlo` | TEXT NN, default `''` | odziedziczone z leada |
| `zrodlo_kategoria` | TEXT NN, default `''` | `SOURCE_CATEGORIES` z leadów |

**Statusy klienta** (`CLIENT_STATUSES`): `Prospekt`, `Aktywny`, `Uśpiony`,
`Stracony` — osobna oś od tego, czy klient coś kupił. Zamknięty: `Stracony`.

### 2.25 `client_activity` — ręczne wpisy kontaktu z klientem

Struktura identyczna z `lead_activity`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `client_id` | TEXT NN | → `clients(id)` ON DELETE CASCADE |
| `text` | TEXT NN | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `kanal` | TEXT, null | `CONTACT_CHANNELS` |
| `kierunek` | TEXT, null | `CONTACT_DIRECTIONS` |
| `wynik` | TEXT, null | `CALL_OUTCOMES` |
| `czas_trwania_sek` | INTEGER, null | |
| `mail_message_id` | TEXT, null | → `mail_messages(id)` ON DELETE SET NULL |

### 2.26 `client_events` — zdarzenia SYSTEMOWE na osi klienta

Zapisywane automatycznie przez route'y (nigdy edytowane ręcznie); UI scala je
z `client_activity` i `lead_activity` w jeden feed.

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `client_id` | TEXT NN | → `clients(id)` ON DELETE CASCADE |
| `kind` | TEXT NN | jedna z `CLIENT_EVENT_KINDS` (niżej) — w bazie zwykły tekst |
| `text` | TEXT NN | gotowy opis zdarzenia |
| `amount` | NUMERIC, null | tylko zdarzenia pieniężne (wpłata, faktura) |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `related_id` | TEXT, null | id rekordu, którego dotyczy (BEZ FK); typ celu wynika z `kind` (`CLIENT_EVENT_TARGET`) |

**Rodzaje zdarzeń** (`CLIENT_EVENT_KINDS`, w nawiasie cel linku wg
`CLIENT_EVENT_TARGET`): `client_created` (—), `offer_created`/`offer_sent`/
`offer_accepted` (oferty), `invoice_issued`/`invoice_sent`/`invoice_reminder`/
`payment_received`/`invoice_paid`/`invoice_dunning_sent` (faktury),
`project_status_changed` (projekty), `nurture_scheduled` (—),
`contract_created`/`contract_sent`/`contract_signed`/`nda_created` (umowy),
`review_requested`/`review_collected`/`nurture_contact_sent` (projekty).

### 2.27 `client_followups` — harmonogram nurture

Automatyczne przyszłe kontakty po statusie „Wdrożone" projektu
(`NURTURE_OFFSETS`: +14 dni „referencja/opinia", +90 dni „kolejna
automatyzacja"). Osobno od `clients.next_followup`, bo trzeba trzymać dwa
terminy naraz.

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `client_id` | TEXT NN | → `clients(id)` ON DELETE CASCADE |
| `project_id` | TEXT, null | → `projects(id)` ON DELETE SET NULL — do deduplikacji |
| `due_date` | DATE NN | |
| `powod` | TEXT NN | opis (patrz `NURTURE_OFFSETS`) |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `done_at` | TIMESTAMPTZ, null | null = jeszcze do zrobienia |

---

### Moduł Koszty (`costs`)

### 2.28 `costs` — faktury PRZYCHODZĄCE / wydatki

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `dostawca_nazwa` | TEXT NN, default `''` | |
| `dostawca_nip` | TEXT NN, default `''` | |
| `kategoria` | TEXT NN, default `'Inne'` | enum — niżej |
| `opis` | TEXT NN, default `''` | |
| `data_wydatku` | DATE NN, default `CURRENT_DATE` | data wystawienia |
| `kwota_netto` | NUMERIC NN, default `0` | |
| `vat_stawka` | TEXT NN, default `'23'` | jak w fakturach |
| `kwota_brutto` | NUMERIC NN, default `0` | |
| `status` | TEXT NN, default `'Nieopłacony'` | `Nieopłacony` / `Opłacony` |
| `data_platnosci` | DATE, null | |
| `project_id` | TEXT, null | → `projects(id)` ON DELETE SET NULL — do rentowności projektu |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `zalacznik_nazwa` | TEXT NN, default `''` | skan/PDF faktury |
| `zalacznik_typ` | TEXT NN, default `''` | MIME (pdf/jpeg/png/webp) |
| `zalacznik_dane` | TEXT, null | **base64 wprost w bazie** (świadomie bez blob storage); null = brak |
| `ksef_numer` | TEXT, null, UNIQUE index | numer KSeF faktury zakupowej (klucz dedup importu); null = wpis ręczny |
| `ksef_tryb` | TEXT, null | `test`/`prod` |
| `metoda_platnosci` | TEXT, null | `przelew`/`karta`/`gotowka`/`blik`/`paypal`/`apple_pay` (etykiety: Przelew/Karta/Gotówka/BLIK/PayPal/Apple Pay); null = nieustawiona |
| `dostawca_konto` | TEXT NN, default `''` | do „Kopiuj dane do przelewu" |
| `numer_faktury` | TEXT NN, default `''` | numer dokumentu dostawcy (JPK_V7) |
| `data_wplywu` | DATE, null | data otrzymania (dla terminu odliczenia VAT) |
| `vat_odliczenie_procent` | INTEGER NN, default `100` | 100/50/0 — miękka podpowiedź, wybiera właściciel |
| `duplikat_potwierdzony` | BOOLEAN NN, default `false` | wyciszenie ostrzeżenia o duplikacie |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |

**Kategorie kosztu** (`COST_CATEGORIES`): `Usługi`, `Sprzęt`, `Subskrypcje`,
`Biuro`, `Marketing`, `Podatki i ZUS`, `Inne`.

Koszty są **wyłącznie w PLN** (świadome ograniczenie v1 — brak kolumny waluty).

### 2.29 `recurring_costs` — szablony kosztów cyklicznych

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `nazwa` | TEXT NN, default `''` | |
| `dostawca_nazwa` / `dostawca_nip` / `dostawca_konto` | TEXT NN, default `''` | |
| `kategoria` | TEXT NN, default `'Inne'` | `COST_CATEGORIES` |
| `opis` | TEXT NN, default `''` | |
| `kwota_netto` | NUMERIC NN, default `0` | |
| `vat_stawka` | TEXT NN, default `'23'` | |
| `metoda_platnosci` | TEXT, null | jak w `costs` |
| `project_id` | TEXT, null | → `projects(id)` ON DELETE SET NULL |
| `cykl` | TEXT NN, default `'miesiecznie'` | `miesiecznie`/`kwartalnie`/`rocznie` |
| `next_run` | DATE NN | |
| `active` | BOOLEAN NN, default `true` | |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |

Generuje koszt-SZKIC, gdy nadejdzie `next_run` (cron dziennego raportu).

---

### Moduł Czas pracy (`time`)

### 2.30 `time_entries` — wpisy czasu (ręczne i stoper)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT NN | → `projects(id)` ON DELETE CASCADE |
| `task_id` | TEXT, null | → `project_tasks(id)` ON DELETE SET NULL |
| `source` | TEXT NN, default `'manual'` | `manual` (ręczny wpis) / `timer` (stoper) |
| `entry_date` | DATE NN, default `CURRENT_DATE` | |
| `started_at` | TIMESTAMPTZ, null | sesja stopera |
| `ended_at` | TIMESTAMPTZ, null | **`NULL` = stoper aktualnie działa** (max jeden taki wiersz, pilnowane w API) |
| `minutes` | NUMERIC NN, default `0` | NUMERIC (nie INTEGER) — sesje krótsze niż minuta zapisują realną długość |
| `note` | TEXT NN, default `''` | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

---

### Moduł Poczta (`mail`, `mail_folders`, `mail_templates`, część `links`)

### 2.31 `mail_messages` — robocza kopia korespondencji (IMAP az.pl)

Oryginały zostają na serwerze; retencja czyści wiersze starsze niż 24 mies.
(`MAIL_RETENTION_MONTHS = 24`). Dedup po `message_id` (UNIQUE).

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `uid` | INTEGER, null | UID IMAP (optymalizacja syncu, nie gwarancja) |
| `kierunek` | TEXT NN, default `'in'` | `in` / `out` (`MAIL_DIRECTIONS`) |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE SET NULL |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE SET NULL |
| `invoice_id` | TEXT, null | → `invoices(id)` ON DELETE SET NULL |
| `from_addr` / `from_name` / `to_addr` | TEXT NN, default `''` | |
| `subject` | TEXT NN, default `''` | |
| `body_text` / `body_html` | TEXT NN, default `''` | |
| `message_id` | TEXT NN, **UNIQUE** | klucz dedupu |
| `in_reply_to` | TEXT, null | nagłówek RFC |
| `refs` | TEXT, null | nagłówek References |
| `status` | TEXT NN, default `'nowy'` | `nowy` → „Do odpowiedzi", `obsłużony` → „Obsłużony", `zignorowany` → „Zignorowany" (uwaga: wartości z polskimi znakami) |
| `received_at` | TIMESTAMPTZ NN, default `now()` | |
| `handled_at` | TIMESTAMPTZ, null | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `kategoria` | TEXT, null | `reklama` → Reklama, `rachunek` → Rachunek, `urzedowe` → Urzędowe, `oferta` → **Zapytanie**, `inne` → Rozmowa; **NULL = jeszcze nieskategoryzowana** (≠ `inne`) |
| `list_unsubscribe` | BOOLEAN, null | sygnał masówki; NULL = nie sprawdzone |
| `precedence` | TEXT, null | nagłówek |
| `auto_submitted` | TEXT, null | nagłówek |
| `cc_addr` | TEXT, null | DW; NULL = nie sprawdzone, `''` = sprawdzone, brak |
| `folder` | TEXT NN, default `'inbox'` | `inbox` → Odebrane, `sent` → Wysłane, `trash` → Kosz, `archive` → Archiwum |
| `list_unsubscribe_url` | TEXT, null | URL wypisu; NULL/`''`/URL — jak `cc_addr` |
| `flagged` | BOOLEAN NN, default `false` | flaga „ważne" — TYLKO lokalna, bez syncu `\Flagged` |
| `thread_id` | TEXT, null | wątek; korzeń = własny `message_id` |
| `snooze_until` | TIMESTAMPTZ, null | odłożona do; widoczność liczona w locie przy odczycie |
| `bcc_addr` | TEXT, null | UDW wychodzącej (tylko kopia w bazie, nigdy w nagłówkach) |
| `nudge_dismissed_at` | TIMESTAMPTZ, null | wyciszenie przypominacza „bez odpowiedzi" (`MAIL_NUDGE_DAYS = 5`) |

### 2.32 `mail_state` — stary globalny kursor syncu (singleton, `id='default'`)

Zastąpiony przez `mail_folders`, ale zostaje (migracja czyta z niego INBOX).

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY, default `'default'` |
| `last_seen_uid` | INTEGER NN, default `0` | |
| `uid_validity` | BIGINT, null | zmiana UIDVALIDITY = reset kursora |
| `last_sync_at` | TIMESTAMPTZ, null | |
| `last_error` | TEXT, null | |

### 2.33 `mail_senders` — screener nowych nadawców

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `email` | TEXT NN, **UNIQUE** | |
| `status` | TEXT NN, default `'pending'` | `pending` / `approved` / `blocked` (`MAIL_SENDER_STATUSES`) |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `decided_at` | TIMESTAMPTZ, null | |

Wpis `pending` powstaje tylko przy pierwszym mailu kategorii `oferta`
(zapytanie); bramkowanie widoczności przez LEFT JOIN przy odczycie.

### 2.34 `mail_folders` — kursory synchronizacji per folder IMAP

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `role` | TEXT NN, **UNIQUE** | nasz stabilny klucz: `inbox`/`sent`/`trash`/`archive` |
| `imap_path` | TEXT NN | realna ścieżka na serwerze (np. `INBOX.Sent`) |
| `special_use` | TEXT, null | czy serwer zgłosił RFC 6154 |
| `uidvalidity` | BIGINT, null | |
| `last_seen_uid` | INTEGER NN, default `0` | |
| `last_sync_at` | TIMESTAMPTZ, null | |
| `last_error` | TEXT, null | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.35 `mail_templates` — szablony wiadomości (snippety)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `nazwa` | TEXT NN, default `''` | |
| `temat` | TEXT NN, default `''` | |
| `tresc` | TEXT NN, default `''` | |
| `created_at` / `updated_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.36 `mail_address_links` — aliasy adresów e-mail → klient/lead

Zapamiętana decyzja „ten adres to ten klient" (klient pisze z prywatnej
skrzynki). Jeden adres = jeden właściciel.

| Kolumna | Typ | Uwagi |
|---|---|---|
| `email` | TEXT | **PRIMARY KEY** (nie uuid!) |
| `client_id` | TEXT, null | → `clients(id)` ON DELETE **CASCADE** |
| `lead_id` | TEXT, null | → `leads(id)` ON DELETE **CASCADE** |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

---

### Moduły przekrojowe

### 2.37 `field_changes` — audyt zmian pól (Moduł 23)

Świadomie **bez FK** — log ma przeżyć skasowanie rekordu. Bez kolumny „kto"
(panel jednoosobowy). Hook wpięty na start tylko w klientów i leady.

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `entity` | TEXT NN | tekst, np. `client` / `lead` (rozszerzalne bez migracji) |
| `entity_id` | TEXT NN | |
| `field` | TEXT NN | nazwa pola |
| `old_value` | TEXT, null | |
| `new_value` | TEXT, null | |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

### 2.38 `notifications` — centrum powiadomień / kronika (Moduł 24)

Kronika „co się wydarzyło" — NIE lista zadań (tę liczy na żywo Pulpit).
Świadomie bez FK. Retencja 30 dni (`NOTIFICATIONS_RETENTION_DAYS`).

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `kind` | TEXT NN | rodzaj — niżej |
| `title` | TEXT NN | |
| `body` | TEXT NN, default `''` | |
| `entity` | TEXT, null | `lead`/`mail`/`invoice`/`cost`/`client`/`offer`/`contract`/`project` |
| `entity_id` | TEXT, null | |
| `dedupe_key` | TEXT NN, **UNIQUE** | opisuje ZDARZENIE, nie moment (np. `invoice_reminder:<id>:2`); zapis przez `ON CONFLICT DO NOTHING` |
| `read_at` | TIMESTAMPTZ, null | KIEDY przeczytano (pod przyszły push) |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |

**Rodzaje** (`NotificationKind`): `lead_new`, `mail_new`, `mail_nudge`,
`invoice_paid`, `invoice_reminder`, `invoice_dunning`, `recurring_invoice`,
`recurring_cost`, `offer_accepted`, `contract_signed`, `review_collected`.
W bazie zwykły tekst — nowy rodzaj nie wymaga migracji.

### 2.39 `device_tokens` — tokeny aplikacji natywnej (świeże, 2026-07-19)

Autoryzacja klientów natywnych przez nagłówek `Authorization: Bearer <token>`
— przeglądarka dalej używa cookie (`lib/auth.ts`). W bazie **wyłącznie
SHA-256 tokenu**; sam token zna tylko urządzenie (Keychain). Odebranie
dostępu = ustawienie `revoked_at`, wiersz zostaje jako ślad.

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `token_hash` | TEXT NN, **UNIQUE** | SHA-256 tokenu |
| `device_name` | TEXT NN | np. „iPhone Patryka" |
| `created_at` | TIMESTAMPTZ NN, default `now()` | |
| `last_used_at` | TIMESTAMPTZ NN, default `now()` | aktualizowane przy użyciu |
| `revoked_at` | TIMESTAMPTZ, null | null = aktywny |

---

## 3. Graf powiązań

Centrum grafu to para **lead ↔ klient** (lead „awansuje" na klienta:
`leads.client_id` ⇄ `clients.lead_id`) — prawie każdy inny rekord może
wskazywać na jedno lub oba.

```
lead ──awans──▶ client
 │  ▲               │ ▲
 │  └─ clients.lead_id
 │
 ├─ lead_activity (CASCADE)          client ─ client_activity (CASCADE)
 │     └─ mail_message_id                     └─ mail_message_id
 │                                   client ─ client_events (CASCADE, related_id bez FK)
 │                                   client ─ client_followups (CASCADE) ─ project
 │
 ▼ (wszystkie SET NULL, opcjonalne)
offers ── lead_id, client_id, project_id, invoice_id
invoices ─ lead_id, client_id, project_id, koryguje_id↺, rozlicza_zaliczke_id↺
   ├─ invoice_items / invoice_payments / invoice_reminders (CASCADE)
contracts ─ lead_id, client_id, project_id, offer_id
projects ─ lead_id, client_id
   ├─ project_tasks (CASCADE) ── milestone_id ─▶ project_milestones (CASCADE)
   ├─ project_activity / project_resources / project_onboarding_items (CASCADE)
   ├─ project_dependencies (CASCADE, project↔project)
   └─ time_entries (CASCADE) ── task_id ─▶ project_tasks (SET NULL)
costs / recurring_costs ─ project_id, client_id, lead_id (SET NULL)
notes ─ client_id, lead_id, project_id, event_id (SET NULL)
events ─ lead_id, project_id, client_id (SET NULL)
mail_messages ─ client_id, lead_id, invoice_id (SET NULL)
mail_address_links ─ client_id, lead_id (CASCADE)
```

Bez FK (celowo, mają przeżyć skasowanie rekordu): `field_changes`,
`notifications`, `client_events.related_id`. Samotne wyspy (zero FK):
`company_settings`, `service_catalog`, `offer_templates`, `mail_templates`,
`mail_state`, `mail_senders`, `mail_folders`, `device_tokens`,
`schema_state`, `recurring_invoices`.

Przepływ „lejka": lead → oferta (migawka klienta) → akceptacja e-podpisem
tworzy **projekt + fakturę** w jednej transakcji (`offers.project_id`/
`invoice_id` wskazują wynik) → umowa może powstać z oferty
(`contracts.offer_id`) → po „Wdrożone" projektu powstają `client_followups`
(nurture) → opinia wraca do `projects.review_*`.

---

## 4. Konwencje, które aplikacja musi znać

1. **`id` = TEXT z UUID generowanym w JS** (`crypto.randomUUID()`), nie
   SERIAL/int i nie uuid Postgresa. Tokeny publiczne (`share_token`,
   `review_token`, `wezwanie_share_token`) to UUID **bez myślników**.
2. **DATE vs TIMESTAMPTZ**: daty „biznesowe" wybierane przez człowieka
   (termin, data wystawienia, next_followup, data wydarzenia) są typu DATE i
   krążą w API jako string `YYYY-MM-DD`; momenty systemowe (created_at,
   accepted_at, snooze_until…) to TIMESTAMPTZ (ISO 8601 z offsetem).
3. **Walidacja i wyświetlanie dat**: każda data wpisywana ręcznie MUSI
   przejść `isPlausibleDateString()` (walidacja po stronie klienta ORAZ
   serwera — HTML-owy input potrafi zapisać rok „0202"), a wyświetlana być
   przez `formatPlDate()` (`lib/projects.ts`) — nigdy surowy string/ISO z
   bazy. Aplikacja natywna powinna replikować oba zachowania (format polski
   `d.MM.rrrr`, odrzucenie lat spoza sensownego zakresu).
4. **Migawka danych klienta na dokumentach**: `klient_nazwa`, `klient_nip`,
   `klient_ulica/kod/miasto/kraj`, `klient_email` na fakturze/ofercie/umowie
   to **kopia z chwili wystawienia** — dokument ma wyglądać tak, jak
   w dniu wystawienia, nawet gdy klient zmieni potem adres. `client_id` to
   osobne, czysto nawigacyjne POWIĄZANIE. **Nigdy nie nadpisywać migawki
   danymi z kartoteki klienta** i nie „naprawiać" rozjazdów.
5. **Ikona projektu = emoji** wybierane przez właściciela z palety 16 emoji
   (`PROJECT_ICONS` w `lib/projects.ts`: 📁 🌐 ⚙️ 🔍 🚀 📊 💼 🎨 📝 🤖 💡 🔧 📦 🎯 🛠️ 📈,
   default 📁), zapisane w `projects.ikona` jako tekst. To dana z bazy, nie
   afordancja UI — renderować dosłownie, nie zamieniać na ikony systemowe.
   Kolor projektu (`projects.kolor`) to hex z palety `PROJECT_COLORS`
   (default `#4ea7fc`).
6. **Waluty**: `PLN`/`EUR`/`USD`/`GBP` (`INVOICE_CURRENCIES`) na fakturach,
   ofertach (pozycje bez VAT) i umowach; default zawsze `PLN`. Koszty —
   tylko PLN (brak kolumny). Faktura w walucie obcej niesie kurs NBP
   (`kurs_nbp`, `kurs_nbp_data`, `kurs_nbp_tabela`) do wykazania VAT w PLN.
7. **Kwoty i ceny zawsze netto w bazie** (NUMERIC); `invoices.ceny_brutto`
   to wyłącznie tryb edytora. Stawka VAT to **TEKST**: `"23"`, `"8"`, `"5"`,
   `"0"`, `"zw"`, `"np"`.
8. **Języki dokumentów** (`DocLang`, `lib/documents.ts`): `pl`/`en`/`de`
   (Polski/English/Deutsch), kolumna `jezyk` na fakturach, ofertach, umowach
   i projektach; default `pl`.
9. **Enumy/statusy to zwykły TEXT** — bez typów ENUM Postgresa i przeważnie
   bez CHECK-ów; poprawność pilnują stałe w `lib/*.ts` i API. Wiele wartości
   to wprost polskie etykiety ze spacjami i znakami diakrytycznymi (np.
   status maila `obsłużony`, lead `Napisano - czeka na odpowiedź`) — trzymać
   je bajt w bajt.
10. **NULL ≠ pusty string** w module poczty: dla `kategoria`, `cc_addr`,
    `list_unsubscribe_url` NULL znaczy „jeszcze nie sprawdzone" (kandydat do
    backfillu), a `''`/wartość — „sprawdzone". Nie normalizować NULL→''.
11. **Kasowanie**: rekordy „dzieci" (pozycje, wpisy aktywności, wpłaty) giną
    kaskadą z rodzicem; powiązania między modułami są `SET NULL` (usunięcie
    klienta nie kasuje faktur). Logi bez FK (`field_changes`,
    `notifications`) przeżywają wszystko.
12. **Autoryzacja urządzeń natywnych** — patrz `device_tokens` (sekcja
    2.39): aplikacja trzyma surowy token w Keychain i wysyła go w
    `Authorization: Bearer`; serwer porównuje SHA-256 z `token_hash` i
    aktualizuje `last_used_at`; `revoked_at IS NOT NULL` = token martwy.

---

Opisano **40 tabel** (wszystkie z `lib/db.ts`, łącznie z `schema_state`) —
plik: `docs/natywna-aplikacja/inwentarz/05-model-danych.md`.
