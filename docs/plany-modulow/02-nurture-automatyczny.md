# Moduł 2 — Nurture: automatyczne przypomnienia po zamknięciu (luka ⑥)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> Potem zaproponuj plan, zadaj pytania z „Otwarte decyzje", dopiero buduj.

## Problem (nietechnicznie)

Krok 12 procesu to **nurture** — odezwanie się do klienta po jakimś czasie od
zamknięcia (nowa propozycja, sprawdzenie jak działa wdrożenie, prośba o
polecenie). Dziś to działa **tylko ręcznie**: przypomnienie o kliencie odpala
się wyłącznie, jeśli właściciel sam ustawi datę `next_followup`
(`isClientOverdue` w `lib/clients.ts`). Po wygranym dealu **nic nie planuje się
samo** — łatwo zapomnieć o kliencie, który już raz zapłacił (a to najtańsze
źródło kolejnej sprzedaży).

## Zakres

**W zakresie:** gdy klient „domyka się" (projekt wdrożony albo relacja wygrana),
panel **proponuje/ustawia** przyszłą datę kontaktu (`next_followup`), tak żeby
klient sam wypłynął na Pulpicie w „Klienci wymagający kontaktu" za X czasu.

**Poza zakresem:** wysyłanie automatycznych maili nurture do klienta (to byłby
outbound bez kontroli treści — sprzeczne z „miękko, nie automatycznie za
właściciela"). Nurture = **przypomnienie właścicielowi, że ma się odezwać**, nie
mail wysłany za niego. Zero AI dobierającego treść/termin.

## Stan faktyczny (co już jest)

- `clients.next_followup DATE` — kolumna istnieje (`lib/db.ts`).
- `isClientOverdue(client)` — true, gdy `next_followup <= dziś` i status ≠ ?
  (sprawdź dokładną regułę w `lib/clients.ts`).
- Pulpit (`app/api/hub/today`) i mail dzienny pokazują „overdueClients".
- Status relacji klienta: `Prospekt / Aktywny / Uśpiony / Stracony`
  (`CLIENT_STATUSES`).
- Zdarzenia klienta logują się przez `logClientEvent()` (`lib/db.ts`).
- Cron dzienny: `app/api/leads/notify` (06:00, `vercel.json`) — miejsce na
  ewentualną logikę „co dzień sprawdź i zaplanuj".

## Trigger nurture — kiedy planować (do decyzji, patrz niżej)

Kandydaci na moment „to jest domknięcie, zaplanuj nurture":
- **Projekt → status „Wdrożone"** (`app/api/projects/[id]` PATCH) — najczystszy
  sygnał „robota skończona". Rekomendowany.
- Faktura projektu opłacona w całości (`invoices/[id]/payments`) — „zapłacone".
- Ręczne ustawienie klienta na „Uśpiony".

Rekomendacja: trigger na **„Wdrożone"** (koniec realizacji) — wtedy klient jest
najbardziej zadowolony i otwarty na kolejny krok/referencję.

## Plan techniczny

### Krok 1 — reguła i stała odstępu
- `lib/clients.ts`: dodaj `NURTURE_INTERVAL_DAYS` (np. 90) jako jawną stałą +
  helper `nurtureDateFrom(dateISO): string` (dziś + interwał, przez arytmetykę
  dat spójną z `lib/dates.ts`, nie `new Date` do dnia). Świadomie statyczne,
  łatwe do zmiany jedną liczbą.

### Krok 2 — ustawianie `next_followup` przy triggerze
- W `app/api/projects/[id]/route.ts` PATCH: gdy status zmienia się na „Wdrożone"
  a projekt ma `client_id`, ustaw `clients.next_followup = nurtureDateFrom(dziś)`
  **tylko jeśli** klient nie ma już ustawionego przyszłego przypomnienia (nie
  nadpisuj świadomej daty właściciela). Zaloguj `logClientEvent(sql, clientId,
  "nurture_scheduled", "Zaplanowano kontakt kontrolny za …")`.
- Zdecyduj z właścicielem: **auto-ustawienie** (dzieje się samo) vs **miękka
  propozycja** (toast/podpowiedź „ustawić przypomnienie za 3 mies.?"). Zgodnie z
  zasadą „miękko" — patrz „Otwarte decyzje".

### Krok 3 — widoczność
- Nic nowego nie trzeba: gdy `next_followup` nadejdzie, klient sam pojawi się w
  „Klienci wymagający kontaktu" (Pulpit + mail). Ewentualnie dodaj rozróżnienie
  powodu w `clientOverdueReason()` („kontakt kontrolny (nurture)" vs zwykłe
  przypomnienie) — drobny plus czytelności.

### Krok 4 — weryfikacja
- `npx tsc --noEmit`.
- Dev: projekt z `client_id` → zmień status na „Wdrożone" → sprawdź, że klient
  dostał `next_followup` (+ wpis w osi) i że po „cofnięciu czasu" (ustaw datę w
  przeszłości ręcznie w UI) pojawia się na Pulpicie. Zrzut dla właściciela.

## Otwarte decyzje (zapytaj właściciela)
1. **Odstęp nurture** — 90 dni? Inny? Może zależny od typu klienta?
2. **Auto czy propozycja** — panel ma sam ustawić przypomnienie po „Wdrożone",
   czy tylko zaproponować (miękko, do potwierdzenia jednym kliknięciem)?
3. **Trigger** — „Wdrożone" (rekomendowane) czy pełna zapłata faktury?

## Definicja ukończenia
- Po domknięciu projektu klient dostaje zaplanowany kontakt kontrolny (auto lub
  po potwierdzeniu), bez nadpisywania ręcznych dat.
- Klient wypływa na Pulpicie w właściwym dniu z czytelnym powodem.
- `tsc` czysty, zweryfikowane na dev, zrzut dla właściciela.
- `HUB_SETUP.md` zaktualizowany.
