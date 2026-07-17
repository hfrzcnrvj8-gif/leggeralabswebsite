# Moduł 33 — Ikony zamiast emoji w panelu (emoji zostają w mailach)

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`
> (sekcja „Emoji vs ikony"). Brief powstał z rozmowy z właścicielem 2026-07-17,
> po sprostowaniu nieprawdziwej reguły w `CLAUDE.md`.
>
> **Kolejność: PO Modułach 30 i 31** (decyzja właściciela 2026-07-17) — one
> naprawiają dziury funkcjonalne z audytu 29, to jest runda wizualna.
> **Warunek spełniony: 30 ✅ i 31 ✅ zamknięte 2026-07-17. Ten moduł jest
> następny.**

## PRZECZYTAJ NAJPIERW — weryfikacja briefu w kodzie (2026-07-17, po Module 31)

Brief sam prosił „zweryfikuj przed startem" — zrobione gretem. **Kierunek i
uzasadnienie się bronią, ale liczby odjechały, a inwentaryzacja ma dziurę.**

| Teza briefu | Stan |
|---|---|
| `Menu.tsx` ma `icon?: ReactNode` (linia 29) → bez zmian typów | ✅ potwierdzone (linie 29, 314, 348) |
| `MailDashboard.tsx:698` — `<h1>Poczta</h1>` | ✅ potwierdzone **co do linii** |
| foldery Poczty na emoji (📥/📤/🗑️/🗄️) | ✅ 14 linii |
| puste stany („🌤️ Pusto") | ✅ 2 linie |
| „~128 linii z emoji w `app/[lang]/admin`" | ⚠️ **113** — bliskie, ale liczyło się też `→`/`←` z tekstu UI |
| „**33** wywołania `icon="…"`" | ❌ **24** — brief zawyża o jedną trzecią |
| mail 35 / leads 16 / clients 15 / invoices 13 / costs 6 / projects 4 | ❌ realnie **29 / 13 / 14 / 10 / 5 / 3** (reszta tabelki się zgadza) |
| „jedyny moduł z dużym nagłówkiem `<h1>`" | ⚠️ jedyny **dashboard**, ale `<h1>` ma też `LoginForm.tsx` (ekran logowania) i `QuickLogView.tsx` — te dwa są poza zakresem |

### ❗ Sprostowanie A — inwentaryzacja pomija `lib/`, czyli ~50 linii

**Brief liczy tylko `app/[lang]/admin`. Emoji chrome'u panelu mieszkają też w
`lib/`** — jako stałe renderowane przez UI:

| Plik | Linie | Renderuje |
|---|---|---|
| `lib/clients.ts` | 19 | `CLIENT_EVENT_ICON` — oś czasu klienta |
| `lib/notifications.ts` | 9 | `KIND_EMOJI` → `notificationEmoji()` → **dzwonek** (`NotificationBell.tsx:159`) |
| `lib/contact.ts` | 8 | `CONTACT_CHANNEL_ICON`/`CALL_OUTCOME_ICON` — **9 plików panelu** |
| `lib/costs.ts` | 6 | ikony metod płatności |
| `lib/projects.ts` | 5 | `emoji:` w szablonach projektów |
| `lib/links.ts` | 3 | `LINK_KIND_EMOJI` — `LinkPicker`, `NewDocumentDialog` |

**Sprawdzone: żadna z tych stałych nie jest używana przez wysyłkę maili** —
`CONTACT_CHANNEL_ICON`, `CLIENT_EVENT_ICON`, `CALL_OUTCOME_ICON`,
`LINK_KIND_EMOJI` i `notificationEmoji` mają konsumentów **wyłącznie w
`app/[lang]/admin`** (`mail/shared.tsx` to UI modułu Poczta, nie wysyłka). Czyli
są bezpieczne do zamiany i **nie kolidują z wyjątkiem „w mailach emoji"**.

Ale uwaga na sąsiedztwo: `lib/mail.ts` (9), `lib/mailSignature.ts` (4),
`lib/mailSync.ts` (4) to **treść wychodząca — NIE ruszać**. Emoji w `lib/` nie
są więc jednorodne: część to chrome, część to maile. Rozdziel je, zanim
zaczniesz zamieniać hurtem.

**Dlaczego to ważne:** pominięcie `lib/` zostawiłoby panel w połowie drogi —
menu kontekstowe na ikonach, a oś czasu klienta i dzwonek obok na emoji. To
dokładnie ten stan, przed którym ostrzega `CLAUDE.md` („robienie migracji
kawałkami rozjedzie panel na pół drogi").

### ❗ Sprostowanie B — „bez zmian typów" dotyczy TYLKO `Menu.tsx`

Brief chwali, że `Menu.tsx` przyjmuje już `ReactNode`, i wyciąga z tego wniosek
„koszt niższy, niż wygląda". Dla 24 wywołań `icon="…"` to prawda. **Dla map z
`lib/` — nie**, i to jest największa niewiadoma tego modułu:

- wszystkie pięć map to dziś `Record<…, string>` (`lib/clients.ts:108`,
  `lib/contact.ts:20` i `:64`, `lib/links.ts:95`, `lib/notifications.ts:63`) —
  **zmiana typu na `ReactNode` będzie konieczna**;
- **`lib/` jest w 100 % `.ts` — nie ma tam ani jednego `.tsx`**, więc literału
  JSX (`client: <IconUser />`) po prostu tam nie napiszesz;
- `lib/notifications.ts` ma na górze ostrzeżenie, że jest importowany przez
  **kliencki dzwonek**, i że dlatego nie wolno mu ciągnąć `lib/db` — build wywala
  się wtedy na „chunking context does not support external modules", a **`tsc`
  tego NIE łapie**. Ten plik jest wrażliwy na to, co się do niego wstawia.

**To jest pytanie do rozstrzygnięcia, nie oczywistość** — ale architektura
panelu ma na nie gotową odpowiedź: `CLAUDE.md` mówi, że `lib/<moduł>.ts` to
czysta logika bez `"use client"`, a komponenty specyficzne dla UI mieszkają w
`app/[lang]/admin/<moduł>/shared.tsx` (wzorzec: `StatusTag`). Mapa ikon to
element UI, nie logika — więc naturalne miejsce dla niej to `shared.tsx`
(albo komponent `<ClientEventIcon kind={…} />`), a nie `lib/*.ts` przerobiony
na `.tsx`. **Zaproponuj to właścicielowi jako decyzję, zamiast po cichu wybrać.**

### Uwaga: Moduł 31 dołożył trzy emoji do dzwonka

`lib/notifications.ts` ma od 2026-07-17 trzy nowe rodzaje (`offer_accepted` 🤝,
`contract_signed` ✍️, `review_collected` ⭐) — dzwonek liczy dziś **11 rodzajów**.
To celowe: obowiązywała zasada „dopasuj się do otoczenia pliku". Zamiana całej
mapy `KIND_EMOJI` na komponenty należy do tego modułu.

## Decyzja właściciela (2026-07-17) — nie zgaduj jej ponownie

**Wewnątrz panelu = ikony `@tabler/icons-react`. W tym, co wychodzi mailem =
emoji zostają.**

Uzasadnienie wyjątku (ważne — to NIE jest zaległość do „naprawienia"): w HTML-u
maila nie wyrenderujesz komponentu React, a ikony jako obrazki bywają blokowane
przez klienty pocztowe. Podpis mailowy jest zresztą opisany w `HUB_SETUP.md`
(Moduł 4c) jako **„już w normie"** wobec wzorców topowych firm. Nie ruszaj:
- podpisu mailowego (`signatureText()` / wersja HTML),
- treści maila dziennego (`app/api/leads/notify`),
- szablonów wiadomości wychodzących.

## Dlaczego (żeby nie cofnąć tego za pół roku)

Emoji w panelu **nie są ozdobą — pełnią rolę ikon systemowych** (`icon="🏢"`,
`icon="🖨"`, foldery Poczty). To zastosowanie, którego premium unika:
- **renderują się inaczej na każdym systemie** (🏢 na Macu ≠ na Windowsie) —
  panel wygląda inaczej u właściciela niż na ekranie klienta, któremu go pokazuje;
- **nie dziedziczą `currentColor` ani `stroke-width`** — nie żyją z motywem
  jasny/ciemny ani ze stanem hover, wyglądają jak naklejka obok szarej ikony;
- **nie trzymają siatki optycznej** — różny ciężar wizualny, rząd pozycji faluje.

Wzorzec z rynku (Linear/Notion/Slack/Stripe): **jeden zestaw ikon dla chrome,
emoji wyłącznie dla treści wybieranej przez użytkownika** (ikona projektu,
reakcja). Panel jest jednoosobowy i nie ma takiej treści — więc praktycznie
wszystko, co jest na emoji, to afordancja systemu.

## Inwentaryzacja (przeliczona 2026-07-17 — liczby niżej są zweryfikowane)

**113 linii** z emoji w `app/[lang]/admin` **+ ~50 linii w `lib/`** (patrz
Sprostowanie A wyżej — bez nich migracja zostanie w połowie).

| Moduł | Linie | Uwaga |
|---|---|---|
| **mail** | **29** | najwięcej — patrz „Poczta to wyspa" niżej |
| clients | 14 | |
| leads | 13 | |
| notes | 12 | |
| (rdzeń) | 11 | `DashboardHome`, `CommandPalette` |
| invoices | 10 | |
| calendar | 8 | m.in. `⤡`/`⛶` (pełny ekran) |
| costs | 5 | |
| projects / contracts / quick-log / offers / stats | 3/3/3/1/1 | |

**Koszt jest niższy, niż wygląda:** `Menu.tsx` ma już `icon?: ReactNode`
(linia 29), więc podmiana `icon="🏢"` → `icon={<IconBuilding size={16} />}`
**nie wymaga zmiany typów**. **24** wywołania `icon="<emoji>"` w całym panelu
(brief mówił 33 — przeliczone). Rdzeń
(sidebar, paski narzędzi, dashboardy) jest już na Tablerze — to jest dokończenie
migracji z 2026-07-11, nie nowy kierunek.

Miejsca do przejścia: `icon="…"` w menu kontekstowych (Leady, Klienci, Faktury,
Koszty, Projekty, Poczta), foldery Poczty (📥/📤/🗑️/🗄️), puste stany Kanbanów
(„🌤️ Pusto"), kanały kontaktu (📞/💬), pełny ekran Kalendarza.

## Poczta to wyspa — rozważ zrobienie jej najpierw

Właściciel wybrał pełny zakres, ale jeśli zabraknie czasu/energii, **Poczta ma
najlepszy stosunek efektu do pracy** i łapie trzy niespójności naraz:
- najwięcej emoji (35 linii),
- **jedyny moduł z dużym nagłówkiem** `<h1>Poczta</h1>` (`MailDashboard.tsx:698`)
  zamiast kompaktowego paska — trzeci „język paska narzędzi" w panelu
  (odłożone w Module 21),
- **trzecia implementacja menu**, nie idzie przez `Menu.tsx` (odłożone w
  Module 25).

## Do rozstrzygnięcia z właścicielem przy starcie

1. **Puste stany** („🌤️ Pusto") — ikona, sam tekst, czy zostają? To jedyne
   miejsce, gdzie emoji niesie *nastrój*, nie znaczenie. Linear w pustych
   stanach używa ilustracji/ikony, nie emoji.
2. **Czy przy okazji ujednolicić nagłówek Poczty** do kompaktowego paska (patrz
   wyżej), czy to osobna runda? To dotyka układu, nie tylko ikon.
3. **Które ikony Tablera** dla kanałów kontaktu — `IconPhone`/`IconBrandWhatsapp`
   (Tabler ma ikony marek) czy neutralne? Marka WhatsAppa w monochromie bywa
   mniej czytelna niż 💬. (Uwaga: `CONTACT_CHANNEL_ICON` renderuje **9 plików
   panelu** — ta decyzja jest widoczna szerzej, niż wygląda.)
4. **Gdzie mają mieszkać mapy ikon** (Sprostowanie B) — `lib/*.ts` nie przyjmie
   JSX, a `lib/notifications.ts` jest wrażliwy na importy (kliencki dzwonek).
   Propozycja: przenieść je do `shared.tsx` zgodnie z architekturą z `CLAUDE.md`
   („komponenty specyficzne dla UI" — wzorzec `StatusTag`), zostawiając w `lib/`
   samą logikę. To jedyna decyzja **architektoniczna** w tym module.

## Zakres

- **24** wywołania `icon="<emoji>"` → komponenty Tablera (`Menu.tsx` już
  przyjmuje `ReactNode` — bez zmian typów)
- **stałe w `lib/`** renderowane przez panel (Sprostowanie A): `CLIENT_EVENT_ICON`,
  `KIND_EMOJI`/`notificationEmoji` (dzwonek), `CONTACT_CHANNEL_ICON`,
  `CALL_OUTCOME_ICON`, `LINK_KIND_EMOJI`, ikony metod płatności, `emoji:` w
  szablonach projektów. **Wszystkie zweryfikowane jako panel-only** — nie wpadną
  do maila. **Wymagają zmiany typu i prawdopodobnie przeprowadzki do
  `shared.tsx`** — patrz Sprostowanie B (to decyzja do zadania właścicielowi,
  nie oczywistość).
- foldery Poczty, puste stany, kanały kontaktu, pełny ekran Kalendarza
- **NIE ruszać**: podpis mailowy, mail dzienny, szablony wychodzące (patrz
  „Decyzja właściciela")
- aktualizacja `CLAUDE.md` → „Emoji vs ikony" (po wdrożeniu reguła przestaje
  brzmieć „dopasuj się do otoczenia", a zaczyna „w panelu ikony, w mailach
  emoji") oraz „zasad wspólnych" w `README.md`

## Weryfikacja

`npx tsc --noEmit -p tsconfig.json` + podgląd (`preview_start name:"dev"`).
Obejrzyj menu kontekstowe (prawy przycisk) w Leadach/Fakturach/Kosztach oraz
sidebar folderów w Poczcie — w obu motywach (jasny/ciemny), bo cały sens zmiany
to dziedziczenie koloru. `resize_window colorScheme:"dark"`.
