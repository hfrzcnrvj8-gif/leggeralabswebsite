#!/bin/bash
# Kopia POZA DOM — przeniesienie zaszyfrowanych paczek na dysk zewnętrzny
# (Moduł 55, 2026-07-26).
#
# Po co, skoro kopie już są. Bo do 2026-07-26 wszystkie stały w jednym miejscu:
# oryginał w Neonie (chmura), kopie na NAS-ie (dom). Po przeprowadzce panelu na
# NAS **oryginał i kopie lądują pod jednym dachem** — pożar, zalanie albo
# kradzież zabiera jedno i drugie naraz. Audyt 3 zapisał to jako otwartą
# usterkę; ten skrypt jest jej domknięciem.
#
# Zamysł jest prosty i celowo ręczny: podpinasz dysk, uruchamiasz, odpinasz
# i **wywozisz go z domu**. Kopia jest tak świeża, jak ostatnie podpięcie — i
# skrypt mówi Ci to wprost przy każdym uruchomieniu, żeby „mam kopię" nie
# oznaczało po cichu kopii sprzed pół roku.
#
# Pliki są JUŻ zaszyfrowane przez `kopia.sh` — tutaj nic się nie odszyfrowuje
# i hasło nie jest potrzebne. Zgubiony dysk to dla obcego zbiór szyfrogramów.
set -euo pipefail

KATALOG_KOPII="${KATALOG_KOPII:-/wolumin/kopie-leggera}"
DYSK="${1:-}"
# Ile paczek trzymać na dysku. Więcej niż na NAS-ie nie ma sensu, mniej niż
# kilka — nie chroni przed błędem zauważonym po tygodniu.
ILE_TRZYMAC="${ILE_TRZYMAC:-14}"

if [ -z "$DYSK" ]; then
  echo "Użycie: $0 /sciezka/do/dysku" >&2
  echo "Np.:   $0 /Volumes/KopiaLeggera" >&2
  exit 1
fi

if [ ! -d "$DYSK" ]; then
  echo "BŁĄD: nie widzę dysku pod '$DYSK'. Podepnij go i sprawdź ścieżkę." >&2
  exit 1
fi

# Zapisywalność sprawdzana JAWNIE, a nie „wyjdzie w praniu": dysk zamontowany
# tylko do odczytu (częste po niepoprawnym odpięciu) przyjąłby polecenie
# kopiowania i wywalił się w połowie, zostawiając plik ucięty.
if ! touch "$DYSK/.proba-zapisu" 2>/dev/null; then
  echo "BŁĄD: dysk '$DYSK' jest tylko do odczytu albo pełny." >&2
  exit 1
fi
rm -f "$DYSK/.proba-zapisu"

if [ ! -d "$KATALOG_KOPII" ]; then
  echo "BŁĄD: nie widzę katalogu kopii '$KATALOG_KOPII'." >&2
  echo "Ustaw KATALOG_KOPII na ten z kroku 4 w README.md." >&2
  exit 1
fi

CEL="$DYSK/leggera-kopie"
mkdir -p "$CEL"

# --- Ile miał już ten dysk i jak stara była najnowsza paczka ---------------
POPRZEDNIA=$(find "$CEL" -name '*.sql.gz.enc' -type f 2>/dev/null | sort | tail -1 || true)
if [ -n "$POPRZEDNIA" ]; then
  WIEK_DNI=$(( ( $(date +%s) - $(date -r "$POPRZEDNIA" +%s) ) / 86400 ))
  echo "Ostatnia kopia na tym dysku: $(basename "$POPRZEDNIA") — sprzed ${WIEK_DNI} dni."
else
  echo "Ten dysk nie ma jeszcze żadnej kopii."
fi

# --- Przeniesienie ---------------------------------------------------------
LICZBA=$(find "$KATALOG_KOPII" -name '*.sql.gz.enc' -type f | wc -l | tr -d ' ')
if [ "$LICZBA" -eq 0 ]; then
  echo "BŁĄD: w '$KATALOG_KOPII' nie ma ANI JEDNEJ paczki .sql.gz.enc." >&2
  echo "To znaczy, że codzienna kopia nie działa — napraw ją, zanim wywieziesz dysk." >&2
  exit 1
fi

echo "Kopiuję ${LICZBA} paczek…"
# `cp` zamiast `mv`: paczki mają ZOSTAĆ na NAS-ie. Dysk zewnętrzny jest drugą
# kopią, a nie przeprowadzką — wywiezienie jedynego egzemplarza z domu
# zamieniłoby jedno ryzyko na drugie.
find "$KATALOG_KOPII" -name '*.sql.gz.enc' -type f -exec cp -p {} "$CEL/" \;

# --- Sprawdzenie, że doszły w całości --------------------------------------
# Porównujemy ROZMIARY, nie samą obecność nazw. Przerwane kopiowanie zostawia
# plik o właściwej nazwie i uciętej treści — a taka kopia jest gorsza niż jej
# brak, bo się jej ufa.
BLEDY=0
while IFS= read -r zrodlo; do
  nazwa=$(basename "$zrodlo")
  if [ ! -f "$CEL/$nazwa" ]; then
    echo "  ✗ $nazwa — nie doszedł" >&2
    BLEDY=$((BLEDY + 1))
    continue
  fi
  a=$(wc -c < "$zrodlo" | tr -d ' ')
  b=$(wc -c < "$CEL/$nazwa" | tr -d ' ')
  if [ "$a" != "$b" ]; then
    echo "  ✗ $nazwa — rozmiar się nie zgadza ($a vs $b)" >&2
    BLEDY=$((BLEDY + 1))
  fi
done < <(find "$KATALOG_KOPII" -name '*.sql.gz.enc' -type f)

if [ "$BLEDY" -gt 0 ]; then
  echo "BŁĄD: ${BLEDY} paczek nie przeszło poprawnie. NIE wywoź tego dysku." >&2
  exit 1
fi

# --- Retencja na dysku -----------------------------------------------------
NA_DYSKU=$(find "$CEL" -name '*.sql.gz.enc' -type f | wc -l | tr -d ' ')
if [ "$NA_DYSKU" -gt "$ILE_TRZYMAC" ]; then
  DO_USUNIECIA=$((NA_DYSKU - ILE_TRZYMAC))
  find "$CEL" -name '*.sql.gz.enc' -type f | sort | head -n "$DO_USUNIECIA" | while read -r stary; do
    rm -f "$stary"
  done
  echo "Usunięto ${DO_USUNIECIA} najstarszych paczek (limit: ${ILE_TRZYMAC})."
fi

# `sync` przed komunikatem o sukcesie: bez tego system może jeszcze trzymać
# dane w pamięci, a Ty odpiąłbyś dysk z niepełnym zapisem.
sync

echo
echo "Gotowe. Na dysku: $(find "$CEL" -name '*.sql.gz.enc' -type f | wc -l | tr -d ' ') paczek."
echo
echo "TERAZ ODEPNIJ DYSK I WYWIEŹ GO Z DOMU."
echo "Kopia, która leży obok NAS-a, nie chroni przed pożarem ani kradzieżą —"
echo "a to jedyne dwa zdarzenia, przed którymi ta kopia w ogóle ma bronić."
