# Moduł 22 — Powiązania wszędzie: jeden picker, komplet luk domkniętych

> Przeczytaj najpierw `docs/plany-modulow/README.md` i `CLAUDE.md`. Ten plik
> jest samowystarczalny — zawiera pełny inwentarz powiązań zrobiony
> 2026-07-16, nie musisz go powtarzać.

## Skąd to się wzięło

Właściciel (2026-07-16): *„oczywiście pełna integracja czyli na każdym kroku
można dodawać zależności od klienta czy leada tak żeby każda możliwa akcja
mogła być dopasowana albo manualnie do klienta/leada albo kiedy już jest coś
do niego dopasowane i się coś robi nowego dla tego klienta to automatycznie
dopasowuje"*.

Inwentarz kodu pokazał coś nieoczywistego: **baza jest w większości gotowa,
to UI jej nie używa.** To nie jest moduł „dobudujmy relacje w bazie", tylko
„dokończmy UI i PATCH-e do relacji, które już istnieją".

## Stan faktyczny (zweryfikowany 2026-07-16 — nie badaj od nowa)

| Moduł | Kolumny w bazie | Ręczne przypięcie w UI | Auto-dopasowanie |
|---|---|---|---|
| leads | `leads.client_id` (`lib/db.ts:1071`) | **NIE** — tylko „utwórz klienta" (`LeadDetailPanel.tsx:164`); `PATCH /api/leads/[id]` nie przyjmuje `client_id` | promote, jednorazowo (`api/leads/[id]/promote/route.ts:22,35`) |
| clients | `clients.lead_id` (`lib/db.ts:1045`) | NIE | promote + `api/mail/[id]/create-client:75` |
| offers | `lead_id`/`project_id`/`invoice_id` (`db.ts:784-786`), `client_id` (`db.ts:1072`) | **częściowo** — `ClientPickerButton` (`OfferEditor.tsx:310`); `lead_id`/`project_id` brak UI | dziedziczy z leada (`api/offers/route.ts:60-80`) |
| contracts | `lead_id`/`client_id`/`project_id`/`offer_id` (`db.ts:959-962`) | **NIE** — chip read-only (`ContractEditor.tsx:144`); `PATCH` nie obsługuje żadnego pola | z oferty/leada przy tworzeniu (`api/contracts/route.ts:64-68,89-92`) |
| projects | `lead_id` (`db.ts:325`), `client_id` (`db.ts:1074`) | **TAK** — własne selecty `PropTrigger` (`ProjectDetailPanel.tsx:1423-1440`) | `lib/offerAccept.ts:62-92` |
| invoices | `lead_id`/`project_id` (`db.ts:562-563`), `client_id` (`db.ts:1073`) | **częściowo** — `ClientPickerButton` (`InvoiceEditor.tsx:573`); `lead_id`/`project_id` API tak (`api/invoices/[id]/route.ts:133-139`), UI nie | `lib/offerAccept.ts:112` |
| costs | **tylko `project_id`** (`db.ts:1211`) | projekt tak (`CostEditor.tsx:485-487`); klient/lead — brak kolumny | po NIP → projekt (`api/costs/hints/route.ts:38,58-66`) |
| mail | `client_id`/`lead_id`/`invoice_id` (`db.ts:1428-1430`) | **NIE** — `PATCH /api/mail/[id]` przyjmuje (`route.ts:230-234`), ale nic tego nie wywołuje | `findContactsByEmail` (`lib/contactLookup.ts:52`), użyte w `mailSync.ts:531,777-782,805` |
| calendar | `lead_id`/`project_id` (`db.ts:478-479`), `client_id` (`db.ts:1075`) | **TAK** — surowe `<select>` (`CalendarView.tsx:1669,1679`) | NIE |
| notes | **BRAK jakichkolwiek** (`db.ts:450-458`) | NIE | NIE |
| quick-log | pisze do `lead_activity`/`client_activity` | TAK (wybór z dopasowań, `QuickLogView.tsx:90`) | po telefonie (`findContactsByPhone`, `contactLookup.ts:19`) |

## Zakres tej rundy

### 1. Jeden wspólny `LinkPicker` zamiast trzech wzorców (rdzeń)

Dziś to samo robią trzy różne mechanizmy, a **picker leada nie istnieje w
ogóle** — stąd komplet luk przy `lead_id`:
- `ClientPickerButton` (`app/[lang]/admin/components.tsx:391`) — oferty, faktury
- własne selecty `PropTrigger` — projekty (`ProjectDetailPanel.tsx:1434`)
- surowy `<select>` — kalendarz (`CalendarView.tsx:1669`)
- `ClientLinkChip` (`components.tsx:368`) — tylko wyświetla, nie zmienia

Zbuduj **jeden** komponent obsługujący klienta ORAZ leada (i opcjonalnie
projekt), przez `PropertyMenu`/`Popover` z `Menu.tsx` — tak jak reszta panelu
po audycie wizualnym 2026-07-16. Potem podmień wszystkie trzy wzorce.
To ta sama dźwignia co `Modal.tsx`/`ViewTabs.tsx` w Module 21.

### 2. Domknięcie luk „kolumna jest, UI nie ma" — wg priorytetu

1. **Poczta — NAJWAŻNIEJSZE.** Brak pickera w `MailDetailPanel.tsx`.
   Auto-match działa **tylko na równość adresu** (`contactLookup.ts:52`), więc
   gdy klient napisze z innego adresu, wiadomość zostaje „Nieprzypisana"
   **na zawsze** — nie ma jak tego naprawić ręcznie. API już gotowe
   (`api/mail/[id]/route.ts:230-234`), brakuje wyłącznie UI.
2. **Leady → istniejący klient.** `leads.client_id` istnieje, `PATCH` go nie
   przyjmuje. Dziś jedyna droga to „utwórz klienta" → **produkuje duplikaty**.
3. **Umowy.** Cztery kolumny, `PATCH /api/contracts/[id]` nie obsługuje
   żadnej. Raz źle przypięta umowa jest nie do naprawienia z panelu.
4. **Faktury/Oferty** — `lead_id`, `project_id` w UI (API częściowo gotowe).

### 3. Nowe kolumny (tam, gdzie naprawdę brakuje)

- `costs.client_id` + `costs.lead_id` (dziś klient tylko pośrednio przez
  projekt) — pamiętaj o `recurring_costs`.
- `notes.client_id` + `notes.lead_id` + `notes.project_id` — notatnik jest
  jedynym modułem całkowicie odciętym od CRM. **Samo UI notatnika robi Moduł
  26** — tutaj tylko kolumny + picker, żeby 26 miał na czym stanąć.

Migracje: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` w `lib/db.ts`, plus
`schemaUpToDate()`/`markSchemaApplied()` — patrz „Bramka migracji" w
`HUB_SETUP.md`. Nie-DDL owijaj w `inMigration()`.

### 4. Auto-dopasowanie „skoro już wiem, kto to"

Właściciel prosił, żeby nowe rzeczy dla znanego klienta dopasowywały się same.
Wzorce, które już działają i warto rozciągnąć: `offerAccept.ts` (oferta →
projekt+faktura dziedziczą powiązania), `api/offers/route.ts:60-80`
(dziedziczenie z leada), `costs/hints` (po NIP).

**Uwaga na zasadę projektu:** auto-dopasowanie MUSI być deterministyczne
(równość adresu/NIP/telefonu, dziedziczenie po rekordzie źródłowym) — **żadnego
AI/LLM**, patrz CLAUDE.md. I nigdy twarda bramka: podpowiedź informuje,
właściciel zatwierdza.

## Czego NIE robić w tej rundzie

- **Nie buduj UI notatnika** (Moduł 26) ani zakładek w kliencie/leadzie
  (Moduł 23) — tutaj tylko kolumny i picker.
- Nie ruszaj palety, emoji, układu ekranów (patrz Moduł 21).
- Nie rozszerzaj auto-dopasowania na dopasowanie „rozmyte"/AI.

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json` po każdej paczce.
2. Picker sprawdzony na WIĘCEJ NIŻ jednym module (to ma być dźwignia).
3. Scenariusz na żywo w dev (PGlite, `preview_start name:"dev"`): mail od
   nieznanego adresu → ręczne przypięcie do istniejącego klienta → wiadomość
   znika z „Nieprzypisane".
4. Zaktualizuj `HUB_SETUP.md` i odhacz w `docs/plany-modulow/README.md`.
