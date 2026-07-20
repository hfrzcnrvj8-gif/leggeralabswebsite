#!/bin/bash
# Zakłada w bazie konto TYLKO-DO-ODCZYTU dla kopii zapasowych.
#
# Droga zapasowa wobec konsoli Neona — potrzebna, gdy nie da się do niej
# wejść. U nas 2026-07-20: Neon żąda potwierdzenia adresu e-mail, a konto
# Vercela ma adres-pośrednik Apple („Ukryj mój e-mail") utworzony dla
# GitHuba, który nie przyjmuje poczty od innych nadawców — więc mail
# weryfikacyjny nie miał jak dojść.
#
# Uruchamiasz RAZ, na NAS-ie:
#   bash /volume1/docker/leggera-kopia-bazy/zaloz-konto-ro.sh
#
# Skrypt pyta o dwie rzeczy i NIE zapisuje ich nigdzie — ani w pliku, ani
# w historii poleceń. Wpisywane znaki nie pokazują się na ekranie.
set -euo pipefail

KATALOG="$(cd "$(dirname "$0")" && pwd)"
OBRAZ="${OBRAZ:-leggera-kopia-bazy:1}"

if [ ! -f "$KATALOG/konto-ro.sql" ]; then
  echo "BŁĄD: brak pliku konto-ro.sql obok skryptu ($KATALOG)."
  exit 1
fi

echo "Zakładanie konta tylko-do-odczytu dla kopii zapasowych."
echo
echo "1) Adres bazy PRODUKCYJNEJ."
echo "   Vercel → projekt → Settings → Environment Variables → DATABASE_URL"
echo "   → pokaż wartość i skopiuj CAŁOŚĆ (zaczyna się od 'postgres')."
read -rsp "   Wklej i naciśnij Enter: " DBURL; echo

# Vercel kopiuje zmienne środowiskowe RAZEM Z NAZWĄ (`DATABASE_URL="postgres://…"`),
# a przy zaznaczaniu myszą łatwo złapać nazwę dwa razy. Pierwsza próba
# 2026-07-20 skończyła się błędem `invalid connection option
# "DATABASE_URLDATABASE_URL"` — czyli dokładnie tym.
#
# Zamiast wymagać idealnego wklejenia, sprzątamy to sami: cudzysłowy, spacje
# i dowolną liczbę przedrostków `NAZWA=` z przodu.
DBURL="$(printf '%s' "$DBURL" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
while [[ "$DBURL" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do
  DBURL="${DBURL#*=}"
done
DBURL="${DBURL%\"}"; DBURL="${DBURL#\"}"
DBURL="${DBURL%\'}"; DBURL="${DBURL#\'}"

# Sprawdzamy PRZED próbą połączenia i pokazujemy zamaskowany adres — żeby
# było widać, że cokolwiek się wkleiło (pole nie pokazuje znaków) i że
# wkleiło się to właściwe.
if [[ "$DBURL" != postgres://* && "$DBURL" != postgresql://* ]]; then
  echo "   BŁĄD: to nie wygląda na adres bazy — powinien zaczynać się od"
  echo "         'postgres://' albo 'postgresql://'."
  echo "         Skopiuj SAMĄ WARTOŚĆ, bez nazwy DATABASE_URL i bez cudzysłowów."
  exit 1
fi
# Hasło zastępujemy gwiazdkami — reszta wystarczy, żebyś rozpoznał swój adres.
echo "   Wczytano: $(printf '%s' "$DBURL" | sed -E 's#(//[^:]+:)[^@]+(@)#\1****\2#')"
echo
echo "2) Hasło dla NOWEGO konta kopia_ro."
echo "   Wymyśl długie i od razu zapisz w menedżerze haseł — będzie"
echo "   potrzebne za chwilę w pliku .env."
read -rsp "   Wpisz i naciśnij Enter: " HASLO_RO; echo
if [ -n "$HASLO_RO" ]; then
  echo "   Wczytano hasło (${#HASLO_RO} znaków)."
fi
echo

if [ -z "$DBURL" ] || [ -z "$HASLO_RO" ]; then
  echo "BŁĄD: obie wartości są wymagane. Nic nie zostało zmienione."
  exit 1
fi

echo "Łączę się z bazą…"

# Wartości idą do kontenera ZMIENNYMI ŚRODOWISKOWYMI, nie argumentami
# polecenia: argumenty są widoczne w liście procesów dla innych użytkowników
# maszyny, zmienne konkretnego procesu — nie.
#
# ON_ERROR_STOP=1: przy błędzie przerywamy, zamiast lecieć dalej i zostawić
# konto z połową uprawnień, które „prawie działa" — a to najgorszy możliwy
# stan, bo kopia by powstawała, tylko niekompletna.
docker run --rm \
  -e DBURL="$DBURL" \
  -e HASLO_RO="$HASLO_RO" \
  -v "$KATALOG/konto-ro.sql:/konto-ro.sql:ro" \
  "$OBRAZ" \
  bash -c 'psql "$DBURL" -v ON_ERROR_STOP=1 -v haslo="$HASLO_RO" -f /konto-ro.sql'

echo
echo "─────────────────────────────────────────────────────────────"
echo "Gotowe. Adres do pliku .env zbuduj z adresu produkcyjnego,"
echo "podmieniając TYLKO nazwę użytkownika i hasło:"
echo
echo "  postgresql://kopia_ro:TWOJE_NOWE_HASLO@<wszystko-po-znaku-@-z-oryginalu>"
echo
echo "Zachowaj z oryginału całą część po @ — host, nazwę bazy"
echo "i ?sslmode=require na końcu."
echo "─────────────────────────────────────────────────────────────"
