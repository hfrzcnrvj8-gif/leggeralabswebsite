# Moduł 4 — Poczta przychodząca: auto-przypisanie do klienta + lista „do obsłużenia” (luka ⑦b)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> Właściciel doprecyzował cel: **żeby maile przychodzące dobrze się integrowały,
> automatycznie przypisywały do właściwego klienta i (ewentualnie) trafiały na
> listę „do przerobienia/zrobienia”.** Poniżej rekomendowana ścieżka + pomysły na
> wykorzystanie. Przed startem potwierdź z właścicielem tylko dostawcę i retencję.

## Problem (nietechnicznie)

Panel wysyła maile, ale jest jednokierunkowy — **odpowiedzi klientów są niewidoczne
w panelu**, lądują w zwykłym Gmailu/Outlooku. Żeby zobaczyć całą rozmowę, trzeba
otwierać drugą aplikację. Dlatego panel nie jest jeszcze jedyną apką do firmy.
Do tego maile klientów często zawierają **prośby/zmiany** („zmieńcie X”,
„dodajcie Y”) — a nie ma jak zamienić ich w konkretne zadanie do zrobienia.

## DECYZJA: idziemy w automatyczny ODBIÓR i przypisanie (nie pełny klient pocztowy)

Cel właściciela to **integracja + auto-przypisanie + to-do**, a nie zastąpienie
Gmaila do pisania. Więc rekomendowana ścieżka to **odbiór przychodzących przez
webhook**, z automatycznym dopięciem do klienta/leada i listą „do obsłużenia”.
Pisanie/odpowiadanie zostaje na razie w zwykłej poczcie (albo istniejąca wysyłka
z panelu). Pełny dwukierunkowy klient OAuth (Gmail/Outlook w panelu) to możliwe
przyszłe rozszerzenie, ale NIE jest potrzebne, żeby zrealizować cel — i jest
znacznie droższe w utrzymaniu.

Zachowana zasada **zero AI**: przypisanie po adresie to dopasowanie deterministyczne;
„to-do” nie jest zgadywane z treści przez model — patrz sekcja o liście niżej.

## Jak działa auto-przypisanie (sedno)

1. Klient odpisuje na maila (albo pisze pierwszy raz) na firmowy adres.
2. Dostawca poczty przekazuje maila na `POST /api/mail/inbound` (webhook).
3. Panel dopina maila do rekordu po **adresie nadawcy**:
   - `clients.email` == from → dopnij do klienta (+ wpis w jego osi kontaktu),
   - inaczej `leads.email` == from → dopnij do leada,
   - inaczej → **kolejka „Nieprzypisane”** (nic nie ginie; jedno kliknięcie
     przypisuje ręcznie albo tworzy z tego nowego leada).
4. Dedup po `message_id` (ten sam mail nie wpadnie dwa razy).

Wzmocnienia dopasowania (deterministyczne, opcjonalne): jeśli w temacie/treści
jest numer faktury (`FV/…`) albo token linku publicznego — dopnij też do
konkretnej faktury/oferty (masz już `share_token` i numerację).

## Lista „do obsłużenia / do przerobienia” (to, o co prosił właściciel)

Bez AI, dwie deterministyczne warstwy:

- **Warstwa 1 — „Wiadomości do odpowiedzi” (automatyczna).** Każdy przychodzący
  mail jest „do obsłużenia”, dopóki właściciel go nie oznaczy jako załatwiony
  (albo nie odpowie). Pokazujemy je na Pulpicie jako nową sekcję — dokładnie w
  duchu istniejącego „co dziś trzeba zrobić”. To jest ta lista „trzeba przerobić”:
  wpada prośba klienta → widnieje na Pulpicie → znika, gdy ją obsłużysz.
- **Warstwa 2 — „Z maila → zadanie” (jeden klik, ręczne).** Przy mailu przycisk
  „Utwórz zadanie w projekcie” — bierze treść maila jako opis zadania i dokłada
  je do kamienia/projektu danego klienta. Dzięki temu prośba „zmieńcie X” staje
  się konkretnym zadaniem w realizacji, bez zgadywania przez AI (to właściciel
  decyduje jednym kliknięciem, co jest zadaniem).

## Pomysły, jak to wykorzystać (propozycje — do wyboru przez właściciela)

1. **Pełny wątek na karcie klienta** — wysłane (już mamy) + przychodzące w jednej
   osi czasu. Koniec z przeskakiwaniem do Gmaila, żeby przypomnieć sobie ustalenia.
2. **Pulpit „Wiadomości do odpowiedzi”** — inbound bez reakcji ≥ np. 2 dni
   podbijane jako pilne (ta sama filozofia co zaległe faktury/leady).
3. **Auto-wykrycie „to pyta o płatność”** — jeśli inbound dopięty do klienta z
   zaległą fakturą, pokaż przy mailu skrót „→ Faktura FV/…” (deterministycznie po
   powiązaniu, bez czytania treści AI).
4. **Inbound = nowy lead** — mail z nieznanego adresu: jeden klik „Utwórz leada”
   (przechwytywanie zapytań, które dziś giną w skrzynce).
5. **„Odezwał się uśpiony klient”** — inbound od klienta w statusie „Uśpiony”
   automatycznie podbija go na Pulpicie (sam się reaktywował — reaguj szybko).
6. **Załączniki od klienta** — zapis PDF/plików z maila przy kliencie/projekcie
   (np. podpisana umowa, dane wejściowe do automatyzacji). Uwaga na RODO/retencję.
7. **Wyciszenie szumu** — proste reguły „ignoruj” (newslettery, no-reply), żeby
   lista „do obsłużenia” zawierała tylko realne rozmowy.

Rekomendacja startowa (najwięcej wartości najmniejszym kosztem): **1 + 2 + 4**
(wątek na karcie, Pulpit „do odpowiedzi”, one-click „nowy lead”). Reszta jako
kolejne małe kroki.

## Plan techniczny (odbiór przez webhook)

### Krok 1 — dostawca odbioru (decyzja właściciela)
Odbiór wymaga dostawcy z **inbound parsing / email routing**. Endpoint trzymamy
**provider-agnostyczny** (parsujemy znormalizowany JSON), żeby dało się zmienić
dostawcę bez przepisywania logiki. Kandydaci (zweryfikuj aktualne możliwości i
koszt przy budowie — NIE zakładaj z pamięci):
- **Cloudflare Email Routing → Worker/webhook** (zwykle darmowe, dobre gdy domena
  jest na Cloudflare),
- **Postmark Inbound** / **SendGrid Inbound Parse** (dojrzałe inbound),
- sprawdź, czy obecny dostawca wysyłki (`RESEND_API_KEY`) oferuje już inbound —
  jeśli tak, najmniej ruchomych części.

### Krok 2 — schemat
- `lib/db.ts` (idempotentnie): `mail_messages` (id, kierunek 'in'/'out', client_id
  NULL, lead_id NULL, invoice_id NULL, from_addr, to_addr, subject, body_text,
  body_html, message_id UNIQUE, in_reply_to, status 'nowy'/'obsłużony', received_at,
  handled_at). Indeksy: client_id, lead_id, message_id (unik = dedup), status.

### Krok 3 — endpoint inbound
- `app/api/mail/inbound/route.ts` — **publiczny** webhook, chroniony sekretem w
  nagłówku (wzorem `CRON_SECRET`: fail-closed bez sekretu; jeśli dostawca podpisuje
  payload — zweryfikuj podpis). Parsuje, dedup po `message_id`, dopina po adresie
  (klient → lead → nieprzypisane), zapisuje wpis w osi kontaktu
  (`client_activity`/`lead_activity` lub `logClientEvent`), status `nowy`.

### Krok 4 — UI
- **Karta klienta/leada:** sekcja „Wiadomości” — wątek in/out chronologicznie
  (dopnij do istniejącej osi kontaktu).
- **Pulpit:** sekcja „Wiadomości do odpowiedzi” (`status='nowy'`), z przyciskiem
  „Obsłużone” (jak przy leadach/klientach) → `status='obsłużony'`, `handled_at`.
- **Kolejka „Nieprzypisane”:** lista maili bez dopasowania + akcje „Przypisz do…”
  / „Utwórz leada”.
- **„Z maila → zadanie”:** przycisk tworzący `project_tasks`/kamień z treści maila
  dla projektu klienta.

### Krok 5 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: zasymuluj payload inbound (POST przykładowego maila) → dopięcie do
  właściwego klienta + wpis w osi + pozycja na Pulpicie „do odpowiedzi”. Drugi POST
  z tym samym `message_id` → brak duplikatu. Mail z nieznanego adresu → kolejka
  „Nieprzypisane” + „Utwórz leada”. Zrzut/log dla właściciela.

## RODO / prawo (skonsultuj z sekcją prawną projektu)
Przechowywanie treści maili to przetwarzanie danych osobowych:
- Zaktualizuj politykę prywatności (kategoria: korespondencja) — patrz
  `PO_REJESTRACJI.md` i obecna polityka.
- Ustal **retencję** (jak długo trzymamy treści/załączniki) i usuwanie na żądanie.
- Mniej przechowywanych danych = mniej ryzyka — nie zapisuj więcej, niż potrzeba
  do obsługi rozmowy.

## Otwarte decyzje (zapytaj właściciela)
1. **Dostawca odbioru** — Cloudflare Email Routing (darmowe, jeśli domena na CF)
   / Postmark / SendGrid / (sprawdzić Resend inbound)? To determinuje konfigurację.
2. **Które pomysły z listy** wdrażamy w pierwszej wersji? (rekomendacja: 1 + 2 + 4).
3. **Retencja** treści maili i załączników (RODO).
4. Czy w tej wersji potrzebujesz odpowiadania Z panelu, czy odbiór + „do
   obsłużenia” + istniejąca wysyłka wystarczy na start? (rekomendacja: na start bez
   pełnego pisania).

## Definicja ukończenia (wersja startowa)
- Przychodzący mail automatycznie dopina się do właściwego klienta/leada (albo do
  kolejki „Nieprzypisane”), z dedupem, widoczny w osi kontaktu.
- Pulpit pokazuje „Wiadomości do odpowiedzi”; „Obsłużone” je zdejmuje.
- Jeden klik: mail nieznany → nowy lead; mail klienta → zadanie w projekcie.
- Polityka prywatności zaktualizowana (retencja ustalona).
- `tsc` czysty, zweryfikowane na dev, zrzut dla właściciela, `HUB_SETUP.md`
  zaktualizowany.

## Fallback, jeśli odbiór okaże się za dużym krokiem
Wariant minimalny bez webhooka: maile z panelu mają `Reply-To` na prawdziwą
skrzynkę właściciela (odpowiedzi lądują tam, gdzie zagląda) + ręczne pole „wklej
odpowiedź klienta” w osi kontaktu. Daje część wartości bez integracji.
