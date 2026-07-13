# Leggera Labs — leggeralabs.pl

Strona AI-automation consultancy Patryka + rozbudowany panel `/admin`
("Leggera Hub"), który z prostego rejestru leadów wyrósł w osobisty
"operating system" solo-przedsiębiorcy wzorowany na Linear: leady, projekty,
notatnik, kalendarz, wszystko w jednym miejscu.

Właściciel nie jest programistą — pracuje wyłącznie przez Claude (Cowork /
Claude Code), zawsze kończy sesję poleceniem `git commit && git push`
podanym przez Claude. Zakładaj, że NIE będzie samodzielnie czytał ani
poprawiał kodu — jeśli coś wymaga decyzji nietechnicznej, zapytaj wprost.

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v3
- Postgres przez `@neondatabase/serverless` (`neon()` HTTP client) — wiersze
  jako zwykłe tablice obiektów, NIE `{rows}` jak w node-postgres
- Deploy: Vercel, auto-deploy z GitHuba (branch `main`)
- Routing z prefiksem języka: `app/[lang]/...` (`i18n/config.ts`)
- framer-motion już jest w zależnościach — nie ma żadnej biblioteki ikon
  (świadoma decyzja: zamiast ikon używamy emoji, zostaw jak jest, chyba że
  właściciel wprost poprosi o zmianę)

## Autoryzacja i baza

- Custom auth na cookie (`lib/auth.ts`): `isAuthed()`, `checkPassword()`,
  token SHA-256. Każdy admin API route zaczyna się od
  `if (!(await isAuthed())) return 401`.
- Panel jest jednoosobowy — jedno hasło administratora, brak ról/wielu
  użytkowników. To świadome ograniczenie zakresu, nie luka do naprawienia.
- Schemat bazy tworzy się sam przy pierwszym użyciu (idempotentne migracje
  w `lib/db.ts`: `ensureLeadsSchema()`, `ensureHubSchema()`, każda z własnym
  cache'owanym promise). Nowe kolumny/tabele dodawaj przez
  `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
  w tych funkcjach — nigdy ręcznych migracji.
- Zmienne środowiskowe: `DATABASE_URL` (lub `POSTGRES_URL`),
  `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, opcjonalnie `RESEND_API_KEY` /
  `RESEND_FROM` / `CRON_SECRET` dla dziennego raportu mailowego.

## Architektura modułów panelu

Każdy moduł (`leads`, `projects`, `notes`, `calendar`) ma ten sam wzorzec:

- `lib/<moduł>.ts` — czysta logika bez `"use client"` (typy, stałe, funkcje
  pomocnicze), re-używana przez API routes i UI
- `app/[lang]/admin/<moduł>/shared.tsx` — `"use client"` re-export z
  `lib/<moduł>.ts` + komponenty specyficzne dla UI (np. `StatusTag`)
- `app/api/<moduł>/...` — REST-owe route'y, zawsze zaczynające się od
  sprawdzenia `isAuthed()`
- Widoki: Kanban/Tablica + alternatywny widok (Tabela dla leadów, Oś czasu
  dla projektów), peek panel (wysuwany z prawej) ORAZ osobna podstrona
  `[id]/page.tsx` dla bezpośrednich linków — obie renderują ten sam
  `*DetailPanel.tsx`/`*Detail.tsx` komponent
- **Wyjątek — Faktury/Oferty/Projekty**: edytor otwiera się jako wyśrodkowany
  modal (`InvoiceEditor.tsx`/`OfferEditor.tsx` w `InvoicesDashboard.tsx`/
  `OffersDashboard.tsx`/`ProjectsDashboard.tsx`), NIE jako wysuwany panel z
  prawej jak w Leadach. To świadoma decyzja, nie przeoczenie — te edytory
  mają dużo pól (daty, kwoty, pozycje, status dokumentu) i potrzebują
  szerszej, wyśrodkowanej przestrzeni; wąski panel z prawej byłby dla nich
  zbyt ciasny. Nie ujednolicaj tego bez wyraźnej prośby właściciela.

## Design system (trzymaj się tego)

- `.card-paper` — gęste karty z treścią (większość UI)
- `.glass` — zarezerwowane dla chrome (nagłówek, overlay peek panelu) — NIE
  nadużywać na zwykłych kartach
- `.hairline` — kolor obramowań, zgodny z motywem jasny/ciemny
- `.btn-primary` — tylko jedno główne CTA na widok, nie każdy przycisk
- `.text-liquid` — gradientowy tekst na nagłówki/akcenty
- Paleta marki (`tailwind.config.ts`): `brand.purple #7C3AED`,
  `brand.pink #E85D9E`, `brand.gold #E0A93B`, `brand.cyan #22D3EE` — używaj
  tych zamiast generycznych kolorów Tailwind, gdy dodajesz nowe akcenty
- `useUI()` (`app/[lang]/admin/ui.tsx`) daje `toast()`, `confirm()`,
  `prompt()` — NIGDY `window.confirm/alert/prompt`
- Globalna paleta poleceń (Cmd/Ctrl+K) + `useRegisterActions()` — każdy
  nowy moduł powinien zarejestrować swoją akcję „+ Dodaj X” z `id: "add"`
  (skrót `n`)

## Lokalne środowisko dev (KLUCZOWE — używaj do iteracji wizualnej)

Panel można oglądać i poprawiać LOKALNIE na żywo, bez deploya i bez hasła —
to jedyny sensowny sposób pracy nad wyglądem (koniec z „zmień → wypchnij →
czekaj na Vercel → zgaduj"):

- `npm run dev` startuje serwer. `.env.local` NIE ma `DATABASE_URL` ani
  `ADMIN_PASSWORD` (te żyją tylko w env Vercela), więc lokalnie działają dwa
  dev-only mechanizmy, oba niemożliwe do włączenia na produkcji:
  - **Dev-login** (`lib/auth.ts`): `isAuthed()` zwraca `true`, jeśli
    `NODE_ENV=development` **i** `DEV_ADMIN_BYPASS=1` (jest w `.env.local`).
    Bez tego logowanie na `http://localhost` i tak nie działa — cookie sesji
    ma `secure:true` (wymaga HTTPS).
  - **Dev-baza** (`lib/dev-db.ts`): gdy brak `DATABASE_URL` w trybie dev,
    `getSql()` używa PGlite (Postgres w WASM, w procesie) z danymi testowymi
    (`ensureSeeded()` — projekty z datami i kamieniami milowymi, leady,
    notatki, wydarzenia). Mówi prawdziwym SQL-em → route'y i migracje działają
    bez zmian, dane w 100% izolowane od produkcji. Zmiana schematu seeda:
    edytuj `ensureSeeded()` w `dev-db.ts`.
- Weryfikacja wizualna: narzędzia przeglądarki (`preview_start name:"dev"`,
  screenshot, `read_page`) — patrz zrzuty w tej sesji. NAJPIERW obejrzyj
  panel lokalnie, DOPIERO potem wnioski.

## Znane pułapki tego środowiska

- **`.git/index.lock`** — środowisko sandboxowe Claude regularnie zostawia
  stary lock po nieudanych próbach zapisu. Zawsze każ właścicielowi:
  `rm -f .git/index.lock` PRZED `git add -A && git commit && git push`.
- **Sandbox nie może `rm` plików** (`Operation not permitted`) — jeśli plik
  trzeba usunąć, nadpisz go `export {};` + komentarzem i poinstruuj
  właściciela, żeby usunął ręcznie przy okazji commitowania.
- **Brak dostępu do produkcyjnej bazy danych** z poziomu Claude — jeśli w
  danych jest błąd (np. zła data), trzeba go poprawić przez UI aplikacji,
  nie bezpośrednim zapytaniem SQL.
- **`<input type="date">` może zapisać niepełny rok** (np. "0202" zamiast
  "2026"), jeśli pole straci fokus w trakcie wpisywania. Każde nowe pole
  daty MUSI iść przez `isPlausibleDateString()` (walidacja klient + serwer)
  i wyświetlać się przez `formatPlDate()` (`lib/projects.ts`) — nigdy
  surowego stringa/ISO z bazy.
- `npx tsc --noEmit -p tsconfig.json` to jedyna realna weryfikacja w tym
  środowisku — pełny `next build` failuje z EPERM w sandboxie. Uruchamiaj
  po każdej paczce zmian.

## Świadome decyzje produktowe (nie cofaj bez pytania)

- Brak jakiegokolwiek modelu AI/LLM w logice przypominacza czy sugestii —
  wyłącznie deterministyczne reguły (np. "termin minął i status ≠
  Wdrożone"). To wprost wybrane przez właściciela.
- "Zdrowie" projektu (Na dobrej drodze/Zagrożony/Zerwany) jest ręczne i
  niezależne od statusu na tablicy — dwie osobne osie, tak jak w Linear.
- "Cykle" w Osi czasu (`ProjectTimeline.tsx`) są WYŁĄCZNIE wizualnym
  rytmem (naprzemienne pasy co 14 dni) — świadomie bez przypisywania
  zadań/projektów do cykli i bez nowej tabeli w bazie. Jeśli ktoś poprosi o
  pełne cykle z przypisywaniem, to nowy, większy zakres — dopytaj.
- Panel dąży do wyglądu/UX Linear, ale NIE 1:1 (brak zespołów, integracji
  z Gitem, itd.) — to świadomie mniejszy produkt dla jednej osoby.
- Emoji w UI są celowe — nie zamieniaj na bibliotekę ikon bez wyraźnej
  prośby.

## Dokumentacja

- `LEADS_SETUP.md` — moduł Leady (pierwszy zbudowany, najbardziej dojrzały)
- `HUB_SETUP.md` — Pulpit/Projekty/Notatnik/Kalendarz — aktualizuj przy
  każdej większej zmianie funkcjonalności panelu
- `PO_REJESTRACJI.md` — **checklista prawna do wykonania PO rejestracji
  działalności** (nota prawna z prawdziwymi danymi + link, dane administratora
  w polityce prywatności, przełączenie KSeF test→produkcja, ustawienia
  sprzedawcy). Firma NIE jest jeszcze zarejestrowana — te elementy świadomie
  odłożone; NIE traktować jako braki do „naprawienia" przed rejestracją.
- `docs/plany-modulow/` — **briefy wdrożeniowe kolejnych modułów, po jednym na
  osobny czat** (podpowiedzi leadów, nurture, kanały kontaktu, skrzynka
  mailowa). Powstały po audycie przepływów 2026-07-13 jako domknięcie trzech
  świadomie odłożonych luk. Jeśli właściciel prosi o „kolejny moduł", zacznij od
  `docs/plany-modulow/README.md` i wskazanego pliku.
