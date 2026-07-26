#!/bin/sh
# Zadania cykliczne panelu — zamiennik `crons` z vercel.json (Moduł 55).
#
# Trzy te same godziny i te same trasy, co na Vercelu:
#   04:00  /api/leads/hunt/run      — Łowca leadów
#   06:00  /api/leads/notify        — poranny raport mailowy
#   08:00  /api/mail/outbox/run     — kolejka wysyłki poczty
#
# Każde wywołanie niesie `CRON_SECRET` — te trasy sprawdzają go zamiast sesji,
# bo woła je maszyna, nie zalogowany człowiek.
#
# Dlaczego własna pętla, a nie `crond` z Alpine: crond nie przekazuje zmiennych
# środowiskowych do zadań (klasyczna pułapka — zadanie odpala się i dostaje 401,
# bo `CRON_SECRET` jest puste), a rozwiązania tego problemu sprowadzają się do
# wpisywania sekretu do pliku crontab. Pętla widzi środowisko kontenera wprost.
set -eu

PANEL="${PANEL_URL:-http://panel:3000}"

zaloguj() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*"
}

wywolaj() {
  sciezka="$1"
  # `--max-time`: trasa, która się zawiesi, nie może zablokować pętli do
  # następnego dnia. `|| true` — nieudane zadanie loguje się i mija; panel ma
  # własny nadzór (Audyt 4), który zauważy, że coś nie chodzi.
  kod=$(wget -q -O /dev/null -S --timeout=300 \
    --header="Authorization: Bearer ${CRON_SECRET}" \
    "${PANEL}${sciezka}" 2>&1 | awk '/HTTP\//{print $2}' | tail -1) || true
  zaloguj "${sciezka} → ${kod:-brak odpowiedzi}"
}

zaloguj "zadania wystartowały, panel=${PANEL}"

# Sprawdzamy co minutę, czy wybiła któraś z godzin. Znacznik „ostatnio
# uruchomione" trzymamy w pamięci procesu — restart kontenera w ciągu dnia
# może więc powtórzyć zadanie. To świadomy wybór: wszystkie trzy trasy są
# idempotentne (raport wysyła się raz dziennie po dacie, kolejka poczty bierze
# tylko niewysłane, Łowca dedupuje kandydatów), a pominięcie zadania byłoby
# gorsze niż jego powtórzenie.
ostatnia_data=""
while true; do
  teraz=$(date '+%H:%M')
  dzis=$(date '+%Y-%m-%d')

  if [ "$dzis" != "$ostatnia_data" ]; then
    zrobione_hunt=0
    zrobione_notify=0
    zrobione_outbox=0
    ostatnia_data="$dzis"
  fi

  case "$teraz" in
    04:00) [ "$zrobione_hunt" = 0 ] && { wywolaj /api/leads/hunt/run; zrobione_hunt=1; } ;;
    06:00) [ "$zrobione_notify" = 0 ] && { wywolaj /api/leads/notify; zrobione_notify=1; } ;;
    08:00) [ "$zrobione_outbox" = 0 ] && { wywolaj /api/mail/outbox/run; zrobione_outbox=1; } ;;
  esac

  sleep 30
done
