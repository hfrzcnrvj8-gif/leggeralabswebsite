# Inwentarz API — Poczta, Szablony maili, Lokalne AI, Referencje

Część inwentarza API panelu Leggera Hub dla natywnej aplikacji iOS. Dokument
samowystarczalny — opisuje wszystkie trasy z katalogów `app/api/mail`,
`app/api/mail-templates`, `app/api/ai`, `app/api/references` oraz kształty
danych z powiązanych plików `lib/`.

**Decyzja właściciela: Poczta wchodzi do aplikacji W PEŁNI** (foldery, wątki,
załączniki wychodzące, szablony, screener, snooze, nudge). To osobny, duży
moduł aplikacji — poziom 1. AI jest punktowe (szkic odpowiedzi klikany
jawnie), nigdy autonomiczne.

## Spis tras

| Metoda | Ścieżka | Po co | Poziom |
|---|---|---|---|
| GET | `/api/mail` | Lista wiadomości jednego folderu + liczniki zakładek/folderów | 1 |
| GET | `/api/mail/[id]` | Pełna wiadomość + odkażony HTML + pasek wątku | 1 |
| PATCH | `/api/mail/[id]` | Status / MOVE między folderami / flaga / screener / snooze / przypisanie / wyciszenie nudge | 1 |
| POST | `/api/mail/sync` | Synchronizacja IMAP (pobierz nowe wiadomości ze skrzynki az.pl) | 1 |
| GET | `/api/mail/nudge` | Wątki „wysłałeś, cisza od N dni" (follow-up) | 1 |
| POST | `/api/mail/compose` | Nowa wiadomość od zera (multipart, załączniki) | 1 |
| POST | `/api/mail/[id]/reply` | Odpowiedź w wątku (SMTP) | 1 |
| POST | `/api/mail/[id]/forward` | Przekazanie dalej (multipart, załączniki, nowy wątek) | 1 |
| POST | `/api/mail/[id]/create-lead` | Z maila → nowy lead | 1 |
| POST | `/api/mail/[id]/create-client` | Z maila → nowy klient | 1 |
| GET | `/api/mail/[id]/to-task` | Lista projektów klienta maila (do wyboru celu zadania) | 1 |
| POST | `/api/mail/[id]/to-task` | Z maila → zadanie w projekcie | 1 |
| POST | `/api/mail/[id]/draft-reply` | AI (lokalna Ollama): PROPOZYCJA szkicu odpowiedzi | punktowe |
| GET | `/api/mail-templates` | Lista szablonów wiadomości | 1 |
| POST | `/api/mail-templates` | Nowy szablon | 1 |
| PATCH | `/api/mail-templates/[id]` | Edycja szablonu | 1 |
| DELETE | `/api/mail-templates/[id]` | Usunięcie szablonu | 1 |
| GET | `/api/ai/health` | Ping lokalnej Ollamy (dostępność + lista modeli) | punktowe |
| GET | `/api/references` | Publiczne opinie/referencje (strona publiczna, nie panel) | — |

Wszystkie trasy działają w runtime `nodejs` (IMAP/SMTP to TCP). Wszystkie poza
`GET /api/references` są admin-only: pierwsza linia to
`if (!(await isAuthed())) return 401` — aplikacja musi mieć ciasteczko sesji
(patrz `00-uwierzytelnianie.md`).

---

## Model mentalny poczty (przeczytaj przed trasami)

Serwer panelu jest **roboczą kopią** prawdziwej skrzynki na az.pl
(IMAP odczyt + SMTP wysyłka; env: `MAIL_IMAP_HOST`, `MAIL_USER`, `MAIL_PASS`,
opcjonalnie `MAIL_IMAP_PORT`, `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_FROM`).
Wiadomości leżą w Postgresie w tabeli `mail_messages` z dedupem po
`message_id UNIQUE`.

Trzy **niezależne osie** każdej wiadomości:

- `folder` — GDZIE FIZYCZNIE leży na serwerze IMAP: `inbox | sent | trash |
  archive` (etykiety PL: Odebrane / Wysłane / Kosz / Archiwum). Drafts/Junk
  świadomie poza zakresem.
- `kierunek` — `in | out` (dostaliśmy / wysłaliśmy).
- `status` — czy wymaga reakcji: `nowy` („Do odpowiedzi"), `obsłużony`,
  `zignorowany`. Wychodzące zawsze `obsłużony`.

**Podział pracy serwer/klient:** cała logika mieszka na serwerze — sync IMAP,
klasyfikacja, wątkowanie, dopasowanie do klienta/leada, odkażanie HTML,
doklejanie podpisu, wysyłka SMTP, kopia do Sent. Aplikacja (klient) tylko
woła endpointy, renderuje dane i wysyła decyzje właściciela. Aplikacja NIE
łączy się nigdy sama z IMAP/SMTP i nie liczy nic sama (nawet daty snooze
przychodzą gotowe z opcji).

**Reguły deterministyczne, zero AI w automatyce:** kategoria, screener,
dopasowanie, wątkowanie — to reguły w kodzie (adres/nagłówki/temat), model
niczego nie zgaduje. AI (lokalna Ollama na Macu właściciela, przez Tailscale
Funnel; NIGDY chmurowe API) pojawia się wyłącznie tam, gdzie właściciel
jawnie kliknie — i zawsze tylko PROPONUJE treść do zatwierdzenia, nigdy nie
wysyła/zapisuje/decyduje sama.

**Kategorie (`kategoria`)** — deterministyczna klasyfikacja przychodzących,
hierarchia reguł (ważniejsza wygrywa):
1. `urzedowe` — domena z listy ZUS/US/banków (sufiks domeny, np.
   `powiadomienia.mbank.pl` łapie się, `zus.pl.oszust.com` nie),
2. `rachunek` — temat wygląda na fakturę/rachunek (regex),
3. `reklama` — masówka/automat: nagłówki `List-Unsubscribe` /
   `Precedence: bulk|list|junk|auto_reply` / `Auto-Submitted` ≠ `no`, albo
   tokeny typu `noreply` w lokalnej części adresu; taka wiadomość dostaje od
   razu `status='zignorowany'`,
4. `oferta` (etykieta „Zapytanie") — nieznany nadawca-człowiek = potencjalny
   klient,
5. `inne` (etykieta „Rozmowa") — znany klient/lead piszący normalnie.
`kategoria = null` znaczy „jeszcze nie policzona" (backfill dogoni).

**Screener nowych nadawców** — tabela `mail_senders` (email → status
`pending | approved | blocked`). Nadawca kategorii `oferta` dostaje przy
pierwszym mailu wpis `pending`; wiadomości od `pending`/`blocked` są
wykluczane z liczników „nowe"/„nieprzypisane" (UI pokazuje osobną kolejkę
screenera). Decyzję podejmuje właściciel (PATCH `senderDecision`); akcja
„Odpisz" auto-zatwierdza `pending` nadawcę.

**Wątkowanie** — `thread_id` liczone na serwerze (JWZ-lite): najpierw łańcuch
`References`/`In-Reply-To`, fallback: znormalizowany temat (bez Re:/Odp:/Fwd:)
+ wspólny uczestnik w oknie 30 dni; inaczej wiadomość jest korzeniem własnego
wątku (`thread_id = message_id`). `thread_id` może być `null` dla wierszy
sprzed migracji — backfill je dogania; UI wtedy po prostu nie pokazuje paska
wątku.

**Załączniki:** wychodzące — tak (multipart/form-data, tylko w pamięci serwera
na czas żądania, NIGDY nie zapisywane w bazie); przychodzące — panel dziś NIE
przechowuje treści załączników przychodzącej poczty (świadomie odłożone,
wymaga decyzji o retencji RODO). Aplikacja nie może więc pokazać załącznika
odebranego maila — tylko dołączyć nowy przy wysyłce.

**Podpis (stopka) z emoji:** w mailach WYCHODZĄCYCH serwer dokleja podpis
HTML+tekst (PL/EN/DE, `lib/mailSignature.ts`) z wierszami kontaktu na emoji
(📞 ✉️ 🌐 — świadomy, trwały wyjątek: w HTML-u maila nie ma komponentów React,
a obrazki bywają blokowane) i obrazkami osadzonymi jako `cid:` (zdjęcie,
logo). Właściciel pisze SAMĄ treść; do bazy trafia tekst BEZ podpisu. Język
podpisu wybiera ręcznie przy pisaniu (pole `podpis`), nie automat.

**Retencja RODO:** wiersze starsze niż 24 miesiące kasuje dzienny cron —
aplikacja nie powinna zakładać wiecznej historii; oryginały zostają na az.pl.

---

## GET /api/mail

- **Po co**: Lista wiadomości JEDNEGO folderu (max 200, najnowsze pierwsze)
  plus komplet liczników do zakładek i sidebara folderów. Główny ekran poczty.
- **Auth**: admin-only (`isAuthed()`).
- **Żądanie** (query, wszystko opcjonalne):
  - `folder` — `inbox | sent | trash | archive`; nieznana/pusta wartość →
    `inbox`.
  - `status` — `nowy | obsłużony | zignorowany`; nieznana → brak filtra.
  - `filter=unassigned` — tylko wiadomości bez `client_id` i `lead_id`.
  - `kategoria` — `reklama | rachunek | urzedowe | oferta | inne`.
  - `q` — wyszukiwanie ILIKE po nadawcy (adres i nazwa), temacie i treści;
    znaki `%`/`_` są escapowane. Szuka TYLKO w wybranym folderze (jak Apple
    Mail), nie „wszędzie".
- **Odpowiedź**:
  ```json
  {
    "messages": [ MailMessageWithLinks... ],   // bez body_html ('' na liście — bywa ciężki)
    "counts": {
      "nowe": 0,            // status='nowy', in, inbox, nadawca nie pending/blocked, nie w snoozie
      "nieprzypisane": 0,   // bez client/lead, in, inbox, status != zignorowany, jw.
      "oferta": 0, "rachunek": 0, "urzedowe": 0, "inne": 0, "reklama": 0,  // per kategoria, in+inbox, NIEZALEŻNIE od statusu
      "pending_screener": 0, // in+inbox od nadawców 'pending'
      "vip": 0,              // in+inbox od klientów o statusie 'Aktywny' (VIP z automatu)
      "snoozed": 0,          // odłożone z terminem w przyszłości
      "folder_inbox": 0, "folder_sent": 0, "folder_trash": 0, "folder_archive": 0
    },
    "configured": true       // czy skrzynka IMAP w ogóle skonfigurowana (env)
  }
  ```
- **Reguły biznesowe**: `body_html` na liście jest zawsze pustym stringiem —
  pełny HTML tylko w GET `/api/mail/[id]`. Liczniki kategorii liczą też
  obsłużone/zignorowane (inaczej „Reklama" pokazywałaby 0). `configured:
  false` to NIE błąd — poczta działa na danych z bazy, aplikacja pokazuje
  spokojny stan „skrzynka nieskonfigurowana". Zakładka VIP = wiadomości od
  klientów `Aktywny`, ignoruje status/kategorię.
- **Poziom w apce**: 1.

## GET /api/mail/[id]

- **Po co**: Pełna wiadomość do podglądu: odkażony HTML, pasek wątku, licznik
  innych nieprzypisanych maili z tego adresu.
- **Auth**: admin-only.
- **Żądanie**: query `images=1` — pozwól na zdalne obrazki (domyślnie
  blokowane jako tracking pixele, podmieniane 1x1 przezroczystym GIF-em).
- **Odpowiedź**:
  ```json
  {
    "message": MailMessageWithLinks,   // body_html zawsze '' — surowy HTML NIE opuszcza serwera
    "html": "<...>",                   // odkażony HTML treści (sanitize-html, bez skryptów/iframe/form)
    "blockedImages": true,             // czy coś wycięto — UI pokazuje przycisk „Pokaż obrazki"
    "thread": [ { "id", "subject", "from_addr", "from_name", "kierunek", "folder", "status", "received_at" } ],
    "unassignedSameAddress": 0         // ile INNYCH nieprzypisanych maili z tego adresu (>0 tylko dla in+nieprzypisanych)
  }
  ```
- **Reguły biznesowe**: Odkażanie robi serwer PRZY KAŻDYM odczycie (poprawka
  reguł działa od razu na historii). Aplikacja MUSI renderować `html` w
  odizolowanym widoku bez wykonywania skryptów (odpowiednik `<iframe sandbox>`
  bez allow-scripts; na iOS np. WKWebView z wyłączonym JS) — treść maila to
  kod obcej osoby. `thread` to inne wiadomości TEGO SAMEGO wątku niezależnie
  od folderu, rosnąco po dacie; puste gdy `thread_id` null.
  `unassignedSameAddress` zasila pytanie „przypiąć też pozostałe N?" ZANIM
  właściciel wybierze klienta.
- **Poziom w apce**: 1.

## PATCH /api/mail/[id]

- **Po co**: Wszystkie akcje na pojedynczej wiadomości — jeden endpoint,
  niezależne pola w body (można łączyć).
- **Auth**: admin-only.
- **Żądanie** (JSON, każde pole opcjonalne):
  - `status`: `"nowy" | "obsłużony" | "zignorowany"` — zmiana statusu;
    `obsłużony` ustawia `handled_at=now()`, powrót do `nowy` czyści.
  - `move`: `"inbox" | "trash" | "archive"` — PRAWDZIWY MOVE na serwerze IMAP
    (RFC 6851; nigdy `\Deleted`+EXPUNGE). Błędy: 503 skrzynka
    nieskonfigurowana, 422 wiadomość bez UID-a, 400 już w tym folderze, 502
    nieznany folder na serwerze / MOVE nie powiódł się. Baza aktualizowana
    DOPIERO po udanym MOVE.
  - `flagged`: boolean — flaga „ważne", TYLKO lokalna (nie dotyka `\Flagged`
    na IMAP — świadoma decyzja).
  - `senderDecision`: `"approved" | "blocked"` — decyzja screenera dla adresu
    nadawcy (upsert do `mail_senders`).
  - `snoozeUntil`: string ISO | null — odłóż / „wróć teraz". Wartość ZAWSZE z
    nazwanej opcji `snoozeOptions()` (patrz Typy danych), nigdy z ręcznego
    pola daty. Serwer waliduje sensowność (rok 2000–2100 → 400). Wiadomość
    wraca SAMA gdy termin minie (widoczność liczona przy odczycie, bez crona).
  - `nudgeDismissed`: `true` — wycisz przypominacz follow-up dla tej
    wiadomości (tylko `true`; jedyny powrót to wysłanie kolejnej wiadomości w
    wątku).
  - `client_id` / `lead_id`: string | null — ręczne przypisanie. Liczy się
    OBECNOŚĆ pola (oba `null` = odpięcie). Zawsze dokładnie jedna strona
    relacji. Przypięcie dopisuje skrót maila na oś kontaktu klienta/leada.
  - `applyToAddress`: `true` — (razem z przypisaniem) zapamiętaj „ten adres =
    ten kontakt" na przyszłość i przypnij zaległe NIEPRZYPISANE wiadomości z
    tego adresu. Zawsze jawna zgoda właściciela — aplikacja pyta, nigdy
    domyślnie.
- **Odpowiedź**: `{ "ok": true, "message": MailMessageWithLinks }` (świeży
  stan wiersza).
- **Reguły biznesowe**: `move` i `status` to dwie NIEZALEŻNE osie —
  „Zignoruj" chowa z kolejki, ale wiadomość fizycznie zostaje w INBOX;
  „Usuń"/„Archiwizuj" to fizyczny MOVE. Endpoint waliduje wszystko również
  serwerowo (jest wywoływalny bezpośrednio) — aplikacja i tak powinna wysyłać
  tylko wartości z enumów.
- **Poziom w apce**: 1.

## POST /api/mail/sync

- **Po co**: Pobiera nowe wiadomości ze skrzynki az.pl (wszystkie znane
  foldery, kursory per folder). Wołane przy otwarciu widoku poczty i raz
  dziennie z crona (`app/api/leads/notify` woła logikę bezpośrednio, bez HTTP).
- **Auth**: admin-only. (Ścieżka cronowa autoryzuje się `CRON_SECRET` w
  swojej własnej trasie notify — ta trasa tutaj jest zawsze isAuthed.)
- **Żądanie**: brak body.
- **Odpowiedź**:
  - skrzynka nieskonfigurowana: `{ "configured": false, "fetched": 0, "matched": 0 }` (HTTP 200),
  - sukces: `{ "configured": true, "fetched": n, "saved": n, "matched": n, "unassigned": n, "ignored": n }`,
  - błąd IMAP: `{ "configured": true, "error": "…", "fetched": 0, "matched": 0 }` (HTTP 502) —
    aplikacja pokazuje komunikat, ale dalej renderuje dane z bazy.
- **Reguły biznesowe** (wszystko po stronie serwera — aplikacja tylko woła i
  odświeża listę):
  - backfille samo-naprawiające: kategorie (z dociągnięciem nagłówków po
    UID), DW (`cc_addr`), `thread_id`, ponowne dopasowanie nieprzypisanych
    (mail przyszedł zanim istniał kontakt — codzienny przypadek);
  - discovery folderów specjalnych (RFC 6154 SPECIAL-USE, fallback po
    nazwach) tylko raz — nowe foldery startują kursor „od teraz", bez
    zaciągania historii Kosza/Archiwum;
  - INBOX: pełny zapis (klasyfikacja + dopasowanie po adresie nadawcy + wpis
    na oś kontaktu + powiadomienie `mail_new` + screener `pending` dla
    kategorii `oferta`); Sent: dopasowanie po ODBIORCY; Trash/Archive: lekki
    zapis bez klasyfikacji;
  - dedup po `message_id` — podwójny sync niczego nie dubluje; zmiana
    UIDVALIDITY = bezpieczne przeczytanie folderu od zera;
  - limit 50 wiadomości na folder na przebieg (najnowsze najpierw) — dużą
    skrzynkę dociągają kolejne synce; `maxDuration = 90 s` — aplikacja musi
    tolerować długi request (timeout klienta ≥ 90 s albo sync w tle).
- **Poziom w apce**: 1 (odpal przy wejściu do poczty, pokaż wynik dyskretnie).

## GET /api/mail/nudge

- **Po co**: Zakładka „Bez odpowiedzi" — wątki, w których właściciel wysłał
  ostatnią wiadomość i od ≥ 5 dni (`MAIL_NUDGE_DAYS`, stała w kodzie) nie ma
  ŻADNEJ odpowiedzi w wątku (niezależnie od folderu odpowiedzi).
- **Auth**: admin-only.
- **Żądanie**: brak.
- **Odpowiedź**: `{ "threads": NudgeThread[] }` (patrz Typy danych),
  posortowane od najdłużej czekających.
- **Reguły biznesowe**: Jeden wpis NA WĄTEK — reprezentantem jest NAJNOWSZA
  wychodząca wiadomość (dosłanie przypomnienia restartuje licznik). Liczbę dni
  ciszy aplikacja liczy z `received_at` reprezentanta. Wyciszenie: PATCH
  `/api/mail/[id]` z `nudgeDismissed: true` na `id` reprezentanta. Ta sama
  definicja zasila dzienny digest mailowy.
- **Poziom w apce**: 1.

## POST /api/mail/compose

- **Po co**: Nowa wiadomość napisana od zera. Zawsze NOWY wątek.
- **Auth**: admin-only.
- **Żądanie**: **multipart/form-data** (nie JSON — przez załączniki):
  - `to` (wymagane) — adresy po przecinku/średniku; ≥ 1 poprawny albo 400,
  - `text` (wymagane) — treść, niepusta,
  - `subject`, `cc`, `bcc` — opcjonalne,
  - `podpis` — `"pl" | "en" | "de"` (locale z `i18n/config`); inna/pusta
    wartość = bez podpisu,
  - `attachments` — pliki (może być wiele). Limity (walidowane serwerowo):
    dozwolone MIME: pdf, jpeg, png, webp, gif, doc/docx, xls/xlsx, txt, csv,
    zip; max 3 MB/plik, max 4 MB łącznie (pułap body na Vercelu ~4.5 MB).
- **Odpowiedź**: `{ "ok": true, "id": "<uuid>", "warnings": ["…"] }`.
  Błędy: 400 (walidacja / skrzynka nieskonfigurowana), 502 (wysyłka SMTP nie
  powiodła się).
- **Reguły biznesowe**: Kolejność jest celowa: wysyłka SMTP (nieodwracalna)
  idzie pierwsza — wszystko PO niej (kopia do folderu Sent przez IMAP APPEND,
  zapis w bazie, wpis na oś kontaktu) w razie awarii staje się WPISEM w
  `warnings`, nie błędem 5xx. **Aplikacja MUSI pokazać `warnings`** i nie
  wolno jej wtedy ponawiać wysyłki (mail już poszedł). Podpis (z emoji i
  obrazkami `cid:`) dokleja serwer; do bazy idzie treść bez podpisu.
  Dopasowanie do klienta/leada po PIERWSZYM adresie „Do". BCC nigdy nie
  trafia do nagłówków MIME (tylko koperta SMTP) — kopia w Sent go nie zdradza;
  w bazie `bcc_addr` zapisane dla wglądu właściciela. `maxDuration = 60 s`.
- **Poziom w apce**: 1.

## POST /api/mail/[id]/reply

- **Po co**: Odpowiedź na wiadomość — w TYM SAMYM wątku (nagłówki
  `In-Reply-To`/`References` wg RFC 5322).
- **Auth**: admin-only.
- **Żądanie** (JSON):
  - `text` (wymagane) — treść, niepusta,
  - `subject` — opcjonalny; domyślnie `Re: <temat oryginału>` (bez dublowania
    Re:/Odp:),
  - `podpis` — `"pl" | "en" | "de"` | brak,
  - `cc` — string adresów po przecinku/średniku.
  Bez załączników (odpowiedź jest JSON-owa; załączniki tylko w
  compose/forward). Adresatem jest zawsze `from_addr` oryginału (400 gdy go
  brak).
- **Odpowiedź**: `{ "ok": true, "id": "<uuid odpowiedzi>", "warnings": [] }`;
  400/404/502 jak wyżej.
- **Reguły biznesowe**: Ten sam wzorzec „wysyłka pierwsza, potem tylko
  warnings". Skutki uboczne po wysyłce: oryginał → `obsłużony`; nadawca
  `pending` w screenerze → auto-`approved` (Odpisz = „chcę tę rozmowę");
  odpowiedź dziedziczy `client_id`/`lead_id`/`invoice_id` i `thread_id`
  oryginału; wpis na oś kontaktu. Aplikacja po sukcesie odświeża wiadomość
  i listę.
- **Poziom w apce**: 1.

## POST /api/mail/[id]/forward

- **Po co**: Przekazanie wiadomości dalej. Świadomie NOWY wątek (jak
  Gmail/Outlook przy „Fwd:").
- **Auth**: admin-only.
- **Żądanie**: **multipart/form-data**, pola jak w compose: `to` (wymagane),
  `text` (opcjonalny komentarz), `cc`, `bcc`, `podpis`, `attachments` (te same
  limity MIME/rozmiaru).
- **Odpowiedź**: `{ "ok": true, "id": "<uuid>", "warnings": [] }`;
  400/404/502.
- **Reguły biznesowe**: Serwer sam składa treść: komentarz + podpis + blok
  „---------- Wiadomość przekazana ----------" (Od/Data/Temat/Do) + cytowany
  oryginał (HTML odkażony, z dozwolonymi zdalnymi obrazkami — blokada chroni
  tylko nasz podgląd). **Załączniki ORYGINAŁU NIE są doklejane** (panel nie
  przechowuje treści załączników przychodzących — świadomie odłożone);
  `attachments` to wyłącznie NOWE pliki od właściciela. Temat: `Fwd: …` bez
  dublowania. Dopasowanie po pierwszym adresie „Do". `maxDuration = 60 s`.
- **Poziom w apce**: 1.

## POST /api/mail/[id]/create-lead

- **Po co**: „Inbound = nowy lead" — mail z nieznanego adresu jednym
  kliknięciem staje się leadem i wchodzi w proces sprzedaży.
- **Auth**: admin-only.
- **Żądanie** (JSON): `{ "firma": "…" }` — opcjonalna nazwa; gdy brak, serwer
  zgaduje deterministycznie: nazwa z nagłówka From → domena bez TLD
  (z wielkiej litery) → sam adres.
- **Odpowiedź**:
  - nowy: `{ "ok": true, "reused": false, "type": "lead", "id": "<uuid>", "nazwa": "…" }`,
  - kontakt już istniał (np. dwuklik): `{ "ok": true, "reused": true, "type": "client"|"lead", "id", "nazwa" }` — przypięto do istniejącego zamiast duplikatu.
  - 400: brak adresu nadawcy albo mail już przypisany; 404: brak wiadomości.
- **Reguły biznesowe**: Lead powstaje ze statusem „Nowe zgłoszenie ze strony"
  (natychmiast `isOverdue` → ląduje na Pulpicie jako „do zrobienia dziś"),
  źródło Inbound/E-mail, notatka z tematem i początkiem treści (3000 znaków).
  Mail zostaje przypięty + wpis na oś kontaktu.
- **Poziom w apce**: 1.

## POST /api/mail/[id]/create-client

- **Po co**: Bliźniak create-lead dla sytuacji „to od razu realna relacja, nie
  lejek" — dwie osobne decyzje biznesowe, aplikacja pokazuje OBA przyciski i
  nie zgaduje.
- **Auth**: admin-only.
- **Żądanie** (JSON): `{ "nazwa": "…" }` — opcjonalna; fallback jak wyżej.
- **Odpowiedź**: jak create-lead, z `"type": "client"` (przy `reused` może
  zwrócić też leada). Klient dodatkowo dostaje pole `www` z domeny adresu i
  wpis `client_created` na osi zdarzeń.
- **Reguły biznesowe**: Nowy klient ma status „Prospekt" (jeszcze niczego nie
  kupił) — awansuje go dopiero oferta/faktura.
- **Poziom w apce**: 1.

## GET /api/mail/[id]/to-task

- **Po co**: Lista projektów, do których można wrzucić zadanie z tej
  wiadomości (projekty klienta, do którego mail jest przypisany).
- **Auth**: admin-only.
- **Żądanie**: brak.
- **Odpowiedź**: `{ "projects": [ { "id", "tytul", "status" } ] }` — pusta
  lista, gdy mail nie ma `client_id`. 404 gdy brak wiadomości.
- **Reguły biznesowe**: Świadomie bez zgadywania „właściwego" projektu —
  właściciel wybiera z listy.
- **Poziom w apce**: 1.

## POST /api/mail/[id]/to-task

- **Po co**: „Z maila → zadanie" — prośba klienta staje się zadaniem w
  projekcie.
- **Auth**: admin-only.
- **Żądanie** (JSON): `{ "project_id": "<uuid>", "text": "…" }` — oba
  wymagane (400 z polskim komunikatem gdy brak; 400 gdy projekt nie
  istnieje). Treść zadania podaje WŁAŚCICIEL (UI podpowiada temat maila) —
  żaden model nic nie wnioskuje.
- **Odpowiedź**: `{ "ok": true, "task_id": "<uuid>", "project_id": "<uuid>" }`.
- **Reguły biznesowe**: Zadanie trafia na koniec listy projektu (max 500
  znaków); w historii projektu powstaje wpis systemowy „Zadanie z wiadomości
  e-mail od …"; mail przechodzi na `obsłużony`.
- **Poziom w apce**: 1.

## POST /api/mail/[id]/draft-reply

- **Po co**: **Lokalne AI, punktowe.** Generuje PROPOZYCJĘ treści odpowiedzi
  na mail modelem tekstowym (`qwen3.6:27b`) przez Ollamę na Macu właściciela.
  Nigdy nic nie zapisuje ani nie wysyła — szkic ląduje w polu odpowiedzi,
  właściciel poprawia i wysyła ręcznie (POST `/reply`).
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ "draft": "…" }` — czysty tekst po polsku, bez tematu,
  markdownu i podpisu (podpis dokleja się osobno przy wysyłce). 404 brak
  wiadomości; **503** `{ "error": "Model AI chwilowo niedostępny — napisz
  odpowiedź ręcznie." }` gdy Ollama nie odpowiada / brak konfiguracji — to
  normalny, spodziewany stan (env `OLLAMA_API_URL` tylko na produkcji),
  aplikacja pokazuje komunikat i NIE blokuje ręcznego pisania.
- **Reguły biznesowe**: Kontekst zbiera KOD (temat + treść maila + jeśli mail
  przypięty: nazwa/branża/status kontaktu + ostatnia notatka z osi) — model
  nie grzebie w bazie. Prompt systemowy zakazuje zmyślania faktów. Timeout
  45 s (endpoint `maxDuration = 60`) — aplikacja pokazuje spinner i pozwala
  anulować. Przycisk musi być JAWNYM kliknięciem właściciela („Zaproponuj
  odpowiedź"), nigdy automatem przy otwarciu maila.
- **Poziom w apce**: punktowe AI (jedyne miejsce AI w poczcie; drugie użycie
  lokalnego AI w panelu to odczyt paragonu OCR w module Kosztów — poza tym
  inwentarzem).

## GET /api/mail-templates

- **Po co**: Lista szablonów wiadomości („Snippets" à la Superhuman) do
  wstawiania w compose/odpowiedź.
- **Auth**: admin-only.
- **Żądanie**: brak.
- **Odpowiedź**: `{ "templates": MailTemplate[] }` — rosnąco po `created_at`.
- **Reguły biznesowe**: Bez seeda — właściciel tworzy własne od zera.
  Wstawienie szablonu w treść to logika czysto kliencka (aplikacja podmienia
  pola formularza; `temat` przydaje się głównie przy „Nowa wiadomość" —
  odpowiedź/przekazanie biorą temat z wątku).
- **Poziom w apce**: 1 (część modułu poczty).

## POST /api/mail-templates

- **Po co**: Nowy szablon.
- **Auth**: admin-only.
- **Żądanie** (JSON, wszystko opcjonalne): `nazwa` (max 200, domyślnie „Nowy
  szablon"), `temat` (max 300), `tresc` (max 10 000).
- **Odpowiedź**: `{ "ok": true, "id": "<uuid>" }`; 500 z komunikatem przy
  błędzie zapisu.
- **Poziom w apce**: 1.

## PATCH /api/mail-templates/[id]

- **Po co**: Edycja szablonu — pola aktualizowane tylko gdy OBECNE w body.
- **Auth**: admin-only.
- **Żądanie** (JSON): dowolny podzbiór `nazwa` / `temat` / `tresc` (te same
  limity długości; wartość nie-string zapisuje pusty string).
- **Odpowiedź**: `{ "ok": true }`; 400 przy braku body, 500 przy błędzie.
- **Poziom w apce**: 1.

## DELETE /api/mail-templates/[id]

- **Po co**: Usuwa szablon (twarde usunięcie, bez potwierdzenia po stronie
  serwera — pytanie „na pewno?" to obowiązek aplikacji).
- **Auth**: admin-only.
- **Odpowiedź**: `{ "ok": true }` (idempotentne — brak wiersza to też ok).
- **Poziom w apce**: 1.

## GET /api/ai/health

- **Po co**: Ping lokalnej Ollamy (przez Tailscale Funnel) — czy AI jest w
  ogóle dostępne i jakie modele są załadowane. Do dyskretnej diody/etykiety
  przy przyciskach AI.
- **Auth**: admin-only.
- **Żądanie**: brak.
- **Odpowiedź**: `{ "available": true, "models": ["qwen3.6:27b", "…"] }` —
  zawsze HTTP 200; brak konfiguracji / timeout (6 s) / błąd =
  `{ "available": false, "models": [] }`. Nigdy nie rzuca.
- **Reguły biznesowe**: `available: false` to stan normalny (lokalnie env
  Ollamy nie ma NIGDY; na produkcji Mac właściciela bywa wyłączony) —
  aplikacja chowa/wyszarza akcje AI, reszta poczty działa w 100 % bez AI.
- **Poziom w apce**: punktowe (razem z draft-reply).

## GET /api/references

- **Po co**: Opinie klientów z jawną zgodą na case study/referencję — zasila
  PUBLICZNĄ stronę `/[lang]/references`. W aplikacji panelowej raczej
  nieużywane (opisane dla kompletu inwentarza).
- **Auth**: **BRAK — świadomie publiczne** (jedyny wyjątek w tym pliku):
  dane z definicji publiczne, klient zgodził się na wykorzystanie
  marketingowe. Nigdy nie zwraca opinii bez `review_consent_case_study=true`
  i bez `review_submitted_at`.
- **Żądanie**: brak.
- **Odpowiedź**:
  ```json
  { "reviews": [ {
      "tytul": "…",                       // tytuł projektu
      "review_rating_jakosc": 5,          // oceny 1–5
      "review_rating_terminowosc": 5,
      "review_rating_komunikacja": 5,
      "review_comment": "…",
      "review_consent_name": true,        // czy wolno pokazać nazwę klienta
      "client_nazwa": "…", "branza": "…"
  } ] }
  ```
  Sortowane od najnowszych zgłoszeń.
- **Reguły biznesowe**: Gdy `review_consent_name` jest false, aplikacja/strona
  NIE pokazuje `client_nazwa` (anonimizuje np. do branży).
- **Poziom w apce**: — (strona publiczna, nie moduł panelu).

---

## Typy danych

Enumy — wartości zapisywane w bazie są PO POLSKU lub angielskimi kluczami
dokładnie jak niżej; aplikacja musi używać ich 1:1 (serwer waliduje).

```
MailDirection  = "in" | "out"
MailFolder     = "inbox" | "sent" | "trash" | "archive"
                 // etykiety: Odebrane / Wysłane / Kosz / Archiwum
MailStatus     = "nowy" | "obsłużony" | "zignorowany"     // UWAGA: polskie znaki, "obsłużony" z ó/ł
                 // etykiety: Do odpowiedzi / Obsłużony / Zignorowany
MailCategory   = "reklama" | "rachunek" | "urzedowe" | "oferta" | "inne"
                 // etykiety: Reklama / Rachunek / Urzędowe / Zapytanie / Rozmowa
MailSenderStatus = "pending" | "approved" | "blocked"      // screener nadawców
SnoozeOptionId = "later_today" | "tomorrow_morning" | "this_weekend" | "next_week"
```

### MailMessage (wiersz `mail_messages`)

```
id: string (uuid)
uid: number | null              // UID na serwerze IMAP; null = nieznany (np. wysłane z panelu) → MOVE niemożliwy (422)
kierunek: MailDirection
folder: MailFolder              // gdzie FIZYCZNIE leży na serwerze
client_id: string | null        // przypisanie do klienta (wyklucza lead_id)
lead_id: string | null
invoice_id: string | null       // powiązana faktura (ustawiane gdzie indziej, tu tylko odczyt)
from_addr: string               // znormalizowany adres; "" dla wychodzących z panelu
from_name: string
to_addr: string                 // adresy po przecinku
cc_addr: string | null          // null = jeszcze nie sprawdzone (backfill), "" = sprawdzone, brak DW
bcc_addr: string | null         // tylko wychodzące z panelu; nigdy w nagłówkach maila
subject: string
body_text: string
body_html: string               // W ODPOWIEDZIACH API ZAWSZE "" — HTML tylko odkażony przez GET /api/mail/[id]
message_id: string              // klucz dedupu (UNIQUE)
in_reply_to: string | null
refs: string | null             // łańcuch References (space-separated)
status: MailStatus
kategoria: MailCategory | null  // null = jeszcze nie policzona
list_unsubscribe_url: string | null  // null = nie sprawdzone, "" = brak linku, inaczej URL/mailto do wypisania
flagged: boolean                // flaga „ważne", tylko lokalna
thread_id: string | null        // null tylko przed backfillem
snooze_until: string | null     // ISO; termin w przyszłości = ukryta z kolejek
nudge_dismissed_at: string | null
received_at: string             // ISO; dla wychodzących = moment wysłania
handled_at: string | null
```

### MailMessageWithLinks (kształt z GET /api/mail i /api/mail/[id])

`MailMessage` plus rozwiązane przez serwer:

```
client_nazwa: string | null
lead_nazwa: string | null
invoice_numer: string | null
sender_status: MailSenderStatus | null  // null = nadawca nigdy nie trafił do screenera
client_status: string | null            // status klienta; "Aktywny" = VIP z automatu
```

### Wpis paska wątku (pole `thread` w GET /api/mail/[id])

```
{ id, subject, from_addr, from_name, kierunek, folder, status, received_at }
```

### NudgeThread (GET /api/mail/nudge)

```
id: string            // id reprezentatywnej wiadomości WYCHODZĄCEJ — cel PATCH nudgeDismissed i podglądu
thread_id: string
to_addr: string
subject: string
received_at: string   // data wysłania — dni ciszy = dziś − received_at
client_id / lead_id: string | null
client_nazwa / lead_nazwa: string | null
```

Próg: `MAIL_NUDGE_DAYS = 5` (stała w kodzie serwera, nie ustawienie).

### MailTemplate (`mail_templates`)

```
id: string (uuid)
nazwa: string    // max 200
temat: string    // max 300
tresc: string    // max 10 000
created_at / updated_at: string (ISO)
```

### Opcje snooze (logika serwera w lib/mail.ts — aplikacja musi ją odtworzyć
lokalnie, bo endpointu na listę opcji NIE ma; wartości `targetIso` liczone dla
czasu ściennego Europa/Warszawa)

```
later_today       „Później dziś (18:00)"                — tylko przed 16:00
tomorrow_morning  „Jutro rano (8:00)"                   — zawsze
this_weekend      „Ten weekend (sobota 9:00)"           — tylko pon–czw
next_week         „Przyszły tydzień (poniedziałek 8:00)" — najbliższy poniedziałek ŚCIŚLE po dziś
```

Wybrana opcja niesie gotowy ISO → `PATCH /api/mail/[id] { snoozeUntil }`.
Nigdy ręczny wybór daty z kalendarza.

### Załączniki wychodzące (compose / forward)

```
MIME: application/pdf, image/jpeg, image/png, image/webp, image/gif,
      application/msword, …wordprocessingml.document,
      application/vnd.ms-excel, …spreadsheetml.sheet,
      text/plain, text/csv, application/zip
Limity: 3 MB / plik, 4 MB łącznie (twardy pułap body na Vercelu ~4.5 MB)
```

Walidacja jest podwójna (klient + serwer) — aplikacja powinna walidować przed
wysyłką, ale błędy 400 z serwera i tak obsłużyć.

### Stałe różne

```
MAIL_RETENTION_MONTHS = 24   // starsze wiersze kasuje dzienny cron (RODO)
Limit listy: 200 wiadomości; limit syncu: 50/folder/przebieg
maxDuration: sync 90 s, compose/reply/forward/draft-reply 60 s
```
