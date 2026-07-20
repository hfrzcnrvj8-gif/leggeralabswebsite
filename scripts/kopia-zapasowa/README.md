# Kopia zapasowa bazy na NAS — instrukcja

Codzienna, zaszyfrowana kopia całej bazy Leggera Hub (Neon) na Twoim NAS-ie
Ugreen DXP4800 Plus. Powstała 2026-07-20.

**Po co, skoro baza jest w chmurze.** Neon na darmowym planie trzyma bardzo
krótką historię zmian. Jeśli coś zostanie skasowane albo zepsute i zauważysz
to po tygodniu — bez własnej kopii nie ma czego odtwarzać. To jest ta jedna
rzecz, w której własny sprzęt bije chmurę.

---

## Krok 1 — konto tylko-do-odczytu w Neonie

**Nie używaj do kopii głównego adresu bazy.** Ten adres pozwala też kasować
i nadpisywać dane; gdyby NAS został kiedyś przejęty, byłby to dostęp do
wszystkiego. Konto tylko-do-odczytu może wyłącznie czytać — czyli dokładnie
tyle, ile potrzeba do zrobienia kopii.

W konsoli Neona (`console.neon.tech`) → Twój projekt → **SQL Editor**, wklej
i uruchom:

```sql
CREATE ROLE kopia_ro WITH LOGIN PASSWORD 'wpisz-tu-dlugie-losowe-haslo';
GRANT CONNECT ON DATABASE neondb TO kopia_ro;
GRANT USAGE ON SCHEMA public TO kopia_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO kopia_ro;
-- Żeby nowe tabele (kolejne moduły panelu) też były obejmowane kopią:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO kopia_ro;
```

> Jeśli Twoja baza nazywa się inaczej niż `neondb`, podmień nazwę w drugiej
> linii. Zobaczysz ją w adresie połączenia, po ostatnim ukośniku.

Adres do kopii zbudujesz z adresu produkcyjnego, podmieniając nazwę
użytkownika i hasło na `kopia_ro` i to, które właśnie ustawiłeś:

```
postgresql://kopia_ro:HASLO@ep-cos-tam.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Adres produkcyjny znajdziesz w panelu Vercela → projekt → **Settings** →
**Environment Variables** → `DATABASE_URL`.

## Krok 2 — hasło szyfrowania kopii

Wymyśl (albo wylosuj) drugie, osobne hasło. Będzie szyfrować pliki kopii.

⚠️ **Zapisz je w menedżerze haseł.** Zgubienie tego hasła oznacza, że kopie
są bezużyteczne — nie ma żadnej furtki awaryjnej i nikt Ci go nie odzyska.

## Krok 3 — katalog na NAS-ie

Załóż udział/katalog na kopie, np. `kopie/leggera`. Zapisz jego pełną ścieżkę
(w UGOS widać ją we właściwościach folderu, zwykle zaczyna się od `/volume1/`).

## Krok 4 — uruchomienie w Dockerze na NAS-ie

1. Skopiuj na NAS trzy pliki z tego katalogu: `kopia.sh`, `odtworz.sh`,
   `docker-compose.yml`.
2. W `docker-compose.yml` podmień ścieżkę `/volume1/kopie/leggera` na tę
   z kroku 3 (lewa strona dwukropka).
3. Obok nich utwórz plik `.env` o treści:

```
DATABASE_URL_RO=postgresql://kopia_ro:HASLO@ep-...neon.tech/neondb?sslmode=require
HASLO_KOPII=twoje-haslo-szyfrowania
```

4. W UGOS: **Docker → Projekty → Utwórz**, wskaż ten katalog i uruchom.

Kontener wystartuje, napisze w logu, za ile godzin zrobi pierwszą kopię,
i od tej pory będzie ją robił codziennie o 3:00.

## Krok 5 — sprawdź, że działa (nie pomijaj)

Nie czekaj do 3:00. Uruchom jeden przebieg ręcznie — w UGOS w terminalu
kontenera albo przez SSH:

```sh
docker exec leggera-kopia-bazy sh /kopia.sh
```

Powinieneś zobaczyć mniej więcej:

```
[2026-07-20 21:15:02] Zrzucam bazę…
[2026-07-20 21:15:06] Kopia gotowa: leggera-2026-07-20-2115.sql.gz.enc (2,1M, tabel: 43)
[2026-07-20 21:15:06] Stan: 1 dziennych, 0 tygodniowych.
```

**Popatrz na liczbę tabel.** Jeśli jest podejrzanie mała, konto tylko-do-odczytu
nie widzi części danych — wróć do kroku 1.

---

## Jak odtworzyć kopię

**Zrób to raz teraz, na próbę.** Kopia, której nigdy nie odtworzyłeś, nie jest
kopią — jest plikiem, co do którego masz nadzieję.

Odtwarzaj do **pustej bazy testowej**, nie na produkcję. Najprościej postawić
ją na chwilę w Dockerze:

```sh
docker run -d --name test-odtworzenia -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:17

docker exec -e HASLO_KOPII='twoje-haslo' leggera-kopia-bazy \
  sh /odtworz.sh /kopie/dzienne/leggera-2026-07-20-0300.sql.gz.enc \
  postgresql://postgres:test@172.17.0.1:5432/postgres
```

Potem sprawdź, czy dane są na miejscu:

```sh
docker exec test-odtworzenia psql -U postgres -c '\dt'
docker exec test-odtworzenia psql -U postgres -c 'SELECT count(*) FROM clients;'
```

Na koniec sprzątnij: `docker rm -f test-odtworzenia`.

Skrypt odtwarzający **celowo pyta o potwierdzenie**, jeśli adres docelowy
wygląda na produkcyjnego Neona — żeby nie dało się nadpisać żywej bazy jednym
nieuważnym poleceniem.

---

## Co jest w kopiach i jak długo leżą

| Rodzaj | Kiedy powstaje | Jak długo leży |
|---|---|---|
| dzienna | codziennie o 3:00 | 7 dni |
| tygodniowa | w poniedziałki | 4 tygodnie |

Retencja jest **celowo ograniczona**. W kopiach są dane osobowe klientów
(nazwiska, adresy, korespondencja), a RODO nie pozwala trzymać ich
bezterminowo „na wszelki wypadek". Jeśli kiedykolwiek będziesz wydłużać te
okresy, to jest decyzja, którą trzeba odnotować w polityce prywatności.

Pliki są zaszyfrowane (AES-256). Bez hasła z kroku 2 są nieczytelne nawet dla
kogoś, kto ma fizyczny dostęp do dysków NAS-a.

---

## Co zostało sprawdzone, a co nie

**Sprawdzone 2026-07-20 na prawdziwym Postgresie w Dockerze** (pełny cykl,
nie tylko „skrypt się uruchamia"): zrzut bazy z danymi → szyfrowanie →
odtworzenie na czystą bazę → **porównanie zawartości, zgadza się co do
znaku**; odrzucenie złego hasła; nieczytelność pliku bez hasła; wykrycie
braku `openssl` i odmowa zapisania kopii, zamiast zapisania niezaszyfrowanej.

**NIE sprawdzone, bo wymaga Twojego udziału:** połączenie z prawdziwym
Neonem (adres bazy jest tylko w Vercelu, nie mam do niego dostępu),
uruchomienie w UGOS Pro na Twoim NAS-ie i pierwsze realne odtworzenie.
Krok 5 i sekcja o odtwarzaniu istnieją właśnie po to, żebyś to domknął.
