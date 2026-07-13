# Moduł 3 — Kanały kontaktu: telefon / WhatsApp / LinkedIn (luka ⑦a)

> ✅ ZROBIONE (2026-07-14) — szczegóły w `HUB_SETUP.md` → „Moduł 3 — Kanały
> kontaktu”. Dodatkowo ponad pierwotny plan: kierunek kontaktu (Ja→oni/Oni→ja)
> na każdym wpisie osi, tekstowy „następny krok” (`next_action`) obok daty
> przypomnienia, ikona ostatniego kanału na kartach kanban.

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> Architektura zdecydowana — patrz „DECYZJA”. Zaprojektowane od razu pod telefon
> (patrz [05-mobilna-aplikacja.md](05-mobilna-aplikacja.md)): na komórce te akcje
> stają się naprawdę użyteczne (dotyk w numer = dzwoni, w WhatsApp = otwiera apkę).

## Problem (nietechnicznie)

Panel umie tylko **mail**. Ale realny pierwszy kontakt z tymi leadami to często
**telefon** — widać to w danych startowych (`SEED` w `lib/leads.ts`): mnóstwo
kancelarii, notariuszy i klinik ma **tylko numer telefonu, bez maila**. Dla nich
maszyna mailowa nie istnieje, a panel nie daje ustrukturyzowanego sposobu, żeby:
- zapisać „zadzwoniłem 13.07, gadałem z sekretariatem, oddzwonić w piątek”,
- zobaczyć, którym kanałem i kiedy był ostatni kontakt,
- **jednym dotknięciem zainicjować kontakt** (numer → telefon, WhatsApp, LinkedIn).

Dziś da się to wpisać najwyżej jako luźną notatkę — nie widać tego w osi jako
„rozmowa telefoniczna” i nie liczy się do reguł „minęło X dni od kontaktu”.

## DECYZJA: rejestr kanałów + szybkie odnośniki (bez wysyłki z panelu)

Robimy **rejestr i szybkie odnośniki**, NIE bramkę SMS/WhatsApp Business API.
Panel nie wysyła SMS/WhatsApp sam — daje odnośniki, które otwierają odpowiednią
aplikację na urządzeniu (na telefonie: dzwoni / otwiera WhatsApp / LinkedIn).
To najwięcej wartości najmniejszym kosztem i zgodnie z zasadą „miękko, nie za
właściciela”. Zero AI. Trzy decyzje podjęte z góry (potwierdź tylko szczegóły):

1. **Kanały:** telefon 📞, mail ✉️, WhatsApp 💬, LinkedIn (emoji do wyboru),
   spotkanie 🤝, inne 📝.
2. **WhatsApp: TAK** — przycisk `https://wa.me/<nr>` (na telefonie otwiera apkę
   WhatsApp; na desktopie WhatsApp Web). Warunek: numer znormalizowany do formatu
   międzynarodowego (patrz Krok 3).
3. **Leady bez maila:** reguła „wymaga kontaktu” liczona od **ostatniego kontaktu
   DOWOLNYM kanałem** (nie tylko mailem), żeby telefoniczne leady też były pilnowane.

## Stan faktyczny (co już jest)

- Oś kontaktu leada: `lead_activity` + `app/api/leads/[id]/activity/` (POST dodaje
  wpis, ustawia `ostatni_kontakt`/`next_followup`). UI: `LeadDetailPanel.tsx`.
- Oś klienta: `client_activity` (notatki) + `client_events` (auto), scalane w
  `GET /api/clients/[id]`. `logClientEvent()` w `lib/db.ts`.
- Lead/klient mają `telefon`, `email`, `www`.
- `ostatni_kontakt` steruje regułą „Napisano — czeka na odpowiedź ≥4 dni”
  (`isOverdue` w `lib/leads.ts`).

## Plan techniczny

### Krok 1 — typ kanału na wpisie osi
- Migracja w `lib/db.ts` (idempotentnie): `ALTER TABLE lead_activity ADD COLUMN
  IF NOT EXISTS kanal TEXT;` oraz to samo dla `client_activity`. Null = notatka
  nieokreślona.
- `lib/leads.ts`/`lib/clients.ts`: `export const CONTACT_CHANNELS` (lista) +
  `CONTACT_CHANNEL_ICON: Record<...>` (emoji per kanał).

### Krok 2 — UI dodawania wpisu z kanałem
- W `LeadDetailPanel.tsx` (i analogicznie kliencie): przy dodawaniu notatki mały
  select kanału (wzorem selektorów w `CalendarView.tsx`). POST osi wysyła `kanal`.
  Render wpisu pokazuje ikonę kanału. Endpoint `.../activity` POST: przyjmij i
  zapisz `kanal` (walidacja: z listy albo null).

### Krok 3 — szybkie odnośniki (dotyk = kontakt; kluczowe na telefonie)
- Z `telefon` zrób `<a href="tel:...">`, z `email` `<a href="mailto:...">`.
- **WhatsApp:** helper `waLink(telefon)` — usuń spacje/nawiasy/myślniki, dołóż kod
  kraju (domyślnie +48, jeśli numer 9-cyfrowy krajowy), zwróć `https://wa.me/<nr>`.
  Pokaż przycisk tylko gdy numer da się znormalizować.
- **LinkedIn:** jeśli w `www`/dedykowanym polu jest URL LinkedIn → link.
- To zwykłe `<a>` — panel niczego nie wysyła. Na telefonie każdy z nich otwiera
  właściwą aplikację; na desktopie: domyślny klient/WhatsApp Web/przeglądarka.
- Rozmieść je jako wyraźne, duże cele dotykowe (min. ~44px) — patrz standard
  mobilny w module 5.

### Krok 4 — „ostatni kontakt” ze wszystkich kanałów
- Upewnij się, że KAŻDY wpis do osi (niezależnie od kanału) aktualizuje
  `ostatni_kontakt` leada — telefon „resetuje zegar” tak samo jak mail.
- Dla leadów **bez maila** reguła „wymaga kontaktu” = „X dni od ostatniego kontaktu
  dowolnym kanałem” (dobierz próg spójnie z istniejącym ≥4 dni; potwierdź wartość).

### Krok 5 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: dodaj leadowi wpis „telefon” → ikona w osi + `ostatni_kontakt`
  zaktualizowany; sprawdź poprawność linków `tel:`/`mailto:`/`wa.me`. Zweryfikuj na
  wąskim viewporcie (`resize_window preset:"mobile"`), że przyciski są dotykalne.
  Zrzut dla właściciela.

## Otwarte decyzje (drobne — nie blokuj)
1. **Emoji dla LinkedIn** i czy dodać osobne pole `linkedin_url`, czy wykrywać z `www`.
2. **Próg „wymaga kontaktu”** dla leadów bez maila (dni od ostatniego kontaktu).
3. **Domyślny kod kraju** do WhatsApp (proponuję +48; numery z SEED bywają w
   różnych formatach — normalizacja odrzuci te, których nie da się jednoznacznie
   ustawić, i po prostu nie pokaże przycisku).

## Definicja ukończenia
- Wpis do osi leada/klienta ma wybór kanału (z ikoną), widoczny w historii.
- Dotyk w telefon/mail/WhatsApp/LinkedIn inicjuje kontakt (świetnie działa na
  komórce).
- „Ostatni kontakt” i reguły przypomnień działają dla telefonu, nie tylko maila.
- `tsc` czysty, zweryfikowane na dev (w tym wąski viewport), zrzut dla właściciela.
- `HUB_SETUP.md` zaktualizowany.
