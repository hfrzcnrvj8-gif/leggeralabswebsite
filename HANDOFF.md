# Handoff — kontynuacja pracy nad panelem, stan na 2026-07-12

Plik tymczasowy — wklej jako pierwszą wiadomość w nowym czacie, potem można
go usunąć (pamięć Claude ma to samo zapisane na trwałe, ten plik to tylko
szybki punkt startowy). Pełny opis funkcjonalności: `HUB_SETUP.md`.

## Stan: kod gotowy lokalnie, NIEZACOMMITOWANY

Faza G (moduł Koszty + rentowność projektu) zbudowana i przetestowana
lokalnie (przeglądarka, PGlite) w tej sesji. `npx tsc --noEmit` czysty.
Zmiany jeszcze nie są w git — `git status` pokaże nowe/zmienione pliki
(`lib/costs.ts`, `app/api/costs/**`, `app/[lang]/admin/costs/**`,
`lib/db.ts`, `app/api/projects/[id]/route.ts`,
`app/[lang]/admin/projects/ProjectDetailPanel.tsx`,
`app/[lang]/admin/AppShell.tsx`). **Zapytaj właściciela, czy commitować i
pushować** (usuń najpierw `.git/index.lock`, jeśli obecny).

## Co zrobiono w tej sesji

**Faza G — Koszty/wydatki + rentowność.** Nowy moduł "Koszty" — ewidencja
faktur PRZYCHODZĄCYCH od dostawców (dostawca, kategoria, kwota
netto/VAT/brutto, status Nieopłacony/Opłacony z auto-datą płatności,
opcjonalny `project_id`). Świadomie: tylko PLN, bez uploadu załączników na
start. Widget "Rentowność" na karcie projektu (przychód netto z faktur −
koszty netto = zysk netto) z linkiem filtrującym listę kosztów po
projekcie. Szczegóły w pamięci `virtual-company-roadmap`.

## Gdzie jesteśmy w planie

- Fazy A–F + audyt bezpieczeństwa — ✅ dawno zrobione
- **Faza G (Koszty + rentowność) — ✅ (właśnie dokończone, do commitowania)**
- Faza D (Mail) — odłożone do przemyślenia na nowo
- **Faza H (ważony pipeline ofert + link do karty klienta wprost z edytora
  oferty/faktury/projektu) — NASTĘPNA, jeszcze nie zaczęta**
- Faza I (portal klienta + e-podpis akceptacji oferty)

## Pierwsza rzecz do zrobienia w nowym czacie

1. Jeśli właściciel jeszcze nie potwierdził commitowania Fazy G — zapytać.
2. Potem zapytać, czy zaczynamy **Fazę H** zgodnie z ustaloną kolejnością.

## Zasady na przyszłość (nie renegocjować bez wyraźnego powodu)

- **Mentor, nie tylko baza danych** — każda nowa faza: "czy to pomaga
  właścicielowi wiedzieć co robić dalej", nie tylko "czy dane się zapisują".
- **Miękkie podpowiedzi, nigdy twarde blokady.**
- **Bez AI/LLM w logice** — deterministyczne reguły, statyczne teksty.
- KSeF: przy każdej fazie dotykającej faktur sprawdź, czy próg/przepisy się
  nie zmieniły (obowiązek już trwa, mikrofirmy mają zwolnienie do 10k
  zł/mies. tylko do końca 2026).

## Znane pułapki środowiska (pełna lista w `CLAUDE.md`)

- `.git/index.lock` — usuń przed commitem (`rm -f .git/index.lock`).
- Dev-baza PGlite resetuje się przy restarcie serwera dev — to normalne, nie
  błąd (dane testowe znikają, trzeba je odtworzyć).
- Konsola przeglądarki bywa cache'owana i pokazuje stare błędy kompilacji —
  ufaj `npx tsc --noEmit -p tsconfig.json`, nie historii konsoli.
- W repo równolegle może działać dev-server innego czatu — do podglądu
  wizualnego używaj `preview_start` z `{url: "http://localhost:3000/..."}`,
  nie `{name: "dev"}` (ten drugi próbuje odpalić nowy serwer i się wywala).
