#!/bin/bash
# Tworzy plik .env dla kopii zapasowych — po SPRAWDZENIU każdej wartości.
#
# Sedno: nic nie zapisujemy „na wiarę". Każdy z trzech sekretów jest
# weryfikowany na żywo, ZANIM trafi do pliku:
#   1. adres bazy — czy kopia_ro naprawdę się łączy i ile tabel widzi,
#   2. sekret meldunków — czy panel go przyjmuje,
#   3. hasło szyfrowania — czy nie jest puste.
#
# Powód jest praktyczny: bez tego literówka wychodzi dopiero o 3:00 nad ranem,
# w logu kontenera, którego nikt nie czyta. Lepiej dowiedzieć się teraz.
#
# Uruchamiasz na NAS-ie:
#   bash /volume1/docker/leggera-kopia-bazy/ustaw-env.sh
#
# Domyślnie wpisywane znaki są ukryte. WIDOCZNE=1 je pokazuje.
set -euo pipefail

KATALOG="$(cd "$(dirname "$0")" && pwd)"
OBRAZ="${OBRAZ:-leggera-kopia-bazy:1}"
PANEL="${PANEL_URL:-https://www.leggeralabs.pl}"
PLIK="$KATALOG/.env"

if [ "${WIDOCZNE:-0}" = "1" ]; then
  CZYTAJ="-rp"; echo "(tryb widoczny — wpisywane znaki będą pokazane)"; echo
else
  CZYTAJ="-rsp"
fi

# ── 1. Adres bazy tylko-do-odczytu ────────────────────────────────────────
echo "1) Adres bazy dla konta kopia_ro."
echo "   Weź adres produkcyjny z Vercela i podmień w nim TYLKO nazwę"
echo "   użytkownika i hasło na 'kopia_ro' oraz hasło z poprzedniego kroku."
echo "   Reszta (wszystko po znaku @) zostaje bez zmian."
read $CZYTAJ "   Wklej i naciśnij Enter: " DBURL; echo

# To samo sprzątanie co w zaloz-konto-ro.sh — Vercel kopiuje razem z nazwą
# zmiennej, a przy zaznaczaniu myszą łatwo złapać ją dwa razy.
DBURL="$(printf '%s' "$DBURL" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
while [[ "$DBURL" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do DBURL="${DBURL#*=}"; done
DBURL="${DBURL%\"}"; DBURL="${DBURL#\"}"
DBURL="${DBURL%\'}"; DBURL="${DBURL#\'}"

if [[ "$DBURL" != postgres://* && "$DBURL" != postgresql://* ]]; then
  echo "   BŁĄD: to nie wygląda na adres bazy (ma zaczynać się od 'postgres')."
  exit 1
fi
echo "   Wczytano: $(printf '%s' "$DBURL" | sed -E 's#(//[^:]+:)[^@]+(@)#\1****\2#')"

# Ostrzeżenie, nie błąd: właściciel MOŻE świadomie użyć innego konta, ale
# użycie konta produkcyjnego do kopii przekreśla sens całego rozdzielenia.
if [[ "$DBURL" != *"//kopia_ro:"* ]]; then
  echo
  echo "   UWAGA: w adresie nie widzę użytkownika 'kopia_ro'."
  echo "   Kopia miała chodzić kontem tylko-do-odczytu — konto produkcyjne"
  echo "   pozwalałoby skasować dane, gdyby NAS kiedyś został przejęty."
  read -rp "   Kontynuować mimo to? (wpisz tak) " ZGODA
  [ "$ZGODA" = "tak" ] || { echo "   Przerwane."; exit 1; }
fi

echo "   Sprawdzam połączenie…"
# `tr -d " "` odpada: przycinał też spacje w KOMUNIKATACH BŁĘDU, przez co
# „could not translate host name" wyświetlało się jako nieczytelne
# „couldnottranslatehostname". Przy diagnostyce liczy się czytelność —
# przycinamy więc tylko obramowanie, przez sed.
TABEL="$(docker run --rm -e DBURL="$DBURL" "$OBRAZ" \
  psql "$DBURL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1 \
  | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | head -3)" || true
if ! [[ "$TABEL" =~ ^[0-9]+$ ]]; then
  echo "   BŁĄD: nie udało się połączyć. Odpowiedź serwera:"
  printf '   %s\n' "$TABEL" | head -3
  echo "   Nic nie zapisano."
  exit 1
fi
echo "   Połączenie działa. Widocznych tabel: $TABEL"
echo

# ── 2. Hasło szyfrowania kopii ────────────────────────────────────────────
echo "2) Hasło szyfrowania kopii."
echo "   UWAGA: jego utrata = kopie są nieodwracalnie nieczytelne."
echo "   Zapisz je w menedżerze haseł ZANIM przejdziesz dalej."
read $CZYTAJ "   Wpisz i naciśnij Enter: " HASLO_KOPII; echo
[ -n "$HASLO_KOPII" ] || { echo "   BŁĄD: hasło nie może być puste."; exit 1; }
echo "   Wczytano hasło (${#HASLO_KOPII} znaków)."
echo

# ── 3. Sekret meldunków ───────────────────────────────────────────────────
echo "3) Sekret meldunków — ten sam, który wpisałeś w Vercelu"
echo "   jako BACKUP_PING_SECRET."
read $CZYTAJ "   Wklej i naciśnij Enter: " PING; echo
[ -n "$PING" ] || { echo "   BŁĄD: sekret nie może być pusty."; exit 1; }

echo "   Sprawdzam, czy panel go przyjmuje…"
KOD="$(docker run --rm -e PING="$PING" "$OBRAZ" \
  curl -s -o /dev/null -w '%{http_code}' -m 15 -X POST "$PANEL/api/backup/ping" \
    -H "Authorization: Bearer $PING" -H 'Content-Type: application/json' \
    -d '{"ok":true,"host":"proba-konfiguracji","powod":"Sprawdzenie sekretu przy konfiguracji."}' 2>/dev/null)"
case "$KOD" in
  200) echo "   Panel przyjął meldunek. Sekret poprawny." ;;
  401) echo "   BŁĄD: panel odrzucił sekret (401). Nie zgadza się z tym w Vercelu."
       echo "   Sprawdź, czy wkleiłeś tę samą wartość i czy zrobiłeś Redeploy."
       echo "   Nic nie zapisano."; exit 1 ;;
  500) echo "   BŁĄD: panel nie ma ustawionego BACKUP_PING_SECRET (500)."
       echo "   Dodaj zmienną w Vercelu i zrób Redeploy."
       echo "   Nic nie zapisano."; exit 1 ;;
  *)   echo "   BŁĄD: nieoczekiwana odpowiedź panelu (HTTP $KOD). Nic nie zapisano."; exit 1 ;;
esac
echo

# ── Zapis ─────────────────────────────────────────────────────────────────
# umask 077 PRZED utworzeniem pliku: gdyby ustawić uprawnienia po zapisie,
# istniałoby okno, w którym plik z sekretami jest czytelny dla innych.
( umask 077; cat > "$PLIK" <<EOF
DATABASE_URL_RO=$DBURL
HASLO_KOPII=$HASLO_KOPII
BACKUP_PING_SECRET=$PING
EOF
)

echo "─────────────────────────────────────────────────────────────"
echo "Zapisano $PLIK"
ls -l "$PLIK" | awk '{print "  uprawnienia: "$1"  wlasciciel: "$3}'
echo
echo "Wszystkie trzy wartości sprawdzone na żywo:"
echo "  • baza          — połączenie działa, widocznych tabel: $TABEL"
echo "  • hasło kopii   — ustawione (${#HASLO_KOPII} znaków)"
echo "  • sekret panelu — panel przyjął meldunek"
echo
echo "Możesz teraz uruchomić kontener."
echo "─────────────────────────────────────────────────────────────"
