# Moduł 13 — Faktury: eskalacja windykacji + rezerwa podatkowa

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcje
> "Etap 7 — Płatność i windykacja" i "Etap 6 — Fakturowanie" (rezerwa
> podatkowa).

## Kontekst (żeby nie zaczynać od zera)

Właściciel wprost pytał o: "przypomnienie o zapłacie, jeżeli ktoś jeszcze
nie zapłacił, szablony ponaglenia spłat, gdyby była taka konieczność, i co
dalej gdyby ktoś nie płacił (żeby to się monitorowało automatycznie, i jak
to pod kątem prawnym wygląda)".

Audyt 2026-07-14 potwierdził: przypomnienia **istnieją**, ale to jeden,
stały szablon powtarzany co 7 dni **w nieskończoność, bez żadnej
eskalacji**, zero koncepcji formalnego wezwania do zapłaty, zero odsetek.

## Stan faktyczny (co już jest — nie budować od zera)

- **Płatności**: tabela `invoice_payments` (`id, invoice_id, kwota, data,
  created_at`) — `lib/invoices.ts:233-239`. `POST /api/invoices/[id]/payments`
  dolicza wpłatę, auto-flip statusu na "Opłacona" gdy
  `totalPaid(payments) >= brutto` (`payments/route.ts:60-64`). Komentarz w
  kodzie (`payments/route.ts:16-17`) świadomie zastrzega: "to nadal
  ewidencja kwot, nie automat księgowy" — częściowe wpłaty nie mają osobnego
  statusu "częściowo opłacona" i to jest OK, nie trzeba tego zmieniać.
- **Przypomnienia**: `sendOverdueInvoiceReminders()`
  (`app/api/leads/notify/route.ts:29-81`) — wybiera faktury `status =
  'Wystawiona'`, nie proforma, z mailem klienta, z `last_reminder_at`
  starszym niż `REMINDER_COOLDOWN_DAYS = 7` (linia 21). Jeden, stały
  szablon tekstowy (linie 55-71), identyczny niezależnie od liczby dni
  opóźnienia. Ten sam szablon zduplikowany w ręcznym wyzwalaczu
  `app/api/invoices/[id]/remind/route.ts:36-52`.
- **Brak historii**: faktura trzyma tylko `last_reminder_at`
  (`lib/invoices.ts:172`), nadpisywane za każdym razem — zero licznika ile
  przypomnień poszło, zero widoczności w `InvoiceEditor.tsx` (nie ma tam
  żadnego odwołania do `last_reminder_at`).
- **Zero formalnej windykacji**: brak "wezwania do zapłaty" jako osobnego
  typu dokumentu (`INVOICE_TYPES` ma tylko `faktura/proforma/zaliczkowa`,
  `lib/invoices.ts:99`), brak odsetek ustawowych, brak zdefiniowanej
  ścieżki eskalacji poza powtarzającym się mailem.
- Każde przypomnienie już loguje zdarzenie na osi czasu klienta
  (`kind: "invoice_reminder"`, widoczne przez `client_events` — patrz
  Moduł 12 dla klikalności tego wpisu).

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Ile poziomów eskalacji** i po ilu dniach opóźnienia każdy się
   uruchamia? Propozycja punktu wyjścia (do potwierdzenia/zmiany):
   przypomnienie uprzejme (dzień terminu +3), przypomnienie stanowcze
   (+10), formalne wezwanie do zapłaty (+21) — ale to właściciel decyduje
   o progach.
2. **Wezwanie do zapłaty — jaka forma?** Osobny, generowany PDF (jak
   faktura) czy tylko mocniej sformułowany e-mail? To wpływa na to, czy
   potrzebny jest nowy typ dokumentu w bazie.
3. **Odsetki ustawowe** — czy pokazywać je w ogóle na wezwaniu? Jeśli tak:
   stawka **ustawiana ręcznie przez właściciela** w ustawieniach firmy
   (zmienia się okresowo, ogłaszana przez NBP/MF) — panel NIE powinien
   jej samodzielnie wyliczać/aktualizować bez potwierdzenia. Samo
   wyliczenie kwoty odsetek od kwoty i liczby dni to prosta matematyka,
   ale stawka wejściowa musi być jawna i edytowalna.
4. **Przypomnienie PRZED terminem** — czy dodać (np. 3 dni przed), żeby
   nie tylko reagować na już zaległe faktury?
5. **Treść wezwania do zapłaty** — jak treść umowy (Moduł 11), wymaga
   konsultacji prawnej/księgowej przed pierwszym realnym użyciem. Panel
   buduje mechanizm, nie redaguje wiążącego tekstu prawnego samodzielnie.
6. **Rezerwa podatkowa** — czy to prosty % (jedna stawka ustawiana przez
   właściciela) czy rozbicie per rodzaj podatku (VAT/PIT/ZUS osobno)?
   Gdzie ma się pokazywać: przy każdej fakturze, zbiorczo na Pulpicie, czy
   oba miejsca?

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki — eskalacja informuje i
  przypomina, nie blokuje niczego właścicielowi.
- Zero AI/LLM w logice — eskalacja to zwykłe reguły dni/progów.
- `todayLocalISO()`/`isPlausibleDateString()` do wszelkiej matematyki dat,
  nigdy `new Date()` do porównań dnia.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej. Minimum: przypomnienia mają widoczną historię/licznik na fakturze,
ton eskalacji rośnie z czasem opóźnienia zamiast powtarzać się bez końca,
i istnieje przynajmniej podstawowy mechanizm "wezwania do zapłaty" jako
ostatniego kroku — z wyraźnym zastrzeżeniem, że treść wymaga jeszcze
weryfikacji prawnej. Rezerwa podatkowa widoczna przy fakturach/na Pulpicie.
