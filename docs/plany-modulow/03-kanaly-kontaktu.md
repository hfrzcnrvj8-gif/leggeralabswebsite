# Moduł 3 — Kanały kontaktu: telefon / WhatsApp / LinkedIn (luka ⑦a)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> Potem zaproponuj plan, zadaj pytania z „Otwarte decyzje", dopiero buduj.

## Problem (nietechnicznie)

Panel umie tylko **mail** (wysyłka ofert/faktur/przypomnień). Ale realny pierwszy
kontakt z tymi leadami to często **telefon** — widać to w danych startowych
(`SEED` w `lib/leads.ts`): mnóstwo kancelarii, notariuszy i klinik ma **tylko
numer telefonu, bez maila**. Dla nich cała maszyna mailowa nie ma zastosowania,
a panel nie daje żadnego ustrukturyzowanego sposobu, żeby:

- zapisać „zadzwoniłem 13.07, rozmawiałem z sekretariatem, oddzwonić w piątek",
- zobaczyć, którym kanałem i kiedy był ostatni kontakt,
- szybko zainicjować kontakt (klik w numer = telefon, klik = WhatsApp/LinkedIn).

Dziś da się to wpisać najwyżej jako wolną notatkę — nie widać tego w osi kontaktu
jako „rozmowa telefoniczna" i nie liczy się do reguł „minęło X dni od kontaktu".

## Zakres

**W zakresie:**
1. **Ustrukturyzowany typ kontaktu** przy wpisie do osi (lead i klient):
   telefon / e-mail / WhatsApp / LinkedIn / spotkanie / inne — z ikoną (emoji).
2. **Szybkie akcje** na karcie leada/klienta: klik w telefon → `tel:`, w mail →
   `mailto:`, opcjonalnie WhatsApp (`https://wa.me/<nr>`) i LinkedIn (jeśli mamy
   URL). To tylko odnośniki — panel nic nie wysyła sam.
3. **„Ostatni kontakt" liczony ze wszystkich kanałów**, nie tylko z maila — żeby
   reguły „odezwij się" działały też dla leadów telefonicznych.

**Poza zakresem:** integracja z bramką SMS/WhatsApp Business API (wysyłka z
panelu), nagrywanie rozmów, VoIP. To osobny, duży temat — tu robimy tylko
**rejestr i szybkie odnośniki**, nie wysyłkę.

## Stan faktyczny (co już jest)

- Oś kontaktu leada: tabela `lead_activity` + endpoint
  `app/api/leads/[id]/activity/` (POST dodaje wpis, ustawia `ostatni_kontakt` /
  `next_followup`). Panel: `LeadDetailPanel.tsx` (sekcja `activity`).
- Oś klienta: `client_activity` (ręczne notatki) + `client_events` (auto-zdarzenia
  systemowe), scalane w `GET /api/clients/[id]`.
- `logClientEvent()` w `lib/db.ts` dla zdarzeń systemowych.
- Lead ma pola `telefon`, `email`, `www`; klient analogicznie.
- `ostatni_kontakt` na leadzie steruje regułą „Napisano — czeka na odpowiedź ≥4
  dni" (`isOverdue` w `lib/leads.ts`).

## Plan techniczny

### Krok 1 — typ kanału na wpisie osi
- Migracja w `lib/db.ts`: `ALTER TABLE lead_activity ADD COLUMN IF NOT EXISTS
  kanal TEXT;` oraz to samo dla `client_activity`. Wartość domyślna null =
  „notatka"/nieokreślony.
- `lib/leads.ts` / `lib/clients.ts`: `export const CONTACT_CHANNELS` (lista) +
  `CONTACT_CHANNEL_ICON: Record<...>` (emoji: 📞 telefon, ✉️ mail, 💬 WhatsApp,
  in LinkedIn, 🤝 spotkanie, 📝 inne).

### Krok 2 — UI dodawania wpisu z kanałem
- W `LeadDetailPanel.tsx` (i analogicznie kliencie): przy polu dodawania notatki
  dorzuć mały select kanału (wzorem selektorów w `CalendarView.tsx`). POST osi
  wysyła `kanal`. Render wpisu pokazuje ikonę kanału.
- Endpointy `.../activity` POST: przyjmij i zapisz `kanal` (walidacja: musi być z
  listy albo null).

### Krok 3 — szybkie odnośniki (klik = kontakt)
- Na karcie leada/klienta zrób z `telefon` link `tel:`, z `email` link `mailto:`.
  Jeśli jest telefon → opcjonalny przycisk WhatsApp (`https://wa.me/` +
  znormalizowany numer, bez spacji/znaków). Jeśli `www`/LinkedIn URL → link.
- To zwykłe `<a>` — panel niczego nie wysyła, tylko otwiera aplikację/stronę.

### Krok 4 — „ostatni kontakt" ze wszystkich kanałów
- Upewnij się, że KAŻDY wpis do osi (niezależnie od kanału) aktualizuje
  `ostatni_kontakt` leada — dziś prawdopodobnie tak jest przy notatce; sprawdź i
  ujednolić. Dzięki temu telefon „resetuje zegar" tak samo jak mail.
- Rozważ (zapytaj): czy leady bez maila powinny mieć inną regułę „overdue"
  (mail-based reminder ich nie dotyczy — może „X dni od ostatniego kontaktu
  dowolnym kanałem")?

### Krok 5 — weryfikacja
- `npx tsc --noEmit`.
- Dev: dodaj leadowi wpis „telefon", sprawdź ikonę w osi i że `ostatni_kontakt`
  się zaktualizował; klik w `tel:`/`mailto:` (potwierdź, że link poprawny).
  Zrzut dla właściciela.

## Otwarte decyzje (zapytaj właściciela)
1. **Lista kanałów** — telefon/mail/WhatsApp/LinkedIn/spotkanie/inne wystarczy?
2. **WhatsApp** — chcesz przycisk `wa.me`? (wymaga numeru w formacie
   międzynarodowym; część seed-leadów ma numery w różnych formatach).
3. **Reguła overdue dla leadów bez maila** — zostawić wspólną, czy osobną „X dni
   od ostatniego kontaktu"?

## Definicja ukończenia
- Wpis do osi leada/klienta ma wybór kanału (z ikoną), widoczny w historii.
- Klik w telefon/mail (i opcjonalnie WhatsApp/LinkedIn) inicjuje kontakt.
- „Ostatni kontakt" i reguły przypomnień działają dla kontaktu telefonicznego,
  nie tylko mailowego.
- `tsc` czysty, zweryfikowane na dev, zrzut dla właściciela.
- `HUB_SETUP.md` zaktualizowany.
