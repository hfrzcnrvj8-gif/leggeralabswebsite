# Moduł 4e — Poczta: upodobnienie UX do Apple Mail (sidebar, toolbar, wygląd)

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md`, sekcję
> „Moduł 4" w `HUB_SETUP.md`, oraz `docs/plany-modulow/04b-poczta-pelny-klient.md`
> (Etap 2 — foldery IMAP, już zbudowany, fundament pod ten brief). Powstał
> 2026-07-16 po audycie UX/wydajności modułu Poczty (patrz `HUB_SETUP.md` →
> sekcje "Moduł 4 — Etap 2" i "Wydajność nawigacji") — właściciel wskazał
> Apple Mail jako "złoty standard" i przesłał zrzuty ekranu realnego Apple
> Mail (przeglądany na jego Macu) do porównania. **To WYŁĄCZNIE runda
> wizualna/strukturalna UI — backend (foldery, MOVE, sync) jest już gotowy z
> Etapu 2 i nie wymaga zmian, poza jednym maleńkim dodatkiem opisanym w
> punkcie 3 niżej.**

## Kontekst i stan wyjściowy

Moduł Poczty ma już (Etap 2, 2026-07-16): prawdziwe foldery IMAP (Odebrane/
Wysłane/Kosz/Archiwum) z sidebarem, nawigację klawiaturą (j/k/Enter/r/e/Esc),
zaznaczanie wielu wiadomości + akcje zbiorcze, bezpieczny MOVE (nigdy
EXPUNGE). Wydajność została też naprawiona w tej samej sesji: sync poczty
~3.2s (z ~20s), a osobno znaleziony i naprawiony problem CAŁEGO panelu —
sidebar nawigacji prefetchował 12 stron na każde wejście (patrz `HUB_SETUP.md`
→ "Wydajność nawigacji").

Właściciel przesłał dwa zrzuty ekranu: nasz obecny panel Poczty i realny
Apple Mail. Poniższe różnice i decyzje wynikają z ich bezpośredniego
porównania.

## Decyzje właściciela (2026-07-16) — zatwierdzone, NIE renegocjuj bez pytania

1. **Pasek akcji wiadomości (Odpisz/Odpowiedz wszystkim/Przekaż/Archiwizuj/
   Usuń/Wycisz/Obsłużone/Otwórz w Outlooku) przenosi się na GÓRĘ podglądu
   wiadomości**, w stały pasek tuż pod tematem/tagami — dziś jest rządkiem
   przycisków NA DOLE, po treści maila. W Apple Mail ten pasek jest zawsze
   widoczny bez przewijania; ma to być tak samo u nas.
2. **Filtry kategorii ("Rodzaj": Zapytanie/Rachunek/Urzędowe/Rozmowa/
   Reklama) przenoszą się do sidebara jako własna sekcja**, wzorem
   "Inteligentnych skrzynek pocztowych" z Apple Mail (Faktura/Rachunek/
   Załącznik/Raporty na zrzucie właściciela) — dziś to osobny poziomy
   rządek pigułek nad listą. **Filtry statusu ("Do odpowiedzi"/
   "Nieprzypisane"/"Wszystkie") NIE są częścią tej decyzji — zostają, gdzie
   są dziś** (poziomy rządek nad listą), właściciel pytany był tylko o
   kategorie.
3. **Dodać baner "Wiadomość z listy dystrybucyjnej" + realny link "Anuluj
   subskrypcję"**, wzorem Apple Mail. To NIE jest tylko wizualne — wymaga
   małej zmiany backendu (patrz punkt 3 niżej), bo dziś przechowujemy tylko
   BOOLEAN obecności nagłówka `List-Unsubscribe`, nie samą wartość
   (link/adres do wypisania).
4. **Zakres tej rundy: restrukturyzacja UKŁADU + dopracowanie WIZUALNE**
   (typografia, odstępy, gęstość, hierarchia) — nie tylko przestawienie
   elementów w nowe miejsca, ale też żeby całość "czuła się" jak Apple
   Mail, nie tylko miała podobny układ.

## Co ŚWIADOMIE zostaje bez zmian (nie renegocjuj)

- **Emoji, nie biblioteka ikon.** Pytane wprost 2026-07-16 (druga runda tej
  samej decyzji, już raz potwierdzonej w Etapie 2) — właściciel wybrał
  "Zostaw emoji" oba razy. Apple Mail używa ikon SF Symbols, ale to
  świadomie NIE jest częścią naśladowania — panel ma swój, ugruntowany
  język wizualny (patrz CLAUDE.md).
- **Jedna skrzynka, brak koncepcji "kont"** — sekcja "Na moim Macu" z
  Apple Mail (Google/iCloud/inne konto z licznikami) nie ma odpowiednika,
  bo to jedna skrzynka (az.pl). Nie dodawaj namiastki wielu kont.
- **Foldery/MOVE/sync z Etapu 2 działają i NIE są w zakresie tej rundy** —
  to czysto wizualna/strukturalna praca na już istniejących danych i
  endpointach, poza jednym maleńkim dodatkiem (punkt 3).
- **Status "Do odpowiedzi"/"Nieprzypisane"/"Wszystkie" zostaje jako rządek
  pigułek nad listą** — nie przenoś do sidebara razem z kategoriami (patrz
  decyzja 2 wyżej — to była świadomie zawężona decyzja).

## Plan techniczny

### 1. Pasek akcji na górze podglądu wiadomości

Plik: `app/[lang]/admin/mail/MailDetailPanel.tsx`.

Dziś rządek przycisków (`Odpisz`/`Odpowiedz wszystkim`/`Przekaż`/
`Obsłużone`/`Przywróć do odpowiedzi`/`Wycisz`/`Archiwizuj`/`Usuń`/`Przywróć
do Odebranych`/`Otwórz w Outlooku`) renderuje się w gałęzi `else` PO bloku
treści maila (`{html ? <MailBodyHtml/> : ...}`), czyli na samym dole karty.
Przenieś ten blok (i analogicznie blok `replyOpen`/`forwardOpen` z polem
odpowiedzi) na górę — bezpośrednio pod nagłówkiem (`mail.subject` + tagi +
przycisk zamknięcia), PRZED treścią maila. Struktura docelowa karty (od
góry): temat + tagi + zamknij → **pasek akcji** → (jeśli otwarty tryb
odpowiedzi/przekazania: formularz w tym samym miejscu, zastępując pasek
akcji, tak jak dziś) → linki klient/lead/faktura → treść maila → sekcja
"Z maila → zadanie".

Grupowanie przycisków (żeby pasek nie był przeładowany, wzorem Apple Mail,
które ma wyraźnie mniej przycisków widocznych naraz niż dziś mamy w jednym
rządku) — sugerowany podział, ale to decyzja WYKONAWCZA, nie wymaga
ponownego pytania właściciela:
- **Główna akcja** (`.btn-primary`, jak dziś): "Odpisz".
- **Drugorzędne, zawsze widoczne**: "Przekaż", "Archiwizuj", "Usuń".
- **Rzadziej używane → chowaj w menu "•••"** (wzorem `Popover`/`MenuRow` z
  `app/[lang]/admin/Menu.tsx`, już używanego w `ClientsDashboard.tsx` dla
  paska akcji zbiorczych — reużyj ten komponent, nie pisz nowego): "Wycisz",
  "Obsłużone"/"Przywróć do odpowiedzi" (zależnie od stanu), "Przywróć do
  Odebranych" (gdy w Koszu/Archiwum), "Otwórz w Outlooku".

Skrót klawiszowy `r` (już zbudowany w Etapie 2, `replyShortcut` prop) ma
dalej działać identycznie — tylko zmienia się POZYCJA paska, nie logika.

### 2. Kategorie do sidebara jako "Rodzaje"

Pliki: `app/[lang]/admin/mail/MailDashboard.tsx`.

Dziś: `CAT_FILTERS` renderuje się jako poziomy rządek pigułek pod `FILTERS`
(oba warunkowane `activeFolder === "inbox"`, linie ok. 355-376 w obecnym
kodzie). Przenieś `CAT_FILTERS` do bocznego paska, jako osobną sekcję POD
sekcją folderów (`MAIL_FOLDERS.map(...)`), z nagłówkiem sekcji (np. "Rodzaj"
— małą, wyciszoną etykietą, wzorem "Inteligentne skrzynki pocztowe" w Apple
Mail) i licznikami z już istniejącego `counts` (`counts[c.id]`, bez zmian w
API). Ta sekcja **renderuje się TYLKO gdy `activeFolder === "inbox"`**
(kategorie nie mają sensu w Wysłane/Kosz/Archiwum — bez zmian względem
dzisiejszej logiki, tylko inne miejsce w DOM-ie). `FILTERS` (Do odpowiedzi/
Nieprzypisane/Wszystkie) **zostaje** jako rządek pigułek nad listą, bez
zmian pozycji (decyzja 2 wyżej).

Uwaga UX: skoro sidebar rośnie (foldery + rodzaje), sprawdź na wąskim
ekranie (`<lg`, gdzie dziś sidebar staje się poziomym paskiem pigułek —
patrz komentarz "Na węższych ekranach" w obecnym kodzie) czy dwie sekcje
jedna nad drugą nadal się mieszczą sensownie, czy potrzebują np. wizualnego
separatora (`border-t hairline` między sekcjami, tak jak już jest użyte
gdzie indziej w tym pliku).

### 3. Baner "Wiadomość z listy dystrybucyjnej" + link wypisu

To JEDYNA zmiana backendu w tej rundzie — wymaga nowej kolumny, bo dziś
`list_unsubscribe` to `BOOLEAN` (sama obecność nagłówka), nie jego treść
(URL/mailto do wypisania).

**`lib/db.ts`** (`createMailSchema()`, wewnątrz istniejącej bramki `"mail"`
— dodanie kolumny do już istniejącej migracji podniesie wersję przy
najbliższym deployu i puści ten `ALTER` automatycznie, patrz mechanizm
bramki migracji):
```sql
ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS list_unsubscribe_url TEXT;
```
Nullable, bez `DEFAULT` — `NULL` = "nie sprawdzone/brak", `''` = "sprawdzone,
nagłówek był ale bez sensownego linku", niepusty string = realny URL/mailto
do wypisania. Ten sam wzorzec co `cc_addr`/`kategoria` (patrz istniejące
komentarze w `createMailSchema()`).

**`lib/mail.ts`** (`MailHeaderHints` — dziś `{ listUnsubscribe: boolean;
precedence: string | null; autoSubmitted: string | null }`): dodaj pole
`listUnsubscribeUrl: string | null`. Dodaj czystą funkcję
`parseUnsubscribeUrl(headerValue: string | null): string | null` — nagłówek
`List-Unsubscribe` ma format `<https://...>, <mailto:...>` (RFC 2369/8058,
może mieć jeden lub oba warianty w nawiasach kątowych, oddzielone
przecinkiem) — **preferuj `https://`/`http://`** (można otworzyć w
przeglądarce jednym kliknięciem), dopiero potem `mailto:` jako fallback
(otwiera domyślny klient pocztowy — akceptowalne, to i tak tylko PROPOZYCJA
linku, użytkownik i tak go świadomie klika). Zwróć `null`, gdy nagłówek jest
pusty/nie do sparsowania — nigdy nie zgaduj/nie konstruuj URL-a.

**`lib/mailbox.ts`**: w `fetchMessagesInFolder()` i `fetchHintsByUids()`
dociągnij SUROWĄ wartość nagłówka `list-unsubscribe` (dziś tylko sprawdzane
`.has(...)`/regex obecności — trzeba faktyczną wartość: `parsed.headers.get
("list-unsubscribe")` w pierwszej funkcji, dociągnięcie treści nagłówka w
drugiej, analogicznie do już pobieranych `precedence`/`auto-submitted`).
Przepuść przez `parseUnsubscribeUrl()` i dołóż do `hints`.

**`lib/mailSync.ts`**: `saveIncoming()` zapisuje nową kolumnę przy insercie;
`backfillCategories()` (już dociąga `list_unsubscribe`/`precedence`/
`auto_submitted` dla starych wiadomości po UID-zie) dociąga też
`list_unsubscribe_url` tym samym mechanizmem — rozszerz zapytanie/update,
nie pisz nowej funkcji backfillu.

**`app/api/mail/route.ts` / `[id]/route.ts`**: dodaj `list_unsubscribe_url`
do `SELECT` (już jest `m.*`/jawna lista kolumn w kilku miejscach — sprawdź
oba routy).

**UI (`MailDetailPanel.tsx`)**: gdy `mail.list_unsubscribe_url` niepuste,
pokaż baner NAD treścią maila (pod paskiem akcji z punktu 1, wzorem
umiejscowienia w Apple Mail) — krótki tekst "Wiadomość z listy
dystrybucyjnej." + link/przycisk "Anuluj subskrypcję" otwierający URL w
nowej karcie (`target="_blank" rel="noopener noreferrer"` dla `http(s)`,
zwykły `<a href="mailto:...">` dla `mailto:`) — **to zwykły klik
użytkownika w link, nie automatyczne wywołanie przez nasz serwer** (panel
nigdy sam nie odpytuje ani nie POST-uje do cudzego URL-a wypisu w tle —
to byłaby nieproszona akcja na cudzej infrastrukturze; wystarczy podać
gotowy, klikalny link, tak jak robi to każdy klient pocztowy).

### 4. Dopracowanie wizualne (typografia/odstępy/gęstość)

Zakres "restrukturyzacja + dopracowanie" (decyzja 4) — konkretne punkty do
porównania ze zrzutem Apple Mail właściciela i dociągnięcia w tej samej
rundzie (bez nowych kolorów/komponentów spoza istniejącego design systemu —
`.card-paper`/`hairline`/`brand-*`):
- Wiersz na liście wiadomości: sprawdź, czy odstępy pionowe (`py-3` dziś)
  dają tyle "oddechu" ile na zrzucie Apple Mail — tam odstęp między
  wierszami jest wyraźnie hojniejszy niż linia oddzielająca sugerowałaby.
- Nagłówek podglądu wiadomości: Apple Mail pokazuje nazwę nadawcy jako
  wyraźnie największy, najbardziej wyróżniony element (większy niż temat),
  z adresem/domeną przygaszoną obok. Porównaj z dzisiejszą hierarchią w
  `MailDetailPanel.tsx` (dziś temat jest `text-lg`, nadawca mniejszy pod
  spodem) — rozważ odwrócenie akcentu, jeśli będzie bliżej wzorca.
  Konkretny wybór hierarchii to decyzja wykonawcza (nie wymaga pytania
  właściciela), ale ma być OPARTA na bezpośrednim porównaniu ze zrzutem, nie
  na intuicji — miej zrzut przed oczami przy tej pracy.
- Sprawdź szerokość/proporcje kolumn na szerokim ekranie po dodaniu sekcji
  "Rodzaj" do sidebara (punkt 2) — może to dodatkowo złagodzić puste
  miejsce zgłoszone w audycie 2026-07-16 (`docs/plany-modulow/04b-...md`,
  `HUB_SETUP.md` → "Moduł 4 — Etap 2"), skoro sidebar zajmuje teraz więcej
  przestrzeni.

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian.
2. Lokalnie (`preview_start name:"dev"`, PGlite + dev-login — patrz
   `CLAUDE.md` → "Lokalne środowisko dev"): żeby zobaczyć baner wypisu,
   dodaj do seeda w `lib/dev-db.ts` jedną wiadomość z syntetyczną wartością
   `list_unsubscribe_url` (np. `https://example.com/unsubscribe?id=test`)
   — bez tego nie da się wizualnie zweryfikować banera lokalnie (PGlite nie
   ma dostępu do prawdziwych nagłówków IMAP).
3. Sprawdź w przeglądarce: pasek akcji na górze (widoczny bez przewijania
   nawet przy długim mailu), sekcja "Rodzaj" w sidebarze z poprawnymi
   licznikami, klik w "Anuluj subskrypcję" otwiera link w nowej karcie.
4. Realne dociągnięcie prawdziwej wartości `list_unsubscribe_url` z
   działającej skrzynki (czy parsowanie nagłówka faktycznie wyciąga
   poprawny URL z prawdziwego newslettera) — do potwierdzenia na produkcji,
   jak zawsze przy zmianach dotykających parsowania IMAP.
5. Zaktualizuj `HUB_SETUP.md` (nowa podsekcja pod "Moduł 4 — Etap 2") i
   odhacz ten plik jako zrobiony w `docs/plany-modulow/README.md`.
