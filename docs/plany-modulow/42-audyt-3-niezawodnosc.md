# Brief: Audyt 3 — Niezawodność, kopie i powrót po awarii

> Brief wdrożeniowy pod **jeden osobny czat**. To nie jest nowy plan — to
> **wykonanie Audytu 3** z `docs/AUDYTY-KONCOWE.md`. Tamten dokument jest
> zakresem, ten mówi, jak go przejechać i co już wiadomo.
>
> Powstał 2026-07-23, po domknięciu Audytu 1 (bezpieczeństwo) i Modułu 41
> (drugi składnik TOTP).

## Dlaczego ten audyt jest teraz

Kolejność w `AUDYTY-KONCOWE.md` jest **wg ryzyka, nie wg numeracji**:
**4 → 1 → 3 → 2 → 6 → 5 → 7**. Cztery domknięte (obserwowalność), jeden
domknięty (bezpieczeństwo). Audyt 3 jest następny, bo bezpieczeństwo pilnuje
„żeby nikt niepowołany nie wszedł", a niezawodność — „żeby po awarii dało się
wrócić". Jedno bez drugiego zostawia dziurę: dane klientów są zabezpieczone
przed wyciekiem, ale **nie ma zmierzonej procedury ich odzyskania**.

**Pytanie audytu, słowami z `AUDYTY-KONCOWE.md`:** co się stanie, gdy padnie
każdy pojedynczy element — i czy umiemy z tego wrócić.

To jest szczególnie ważne **przed pierwszym prawdziwym klientem**: od tej
chwili awaria to nie „mój panel nie działa", tylko „cudze dane są niedostępne
albo przepadły".

## Stan zastany — co już wiadomo (zweryfikuj, nie zakładaj)

| Co | Stan na 2026-07-23 |
|---|---|
| Kopia zapasowa bazy | Codzienny, zaszyfrowany `pg_dump` z Neona na NAS (Ugreen DXP4800), Docker, konto Neona **tylko-do-odczytu**. Skrypty: `scripts/kopia-zapasowa/` |
| Kopie chodzą od | 2026-07-20 |
| Odtworzenie kopii | **Wykonane RAZ** (2026-07-20). Od tego czasu ani razu. |
| Ile trwa odtworzenie | **Nikt nie zmierzył.** |
| Kopia kopii poza domem (off-site) | **Nie ma.** NAS pada → wszystkie kopie znikają razem z nim. |
| Wykrywanie ciszy kopii | Jest (`lib/backup.ts`, `BACKUP_STALE_HOURS = 36`, `backup_runs`) — Audyt 4 |
| Bicie serca spoza Vercela | `/api/backup/ping` ze skryptu na NAS-ie — jedyny alarm działający, gdy padnie cron (Audyt 4) |
| Retencja logów Vercela (plan Hobby) | Liczona w godzinach |
| Plan Vercel | **Hobby** — komercyjny użytek łamie warunki, konto może zostać zablokowane; przejście na Pro odłożone do rejestracji firmy (`PO_REJESTRACJI.md` pkt 13) |
| Załączniki maili | Pobierane **na żądanie z IMAP** — skrzynka pada → przestają być dostępne (w bazie tylko metadane) |
| Testy automatyczne | **Zero**; `package.json` nie ma nawet skryptu `test` |

**Skutek do nazwania wprost:** kopie *są*, ale „kopia, której nigdy nie
odtworzyłeś, to nie kopia, tylko nadzieja". A jedyny nośnik kopii stoi w
jednym miejscu (NAS w domu) — pożar/kradzież/awaria dysku zabiera oryginał
i kopię naraz.

## Pojedyncze punkty awarii — wypisz każdy z procedurą powrotu

Dla **każdego** spisz: co przestaje działać, jak to zauważysz, co robisz, ile
to trwa. Podejrzani (z `AUDYTY-KONCOWE.md`, potwierdź kompletność):

1. **Neon (baza)** kasuje bazę / kończy darmowy plan → odtwarzamy z NAS-a.
   **Zmierz, ile to realnie trwa.**
2. **Vercel** niedostępny (przejęte konto, blokada za komercyjny użytek na
   Hobby) → gdzie stoi kod, jak szybko wdrożyć gdzie indziej. Uwaga: dostęp do
   Vercela idzie przez łańcuch GitHub → Apple → skrzynka (ustalenie 12
   Audytu 1) — ten sam, który był zerwany przez pół roku.
3. **NAS** pada → kopie znikają. **To jest argument za kopią poza domem.**
4. **Skrzynka poczty (az.pl)** niedostępna → poczta i **załączniki** (na
   żądanie z IMAP) przestają działać.
5. **Mac Studio (Ollama)** — lokalny model AI. Pada → szkice maili i OCR
   paragonów przestają działać, reszta panelu działa (to opcjonalna pomoc, nie
   fundament — sprawdź, czy na pewno tak jest w kodzie, nie tylko w założeniu).

## Co ROZSTRZYGNĄĆ z właścicielem (nie decyduj sam)

Właściciel nie programuje — pytaj wprost, po polsku, bez żargonu, i podaj
koszt/wysiłek każdej opcji.

1. **Kopia poza domem (off-site).** Dziś jej nie ma — pożar/kradzież NAS-a =
   utrata wszystkiego. Opcje do przedstawienia: (a) druga kopia szyfrowana na
   dysk trzymany w innym miejscu, (b) zimny magazyn w chmurze (np. szyfrowany
   plik na tanim storage), (c) drugi NAS u kogoś zaufanego. Kopia jest już
   **zaszyfrowana**, więc off-site nie wystawia danych — ale każda opcja to
   koszt i jedna rzecz więcej do pilnowania (Audyt 4: nie mnóż automatów bez
   potrzeby). **Nie wybieraj sam.**
2. **Ile możemy stracić i jak długo możemy stać.** Kopia jest raz na dobę,
   więc w najgorszym razie tracimy **do 24 h** wpisów (RPO). Zapytaj, czy to
   akceptowalne, czy chce częstszych kopii. I ile godzin przestoju jest OK,
   zanim panel musi znów działać (RTO) — to determinuje, jak agresywnie pisać
   procedurę powrotu.
3. **Czynnik ludzki.** System obsługuje jedna osoba, która nie programuje. Co
   ma zrobić ktoś inny, gdyby właściciel był niedostępny miesiąc (choroba,
   urlop — nie katastrofa)? Zapytaj, czy **jest** taka osoba i czy ma dostać
   zapieczętowaną instrukcję. Jeśli nie ma nikogo — procedura powstaje „dla
   przyszłego Ciebie", i to też jest odpowiedź, którą trzeba zapisać.

## Zakres — co ma powstać

To **audyt**, nie duży moduł: większość wyniku to **procedury i jeden
prawdziwy test odtworzenia**, nie nowy kod. Konkretnie:

1. **Odtworzenie kopii „na sucho" — naprawdę wykonane i zmierzone.**
   - Podział pracy jest wymuszony realiami środowiska: **Claude nie ma dostępu
     do NAS-a ani do hasła szyfrującego**, więc nie odtworzy prawdziwej kopii.
     Może natomiast **udowodnić, że skrypt `odtworz.sh` działa end-to-end**:
     stworzyć syntetyczną bazę w Dockerze, zrobić z niej `pg_dump`, zaszyfrować
     testowym kluczem, przepuścić przez `odtworz.sh` i potwierdzić, że dane
     wracają — **i zmierzyć czas**. To wykrywa błędy w samym skrypcie (a
     „niedziałające odtwarzanie kopii" już raz było cichym błędem w tym
     projekcie).
   - **Prawdziwe** odtworzenie z NAS-a (z realnym plikiem i hasłem) wykonuje
     **właściciel**, krok po kroku wg `scripts/kopia-zapasowa/README.md` →
     „Jak odtworzyć kopię”. Przygotuj mu tę procedurę tak, żeby dało się ją
     przejść bez czytania kodu, i **każ zmierzyć czas** (to jest brakująca
     liczba z tabeli wyżej). Uwaga z pamięci projektu: obraz to **`postgres:17`,
     NIE `postgres:17-alpine`** (alpine nie ma `openssl`, deszyfrowanie padnie).
2. **`docs/AUDYT-3-WYNIKI.md`** — główny produkt, wzorem `AUDYT-1-WYNIKI.md`
   i `AUDYT-4-WYNIKI.md`: ustalenia wg ryzyka, procedura powrotu dla każdego
   punktu awarii, zmierzone czasy, decyzje właściciela, co zostaje otwarte.
3. **Minimalny kod — tylko to, co właściciel zatwierdzi.** Np. jeśli wybierze
   kopię off-site, dołóż ją najprościej jak się da (bramka migracji, `inMigration()`,
   nadzór przez istniejący mechanizm z Audytu 4, nie nowy automat). Nie buduj
   nic „na zapas".

## Weryfikacja — `tsc` tu nic nie udowodni

„Zielony build nie jest dowodem" (zasada z trzech poprzednich audytów). Dowodem
jest uruchomienie:

1. **Test `odtworz.sh` na syntetycznej kopii wykonany naprawdę** — dane
   wracają, czas zmierzony, wynik wklejony do `AUDYT-3-WYNIKI.md`. Nie „przeczytałem
   skrypt i wygląda dobrze".
2. **Każdy punkt awarii ma procedurę powrotu** — konkretną, nie „odtwórz z
   kopii". Kto co klika, w jakiej kolejności, ile to trwa.
3. **Kopia off-site** (jeśli właściciel ją wybierze) — pokaż, że plik naprawdę
   trafia w drugie miejsce i że da się z niego odtworzyć; jeśli nie wybierze —
   zapisz to jako świadomą decyzję z datą, nie jako lukę.
4. **Runbook czynnika ludzkiego** istnieje jako dokument, który zrozumie ktoś
   nietechniczny.
5. `npx tsc --noEmit -p tsconfig.json` po każdej paczce kodu (jeśli w ogóle
   będzie kod). Pełny `next build` failuje w sandboxie z EPERM.

## Zasady prowadzenia (nie powtarzaj cudzej roboty)

- **Przeczytaj najpierw ustalenia poprzednich audytów.** `AUDYT-4-WYNIKI.md`
  (obserwowalność — kopie mają już wykrywanie ciszy i ping z NAS-a, **nie
  buduj tego drugi raz**) i `AUDYT-1-WYNIKI.md` (dostęp, łańcuch Vercel→GitHub
  →Apple→skrzynka). Kopie zapasowe i ich monitoring **istnieją** — Audyt 3 nie
  pisze ich od zera, tylko **ćwiczy powrót** i **domyka off-site + procedury**.
- **Weryfikuj gretem/uruchomieniem, nie pamięcią.** Dokumentacja w tym
  projekcie już nie raz kłamała.
- **Produkcyjna baza i NAS są poza zasięgiem Claude.** Wszystko, co ich
  dotyka, idzie przez właściciela — przygotuj mu instrukcje bez żargonu.
- **Jeden audyt = jeden czat.** Nie wchodź w Audyt 2 (RODO) ani 5/6/7.

## Po zakończeniu

Zaktualizuj `docs/AUDYTY-KONCOWE.md` (odhacz Audyt 3, wskaż następny — Audyt 2
RODO), dopisz pozycje do `PO_REJESTRACJI.md` jeśli coś wyjdzie na „po
rejestracji" (np. Vercel Pro), odhacz w `docs/plany-modulow/README.md`, zapisz
istotne decyzje w pamięci i podaj właścicielowi komendę do commita.
