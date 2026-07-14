# Moduł 18 — Pulpit: wskaźniki zdrowia biznesu

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Jak sprawdzić, że CAŁY system działa jak należy" i "Poprzeczne: Pulpit
> jako czy jestem na dobrej drodze".
>
> **Rób ten moduł na końcu** (po 11-17, 19-20) — wskaźniki mają sens
> dopiero, gdy dane, które agregują, w ogóle istnieją (np. % opinii
> zebranych wymaga Modułu 15, DSO/wiek zaległości korzysta z rozbudowanej
> windykacji z Modułu 13).

## Kontekst (żeby nie zaczynać od zera)

Właściciel chce, żeby aplikacja **monitorowała**, czy trzyma się
wypracowanego wzorca pracy, nie tylko go egzekwowała krok po kroku. Dziś
Pulpit (`app/api/hub/today`) pokazuje "co dziś" (zaległości, terminy), ale
nie pokazuje trendów/wskaźników zdrowia całej działalności.

## Stan faktyczny (co już jest — nie budować od zera)

- `app/api/hub/today/route.ts:44-100` — agreguje: przeterminowane leady/
  klientów, projekty z minionym terminem, kamienie po terminie, dzisiejsze
  wydarzenia kalendarza, 5 ostatnich notatek, faktury (do wyliczeń
  zaległości/szkiców), oferty (do wygasłych), due follow-upy, plus
  podstawowe KPI przychodu/pipeline.
- `DashboardHome.tsx` — renderuje te listy, część z linkami do źródła
  (patrz Moduł 12 dla ujednolicenia linkowania).
- Dane źródłowe do nowych wskaźników **już istnieją** w bazie (nie trzeba
  nowych tabel, tylko agregujących zapytań):
  - `zrodlo_kategoria` na leadach → % konwersji per źródło.
  - `created_at`/`updated_at` na leadach/ofertach → czas do pierwszej
    odpowiedzi, czas do akceptacji oferty.
  - `zdrowie` na projektach (`Na dobrej drodze/Zagrożony/Zerwany`) →
    rozkład statusów.
  - `data_platnosci`/`termin_platnosci` na fakturach → DSO, wiek
    zaległości (dokładniej po Module 13).

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Który zestaw wskaźników na start** — pełna lista z mapy drogi (czas
   odpowiedzi, konwersja, zdrowie projektów, DSO, wiek zaległości, % opinii,
   % poleceń) czy węższy wybór na pierwszą iterację?
2. **Gdzie w UI** — nowa sekcja na istniejącym Pulpicie, czy osobna
   podstrona "Statystyki"/"Zdrowie biznesu"?
3. **Okres** — wskaźniki liczone za jaki zakres domyślnie (bieżący
   miesiąc? kwartał? od początku działalności?), z możliwością zmiany
   zakresu?
4. **Wizualizacja** — liczby/karty (jak dziś KPI w Kosztach) czy wykresy
   trendu w czasie (jak `SpendTrendChart` z Modułu 9)? Jeśli wykresy —
   **przeczytaj skill `dataviz` przed pisaniem jakiegokolwiek kodu wykresu**
   (paleta, dostępność, reguły formy).

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Zero AI/LLM w logice — to zwykłe agregacje SQL.
- Design system: `.card-paper`, paleta marki.
- `npx tsc --noEmit` po każdej paczce zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej. Minimum: właściciel widzi na Pulpicie, bez liczenia ręcznie, czy
kluczowe wskaźniki z mapy drogi klienta poprawiają się czy pogarszają.
