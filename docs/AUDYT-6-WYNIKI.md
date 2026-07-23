# Audyt 6 — poprawność kodu i dług techniczny: wyniki (2026-07-23)

Piąty z siedmiu audytów końcowych (kolejność wg ryzyka: 4 → 1 → 3 → 2 → **6** →
5 → 7). Zakres: `docs/AUDYTY-KONCOWE.md` → „Audyt 6", brief wykonawczy:
`docs/plany-modulow/44-audyt-6-kod.md`.
Poprzednie: `docs/AUDYT-4/1/3/2-WYNIKI.md`.

**Pytanie audytu:** czy to, co jest, **działa i da się utrzymać przez lata bez
regresji** — nie „czego brakuje".

Każde ustalenie jest poparte **odczytem kodu albo uruchomieniem** (testy,
`node --test`, grep po użyciu, porównanie arytmetyki panel↔apka linia po linii).
Gdzie czegoś nie sprawdziłem — napisane wprost. `tsc` przeszło czysto, ale
**to nie jest dowód** (nie sprawdza logiki ani SQL-a) — dowodem są testy, które
**czerwienią się na rozjeździe** (patrz „Jak to zweryfikowano").

**Stan zastany zweryfikowany gretem 2026-07-23** (liczby z briefu potwierdzone):
390 plików `.ts/.tsx`, 155 tras / 217 uchwytów HTTP, **0 plików Swift** (apka to
osobne repo `leggera-hub-ios`, 102 pliki `.swift` — otwarte do parytetu na
prośbę właściciela), `lib/db.ts` = 2597 linii.

> **Decyzje właściciela podjęte PRZED pracą** (brief, pkt „Co rozstrzygnąć"):
> 1. **Testy — TAK**, wyłącznie dla czystych reguł biznesowych.
> 2. **Parytet — sięgamy do kodu apki** (repo wskazane: `leggera-hub-ios`).
> 3. **`lib/db.ts` — ZOSTAJE** (nie dzielić bez konkretnego bólu).

---

## Ustalenia — kolejność wg ryzyka

### 1. Reguła „wymaga działania dziś" liczyła dni INACZEJ niż apka ✅ NAPRAWIONE

**Najważniejsze znalezisko parytetu — i dokładnie ta klasa, przed którą
ostrzega pamięć projektu (`format-czasu-rozjazd`: „porównuj arytmetykę, nie
nazwę").** Znaleziona przez porównanie kodu obu stron, nie z komentarza.

`isOverdue()` (`lib/leads.ts`) to **jedyne źródło** listy „wymaga działania"
na Pulpicie, w dziennym mailu i we wszystkich widokach leadów. Jej punkt 5
(„cisza po wysłanej wiadomości ≥ 4 dni") liczył dni przez `daysSince()`:

```
new Date("2026-07-19")  // kolumna DATE → PÓŁNOC UTC
Math.floor((new Date() /* LOKALNE teraz */ - powyższe) / 24h)
```

Apka (`LeadRules.wymagaDzialania` → `dniOd`, `LeadRules.swift`) liczy **dni
KALENDARZOWE** (`Calendar.dateComponents([.day])`). To nie to samo:

- panel mieszał **północ UTC** (z parsowania daty) z **lokalnym „teraz"** i
  floorował godziny. Latem (Warszawa +2 h) między **00:00 a 02:00** lokalnego
  czasu wynik wychodził **o 1 za mały**;
- skutek: lead sprzed dokładnie 4 dni kalendarzowych stawał się „przeterminowany"
  w panelu dopiero o **~02:00**, a w apce już o **00:00**. Przez te ~2 h **panel
  i telefon mówiły o tym samym leadzie dwie różne rzeczy** — dokładnie to, przed
  czym ostrzega komentarz w `LeadRules.swift` („dwa front-endy powiedzą
  właścicielowi dwie różne rzeczy").

Apka liczyła **poprawnie** (kalendarzowo) i **nie wymaga zmiany** — to panel
odstawał. Co gorsza, panel odstawał też **od samego siebie**: `lib/dates.ts` ma
kanoniczny `daysBetweenISO()` (dni kalendarzowe), ale `isOverdue` go nie używał.

**Naprawa (2026-07-23):** `daysSince()` w `lib/leads.ts` liczy teraz dni
kalendarzowo przez `daysBetweenISO(dateStr.slice(0,10), todayLocalISO())` —
zrównane z apką **i** z kanonicznym helperem panelu. Ta sama funkcja zasila
kolumnę „DNI" w tabeli/Kanbanie, więc **wyświetlanie i decyzja o
przeterminowaniu przestały móc się rozjechać** o 1. Bliźniaczy `daysSince` w
`lib/clients.ts` (`clientDaysSince`, tylko wyświetlanie) naprawiony tak samo dla
spójności. Zapięte testem `daysBetweenISO` (patrz niżej), który **czerwieni się
na dokładnie tym „−1"**.

### 2. Zero testów automatycznych → pierwsze testy reguł biznesowych ✅ WDROŻONE

**Największa systemowa słabość projektu:** cała weryfikacja była ręczna i
**nie chroniła przed regresją**. Wdrożono — zgodnie z decyzją właściciela —
**wyłącznie testy czystych reguł** dublujących się z apką (bez UI, bez bazy):

| Plik testu | Reguła | Bliźniak w apce |
|---|---|---|
| `parseQuickAdd.test.ts` | rozbiór „jutro 14:00 call" (10 przypadków) | `Kalendarz.rozbierz` |
| `telefon.test.ts` | `waLink` / `lastPhoneDigits` (progi 8/9/10–15, prefiks 48) | `Kontakty.whatsApp` |
| `snooze.test.ts` | `snoozeOptions`/`sendLaterOptions` (progi 16:00/17:00, godziny) | `Snooze.opcje`/`WysylkaPozniej.opcje` |
| `daty.test.ts` | `daysBetweenISO` (dni kalendarzowe = reguła z ust. 1), `warsawNowMinutes`, `warsawWallTimeToUtcISO`, `daysSinceISO` | `LeadRules.dniOd`, `Daty` |
| `kopie.test.ts` | `ocenKopie` (kolejność warunków, próg 36 h) | — (reguła nadzoru, Audyt 3/4) |

**Druga paczka (na prośbę właściciela, ta sama sesja)** — priorytet: reguły
pinujące **realnie naprawione błędy** (test złapałby ich powrót):

| Plik testu | Reguła | Znany błąd, który pinuje |
|---|---|---|
| `oczyscTekst.test.ts` | czyszczenie danych osobowych z logów | wzorzec telefonu **zjadał IBAN** (2026-07-22) |
| `recurrence.test.ts` | `wystapienieNr` (rozwijanie serii) | dryf „co miesiąc od 31." → w lipcu 28 zamiast 31 |
| `faktury.test.ts` | matematyka faktury (netto/VAT/brutto/rabat, brutto↔netto) | pieniądze — zaokrąglenia do grosza |
| `totp.test.ts` | silnik 2FA na **wektorach RFC 6238** | zamraża silnik strzegący logowania |
| `walidacja.test.ts` | `isPlausibleDateString` (rok „0202") | bliźniak Swift `czyDataSensowna` |

**Runner:** wbudowany `node --test` + **`tsx`** — **jedyna nowa zależność w tym
audycie** (dev-only; rozwiązuje importy `.ts` bez rozszerzeń, których surowy
Node nie zjada). `npm test` → **55 testów, 55 zielonych**. To pierwsza zależność
testowa i świadoma zmiana filozofii („cała weryfikacja ręczna") — zatwierdzona
przez właściciela przed pisaniem.

**Reguła, którą sobie narzuciłem (brief):** test jest wart tyle, ile rozjazd,
który złapie. Każdy pinuje arytmetykę (progi, kolejność, znak), nie samo „nie
rzuca". Udowodnione, że **biją** — patrz „Jak to zweryfikowano".

### 3. Zależności: 6 CVE Next.js + sharp flagowane „high", realna ekspozycja NISKA ⚠️ USTALENIE + decyzja odłożona

`npm audit`: **2 podatności high** — łańcuch **6 CVE Next.js** (SSRF w
rewrites, DoS Image Optimization przez SVG, cache confusion, ujawnienie
endpointów Server Functions, nieograniczony payload Server Action w Edge) oraz
**sharp** (`<0.35.0`, dziedziczone z Next).

**Pułapka, którą wychwycił dopiero `npm audit --json`:** jedyna „naprawa", jaką
proponuje npm, to `next@14.2.35` z flagą `isSemVerMajor: true` — czyli
**DOWNGRADE majora** z 16 do 14 (utrata App Routera Next 16 / React 19, na
których stoi cały projekt). Powód: zakres podatny to `14.3.0-canary.0 –
16.3.0-preview.7`, więc obejmuje **całą linię 16.x aż po najnowsze opublikowane
16.2.11**. **Nie istnieje jeszcze załatane wydanie Next 16.**

**Realna ekspozycja jest jednak niska — sprawdzone gretem po użyciu**, nie
z opisu CVE:

| CVE dotyczy | Czy apka używa? | Ekspozycja |
|---|---|---|
| SSRF w `rewrites` | brak `rewrites`/`redirects` (`next.config.mjs`, `proxy.ts` = tylko przekierowanie językowe) | **nie** |
| DoS Image Optimization (SVG) | **0** plików używa `next/image`; brak `remotePatterns`/`dangerouslyAllowSVG` | **nie** |
| CVE runtime Edge | trasy jawnie `export const runtime = "nodejs"` | **nie** |
| Ujawnienie Server Functions / payload Server Action | brak `"use server"` w repo (panel jedzie na trasach API bramkowanych `isAuthed`, Audyt 1) | **nie** |

Zostaje teoretyczny „cache confusion of response bodies" na trasach z ciałem —
ale trasy API są bramkowane i chodzą na `nodejs`. **Praktyczne ryzyko: znikome.**

**Co zrobiono:** `npm audit fix` (bez `--force`) podbił Next **16.2.9 → 16.2.11**
(najnowszy patch 16.x, w obrębie zadeklarowanego `^16.2.9` — `package.json`
niezmieniony). **To NIE domyka CVE** (16.2.11 wciąż w zakresie podatnym) — jest
tylko właściwym miejscem do siedzenia do czasu łatki. **Świadomie NIE robiono
`--force`** — to major/downgrade, dokładnie ten „osobny, większy ruch", przed
którym ostrzega brief.

**Decyzja dla właściciela (nietechniczna):** czekamy na załatane wydanie Next 16
i podbijamy patchem, czy planujemy większą aktualizację Next przy rejestracji
(razem z przejściem na Vercel Pro)? Rekomendacja: **czekać na łatkę 16.x, nie
schodzić do 14** — ekspozycja jest niska, a downgrade zabrałby fundament
projektu. Dopisane do „Co zostaje otwarte".

**Reszta zależności — w normie.** `npm outdated`: same patche w obrębie zakresów
(framer-motion, react, postcss, autoprefixer, imapflow, @tabler). Majory
świadomie odłożone jako osobny ruch: **Tailwind 3→4, TypeScript 5→7,
@types/node 20→26** — żaden nie jest „drobną łatką".

### 4. Martwy kod: 9 potwierdzonych martwych eksportów `lib/` ⚠️ UDOKUMENTOWANE, nie usunięte

Brief podejrzewał, że udokumentowanych 4 przypadków „pole jest, nikt go nie
woła" to nie wszystko. **Metoda: grep po UŻYCIU, nie po definicji** — symbole
eksportowane z `lib/`, występujące w całym repo (app+lib) **dokładnie raz**
(sama definicja, zero wołaczy, re-eksportów i wzmianek):

| Symbol | Plik | Rodzaj |
|---|---|---|
| `ClientFollowup` | `lib/clients.ts:185` | typ |
| `CONTRACT_TYPY` | `lib/contracts.ts:22` | stała |
| `isContractPending` | `lib/contracts.ts:242` | funkcja |
| `ATTENDEE_STATUSES` | `lib/eventInvites.ts:22` | stała |
| `isPast` | `lib/events.ts:79` | funkcja |
| `nastepneWystapienie` | `lib/recurrence.ts:105` | funkcja |
| `DOMYSLNY_PROMIEN_M` | `lib/reminders.ts:160` | stała (promień geofence) |
| `SHARE_LINK_LABEL` | `lib/shareLinks.ts:34` | mapa etykiet |
| `kodTeraz` | `lib/totp.ts:114` | funkcja (silnik TOTP) |

**Świadomie NIE usunięte — po przeglądzie każdego z osobna okazało się, że
część to realne rusztowanie, nie śmieci** (weryfikacja hipotezy właściciela
„to przygotowane wcześniej moduły"):

- **Rusztowanie pod przygotowany, niepodłączony moduł:** `DOMYSLNY_PROMIEN_M`
  (w bazie **cały model geofence** przypomnień — `lokalizacja_lat/lon/promien`
  + `maGeofence()`; brakuje tylko ekranu), `nastepneWystapienie`,
  `ATTENDEE_STATUSES`, `SHARE_LINK_LABEL` (helper/katalog żywych funkcji).
- **Typ dokumentujący w pełni żywą funkcję, nikt go nie importuje:**
  `ClientFollowup` (sama funkcja „zaplanowanych kontaktów" **działa** — cron,
  trasy `client-followups/*/draft|send`), `CONTRACT_TYPY`.
- **Drobne, prawdopodobnie przypadkowe resztki:** `isPast`, `isContractPending`,
  `kodTeraz` (wrapper silnika 2FA).

**Rekomendacja: nie usuwać.** Są inertne, a kilka to realne rusztowanie —
kasowanie takich rzeczy to sposób, w jaki traci się przygotowany moduł, jak
`list_unsubscribe_url`, który był „martwy", a dziś ma 23 użycia (ust. 5). Koszt
trzymania ≈ zero. Lista jest produktem tego ustalenia; ewentualne wycięcie trzech
„resztek" — jedną paczką na słowo właściciela.

### 5. Jeden z 4 „martwych" przypadków OŻYŁ: `list_unsubscribe_url` ✅ USTALENIE

Brief wymieniał `list_unsubscribe_url` jako martwe pole. **Dziś ma 23 użycia** —
powstał ekran `SubscriptionsView.tsx` + trasa `GET /api/mail/subscriptions`,
a `MailDetailPanel` renderuje link (komentarz w kodzie: „brakowało tylko
ekranu"). To potwierdza metodę audytu (**weryfikuj gretem, nie ufaj liście**)
i wzorzec z ust. 4: w tym projekcie martwe pola bywają podłączane, nie usuwane.

### 6. `lib/db.ts` (2597 linii) — ZOSTAJE ✅ WERDYKT

Sprawdzone, czy długość realnie utrudnia pracę: plik to w **95 % schemat** —
**57 `CREATE TABLE`, 172 `ALTER TABLE`, 24 pary `create*/ensure*Schema`** z
bramką migracji, każdy blok izolowany (~20–260 linii). Długość wynika ze
**świadomego wzorca** (jedno miejsce idempotentnych migracji z bramką), nie z
plątaniny logiki. Nawigacja = skok do `ensureXSchema`. Podział rozbiłby
niezmiennik „jedno miejsce migracji", dołożył import churn i **nie rozwiązałby
żadnego realnego bólu**. **Nie dzielić** — zgodnie z decyzją właściciela i
domyślną rekomendacją briefu.

### 7. Parytet panel↔apka — reszta sprawdzona ARYTMETYCZNIE i zgodna ✅

Poza ust. 1 porównałem kod obu stron linia po linii (nie z komentarza):

- **Telefon** — `waLink`/`lastPhoneDigits` (`lib/contact.ts`) vs `Kontakty.whatsApp`
  (Swift): identyczne progi (`+`/`00` → 8–15 cyfr; goły 9 → prefiks 48; 10–15
  bez prefiksu jak jest), identyczne ścinanie wiodących zer. **Zgodne.**
- **Snooze i wysyłka odłożona** — `snoozeOptions`/`sendLaterOptions` (`lib/mail.ts`)
  vs `Snooze.opcje`/`WysylkaPozniej.opcje`: identyczne progi (16:00 / 17:00),
  godziny (18/8/9/17), reguła „weekend tylko pon–czw" i „najbliższy poniedziałek
  ściśle po dziś" (`(1 - weekday + 7) % 7 || 7`). **Zgodne.** (Apka liczy strefę
  `Calendar`-em, panel `Intl` + offset — dają ten sam UTC dla stałych godzin
  snooze; nie trafiają w noc zmiany czasu.)
- **`parseQuickAdd`** vs `Kalendarz.rozbierz`: port 1:1 z jawnymi komentarzami o
  pułapce granicy słowa (`\b` ASCII vs unikod w Swifcie). Kolejność wzorców,
  „pojutrze przed jutro", same-name-dnia → +7, przeskok roku DD.MM, guard „w
  <słowo>" — wszystko pokrywa się i **pinowane testami**.

**Znane rozjazdy z pamięci** (`format-czasu-rozjazd` = format stopera,
`slownik-koloru-audyt`, Live Activity setne sekund) dotyczą **wnętrza apki**
(stoper, kolory, sufit platformy), nie tych czystych reguł — nie były przedmiotem
tego audytu i nie odkrywam ich drugi raz. Nowy rozjazd (ust. 1) jest **innej
klasy** (liczenie dni) i został domknięty po stronie panelu.

### 8. Znane, świadomie odłożone niespójności — NIE naprawiać ⚠️ DO WIEDZY

Za briefem (pkt 6) i `CLAUDE.md` — wypisane jako **znane i odłożone**, nie jako
błędy:

- **Emoji ⏰ w Poczcie** — 4 miejsca (`MailDetailPanel.tsx`, `MailDashboard.tsx`:
  „Odłóż" / „Uśpiona do…"). Wyjątek od reguły Moduł 33 (ikony Tablera w panelu).
- **Znaki typograficzne** — `✕` (20×), `★` (5×), `●` (1×) obok ikon Tablera.
  Dziedziczą kolor i nie mają problemu emoji (różny render per system). Osobna,
  wciąż otwarta niespójność — nie ten audyt.

### 9. `snoozeOptions` jest tylko CZĘŚCIOWO wstrzykiwalna ⚠️ DROBIAZG

`snoozeOptions(now)` bierze **minutę** z parametru `now`, ale **dzień** z
realnego zegara (`todayLocalISO()` bez argumentu). W produkcji `now` domyśla się
`new Date()`, więc są spójne; problem tylko gdyby ktoś podał `now` z innego dnia
niż realny. Bez wpływu na działanie — zapisane, bo utrudniło pełne zapięcie
testem (testy pinują to, co deterministyczne: progi + `tomorrow_morning`/
`next_week`). Nie ruszam — działa.

---

## Sprawdzone i jest dobrze

To też jest wynik audytu.

- **Apka liczy reguły dat POPRAWNIE** — to panel odstawał (ust. 1). Parytet
  telefonu, snooze i `parseQuickAdd` — zgodny co do arytmetyki.
- **`lib/db.ts` to zdrowy, regularny schemat**, nie dług — długość jest
  konsekwencją wzorca, nie zaniedbania (ust. 6).
- **Zero podatności SQL injection** — potwierdzone w Audycie 1 (wszystko przez
  tagowane szablony `neon()`); nie dublowane tutaj.
- **Ekspozycja na CVE Next.js jest niska** — apka nie używa `next/image`,
  rewrites, Edge ani Server Actions (ust. 3), czyli powierzchni, które te CVE
  atakują.
- **Martwy kod jest nieliczny i drobny** — 9 małych eksportów, nic wielkiego;
  a metoda „grep po użyciu" wychwyciła też, że jeden dawny przypadek już OŻYŁ.
- **Testy realnie biją na regresji** — nie tylko przechodzą (dowód niżej).

---

## Jak to zweryfikowano (nie „skompilowało się")

`tsc --noEmit` — czysto (warunek konieczny, nie dowód). Dowód:

1. **`npm test` → 32/32 zielone** na prawdziwych funkcjach `lib/` (tsx +
   `node --test`), importujących realny kod, nie atrapy.
2. **Red-first #1 (próg):** próg snooze `16 → 15` w `lib/mail.ts` → test
   „znika DOKŁADNIE o 16:00" **czerwieni się** (1 fail). Przywrócono → zielono.
3. **Red-first #2 (rozjazd z ust. 1):** `daysBetweenISO` zaniżone o 1 (tak jak
   floor tuż po północy) → **3 testy `daty` czerwienią się**, w tym „to
   KALENDARZ, nie floor z godzin (sedno rozjazdu z apką)". Przywrócono → zielono.
   To dowód, że test złapałby powrót do starego, wadliwego liczenia dni.
4. **Parytet liczony arytmetyką, nie nazwą** — wartości referencyjne
   (`parseQuickAdd`, snooze, `ocenKopie`, daty) wygenerowane uruchomieniem i
   dopiero potem zapisane jako oczekiwania testów; kod Swift przeczytany i
   porównany operacja po operacji (progi, prefiks, floor/round, strefa).
5. **Martwy kod potwierdzony po UŻYCIU** — skryptem liczącym wystąpienia każdego
   eksportu `lib/` w całym repo; do listy weszły tylko te z wynikiem **1**
   (sama definicja), każdy przejrzany pojedynczo z pełnym kontekstem.
6. **Ekspozycja CVE — gretem po użyciu** (`next/image`, `rewrites`, `runtime
   edge`, `"use server"`), nie z opisu podatności.

---

## Co zmieniono w kodzie

Minimalnie, zgodnie z „nie buduj nic na zapas / nie przepisuj działającego":

- **`lib/leads.ts`** — `daysSince()` liczy dni kalendarzowo (`daysBetweenISO`),
  zrównane z apką i z kanonicznym helperem panelu (ust. 1). Poprawka reguły
  „wymaga działania dziś".
- **`lib/clients.ts`** — bliźniaczy `daysSince` (`clientDaysSince`) tak samo,
  dla spójności wyświetlania.
- **`test/`** (nowy katalog) — **10 plików** testów czystych reguł (55 testów)
  + `README.md`.
- **`package.json`** — skrypt `"test"`, **`tsx`** w `devDependencies` (jedyna
  nowa zależność).
- **`tsconfig.json`** — `test/` w `exclude` (testy waliduje uruchomienie przez
  tsx, nie `next build`).
- **`package-lock.json`** — `npm audit fix` (bez `--force`): Next 16.2.9 →
  16.2.11 (patch w obrębie zakresu) + drzewo `tsx`. **Bez zmian zakresów w
  `package.json`.**
- **`.github/`** (nowy) — automaty monitorujące na prośbę właściciela (patrz
  „Monitorowanie na przyszłość").

Bez nowego schematu bazy → **bramka migracji niepotrzebna**. Zmiany serwerowe,
`useUI()` nie dotyczy. Zmiana `daysSince` jest logiką dat — dowodzą jej testy,
nie podgląd w przeglądarce (nie uruchamiałem dev-serwera; arytmetyka jest
zapięta mocniej niż zrzutem ekranu).

## Monitorowanie na przyszłość (ustawione w tej sesji)

Odpowiedź na pytanie właściciela „jak to pilnować, gdy aplikacja rośnie, i czy
da się to zautomatyzować". Ułożone **warstwami**, od zera-wysiłku do rzadkich
głębokich audytów. Wszystko darmowe, żyje w repo, bez nowych usług:

- **`.github/dependabot.yml`** — GitHub sam pilnuje zależności i otwiera PR przy
  **łatce bezpieczeństwa** (np. załatany Next 16, gdy wyjdzie). Zero utrzymania.
- **`.github/workflows/testy.yml`** — `npm test` przy **każdym pushu i PR**;
  zepsuta reguła = czerwień + mail **przed** produkcją.
- **`.github/workflows/przeglad-miesieczny.yml`** — **raz w miesiącu** (i na
  żądanie): `npm audit` + `npm outdated` + `npm test`, meldunek w podsumowaniu
  przebiegu; przy podatności **high** lub padłym teście → czerwień + mail.
  **Świadomie akcją GitHuba, nie osobnym agentem w chmurze** — pewniejsze i bez
  ruchomej części do pilnowania (agent mógłby po cichu przestać działać, a tego
  nie zauważysz — klasyczna pułapka z Audytu 1/3).

**Kadencja głębokich audytów (te 7)** — nie na sztywnym zegarze, tylko przy
kamieniach milowych: **przed pierwszym klientem** (teraz), **przy każdej nowej
platformie** (macOS/iPadOS → audyt parytetu, patrz niżej), potem raz na jakiś
czas lub gdy dzieje się coś dużego. Każdy w osobnym czacie.

**Przy macOS / iPadOS — parytet trzeba sprawdzić ponownie, ale będzie mały,
JEŚLI nowe apki użyją wspólnego rdzenia `LeggeraHubCore`.** Każdy front-end to
kolejna kopia tych samych reguł; dziś są 2 (web `lib/` + Apple `LeggeraHubCore`).
Dopóki macOS/iPadOS sięgają do tego samego rdzenia Swift (a nie kopiują reguły
„na oko"), kopie nadal są 2, nie 4 — i pilnują ich te testy + krótki audyt
parytetu przy starcie nowej platformy. **Zasada: jedno miejsce na regułę per
platforma.**

## Co zostaje otwarte

- **CVE Next.js — czekają na załatane wydanie Next 16** (ust. 3). Nie ma go dziś;
  jedyna „naprawa" npm to downgrade do 14 (odrzucone). Ekspozycja niska.
  **Decyzja właściciela:** patch, gdy łatka wyjdzie, czy większa aktualizacja
  Next przy rejestracji/Vercel Pro. → dopisać do `PO_REJESTRACJI.md` przy
  planowaniu przejścia na Pro, jeśli łatka nie wyjdzie wcześniej.
- **9 martwych eksportów** (ust. 4) — udokumentowane, nieusunięte. Usunięcie
  jedną paczką możliwe na słowo właściciela; część może być rusztowaniem.
- **Majory zależności** (Tailwind 4, TypeScript 7, @types/node 26) — osobny,
  większy ruch, poza tym audytem.
- **Testy pokrywają tylko reguły dublowane z apką** — świadomie. Nie ma i
  celowo nie budujemy testów UI/tras/migracji (ręczne oglądanie zrzutów
  skuteczniejsze).

## Czego ten audyt NIE obejmował

Zgodnie z „jeden audyt = jeden czat":

- **Audyt 5 (wydajność i koszty)** — **następny w kolejce.** Podejrzani z
  briefu 5: liczba zapytań na zimny start (bramka migracji — czy nie odrosło),
  czas synchronizacji IMAP/załączników, rozmiar bazy wobec progów Neona,
  miesięczny rachunek.
- **Audyt 7 (produkt)** — nietknięty.
- **Wnętrze apki iOS** poza czystymi regułami z parytetu (stoper, kolory, Live
  Activity) — to zakres audytu apki, nie ten.
- **Pełny `next build`** — failuje w sandboxie (EPERM); Next 16.2.11 zbuduje się
  dopiero na Vercelu po pushu. Patch w obrębie zakresu, ryzyko niskie.
