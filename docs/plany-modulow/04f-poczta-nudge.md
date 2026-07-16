# Moduł 4f — Poczta: follow-up nudge (wysłałeś, cisza od N dni)

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md`, sekcję
> „Moduł 4" w `HUB_SETUP.md`, oraz `docs/plany-modulow/04b-poczta-pelny-klient.md`
> (Etap 3 — VIP/Snooze/screener/wątkowanie już zrobione, ten plik to OSTATNI
> nieskończony punkt tamtego etapu). Średni, wymaga nowego kształtu zapytania
> SQL (agregacja na poziomie wątku, nie pojedynczej wiadomości) — inny niż
> reszta modułu, stąd świadomie osobna runda.

## Skąd to się wzięło

Panel ma dziś „Wiadomości do odpowiedzi" — kolejkę PRZYCHODZĄCEJ poczty
wymagającej reakcji (`status = 'nowy' AND kierunek = 'in'`). Brakuje
odwrotności: **wysłałeś ofertę/pytanie, minęło N dni, cisza** — to
prawdopodobnie najbardziej dochodowa brakująca funkcja w module dla
solo-konsultanta gonionego za sprzedażą (oryginalna ocena z
`docs/plany-modulow/04b-poczta-pelny-klient.md`, sekcja „Etap 3").
Deterministyczne, zero AI — zgodnie z zasadą całego panelu.

## Dlaczego to osobna runda (nie dorzucone do VIP/Snooze)

VIP i Snooze (zrobione 2026-07-16, patrz `HUB_SETUP.md` → „Moduł 4, Etap 3 —
VIP + Snooze") to oba proste rozszerzenia wzorca „filtr po stronie klienta
na już pobranej liście do 200 wierszy JEDNEGO folderu". Nudge jest z innej
bajki:
- Wymaga **agregacji na poziomie WĄTKU**, nie pojedynczej wiadomości —
  „wątek bez odpowiedzi" to własność `thread_id`, nie `mail_messages.id`.
- Wymaga danych **W POPRZEK DWÓCH FOLDERÓW** naraz — wysłana wiadomość
  (`kierunek='out'`) żyje w `folder='sent'`, ewentualna odpowiedź
  (`kierunek='in'`) w `folder='inbox'`. Dzisiejsze zapytania listy
  (`app/api/mail/route.ts`) są świadomie zawężone do JEDNEGO folderu
  naraz (`WHERE m.folder = ${folder}`) — nudge potrzebuje przekrojowego
  zapytania, którego dziś nigdzie w kodzie nie ma.
- Prawdopodobnie dotyka **dziennego digestu mailowego**
  (`app/api/leads/notify/route.ts`), nie tylko UI panelu — patrz pytanie 3
  niżej.

## Co już istnieje i nadaje się do reużycia

- **`thread_id`** — kolumna na `mail_messages`, wypełniana przez
  `resolveThreadId()`/`backfillThreadIds()` (`lib/mailSync.ts`, Moduł 4
  Etap 3 „wątkowanie"). Nie trzeba pisać nowego mechanizmu wątkowania —
  tylko odpytać istniejącą kolumnę.
- **Wzorzec „ile dni od X"** — `daysBetweenISO()` (`lib/dates.ts`), już
  używany do podobnych wyliczeń gdzie indziej w panelu (np. eskalacja
  windykacji faktur, Moduł 13). Reużyj zamiast pisać nową arytmetykę dat.
- **Pasek wątku w podglądzie** (`MailDetailPanel.tsx`, zapytanie `WHERE
  thread_id = ${message.thread_id} AND id != ${id}`) — to NIE jest
  agregat po wszystkich wątkach naraz (pobiera siostrów JEDNEJ otwartej
  wiadomości), ale pokazuje, że zapytanie „inne wiadomości tego wątku,
  niezależnie od folderu" już gdzieś w kodzie istnieje i działa — dobry
  punkt odniesienia dla nowego zapytania agregującego.
- **Wzorzec digestu** (`app/api/leads/notify/route.ts`,
  `buildAndSendDigest()`) — `pendingMails` (linie ok. 311-323 w obecnym
  kodzie) to gotowy szablon: `Promise.all` z innymi zapytaniami, potem
  linia w tekście maila (`mailLines`/`followupLines`, wzorzec ok.
  345-375). Nowa sekcja nudge ma iść tym samym wzorcem, nie osobnym.
- **`MAIL_STATUSES`/`MailStatusTag`** (`lib/mail.ts`, `shared.tsx`) —
  prawdopodobnie NIE trzeba nowego statusu w bazie (patrz pytanie 1 niżej,
  to może być czysto obliczeniowe, jak VIP).

## Pytania do zadania właścicielowi na starcie (zakres świadomie otwarty)

1. **Czy nudge to nowa kolumna, czy czysto obliczeniowe (jak VIP)?**
   VIP nie dodał żadnej kolumny — flaga wynika z JOIN-a przy odczycie.
   Nudge może działać identycznie: `NOT EXISTS (SELECT 1 FROM
   mail_messages m2 WHERE m2.thread_id = m.thread_id AND m2.kierunek =
   'in')` jako warunek przy `kierunek='out' AND folder='sent'`, plus próg
   dni liczony na bieżąco z `received_at`. Zaletą braku kolumny: zero
   migracji, zero ryzyka rozjazdu stanu. Wadą: nie da się „odznaczyć"
   nudge'a ręcznie (np. „wiem, że nie odpowie, przestań mi przypominać") —
   czy to jest potrzebne? Jeśli tak, potrzeba kolumny (`nudge_dismissed_at`
   albo podobnej, wzorem `snooze_until`).
2. **Próg dni (N) — stała w kodzie, czy ustawienie właściciela?** Reszta
   panelu unika ustawień-do-przełączania (deterministyczne reguły, nie
   konfiguracja) — sugerowana stała `MAIL_NUDGE_DAYS = 5` (dokładnie
   przykład z oryginalnego brifu: „wysłałeś ofertę 5 dni temu, cisza") w
   `lib/mail.ts`, zmienialna przez edycję kodu, nie przez UI. Potwierdzić z
   właścicielem, czy 5 dni to dobra wartość startowa.
3. **Gdzie ma się pokazywać — UI panelu, dzienny digest mailowy, czy oba?**
   - **UI**: nowa zakładka „Bez odpowiedzi"/„Do przypilnowania" w widoku
     folderu „Wysłane" (`MailDashboard.tsx`, wzorem istniejących zakładek
     VIP/Uśpione), plus mały wskaźnik `⏰`/⚠️ na wierszu listy (wzorem
     wskaźnika snooze).
   - **Digest**: nowa sekcja w mailu z `app/api/leads/notify/route.ts`
     (np. „N wiadomości bez odpowiedzi od klienta: Firma X — 6 dni").
     Prawdopodobnie WIĘKSZA wartość niż sam UI — właściciel czyta digest
     codziennie rano, a Poczty może nie otwierać, jeśli nic nowego nie
     przyszło.
   Rekomendacja (do potwierdzenia, nie decyzja): zrobić OBA w jednej
   rundzie — to samo zapytanie zasila obie ścieżki, koszt krańcowy drugiej
   jest niski, gdy pierwsza już istnieje.
4. **Czy nudge ma liczyć się per-wątek, czy per-wiadomość wychodząca?**
   Jeśli wysłałeś DWIE wiadomości w tym samym wątku bez odpowiedzi
   (np. ofertę, potem przypomnienie), czy to JEDEN wpis na liście nudge,
   czy dwa? Sugerowane: jeden na wątek (jak grupowanie `threadGroups` w
   `MailDashboard.tsx` już robi dla zwykłej listy), licząc dni od
   NAJNOWSZEJ wychodzącej wiadomości w wątku (`MAX(received_at) WHERE
   kierunek='out'`), nie od pierwszej.

## Szkic zapytania (punkt startowy, nie gotowe rozwiązanie)

Do zweryfikowania i dopracowania w trakcie budowy, nie kopiować 1:1:

```sql
SELECT m.thread_id, m.to_addr, m.subject, m.received_at, m.client_id, m.lead_id
FROM mail_messages m
WHERE m.kierunek = 'out'
  AND m.folder = 'sent'
  AND m.received_at = (
    SELECT MAX(m2.received_at) FROM mail_messages m2
    WHERE m2.thread_id = m.thread_id AND m2.kierunek = 'out'
  )
  AND NOT EXISTS (
    SELECT 1 FROM mail_messages m3
    WHERE m3.thread_id = m.thread_id AND m3.kierunek = 'in'
  )
  AND m.received_at <= now() - interval '5 days';
```

Rzeczy do sprawdzenia przy budowie, nie założone z góry:
- Wydajność przy realnej liczbie wątków (skorelowane podzapytania x2 na
  wiersz — czy `thread_id` ma indeks; jeśli nie, dodać
  `CREATE INDEX IF NOT EXISTS mail_messages_thread_id_idx` — **sprawdź
  najpierw, czy już istnieje** z Etapu 3 wątkowania, żeby nie dublować).
- Czy wątki bez `thread_id` (NULL, sprzed migracji/przed backfillem) mają
  być pomijane, czy fallback na `id` (wzorem `threadGroups` w
  `MailDashboard.tsx`: `const key = m.thread_id || m.id`).
- Czy `kierunek='out'` wychodzące z `saveOutgoingFromServer()`/kompozycji w
  panelu wystarczy, czy trzeba też uwzględnić wiadomości, które właściciel
  oznaczył ręcznie jako „obsłużone" mimo braku realnej odpowiedzi (czy to
  ma wykluczać z nudge — prawdopodobnie TAK, `status != 'obsłużony'`
  dorzucone do WHERE, do potwierdzenia z właścicielem: czy ręczne
  odhaczenie ma „uciszać" nudge tak jak Wycisz/Obsłużone uciszają zwykłe
  „Do odpowiedzi").

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian.
2. Fixture w `lib/dev-db.ts` — wątek z SAMĄ wiadomością wychodzącą
   (`kierunek='out'`, `folder='sent'`), `received_at` starsze niż próg dni,
   bez żadnej odpowiedzi w tym samym `thread_id` — bez tego nie da się
   lokalnie zweryfikować niczego (PGlite nie ma dostępu do realnej
   skrzynki). Dorzuć też wątek KONTROLNY, który WYGLĄDA podobnie, ale MA
   odpowiedź (`kierunek='in'` w tym samym `thread_id`) — musi NIE pojawić
   się w nudge, żeby złapać fałszywe pozytywy.
3. Sprawdź w przeglądarce: nowa zakładka/wskaźnik w „Wysłane" pokazuje
   dokładnie oczekiwany wątek, kontrolny wątek z odpowiedzią jest
   wykluczony.
4. Jeśli w zakresie (patrz pytanie 3): dzienny digest zawiera nową sekcję —
   zweryfikować treść lokalnie (funkcja budująca tekst maila jest czystą
   funkcją, da się sprawdzić bez realnej wysyłki), rzeczywistą wysyłkę i
   wygląd w skrzynce można potwierdzić dopiero na produkcji.
5. Zaktualizuj `HUB_SETUP.md` (nowa podsekcja pod „Moduł 4") i odhacz ten
   plik jako zrobiony w `docs/plany-modulow/README.md` oraz w Etapie 3
   `docs/plany-modulow/04b-poczta-pelny-klient.md`.
