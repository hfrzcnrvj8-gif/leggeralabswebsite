# Obraz do kopii zapasowych: postgres:17 + `curl`.
#
# Po co własny obraz zamiast gołego `postgres:17`. Sprawdzone uruchomieniem
# 2026-07-20, nie założone:
#
#   - `postgres:17` ma `pg_dump`, `psql`, `openssl`, `gzip` — czyli wszystko
#     do zrobienia i odszyfrowania kopii,
#   - ale NIE MA ani `curl`, ani `wget`, więc meldunek do panelu („kopia się
#     udała / nie udała, oto powód") po cichu nigdy by nie doszedł,
#   - `perl` z `HTTP::Tiny` jest, ale bez `IO::Socket::SSL`, więc nie umie
#     HTTPS — a panel jest wyłącznie po HTTPS.
#
# Wariant `postgres:17-alpine` odpada z innego powodu: nie ma w nim `openssl`,
# więc szyfrowanie kopii by nie zadziałało.
#
# Dokładamy więc jedną rzecz, przy budowaniu (raz), a nie przy każdym starcie
# kontenera — instalacja w entrypoincie wymagałaby internetu za każdym razem
# i cicho psułaby meldunki przy pierwszej awarii repozytoriów Debiana.
FROM postgres:17

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
