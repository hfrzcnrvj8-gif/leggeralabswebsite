# Moduł 33 — Ikony zamiast emoji w panelu (emoji zostają w mailach)

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`
> (sekcja „Emoji vs ikony"). Brief powstał z rozmowy z właścicielem 2026-07-17,
> po sprostowaniu nieprawdziwej reguły w `CLAUDE.md`.
>
> **Kolejność: PO Modułach 30 i 31** (decyzja właściciela 2026-07-17) — one
> naprawiają dziury funkcjonalne z audytu 29, to jest runda wizualna.

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

## Inwentaryzacja (zliczone 2026-07-17, zweryfikuj przed startem)

~128 linii z emoji w `app/[lang]/admin`, wg modułu:

| Moduł | Linie | Uwaga |
|---|---|---|
| **mail** | **35** | najwięcej — patrz „Poczta to wyspa" niżej |
| leads | 16 | |
| clients | 15 | |
| invoices | 13 | |
| notes | 12 | |
| (rdzeń) | 11 | `DashboardHome`, `CommandPalette` |
| calendar | 8 | m.in. `⤡`/`⛶` (pełny ekran) |
| costs | 6 | |
| projects / contracts / quick-log / offers / stats | 4/3/3/1/1 | |

**Koszt jest niższy, niż wygląda:** `Menu.tsx` ma już `icon?: ReactNode`
(linia 29), więc podmiana `icon="🏢"` → `icon={<IconBuilding size={16} />}`
**nie wymaga zmiany typów**. 33 wywołania `icon="…"` w całym panelu. Rdzeń
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
   mniej czytelna niż 💬.

## Zakres

- 33 wywołania `icon="<emoji>"` → komponenty Tablera (`Menu.tsx` już przyjmuje
  `ReactNode` — bez zmian typów)
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
