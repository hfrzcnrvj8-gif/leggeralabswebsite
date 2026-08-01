# Prompt do wklejenia w nowym czacie — NOTATNIK

> Przepisany 2026-08-01 po domknięciu Przypomnień (Moduł 66). Poprzednia
> wersja powstała po Kosztach (Moduł 63) i zdążyła się zestarzeć w liczbach:
> mówiła o 170 testach (jest 189) i o dziewiątym module w `lib/instrukcje.ts`
> (jest jedenasty). Punkt startu niżej **zmierzony przy pisaniu tego pliku**,
> nie przepisany.

---

## ZACZNIJ OD TEGO — czego szukać, skoro autoryzacja jest czysta

Sześć ostatnich audytów ustawiło rytm: **sonda 401 nigdy nic nie znajduje,
a prawdziwa praca jest gdzie indziej.** Nie znaczy to, że sondy nie puszczać —
kwadrans i masz dowód zamiast założenia — ale nie planuj wokół niej dnia.

Realne znaleziska układają się dotąd w **trzy rodziny**, i warto wiedzieć,
której szukać:

1. **Cicha PODMIANA** (Projekty, Faktury, Katalog, Koszty): trasa bierze
   śmieć, podstawia wartość domyślną, odpowiada `{"ok":true}`.
2. **Cicha ODMOWA** (Przypomnienia, Moduł 66 — **rodzina odkryta dopiero
   wtedy**): warunek siedzi w `WHERE` zapytania, więc `UPDATE` nie zmienia
   nic, a trasa i tak mówi „zapisano". Użytkownik ustawia wartość, dostaje
   potwierdzenie, wartości nie ma. **W skutkach to to samo, co podmiana** —
   ekran pokazuje stan, którego w bazie nie ma.
3. **Brak wzorca w ogóle** (Poczta): moduł jest czysty, a robotą jest coś,
   czego w tabeli nie było.

Notatnik ma **zero `zeSlownika`** w 13 uchwytach (zmierzone), więc rodzina 1
jest tu prawdopodobna. Rodziny 2 szukaj gretem po `WHERE … AND` w trasach
`PATCH` — to jest sygnatura cichej odmowy.

---

## Punkt startu — zmierzone 2026-08-01, po commicie `0691e18`

- **13 uchwytów HTTP w 7 plikach** `app/api/notes` (liczone po
  `export async function`). W każdym pliku liczba bramek `if (!(await
  isAuthed()))` **równa się** liczbie uchwytów — czyli rozjazdu nie widać.
  **To przesłanka, nie dowód**: plik z trzema uchwytami i trzema bramkami może
  mieć jedną z nich w komentarzu, a inną powtórzoną. Sondę puść mimo to.
- **Wiersz w `59-spojnosc-ui.md`: 2 ❌ (Klawiatura, Stany), 3 ⚠️ (Nawigacja,
  Treść, Integralność).**
- **Klawiatura ❌ — prawie na pewno NIEAKTUALNE.** `NotesDashboard.tsx` ma
  `useSkrotyListy` (linia 115) i `PoleSzukania` (145). Potwierdź dyspozycją
  zdarzeń w przeglądarce, nie odczytem importów.
- **Nawigacja ⚠️ — prawie na pewno NIEAKTUALNE.** `app/[lang]/admin/notes/`
  ma katalog `[id]`, czyli adres rekordu z paczki E.
- **Stany ❌ — NIE zakładaj, że nieaktualne, mimo że `StanListy`
  i `StanBledu` SĄ zaimportowane.** To jest najważniejsze zdanie w tym
  pliku. Poczta i Przypomnienia **obie** miały `StanListy` wpięty
  i **obie** miały pusty stan, który KŁAMAŁ O POWODZIE: jeden zestaw słów
  obsługiwał dwie różne przyczyny pustki, więc szukanie bez trafień
  odpowiadało „nic nie należy do wybranej listy" — na widoku, gdzie żadna
  lista wybrana nie była. **Obecność komponentu to nie to samo, co poprawne
  słowa.** Sprawdź każdą drogę do pustego ekranu z osobna: zero notatek,
  fraza bez trafień, filtr tagu, zerwane połączenie.

### Inwentarz mylił się SZEŚĆ razy z rzędu — i za szóstym w OBIE strony

Przy Projektach, Fakturach, Katalogu i Kosztach był zawyżony (❌ dawno
sprzątnięte przez paczki A–G, których nikt do tabeli nie wpisał). Przy
Poczcie tak samo. **Przy Przypomnieniach po raz pierwszy mylił się w obie
strony**: dwie pozycje nieaktualne, ale cztery obowiązywały, w tym takie,
których nikt się nie spodziewał (cele dotykowe 15 px, brak menu kontekstowego).

**Wniosek: żaden kierunek nie jest domyślny. Mierz każdą pozycję osobno.**

---

## Trzy konkrety warte sondy

**1. `DELETE` kasuje na ślepo — nadal.** `app/api/notes/[id]/route.ts` robi
`DELETE FROM notes WHERE id = …` i oddaje `{"ok":true}`, nie sprawdzając, czy
cokolwiek zniknęło. To samo w `[id]/activity/[activityId]`. Katalog i Koszty
zamknęły to 404-ką: kasowanie czegoś, czego nie ma, wygląda w UI identycznie
jak kasowanie udane, więc zdublowana zakładka i stary link nie mają jak się
pokazać.

**2. Przekuwanie to WEJŚCIE danych do innych modułów.** Notatka staje się
leadem, projektem albo zadaniem — czyli błąd tutaj rodzi rekord-ducha gdzie
indziej. Sprawdź, czy idempotencja siedzi **na serwerze** (pamięć
`modul-26-notatnik` mówi, że tak — zweryfikuj, bo dokumentacja już kłamała),
a nie w blokadzie przycisku. Wzorzec odpowiedzi: `reused: true`, jak
`to-task`/`create-lead` w Poczcie. Dwie karty przeglądarki to dwa kliknięcia.

**3. Treść dowolna to jedyne takie miejsce w panelu.** Nie ma kwot ani dat
wymagalności, jest za to długi tekst. Pytania: co się dzieje z notatką na
5 MB, gdzie jest sufit długości, czy zawijanie i typografia trzymają się
przy 3000 znaków bez akapitu, i **czy treść da się zgubić** przy równoległej
edycji z telefonu i panelu.

---

## Zakres

### A. Integralność — sonda `curl` PER UCHWYT HTTP

```bash
DEV_ADMIN_BYPASS=0 npx next dev -p 3111   # sonda 401 — 13 uchwytów
npx next dev -p 3111                       # sonda biznesowa
```

Sonda biznesowa: śmieć w każde pole słownikowe (rodzaj, status przekucia,
powiązanie), `DELETE` nieistniejącego, `PATCH` z JEDNYM polem (czy reszta
przeżyje — czy to `PATCH`, czy `PUT` w przebraniu), **dwa przekucia tej samej
notatki**, notatka bez tytułu, załącznik o nieistniejącym id, oraz co zostaje
po usunięciu notatki, z której powstał lead.

### B. Dwa ❌ i trzy ⚠️ z inwentarza

Zmierz każde osobno; wynik — także „było nieaktualne" — wpisz do tabeli
w `59-spojnosc-ui.md` razem z przypisem, jak zrobiły to moduły 62–66.

| kategoria | co zmierzyć |
|---|---|
| **Klawiatura** ❌ | dyspozycja `keydown`: `/`, `j`, `k`, `Enter`, ⌘K |
| **Stany** ❌ | **cztery drogi do pustki, każda osobno** — patrz wyżej |
| **Nawigacja** ⚠️ | adres rekordu działa? 404 ma własny ekran, inny niż awaria? |
| **Treść** ⚠️ | długi tekst, zawijanie, typografia — tu to sedno, nie ozdoba |
| **Integralność** ⚠️ | sonda + konkrety 1 i 2 |

Dorzuć dwie kategorie, które w tabeli stoją na ✅, a przy Przypomnieniach
okazały się fałszywie zielone:

- **Klikalność** — zmierz `getBoundingClientRect` na ikonach wiersza. Próg to
  **24×24 px** (WCAG 2.5.8). Przypomnienia miały 15×15 i 18×18.
- **Gesty/menu** — `useContextMenu` w Notatniku ma **zero trafień**
  (zmierzone). Po Module 66 Notatnik i Kalendarz są **dwoma ostatnimi
  modułami bez menu pod prawym przyciskiem**.

### C. Cała lista kontrolna, trzy platformy

Parytet z apką: dowodem luki jest trasa panelu, której `APIClient` nie woła
(pamięć `apka-luki-wobec-panelu`). Przy Przypomnieniach tą metodą wyszło, że
z telefonu nie dało się zmienić nazwy listy. Sprawdź też, czy Notatnik na
iPadzie ma `NavigationStack` — bez niego miał martwą nawigację (pamięć
`apka-ipad-skroty-i-pencil-naprawy`).

### D. Ruch i haptyka

Panel: `lib/motion.ts` (`SPRING`, `EASE_LIQUID`), żadnych liczb z palca.
Apka: `Ruch.swift`. **Sprawdź, czy moduł w ogóle się odzywa** — Przypomnienia
milczały haptycznie przy 45 wywołaniach `odczuj?` w reszcie apki, a nikt tego
nie zauważył przez trzy tygodnie. Gardłem Notatnika jest **zapis treści
i przekucie**, nie otwarcie notatki.

---

## Co zastajesz po Przypomnieniach (Moduł 66)

- **`odczytajOpcjonalna()`** (`app/api/reminders/[id]/route.ts`) — wzorzec
  „opcjonalna data / opcjonalny tekst" w TRZECH przypadkach zamiast dwóch:
  brak/`null`/`""` = zdejmij, tekst = ustaw, **cokolwiek innego = 400**.
  Warunek `typeof raw === "string"` jako jedyny sprawiał, że liczba w polu
  daty kasowała termin i oddawała `{"ok":true}`.
- **Dwufazowy `PATCH`** — najpierw komplet sprawdzeń (także tych zależnych od
  stanu w bazie, liczonych od stanu **PO** patchu), potem zapisy. `neon()` nie
  ma transakcji, więc atomowość bierze się stąd, że po pierwszym zapisie nie ma
  już czego odrzucić. Bez tego komunikat „nie udało się zapisać" **kłamie**.
- **Klucz obcy to nie walidacja** — nieistniejące id daje 500. Każde pole
  wskazujące na inny rekord sprawdzaj `SELECT`-em przed zapisem.
- **`StanListy` z powodem dobranym do przyczyny** — i odwrotnie: przełącznik,
  który tylko DOKŁADA wiersze, nigdy nie jest powodem pustki i nie wolno go
  liczyć do „filtr aktywny".
- **Cel dotykowy: rośnie TRAFIENIE, nie rysunek** — `-m-1.5 p-1.5`; gdy
  przycisk niesie własne tło, rysunek schodzi do wewnętrznego `<span>`.
- **`formatPlDateTime` przeszło na `parsePgTimestamp`** — `new Date()` nie
  radzi sobie ze znacznikiem Neona w każdej przeglądarce, a to kod klienta.
- **`lib/instrukcje.ts` ma jedenasty moduł (Przypomnienia).** Zmiana gestu,
  skrótu albo miejsca kontrolki = poprawka tam, w tym samym commicie.
- **`npm test`: 189 przypadków**; `test/przypomnienia.test.ts` jako najświeższy
  wzór (czysta funkcja, bez bazy, jeden test na jedną rzecz zmierzoną sondą).
- **Seed dev-bazy ma teraz Przypomnienia.** Jeśli Notatnik też jest lokalnie
  pusty albo nie da się w nim odtworzyć stanu z upływu czasu — dołóż seed,
  zamiast wpisywać dane ręcznie w każdej sesji.

**Punkt startu:** `git log` w obu repozytoriach ma pokazać `0691e18` (panel)
i `c0946ed` (apka). Jeśli nie — ktoś pracował po drodze, sprawdź co.

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md`,
- `docs/plany-modulow/59-spojnosc-ui.md` — wiersz „Notatnik" i przypis ⁷,
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → **„Stan po module
  Przypomnienia"**,
- `HUB_SETUP.md` → „Moduł 66 — Przypomnienia" i „Moduł 26" (Notatnik).

---

## Świadome decyzje — NIE cofaj bez pytania

- **Szkic notatki z maila zawężony do źródła „mail"** (Moduł 50) — rozmowa
  telefoniczna świadomie poza zakresem, quick-log bez zmian.
- **Model tylko PROPONUJE.** Przy Poczcie wyszło, że reguła była prawdziwa
  w kodzie, ale **niewidoczna na ekranie** — propozycja wyglądała jak zdanie
  napisane ręcznie. Szkic notatki robił to od początku dobrze; sprawdź, czy
  nadal.
- **Eksporty świadomie BEZ sufitu** — obcięty plik kłamie gorzej niż wolny.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Czego NIE ruszać

- `PO_REJESTRACJI.md` — firma nie jest zarejestrowana.
- Przeprowadzka na NAS (Moduł 55) — czeka na rejestrację.
- Nowy punkt użycia lokalnego LLM wymaga wyraźnej prośby właściciela.
- **Sufit liczby odbiorców w Poczcie** (500 adresów w jednym „Do" przechodzi
  bez ostrzeżenia) — zmierzone w Module 65, zostawione właścicielowi.
- **Ikony 15×15 w Katalogu** (`CatalogDashboard.tsx`) — zmierzone w Module 66,
  ten sam wzorzec co naprawiony w Przypomnieniach. **Do rozstrzygnięcia, czy
  przejść tym przez cały panel** — nie rób tego przy okazji.

---

## Weryfikacja — pułapki, na których traci się czas

- **Podgląd przeglądarki ma zamrożony `requestAnimationFrame`** (karta
  „hidden"), więc `AnimatePresence` nigdy nie kończy przenikania i modal
  **nie pojawia się na zrzucie mimo poprawnego kodu**. Rozstrzyga odczyt DOM
  (`innerText` z overlaya), nie screenshot. Sprawdź `document.visibilityState`,
  zanim uznasz cokolwiek za zepsute.
- **Konsola przeglądarki ma bufor SKUMULOWANY między przeładowaniami.**
  Ostrzeżenie po edycji potrafi wisieć jeszcze długo po naprawie. Rozstrzyga
  wejście na stronę, która danego kodu **nie ma** — jeśli komunikat dalej
  tam jest, to ślad, nie usterka.
- **Klikając z poziomu JS, wyklucz nawigację** — `querySelectorAll('button')`
  trafia najpierw w link paska bocznego i przenosi Cię na inny ekran (zdarzyło
  się w Module 66, mimo ostrzeżenia w poprzednim promptcie).
- **Sonda z błędnym słownikiem wygląda jak martwa funkcja.** W Module 66
  podanie `"co tydzień"` zamiast `co_tydzien` pokazało `null` wszędzie i przez
  chwilę wyglądało na to, że powtarzanie nie działa wcale. **Narzędzie pomiaru
  myli się w stronę paniki** — sprawdź słownik w `lib/`, zanim ogłosisz awarię.
  (Przy okazji wyszło prawdziwe znalezisko: trasa te klucze przyjmowała.)
- **PGlite kasuje się przy każdym przeładowaniu modułów serwera** — twórz dane
  testowe i mierz je w jednym ciągu, albo dołóż je do seeda.
- **`tsc` nie sprawdza SQL-a ani JSX-a, który odrzuci Turbopack.** Po każdej
  paczce **załaduj dotknięty ekran**.
- **Next 16 nie uruchomi drugiego serwera dev dla tego samego katalogu** —
  `lsof -iTCP -sTCP:LISTEN -P | grep 3000` przed startem.

**Apka w symulatorze na LOKALNYM panelu:**

```bash
Skrypty/stempel-wersji.sh          # PRZED xcodebuild, inaczej build odmówi
xcrun simctl terminate <udid> pl.leggeralabs.hub    # KONIECZNIE przed launch
SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny \
SIMCTL_CHILD_LEGGERA_DEV_TOKEN=dev \
  xcrun simctl launch <udid> pl.leggeralabs.hub
```

`simctl launch` na **już działającej** apce nie poda jej zmiennych
środowiskowych — zwróci ten sam PID, a apka dalej będzie gadać z produkcją.
Backend `lokalny` to port 3000, więc dev uruchom właśnie tam. Panel z
`DEV_ADMIN_BYPASS=1` przyjmie dowolny token. Notatnik siedzi pod „Więcej"
na iPhonie, a w pasku bocznym na iPadzie. Przestrzeń dotyku symulatora ≠
piksele zrzutu.

---

## Na koniec modułu

- Dopisz „Stan po module Notatnik" do `51-audyt-uiux-panel-i-apka.md` —
  **łącznie z tym, czego NIE zmieniłeś i dlaczego**. Przy module w dobrym
  stanie to jest główny produkt sesji.
- Wypełnij wiersz „Notatnik" w `59-spojnosc-ui.md` wraz z przypisem.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` (będzie dwunasty) — dopiero gdy jest
  sprawdzony.
- Przygotuj prompt do następnego modułu. Po Notatniku zostają **dwa ostatnie
  wiersze** listy kontrolnej Modułu 59:
  - **Kalkulator** — Klawiatura ❌, Stany ⚠️ (Klikalność i Gesty mają „—",
    bo to ankieta, nie lista);
  - **Kalendarz** — Klawiatura ❌, ale **uwaga: to prawdopodobnie świadoma
    decyzja, nie brak.** `59-spojnosc-ui.md` notuje przy nim „nic (świadomie
    zostaje bez `/` i `j/k`)" z odesłaniem do `HUB_SETUP.md`. Sprawdź to,
    zanim zaplanujesz tam pracę — może się okazać, że wiersz wymaga tylko
    zmiany ❌ na „—" z przypisem.
- `rm -f .git/index.lock && git add -A && git commit && git push`.
