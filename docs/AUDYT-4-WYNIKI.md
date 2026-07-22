# Audyt 4 — obserwowalność: wyniki (2026-07-22)

Pierwszy z siedmiu audytów końcowych. Zakres: `docs/AUDYTY-KONCOWE.md`,
brief wykonawczy: `docs/plany-modulow/39-audyt-obserwowalnosc.md`.

Każde ustalenie poniżej jest poparte odczytem kodu albo uruchomieniem.
Tam, gdzie czegoś **nie** sprawdziłem, jest to napisane wprost.

---

## Inwentarz 95 miejsc z `console.error`

Podział wg tego, co kod **robi** z błędem — nie wg treści komunikatu.

| Kubełek | Ile | Co się dzieje | Alarm? |
|---|---|---|---|
| **A.** Trasa zwraca 500 z powodem | **41** | `catch` → 500 + komunikat → toast u właściciela | **Nie.** Już widoczne od razu; brakowało wyłącznie historii |
| **B.** Ciche połknięcie w tle | **~25** | loguje i jedzie dalej, nic nie wypływa | **Tak — to był cały dług** |
| **C.** Sytuacja przewidziana | **~14** | brak Ollamy w env, VIES nie odpowiada, obrazek podpisu | Nie |
| **D.** Szum, naprawi się sam | **~15** | backfille kategorii/wątków/DW, `discoverMailFolders` | Nie |

**Wniosek: na alarm zasługuje ~25 z 95.** Podział A/C/D wynika z odczytu
kodu; granica B↔D jest miejscami oceną, nie pomiarem — zaznaczam to uczciwie.

Rozkład: 94 z 95 to serwer (trafiają do logów Vercela, retencja liczona
w godzinach), 1 to przeglądarka (`MailComposeForm.tsx`).

---

## Ustalenia — kolejność wg ryzyka

### 1. Strażnik nie miał strażnika ✅ NAPRAWIONE

`app/api/leads/notify/route.ts` — `catch` dziennego crona **nie logował
niczego** i zwracał samo 500. A `sendEmail()` rzuca wyjątkiem przy błędzie
Resend (`lib/email.ts:46`), więc padnięta wysyłka kończyła przebieg po cichu.

Dzienny raport jest jedynym kanałem, którym docierają ostrzeżenia o kopiach
zapasowych — jego cicha śmierć **wyciszała również tamten alarm**.

Naprawa: każdy przebieg zostawia ślad w `automation_runs`, więc brak meldunku
jest sam w sobie wykrywalny — nawet gdy cron w ogóle nie wystartował i nie
miał jak zgłosić błędu.

### 2. Nic nie pilnowało ciszy automatów ✅ NAPRAWIONE

Jedyną tabelą-biciem-serca było `backup_runs`. Kopie miały wykrywanie ciszy
(`BACKUP_STALE_HOURS = 36`), automaty nie miały nic.

Naprawa: rejestr `AUTOMATY` + `automation_runs`. Cztery nadzorowane:
dzienny raport, pobieranie poczty, kolejka wysyłki, faktury cykliczne.

**Alarm wychodzi też z `/api/backup/ping`** — ze skryptu na NAS-ie, spoza
Vercela. To jedyna droga działająca, gdy padnie cron.

### 3. `mail_folders.last_error` — zapisywane, nigdy nieczytane ✅ NAPRAWIONE

`lib/mailSync.ts:434` zapisywało powód nieudanego pobrania folderu od
Modułu 4. Grep po całym repo i po apce: **wyłącznie ten zapis i CREATE
TABLE**. Zero czytelników.

Skutek: folder inny niż INBOX mógł nie synchronizować się miesiącami,
a powód leżał w bazie, nie pokazywany nigdzie. **Piąty udokumentowany raz
w tym projekcie, gdy pole istnieje i nikt go nie woła.**

### 4. Awaria interfejsu jest niewidoczna w 100% ✅ NAPRAWIONE

Stan zastany: w całym `app/` **nie było** ani `error.tsx`, ani
`global-error.tsx`, ani `instrumentation.ts` (sprawdzone `find` po całym
drzewie). Wysypka renderowania w panelu = domyślny ekran błędu Next
i zero śladu gdziekolwiek.

Naprawa (2026-07-22, na prośbę właściciela w tej samej sesji):
`instrumentation.ts` (`onRequestError` — łapie każdy nieobsłużony błąd
serwera), `app/[lang]/admin/error.tsx` (granica panelu z przyciskiem wyjścia),
`app/global-error.tsx` (wysypka layoutu głównego) oraz
`POST /api/errors/client`.

**Trasa wymaga zalogowania — świadomie.** Otwarty endpoint dopisujący wiersze
do bazy byłby zaproszeniem do zaśmiecania logu, a sekretu nie da się ukryć
w kodzie przeglądarki. Konsekwencja wprost: **łapiemy wysypki panelu, nie
strony publicznej.**

Pułapka złapana zrzutem ekranu, nie przewidziana: `error.tsx` musi mieć klasę
`admin-linear`. Ciemną paletę nakłada `AppShell.tsx`, który przy wysypce
w ogóle się nie renderuje — bez tej klasy panel jednomotywowy-ciemny
pokazywał jasny ekran błędu.

### 5. Plan Hobby: limit cronów wyczerpany ⚠️ DO WIEDZY

`vercel.json` ma 2 crony, plan Hobby daje 2. Dlatego nadzór **nie** dostał
własnego crona, tylko doczepił się do istniejącego przebiegu i do pingu
z NAS-a. Po przejściu na Pro (patrz `PO_REJESTRACJI.md`) można rozważyć
osobny, częstszy nadzór.

### 6. `error_log` nie może być tabelą tylko do zapisu ✅ ZAMKNIĘTE

Samokontrola: zbieranie błędów, których nikt nigdy nie ogląda, powtarzałoby
dokładnie ten antywzorzec, który ten audyt wytknął w ustaleniu 3. Dlatego
dzienny raport ma sekcję „Ostatnie błędy zapisane przez panel" — pięć
najświeższych, tylko `waga='blad'`, z licznikiem powtórek.

### 7. Reguła „co trafia do logu" ✅ USTALONA

`oczyscTekst()` w `lib/observability.ts` usuwa adresy e-mail, NIP-y,
telefony i numery kont **przed** zapisem — log jest zbiorem danych osobowych
(Audyt 2). Zamieniamy na etykietę zamiast wycinać, żeby diagnoza przeżyła.

Do tego: `przebieg_id` (powiązanie zdarzeń jednego przebiegu), `waga`
(rozróżnienie „błąd" od „przewidziane"), `klucz` (zwijanie powtórek).

---

## Sprawdzone i jest dobrze

To też jest wynik audytu.

- **Wzorzec kopii zapasowych jest solidny.** `lib/backup.ts` wykrywa CISZĘ,
  nie tylko zgłoszoną porażkę, a kolejność warunków jest przemyślana
  (nieudany ostatni przebieg bije świeżość). Rozszerzyłem go, nie zastąpiłem.
- **Raport dzienny działa end-to-end** — uruchomiony na żywo, HTTP 200,
  ostrzeżenie o kopiach poprawnie trafia **do tematu** maila.
- **Kolejka wysyłki umie się poskarżyć** — `lib/mailOutbox.ts:98` zapisuje
  `status='failed'` + powód do bazy.
- **Cztery bramki fail-closed** (`CRON_SECRET`, `BACKUP_PING_SECRET`,
  `CALENDAR_ICS_SECRET`, `TELEFONIA_WEBHOOK_SECRET`) — brak sekretu blokuje
  trasę, nie otwiera jej po cichu.
- **Logi nie są wycinane z produkcji** — `next.config.mjs` nie ma
  `removeConsole`.

---

## Jak to zweryfikowano (nie „skompilowało się")

1. **Bicie serca przeżywa przebiegi** — dwa kolejne uruchomienia crona:
   pierwsze „nie odnotowano jeszcze żadnego przebiegu", drugie „przed
   chwilą". Dowód, że zapis i odczyt działają na prawdziwym SQL-u.
2. **Ręczny POST nie zapisuje bicia serca** — potwierdzone w tym samym
   przebiegu (celowa decyzja, patrz HUB_SETUP).
3. **Alarm na prawdziwym Postgresie** — wstrzyknięty przebieg sprzed 48 h
   i jeden nieudany: pierwsze wywołanie wysłało alarm o obu, drugie
   zwróciło 0 (wyciszenie działa).
4. **Progi arytmetycznie** — 35 h → OK, 37 h → „przestarzałe". Granica 36 h
   trzyma. Niepoprawna data → alarmuje (fail-safe), nie milczy.
5. **Cała ścieżka wysypki interfejsu przejechana na żywo** — tymczasowa
   strona rzucająca wyjątkiem: granica błędu złapała, `POST /api/errors/client`
   zwrócił 200, a błąd pojawił się w treści dziennego raportu jako
   `[przeglądarka] /pl/admin/probny-blad: … (2×)` — licznik zwijania powtórek
   też się tym potwierdził. Strona testowa usunięta i sprawdzona gretem.
6. **Pas na Pulpicie obejrzany** — na wstrzykniętym stanie awarii, zrzut
   ekranu; fixture usunięty i zweryfikowany gretem po zakończeniu.
7. **Czyszczenie danych osobowych** — test złapał realny wyciek: numer
   konta zostawał jako `PL611090101400000[telefon]`, bo wzorzec telefonu
   zjadał go pierwszy. Poprawione kolejnością, przetestowane ponownie.

---

## Co zostaje otwarte

- **Wysypki strony publicznej** nie są zbierane (trasa zgłoszeniowa wymaga
  zalogowania — uzasadnienie w ustaleniu 4).
- **Limit cronów planu Hobby** (ustalenie 5) — do rewizji po przejściu na Pro.

## Czego ten audyt NIE obejmował

Zgodnie z zasadą „jeden audyt = jeden czat":

- **Audyt 1 (bezpieczeństwo)** — brak ograniczenia prób logowania na
  `POST /api/admin/login` i przegląd 9 tras publicznych. Oba znaleziska
  spisane w briefie 39, czekają na swój czat. **To następny w kolejce.**
- **Audyt 6 (testy)** — zero testów automatycznych to nadal prawda;
  `package.json` nie ma skryptu `test`. Skrypty weryfikacyjne użyte tutaj
  były jednorazowe i leżą poza repo.
