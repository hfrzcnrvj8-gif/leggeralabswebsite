# Kopia zapasowa bazy na NAS — instrukcja

Codzienna, zaszyfrowana kopia całej bazy Leggera Hub (Neon) na Twoim NAS-ie
Ugreen DXP4800 Plus. Powstała 2026-07-20.

> ## ⚠️ To ma chodzić NA NAS-ie, nie na Macu
>
> Docker jest zainstalowany także na Twoim Macu i wszystko poniżej uruchomi
> się tam bez mrugnięcia okiem. **Nie rób tego.**
>
> Pułapka polega na tym, że na Macu to *będzie działać* — kopie zaczną się
> pojawiać i wszystko będzie wyglądać poprawnie. Ale powstaną wyłącznie wtedy,
> gdy Mac akurat nie śpi o 3:00. Dostaniesz dziury w kopiach, o których się
> nie dowiesz, dopóki nie będziesz czegoś odtwarzał. **To jest gorsze niż brak
> kopii**, bo brak widać od razu, a dziurę dopiero w najgorszym momencie.
>
> NAS chodzi non stop i dlatego to jego zadanie. Docker na Macu przydaje się
> tu do jednej rzeczy: do **ćwiczebnego odtworzenia** kopii (sekcja niżej).
>
> Jak sprawdzić, gdzie faktycznie chodzi: każdy przebieg zapisuje w logu nazwę
> maszyny — patrz krok 5.

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

## Krok 3 — sekret do meldunków (żebyś wiedział, czy kopie działają)

Kopia, która cicho przestała się robić, jest tak samo bezużyteczna jak jej
brak — z tą różnicą, że brak widać. Dlatego skrypt po **każdym** przebiegu
melduje się do panelu, a Pulpit pokazuje ostrzeżenie **razem z powodem**,
gdy coś jest nie tak.

Wymyśl trzeci, osobny sekret (dowolny długi losowy ciąg) i dodaj go
w **panelu Vercela → Settings → Environment Variables**:

```
BACKUP_PING_SECRET = twoj-losowy-sekret
```

Po dodaniu zmiennej Vercel musi zbudować projekt na nowo — kliknij
**Redeploy** przy ostatnim wdrożeniu.

> Jeśli pominiesz ten krok, kopie i tak będą się robić — po prostu panel nie
> będzie o nich wiedział i pokaże „Kopie zapasowe bazy nie są uruchomione".

## Krok 4 — katalog na NAS-ie

Załóż udział/katalog na kopie, np. `kopie/leggera`. Zapisz jego pełną ścieżkę
(w UGOS widać ją we właściwościach folderu, zwykle zaczyna się od `/volume1/`).

## Krok 5 — uruchomienie w Dockerze na NAS-ie

1. Skopiuj na NAS **cztery** pliki z tego katalogu: `kopia.sh`, `odtworz.sh`,
   `docker-compose.yml` i `Dockerfile`.
2. W `docker-compose.yml` podmień ścieżkę `/volume1/kopie/leggera` na tę
   z kroku 4 (lewa strona dwukropka).
3. Obok nich utwórz plik `.env` o treści:

```
DATABASE_URL_RO=postgresql://kopia_ro:HASLO@ep-...neon.tech/neondb?sslmode=require
HASLO_KOPII=twoje-haslo-szyfrowania
BACKUP_PING_SECRET=ten-sam-sekret-co-w-Vercelu
```

4. W UGOS: **Docker → Projekty → Utwórz**, wskaż ten katalog i uruchom.

Kontener wystartuje, napisze w logu, za ile godzin zrobi pierwszą kopię,
i od tej pory będzie ją robił codziennie o 3:00.

## Krok 6 — sprawdź, że działa (nie pomijaj)

Nie czekaj do 3:00. Uruchom jeden przebieg ręcznie — w UGOS w terminalu
kontenera albo przez SSH:

```sh
docker exec leggera-kopia-bazy bash /kopia.sh
```

Powinieneś zobaczyć mniej więcej:

```
[2026-07-20 21:15:01] Maszyna: leggera-nas | katalog: /kopie
[2026-07-20 21:15:02] Zrzucam bazę…
[2026-07-20 21:15:06] Kopia gotowa: leggera-2026-07-20-2115.sql.gz.enc (2,1M, tabel: 43)
[2026-07-20 21:15:06] Stan: 1 dziennych, 0 tygodniowych.
```

**Popatrz na dwie rzeczy.** Po pierwsze na liczbę tabel — jeśli jest
podejrzanie mała, konto tylko-do-odczytu nie widzi części danych, wróć do
kroku 1. Po drugie na **nazwę maszyny** w pierwszej linii: musi to być Twój
NAS. Jeśli zobaczysz tam nazwę Maca, zatrzymaj to i przenieś na NAS.

Potem otwórz **Pulpit** w panelu. Jeśli wszystko gra, **nie zobaczysz tam nic
o kopiach** — i tak ma być. Pulpit odzywa się wyłącznie wtedy, gdy coś wymaga
Twojej reakcji; kolejny zielony wskaźnik uczyłby tylko przewijania.

---

## Jak odtworzyć kopię

**Zrób to raz teraz, na próbę.** Kopia, której nigdy nie odtworzyłeś, nie jest
kopią — jest plikiem, co do którego masz nadzieję.

Odtwarzaj do **pustej bazy testowej**, nie na produkcję. Najprościej postawić
ją na chwilę w Dockerze:

```sh
docker run -d --name test-odtworzenia -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:17

docker exec -e HASLO_KOPII='twoje-haslo' leggera-kopia-bazy \
  bash /odtworz.sh /kopie/dzienne/leggera-2026-07-20-0300.sql.gz.enc \
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

## Skąd wiesz, że kopie działają

Nie musisz nic sprawdzać — panel sam się odezwie. Skrypt melduje każdy
przebieg, a Pulpit pokazuje pas ostrzegawczy w trzech przypadkach:

| Co zobaczysz | Co to znaczy |
|---|---|
| „Kopie zapasowe bazy nie są uruchomione" | Nigdy nie przyszedł żaden meldunek — wróć do kroku 5 |
| „Ostatnia kopia zapasowa się nie udała" | Coś padło. **Pod spodem masz dokładny powód**, cytat z serwera |
| „Kopie zapasowe są nieaktualne" | Nic nie zgłosiło błędu, ale od ponad 36 godzin nie ma udanej kopii — najczęściej kontener stoi albo NAS był wyłączony |

Powód awarii jest cytowany **dosłownie**, np.:

```
Zrzut bazy nie powiódł się: FATAL: password authentication failed for user
"kopia_ro". Sprawdź adres i hasło konta kopia_ro oraz połączenie NAS-a
z internetem.
```

Dzięki temu nie musisz szukać po logach kontenera — od razu wiesz, co
naprawić.

Próg 36 godzin (a nie 24) jest celowy: kopia leci raz na dobę, więc drobne
przesunięcie nie może wywoływać fałszywego alarmu. Fałszywe alarmy uczą
ignorowania ostrzeżeń, a to ma zadziałać wtedy, gdy zapali się raz na rok.

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

**Meldunki sprawdzone na czterech realnych awariach**, z obejrzeniem Pulpitu:
złe hasło do bazy, brak konfiguracji kontenera, konto bez uprawnień do tabel
oraz powrót do stanu normalnego (pas ostrzegawczy znika). Odrzucanie
meldunków bez sekretu i ze złym sekretem — również sprawdzone.

**URUCHOMIONE I ZWERYFIKOWANE NA PRODUKCJI 2026-07-20**, na NAS-ie
DXP4800PLUS-611E: kopia 956 KB / **44 z 44 tabel**, odtworzona na czystą bazę
z kompletem danych (38 leadów, 96 wiadomości, 10 faktur, 4 projekty).

Pięć rzeczy wyszło dopiero na prawdziwym sprzęcie i prawdziwych danych —
warto je znać, bo każda dawała fałszywe poczucie bezpieczeństwa:

1. **`pg_dump` próbował zrzucić schemat `neon_auth`** (wbudowane logowanie
   Neona, włączane domyślnie przez integrację z Vercelem), do którego
   `kopia_ro` nie ma praw — cała kopia padała. Panel z niego nie korzysta,
   więc zrzucamy `--schema=public`.
2. **`hostname` w kontenerze zwraca jego identyfikator**, nie nazwę NAS-a —
   co przekreślało kontrolę „czy to chodzi we właściwym miejscu".
3. **Odtwarzanie nie działało**: zrzut zawiera `CREATE SCHEMA public`, który
   każda nowa baza już ma. Kopia była poprawna, tylko nie dało się jej wgrać.
   **Wyszło wyłącznie dlatego, że spróbowaliśmy odtworzyć naprawdę.**
4. **`umask` nie działa na udziałach UGOS** (własne listy dostępu) — plik
   `.env` z sekretami powstał jako czytelny dla wszystkich. Uprawnienia
   ustawiamy teraz jawnie (`chmod 600`).
5. **Ścieżka katalogu wpisana w `docker-compose.yml`** została nadpisana przy
   aktualizacji pliku z repozytorium i kopie zaczęły cicho lądować gdzie
   indziej. Ścieżka mieszka teraz w `.env` (`KATALOG_NA_NASIE`).

**Co zostało po Twojej stronie:** nic obowiązkowego. Warto raz na jakiś czas
samemu przejechać odtworzenie (sekcja wyżej) — nie dlatego, że coś podejrzewam,
tylko dlatego, że to jedyny sposób, żeby wiedzieć na pewno.
