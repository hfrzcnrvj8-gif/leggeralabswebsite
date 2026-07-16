# Moduł 24 — Centrum powiadomień w panelu (potem mobile)

> Przeczytaj `docs/plany-modulow/README.md` i `CLAUDE.md`. Stan zbadany
> 2026-07-16 — nie badaj od nowa.

## Skąd to się wzięło

Właściciel (2026-07-16): *„brakuje nam też w ogóle takich powiadomień w
aplikacji gdyby się coś wydarzyło ważnego, tutaj ale później też na mobile"*.
Inspiracja: centrum powiadomień macOS (zrzuty ekranu z „Edytora skryptów").

## Dobra wiadomość: zdarzenia już istnieją i są policzone

To nie jest moduł „wymyślmy powiadomienia", tylko **„przekierujmy istniejący
strumień z maila do UI"**. Cron `vercel.json` → `/api/leads/notify`,
`0 6 * * *`, wysyła digest na `kontakt@leggeralabs.pl`:

| Funkcja (`app/api/leads/notify/route.ts`) | Linia | Zdarzenie |
|---|---|---|
| `sendOverdueInvoiceReminders` | :59 | zaległe faktury, eskalacja +3/+10/+21 dni |
| `generateDueRecurringInvoices` | :138 | wygenerowano fakturę cykliczną |
| `generateDueRecurringCosts` | :189 | wygenerowano koszt cykliczny |
| `syncMailAndPurge` | :235 | nowe maile, dopasowanie do klienta (:436) |
| `buildAndSendDigest` | :262 | zaległe leady/projekty/klienci, przypomnienia, wydarzenia na dziś (:302) |

`buildAndSendDigest` zwraca już policzalny kształt: `{ overdue, total,
invoiceReminders, recurringGenerated, recurringCostsGenerated }` — gotowe pod
licznik przy dzwonku. Dodatkowo: `getNudgeThreads` (wątki bez odpowiedzi),
`api/events/deadlines`, `api/hub/today`, `client_followups` (`db.ts:1160`).

## Czego nie ma

- **Tabeli `notifications`** — `lib/db.ts` ma 40 tabel, żadnej takiej.
  Najbliższe (`lead_activity`, `client_events`, `invoice_reminders`) to logi
  per-encja, nie kolejka dla użytkownika.
- **Dzwonka/centrum** — jedyne `IconBell*` w repo to
  `invoices/InvoiceEditor.tsx:14,1327` („wyślij przypomnienie"), nie dzwonek.
- **Trwałości** — `toast()` w `ui.tsx:64-70` znika po **3400 ms**
  (`window.setTimeout`), bez historii, bez `localStorage`, bez pauzy na hover,
  bez przycisku zamknięcia. Jeśli właściciela nie było przy ekranie, zdarzenie
  przepadło bezpowrotnie.

## Zakres

1. **Tabela `notifications`** — minimum: `id`, `kind`, `title`, `body`,
   `entity`/`entity_id` (żeby kliknięcie prowadziło do rekordu), `read_at`,
   `created_at`. Migracja przez bramkę (`schemaUpToDate()`/
   `markSchemaApplied()` — patrz `HUB_SETUP.md`).
2. **Zapis zdarzeń** — hooki w miejscach z tabeli wyżej. Cron dalej wysyła
   maila (nie usuwaj — właściciel nie siedzi w panelu cały dzień), ale
   dodatkowo zapisuje do `notifications`.
3. **Dzwonek w `AppShell.tsx`** — licznik nieprzeczytanych, panel z historią,
   kliknięcie → nawigacja do rekordu, „oznacz wszystkie jako przeczytane".
   Użyj `Popover` z `Menu.tsx` (`.glass`, portal, animacje — patrz Moduł 21).
4. **Trwałe toasty (opcjonalnie)** — powiązać `toast()` z centrum, żeby ważne
   zdarzenia zostawiały ślad zamiast znikać po 3,4 s.

## Uwagi

- **Zero AI** — o tym, co jest „ważne", decydują deterministyczne reguły, te
  same co dziś w cronie (termin minął, status ≠ opłacona itd.). Patrz
  CLAUDE.md.
- **Miękko, nie twardo** — powiadomienie informuje, nigdy nie blokuje.
- **Mobile później** — właściciel wprost: „tutaj ale później też na mobile".
  Push wymaga PWA (Moduł 5) — nie wciągaj tego tutaj, ale projektując tabelę
  pomyśl, że `notifications` ma kiedyś zasilić push.

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json`.
2. W dev (PGlite) wywołaj zdarzenie (np. zaległa faktura) i potwierdź, że
   pojawia się w dzwonku i prowadzi do rekordu.
3. Zrzuty przed/po. Zaktualizuj `HUB_SETUP.md` i odhacz w `README.md`.
