# Handoff — kontynuacja pracy nad panelem, stan na 2026-07-12

Plik tymczasowy — wklej jako pierwszą wiadomość w nowym czacie, potem można
go usunąć (pamięć Claude ma to samo zapisane na trwałe, ten plik to tylko
szybki punkt startowy). Pełny opis funkcjonalności: `HUB_SETUP.md`.

## Stan: kod gotowy lokalnie, NIEZACOMMITOWANY

Faza I (e-podpis akceptacji oferty na publicznej stronie `/oferta/[token]`)
zbudowana i przetestowana lokalnie (przeglądarka, PGlite) w tej sesji, po
Fazie G (Koszty) i Fazie H (ważony pipeline + link do klienta). `npx tsc
--noEmit` czysty. Zmiany jeszcze nie są w git — nowe pliki `lib/offerAccept.ts`,
`app/api/offers/public/[token]/accept/route.ts`, zmiany w `lib/db.ts`,
`lib/offers.ts`, `app/api/offers/[id]/accept/route.ts`, `OfferPrint.tsx`,
`OfferEditor.tsx`. **Zapytaj właściciela, czy commitować i pushować** (usuń
najpierw `.git/index.lock`, jeśli obecny).

## Co zrobiono w tej sesji

- **Faza G — Koszty/wydatki + rentowność** — ✅ zacommitowane (`0ad4716`).
- **Faza H — Ważony pipeline + link do klienta** — ✅ zacommitowane (`60412d9`).
- **Faza I — e-podpis akceptacji oferty** (patrz pamięć
  `virtual-company-roadmap` dla pełnych szczegółów). Świadomie zawężony
  zakres — formularz akceptacji na istniejącej stronie `/oferta/[token]`,
  NIE pełny portal klienta z osobnym logowaniem (potwierdzone z
  właścicielem). Przetestowane end-to-end.

## Gdzie jesteśmy w planie

Wszystkie fazy z pierwotnej mapy drogowej (A–I) są zrobione. Jedyna
odłożona pozycja:

- **Faza D (Mail)** — odłożone "do przemyślenia na nowo" jeszcze przed
  Fazą F. Po Fazach F/G/H/I większość pierwotnych potrzeb (wysyłka ofert/
  faktur, przypomnienia, teraz e-podpis) jest już załatwiona bez pełnej
  skrzynki OAuth. **Pierwsza rzecz do zrobienia w nowym czacie: zapytać
  właściciela, czy jest jeszcze coś w "Mailu", co realnie brakuje, czy
  panel może wejść w tryb utrzymania/dopracowywania szczegółów zamiast
  kolejnej dużej fazy.**

## Zasady na przyszłość (nie renegocjować bez wyraźnego powodu)

- **Mentor, nie tylko baza danych** — każda nowa funkcja: "czy to pomaga
  właścicielowi wiedzieć co robić dalej", nie tylko "czy dane się zapisują".
- **Miękkie podpowiedzi, nigdy twarde blokady.**
- **Bez AI/LLM w logice** — deterministyczne reguły, statyczne teksty.
- KSeF: przy każdej zmianie dotykającej faktur sprawdź, czy próg/przepisy
  się nie zmieniły (obowiązek już trwa, mikrofirmy mają zwolnienie do 10k
  zł/mies. tylko do końca 2026).

## Znane pułapki środowiska (pełna lista w `CLAUDE.md`)

- `.git/index.lock` — usuń przed commitem (`rm -f .git/index.lock`).
- Dev-baza PGlite resetuje się przy restarcie serwera dev — to normalne, nie
  błąd (dane testowe znikają, trzeba je odtworzyć).
- Konsola przeglądarki bywa cache'owana i pokazuje stare błędy kompilacji —
  ufaj `npx tsc --noEmit -p tsconfig.json`, nie historii konsoli. Podobnie
  pojedyncze 500-ki na endpointach w trakcie hot-reloadu Turbopacka to
  szum, nie realny błąd — jeśli się nie powtarzają po chwili, ignoruj.
- W repo równolegle może działać dev-server innego czatu — do podglądu
  wizualnego używaj `preview_start` z `{url: "http://localhost:3000/..."}`,
  nie `{name: "dev"}` (ten drugi próbuje odpalić nowy serwer i się wywala).
