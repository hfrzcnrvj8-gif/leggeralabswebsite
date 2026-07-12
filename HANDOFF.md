# Handoff — start dużego audytu panelu, stan na 2026-07-12

Plik tymczasowy — wklej jako pierwszą wiadomość w nowym czacie, potem można
go usunąć (pamięć Claude ma to samo zapisane na trwałe pod
`comprehensive-audit-plan`, ten plik to tylko szybki punkt startowy).
Pełny opis funkcjonalności: `HUB_SETUP.md` / `LEADS_SETUP.md`.

## Stan: wszystko zacommitowane i wypchnięte

`git status` czysty. Ostatni commit: `9e6076d` "Faza I: e-podpis
akceptacji oferty na publicznej stronie". `npx tsc --noEmit` czysty.
Wszystkie fazy z pierwotnej mapy drogowej (A–I) są ukończone — panel ma
dziś: Leady, Klienci (CRM), Oferty (z e-podpisem klienta), Faktury (pełna
księgowość: korekty, proformy, zaliczki, KSeF-licznik, NBP-kurs, faktury
cykliczne), Koszty (z rentownością projektu), Projekty (Linear-style),
Notatnik, Kalendarz, Pulpit prezesa z ważonym pipeline'em ofert.

## Zadanie na tę sesję: DUŻY AUDYT, cztery wymiary

Właściciel wprost zlecił kompleksowy przegląd całego panelu — **nic
jeszcze nie zostało z tego wykonane**, to zlecenie na start, nie
podsumowanie. Pełny opis w pamięci `comprehensive-audit-plan` (powinna się
automatycznie załadować). Cztery wymiary:

1. **Kod / optymalizacja** — czy wszystko napisane zgodnie z najwyższym
   standardem: architektura, duplikacja, wydajność zapytań SQL (N+1?
   brakujące indeksy?), typy, potencjalne błędy, martwy kod.
2. **Prawo / samodzielność** — czy z panelu "można naprawdę w pełni
   korzystać niezależnie od innych programów i mieć spokojną głowę".
   Szersze niż dotychczasowy audyt VAT/faktur (patrz niżej) — sprawdzić
   RODO/dane osobowe klientów, regulamin/politykę prywatności na stronie
   leggeralabs.pl, retencję danych, kompletność wymaganej dokumentacji
   księgowej.
3. **Konkurencja** — co robią najlepsze narzędzia w klasie (Fakturownia/
   inFakt/wFirma — ustalony punkt odniesienia, NIE SAP; ewentualnie lekkie
   CRM jak Pipedrive/HubSpot dla części sprzedażowej) — czego brakuje, co
   można ulepszyć.
4. **Automatyzacja i niezawodność** — co jeszcze zautomatyzować (WYŁĄCZNIE
   miękkie podpowiedzi, NIGDY twarde bramki, bez AI/LLM w logice — zasada
   ustalona i niepodlegająca renegocjacji bez wyraźnego powodu) i jak
   dojść do działania bezawaryjnego.

### Ważne zastrzeżenia PRZED rozpoczęciem

- **Nie duplikować wcześniejszego audytu bezpieczeństwa/zgodności**
  (2026-07-11/12, 26 poprawek: kurs NBP, numeracja faktur, blokada
  usuwania wystawionych faktur, KSeF fail-closed itd. — pełna lista w
  pamięci `virtual-company-roadmap`). Ten nowy audyt jest szerszy —
  sprawdzić, co POZA tamtym zostało pominięte.
- **Świadome decyzje produktowe z `CLAUDE.md` to NIE luki do naprawienia**
  — panel jest celowo jednoosobowy (brak ról/wielu użytkowników), bez AI w
  logice, z emoji zamiast ikon, Linear-inspired ale NIE 1:1. Jeśli audyt
  "konkurencji" znajdzie coś, co koliduje z tymi decyzjami, flagować jako
  "do rozważenia i decyzji właściciela", nie proponować wprost jako
  poprawkę.
- **Zero prawdziwych klientów w produkcji na 2026-07-12** — dobry moment
  na audyt prawny, zanim wejdą realne dane.
- Właściciel jest **nietechniczny** — każda znaleziona poprawka musi być
  wyjaśniona zrozumiale, bez żargonu, żeby mógł świadomie zdecydować o
  priorytetach.

### Sugerowane podejście

Cztery wymiary są rozłączne — dobry kandydat na kilka równoległych
wyspecjalizowanych agentów (wzorem poprzedniego audytu bezpieczeństwa,
który użył 4 równoległych agentów), a potem jedna zbiorcza, priorytetowana
lista do przedyskutowania z właścicielem PRZED wdrożeniem — to duży
zakres, nie wdrażać automatycznie bez potwierdzenia priorytetów.

## Znane pułapki środowiska (pełna lista w `CLAUDE.md`)

- `.git/index.lock` — usuń przed commitem (`rm -f .git/index.lock`).
- Dev-baza PGlite resetuje się przy restarcie serwera dev — to normalne,
  nie błąd (dane testowe znikają, trzeba je odtworzyć).
- Konsola przeglądarki bywa cache'owana i pokazuje stare błędy kompilacji
  — ufaj `npx tsc --noEmit -p tsconfig.json`, nie historii konsoli.
  Podobnie pojedyncze 500-ki na endpointach w trakcie hot-reloadu
  Turbopacka to szum, nie realny błąd — jeśli się nie powtarzają po
  chwili, ignoruj.
- W repo równolegle może działać dev-server innego czatu — do podglądu
  wizualnego używaj `preview_start` z `{url: "http://localhost:3000/..."}`,
  nie `{name: "dev"}` (ten drugi próbuje odpalić nowy serwer i się wywala).
