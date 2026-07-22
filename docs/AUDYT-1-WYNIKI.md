# Audyt 1 — bezpieczeństwo i dostęp: wyniki (2026-07-22)

Drugi z siedmiu audytów końcowych (kolejność wg ryzyka: 4 → **1** → 3 → 2 →
6 → 5 → 7). Zakres: `docs/AUDYTY-KONCOWE.md` → „Audyt 1".
Poprzedni: `docs/AUDYT-4-WYNIKI.md`.

Każde ustalenie poniżej jest poparte odczytem kodu albo uruchomieniem.
Tam, gdzie czegoś **nie** sprawdziłem, jest to napisane wprost.

---

## Ustalenia — kolejność wg ryzyka

### 1. Logowanie bez żadnego hamulca ✅ NAPRAWIONE

**Stan zastany, zmierzony, nie opisany:** 30 kolejnych żądań
`POST /api/admin/login` ze złym hasłem → **30× HTTP 401, ani jednego 429**,
bez opóźnienia. 50 żądań równolegle wykonało się w **0,28 s**. Grep po całym
repozytorium za `rate limit|throttl|429`: **zero trafień** — hamulca nie było
nigdzie, nie tylko przy logowaniu.

Waga: panel ma **jedno hasło i żaden drugi składnik**, a endpoint jest
publiczny z definicji. Nielimitowane zgadywanie to była najkrótsza droga do
wszystkich danych klientów naraz. Samo porównanie hasła jest odporne na atak
czasowy (`timingSafeEqual`, `lib/auth.ts:12`) — brakowało wyłącznie hamulca.

**Naprawa:** `lib/rateLimit.ts` + tabela `rate_limit_hits` (`lib/db.ts`,
z bramką migracji). Próg **5 nieudanych prób z jednego adresu / 15 min** —
decyzja właściciela z tej sesji. Do tego drugi, luźniejszy limit **globalny**
(30/15 min ze wszystkich adresów naraz), bo botnet z tysiąca adresów obchodzi
limit per-IP, a właściciel loguje się z jednego lub dwóch miejsc.

Trzy rzeczy, które w tym rozwiązaniu są decyzjami, nie szczegółami:

- **Licznik w bazie, nie w pamięci procesu.** Na Vercelu każde żądanie może
  trafić w inną instancję funkcji — licznik w zmiennej modułu liczyłby osobno
  dla każdej i przy kilkunastu instancjach nie zatrzymałby niczego,
  *wyglądając w kodzie na działający hamulec*.
- **Odcisk zamiast adresu IP.** W bazie leży `SHA-256(adres + sekret sesji)`.
  Adres IP jest daną osobową (Audyt 2); tabela pełna adresów byłaby nowym,
  nieudokumentowanym zbiorem objętym prawem do usunięcia. Do pytania „ile
  prób z tego samego miejsca" odcisk wystarcza w 100 %.
- **Fail-closed.** Gdy zapytanie o licznik padnie, logowanie **nie**
  przechodzi. Odwrotny wybór zamieniłby awarię bazy w wyłącznik hamulca.

Przekroczenie progu ląduje w `error_log` z Audytu 4 → wychodzi w dziennym
mailu. Bez tego hamulec blokowałby ataki po cichu i powtarzałby antywzorzec
z ustalenia 3 tamtego audytu (tabela tylko do zapisu).

### 2. Publiczny formularz kontaktowy też nie miał hamulca ✅ NAPRAWIONE

`POST /api/leads` jest świadomie publiczny (formularz na stronie), ale
przyjmował **nieograniczoną liczbę zgłoszeń** — w tym z etykietą
`zrodlo_kategoria: "Formularz na stronie"`, która woła `notify()`. Obcy mógł
jednocześnie zalać bazę leadami i rozdzwonić centrum powiadomień.

Naprawa: ten sam mechanizm, próg **5 zgłoszeń z adresu / 60 min**.
Zalogowany właściciel jest **wyłączony spod limitu** — ta sama trasa obsługuje
„+ Dodaj lead" z panelu, a sześć leadów wpisanych ręcznie w godzinę to
normalna praca, nie atak.

### 3. Lista „9 tras bez `isAuthed()`" była nieprawdziwa ⚠️ USTALENIE

Brief Audytu 4 wymieniał 9 tras publicznych. **Jest ich 14 plików / 16
uchwytów.** Różnica nie wzięła się z nowych tras — wzięła się z metody:
poprzednia lista powstała gretem po pliku (`grep -L isAuthed`), a pięć tras
**wspomina `isAuthed()` w komentarzu**, uzasadniając jego brak. Grep uznał je
za chronione.

Pominięte wtedy: `offers/public/[token]` (+`accept`), `invoices/public/[token]`,
`projects/review/public/[token]/submit`, `references`.

Poprawna metoda — i tak liczę poniżej — to **przegląd per uchwyt HTTP, nie per
plik**: `211 uchwytów w 149 plikach, 195 bramkowanych, 16 świadomie
publicznych`. Per plik gubi się też przypadek odwrotny: `invoices/[id]/ksef/send`
i `ksef/auth/test` nie mają `isAuthed()` w ciele uchwytu, bo wołają je przez
wspólną funkcję pomocniczą (`runSend`, `runAuthTest`) — sprawdzone, są
chronione.

### 4. Pełna lista 16 publicznych uchwytów — każdy z uzasadnieniem

To jest ta „najkrótsza lista, jaką warto znać na pamięć" z zakresu audytu.

| Uchwyt | Czym chroniony | Werdykt |
|---|---|---|
| `POST /api/admin/login` | hasło + hamulec 5/15 min (od dziś) | ✅ musi być publiczny |
| `POST /api/admin/logout` | nic — kasuje własne ciasteczko / własny token z nagłówka | ✅ nie da się nim nic zdobyć |
| `POST /api/backup/ping` | `Bearer BACKUP_PING_SECRET`, fail-closed | ✅ |
| `GET /api/calendar/ics` | `?token=CALENDAR_ICS_SECRET`, fail-closed | ⚠️ sekret w URL, patrz ust. 7 |
| `POST /api/telefonia/webhook` | `?token=TELEFONIA_WEBHOOK_SECRET`, fail-closed | ⚠️ sekret w URL, patrz ust. 7 |
| `GET /api/leads/notify` | `Bearer CRON_SECRET`, fail-closed | ✅ |
| `POST /api/leads` | hamulec 5/60 min (od dziś) | ✅ formularz na stronie |
| `GET /api/references` | filtr `review_consent_case_study = true` | ✅ dane z definicji publiczne |
| `GET /api/offers/public/[token]` | token 122-bitowy + `status != 'Szkic'` | ✅ |
| `POST /api/offers/public/[token]/accept` | jw. | ✅ |
| `GET /api/contracts/public/[token]` | jw. | ⚠️ wycieka IP podpisującego, ust. 5 |
| `POST /api/contracts/public/[token]/accept` | jw. + „claim" (409 przy drugim podpisie) | ✅ |
| `GET /api/invoices/public/[token]` | jw. | ⚠️ wycieka drugi token, ust. 6 |
| `GET /api/invoices/wezwanie/public/[token]` | osobny token + `wezwanie_wystawiono_at IS NOT NULL` | ✅ |
| `GET /api/projects/review/public/[token]` | token 122-bitowy | ✅ |
| `POST /api/projects/review/public/[token]/submit` | jw. | ✅ |

**Siła tokenów sprawdzona w kodzie**, nie założona: wszystkie pięć rodzajów
(`ensureInvoiceShareToken`, `…Wezwanie…`, `ensureOfferShareToken`,
`ensureContractShareToken`, `ensureProjectReviewToken` — `lib/db.ts:1522+`)
to `randomUUID()` bez myślników: 32 znaki hex, **122 bity losowości
z generatora kryptograficznego**, każdy z unikalnym indeksem w bazie.
Zgadywanie jest niewykonalne. **Nie wygasają** — patrz ustalenie 8.

### 5. Publiczna umowa wydaje adres IP osoby, która ją podpisała ⚠️ DO NAPRAWY

`app/api/contracts/public/[token]/route.ts:15` robi `SELECT *` i ukrywa cztery
kolumny (`lead_id`, `client_id`, `project_id`, `offer_id`). W odpowiedzi
zostają natomiast **`accepted_ip`, `accepted_user_agent` i `accepted_by_name`**
(kolumny z `lib/db.ts:1149-1152`).

Skutek: każdy, kto ma link do podpisanej umowy — a link chodzi mailem
i bywa przesyłany dalej — dostaje adres IP i przeglądarkę osoby, która ją
podpisała. To dane osobowe wydawane bez podstawy, dokładnie ten materiał,
który Audyt 2 (RODO) będzie musiał zinwentaryzować.

Te trzy pola istnieją po to, żeby **właściciel** miał dowód złożenia
oświadczenia woli. Druga strona nie ma powodu ich widzieć.

### 6. Publiczna faktura wydaje drugi, osobny token ⚠️ DO NAPRAWY

`app/api/invoices/public/[token]/route.ts:24` ukrywa `lead_id`, `project_id`
i `last_reminder_at`. W odpowiedzi zostają:

- **`wezwanie_share_token`** — token do publicznego wezwania do zapłaty,
  celowo osobny od tokenu faktury (komentarz w
  `invoices/wezwanie/public/[token]/route.ts` mówi o tym wprost). Wydając go
  razem z fakturą, kasujemy sens tego rozdzielenia;
- `client_id` — kolumna dodana **później** (`lib/db.ts:1258`, Moduł 30) niż
  powstała ta trasa;
- `reminder_level`, `ksef_upo`, `ksef_blad` — dane operacyjne.

**To jest wzorzec, nie pojedyncza literówka.** `SELECT *` z czarną listą pól
oznacza, że **każda nowa kolumna staje się publiczna sama z siebie** — trzeba
pamiętać o dopisaniu jej do listy, a nikt nigdy nie pamięta. Dowód, że to nie
teoria: `client_id` wyciekł dokładnie w ten sposób, mimo że dwie sąsiednie
trasy (`contracts/public`, `wezwanie/public`) go ukrywają.

Poprawka to zamiana czarnej listy na białą (wypisać wprost pola, które wydruk
faktycznie zużywa) w czterech trasach `*/public/[token]`.

### 7. Sekrety wędrujące w adresie URL ⚠️ DO WIEDZY

`GET /api/calendar/ics?token=…` i `POST /api/telefonia/webhook?token=…`
noszą sekret w query stringu. Oba mają dobre uzasadnienie w komentarzach
(aplikacje kalendarzowe subskrybują goły URL; dostawcy VoIP pozwalają
skonfigurować tylko adres) i oba są **fail-closed** — to zostaje.

Czego uzasadnienie nie obejmuje: adresy URL trafiają do **logów serwera**
(u Vercela i u dostawcy VoIP), do historii przeglądarki i do nagłówka
`Referer`. Sekret w URL trzeba więc traktować jak sekret **już częściowo
ujawniony** i rotować go częściej niż resztę. Sekret kalendarza odblokowuje
podgląd wszystkich wydarzeń na 13 miesięcy; webhook telefonii pozwala
**dopisywać** wpisy do osi kontaktu leadów i klientów.

Drobiazg z tej samej rodziny: porównanie `token !== secret` w obu trasach nie
jest odporne na atak czasowy (inaczej niż hasło administratora). Realne
ryzyko jest znikome (sekret jest losowy, a sieć zaszumia pomiar), ale gdyby
kiedyś ujednolicać — `safeEqual` z `lib/auth.ts` jest już napisane.

### 8. Linki publiczne są wieczne i nieodwoływalne 📋 DECYZJA WŁAŚCICIELA

Żaden z pięciu rodzajów tokenów nie ma daty ważności ani sposobu
unieważnienia — sprawdzone w schemacie (`lib/db.ts`: kolumny `share_token`,
`wezwanie_share_token`, `review_token` — same `TEXT`, bez `expires_at`, bez
`revoked_at`) i w trasach (żadna nie sprawdza wieku). Mail przesłany dalej
przez klienta = **trwały dostęp do dokumentu**, którego nie da się cofnąć.

**Decyzja właściciela (2026-07-22):** tokeny zostają wieczne — faktura sprzed
dwóch lat ma się dalej otwierać — ale ma dojść **ręczne unieważnienie**
(przycisk „Unieważnij link" w panelu). Brief:
`docs/plany-modulow/40-uniewaznianie-linkow.md`.

### 9. Zmiana hasła NIE odbiera dostępu aplikacji na telefonie ⚠️ DO WIEDZY

Wynika wprost z konstrukcji (`lib/auth.ts`), ale nigdzie nie było zapisane,
a przy wycieku hasła decyduje o kolejności ruchów:

- ciasteczko przeglądarki to `SHA-256(ADMIN_PASSWORD + ADMIN_SESSION_SECRET)`
  → **zmiana hasła unieważnia wszystkie sesje przeglądarkowe natychmiast**;
- token urządzenia (apka iOS) to niezależny wiersz w `device_tokens`, w ogóle
  niezwiązany z hasłem → **zmiana hasła go nie rusza**.

Czyli: po wycieku hasła trzeba zrobić **oba** ruchy — zmienić hasło **i**
przejrzeć urządzenia w panelu (`DevicesPanel.tsx`). Po zgubieniu telefonu
wystarczy odebrać token, bez zmiany hasła. To działa dokładnie tak, jak
zaprojektowano; brakowało tylko zapisanej procedury (jest niżej).

### 10. Nowa trasa API jest domyślnie otwarta ⚠️ DO WIEDZY

W projekcie **nie ma warstwy pośredniej chroniącej `/api`**. Jedyny plik
`proxy.ts` (odpowiednik `middleware.ts` w Next 16) robi wyłącznie
przekierowanie językowe i **jawnie wyłącza `/api` ze swojego zakresu**
(`matcher: ["/((?!_next|api|favicon.ico|.*\\.).*)"]`, `proxy.ts:35`).

Cała ochrona to 195 powtórzeń tej samej linijki w 149 plikach. Dziś wszystkie
są na miejscu — sprawdzone uchwyt po uchwycie. Ale **zapomnienie jednej daje
otwartą trasę bez żadnego objawu**: build przejdzie, panel zadziała, nikt się
nie dowie. To jest cena przyjętego wzorca, nie błąd do naprawienia dziś —
warto o niej wiedzieć, dokładając trasę.

Strony panelu są bramkowane osobno i **wszystkie 26 to robi** (sprawdzone
gretem po każdym `app/[lang]/admin/**/page.tsx`).

### 11. `.env.example` zna 12 z 24 zmiennych ⚠️ DROBIAZG

Zakres audytu mówi wprost: „Dziś nie ma takiej listy w jednym miejscu".
`.env.example` mógłby nią być, ale zatrzymał się na Module 4 — nie ma w nim
`MAIL_*`, `KSEF_*`, `BACKUP_PING_SECRET`, `CALENDAR_ICS_SECRET`,
`TELEFONIA_WEBHOOK_SECRET`, `OLLAMA_*`, `DEV_ADMIN_BYPASS`.
Pełny inwentarz jest niżej w tym dokumencie.

---

## Inwentarz sekretów

Zebrany z kodu (`grep process.env` po całym repo → 24 zmienne), ze skryptu
kopii i z aplikacji iOS. Kolumna „co odblokowuje" jest ważniejsza niż nazwa.

| Sekret | Gdzie leży | Co odblokowuje | Kto ma dostęp |
|---|---|---|---|
| `ADMIN_PASSWORD` | env Vercela | **wszystko** — cały panel | właściciel |
| `ADMIN_SESSION_SECRET` | env Vercela | sam nie wystarcza; z hasłem tworzy ciasteczko | właściciel |
| `DATABASE_URL` / `POSTGRES_URL` | env Vercela | pełny zapis i odczyt bazy | właściciel, Vercel |
| hasło konta `kopia_ro` | `.env` kontenera na NAS-ie | **odczyt** całej bazy (patrz „najmniejsze uprawnienia") | właściciel, NAS |
| `HASLO_KOPII` | `.env` kontenera na NAS-ie | odszyfrowanie kopii zapasowych | właściciel, NAS |
| `BACKUP_PING_SECRET` | env Vercela + NAS | dopisywanie meldunków o kopiach | właściciel, NAS |
| `CRON_SECRET` | env Vercela (używa go Vercel Cron) | uruchomienie dziennego raportu i kolejki wysyłki | Vercel |
| `CALENDAR_ICS_SECRET` | env Vercela + URL subskrypcji w telefonie | **odczyt wszystkich wydarzeń** (13 mies.) | właściciel, aplikacja kalendarza |
| `TELEFONIA_WEBHOOK_SECRET` | env Vercela (dostawca VoIP — jeszcze nikt) | **dopisywanie** wpisów kontaktu do leadów/klientów | nikt (brak konta VoIP) |
| `MAIL_USER` / `MAIL_PASS` | env Vercela | pełna skrzynka az.pl: czytanie, kasowanie, **wysyłka jako Ty** | właściciel, az.pl |
| `RESEND_API_KEY` | env Vercela | wysyłka maili przez Resend | właściciel, Resend |
| `KSEF_TEST_TOKEN` (+ `KSEF_NIP`, `KSEF_ENV`) | env Vercela | KSeF **wyłącznie testowy** (bramka `assertTestOnly`) | właściciel, MF |
| `OLLAMA_API_SECRET` (+ `OLLAMA_API_URL`) | env Vercela + Mac Studio | lokalny model przez Tailscale Funnel | właściciel |
| token urządzenia (apka iOS) | Keychain telefonu, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` | **wszystko** — pełne API panelu | telefon właściciela |
| `DEV_ADMIN_BYPASS` | wyłącznie `.env.local` | pominięcie logowania na `localhost` | nikt poza tym Makiem |

**Zmienne `NEXT_PUBLIC_*`** (adres strony, linki do rezerwacji, LinkedIn) są
z definicji jawne i nie są sekretami — trafiają do kodu przeglądarki.

**Sprawdzone: żaden plik z sekretami nigdy nie trafił do repozytorium.**
`git log --all -- .env .env.local` — pusto. `.env.example` jest w repo, ale
zawiera wyłącznie komentarze i puste przypisania (przeczytany w całości).

## Zasada najmniejszych uprawnień

| Integracja | Stan | Ocena |
|---|---|---|
| Kopie zapasowe → baza | osobne konto `kopia_ro`, `GRANT SELECT` + `ALTER DEFAULT PRIVILEGES` (`scripts/kopia-zapasowa/konto-ro.sql`) | ✅ wzorcowo; przeczytany plik, nie tylko nazwa |
| KSeF | `assertTestOnly()` (`lib/ksef-api.ts:41-48`) **twardo blokuje** tryb produkcyjny; token jest testowy, nadany na środowisko testowe MF | ✅ węziej się nie da przed rejestracją |
| Skrzynka az.pl | `MAIL_USER`/`MAIL_PASS` = pełne konto pocztowe (IMAP + SMTP) | ⚠️ nie da się zawęzić — poczta nie zna uprawnień cząstkowych. Ryzyko wprost: kto ma to hasło, **pisze jako Ty** |
| Resend | jeden klucz API | ❓ Resend rozróżnia klucze „tylko wysyłka" i „pełny dostęp". Którego typu jest ten — nie sprawdzę z kodu, patrz pytania |
| Ollama | `OLLAMA_API_SECRET` jest **opcjonalny** po stronie panelu (`lib/ollama.ts:11-13` — brak sekretu = brak nagłówka `Authorization`) | ❓ czy Mac Studio wymaga tego nagłówka, sprawdzę tylko na tamtej maszynie — patrz pytania |
| Vercel / Neon | konta osobiste właściciela, pełne uprawnienia | ⚠️ nieuniknione przy jednoosobowej firmie |

## Procedura rotacji — trzy najważniejsze sekrety

Wszystkie trzy da się wymienić **bez przestoju**, ale kolejność ma znaczenie.

**1. Hasło administratora** (~2 min, bez przestoju)
1. Vercel → Settings → Environment Variables → `ADMIN_PASSWORD` → nowa wartość.
2. Redeploy (Vercel robi go sam po zmianie zmiennej).
3. **Wszystkie sesje przeglądarkowe padają natychmiast** — zaloguj się ponownie.
4. **Aplikacja na telefonie działa dalej** (ustalenie 9). Jeśli powodem
   rotacji był wyciek — wejdź w panel → Urządzenia i odbierz tokeny.

**2. Baza danych** (~10 min, krótka przerwa w panelu)
1. Neon → Roles → reset hasła głównej roli. Stary ciąg połączenia przestaje
   działać **od razu** — panel zwraca błędy do kroku 3.
2. Vercel → `DATABASE_URL` → nowa wartość → redeploy.
3. NAS: konto `kopia_ro` jest **osobne** i rotacji nie wymaga. Gdyby wymagało:
   `scripts/kopia-zapasowa/zaloz-konto-ro.sh` jest idempotentny — ponowne
   uruchomienie tylko ustawia nowe hasło (`konto-ro.sql`, gałąź `\if :istnieje`).
4. Sprawdzenie: dowolny ekran panelu **i** ręczne uruchomienie kopii na NAS-ie.

**3. Skrzynka pocztowa** (~5 min, przerwa w pobieraniu poczty)
1. az.pl → zmiana hasła skrzynki.
2. Vercel → `MAIL_PASS` → redeploy.
3. Sprawdzenie: panel → Poczta → „Pobierz teraz". Nieudany zapis zostawia
   ślad w `mail_folders.last_error` i od Audytu 4 jest widoczny.
4. **Uwaga:** hasło skrzynki siedzi też w każdym kliencie pocztowym na
   telefonie i Macu — rotacja bez ich aktualizacji zablokuje konto po
   kilkunastu nieudanych logowaniach.

**Czego nie sprawdziłem:** nie wykonałem żadnej z tych rotacji na żywo — to
wymaga dostępu do paneli Vercela/Neona/az.pl, którego z tej sesji nie mam.
Procedury wynikają z odczytu kodu i skryptów, nie z przećwiczenia. Rotacja
przećwiczona pierwszy raz w kryzysie to rotacja, która się nie uda —
warto przejść punkt 1 (najprostszy) raz na sucho.

---

## Sprawdzone i jest dobrze

To też jest wynik audytu.

- **Porównanie hasła jest odporne na atak czasowy** — `timingSafeEqual`
  z porównaniem długości przed nim (`lib/auth.ts:8-13`).
- **Zero podatności na wstrzyknięcie SQL.** Grep po całym `lib/` i `app/api/`
  za sklejaniem zapytań: jedyne trafienie (`invoices/[id]/issue/route.ts:39`)
  to sklejanie **wartości parametru**, nie treści zapytania. Wszystko idzie
  przez tagowane szablony `neon()`.
- **Wszystkie 26 stron panelu bramkowane po stronie serwera** — nie „ukryte
  w UI", tylko `await isAuthed()` przed renderem.
- **195 z 211 uchwytów API sprawdza sesję**, pozostałe 16 przejrzane
  pojedynczo (tabela w ustaleniu 4).
- **Pięć bramek fail-closed** — `CRON_SECRET`, `BACKUP_PING_SECRET`,
  `CALENDAR_ICS_SECRET`, `TELEFONIA_WEBHOOK_SECRET`, `assertTestOnly` KSeF.
  Brak sekretu **blokuje** trasę, nie otwiera jej po cichu. Sprawdzone
  w kodzie każdej z nich, nie w komentarzu.
- **Tokeny publicznych linków są kryptograficznie mocne** — 122 bity
  z `randomUUID()`, unikalne indeksy w bazie.
- **Ciasteczko sesji: `httpOnly` + `secure` + `sameSite: "lax"`**
  (`lib/auth.ts:33-39`). To ostatnie zamyka w praktyce CSRF: przeglądarki nie
  dołączają ciasteczka `lax` do żądań POST z obcej strony. Panel nie ma
  osobnego tokenu CSRF i **nie potrzebuje go**.
- **Tokeny urządzeń zrobione porządnie.** W bazie wyłącznie `SHA-256`
  (wyciek bazy nie wycieka tokenów), odbieranie jednym kliknięciem
  (`DevicesPanel.tsx` + `/api/admin/devices`), `last_used_at` aktualizowane
  przy każdym użyciu.
- **Aplikacja iOS: token w Keychain, nigdy w `UserDefaults`**,
  z `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (nie wyjeżdża w kopii
  do innego telefonu). **Hasła administratora apka nie zapisuje nigdzie** —
  wymienia je na token przy pierwszym logowaniu. Adres produkcyjny to
  `https://`, brak jakiegokolwiek wyjątku ATS w projekcie.
- **Wszystkie furtki deweloperskie apki są za `#if DEBUG`** — sprawdzone
  wszystkie (`LEGGERA_DEV_BACKEND`, `LEGGERA_DEV_TOKEN`,
  `LEGGERA_DEV_ZGODA_CICHA`, `…_STALE_BACKGROUND`, `…_REJESTR_FILTR`).
- **Obejście logowania w dev jest potrójnie zabezpieczone** i dodatkowo
  bezużyteczne na produkcji: ciasteczko ma `secure: true`, więc po HTTP
  i tak by nie przeszło.
- **Kopie zapasowe: konto tylko-do-odczytu, AES-256 z PBKDF2 (200 tys.
  iteracji), `chmod 600` ustawiane jawnie** (bo na NAS-ie `umask` bywa
  nadpisywany przez listy dostępu udziału — złapane pomiarem 2026-07-20).
- **Publiczna lista referencji nie wydaje niczego bez zgody** —
  `WHERE review_consent_case_study = true`, warunek jest w zapytaniu, nie
  w kodzie po nim.

---

## Jak to zweryfikowano (nie „skompilowało się")

1. **Brak hamulca przed naprawą** — 30 żądań pod rząd: 30× 401, zero 429.
   50 równolegle: 0,28 s.
2. **Hamulec logowania po naprawie, na prawdziwym SQL-u** — 8 żądań:
   `401 401 401 401 401 429 429 429`. Odpowiedź niesie `Retry-After: 900`.
3. **Kasowanie licznika po udanym logowaniu** — 4 złe próby → **poprawne
   hasło (200)** → 4 kolejne złe: wszystkie 401. Gdyby licznik nie był
   kasowany, piąta byłaby 429. Uruchomione na osobnej kopii projektu
   z ustawionym `ADMIN_PASSWORD`.
4. **Hamulec formularza — sprawdzony ANONIMOWO.** Pierwsza próba w zwykłym
   dev-serwerze dała 7× 200, bo dev-login uznaje wszystko za zalogowane
   (co samo w sobie potwierdziło wyjątek dla właściciela). Dopiero osobna
   kopia projektu z **wyłączonym** `DEV_ADMIN_BYPASS` pokazała prawdę:
   `200 200 200 200 200 429 429`, `retry-after: 3600`. Kopia usunięta
   i sprawdzona po zakończeniu.
5. **Alarm dojechał do właściciela, nie tylko do bazy** — po wywołaniu
   dziennego raportu w treści maila pojawiło się:
   `• [hamulec] Zablokowano po 5 nieudanych próbach (login) w 15 min
   z jednego adresu. (3×)`. Licznik zwijania powtórek też się tym potwierdził.
   **W komunikacie nie ma adresu IP ani żadnej innej danej osobowej** —
   sprawdzone na wydruku maila, nie w założeniu.
6. **Przegląd tras liczony per uchwyt HTTP**, nie per plik — skryptem
   dzielącym każdy `route.ts` na uchwyty. To on wykrył ustalenie 3.
7. `npx tsc --noEmit` — czysto. (Zgodnie z zasadą projektu: to nie jest dowód,
   tylko warunek konieczny. Dowodem są punkty 2–5.)

---

## Pytania do właściciela (nie rozstrzygam sam)

1. **Adres e-mail konta Vercel.** Zakres audytu nazywa go „do wymiany" —
   dziś to pośrednik Apple, który nie przyjmuje poczty od innych nadawców.
   Tym kanałem przyjdzie ostrzeżenie o przejęciu konta i o problemie
   z płatnością. To zmiana do zrobienia **w panelu Vercela, ręcznie** —
   ja nie mam tam dostępu. Zostaje w `PO_REJESTRACJI.md` pkt 13.
2. **Typ klucza Resend.** Resend pozwala wydać klucz „tylko wysyłka" albo
   pełny (czytanie logów, zarządzanie domenami). Sprawdź w panelu Resend →
   API Keys, jakie uprawnienia ma obecny; jeśli pełny — wydaj nowy,
   ograniczony do wysyłki, i podmień w Vercelu.
3. **Ollama na Macu Studio.** Panel wysyła nagłówek `Authorization` tylko
   wtedy, gdy `OLLAMA_API_SECRET` jest ustawiony. Czy Tailscale Funnel po
   stronie Maca **wymaga** tego nagłówka? Jeśli nie, każdy, kto zna adres
   funnela, ma darmowy dostęp do Twojego modelu. Tego nie sprawdzę stąd.

## Co zostaje otwarte (z decyzjami z tej sesji)

- **Białe listy pól w czterech trasach `*/public/[token]`** (ustalenia 5 i 6) —
  do zrobienia, wąskie i mechaniczne. Nie robiłem tego w tej sesji, żeby nie
  mieszać naprawy hamulca z przebudową odpowiedzi publicznych.
- **Unieważnianie linków** — brief `docs/plany-modulow/40-uniewaznianie-linkow.md`.
- **Drugi składnik logowania (TOTP)** — właściciel wybrał „chcę 2FA".
  Brief `docs/plany-modulow/41-drugi-skladnik-totp.md`. To osobny moduł,
  świadomie nie mieści się w audycie.
- **Rotacja nigdy nie była ćwiczona** — procedury spisane, nieprzetestowane.

## Czego ten audyt NIE obejmował

Zgodnie z zasadą „jeden audyt = jeden czat":

- **Audyt 3 (niezawodność i powrót po awarii)** — następny w kolejce.
- **Audyt 2 (RODO)** — ustalenia 5 i 6 dokładają mu materiału: publiczne
  trasy wydają dziś dane osobowe (IP podpisującego), a nowa tabela
  `rate_limit_hits` świadomie trzyma odciski zamiast adresów.
- **Bezpieczeństwo samej strony publicznej** (nagłówki CSP, HSTS) — nie było
  w zakresie Audytu 1, który pyta o dostęp do danych.
