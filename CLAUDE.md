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
- framer-motion i `@tabler/icons-react` są w zależnościach. **Ikony panelu to
  `@tabler/icons-react`** — od 2026-07-11 (commit `c5552c0`), a od Modułu 33
  (2026-07-17) konsekwentnie w całym panelu. Mapy „rodzaj → ikona" mieszkają w
  `app/[lang]/admin/icons.tsx`. Emoji zostają w dwóch miejscach: w tym, co
  wychodzi mailem, i w ikonie projektu wybieranej przez właściciela — patrz
  sekcja „Emoji vs ikony" niżej, przeczytaj ją, zanim cokolwiek dodasz.

## Autoryzacja i baza

- Custom auth na cookie (`lib/auth.ts`): `isAuthed()`, `checkPassword()`,
  token SHA-256. Każdy admin API route zaczyna się od
  `if (!(await isAuthed())) return 401`.
- Panel jest jednoosobowy — brak ról i wielu użytkowników. To świadome
  ograniczenie zakresu. **Ale „jedno hasło" przestało być decyzją**:
  2026-07-22 (Audyt 1) właściciel poprosił o drugi składnik TOTP —
  `docs/plany-modulow/41-drugi-skladnik-totp.md`. Do czasu jego wdrożenia
  jedynym zabezpieczeniem przed zgadywaniem jest hamulec
  (`lib/rateLimit.ts`, 5 prób / 15 min) — patrz `docs/AUDYT-1-WYNIKI.md`.
- **Każda nowa trasa w `app/api` jest domyślnie OTWARTA.** `proxy.ts`
  (odpowiednik `middleware.ts` w Next 16) jawnie wyłącza `/api` ze swojego
  zakresu, więc nie ma żadnej warstwy chroniącej z góry — cała ochrona to
  195 powtórzeń `if (!(await isAuthed()))` w 149 plikach. Zapomnienie jednej
  linijki daje otwartą trasę bez żadnego objawu: build przechodzi, panel
  działa. Sprawdzaj **per uchwyt HTTP**, nie per plik — grep po pliku kłamie,
  bo pięć tras wspomina `isAuthed()` w komentarzu uzasadniającym jego brak.
- Schemat bazy tworzy się sam przy pierwszym użyciu (idempotentne migracje
  w `lib/db.ts`: `ensureLeadsSchema()`, `ensureHubSchema()`, każda z własnym
  cache'owanym promise). Nowe kolumny/tabele dodawaj przez
  `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
  w tych funkcjach — nigdy ręcznych migracji.
- **Bramka migracji** (2026-07-15): każda `create*Schema()` zaczyna się od
  `if (await schemaUpToDate("nazwa")) return;` i kończy
  `await markSchemaApplied("nazwa");`. Bez tego panel wykonuje 150+ zapytań
  przy każdym zimnym starcie (neon() = 1 żądanie HTTP na zapytanie) i mieli
  po kilka sekund. Dodając nowy schemat — dodaj obie linie. Szczegóły:
  `HUB_SETUP.md` → „Bramka migracji".
- **Zapytanie nie-DDL wewnątrz migracji** (np. `INSERT` wiersza-singletona)
  MUSI być owinięte w `inMigration()` z `lib/migration-ctx.ts`, inaczej w dev
  zakleszcza seeder i **wszystkie `/api/*` wiszą kilkadziesiąt sekund**.
  Filtr `isDDL()` łapie tylko CREATE/ALTER/DROP.
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
  dla projektów), profil rekordu ORAZ osobna podstrona `[id]/page.tsx` dla
  bezpośrednich linków — obie renderują ten sam `*DetailPanel.tsx`/
  `*Detail.tsx` komponent.
- **Profil rekordu = wyśrodkowany modal**, NIE wąski panel wysuwany z
  prawej — dotyczy WSZYSTKICH modułów (Leady, Klienci, Faktury, Oferty,
  Projekty). Do 2026-07-14 Leady/Klienci używały węższego `max-w-2xl`
  panelu z prawej (`.glass` tło) — zmienione na wyraźną prośbę właściciela,
  bo gęsta treść profilu (dane + adres + źródło + log + mapa procesu) nie
  mieściła się wygodnie. Leady/Klienci: BEZ `max-w` (`w-full`, margines
  tylko z paddingu overlayu) — modal zajmuje całą szerokość ekranu, siatka
  pól ma `xl:grid-cols-3`. Faktury/Oferty/Projekty: własne, węższe limity
  (`max-w-7xl` itp. w `InvoicesDashboard.tsx` i analogicznych) — nie
  ujednolicaj bez potrzeby, mają inny kształt treści (tabele pozycji).
  Wzorzec: `fixed inset-0 ... flex items-start justify-center` overlay +
  `card-paper max-h-[85vh] overflow-y-auto rounded-2xl` karta wewnątrz
  samego `*DetailPanel.tsx` (nie w wrapperze dashboardu) — patrz
  `LeadDetailPanel.tsx`/`InvoiceEditor.tsx` jako referencja. Nie wracaj do
  wąskiego panelu z prawej
  bez wyraźnej prośby.

## Design system (trzymaj się tego)

- `.card-paper` — gęste karty z treścią (większość UI)
- `.glass` — zarezerwowane dla chrome (nagłówek, overlay peek panelu) — NIE
  nadużywać na zwykłych kartach
- `.hairline` — kolor obramowań, zgodny z motywem jasny/ciemny
- `.btn-primary` — tylko jedno główne CTA na widok, nie każdy przycisk
- `.text-liquid` — gradientowy tekst na nagłówki/akcenty
- **Animacje: JEDNO źródło płynności — `lib/motion.ts`** (Moduł 36,
  2026-07-17). Framer-motion: `transition={SPRING}` (420/32) lub
  `ease: EASE_LIQUID` (`[0.16,1,0.3,1]`) — **NIGDY nie wpisuj tych liczb z
  palca i NIGDY nie zostawiaj `transition` bez `ease`** (domyślny `easeOut`
  framera to dokładnie ten dług, który Moduł 36 sprzątał). CSS/Tailwind:
  `var(--ease-liquid)` (`globals.css`, bliźniak — trzymaj zsynchronizowane).
  Wyjątki od `SPRING` tylko z komentarzem UZASADNIAJĄCYM: `SPRING_SOFT`
  (licznik „doliczający się") i `animate-spin` (spinner = liniowy).
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

- Brak jakiegokolwiek modelu AI/LLM w logice przypominacza, podpowiedzi,
  dopasowań czy kolejkowania — wyłącznie deterministyczne reguły (np.
  "termin minął i status ≠ Wdrożone"). To wprost wybrane przez właściciela.
  **Wyjątek od 2026-07-14** (patrz `docs/plany-modulow/06-08-ai-*.md`):
  punktowe, jawnie klikane użycia **lokalnego** modelu (Ollama na własnym
  Mac Studio właściciela, NIGDY chmurowe API) do generowania treści-do-
  zatwierdzenia (szkic maila, odczyt paragonu) — model zawsze proponuje,
  właściciel zawsze zatwierdza; nigdy nie decyduje/wysyła/zapisuje sam.
  Nie rozszerzaj tego wyjątku na inne miejsca bez wyraźnej prośby.
- "Zdrowie" projektu (Na dobrej drodze/Zagrożony/Zerwany) jest ręczne i
  niezależne od statusu na tablicy — dwie osobne osie, tak jak w Linear.
- "Cykle" w Osi czasu (`ProjectTimeline.tsx`) są WYŁĄCZNIE wizualnym
  rytmem (naprzemienne pasy co 14 dni) — świadomie bez przypisywania
  zadań/projektów do cykli i bez nowej tabeli w bazie. Jeśli ktoś poprosi o
  pełne cykle z przypisywaniem, to nowy, większy zakres — dopytaj.
- Panel dąży do wyglądu/UX Linear, ale NIE 1:1 (brak zespołów, integracji
  z Gitem, itd.) — to świadomie mniejszy produkt dla jednej osoby.
### Emoji vs ikony — WDROŻONE (Moduł 33, 2026-07-17)

**Reguła: w panelu ikony `@tabler/icons-react`, w mailach emoji.** Migracja
zaczęta 2026-07-11 jest **dokończona** — w `app/[lang]/admin` nie ma już ani
jednego emoji pełniącego rolę ikony. Jeśli gdzieś widzisz starą regułę („emoji
zamiast ikon", „dopasuj się do otoczenia pliku") — jest nieaktualna.

**Dokładając cokolwiek do panelu, użyj ikony Tablera, nie emoji.**

#### Gdzie mieszkają mapy „rodzaj → ikona"

`app/[lang]/admin/icons.tsx` — jedno źródło prawdy, komponenty:
`ContactChannelIcon`, `CallOutcomeIcon`, `ClientEventIcon`, `NotificationIcon`,
`LinkKindIcon`, `PaymentMethodIcon`, `MailFolderIcon`, `MailCategoryIcon`.

Świadomie **NIE** w `lib/<moduł>.ts` (to czysta logika bez Reacta — `lib/` jest
w 100 % `.ts`) i **NIE** w `<moduł>/shared.tsx` mimo wzorca `StatusTag`:
te mapy dzieli po kilka modułów naraz (`ContactChannelIcon` renderuje 9 plików
z czterech modułów), więc żaden nie jest ich właścicielem. Miejsce jak
`Menu.tsx`/`LinkPicker.tsx`/`NotificationBell.tsx`: korzeń `admin/`.
Moduły re-eksportują je przez swój `shared.tsx`. W `lib/` zostały typy,
etykiety i klasy kolorów — ikon tam już nie ma.

#### Dwa wyjątki, które ZOSTAJĄ na emoji (nie „naprawiaj" ich)

1. **Co wychodzi mailem** — podpis (`lib/mailSignature.ts`), mail dzienny
   (`app/api/leads/notify`), szablony (`lib/mail.ts`, `lib/mailSync.ts`).
   W HTML-u maila nie wyrenderujesz komponentu React, a ikony-obrazki bywają
   blokowane przez klienty pocztowe. `HUB_SETUP.md` (Moduł 4c) opisuje podpis
   jako „już w normie".
2. **Ikona projektu** — `PROJECT_ICONS`/`DEFAULT_PROJECT_ICON` w
   `lib/projects.ts`: paleta 16 emoji do wyboru, wybrana wartość **zapisana w
   bazie** per projekt (`lib/db.ts` → „tożsamość projektu"). To treść wybierana
   przez właściciela, nie afordancja systemu — dokładnie ta kategoria, w której
   Linear/Notion emoji zostawiają. Zamiana wymagałaby migracji danych i
   odebrałaby wybór. Brief Modułu 33 błędnie wciągał to w zakres.

Uwaga na `lib/mail.ts`: miesza jedno z drugim — `MAIL_FOLDER_ICON`/
`MAIL_CATEGORY_ICON` (chrome, przeniesione do `icons.tsx`) mieszkały obok
szablonów wychodzących (emoji, zostają). Nie traktuj całego pliku jednakowo.

Znaki typograficzne (`✕`, `★`, `●`, `✓`, `→`) świadomie zostawione — dziedziczą
kolor i nie mają problemu emoji (różny render per system). To osobna, wciąż
otwarta niespójność (część panelu używa `IconX`), nie ten moduł.

**Panel `/admin` jest jednomotywowy — ciemny.** `.admin-linear`
(`app/globals.css:303`) ma własną paletę i nigdy nie dostaje klasy `.dark`;
motyw jasny/ciemny dotyczy tylko strony publicznej. Nie szukaj jasnego panelu.

## Dokumentacja

- `LEADS_SETUP.md` — moduł Leady (pierwszy zbudowany, najbardziej dojrzały)
- `HUB_SETUP.md` — Pulpit/Projekty/Notatnik/Kalendarz — aktualizuj przy
  każdej większej zmianie funkcjonalności panelu
- `PO_REJESTRACJI.md` — **checklista prawna do wykonania PO rejestracji
  działalności** (nota prawna z prawdziwymi danymi + link, dane administratora
  w polityce prywatności, przełączenie KSeF test→produkcja, ustawienia
  sprzedawcy). Firma NIE jest jeszcze zarejestrowana — te elementy świadomie
  odłożone; NIE traktować jako braki do „naprawienia" przed rejestracją.
- `docs/AUDYTY-KONCOWE.md` — **co ma zostać sprawdzone, ZANIM uznamy panel
  i apkę za skończone**: bezpieczeństwo, RODO, niezawodność, obserwowalność
  (logi), wydajność, poprawność kodu. Spisane 2026-07-20 na zlecenie
  właściciela. Nie uruchamiaj go wcześniej niż po domknięciu wszystkich
  modułów i faz apki — ale też nie później niż przy rejestracji firmy.
- `docs/plany-modulow/` — **briefy wdrożeniowe kolejnych modułów, po jednym na
  osobny czat** (podpowiedzi leadów, nurture, kanały kontaktu, skrzynka
  mailowa). Powstały po audycie przepływów 2026-07-13 jako domknięcie trzech
  świadomie odłożonych luk. Jeśli właściciel prosi o „kolejny moduł", zacznij od
  `docs/plany-modulow/README.md` i wskazanego pliku.
