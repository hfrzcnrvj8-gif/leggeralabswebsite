# Plany modułów — kolejne kroki panelu (po audycie przepływów 2026-07-13)

Ten folder to zestaw **briefów wdrożeniowych**, po jednym na moduł. Każdy moduł
robimy w **osobnym czacie**, żeby zaczynać ze świeżym kontekstem. Plik danego
modułu jest samowystarczalny — nowy czat nie musi znać poprzednich rozmów.

## Jak używać (dla właściciela)

1. Otwórz nowy czat z Claude Code w tym repo.
2. Wklej polecenie w stylu:
   > „Zrób moduł opisany w `docs/plany-modulow/01-podpowiedzi-leadow.md`.
   > Najpierw przeczytaj ten plik i CLAUDE.md, potem zaproponuj plan i zapytaj
   > o otwarte decyzje, dopiero potem buduj."
3. Na końcu czatu, jak zawsze:
   `rm -f .git/index.lock && git add -A && git commit && git push`.

## Kolejność (rekomendowana)

Od najprostszego i najbardziej „domykającego proces" do największego:

| # | Moduł | Rozmiar | Plik |
|---|-------|---------|------|
| 1 | Podpowiedzi dla leadów + mapa procesu (⑤) | mały | [01-podpowiedzi-leadow.md](01-podpowiedzi-leadow.md) |
| 2 | Nurture — automatyczne przypomnienia po zamknięciu (⑥) | mały/średni | [02-nurture-automatyczny.md](02-nurture-automatyczny.md) |
| 3 | Kanały kontaktu — telefon/WhatsApp/LinkedIn (⑦a) | średni | [03-kanaly-kontaktu.md](03-kanaly-kontaktu.md) |
| 4 | Skrzynka mailowa dwukierunkowa — OAuth (⑦b) | duży | [04-skrzynka-mailowa.md](04-skrzynka-mailowa.md) |

Moduły 1–3 są niezależne — można je robić w dowolnej kolejności. Moduł 4 jest
największy i wymaga osobnej decyzji o rejestracji aplikacji Google/Microsoft;
warto go robić na końcu.

## Zasady wspólne dla WSZYSTKICH modułów (nie łamać bez pytania)

Zebrane z `CLAUDE.md` i pamięci projektu — każdy czat MUSI ich przestrzegać:

- **Panel jednoosobowy** — jedno hasło, brak ról/wielu użytkowników. To świadomy
  wybór, nie luka.
- **Zero AI/LLM w logice** przypominaczy i podpowiedzi — wyłącznie deterministyczne
  reguły i statyczny tekst zapisany w kodzie.
- **Tylko miękkie podpowiedzi, nigdy twarde bramki** — nic nie może blokować
  właścicielowi przejścia dalej. Podpowiedź informuje, nie zabrania.
- **Właściciel nie czyta kodu** — każdą decyzję nietechniczną zadaj wprost przez
  pytanie; nie zakładaj domyślnych wartości tam, gdzie liczy się preferencja.
- **Design system**: `.card-paper`, `.glass` (tylko chrome), `.hairline`,
  `.btn-primary` (jedno CTA/widok), paleta marki (`brand.purple/pink/gold/cyan`),
  emoji zamiast ikon. `useUI()` (`toast/confirm/prompt`), nigdy `window.*`.
- **Baza**: migracje idempotentne w `lib/db.ts` (`CREATE TABLE IF NOT EXISTS` /
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), nigdy ręczne migracje. Klient
  `neon()` zwraca zwykłe tablice, nie `{rows}`.
- **Daty** przez `isPlausibleDateString()` (walidacja) i `formatPlDate()`
  (wyświetlanie), „dziś" przez `todayLocalISO()` (`lib/dates.ts`, strefa
  Europe/Warsaw) — nigdy surowy string/ISO ani `new Date()` do porównań dnia.
- **Każdy admin API route** zaczyna od `if (!(await isAuthed())) return 401`.
- **Weryfikacja**: `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian
  (pełny `next build` failuje w sandboxie). Podgląd wizualny lokalnie:
  `preview_start name:"dev"` (PGlite + dev-login, patrz `CLAUDE.md` → „Lokalne
  środowisko dev").

## Kontekst: co już jest zrobione (żeby nie budować od zera)

Pełny cykl życia leada działa end-to-end:
lead → (oferta = auto-klient) → akceptacja (atomowo: projekt + faktura-szkic,
lead → „Zamknięte - sukces") → realizacja (kamienie/zadania) → wystawienie faktury
→ płatności (częściowe, auto-„Opłacona") → automatyczne przypomnienia o
zaległościach (cron dzienny) → oś czasu klienta scalająca wszystkie zdarzenia.

Pulpit (`app/api/hub/today`) agreguje „co dziś": leady, klienci, projekty,
kamienie po terminie, zaległe faktury, faktury-szkice do wystawienia, wygasłe
oferty, kalendarz z nakładką realnych terminów. Mail dzienny (`app/api/leads/notify`,
cron 06:00) raportuje to samo + wysyła przypomnienia + generuje faktury cykliczne.

**Moduły w tym folderze to trzy luki świadomie odłożone podczas audytu 2026-07-13**
(⑤ mentor nierówny, ⑥ nurture ręczny, ⑦ komunikacja jednokanałowa) — nie nowe
pomysły, tylko domknięcie procesu.
