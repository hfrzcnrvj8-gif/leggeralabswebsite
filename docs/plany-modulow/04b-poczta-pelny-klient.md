# Moduł 4b — Poczta: pełny klient (pisanie, foldery IMAP, screener)

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md` i sekcję
> „Moduł 4" w `HUB_SETUP.md` (fundament, na którym to stoi).
> Powstał 2026-07-15 po tym, jak właściciel przetestował Moduł 4 na żywo na
> produkcji i zgłosił, czego brakuje. **Kolejność i decyzje są jego.**

## Następny krok — nowy czat (po wdrożeniu 2026-07-16)

2026-07-16 wdrożono **rdzeń Etapu 2** niżej (foldery IMAP: Odebrane/Wysłane/
Kosz/Archiwum, bezpieczny MOVE, sidebar, nawigacja klawiaturą, zaznaczanie
wielu) — pełny opis w `HUB_SETUP.md` → „Moduł 4 — Etap 2 (foldery IMAP)".
**Zanim zaczniesz cokolwiek nowego budować w tym module, w nowym czacie:**

1. Zapytaj właściciela, czy wykonał checklistę weryfikacji produkcyjnej z
   `HUB_SETUP.md` (ta sama sekcja, na końcu): testowy mail z Outlooka →
   pojawia się w „Wysłane"?; "Usuń"/"Archiwizuj" na testowym mailu →
   faktycznie ląduje w prawdziwym Koszu/Archiwum w Outlooku (nie znika
   bezpowrotnie)?; `vercel logs` bez ostrzeżeń o brakujących capabilities
   `MOVE`/`UIDPLUS`? **Nie dało się tego zweryfikować z sesji, która to
   zbudowała — brak dostępu do az.pl z tamtego środowiska.**
2. Jeśli coś nie działa — napraw na podstawie realnych logów z produkcji
   (ten sam wzorzec iteracyjnych poprawek, co przy Module 8/OCR: `vercel
   logs`, konkretny błąd, poprawka, redeploy, sprawdź ponownie).
3. Jeśli wszystko działa — zapytaj właściciela, co dalej:
   - dokończenie Etapu 2 (Drafts/CONDSTORE/pełne flagi/outbox+cron — patrz
     sekcja „Świadomie odłożone" niżej, każdy punkt ma uzasadnienie, czemu
     nie wszedł w pierwszą rundę),
   - **Etap 3 jest teraz w całości ✅ ZROBIONY** (screener/wątkowanie/VIP/
     snooze 2026-07-16, follow-up nudge 2026-07-16 — patrz `HUB_SETUP.md` →
     „Moduł 4f").

## Skąd to się wzięło

Moduł 4 (poczta IMAP/SMTP az.pl) działa na produkcji: pobiera, dopina do
klienta/leada, odpowiada z wątkowaniem, renderuje HTML w piaskownicy,
kategoryzuje, wycisza szum. Właściciel użył go na prawdziwej skrzynce i
powiedział wprost: **„lepiej, ale wciąż daleko od ideału"**. Brakuje mu tego,
co ma każdy normalny program pocztowy — i ma rację.

Zrobiono od razu (2026-07-15, commit `0ebb09f`): liczniki przy każdej
kategorii, wyszukiwarka, kropka nieprzeczytanych, dociąganie nagłówków po
UID-zie dla starych maili (Calendly lądował w „Zapytaniach").

**Zostało to, co niżej.** Zakres jest duży i świadomie wielosesyjny.

## Decyzje właściciela (2026-07-15) — NIE zmieniaj bez pytania

1. **Pełna synchronizacja folderów i flag IMAP.** Wybrał najtrudniejszą z
   trzech opcji, znając koszt. Powód: panel i Outlook mają się NIE rozjeżdżać.
   Wersja „wszystko po naszej stronie" była na stole i została odrzucona.
2. **Wzorce z researchu do wdrożenia:** screener nowych nadawców (HEY/Spark),
   snooze z nazwanymi terminami (Fastmail), przypomnienie o braku odpowiedzi
   (Superhuman/Gmail nudges), cofnij wysyłkę + szablony.
3. **Podpisy PL/EN/DE — przełącznik ręczny** przy pisaniu (domyślnie PL).
   NIE automatyczne wykrywanie po kraju klienta — właściciel chce wiedzieć, co
   podpina.
4. **Zaczynamy od pisania i odpowiadania** (nowa wiadomość, przekaż, odpowiedz
   wszystkim, podpisy), a nie od fundamentu IMAP. Uzasadnienie: dziś panel
   umie tylko odpisać nadawcy, więc nie da się nim zastąpić Outlooka.

## Kolejność (wg decyzji właściciela)

### Etap 1 — Pisanie i odpowiadanie (✅ ZAMKNIĘTY 2026-07-15)

**✅ ZROBIONE 2026-07-15** (szczegóły w `HUB_SETUP.md` → „Moduł 4 — trzecia tura"):
- **Podpisy PL/EN/DE** — `lib/mailSignature.ts`, przełącznik przy pisaniu
  (domyślnie PL) + „Bez podpisu". HTML z prawdziwym tekstem i linkami, obrazki
  jako `cid:`, baner jako HTML (nie PNG), zawsze multipart text+HTML.
  Adres: `kontakt@leggeralabs.pl` — rozbieżność z PNG-ami rozstrzygnięta
  przez właściciela. Stare `stopka_mailowa_*.png` są **nieużywane**
  (zostawione w repo; do usunięcia przy okazji, jeśli właściciel potwierdzi).
- **Odpowiedź w HTML** — `sendReply()` przyjmuje `html` + `inlineImages`.
- **DW (Cc)** przy odpowiadaniu.
- **„Utwórz klienta z maila"** obok „Utwórz leada"
  (`POST /api/mail/[id]/create-client`).

**✅ ZROBIONE 2026-07-15, druga część Etapu 1** (szczegóły w `HUB_SETUP.md` →
„Moduł 4b — Etap 1: pisanie i odpowiadanie"):
- **Nowa wiadomość** (`POST /api/mail/compose`), **Przekaż**
  (`POST /api/mail/[id]/forward`), **Odpowiedz wszystkim** (prefill pola DW z
  `mail_messages.cc_addr` oryginału — bez osobnej trasy). Odbiorca: z bazy
  (klienci/leady z e-mailem) LUB dowolny adres wpisany ręcznie (decyzja
  właściciela — odbiorca nie musi być w CRM).
- **DW przychodzących** (`cc_addr`, nullable, backfill po UID-zie dla starej
  korespondencji) — bez tego "Odpowiedz wszystkim" nie miałoby skąd wziąć
  adresów.
- **Cofnij wysyłkę** — 10 s odliczania PO STRONIE KLIENTA (nie kolejka
  serwerowa — Vercel nie utrzymuje stanu między zimnymi startami), dotyczy
  wszystkich ścieżek wysyłki (Odpisz/Wszystkim/Przekaż/Nowa).
- **Szablony wiadomości** (`mail_templates`: nazwa+temat+treść) — wzorem
  `offer_templates`, bez seeda.

⚠️ **Nadal do rozważenia:** dane podpisu (telefon, rola) siedzą dziś w kodzie
(`SIGNATURE_IDENTITY`). Świadomie — to zasób marki, nie ustawienie do zmiany
co tydzień. Jeśli właściciel poprosi o edycję z panelu, przenieść do
`company_settings`.

### Etap 2 — Fundament: foldery i flagi IMAP

**✅ RDZEŃ ZROBIONY 2026-07-16** (po audycie UX zgłoszonym przez właściciela —
patrz `HUB_SETUP.md` → „Moduł 4 — Etap 2 (foldery IMAP)" dla pełnego opisu):
prawdziwe foldery Odebrane/Wysłane/Kosz/Archiwum (special-use discovery,
kursory per folder w `mail_folders`, bezpieczny MOVE zamiast EXPUNGE, czytanie
Sent z powrotem), sidebar w stylu Apple Mail, nawigacja klawiaturą (j/k/Enter/
r/e), zaznaczanie wielu + akcje zbiorcze. **Świadomie odłożone w tej samej
sesji** (uzasadnienie niżej, nieprzekreślone punkty): CONDSTORE/QRESYNC,
pełne dwukierunkowe flagi `\Seen`/`\Answered`/`\Flagged`, Robocze (Drafts),
przepisanie na architekturę outbox+cron (dziś MOVE i sync nadal wołane
synchronicznie z żądania, jak `sendMail`/`appendToSent` — utrzymanie status
quo, nie pogłębienie długu).

**Oryginalny zakres (przed sesją 2026-07-16) — nieprzekreślone punkty NIE są
zrobione:**

- ✅ **Special-use folders (RFC 6154)** — `discoverMailFolders()` w
  `lib/mailbox.ts` (2026-07-16): `LIST (SPECIAL-USE)` najpierw, fallback po
  nazwach dopiero potem (Sent/Trash/Archive; Drafts/Junk świadomie poza
  zakresem). XLIST NIE dodany (starsze rozszerzenie Gmaila, ImapFlow/az.pl nie
  wymaga go osobno) — jeśli SPECIAL-USE+nazwy okażą się niewystarczające na
  produkcji, to kolejny krok.
- ✅ **Kursory per folder** — tabela `mail_folders` (`lib/db.ts`, rola +
  `imap_path` + `uidvalidity` + `last_seen_uid`), migrowana z `mail_state`
  (INBOX) bez utraty postępu. `HIGHESTMODSEQ`/CONDSTORE NIE dodane — patrz
  niżej.
- **CONDSTORE/QRESYNC (RFC 7162)** — pobieraj TYLKO zmiany od ostatniego
  `HIGHESTMODSEQ`. To odpowiednik `history.list` z Gmail API. ImapFlow
  wykrywa rozszerzenia automatycznie. **Nadal odłożone** (2026-07-16) —
  czysta optymalizacja wydajności syncu, zero wpływu na to, co widzi
  właściciel; UID-range fetch per folder (już zaimplementowany) wystarcza na
  pierwszą wersję.
- **Flagi** — `\Seen`, `\Answered`, `\Flagged`, `\Draft`, `\Deleted`. Lustro w
  obie strony: oflagowane w Outlooku widać w panelu i odwrotnie.
  ⚠️ Sprawdzaj `PERMANENTFLAGS` na SELECT: `\*` = wolno tworzyć własne
  keywordy. Bez tego zapis keyworda może zostać **po cichu zignorowany**.
  **Wsparcie Dovecota (prawdopodobny silnik az.pl) dla własnych keywordów NIE
  zostało zweryfikowane — przetestuj empirycznie zanim na tym zbudujesz.**
  **Nadal odłożone** (2026-07-16) — osobna, spora funkcja (dwustronny sync).
  Efekt uboczny za darmo: `messageMove()` (RFC 6851 MOVE) z definicji
  zachowuje flagi wiadomości przy przenoszeniu, więc to nie jest zerowy postęp.
- ✅ **Kosz vs kasowanie** — trzy RÓŻNE rzeczy: archiwizacja = MOVE do
  `\Archive`; usunięcie = MOVE do `\Trash`; `\Deleted`+EXPUNGE = nieodwracalne.
  **Każda akcja „usuń" w UI ma być MOVE do Trash. NIGDY nie EXPUNGE'uj
  automatycznie** (zgodne z zasadą projektu o nieodwracalnych operacjach).
  Zrobione: `moveMessage()` w `lib/mailbox.ts`, przyciski Archiwizuj/Usuń w
  `MailDetailPanel.tsx` + pasek akcji zbiorczych w `MailDashboard.tsx`.
- ✅ **MOVE (RFC 6851)** — atomowe. Bez niego COPY+STORE+EXPUNGE, nieatomowo.
  `moveMessage()` loguje `console.warn`, jeśli serwer nie zgłasza capability
  `MOVE` (widoczne w `vercel logs`) — ryzyko emulacji COPY+STORE+EXPUNGE nie
  zostało zweryfikowane wobec az.pl z tej sesji (brak dostępu), do
  potwierdzenia na produkcji.
- ✅ **Czytanie folderu Sent** — dziś Sent jest *tylko do zapisu*. Mail wysłany z
  Outlooka jest dla panelu niewidoczny, co dziurawi oś kontaktu klienta.
  Zrobione: `saveOutgoingFromServer()` w `lib/mailSync.ts`, dopasowanie
  kontaktu po odbiorcy (nie po nadawcy, bo `from_addr` to zawsze nasz adres).
- **Robocze (Drafts)** — IMAP nie ma „aktualizacji" wersji roboczej: APPEND
  nowej + skasowanie starej. **Debounce** (zapis na blur/co ~30 s, NIE co
  literę). Autorytatywny draft trzymaj w Postgresie, do IMAP-a synchronizuj na
  checkpointach. Potrzebny UIDPLUS (`APPENDUID`), inaczej po APPEND nie znasz
  UID-a. **Nadal odłożone** (2026-07-16) — to nowa funkcja od zera (autosave
  w UI + APPEND/delete dance), inny charakter pracy niż reszta Etapu 2;
  osobna sesja.
- ✅ ⚠️ **Duplikaty w Sent:** Gmail/Outlook zapisują wysłane SAME. az.pl (zwykły
  Dovecot) — NIE, musimy APPEND-ować. Dziś robimy APPEND zawsze; przy dodaniu
  innej skrzynki trzeba wykrywać dostawcę. Rozwiązane przez dedup po
  `message_id` (już istniejący mechanizm) — `saveOutgoingFromServer()` widzi
  kopię z Sent i poprawnie ją pomija, bo ma identyczny `message_id` jak
  wiersz zapisany przy wysyłce z panelu.
- **Bez ściągania historii Sent/Trash/Archive** (decyzja właściciela
  2026-07-16, NIE była w oryginalnym zakresie): nowo odkryty folder startuje
  kursor "od teraz" (`getFolderCursorStart()`, tania komenda IMAP STATUS), nie
  od zera — stara, już raz odrzucona/zarchiwizowana korespondencja nie
  dopisuje się nagle na oś kontaktu klienta. Świadome ograniczenie zakresu,
  nie przeoczenie.
- **Nadal na architekturze request-path** (świadomie, nie pogłębienie długu):
  `moveMessage()`/`syncMailbox()` nadal łączą się z IMAP w ścieżce żądania,
  jak dziś działający `sendMail()`/`appendToSent()`. Pełne przejście na
  outbox+cron (patrz „Kluczowe ustalenia z researchu" niżej) to głębsza,
  osobna zmiana architektury.

### Etap 3 — Porządek w skrzynce
- **Screener nowych nadawców ✅ ZROBIONE (2026-07-16)** — tabela
  `mail_senders(email, status, decided_at)` (bez kolumny `bucket` z
  oryginalnego briefu — brak jasnej definicji podziału, odłożona do ALTER,
  jeśli się okaże potrzebna), bramkowanie przez `LEFT JOIN` przy odczycie
  (nie flagą na wiadomości — zatwierdzenie/blokada działa od razu na całą
  historię nadawcy bez backfillu), zakładka „Nowi nadawcy" + baner
  Zatwierdź/Zablokuj w podglądzie + auto-zatwierdzenie przy Odpisz. Znani
  `clients`/`leads` omijają bramkę automatycznie (patent Sparka), jak
  zakładał brief; screener *ukrywa*, nie odrzuca (⚠️ ograniczenie wskazane
  niżej — nie jesteśmy serwerem MX jak HEY). Szczegóły: `HUB_SETUP.md` →
  „Moduł 4, Etap 3 — screener nowych nadawców".
- **VIP ✅ ZROBIONE (2026-07-16)** — klient ze statusem „Aktywny" = VIP z
  automatu, czysto odczytowe (bez zmian w `saveIncoming()`). Zakładka „VIP"
  pokazuje WSZYSTKO od VIP-a niezależnie od statusu/kategorii (dosłowny
  przypadek z brifu — VIP bije `kategoria='reklama'` — jest strukturalnie
  nieosiągalny dla dopasowanego klienta, patrz uzasadnienie w
  `HUB_SETUP.md`; realny odpowiednik to ręcznie wyciszona/obsłużona
  wiadomość VIP-a). Złota plakietka `⭐ VIP` w liście i podglądzie.
  Szczegóły: `HUB_SETUP.md` → „Moduł 4, Etap 3 — VIP + Snooze".
- **Snooze / Odłóż ✅ ZROBIONE (2026-07-16)** — nazwane terminy („Jutro rano
  8:00", „Ten weekend", „Przyszły tydzień", „Później dziś"), NIE kalendarz.
  Kolumna `snooze_until` + filtr przy renderze; wraca sam BEZ crona
  (widoczność liczy się przy każdym odczycie). Szczegóły: `HUB_SETUP.md` →
  „Moduł 4, Etap 3 — VIP + Snooze".
- **Follow-up nudge (kierunek WYCHODZĄCY) ✅ ZROBIONE (2026-07-16)** — panel
  miał „Wiadomości do odpowiedzi" tylko dla przychodzących; teraz też
  odwrotność: *wysłałeś ofertę 5 dni temu, cisza*. Deterministyczne (`out`
  bez `in` w wątku po 5 dniach, `getNudgeThreads()` w `lib/db.ts`), zakładka
  „Bez odpowiedzi" w Wysłane + sekcja w dziennym digescie, ręczne
  wyciszenie przez `nudge_dismissed_at`. Szczegóły: `HUB_SETUP.md` →
  „Moduł 4f — Nudge/Follow-up".
- **Wątkowanie ✅ ZROBIONE (2026-07-16)** — `thread_id` + algorytm JWZ-lite
  (References/In-Reply-To → fallback temat+uczestnicy+okno 30 dni), grupa na
  liście + pasek wątku w podglądzie (cross-folder). Szczegóły: `HUB_SETUP.md`
  → „Moduł 4, Etap 3 — wątkowanie".

### Świadomie ODŁOŻONE
- **Załączniki** — `simpleParser` już je parsuje, `parsed.attachments` jest
  ignorowane. Wymaga blob storage + decyzji RODO o retencji plików.
- **Wiele skrzynek** — decyzja właściciela: przez env Vercela
  (`MAIL_2_HOST/USER/PASS`), **NIE** formularz w panelu. Hasła do poczty nie
  trafiają do bazy. Osobny moduł, gdy pojawi się druga skrzynka.
- **Śledzenie otwarć / read receipts** — odradzone: piksele śledzące, RODO,
  a do tego hipokryzja przy własnej blokadzie obrazków.

## Kluczowe ustalenia z researchu (2026-07-15)

Pięciu agentów przejrzało Superhuman, HEY, Gmail, Outlook, Apple Mail,
Fastmail, Thunderbird, Missive, Spark, Mimestream, Shortwave — ze źródeł
pierwotnych (RFC, oficjalne dokumentacje).

1. **Na IMAP da się zrobić praktycznie wszystko, co Superhuman.** Superhuman i
   Shortwave nie wspierają IMAP-a nie dlatego, że się nie da, tylko dlatego,
   że ich klienci są na Gmailu. **Snooze, send later, undo send, nudges, pin,
   reguły, kategorie, szablony, wyszukiwarka, wątkowanie, podpisy — ZERO
   zależności od protokołu.** To logika klienta, nie funkcja serwera.
2. **Szybkość Superhumana to lokalna kopia, nie API Gmaila.** Ich reguła
   „każda interakcja <100 ms" opiera się na optimistic UI: zmiana jest
   natychmiast lokalna, sieć nigdy nie jest na ścieżce interakcji.
3. **ARCHITEKTURA — najważniejsze:** *Postgres jest źródłem prawdy, IMAP jest
   celem synchronizacji odpytywanym WYŁĄCZNIE z crona.* UI nigdy nie dotyka
   IMAP-a w ścieżce żądania. IMAP to długo żyjąca, stanowa sesja TCP —
   wrogo nastawiona do funkcji serverless (cold start + TLS + AUTH + SELECT
   na każde żądanie = sekundy). Zapisy (flagi, przeniesienia, wysyłka) idą
   do tabeli-outboxu i są odtwarzane przez cron. **Dziś `POST /api/mail/sync`
   łączy się z IMAP w ścieżce żądania — to do zmiany.**
4. **IDLE (push) jest nierealne na Vercelu** — wymaga trzymanego połączenia.
   Alternatywa, gdyby właściciel chciał natychmiastowości: stały proces na
   jego Macu Studio (już stoi tam Ollama, patrz Moduł 6).
5. **Notion Mail — NIE kopiować.** Notion ogłosił 25.06.2026 zamknięcie go
   22.09.2026. Powód: użytkownicy przestali otwierać skrzynkę, oddając ją
   agentom AI. Ciekawe jako ostrzeżenie, nie wzorzec.

## Ryzyka
- **Tożsamość wątku** to wspólna zależność wątkowania, screenera i nudge'y.
- **Polski stemming** w wyszukiwarce — `pg_catalog.simple` nie stemuje PL.
  Dziś jest `ILIKE` (wystarcza). ⚠️ **Neon usunął `pg_search` dla nowych
  projektów 2026-03-19** — jeśli sięgniesz po pełnotekstową, to wbudowany
  `tsvector` + GIN + `pg_trgm` + `unaccent` (mieszczą się w idempotentnych
  migracjach `lib/db.ts`, zero nowej infrastruktury). Przed `to_tsvector`
  odetnij cytowaną historię i podpisy: limit to 1 MB na `tsvector`, a powyżej
  256 pozycji na słowo są **po cichu odrzucane** — i tak poprawia to jakość.
- **Własne keywordy IMAP na az.pl** — niezweryfikowane, przetestuj empirycznie
  (`PERMANENTFLAGS` musi zawierać `\*`). Bez tego zapis keyworda jest
  ignorowany albo trzymany tylko do końca sesji — **po cichu**.
- ⚠️ **`mailparser` (używamy go w `lib/mailbox.ts`) jest oficjalnie w trybie
  utrzymaniowym.** Nie blokuje, ale przy większych zmianach rozważ
  `postal-mime`. `imapflow` jest na MIT i aktywnie rozwijany (v1.4.7,
  lipiec 2026) — tu jest czysto.

## Uczciwa uwaga do architektury „Postgres = źródło prawdy"

Research znalazł **kontrargument wart świadomej decyzji, nie przemilczenia**:
z ~25 przejrzanych projektów tylko dwa robią „IMAP → własna baza z własnym
schematem" (Nylas sync-engine — martwy od 2017; Delta Chat). **Każdy żywy
klient pocztowy postawił na odwrót: IMAP jest systemem zapisu, a baza
jednorazowym cache'em.** Roundcube trzyma w cache'u wyłącznie metadane i
flagi (bez treści); nawet nowa Panorama w Thunderbirdzie zostawia treści w
mbox/maildir, a w SQLite ma sam indeks.

Sugerowany szew: **Postgres na metadane + nasze rzeczy (tagi, snooze, screener,
reguły, indeks wyszukiwania), treści z IMAP-a cache'owane leniwie.**

My świadomie trzymamy pełne treści w `mail_messages` — bo potrzebujemy ich do
wyszukiwarki, osi kontaktu klienta i działania bez skrzynki. Strażnikiem jest
retencja 24 mies. (decyzja właściciela, RODO). **To nie jest przypadek, tylko
wybór — ale przy Etapie 2 warto go świadomie potwierdzić**, bo koszt
utrzymania rośnie wraz z liczbą folderów.

Dodatkowo, na poparcie planu „snooze robimy sami": **Fastmail — firma, która
napisała szkic standardu snooze dla IMAP — sama pisze wprost, że *nie potrafi
udostępnić odkładania wiadomości klientom zewnętrznym*.** Szkic
(`draft-ietf-extra-email-snooze`) wygasł i nigdy nie został RFC. Nie ma czego
szukać w protokole.

## Definicja ukończenia (Etap 1) — ✅ ZAMKNIĘTY 2026-07-15
- ✅ Da się napisać nową wiadomość, przekazać, odpowiedzieć wszystkim.
- ✅ Podpis PL/EN/DE wybierany przełącznikiem, wysyłany jako HTML (bez zmian w
  tym etapie — zbudowane w trzeciej turze Modułu 4, dopracowane w Module 4c).
  ⚠️ **Nie zweryfikowane w prawdziwym mailu do siebie** — Claude nie ma
  dostępu do skrzynki az.pl; właściciel powinien wysłać próbną wiadomość
  każdą nową ścieżką (Nowa/Przekaż/Wszystkim) i sprawdzić wygląd w Outlooku.
- ✅ Cofnij wysyłkę działa (10 s, po stronie klienta, wszystkie ścieżki
  wysyłki).
- ✅ `npx tsc --noEmit` bez błędów. ⚠️ Weryfikacja w przeglądarce NIE wykonana
  w tej sesji — inna sesja Claude miała w tym momencie uruchomiony własny
  `next dev` na tym samym katalogu roboczym (Next.js nie pozwala na dwa
  serwery dev jednocześnie w tym samym repo), a zatrzymanie jego procesu
  byłoby destrukcyjne wobec cudzej pracy. Właściciel powinien przetestować
  ręcznie: Nowa wiadomość, Przekaż, Odpowiedz wszystkim, Cofnij wysyłkę,
  Szablony (dodaj/wstaw/edytuj/usuń) — najlepiej lokalnie
  (`npm run dev` + dev-login) przed wdrożeniem.
- ✅ `HUB_SETUP.md` zaktualizowany („Moduł 4b — Etap 1: pisanie i
  odpowiadanie").
