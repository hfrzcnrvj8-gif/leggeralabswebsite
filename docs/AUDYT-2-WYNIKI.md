# Audyt 2 — dane osobowe i RODO: wyniki (2026-07-23)

Czwarty z siedmiu audytów końcowych (kolejność wg ryzyka: 4 → 1 → 3 → **2** →
6 → 5 → 7). Zakres: `docs/AUDYTY-KONCOWE.md` → „Audyt 2", brief wykonawczy:
`docs/plany-modulow/43-audyt-2-rodo.md`.
Poprzednie: `docs/AUDYT-4-WYNIKI.md`, `docs/AUDYT-1-WYNIKI.md`,
`docs/AUDYT-3-WYNIKI.md`.

**Pytanie audytu:** jakie dane trzymamy, jak długo, gdzie się kopiują i czy
umiemy je usunąć na żądanie. Robione **przed rejestracją firmy** — to ostatni
audyt techniczny z wprost prawną wagą: od rejestracji RODO staje się
obowiązkiem z sankcją, nie teorią.

Każde ustalenie jest poparte **odczytem schematu albo uruchomieniem** na
dev-bazie (PGlite), nigdy pamięcią ani zielonym buildem. Produkcyjna baza, NAS
i realne kopie są poza zasięgiem Claude — co ich dotyka, jest oznaczone
„⏳ do wykonania przez właściciela".

> **Firma NIE jest jeszcze zarejestrowana.** W bazie nie ma prawdziwych danych
> klientów. Pozycje świadomie odłożone (administrator w polityce, rejestr
> czynności przetwarzania, DPA) NIE są traktowane jako luki do naprawienia
> teraz — idą do `PO_REJESTRACJI.md` i `docs/DO-PRAWNIKA-I-TLUMACZA.md`.

---

## Mapa danych osobowych — rdzeń audytu

Zmierzone na **schemacie** (`grep 'CREATE TABLE' lib/db.ts`): **51 tabel**
(brief mówił „~49" — schemat urósł). Z nich **~22 zawiera dane osób**. Poniżej
tylko te; reszta (29 tabel: `schema_state`, `backup_runs`, `automation_runs`,
`alarm_state`, `service_catalog`, `offer_templates`, `mail_templates`,
`mail_state`, `mail_folders`, `mail_muted_threads`, `invoice_items/_payments/
_reminders`, `offer_items`, `project_tasks/_activity/_milestones/_resources/
_onboarding_items/_dependencies`, `notes`*, `notes_activity`*, `time_entries`,
`reminder_lists`, `recurring_costs`†) to konfiguracja, słowniki i pozycje
liczbowe bez danych osobowych.

`*` **notes / notes_activity** — osobisty notatnik właściciela; wolny tekst
**może** zawierać dane osób. Kategoria „wolny tekst" jak `notatki` w leadzie.
`†` **recurring_costs / costs** — `dostawca_nip`, `dostawca_nazwa`,
`dostawca_konto`; przy jednoosobowej działalności dostawcy NIP dostawcy bywa
daną osoby fizycznej.

### Podmioty danych (kto)

| Kategoria osoby | Gdzie w bazie | Jakie dane | Po co |
|---|---|---|---|
| **Lead** (potencjalny klient) | `leads`, `lead_activity` | firma, osoba kontaktowa, e-mail, telefon, www, LinkedIn, adres, notatki, log kontaktu | sprzedaż, kontakt |
| **Klient** | `clients`, `client_activity`, `client_events`, `client_followups` | jw. + NIP, historia zdarzeń, terminy kontaktu | realizacja umowy, CRM |
| **Osoba podpisująca** (umowa/oferta) | `contracts`, `offers` | imię, **IP, przeglądarka** (dowód e-podpisu), migawka nazwy/NIP/adresu/e-maila | dowód złożenia oświadczenia woli |
| **Nabywca faktury** | `invoices`, `recurring_invoices` | migawka nazwy, NIP, adresu, e-maila, odbiorcy | obowiązek podatkowy |
| **Korespondent** (poczta) | `mail_messages`, `mail_senders`, `mail_address_links`, `mail_outbox`, `mail_attachments` | adres, nazwa, temat, **pełna treść**, metadane załączników | obsługa korespondencji |
| **Recenzent projektu** | `projects` (`review_consent_*`) | imię, **IP, przeglądarka**, treść opinii, treść zgody | zgoda RODO na case study |
| **Gość wydarzenia** | `event_attendees`, `events` | e-mail, nazwa | zaproszenia .ics |
| **Dostawca** (koszty) | `costs`, `recurring_costs` | nazwa, NIP, konto | ewidencja kosztów |
| **Historia zmian** | `field_changes` | **stare i nowe wartości** pól (e-mail, telefon, nazwa, NIP) | audyt zmian (Moduł 23) |
| **Powiązania/przypomnienia** | `reminders` | tytuł, notatka; linki do leada/klienta/projektu | przypomnienia |
| **Właściciel** (administrator) | `company_settings`, `device_tokens`, `two_factor*` | dane firmy, nazwy urządzeń, sekret 2FA | konfiguracja, dostęp |

### Dokąd dane wychodzą dalej (odbiorcy i kopie)

| Kanał | Co wychodzi | Retencja / ochrona | Uwaga |
|---|---|---|---|
| **Kopie NAS** (Audyt 3) | **cała baza** = wszystkie dane osobowe | AES-256 (PBKDF2 200k); 7 dni + 4 tyg. | usunięcie osoby wypada z kopii w **≤4 tyg.** (patrz niżej) |
| **Off-site** (Audyt 3) | jw., zaszyfrowany plik | drugi dysk ręcznie | **nowe miejsce z danymi** — do polityki po rejestracji |
| **Logi Vercela** | żądania HTTP | godziny (plan Hobby) | **bez interpolacji danych osobowych** — sprawdzone (ust. 4) |
| **`error_log`** | komunikaty błędów | 500 wpisów **+ `oczyscTekst()`** | dane osobowe wycinane przed zapisem (Audyt 4) |
| **Poczta az.pl** | oryginały maili | podmiot zewnętrzny (podprocesor) | panel trzyma tylko roboczą kopię INBOX |
| **KSeF (MF)** | faktura: NIP/nazwa/adres nabywcy | **tylko tryb testowy** (`assertTestOnly`) | produkcja po rejestracji (`PO_REJESTRACJI.md` pkt 3) |
| **Resend** | adresy + treść maili wychodzących | podprocesor (USA) | do polityki prywatności |
| **Publiczne linki** `*/public/[token]` | dane dokumentu (oferta/faktura/umowa/opinia) | token 122-bit, **unieważnialny** (Mod. 40) | IP podpisującego **już nie wychodzi** (Mod. 40, ust. 5 Audytu 1) |
| **Lokalne AI (Ollama)** | fragmenty do OCR/szkicu | **Mac właściciela, NIE chmura** | ⭐ przewaga prywatności — patrz „Sprawdzone i dobrze" |

**Podprocesory do wpisania w polityce prywatności:** Neon (baza), Vercel
(hosting), az.pl (poczta), Resend (wysyłka), MF/KSeF (faktury — po produkcji).
NAS i Mac Studio to **własny sprzęt właściciela**, nie podmioty zewnętrzne.

---

## Ustalenia — kolejność wg ryzyka

### 1. `field_changes` — surowa historia e-maili/telefonów, bez retencji i bez FK ✅ NAPRAWIONE

**Najostrzejszy techniczny brak RODO w tym audycie — i zmierzony
uruchomieniem, nie przeczytany.** Tabela audytu zmian (Moduł 23) zapisuje
**stare i nowe wartości** każdego edytowanego pola. Dla pól kontaktowych to
znaczy surowe adresy e-mail i numery telefonu — `logFieldChanges()`
(`lib/auditLog.ts`) **nie przechodzi przez `oczyscTekst()`** (inaczej niż
`error_log`).

Trzy problemy naraz, potwierdzone testem:

- **brak retencji** — log rośnie bezterminowo;
- **brak klucza obcego** do leada/klienta (świadomie — audytuje też byty bez
  własnej tabeli), więc **kaskada bazy go nie rusza** przy usunięciu osoby;
- w efekcie: **usunięcie klienta zostawia jego dane osobowe w tym logu**.

**Zmierzone (PGlite):** PATCH e-maila klienta „Nordwind Studio" →
`DELETE FROM clients` → wiersz `email: anna@nordwind.pl → nowy@…` **przeżył
usunięcie** i dalej dawał się odczytać przez `/api/clients/:id/changes`.

**Naprawa (2026-07-23):** `deleteFieldChanges(entity, id)` w `lib/auditLog.ts`,
wołane **jawnie** w `DELETE /api/clients/:id`, `DELETE /api/leads/:id` oraz
w automatycznej retencji leadów (ust. 2). Dane wybrane świadomie **zostają**
(bez oczyszczania), dopóki osoba istnieje — inaczej audyt „z jakiego adresu na
jaki" byłby bezużyteczny; znikają **razem z osobą**. Zweryfikowane
uruchomieniem: po naprawie PATCH → DELETE → `/changes` zwraca **0 wierszy**.

### 2. Leady i klienci leżeli bezterminowo — brak reguły retencji ✅ CZĘŚCIOWO WDROŻONE (decyzja właściciela)

Do dziś `leads`, `clients` i logi kontaktu (`lead_activity`, `client_activity`,
`client_events`) nie miały żadnej reguły „jak długo" — w odróżnieniu od poczty
(24 mies.), powiadomień (30 dni) i kopii (7 dni + 4 tyg.). RODO nie pozwala
trzymać danych „na wszelki wypadek".

**Decyzje właściciela (2026-07-23):**

- **Leady bez konwersji → 24 miesiące od ostatniego kontaktu, automatycznie.**
  Wdrożone: `purgeStaleLeads()` (`lib/leadRetention.ts`) w dziennym cronie.
  Kasuje leada **tylko** gdy nie ma powiązanego klienta, faktury, oferty, umowy
  ani projektu (wykluczenia chronią każdą realną relację), a od ostatniego
  kontaktu (`ostatni_kontakt`, a gdy pusty — `created_at`) minęły 24 mies.
  Podstawą czasu **świadomie nie jest `updated_at`** — inaczej dowolna edycja
  karty resetowałaby zegar RODO.
- **Klienci → bez auto-usuwania, przegląd ręczny.** Świadomie: faktury i umowy
  klienta są obowiązkiem podatkowym (**5 lat**), więc automat mógłby skasować
  kogoś, kogo prawo każe trzymać. Nie budujemy takiego automatu.

**Zweryfikowane uruchomieniem (PGlite, 3 testy):**
1. lead z kontaktem 2022-01-15 → cron → **usunięty (404)**;
2. lead z kontaktem 2026-07-20 → cron → **został (200)**;
3. lead stary **z fakturą** → cron → **został (200)** — prawo podatkowe chroni.

Nadzór: nieudane czyszczenie ląduje w `error_log` (`zapiszWyjatek("retencja"…)`)
i wychodzi w dziennym mailu — **ten sam mechanizm co Audyt 4**, żaden nowy
automat. Liczba usuniętych trafia do treści raportu.

### 3. Prawo do usunięcia — dziś brak procedury; kaskady sprawdzone uruchomieniem ✅ PROCEDURA + NAPRAWA

Usunięcie klienta/leada to zwykłe `DELETE FROM …` na kaskadach FK. **Co się
naprawdę dzieje** (zmierzone na PGlite, usuwając klienta „Nordwind Studio"):

| Powiązanie | Zachowanie | Dane osobowe |
|---|---|---|
| `client_activity`, `client_events`, `client_followups`, `mail_address_links` | **CASCADE — usuwane** | znikają ✅ |
| `contracts`, `offers`, `invoices`, `projects` | `client_id → NULL`, wiersz zostaje | **migawka nazwy/NIP/adresu/e-maila zostaje** — świadome (obowiązek podatkowy) |
| `mail_messages` | `client_id → NULL`, wiersz zostaje | treść + adres zostają, ale **własna retencja 24 mies.** |
| `field_changes` | **było: osierocone**; teraz kasowane jawnie (ust. 1) | znikają ✅ (po naprawie) |

**Procedura „usuń wszystkie dane osoby" (ręczna, decyzja właściciela):**

1. **Klient/lead:** usuń w panelu (kaskady + `field_changes` załatwione kodem).
2. **Migawki na fakturach/umowach:** **zostają świadomie** — to obowiązek
   podatkowy (5 lat), nie luka. Po upływie okuresu podatkowego można je
   anonimizować (opcja odłożona, patrz „Co otwarte").
3. **Poczta:** wiadomości z tym adresem wygasają same w ≤24 mies. (retencja);
   pilne usunięcie — ręcznie na bazie (brak przycisku „usuń wiadomość", patrz
   `PO_REJESTRACJI.md` pkt 2 — do decyzji z prawnikiem).
4. **Kopie (NAS + off-site):** **rozwiązują się same** — usunięta osoba wypada
   z rotacji kopii w **≤4 tygodnie** (7 dni dziennych + 4 tygodnie
   tygodniowych). Żadnego działania ręcznego; to czysta konsekwencja retencji
   z Audytu 3. **Nazwane wprost, nie założone.**

Przycisk „Usuń wszystkie dane osoby" w panelu — **świadomie NIE budowany**:
przy jednej osobie i rzadkich żądaniach procedura ręczna wystarcza, a przycisk
byłby kodem „na zapas" przed pierwszym klientem (decyzja właściciela).

### 4. Logi nie wypuszczają danych osobowych ✅ SPRAWDZONE (nie założone)

Brief kazał sprawdzić drogi logowania **poza** `error_log`. Grep po
`console.error/warn/log` z interpolacją wartości osobowych
(`${…email/addr/telefon/nazwa/nip}`) w `lib/` i `app/api/`: **zero trafień**
w kodzie produkcyjnym. Dwa pozorne przypadki, sprawdzone pojedynczo:

- `lib/mailSync.ts:753` — loguje **obiekt błędu `e`**, nie adres (komentarz
  „klasyfikuję po adresie" opisuje logikę fallbacku, nie treść logu);
- `lib/email.ts:22` — `console.log` z adresatem i treścią maila jest **za
  `NODE_ENV === "development" && !RESEND_API_KEY`**; na produkcji klucz jest,
  więc gałąź nigdy się nie wykonuje.

Czyli logi Vercela (retencja w godzinach) **nie stają się** niejawnym zbiorem
danych osobowych. Do tego `error_log` ma `oczyscTekst()` (Audyt 4), a
`rate_limit_hits` trzyma odciski SHA-256 zamiast IP (Audyt 1).

### 5. Brief mylił się co do dwóch „luk" retencji ⚠️ USTALENIE

Brief wymieniał `error_log` i `rate_limit_hits` jako zbiory **bez** reguły
retencji. **Odczyt kodu pokazał inaczej — oba są już zaopiekowane:**

- `error_log` — `DELETE … LIMIT 500` (`lib/errorLog.ts:100`) **+**
  `oczyscTekst()`; `automation_runs` — analogicznie 200 wpisów;
- `rate_limit_hits` — `DELETE … created_at < now() - 24h`
  (`lib/rateLimit.ts:184`), a treścią jest odcisk, nie dana osobowa;
- `two_factor_used` — 5 min; `backup_runs` — 60 wpisów.

Realne luki bez reguły były **trzy**, nie pięć: leady, klienci, `field_changes`
— wszystkie domknięte w tym audycie (ust. 1–2). To ta sama lekcja co zawsze:
**weryfikuj gretem po użyciu, nie ufaj liście z briefu.**

---

## Tabela retencji — każdy zbiór z odpowiedzią „jak długo i dlaczego"

| Zbiór | Retencja | Podstawa | Stan |
|---|---|---|---|
| `mail_messages` (poczta) | **24 mies.** | RODO / obsługa korespondencji | istniało |
| `notifications` (kronika) | **30 dni** | nieaktualne po miesiącu | istniało |
| Kopie bazy (NAS + off-site) | **7 dni + 4 tyg.** | RODO — dane nie leżą bezterminowo | Audyt 3 |
| `error_log` | **500 wpisów** + `oczyscTekst()` | diagnostyka bez danych osobowych | Audyt 4 |
| `automation_runs` | 200 wpisów | bicie serca automatów | Audyt 4 |
| `rate_limit_hits` | **24 h**, odcisk nie IP | ochrona logowania | Audyt 1 |
| `two_factor_used` | 5 min | okno kodu TOTP | Moduł 41 |
| `backup_runs` | 60 wpisów (~2 mies.) | rozpoznanie wzorca awarii | Audyt 4 |
| **`leads` (bez konwersji)** | **24 mies. od kontaktu** | RODO — nie trzymać „na zapas" | **✅ ten audyt** |
| **`field_changes`** | **znika z osobą** | RODO — surowe e-maile/telefony | **✅ ten audyt** |
| `clients` + faktury/umowy | **brak auto** (5 lat prawnie) | obowiązek podatkowy > RODO | decyzja właściciela |
| `costs` / `recurring_costs` | brak auto | ewidencja księgowa (5 lat) | świadomie |
| `projects.review_consent_*` | trwałe (dowód zgody) | dowód zgody RODO na case study | świadomie — do polityki |

---

## Sprawdzone i jest dobrze

To też jest wynik audytu.

- **Lokalne AI (Ollama) = przewaga prywatności, nie luka.** OCR paragonów,
  szkice maili i skan wizytówek chodzą na **Macu Studio właściciela**
  (`lib/ollama.ts` → `OLLAMA_API_URL` = Tailscale do własnego sprzętu), nie
  przez chmurowe API żadnego dostawcy LLM. Dane osób **nie opuszczają
  sprzętu właściciela**. To realny argument sprzedażowy integratora lokalnych
  LLM i mocna pozycja w polityce prywatności — nie tylko „sprawdzone".
- **Migawki na fakturach/umowach są świadome, nie przypadkowe.** `klient_nazwa`
  /`nip`/`adres` są kopiowane do dokumentu celowo (`client_id` = powiązanie,
  nie źródło treści) — dokument podatkowy musi przeżyć usunięcie kartoteki.
- **`rate_limit_hits` trzyma odciski SHA-256, nie adresy IP** — wzorzec
  z Audytu 1: adres IP to dana osobowa, tabela pełna IP byłaby nowym zbiorem
  objętym prawem do usunięcia.
- **Publiczne trasy nie wypuszczają już IP podpisującego** — białe listy pól
  w `lib/publicFields.ts` (Moduł 40, ust. 5–6 Audytu 1). Linki są
  unieważnialne.
- **`error_log` czyści dane osobowe przed zapisem** (`oczyscTekst()`, Audyt 4)
  — logi diagnostyczne nie są niejawnym zbiorem PII.
- **Retencja poczty leci nawet gdy sync padł** — to niezależny obowiązek RODO,
  nie krok pobierania (`syncMailAndPurge`, komentarz w kodzie).

---

## Jak to zweryfikowano (nie „skompilowało się")

`tsc` przeszło czysto, ale **to nie jest dowód** (SQL-a nie sprawdza). Dowód to
uruchomienie na PGlite (dev-baza, izolowana od produkcji):

1. **`field_changes` osierocone PRZED naprawą** — PATCH e-maila klienta →
   `DELETE` → `/changes` zwraca 1 wiersz `email: anna@nordwind.pl → nowy@…`.
2. **`field_changes` czyste PO naprawie** — ten sam scenariusz → `/changes`
   zwraca **0 wierszy**.
3. **Retencja leadów — pozytywne usunięcie** — lead z kontaktem 2022-01-15 →
   dzienny cron → **404**.
4. **Retencja leadów — świeży przeżywa** — lead z kontaktem 2026-07-20 → cron
   → **200**.
5. **Retencja leadów — wykluczenie faktury** — stary lead z powiązaną fakturą
   → cron → **200** (prawo podatkowe chroni).
6. **SQL retencji wykonuje się na PGlite** — cały dzienny cron `ok: true`,
   zero błędów `retencja` w logach serwera.
7. **Mapa danych na SCHEMACIE** — `CREATE TABLE` w `lib/db.ts` policzone
   i przejrzane (51 tabel), nie zgadywane z listy modułów.
8. **Logi bez danych osobowych** — grep po interpolacji wartości osobowych
   w `console.*`: zero w kodzie produkcyjnym (ust. 4).

Skrypty testowe były jednorazowe (curl na dev-serwerze), dev-baza jest
efemeryczna (PGlite reseeduje) i w 100% izolowana od produkcji.

---

## Co zmieniono w kodzie

Minimalnie, zgodnie z „nie buduj nic na zapas":

- **`lib/leadRetention.ts`** (nowy) — `purgeStaleLeads()`: usuwa martwe leady
  bez konwersji po 24 mies., z wykluczeniami i sprzątaniem `field_changes`.
- **`lib/leads.ts`** — stała `LEADS_RETENTION_MONTHS = 24` (musi zgadzać się
  z polityką prywatności, jak `MAIL_RETENTION_MONTHS`).
- **`lib/auditLog.ts`** — `deleteFieldChanges(entity, id)`.
- **`app/api/clients/[id]/route.ts`, `app/api/leads/[id]/route.ts`** — DELETE
  woła `deleteFieldChanges()`.
- **`app/api/leads/notify/route.ts`** — dzienny cron woła `purgeStaleLeads()`
  (nadzór przez `error_log`, linia w raporcie).

Bez nowego schematu → **bramka migracji niepotrzebna** (żadnej nowej
tabeli/kolumny). Bez `inMigration()` (żadnego zapisu w migracji). `useUI()`
nie dotyczy (zmiany serwerowe).

---

## Co zostaje otwarte

- **Treść prawna → prawnik.** Kategorie danych, retencja (24 mies. leady, 24
  mies. poczta, 5 lat faktury), podprocesorzy (Neon, Vercel, az.pl, Resend,
  MF/KSeF), off-site jako nowe miejsce z danymi — **dopisane do
  `docs/DO-PRAWNIKA-I-TLUMACZA.md`**. Administrator danych + rejestr czynności
  przetwarzania czekają na rejestrację (`PO_REJESTRACJI.md`).
- **Anonimizacja migawek po okresie podatkowym** — opcja odłożona: po 5 latach
  dane nabywcy na starych fakturach można czyścić, zostawiając kwoty. Nie ma
  sensu przed pierwszym klientem.
- **Przycisk „usuń wiadomość" w poczcie** — dziś kasowanie maila to ręczna
  operacja na bazie; czy to wystarcza wobec prawa do usunięcia — **decyzja
  prawnika** (`PO_REJESTRACJI.md` pkt 2).
- **Przycisk „Usuń wszystkie dane osoby"** — świadomie niebudowany; do rewizji,
  gdyby żądań usunięcia było dużo.

## Czego ten audyt NIE obejmował

Zgodnie z „jeden audyt = jeden czat":

- **Audyt 6 (poprawność kodu, dług techniczny)** — **następny w kolejce.**
  Największa słabość: 342 pliki, 148 tras, zero testów automatycznych.
- **Audyty 5/7** — koszty, produkt. Nietknięte.
- **Redakcja wiążącej treści prawnej** — rola prawnika, nie modelu
  (`docs/DO-PRAWNIKA-I-TLUMACZA.md`).
