# Handoff — kontynuacja pracy nad panelem, stan na 2026-07-12

Plik tymczasowy — wklej jako pierwszą wiadomość w nowym czacie, potem można
go usunąć (pamięć Claude ma to samo zapisane na trwałe, ten plik to tylko
szybki punkt startowy). Pełny opis funkcjonalności: `HUB_SETUP.md`.

## Stan: kod gotowy lokalnie, NIEZACOMMITOWANY

Faza H (ważony pipeline ofert + link do karty klienta z edytorów) zbudowana
i przetestowana lokalnie (przeglądarka, PGlite) w tej sesji, zaraz po Fazie
G (moduł Koszty). `npx tsc --noEmit` czysty. Zmiany jeszcze nie są w git —
`git status` pokaże zmiany w `lib/offers.ts`, `app/api/hub/today/route.ts`,
`app/[lang]/admin/DashboardHome.tsx`, `app/[lang]/admin/offers/
OffersDashboard.tsx`, `app/[lang]/admin/offers/OfferEditor.tsx`,
`app/[lang]/admin/invoices/InvoiceEditor.tsx`, `app/[lang]/admin/projects/
ProjectDetailPanel.tsx`, `app/[lang]/admin/components.tsx`. **Zapytaj
właściciela, czy commitować i pushować** (usuń najpierw `.git/index.lock`,
jeśli obecny).

## Co zrobiono w tej sesji

**Faza G — Koszty/wydatki + rentowność** (patrz pamięć
`virtual-company-roadmap` dla szczegółów) — ✅ zacommitowane i wypchnięte
(`0ad4716`).

**Faza H — Ważony pipeline + link do klienta.** `OFFER_STATUS_WEIGHT` w
`lib/offers.ts` (Szkic 20%, Wysłana 50%) — Pulpit i Oferty pokazują tę samą
ważoną liczbę pipeline'u. Nowy `ClientLinkChip` w `components.tsx` — link
"→ Karta klienta" w edytorze oferty/faktury i na karcie projektu.
Przetestowane end-to-end.

## Gdzie jesteśmy w planie

- Fazy A–G + audyt bezpieczeństwa — ✅ zrobione
- **Faza H (ważony pipeline + link do klienta) — ✅ (właśnie dokończone, do
  commitowania)**
- Faza D (Mail) — odłożone do przemyślenia na nowo
- **Faza I (portal klienta + e-podpis akceptacji oferty) — NASTĘPNA,
  jeszcze nie zaczęta**

## Pierwsza rzecz do zrobienia w nowym czacie

1. Jeśli właściciel jeszcze nie potwierdził commitowania Fazy H — zapytać.
2. Potem zapytać, czy zaczynamy **Fazę I** zgodnie z ustaloną kolejnością.

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
