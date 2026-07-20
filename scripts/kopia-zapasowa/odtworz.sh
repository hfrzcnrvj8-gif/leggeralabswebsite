#!/bin/bash
# Odtworzenie bazy Leggera Hub z kopii (2026-07-20).
#
# **Ten plik jest równie ważny jak sama kopia.** Kopia, której nigdy nie
# odtworzyłeś, nie jest kopią — jest plikiem, co do którego masz nadzieję.
#
# Użycie (w tym samym kontenerze co kopia.sh):
#
#   odtworz.sh <plik.sql.gz.enc> <adres-bazy-docelowej>
#
# Adres docelowy to CELOWO argument, a nie zmienna środowiskowa: chodzi o to,
# żeby nie dało się przypadkiem odtworzyć kopii na produkcję jednym
# strzałem myszy. Domyślnie odtwarzaj do PUSTEJ bazy testowej i dopiero
# tam sprawdzaj, czy dane są kompletne.
set -eu

PLIK="${1:-}"
CEL="${2:-}"

if [ -z "$PLIK" ] || [ -z "$CEL" ]; then
  echo "Użycie: odtworz.sh <plik.sql.gz.enc> <adres-bazy-docelowej>"
  echo
  echo "Przykład (baza testowa w Dockerze):"
  echo "  odtworz.sh /kopie/dzienne/leggera-2026-07-20-0300.sql.gz.enc \\"
  echo "             postgresql://postgres:haslo@localhost:5432/test"
  exit 1
fi

if [ ! -f "$PLIK" ]; then
  echo "BŁĄD: nie ma pliku $PLIK"
  exit 1
fi

if [ -z "${HASLO_KOPII:-}" ]; then
  echo "BŁĄD: brak HASLO_KOPII — bez hasła kopii nie da się odszyfrować."
  exit 1
fi

# Ostrzeżenie jest tu po coś: odtworzenie DOKŁADA dane do wskazanej bazy,
# a przy istniejących tabelach skończy się błędami albo duplikatami.
case "$CEL" in
  *neon.tech*|*pooler*)
    echo "UWAGA: adres wygląda na PRODUKCYJNEGO Neona."
    echo "Odtwarzanie na produkcję nie jest tym, czego chcesz w 99% przypadków."
    printf "Wpisz DOKLADNIE 'tak-wiem-co-robie' aby kontynuować: "
    read -r POTWIERDZENIE
    [ "$POTWIERDZENIE" = "tak-wiem-co-robie" ] || { echo "Przerwane."; exit 1; }
    ;;
esac

echo "Odszyfrowuję i odtwarzam…"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:HASLO_KOPII -in "$PLIK" \
  | gzip -dc \
  | psql "$CEL" -v ON_ERROR_STOP=1 --quiet

echo "Gotowe. Sprawdź, czy dane są kompletne:"
echo "  psql \"$CEL\" -c '\\dt'"
