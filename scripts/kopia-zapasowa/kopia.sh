#!/bin/bash
# Kopia zapasowa bazy Leggera Hub na NAS (2026-07-20).
#
# Uruchamiana W KONTENERZE `postgres:17`, który ma już `pg_dump`, `psql`
# i `openssl` — dzięki temu na NAS-ie nie trzeba niczego instalować, a
# aktualizacja systemu NAS-a (UGOS) nie może tego zepsuć.
#
# ŚWIADOMIE nie `postgres:17-alpine`: wariant alpine NIE MA `openssl`, więc
# szyfrowanie cicho by nie zadziałało. Sprawdzone uruchomieniem 2026-07-20 —
# skrypt wykrył to i odmówił zapisania kopii, zamiast zapisać niezaszyfrowaną.
#
# Co robi:
#   1. zrzuca CAŁĄ bazę z Neona (`pg_dump`),
#   2. pakuje i SZYFRUJE (w środku są dane osobowe klientów — RODO),
#   3. sprawdza, czy plik da się odczytać,
#   4. kasuje kopie starsze niż ustalona retencja.
#
# Świadomie NIE trzyma haseł w sobie — bierze je ze zmiennych środowiskowych
# (patrz docker-compose.yml). Nigdy nie wypisuje connection stringa do logu:
# ten adres daje dostęp do wszystkich danych klientów, a logi bywają czytane
# przez przypadek.
# `pipefail` jest tu WARUNKIEM POPRAWNOŚCI, nie stylem. Bez niego w potoku
# `pg_dump | gzip | openssl` liczy się wynik OSTATNIEGO polecenia — więc gdy
# pg_dump padał (złe hasło, brak sieci), openssl i tak kończył się sukcesem
# zapisując pusty plik, a skrypt zgłaszał zupełnie inny powód („konto nie ma
# uprawnień"). Właściciel szukałby wtedy problemu w złym miejscu.
# Złapane 2026-07-20 testem ze złym hasłem. Stąd też `bash`, nie `sh`:
# `pipefail` nie jest w POSIX-owym `sh`.
set -euo pipefail

KATALOG="${KATALOG_KOPII:-/kopie}"
DNI_DZIENNYCH="${DNI_DZIENNYCH:-7}"
TYGODNI="${TYGODNI:-4}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Meldunek do panelu po KAŻDYM przebiegu — udanym i nieudanym.
#
# Ten drugi jest ważniejszy. Bez meldunku o porażce panel widziałby tylko
# ciszę, a cisza znaczy jednocześnie „kopie się nie robią" i „NAS wyłączony",
# czyli nie znaczy nic. Powód awarii dojeżdża wprost na Pulpit, żeby
# właściciel nie musiał czytać logów kontenera.
#
# Nieudany meldunek NIE może wywrócić kopii: sama kopia jest ważniejsza niż
# powiadomienie o niej. Dlatego wszystko tu jest „best effort".
melduj() {
  _ok="$1"; _powod="$2"; _tabel="${3:-null}"; _rozmiar="${4:-null}"; _trwalo="${5:-null}"
  [ -z "${PANEL_URL:-}" ] && return 0
  [ -z "${BACKUP_PING_SECRET:-}" ] && return 0

  # Powód to SUROWY komunikat błędu z Postgresa, więc może zawierać wszystko:
  # cudzysłowy, odwrotne ukośniki i — co mnie tu wywróciło — TABULATORY.
  # Surowy tabulator jest w JSON-ie niedozwolony, więc panel odrzucał cały
  # meldunek błędem 400 i na Pulpit dojeżdżał poprzedni, MYLĄCY powód.
  # Złapane 2026-07-20; komunikaty pg_dump zaczynają się od tabulatora.
  # Dlatego: najpierw znaki sterujące na spacje, dopiero potem escapowanie.
  _powod_json=$(printf '%s' "$_powod" \
    | tr '\n\r\t' '   ' \
    | sed 's/\\/\\\\/g; s/"/\\"/g; s/  */ /g')

  if ! curl -fsS -m 20 -X POST "$PANEL_URL/api/backup/ping" \
      -H "Authorization: Bearer $BACKUP_PING_SECRET" \
      -H "Content-Type: application/json" \
      -d "{\"ok\":$_ok,\"host\":\"$(cat /etc/hostname_host 2>/dev/null || hostname)\",\"powod\":\"$_powod_json\",\"tabel\":$_tabel,\"rozmiarBajtow\":$_rozmiar,\"trwaloSekund\":$_trwalo}" \
      >/dev/null 2>&1
  then
    log "UWAGA: nie udało się zameldować do panelu (kopia i tak jest zrobiona)."
  fi
}

wykonaj_kopie() {
  # Brakujące zmienne łapiemy TU, a nie przy starcie kontenera — inaczej
  # literówka w konfiguracji ubijałaby kontener w pętli restartów, zamiast
  # zostawić czytelny wpis w logu.
  START=$(date +%s)

  if [ -z "${DATABASE_URL_RO:-}" ]; then
    log "BŁĄD: brak DATABASE_URL_RO (adres bazy tylko-do-odczytu). Kopia pominięta."
    melduj false "Brak adresu bazy (DATABASE_URL_RO) w konfiguracji kontenera."
    return 1
  fi
  if [ -z "${HASLO_KOPII:-}" ]; then
    log "BŁĄD: brak HASLO_KOPII (hasło szyfrowania). Kopia pominięta."
    melduj false "Brak hasła szyfrowania (HASLO_KOPII) w konfiguracji kontenera."
    return 1
  fi

  mkdir -p "$KATALOG/dzienne" "$KATALOG/tygodniowe"

  ZNACZNIK="$(date '+%Y-%m-%d-%H%M')"
  ROBOCZY="$KATALOG/.robocza-$ZNACZNIK.sql.gz.enc"
  CEL="$KATALOG/dzienne/leggera-$ZNACZNIK.sql.gz.enc"

  # Nazwa maszyny w KAŻDYM przebiegu — jedyny sposób, żeby po miesiącach
  # jednym spojrzeniem stwierdzić, czy kopie robi NAS, czy przypadkiem Mac
  # (Docker jest na obu, a na Macu kopie powstają tylko gdy nie śpi).
  # Wewnątrz kontenera `hostname` zwraca jego IDENTYFIKATOR (np. 1b1e63fa6732),
  # co nic nie mówi i przekreśla sens kontroli „czy to chodzi na NAS-ie, czy
  # przypadkiem na Macu". Dlatego czytamy nazwę hosta podmontowaną z zewnątrz.
  log "Maszyna: $(cat /etc/hostname_host 2>/dev/null || hostname) | katalog: $KATALOG"
  log "Zrzucam bazę…"

  # Jeden potok: pg_dump → gzip → szyfrowanie. Dane NIGDY nie lądują na dysku
  # w postaci jawnej, nawet na chwilę — to ma znaczenie, bo NAS jest
  # kopiowany dalej i skasowany plik tymczasowy potrafi zostać na nośniku.
  #
  # `--no-owner --no-privileges`: kopia ma się odtwarzać na DOWOLNEJ bazie
  # (lokalnej, testowej), a nie tylko na koncie o tej samej nazwie co w Neonie.
  # Bez tego odtworzenie u siebie wywala się na nieistniejących rolach.
  # Błędy pg_dump łapiemy do pliku, żeby przekazać właścicielowi PRAWDZIWY
  # komunikat („password authentication failed…", „could not connect…"),
  # a nie ogólnik. To jest różnica między „coś nie działa" a „wiem, co
  # naprawić" — czyli cały sens tego meldunku.
  BLAD_PG="$KATALOG/.blad-$ZNACZNIK.txt"
  # `--schema=public` — zrzucamy WYŁĄCZNIE to, co należy do panelu.
  #
  # Bez tego pg_dump próbuje zrzucić wszystkie schematy, w tym `neon_auth`
  # (wbudowane logowanie Neona, włączane domyślnie przez integrację
  # z Vercelem). Konto kopia_ro nie ma tam praw, więc CAŁA kopia padała na
  # `permission denied for schema neon_auth` — złapane przy pierwszym
  # uruchomieniu na produkcji 2026-07-20.
  #
  # Sprawdzone gretem: panel NIE korzysta z neon_auth ani razu — ma własne
  # uwierzytelnianie (ADMIN_PASSWORD + tabela device_tokens w `public`).
  # Gdyby to się kiedyś zmieniło, ten przełącznik trzeba będzie zmienić,
  # inaczej kopia po cichu pominie dane logowania.
  if ! pg_dump "$DATABASE_URL_RO" \
        --schema=public \
        --no-owner --no-privileges --format=plain 2>"$BLAD_PG" \
      | gzip -9 \
      | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
          -pass env:HASLO_KOPII -out "$ROBOCZY"
  then
    SZCZEGOL=$(tr -d '\r' < "$BLAD_PG" 2>/dev/null | grep -v '^$' | tail -2 | tr '\n' ' ' | cut -c1-500)
    log "BŁĄD: zrzut bazy nie powiódł się. $SZCZEGOL"
    melduj false "Zrzut bazy nie powiódł się: ${SZCZEGOL:-brak szczegółów}. Sprawdź adres i hasło konta kopia_ro oraz połączenie NAS-a z internetem."
    rm -f "$ROBOCZY" "$BLAD_PG"
    return 1
  fi
  rm -f "$BLAD_PG"

  # Kontrola, że plik NAPRAWDĘ da się odczytać — a nie tylko że powstał.
  # Pusty albo ucięty plik waży swoje i wygląda jak kopia; różnicę widać
  # dopiero przy odtwarzaniu, czyli w najgorszym możliwym momencie.
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
        -pass env:HASLO_KOPII -in "$ROBOCZY" 2>/dev/null \
      | gzip -t 2>/dev/null
  then
    log "BŁĄD: powstały plik nie daje się odszyfrować lub jest uszkodzony. Nie zapisuję go jako kopii."
    melduj false "Powstały plik nie daje się odszyfrować — kopia odrzucona. Najczęściej: brak miejsca na dysku NAS-a."
    rm -f "$ROBOCZY"
    return 1
  fi

  # Sanity check na zawartość: zrzut bez ani jednej tabeli to nie jest kopia,
  # tylko pusty plik z poprawną strukturą (np. gdy konto tylko-do-odczytu nie
  # ma praw do schematu).
  TABEL=$(openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
            -pass env:HASLO_KOPII -in "$ROBOCZY" 2>/dev/null \
          | gzip -dc 2>/dev/null | grep -c '^CREATE TABLE' || true)
  if [ "$TABEL" -lt 1 ]; then
    log "BŁĄD: w zrzucie nie ma ANI JEDNEJ tabeli — sprawdź uprawnienia konta tylko-do-odczytu. Nie zapisuję."
    melduj false "Zrzut nie zawiera ani jednej tabeli — konto kopia_ro nie ma uprawnień do odczytu danych (krok 1 instrukcji)."
    rm -f "$ROBOCZY"
    return 1
  fi

  mv "$ROBOCZY" "$CEL"
  ROZMIAR=$(du -h "$CEL" | cut -f1)
  log "Kopia gotowa: $(basename "$CEL") ($ROZMIAR, tabel: $TABEL)"

  # W poniedziałek odkładamy egzemplarz na dłużej. Kopie dzienne wyłapują
  # „skasowałem coś wczoraj", tygodniowe — „coś się psuło od miesiąca
  # i zauważyłem dopiero teraz".
  if [ "$(date '+%u')" = "1" ]; then
    cp "$CEL" "$KATALOG/tygodniowe/leggera-$ZNACZNIK.sql.gz.enc"
    log "Odłożono kopię tygodniową."
  fi

  # Retencja. RODO: dane osobowe klientów nie mogą leżeć bezterminowo
  # „na wszelki wypadek" — dlatego stare kopie kasujemy, a nie zbieramy.
  find "$KATALOG/dzienne" -name 'leggera-*.enc' -type f -mtime "+$DNI_DZIENNYCH" -delete 2>/dev/null || true
  find "$KATALOG/tygodniowe" -name 'leggera-*.enc' -type f -mtime "+$((TYGODNI * 7))" -delete 2>/dev/null || true

  ILE_D=$(find "$KATALOG/dzienne" -name 'leggera-*.enc' -type f | wc -l | tr -d ' ')
  ILE_T=$(find "$KATALOG/tygodniowe" -name 'leggera-*.enc' -type f | wc -l | tr -d ' ')
  log "Stan: $ILE_D dziennych, $ILE_T tygodniowych."

  BAJTY=$(wc -c < "$CEL" | tr -d ' ')
  melduj true "Kopia OK: $TABEL tabel, $ILE_D dziennych, $ILE_T tygodniowych." \
    "$TABEL" "$BAJTY" "$(( $(date +%s) - START ))"
  return 0
}

# Tryb pętli — kontener chodzi non stop i sam budzi się o wyznaczonej
# godzinie. Świadomie BEZ crona: cron w kontenerze wymaga dodatkowego demona
# i cicho milczy, gdy coś jest nie tak. Tu każdy przebieg zostawia wpis
# w logu kontenera, który widać w panelu NAS-a.
if [ "${1:-}" = "--petla" ]; then
  GODZINA="${GODZINA_KOPII:-3}"
  log "Start. Kopia codziennie o godzinie $GODZINA:00. Katalog: $KATALOG"
  while true; do
    TERAZ_H=$(date '+%-H')
    TERAZ_M=$(date '+%-M')
    DO_PELNEJ=$(( (60 - TERAZ_M) % 60 ))
    GODZIN=$(( (GODZINA - TERAZ_H - 1 + 24) % 24 ))
    [ "$DO_PELNEJ" -eq 0 ] && GODZIN=$(( (GODZINA - TERAZ_H + 24) % 24 ))
    CZEKAJ=$(( GODZIN * 3600 + DO_PELNEJ * 60 ))
    [ "$CZEKAJ" -le 0 ] && CZEKAJ=86400
    log "Następna kopia za $((CZEKAJ / 3600))h $(((CZEKAJ % 3600) / 60))min."
    sleep "$CZEKAJ"
    # Błąd pojedynczego przebiegu NIE może ubić pętli — jutro spróbujemy
    # znowu. Kontener, który zniknął po jednej nieudanej próbie, to kolejny
    # sposób na „kopie działały, aż przestały i nikt nie zauważył".
    wykonaj_kopie || log "Przebieg nieudany — spróbuję ponownie jutro."
  done
fi

# Bez argumentu: jednorazowy przebieg (do testu i do ręcznego uruchomienia).
wykonaj_kopie
