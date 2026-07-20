#!/bin/sh
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
set -eu

KATALOG="${KATALOG_KOPII:-/kopie}"
DNI_DZIENNYCH="${DNI_DZIENNYCH:-7}"
TYGODNI="${TYGODNI:-4}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

wykonaj_kopie() {
  # Brakujące zmienne łapiemy TU, a nie przy starcie kontenera — inaczej
  # literówka w konfiguracji ubijałaby kontener w pętli restartów, zamiast
  # zostawić czytelny wpis w logu.
  if [ -z "${DATABASE_URL_RO:-}" ]; then
    log "BŁĄD: brak DATABASE_URL_RO (adres bazy tylko-do-odczytu). Kopia pominięta."
    return 1
  fi
  if [ -z "${HASLO_KOPII:-}" ]; then
    log "BŁĄD: brak HASLO_KOPII (hasło szyfrowania). Kopia pominięta."
    return 1
  fi

  mkdir -p "$KATALOG/dzienne" "$KATALOG/tygodniowe"

  ZNACZNIK="$(date '+%Y-%m-%d-%H%M')"
  ROBOCZY="$KATALOG/.robocza-$ZNACZNIK.sql.gz.enc"
  CEL="$KATALOG/dzienne/leggera-$ZNACZNIK.sql.gz.enc"

  # Nazwa maszyny w KAŻDYM przebiegu — jedyny sposób, żeby po miesiącach
  # jednym spojrzeniem stwierdzić, czy kopie robi NAS, czy przypadkiem Mac
  # (Docker jest na obu, a na Macu kopie powstają tylko gdy nie śpi).
  log "Maszyna: $(hostname) | katalog: $KATALOG"
  log "Zrzucam bazę…"

  # Jeden potok: pg_dump → gzip → szyfrowanie. Dane NIGDY nie lądują na dysku
  # w postaci jawnej, nawet na chwilę — to ma znaczenie, bo NAS jest
  # kopiowany dalej i skasowany plik tymczasowy potrafi zostać na nośniku.
  #
  # `--no-owner --no-privileges`: kopia ma się odtwarzać na DOWOLNEJ bazie
  # (lokalnej, testowej), a nie tylko na koncie o tej samej nazwie co w Neonie.
  # Bez tego odtworzenie u siebie wywala się na nieistniejących rolach.
  if ! pg_dump "$DATABASE_URL_RO" \
        --no-owner --no-privileges --format=plain \
      | gzip -9 \
      | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
          -pass env:HASLO_KOPII -out "$ROBOCZY"
  then
    log "BŁĄD: zrzut bazy nie powiódł się."
    rm -f "$ROBOCZY"
    return 1
  fi

  # Kontrola, że plik NAPRAWDĘ da się odczytać — a nie tylko że powstał.
  # Pusty albo ucięty plik waży swoje i wygląda jak kopia; różnicę widać
  # dopiero przy odtwarzaniu, czyli w najgorszym możliwym momencie.
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
        -pass env:HASLO_KOPII -in "$ROBOCZY" 2>/dev/null \
      | gzip -t 2>/dev/null
  then
    log "BŁĄD: powstały plik nie daje się odszyfrować lub jest uszkodzony. Nie zapisuję go jako kopii."
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
