# Moduł 4 — Natywna poczta w panelu (IMAP/SMTP, skrzynka az.pl) (luka ⑦b)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> Architektura ustalona z właścicielem 2026-07-13 — patrz „DECYZJA” niżej. To
> NAJWIĘKSZY moduł; przed budową potwierdź tylko szczegóły z „Otwarte decyzje”.

## Aktualizacja kontekstu (2026-07-15, przed startem)

Ten brief powstał 2026-07-13, zanim zbudowano Moduły 3 i 12 — obie zmieniają
sposób integracji poczty z kartą klienta/leada, więc przeczytaj to PRZED
Krokiem 2 i 5 niżej:

- **Moduł 3 (kanały kontaktu)** dodał `client_activity`/`lead_activity` z
  kolumnami `kanal` (telefon/email/whatsapp/linkedin/spotkanie/inne) i
  `kierunek` (`wychodzacy`/`przychodzacy`) — to już jest ten sam koncept co
  "wątek maila in/out", tylko dla telefonu/WhatsAppu/LinkedIn. `GET
  /api/clients/:id` scala `client_activity` + `client_events` +
  `lead_activity` w jeden chronologiczny feed (`ClientDetailPanel.tsx`).
  **Rekomendacja:** nie buduj osobnej sekcji "Wiadomości" na karcie klienta
  (jak sugerował Krok 5 niżej) — zamiast tego przy każdym zsynchronizowanym
  mailu (przychodzącym i odpowiedzi) dopisz też wiersz do
  `client_activity`/`lead_activity` z `kanal='email'` i odpowiednim
  `kierunek`, żeby mail pojawił się automatycznie w istniejącym scalonym
  feedzie, z tą samą ikoną/kolorem co reszta kanałów (`CONTACT_CHANNEL_CLASS`
  w `lib/contact.ts`) i tym samym progiem "czeka na odpowiedź". Pełna treść
  maila zostaje w `mail_messages` (Krok 2) — wpis w `client_activity` to
  tylko skrót (temat/pierwsza linia) + link do pełnego widoku w „Poczta”.
  Prawdopodobnie trzeba dodać `client_activity.related_id`/
  `mail_message_id` (analogicznie do `client_events.related_id` z Modułu 12)
  do linkowania wprost do maila — potwierdź to podejście na starcie czatu,
  to decyzja architektoniczna, nie biznesowa.
- **Moduł 12 (fundament linkowania)** dodał klikalną oś czasu z
  `related_id` na `client_events` (`CLIENT_EVENT_TARGET` w `lib/clients.ts`
  ustala URL na podstawie `kind`) — jeśli wolisz logować maile jako
  `client_events` zamiast `client_activity`, ten sam mechanizm linkowania
  już istnieje i można go rozszerzyć o `kind='mail_received'`/
  `'mail_sent'`. Do ustalenia w nowym czacie, które z dwóch pasuje lepiej
  (rekomendacja: `client_activity`, bo mail to kontakt inicjowany przez
  klienta/nas, jak telefon, nie "zdarzenie systemowe" typu wystawienie
  faktury).
- Reszta briefu (auto-przypisanie po adresie, IMAP/SMTP, dedup po
  `message_id`, Pulpit „Wiadomości do odpowiedzi”, „Z maila → zadanie”)
  nadal aktualna bez zmian.

## Czego chce właściciel (jego słowami, doprecyzowane)

> „Dostaję maila → chcę to widzieć w aplikacji, z podglądem, dopasowane do
> klienta. Klikam Odpisz → prowadzę korespondencję.”

Kontekst techniczny (kluczowy): poczta właściciela jest hostowana na **az.pl**
(zwykła skrzynka **IMAP/SMTP**). Outlook to tylko program-czytnik tej skrzynki —
**NIE ma konta Microsoft 365 / Exchange**, więc Microsoft Graph/OAuth NIE wchodzi
w grę i nie jest potrzebny.

## DECYZJA: natywny moduł poczty przez IMAP/SMTP do skrzynki az.pl

Skoro to zwykła skrzynka IMAP/SMTP, panel łączy się z nią bezpośrednio:
- **Odczyt (IMAP):** pobiera przychodzące, podgląd, auto-dopasowanie do klienta.
- **Wysyłka/odpowiedź (SMTP az.pl):** odpowiadamy Twoim adresem z poprawnymi
  nagłówkami wątku (`In-Reply-To`/`References`) → odpowiedź **trafia w ten sam
  wątek**; kopię dopisujemy do folderu „Sent” przez IMAP APPEND, więc widać ją
  też w Outlooku.

**Dlaczego natywnie, a nie „przenieś do Outlooka”:** to ta SAMA skrzynka az.pl,
którą czyta Outlook — panel i Outlook są spójne (odpiszesz w jednym, widać w
drugim). Nie trzeba OAuth ani przekierowań. To najczystsze rozwiązanie dla tego
setupu. Odpowiadanie z panelu jest rekomendowane; „otwórz w Outlooku” zostaje jako
opcjonalny skrót.

**Zero AI** — dopasowanie po adresie jest deterministyczne; „to-do” nie jest
zgadywane z treści przez model (patrz sekcja o liście).

## Uczciwe ograniczenia (nie blokery, ale trzeba je znać)

1. **Dane logowania do skrzynki.** Panel potrzebuje IMAP/SMTP host + login +
   hasło az.pl (najlepiej osobne „hasło aplikacji”, jeśli az.pl oferuje). Trzymane
   WYŁĄCZNIE po stronie serwera (env Vercela: `MAIL_IMAP_HOST/PORT/USER/PASS`,
   `MAIL_SMTP_HOST/PORT`), nigdy w przeglądarce. To ten sam poziom zaufania co
   `DATABASE_URL`. Powiedzieć właścicielowi wprost: panel zyskuje dostęp do poczty.
2. **Brak natychmiastowego push na Vercelu.** Funkcje serverless są krótkie i nie
   utrzymują stałego połączenia IMAP. Model = **polling**: pobieramy nowe maile
   (a) przy otwarciu widoku poczty (on-demand: połącz IMAP → pobierz od ostatniego
   UID → zapisz → rozłącz), (b) okresowo w istniejącym dziennym cronie
   (`app/api/leads/notify`). Nie ma „dinga” w sekundę — od tego jest Outlook.
3. **Czym wysyłać.** Faktury/oferty mogą dalej iść przez Resend (dostarczalność),
   a osobiste odpowiedzi do klientów — przez SMTP az.pl (żeby wątkowały się i
   lądowały w „Sent”). Do ustalenia (patrz „Otwarte decyzje”).
4. **Runtime = nodejs** dla wszystkich tras poczty (IMAP/SMTP to TCP, nie Edge).

## Auto-przypisanie do klienta (sedno)

Dla każdego pobranego maila dopnij po **adresie nadawcy**:
- `clients.email` == from → klient (+ wpis w jego osi kontaktu),
- inaczej `leads.email` == from → lead,
- inaczej → **kolejka „Nieprzypisane”** (nic nie ginie; klik przypisuje ręcznie
  albo tworzy nowego leada).
Dedup po `message_id`. Wzmocnienie (opcjonalne, deterministyczne): numer faktury
(`FV/…`) lub `share_token` w temacie/treści → dopnij też do faktury/oferty.

## Lista „do obsłużenia / do przerobienia” (to, o co prosił właściciel)

Bez AI, dwie warstwy:
- **Warstwa 1 — „Wiadomości do odpowiedzi” (automatyczna).** Każdy przychodzący
  mail jest „do obsłużenia”, dopóki go nie oznaczysz/nie odpowiesz. Pokazujemy na
  Pulpicie jako nową sekcję — w duchu „co dziś trzeba zrobić”.
- **Warstwa 2 — „Z maila → zadanie” (jeden klik).** Przycisk zamienia treść maila
  w zadanie/kamień w projekcie danego klienta. Prośba „zmieńcie X” staje się
  konkretnym zadaniem — bez zgadywania przez AI (Ty decydujesz kliknięciem).

## Pomysły na wykorzystanie (do wyboru; rekomendacja startowa: 1 + 2 + 4)
1. **Pełny wątek na karcie klienta** — wysłane + przychodzące w jednej osi.
2. **Pulpit „Wiadomości do odpowiedzi”** — inbound bez reakcji ≥ np. 2 dni podbijany.
3. **„To pyta o płatność”** — inbound od klienta z zaległą fakturą pokazuje skrót
   „→ Faktura FV/…” (po powiązaniu, bez czytania treści AI).
4. **Inbound = nowy lead** — mail z nieznanego adresu → klik „Utwórz leada”.
5. **Odezwał się uśpiony klient** — inbound od „Uśpionego” podbija go na Pulpicie.
6. **Załączniki od klienta** — zapis PDF/plików przy kliencie/projekcie (RODO!).
7. **Wyciszenie szumu** — reguły „ignoruj” (newslettery/no-reply), by lista „do
   obsłużenia” miała tylko realne rozmowy.

## Plan techniczny

### Krok 1 — biblioteki i konfiguracja
- Zależności (node-only): `imapflow` (IMAP), `mailparser` (parsowanie MIME),
  `nodemailer` (SMTP). Wszystkie trasy poczty `export const runtime = "nodejs"`.
- Env w Vercelu: `MAIL_IMAP_HOST`, `MAIL_IMAP_PORT` (993), `MAIL_USER`,
  `MAIL_PASS`, `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT` (465/587). Wartości z panelu
  az.pl (host typu `imap.az.pl`/`serwerXXX.az.pl` — właściciel poda z panelu az.pl).
- `lib/mail.ts` — cienka warstwa: `fetchNewMessages(sinceUid)`, `sendReply(...)`,
  `appendToSent(...)`. Czysta, server-only, bez `"use client"`.

### Krok 2 — schemat
- `lib/db.ts` (idempotentnie): `mail_messages` (id, uid INTEGER, kierunek
  'in'/'out', client_id NULL, lead_id NULL, invoice_id NULL, from_addr, to_addr,
  subject, body_text, body_html, message_id UNIQUE, in_reply_to, references,
  status 'nowy'/'obsłużony', received_at, handled_at). Indeksy: client_id,
  lead_id, message_id (unik = dedup), status. Zapamiętaj `last_seen_uid` (np. w
  `company_settings` lub własnej 1-wierszowej tabeli) do pobierania przyrostowego.

### Krok 3 — pobieranie (IMAP)
- `POST /api/mail/sync` (admin-only): połącz IMAP → pobierz wiadomości > `last_seen_uid`
  → parsuj → dopnij do klienta/leada → zapisz → zaktualizuj `last_seen_uid` →
  rozłącz. Wywoływane: przy otwarciu widoku poczty i z crona `leads/notify`.
- Idempotentne dzięki `message_id UNIQUE` (podwójny sync nie duplikuje).

### Krok 4 — odpowiadanie (SMTP)
- `POST /api/mail/[id]/reply` (admin-only): wyślij przez SMTP az.pl z
  `In-Reply-To`/`References` oryginału → dopisz kopię do „Sent” (IMAP APPEND) →
  zapisz jako `mail_messages` kierunek 'out' → oznacz oryginał `obsłużony`.

### Krok 5 — UI
- Nowa pozycja nawigacji „Poczta” (`AppShell.tsx`, skrót `g m` lub wolny) —
  lista wiadomości + podgląd + odpowiadanie w panelu (albo skrót „otwórz w
  Outlooku”). Design system jak reszta (`.card-paper`, `.hairline`, `useUI()`).
- **Karta klienta/leada:** BEZ osobnej sekcji „Wiadomości” — patrz „Aktualizacja
  kontekstu” na górze pliku (wpis w scalonym feedzie przez `client_activity`/
  `lead_activity`, kanał=email, jak reszta kontaktów z Modułu 3).
- **Pulpit:** sekcja „Wiadomości do odpowiedzi” (`status='nowy'`), „Obsłużone”
  jak przy leadach/klientach.
- **Kolejka „Nieprzypisane”** + akcje „Przypisz do…”/„Utwórz leada”.
- **„Z maila → zadanie”** — tworzy `project_tasks`/kamień z treści.

### Krok 6 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: bez realnego IMAP zasymuluj wiadomość (wstaw wprost do `mail_messages` w
  seedzie PGlite albo mockiem `fetchNewMessages`) → sprawdź dopasowanie do klienta,
  podgląd, pozycję na Pulpicie „do odpowiedzi”, „Obsłużone”, „Utwórz leada”,
  „z maila → zadanie”. Realny IMAP/SMTP testuje się dopiero z env az.pl na Vercelu
  (ten sam handoff co przy KSeF — dev nie ma dostępu do skrzynki).

## RODO / prawo (skonsultuj z sekcją prawną projektu)
Przechowywanie treści maili = przetwarzanie danych osobowych:
- Zaktualizuj politykę prywatności (kategoria: korespondencja) — `PO_REJESTRACJI.md`.
- Ustal **retencję** (jak długo trzymamy treści/załączniki) i usuwanie na żądanie.
- Nie zapisuj więcej, niż trzeba do obsługi rozmowy.

## Otwarte decyzje (zapytaj właściciela)
1. **Hasło aplikacji az.pl** — czy az.pl oferuje osobne hasło aplikacji dla IMAP/
   SMTP? (bezpieczniejsze niż główne hasło). Właściciel poda host IMAP/SMTP z
   panelu az.pl.
2. **Ścieżka wysyłki** — odpowiedzi przez SMTP az.pl (wątkowanie + „Sent”), a
   faktury/oferty dalej Resend? Czy wszystko przez az.pl?
3. **Które pomysły z listy** w pierwszej wersji (rekomendacja 1 + 2 + 4).
4. **Retencja** treści i załączników (RODO).
5. **Częstotliwość auto-syncu** w cronie (przy otwarciu widoku i raz dziennie?
   częściej?).
6. **`client_activity` czy `client_events`** dla wpisu maila na osi klienta
   (patrz „Aktualizacja kontekstu” na górze) — to decyzja techniczna, możesz
   ją podjąć sam wg rekomendacji, ale zasygnalizuj właścicielowi wybór.

## Definicja ukończenia (wersja startowa)
- Przychodzące maile z az.pl pobierają się (on-demand + cron), auto-dopinają do
  klienta/leada (lub „Nieprzypisane”), z dedupem, widoczne z podglądem.
- Odpowiedź z panelu wątkuje się poprawnie i pojawia w „Sent”/Outlooku.
- Pulpit „Wiadomości do odpowiedzi”; „Obsłużone” zdejmuje. Klik: nieznany → lead,
  klient → zadanie w projekcie.
- Polityka prywatności zaktualizowana (retencja ustalona).
- `tsc` czysty, zweryfikowane na dev (mock/seed), `HUB_SETUP.md` zaktualizowany.
