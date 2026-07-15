# Moduł 4b — Poczta: pełny klient (pisanie, foldery IMAP, screener)

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md` i sekcję
> „Moduł 4" w `HUB_SETUP.md` (fundament, na którym to stoi).
> Powstał 2026-07-15 po tym, jak właściciel przetestował Moduł 4 na żywo na
> produkcji i zgłosił, czego brakuje. **Kolejność i decyzje są jego.**

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

### Etap 1 — Pisanie i odpowiadanie (START TUTAJ)
- **Nowa wiadomość** (compose od zera), **Przekaż**, **Odpowiedz wszystkim**.
  Dziś jest wyłącznie „Odpisz" do nadawcy (`app/api/mail/[id]/reply`).
- **Odpowiedź w HTML** — dziś wysyłamy `text` (patrz `sendReply` w
  `lib/mailbox.ts`). Podpis wymaga HTML-a. Wysyłaj multipart: `text` + `html`.
- **Podpisy PL/EN/DE.**
  - ⚠️ **Pliki JUŻ SĄ w repo i nikt ich nie używa:**
    `public/assets/signature/stopka_mailowa_{PL,EN,DE}.png`.
  - ⚠️ **ALE to obrazki PNG — odradzone właścicielowi 2026-07-15.** Wady:
    większość klientów blokuje zdalne obrazki (podpis = pusta ramka), nic nie
    jest klikalne, gorsza ocena antyspamowa. **Rekomendacja: odtworzyć jako
    HTML z prawdziwym tekstem + klikalnymi linkami**, zdjęcie/logo jako małe
    obrazki inline (`cid:`, nie zdalne — nie podlegają blokadzie).
    Czeka na decyzję właściciela.
  - ⚠️ **Rozbieżność do wyjaśnienia:** podpis podaje `kontakt@patrykpiecyk.pl`,
    a skrzynka panelu to `kontakt@leggeralabs.pl` (`NOTIFY_TO` w
    `app/api/leads/notify`). Zapytać, który adres jest właściwy.
  - Treść trzymać w `company_settings` (kolumny `podpis_pl/_en/_de`), nie w
    kodzie — właściciel ma móc je edytować bez programisty.
- **Cofnij wysyłkę** — opóźnienie ~10 s przed przekazaniem do SMTP. Czysto po
  naszej stronie, tanie, ratuje skórę. Gmail daje 5–30 s (domyślnie 5).
- **Szablony wiadomości** — naturalne przedłużenie podpisów. Wzorzec:
  Superhuman Snippets (wstawianie inline). W panelu jest już
  `offer_templates` — ten sam kształt.

### Etap 2 — Fundament: foldery i flagi IMAP
**To jest przepisanie fundamentu, nie dokładanie przycisków.** Dziś panel
czyta wyłącznie INBOX i trzyma własną kopię w `mail_messages`.

- **Special-use folders (RFC 6154)** — `LIST (SPECIAL-USE)` zwraca
  `\Sent \Drafts \Trash \Junk \Archive \All`. **NIGDY nie zgaduj nazw**
  („Sent"/„Wysłane"/„[Gmail]/Sent Mail") — `appendToSent()` w `lib/mailbox.ts`
  robi to dziś jako fallback i tak ma zostać, ale LIST idzie pierwszy.
  Atrybuty są OPCJONALNE — potrzebny łańcuch: SPECIAL-USE → XLIST → nazwy.
- **Kursory per folder** — klucz `(mailbox, uidvalidity, uid)`. Dziś
  `mail_state` ma JEDEN `last_seen_uid` (tylko INBOX). Trzeba tabeli
  `mail_folders` z własnym kursorem i `HIGHESTMODSEQ` na folder.
- **CONDSTORE/QRESYNC (RFC 7162)** — pobieraj TYLKO zmiany od ostatniego
  `HIGHESTMODSEQ`. To odpowiednik `history.list` z Gmail API. ImapFlow
  wykrywa rozszerzenia automatycznie.
- **Flagi** — `\Seen`, `\Answered`, `\Flagged`, `\Draft`, `\Deleted`. Lustro w
  obie strony: oflagowane w Outlooku widać w panelu i odwrotnie.
  ⚠️ Sprawdzaj `PERMANENTFLAGS` na SELECT: `\*` = wolno tworzyć własne
  keywordy. Bez tego zapis keyworda może zostać **po cichu zignorowany**.
  **Wsparcie Dovecota (prawdopodobny silnik az.pl) dla własnych keywordów NIE
  zostało zweryfikowane — przetestuj empirycznie zanim na tym zbudujesz.**
- **Kosz vs kasowanie** — trzy RÓŻNE rzeczy: archiwizacja = MOVE do
  `\Archive`; usunięcie = MOVE do `\Trash`; `\Deleted`+EXPUNGE = nieodwracalne.
  **Każda akcja „usuń" w UI ma być MOVE do Trash. NIGDY nie EXPUNGE'uj
  automatycznie** (zgodne z zasadą projektu o nieodwracalnych operacjach).
- **MOVE (RFC 6851)** — atomowe. Bez niego COPY+STORE+EXPUNGE, nieatomowo.
- **Czytanie folderu Sent** — dziś Sent jest *tylko do zapisu*. Mail wysłany z
  Outlooka jest dla panelu niewidoczny, co dziurawi oś kontaktu klienta.
- **Robocze (Drafts)** — IMAP nie ma „aktualizacji" wersji roboczej: APPEND
  nowej + skasowanie starej. **Debounce** (zapis na blur/co ~30 s, NIE co
  literę). Autorytatywny draft trzymaj w Postgresie, do IMAP-a synchronizuj na
  checkpointach. Potrzebny UIDPLUS (`APPENDUID`), inaczej po APPEND nie znasz
  UID-a.
- ⚠️ **Duplikaty w Sent:** Gmail/Outlook zapisują wysłane SAME. az.pl (zwykły
  Dovecot) — NIE, musimy APPEND-ować. Dziś robimy APPEND zawsze; przy dodaniu
  innej skrzynki trzeba wykrywać dostawcę.

### Etap 3 — Porządek w skrzynce
- **Screener nowych nadawców** (HEY × Spark × nasz CRM). Tabela
  `mail_senders(email, status, bucket)`. **Nasza przewaga nad HEY: mamy
  `clients` i `leads`** — każdy znany kontakt omija bramkę automatycznie
  (patent Sparka), więc bramka dotyczy WYŁĄCZNIE naprawdę nieznanych.
  Deterministyczne, zero AI. To rozwiązuje problem Calendly u źródła:
  zamiast zgadywać kategorię, pytamy raz i zapamiętujemy.
  ⚠️ Ograniczenie: nasz screener *ukrywa*, nie odrzuca (HEY blokuje na MX, bo
  JEST serwerem). Mail i tak zajmie miejsce w skrzynce.
- **VIP** — Apple Mail: VIP bije klasyfikację treści. U nas naturalnie:
  klient ze statusem „Aktywny" = VIP z automatu.
- **Snooze / Odłóż** — nazwane terminy („Jutro 8:00", „Poniedziałek"), NIE
  kalendarz. ⚠️ Omija to pułapkę `<input type="date">` z CLAUDE.md. Kolumna
  `snooze_until` + filtr przy renderze; wraca sam (cron już jest).
  IMAP nie ma snooze w protokole — robimy po swojej stronie.
- **Follow-up nudge (kierunek WYCHODZĄCY)** — panel ma „Wiadomości do
  odpowiedzi" dla przychodzących; brakuje odwrotności: *wysłałeś ofertę 5 dni
  temu, cisza*. Deterministyczne (`out` bez `in` w wątku po N dniach).
  Dla solo goniącego oferty to potencjalnie najbardziej dochodowa funkcja
  w panelu.
- **Wątkowanie** — ⚠️ `in_reply_to`/`refs` **JUŻ SĄ w bazie, tylko nikt ich
  nie czyta**. Dodaj `thread_id`, grupuj algorytmem JWZ (References →
  In-Reply-To → fallback temat+uczestnicy+okno czasu). Najlepszy stosunek
  wartości do kosztu z całej listy.

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

## Definicja ukończenia (Etap 1)
- Da się napisać nową wiadomość, przekazać, odpowiedzieć wszystkim.
- Podpis PL/EN/DE wybierany przełącznikiem, wysyłany jako HTML, poprawnie
  wyświetlany u odbiorcy (przetestować na prawdziwym mailu do siebie).
- Cofnij wysyłkę działa.
- `npx tsc --noEmit`, weryfikacja lokalna (mock), `HUB_SETUP.md` zaktualizowany.
