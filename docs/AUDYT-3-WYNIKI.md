# Audyt 3 — niezawodność, kopie i powrót po awarii: wyniki (2026-07-23)

Trzeci z siedmiu audytów końcowych (kolejność wg ryzyka: 4 → 1 → **3** → 2 →
6 → 5 → 7). Zakres: `docs/AUDYTY-KONCOWE.md` → „Audyt 3", brief wykonawczy:
`docs/plany-modulow/42-audyt-3-niezawodnosc.md`.
Poprzednie: `docs/AUDYT-4-WYNIKI.md`, `docs/AUDYT-1-WYNIKI.md`.

**Pytanie audytu:** co się stanie, gdy padnie każdy pojedynczy element — i czy
umiemy z tego wrócić. Robione **przed pierwszym klientem**, bo od tej chwili
awaria to nie „mój panel nie działa", tylko „cudze dane są niedostępne".

Każde ustalenie poniżej jest poparte **uruchomieniem albo gretem po użyciu**,
nigdy pamięcią ani zielonym buildem. Tam, gdzie czegoś nie sprawdziłem (bo
wymaga NAS-a albo produkcyjnej bazy, poza zasięgiem Claude), jest to napisane
wprost i przekazane właścicielowi do wykonania.

---

## Ustalenia — kolejność wg ryzyka

### 1. `odtworz.sh` przy złym haśle mówił „Gotowe" i NIC nie odtwarzał ✅ NAPRAWIONE

**Najpoważniejsze znalezisko audytu — i dokładnie ta klasa błędu, dla której
ten audyt każe kopie URUCHAMIAĆ, a nie czytać.** „Niedziałające odtwarzanie
kopii" było już raz cichym błędem w tym projekcie (`CREATE SCHEMA public`,
2026-07-20). To jest drugi raz, w tym samym pliku.

**Stan zastany, zmierzony w Dockerze (nie przeczytany):** odtworzenie kopii ze
**złym hasłem szyfrującym** do pustej bazy → skrypt wypisał `Gotowe`, zwrócił
**kod wyjścia 0**, a w bazie docelowej było **0 tabel**. `openssl` w tle
krzyczał `bad decrypt`, `gzip` — `not in gzip format`, ale te komunikaty
przewijały się w strumieniu, a skrypt i tak ogłaszał sukces.

Dlaczego: `odtworz.sh` miał `set -eu`, ale **brak `pipefail`**. W potoku
`openssl … | gzip -dc | sed … | psql` bez `pipefail` liczy się kod wyjścia
**ostatniego** polecenia. Gdy openssl pada (złe hasło), do `psql` trafia puste
wejście, a `psql` na pustym wejściu kończy się **sukcesem**. Skutek: zły klucz
= ciche, fałszywe „Gotowe".

Ironia podkreśla wagę: `kopia.sh` (strona ZAPISU) ma `set -euo pipefail`
**z długim komentarzem, dlaczego to warunek poprawności** — a `odtworz.sh`
(strona ODCZYTU, ważniejsza w kryzysie) go nie miała.

**Realny scenariusz, który to trafia:** odtwarzasz kopię pod presją (baza
skasowana), literówka w haśle szyfrującym — i skrypt mówi, że się udało.
Widziałbyś to dopiero, sprawdzając ręcznie liczbę tabel (README na to każe),
ale sam skrypt kłamał.

**Naprawa (2026-07-23):** dodane `set -euo pipefail` **oraz** owinięcie potoku
w `if ! … ; then` z czytelnym komunikatem po polsku. Teraz zły klucz lub
uszkodzony plik → **twardy błąd, kod ≠ 0**, komunikat: „odtworzenie NIE
powiodło się, NIC nie zostało wgrane w komplecie" + wskazanie najczęstszej
przyczyny (złe hasło / uszkodzony plik / niepusta baza docelowa).

Zweryfikowane po naprawie (patrz „Jak to zweryfikowano"): zły klucz → kod 1 +
komunikat + 0 tabel; dobry klucz → dane wracają **co do znaku**, kod 0.

### 2. Kopia poza domem (off-site) — DZIŚ JEJ NIE MA ✅ DECYZJA WŁAŚCICIELA

Wszystkie kopie stoją w jednym miejscu: na NAS-ie w domu. Pożar, kradzież albo
awaria dysku NAS-a zabiera **oryginał i wszystkie kopie naraz**. Pliki są
zaszyfrowane (AES-256), więc off-site nie wystawia danych — problem jest
wyłącznie w „jednym koszyku".

**Decyzja właściciela (2026-07-23):** **drugi dysk trzymany w innym miejscu,
uzupełniany ręcznie.** Bez automatu w chmurze — świadomie, żeby nie mnożyć
rzeczy do pilnowania (zasada z Audytu 4). Off-site jest wtedy tak świeży, jak
ostatnie ręczne skopiowanie — i to jest zaakceptowany kompromis na etapie
przed pierwszym klientem.

Procedura ręczna dopisana do `scripts/kopia-zapasowa/README.md` → „Kopia poza
domem". **Zero nowego kodu** — kopia off-site to skopiowanie już zaszyfrowanego
pliku na drugi nośnik. Automatyczny off-site w chmurze zapisany jako opcja
**do rozważenia po rejestracji firmy** (`PO_REJESTRACJI.md`).

### 3. Prawdziwe odtworzenie z NAS-a nigdy nie było ZMIERZONE ⏳ DO WYKONANIA PRZEZ WŁAŚCICIELA

Kopie były odtworzone raz (2026-07-20, przy budowie), ale **nikt nie zmierzył,
ile realnie trwa powrót** — a to jest kluczowa liczba planu awaryjnego.

Podział pracy jest wymuszony realiami: **Claude nie ma dostępu do NAS-a ani do
hasła szyfrującego**, więc prawdziwego pliku nie odtworzy. Udowodniłem, że
**sam skrypt działa** (ustalenie 1, test w Dockerze — sekundy dla syntetycznej
bazy). Brakującą liczbę — pełny powrót z prawdziwej kopii, z krokami ludzkimi
(znalezienie pliku, postawienie bazy docelowej, wklejenie adresów) — **musi
zmierzyć właściciel**.

Instrukcja bez żargonu i miejsce na wpisanie zmierzonego czasu: `README.md` →
„Jak odtworzyć kopię" (+ dopisany krok „zmierz i zapisz czas"). To jedyna
pozycja audytu, która czeka na ruch właściciela.

---

## Pojedyncze punkty awarii — co pada, jak zauważysz, co robisz, ile trwa

Pięciu podejrzanych z briefu. Dla każdego procedura powrotu, nie ogólnik
„odtwórz z kopii".

### A. Neon (baza danych) — skasowana / koniec darmowego planu

| | |
|---|---|
| **Co przestaje działać** | **Wszystko.** Panel (odczyt i zapis) i apka iOS czytają wyłącznie z bazy. |
| **Jak zauważysz** | Każdy ekran panelu pokazuje błąd; apka nie ładuje danych. |
| **Co robisz** | 1. Załóż nową bazę (nowy projekt Neon albo inny Postgres). 2. Odtwórz ostatnią kopię z NAS-a wg `scripts/kopia-zapasowa/README.md` → „Jak odtworzyć kopię" (`odtworz.sh`). 3. Wklej nowy `DATABASE_URL` w Vercel → Settings → Environment Variables → Redeploy. 4. Odtwórz też konto `kopia_ro` (`zaloz-konto-ro.sh`), żeby kopie ruszyły dalej. |
| **Ile trwa** | Sam skrypt odtwarzający: **sekundy** (zmierzone; prawdziwa baza ~1 MB też będzie sekundami). Całość z krokami ludzkimi — **do zmierzenia przez właściciela** (ustalenie 3). Mieści się w przyjętym RTO „do ~1 dnia". |
| **Ile danych tracisz** | Do 24 h (ostatnia nocna kopia) — przyjęte RPO. |

### B. Vercel — niedostępny (blokada za komercyjny użytek na Hobby / przejęte konto)

| | |
|---|---|
| **Co przestaje działać** | Strona publiczna i panel (to hosting). **Baza żyje** — dane są bezpieczne. |
| **Jak zauważysz** | Strona/panel się nie otwierają; mail od Vercela z żądaniem przejścia na Pro. |
| **Co robisz** | Kod stoi w **dwóch** miejscach: GitHub (`origin`) **oraz lokalnie na Macu właściciela** (ten katalog na dysku OWC). Nie ginie z Vercelem. Wdrożenie gdzie indziej = połączyć repo z nowym hostem i przenieść zmienne środowiskowe (`.env.example` + inwentarz sekretów w `AUDYT-1-WYNIKI.md`). |
| **Pułapka dostępu** | Wejście do Vercela idzie przez łańcuch **GitHub → Apple → skrzynka** (ustalenie 12 Audytu 1). Był **zerwany przez pół roku bez objawu**; naprawiony 2026-07-22 (przekierowanie na `kontakt@leggeralabs.pl`), ale to nadal łańcuch, nie pewnik. **Nie opieraj planu powrotu na tym, że wejdziesz do Vercela** — najpierw sprawdź, czy masz dostęp. |
| **Prewencja** | Przejście na **Pro przed rejestracją** (`PO_REJESTRACJI.md` pkt 13) usuwa ryzyko blokady za komercyjny użytek — najprostsza z tych awarii do uniknięcia z góry. |

### C. NAS (Ugreen DXP4800) — pada

| | |
|---|---|
| **Co przestaje działać** | Kopie zapasowe: nowe nie powstają, a przy awarii dysku **stare znikają razem z nim**. Panel działa (baza jest w chmurze). |
| **Jak zauważysz** | Pulpit pokazuje „Kopie zapasowe są nieaktualne" po **36 h** bez udanej kopii (Audyt 4, `BACKUP_STALE_HOURS`). Alarm wychodzi też pingiem z NAS-a, więc przeżywa śmierć crona. |
| **Co robisz** | Odbuduj kontener kopii wg `README.md` kroki 4–6 (na nowym/naprawionym NAS-ie). Cztery pliki + `.env` z trzema sekretami — nic nie trzeba instalować (`postgres:17` ma wszystko). |
| **Katastrofa fizyczna (pożar/kradzież)** | Wtedy ratuje **off-site** (ustalenie 2) — drugi dysk w innym miejscu. Bez niego tracisz wszystkie kopie; sama baza w Neonie zostaje, ale bez własnej historii zmian. |

### D. Skrzynka poczty (az.pl) — niedostępna

| | |
|---|---|
| **Co przestaje działać** | Pobieranie poczty, wysyłka przez SMTP i **załączniki** — bajty załączników są pobierane **na żywo z IMAP przy kliknięciu** (potwierdzone w kodzie: `app/api/mail/[id]/attachment/[aid]/route.ts` → `downloadAttachmentPart`; w bazie tylko metadane). Reszta panelu (leady, klienci, faktury, projekty, kalendarz) **działa normalnie**. |
| **Jak zauważysz** | Poczta pusta albo błąd przy „Pobierz teraz"; klik w załącznik → 502/503 z komunikatem. Powód nieudanego pobrania folderu ląduje w `mail_folders.last_error` i od Audytu 4 jest widoczny. |
| **Co robisz** | To usługa zewnętrzna — czekasz na az.pl albo zmieniasz hosting poczty (`MAIL_USER`/`MAIL_PASS` w Vercel → Redeploy; rotacja opisana w `AUDYT-1-WYNIKI.md`). Wiadomości już pobrane **zostają w bazie**; niedostępne do powrotu skrzynki są tylko niepobrane załączniki. |
| **Ważne** | Awaria az.pl **nie** wywraca panelu — degraduje wyłącznie moduł Poczty. |

### E. Mac Studio (Ollama, lokalny model AI) — pada

| | |
|---|---|
| **Co przestaje działać** | Szkice odpowiedzi mailowych (AI), OCR paragonów i skan wizytówek. **Nic więcej.** |
| **Jak zauważysz** | Klikasz „Szkic AI" / „Odczytaj paragon" / „Skanuj wizytówkę" → komunikat „Model AI niedostępny. Wpisz dane ręcznie." |
| **Sprawdzone w kodzie (nie założone)** | `lib/ollama.ts` **każdą** funkcję kończy `catch → return null`, nigdy nie rzuca. Wszystkie **trzy** miejsca wołające (`costs/[id]/ocr`, `mail/[id]/draft-reply`, `contacts/scan-card`) obsługują `null` przez `503` z komunikatem „wpisz ręcznie". Grep po użyciu, nie po definicji: awaria Ollamy **naprawdę** nie wywraca reszty panelu. To opcjonalna pomoc, nie fundament — dokładnie jak zakładał brief. |
| **Co robisz** | Nic pilnego — wpisujesz ręcznie. Włączasz Mac / proxy, gdy wygodnie. |

---

## Decyzje właściciela (2026-07-23)

Trzy rozstrzygnięcia z briefu, zadane wprost i zapisane z datą:

| Pytanie | Decyzja | Konsekwencja |
|---|---|---|
| **Kopia off-site** | Drugi dysk, uzupełniany ręcznie | Bez kodu i bez kosztu miesięcznego; off-site tak świeży, jak dyscyplina. Automat w chmurze → po rejestracji. |
| **Ile danych możemy stracić (RPO)** | Do 24 h wystarczy | Kopia zostaje **raz na dobę** o 3:00 — bez zmian. Rzadsza kopia mniej obciąża darmowy plan Neona. |
| **Ile przestoju OK (RTO)** | Do ~1 dnia | Procedura powrotu może być **ręczna**, człowieczo-tempo. Nie budujemy zapasowej infrastruktury „na gorąco". |
| **Czynnik ludzki** | **Nie ma drugiej osoby** | Runbook powstaje „dla przyszłego Ciebie" (niżej). Temat drugiej osoby zostaje otwarty. |

---

## Runbook „dla przyszłego Ciebie" (czynnik ludzki)

System obsługuje jedna osoba, która nie programuje, i **nie ma nikogo na
zastępstwo**. Ten runbook jest po to, żeby po miesiącu nieobecności (choroba,
urlop — nie katastrofa) dało się wrócić bez odtwarzania wszystkiego z głowy.

**Gdzie leży co (bez tego nic nie ruszysz):**

- **Hasła i sekrety** — w menedżerze haseł właściciela. Krytyczne trzy do
  odtworzenia bazy: adres bazy `kopia_ro`, `HASLO_KOPII` (szyfrowanie kopii),
  `BACKUP_PING_SECRET`. Pełny inwentarz 24 sekretów: `AUDYT-1-WYNIKI.md` →
  „Inwentarz sekretów".
- **Kod** — GitHub (`origin`) + lokalnie na Macu (dysk OWC, ten katalog).
- **Kopie bazy** — NAS Ugreen, katalog z kroku 4 README + (po ustaleniu 2)
  drugi dysk off-site.
- **Instrukcje awaryjne** — ten plik (procedury A–E wyżej) + README kopii.

**Trzy najczęstsze sytuacje i gdzie szukać:**

1. „Panel pokazuje błędy wszędzie" → prawdopodobnie baza. Procedura A.
2. „Strona się nie otwiera" → prawdopodobnie Vercel. Procedura B.
3. „Pulpit mówi, że kopie nieaktualne" → NAS albo kontener. Procedura C.

**Rzecz do zrobienia raz, żeby ten runbook był prawdziwy:** przećwicz
odtworzenie kopii na sucho (ustalenie 3) i **zapisz zmierzony czas** — dopóki
tego nie zrobisz, „do ~1 dnia" jest założeniem, nie faktem.

---

## Sprawdzone i jest dobrze

To też jest wynik audytu.

- **Skrypt odtwarzający działa end-to-end** — po naprawie z ustalenia 1
  udowodnione uruchomieniem w Dockerze (nie lekturą): dane wracają co do znaku,
  zły klucz twardo odrzucony.
- **`kopia.sh` (strona zapisu) jest solidna** — `set -euo pipefail`, kontrola
  że plik da się odszyfrować i rozpakować, sanity-check „≥1 tabela", jawny
  `chmod 600`, meldunek po każdym przebiegu. Przeczytana w całości.
- **Nadzór nad kopiami przeżywa śmierć crona** — alarm wychodzi też pingiem
  z NAS-a (`/api/backup/ping`), próg 36 h zamiast 24 h (bez fałszywych alarmów).
  Zbudowane w Audycie 4 — **nie dublowane tutaj**.
- **Awaria Ollamy jest izolowana** — potwierdzone gretem po użyciu we wszystkich
  trzech trasach (procedura E). Panel działa bez AI.
- **Awaria az.pl jest izolowana** — degraduje tylko Pocztę (procedura D).
- **Kod nie ginie z jednym dostawcą** — jest w GitHubie i lokalnie na Macu.
- **Konto `kopia_ro` jest tylko-do-odczytu** — przejęty NAS nie skasuje bazy
  (potwierdzone w Audycie 1, `konto-ro.sql`).

---

## Jak to zweryfikowano (nie „skompilowało się")

`tsc` tu nic nie dowodzi — zmiana jest w skrypcie bash, nie w TypeScripcie.
Dowodem jest uruchomienie w Dockerze (`postgres:17`, **nie** alpine — alpine nie
ma `openssl`).

1. **Odtworzenie end-to-end na syntetycznej bazie** — dwa kontenery `postgres:17`
   (źródło + cel), dane (25 klientów, 140 leadów, 60 faktur, suma 225 913,50),
   `pg_dump --schema=public --no-owner --no-privileges | gzip -9 | openssl enc`
   (dokładnie jak `kopia.sh`), potem `odtworz.sh` do pustego celu. Wynik:
   `clients=25 leads=140 invoices=60 suma=225913.50` **zgadza się co do znaku**.
   Czas samego skryptu: <1 s (syntetyczna baza).
2. **Test złego hasła PRZED naprawą** — odtworzenie do pustej bazy ze złym
   `HASLO_KOPII`: `openssl` → `bad decrypt`, `gzip` → `not in gzip format`, a
   `odtworz.sh` → **kod 0, „Gotowe", 0 tabel w celu**. To jest ustalenie 1,
   zmierzone, nie domniemane.
3. **Test złego hasła PO naprawie** — ta sama próba: **kod 1** + komunikat
   „odtworzenie NIE powiodło się…" + 0 tabel. Cichy fałszywy sukces zamieniony
   w twardy błąd.
4. **Regresja dobrej ścieżki po naprawie** — pełny test (1) powtórzony:
   dane nadal wracają co do znaku, kod 0. `pipefail` nie zepsuł ścieżki udanej.
5. **Izolacja Ollamy** — grep po użyciu (`ollamaGenerate*`) w trzech trasach:
   każda zwraca 503 „wpisz ręcznie" przy `null`. Nie założone — odczytane.
6. **Załączniki na żądanie z IMAP** — odczyt `attachment/[aid]/route.ts`:
   bajty z `downloadAttachmentPart` przy kliknięciu, 502/503 gdy skrzynka
   niedostępna. Potwierdza procedurę D.

Skrypty testowe były jednorazowe (scratchpad, poza repo), kontenery
posprzątane (`docker rm -f`).

---

## Co zmieniono w kodzie

Minimalnie, zgodnie z zasadą „nie buduj nic na zapas":

- **`scripts/kopia-zapasowa/odtworz.sh`** — `set -eu` → `set -euo pipefail`
  + owinięcie potoku w `if ! … then` z polskim komunikatem błędu (ustalenie 1).
  Jedyna zmiana kodu w tym audycie.
- **`scripts/kopia-zapasowa/README.md`** — dopisana sekcja „Kopia poza domem"
  (procedura ręczna, ustalenie 2) i krok „zmierz i zapisz czas" przy
  odtwarzaniu (ustalenie 3).

Off-site w chmurze **świadomie NIE dobudowany** — właściciel wybrał drugi dysk
ręcznie. RPO/RTO nie wymagały zmian w kodzie (kopia zostaje raz na dobę).

---

## Co zostaje otwarte

- **Zmierzenie prawdziwego czasu odtworzenia** (ustalenie 3) — czeka na
  właściciela; wpisać do README po wykonaniu.
- **Dyscyplina off-site** (ustalenie 2) — drugi dysk działa tylko, jeśli
  właściciel go uzupełnia; nie ma na to nadzoru (świadomie — automat byłby
  chmurą, którą właściciel odrzucił na teraz).
- **Automatyczny off-site w chmurze** — opcja do rozważenia po rejestracji
  (`PO_REJESTRACJI.md`).
- **Vercel Pro przed rejestracją** — usuwa ryzyko blokady (procedura B,
  `PO_REJESTRACJI.md` pkt 13, już tam było).
- **Druga osoba na zastępstwo** — dziś nie ma; runbook „dla przyszłego Ciebie".

## Czego ten audyt NIE obejmował

Zgodnie z zasadą „jeden audyt = jeden czat":

- **Audyt 2 (RODO)** — **następny w kolejce.** Ustalenia tego audytu dokładają
  mu materiału: retencja kopii (7 dni + 4 tygodnie), off-site jako nowe miejsce
  z danymi osobowymi, prawo do usunięcia obejmujące kopie na NAS-ie.
- **Audyty 5/6/7** — koszty, kod, produkt. Nietknięte.
- **Testy automatyczne** — nadal zero (`package.json` bez skryptu `test`); to
  zakres Audytu 6. Weryfikacja tutaj była ręczna (Docker), jednorazowa.
