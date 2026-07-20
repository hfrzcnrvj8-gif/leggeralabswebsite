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

# Domyślnie wpisywane znaki są UKRYTE (jak przy haśle) — to bezpieczniejsze,
# bo sekret nie zostaje w historii przewijania terminala.
#
# Ale wpisywanie na ślepo bywa mylące („czy w ogóle się wkleiło?"), a mylące
# = podatne na błąd. Dlatego jest przełącznik: WIDOCZNE=1 pokazuje znaki.
# Świadomie NIE odwrotnie — domyślnie chronimy sekret, a widoczność włącza
# się jawnie, gdy właściciel wie, że nikt nie patrzy na ekran.
if [ "${WIDOCZNE:-0}" = "1" ]; then
  CZYTAJ="-rp"
  echo "(tryb widoczny — wpisywane znaki będą pokazane na ekranie)"
  echo
else
  CZYTAJ="-rsp"
fi

echo "Zakładanie konta tylko-do-odczytu dla kopii zapasowych."
echo
echo "1) Adres bazy PRODUKCYJNEJ."
echo "   Vercel → projekt → Settings → Environment Variables → DATABASE_URL"
echo "   → pokaż wartość i skopiuj CAŁOŚĆ (zaczyna się od 'postgres')."
read $CZYTAJ "   Wklej i naciśnij Enter: " DBURL; echo

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
# Hasło zastępujemy gwiazdkami — reszta wystarczy, żebyś rozpoznał swój adres,
# a taki wiersz da się bezpiecznie pokazać komuś do pomocy.
ZAMASKOWANY="$(printf '%s' "$DBURL" | sed -E 's#(//[^:]+:)[^@]+(@)#\1****\2#')"
echo "   Wczytano: $ZAMASKOWANY"

# Rozbiór końcówki adresu (część po znaku zapytania). Błąd
# `extra key/value separator "=" in URI query parameter` znaczy, że któryś
# parametr ma DWA znaki równości — najczęściej skutek kopiowania z miejsca,
# które dokleiło coś od siebie. Zamiast zostawić właściciela z surowym
# komunikatem psql, mówimy dokładnie, KTÓRY parametr jest zepsuty.
CZESC_PYTAJNA="${DBURL#*\?}"
if [ "$CZESC_PYTAJNA" != "$DBURL" ]; then
  ZLE=0
  IFS='"'"'&'"'"' read -ra PARAMY <<< "$CZESC_PYTAJNA"
  for PAR in "${PARAMY[@]}"; do
    ILE_ROWNA="$(printf '%s' "$PAR" | tr -cd '"'"'='"'"' | wc -c | tr -d '"'"' '"'"')"
    if [ "$ILE_ROWNA" -ne 1 ]; then
      echo "   BŁĄD: parametr \"$PAR\" ma $ILE_ROWNA znaków '"'"'='"'"' zamiast jednego."
      ZLE=1
    fi
  done
  if [ "$ZLE" = "1" ]; then
    echo
    echo "   Adres jest zniekształcony na końcu. Najpewniej kopiowanie z Vercela"
    echo "   dokleiło coś od siebie."
    echo
    echo "   Co zrobić: w Vercelu kliknij przy DATABASE_URL ikonę OKA (Show value),"
    echo "   dopiero potem zaznacz myszą SAM adres — od 'postgres' do końca —"
    echo "   i skopiuj. Nie używaj przycisku kopiowania całego wiersza."
    exit 1
  fi
fi
echo
echo "2) Hasło dla NOWEGO konta kopia_ro."
echo "   Wymyśl długie i od razu zapisz w menedżerze haseł — będzie"
echo "   potrzebne za chwilę w pliku .env."
read $CZYTAJ "   Wpisz i naciśnij Enter: " HASLO_RO; echo
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
