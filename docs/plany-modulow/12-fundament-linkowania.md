# Moduł 12 — Fundament linkowania (podstrony faktur/ofert + klikalna oś czasu klienta)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Poprzeczne: Fundament linkowania". To moduł **infrastrukturalny** —
> sam w sobie mało widowiskowy, ale odblokowuje moduły 15-17 (Zamknięcie,
> Wsparcie, Retencja), które dokładają kolejne zdarzenia do osi czasu
> klienta i bez klikalności tracą dużo wartości.

## Kontekst (żeby nie zaczynać od zera)

Właściciel wprost powiedział: "chcę mieć całą historię kontaktu z klientem
i wszystkich działań, które w aplikacji zostały wykonane, w związku z tym
klientem, żeby to się ze sobą wszystko łączyło — że klikam na coś typu
mail z kiedyś tam i mnie do tego maila przenosi".

Audyt 2026-07-14 potwierdził dwie rzeczy:
1. Scalona oś czasu klienta **już istnieje** i agreguje zdarzenia poprawnie.
2. **Żaden wpis na niej nie jest klikalny** — a nawet gdyby był, dla
   faktur i ofert nie ma dokąd linkować, bo nie mają własnej podstrony.

## Stan faktyczny (co już jest — nie budować od zera)

- **Oś czasu klienta**: `GET /api/clients/[id]` (`app/api/clients/[id]/route.ts:34-86`)
  scala trzy źródła: `client_activity` (ręczne notatki/kontakt),
  `lead_activity` (historia sprzed konwersji, po `lead_id`), `client_events`
  (zdarzenia systemowe — `lib/db.ts:754-770`, `logClientEvent()`).
  `CLIENT_EVENT_KINDS` (`lib/clients.ts:61-73`): `client_created`,
  `offer_created`, `offer_sent`, `offer_accepted`, `invoice_issued`,
  `invoice_sent`, `invoice_reminder`, `payment_received`, `invoice_paid`,
  `project_status_changed`, `nurture_scheduled`.
- **Render bez linków**: `ClientDetailPanel.tsx:513-560` — każdy wpis
  (`<li>`) to tylko ikona + tekst (`f.text`), zero `<Link>`/`onClick`/`id`.
- **Osobna sekcja "Powiązane" JEST klikalna** (`ClientDetailPanel.tsx:313-355`)
  — ale to bieżące listy ofert/faktur/projektów klienta, nie chronologiczna
  oś. Linkuje do: `/${lang}/admin/offers/${o.id}/print`,
  `/${lang}/admin/invoices/${i.id}/print`, `/${lang}/admin/projects/${p.id}`.
- **Martwy link znaleziony w audycie**: `DashboardHome.tsx:382,416,421`
  linkuje do `/${lang}/admin/invoices/${inv.id}` — ta ścieżka **nie
  istnieje** (`app/[lang]/admin/invoices/[id]/` ma tylko podfolder
  `print/`, brak `page.tsx`) → 404. Napraw przy okazji tego modułu.
- **Konwencja deep-linkingu jest dziś ad-hoc, niespójna**: jedyny
  query-param wzorzec to `?project=<id>` w Kosztach
  (`app/[lang]/admin/costs/CostsDashboard.tsx`, ustawiane z
  `ProjectDetailPanel.tsx:413`). Leady/Klienci/Projekty mają prawdziwe
  `/[id]/page.tsx`. **Faktury i Oferty NIE mają** — dziś otwierają się
  tylko jako modal z lokalnego stanu `openId` w dashboardzie
  (`InvoicesDashboard.tsx`, `OffersDashboard.tsx`), nigdy nie czytają ID
  z URL.

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Podstrony faktur/ofert** — czy `/admin/invoices/[id]` i
   `/admin/offers/[id]` mają otwierać ten sam edytor co dziś modal (tylko
   jako pełna strona), czy wystarczy przekierowanie na istniejący widok
   druku (`/[id]/print`)? Pierwsze jest spójniejsze z Leadami/Klientami/
   Projektami, drugie szybsze do zrobienia.
2. **Klikalność osi czasu** — czy każdy typ zdarzenia (`CLIENT_EVENT_KINDS`)
   ma linkować do konkretnego rekordu (np. `offer_accepted` → ta oferta),
   czy część zostaje bez linku (np. `nurture_scheduled` nie ma dokąd
   prowadzić)?
3. **Zakres tego czatu** — sam fundament (podstrony + klikalność) czy też
   dorzucić brakujące zdarzenia znalezione w audycie (oferta obejrzana
   przez klienta, edycje faktur/ofert)? Rekomendacja: sam fundament w tym
   czacie, dodatkowe zdarzenia przy okazji modułów, które je naturalnie
   generują (15-17).

## Do zrobienia przy tej samej okazji ("szybkie porządki" z mapy drogi)

- Naprawić martwy link `/admin/invoices/[id]` z `DashboardHome.tsx`.
- Przy konwersji Lead→Klient (`app/api/leads/[id]/promote/route.ts`,
  `app/api/offers/route.ts:51-66`) donieść gubione pola: `osoba_kontaktowa`,
  `linkedin_url`, `zrodlo`/`zrodlo_kategoria` (jako pochodzenie klienta),
  `notatki`.

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Design system: `.card-paper`, paleta marki, emoji zamiast ikon.
- Migracje idempotentne (jeśli potrzebne — to głównie zmiana UI/routingu,
  raczej bez zmian schematu).
- `npx tsc --noEmit` po każdej paczce zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

- Faktury i Oferty mają działającą podstronę `/[id]` (bez 404).
- Martwy link z Pulpitu naprawiony.
- Przynajmniej najważniejsze typy zdarzeń na osi czasu klienta
  (oferta/faktura/płatność) są klikalne i prowadzą do właściwego rekordu.
- Pola Lead→Klient nie giną przy konwersji.
- `tsc` czysty, zweryfikowane na dev, `HUB_SETUP.md` zaktualizowany.
