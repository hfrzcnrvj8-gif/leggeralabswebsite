# Prompt do wklejenia w nowym czacie — PRZYPOMNIENIA

> Powstał 2026-08-01, po domknięciu Poczty (Moduł 65).
> Kolejność wybrana przez właściciela: Poczta przed Notatnikiem.
> Notatnik ma gotowy prompt (`PROMPT-64-NOTATNIK.md`) i czeka dalej — ten
> moduł wchodzi przed nim, bo Przypomnienia **sterują automatami**.

---

## ZACZNIJ OD TEGO — co ten moduł ma innego niż pięć poprzednich

Projekty, Faktury, Katalog i Koszty miały tę samą rodzinę usterek: trasa bierze
śmieć, po cichu podmienia go na domyślną wartość i odpowiada `{"ok":true}`.
Poczta tego wzorca **nie miała** — i wejście z założeniem, że ma, kosztowałoby
dzień (patrz `51-audyt-uiux-panel-i-apka.md` → „Stan po module Poczta").

Przypomnienia stoją gdzieś pośrodku i mają własne, trzecie ryzyko:
**to jedyny moduł, w którym data nie tylko OPISUJE, ale URUCHAMIA.**

Zły termin w koszcie maluje wiersz na pomarańczowo. Zły termin w przypomnieniu
decyduje, czy powiadomienie przyjdzie dziś, za rok, czy nigdy. Rok „0202"
w kosztach cyklicznych był brzydki; tutaj znaczy „nigdy nie zadzwoni".
Traktuj każde pole daty i każdą regułę powtarzania z tą podejrzliwością,
którą przy Kosztach rezerwowałeś dla `vat_odliczenie_procent`.

**Drugi wyróżnik: przypomnienie ma termin OPCJONALNY** (pamięć
`modul-przypomnienia` — to właśnie odróżnia je od wydarzenia w kalendarzu).
Czyli „bez terminu" jest tu POPRAWNYM stanem, nie brakiem danych — i pytanie
brzmi, czy panel wszędzie to rozumie, czy gdzieś traktuje `null` jak „dziś"
albo jak „przeterminowane".

---

## Punkt startu — zmierzone przy pisaniu tego promptu

- **9 uchwytów HTTP w 4 plikach** (`app/api/reminders`, liczone po
  `export async function`). Mało jak na moduł — sonda zajmie kwadrans.
- **Autoryzacja: 9/9 uchwytów ma REALNĄ bramkę** `if (!(await isAuthed()))` —
  sprawdzone blok po bloku przy pisaniu tego promptu. Sondę 401 puść mimo to
  (kwadrans, i jest dowodem zamiast założenia), ale **nie licz na znalezienie
  tu dziury**.

  Historia warta zapamiętania: pierwszy pomiar pokazał trafienia `isAuthed`
  tylko w jednym z czterech plików i wyglądał na sześć otwartych tras. Powód
  był po stronie NARZĘDZIA, nie kodu — `grep -rc app/api/reminders/*/route.ts`
  w zsh z `noglob` nie rozwinął ścieżek z `[id]` w nazwie i po cichu policzył
  jeden plik. **Ścieżki App Routera zawierają nawiasy kwadratowe, czyli znaki
  globa — pomiar, który ich nie obejmie, kłamie w stronę paniki.**
- **Wiersz w `59-spojnosc-ui.md`: 2 ❌ (Klawiatura, Stany), 4 ⚠️
  (Klikalność, Gesty/menu, Nawigacja, Integralność).** **Inwentarz mylił się
  PIĘĆ razy z rzędu** — przy Poczcie „Klawiatura ⚠️" była nieaktualna od
  paczki C, a „Stany ⚠️" obowiązywały i kryły kłamiący pusty stan. Zmierz oba
  ❌ zanim cokolwiek napiszesz; ale nie zakładaj z góry, że są nieaktualne.
- Paczki C, E, F i G Modułu 59 dotknęły Przypomnień (skróty, pole szukania,
  czwarty wariant pustego stanu, przycisk „+"). Część ❌/⚠️ może już nie żyć.

---

## Cztery konkrety warte sondy

**1. Data, która uruchamia.** `isPlausibleDateString()` / `isPlausibleTimestamp()`
mają być po stronie SERWERA, nie tylko w polu. Sprawdź `PATCH /api/reminders/:id`
i `POST`: rok „0202", data w przeszłości, termin za 200 lat, `null` wpisane
jawnie. **I osobno: co robi termin `null`** — czy przypomnienie bez terminu
wpada gdzieś w „po terminie"?

**2. Powtarzanie.** Moduł dzieli słownik RRULE z kalendarzem (pamięć
`powtarzanie-wydarzen-przypomnien`): wystąpienia liczy się **od startu**, nie
od poprzedniego wystąpienia — inaczej „co miesiąc od 31." dryfuje. Sprawdź,
czy reguła powtarzania da się zapisać w stanie sprzecznym (koniec przed
początkiem, interwał 0, interwał ujemny) i co wtedy robi generator.

**3. Podzadania i listy.** `lists/[id]` ma `PATCH` i `DELETE`. Co się dzieje
z przypomnieniami skasowanej listy — kaskada, osierocenie, czy 500? Pamięć
`audyt-2-rodo`: **brak klucza obcego znaczy, że kaskada nie sprząta**.

**4. Powiadomienia to działanie NA ZEWNĄTRZ.** Jeśli przypomnienie wysyła
cokolwiek (mail, push do apki), obowiązuje lekcja z Poczty: **idempotencja
należy do serwera**. Sprawdź, czy dwa przebiegi automatu w tej samej minucie
nie wyślą dwóch powiadomień. Jeśli nic nie wysyła — zapisz to, bo połowa
podejrzeń o „automat" dotyczy rzeczy, które są tylko kolorem na liście.

---

## Zakres

### A. Integralność — sonda `curl` PER UCHWYT HTTP

```bash
DEV_ADMIN_BYPASS=0 npx next dev -p 3111   # sonda 401 — 9 uchwytów
npx next dev -p 3111                       # sonda biznesowa
```

Sonda biznesowa: śmieć w każde pole daty, sprzeczna reguła powtarzania,
podzadanie bez rodzica, kasowanie listy z przypomnieniami w środku, dwa
równoległe `PATCH` na tym samym rekordzie.

### B. Dwa ❌ i cztery ⚠️ z inwentarza

Zmierz każde osobno. `getComputedStyle` na klonie + wzór WCAG dla koloru,
realny klik dla klikalności, `useSkrotyListy` dla klawiatury, `StanListy`
dla stanów. Wynik — także „było nieaktualne" — wpisz do tabeli w `59-…`.

### C. Cała lista kontrolna, trzy platformy

Parytet z apką: dowodem luki jest trasa panelu, której `APIClient` nie woła
(pamięć `apka-luki-wobec-panelu`). Przypomnienia mają w apce własny ekran
i Wyspę — sprawdź, czy termin liczy się tam kalendarzowo, a nie po UTC
(pamięć `audyt-6-kod`: `isOverdue` liczyło `floor` po UTC, apka kalendarzowo).

### D. Ruch i haptyka

Panel: `lib/motion.ts`. Apka: `Ruch.swift`, haptyka przy GARDŁACH — w tym
module gardłem jest **odhaczenie**, nie otwarcie.

---

## Świadome decyzje — NIE cofaj bez pytania

- **Termin jest OPCJONALNY** — to różnica wobec wydarzenia w kalendarzu,
  decyzja właściciela z 2026-07-22.
- **Zero AI w kolejkowaniu i podpowiadaniu terminów** — wyłącznie
  deterministyczne reguły. Trzy istniejące punkty AI (szkic odpowiedzi,
  podsumowanie wątku, szkic notatki) to komplet; nowy wymaga wyraźnej prośby.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Czego NIE ruszać

- `PO_REJESTRACJI.md`, przeprowadzka na NAS (Moduł 55).
- **Sufit liczby odbiorców w Poczcie** — zmierzone w Module 65 (500 adresów
  w jednym „Do" przechodzi bez ostrzeżenia), świadomie zostawione właścicielowi
  do rozstrzygnięcia. Nie jest to zadanie tego modułu.

---

## Co zastajesz po Poczcie (Moduł 65)

- **`lib/mailGuard.ts`** — wzorzec idempotencji NA SERWERZE (odcisk treści +
  okno czasowe + `ON CONFLICT DO NOTHING`). Przenosi się wprost na każdą akcję,
  której skutek wychodzi poza bazę.
- **Trzy stany zamiast dwóch** (`downloadAttachmentPart`: `jest` / `nie-ma` /
  `nie-wiem`) — wzorzec „nie wiem" ma własną nazwę i własny komunikat.
- **`StanListy` jest teraz w KAŻDYM module panelu.** Poczta była ostatnim bez
  niego. Zakaz `opacity-60` na tekście pustego stanu (zmierzone 2,84:1).
- **`lib/instrukcje.ts` ma dziesiąty moduł (Poczta).** Zmiana gestu, skrótu
  albo miejsca kontrolki = poprawka tam, w tym samym commicie.
- **`npm test`: 178 przypadków**; `test/poczta.test.ts` jako najświeższy wzór
  (czysta funkcja, bez bazy, jeden test na jedną rzecz zmierzoną sondą).

**Punkt startu:** sprawdź `git log` w obu repozytoriach i upewnij się, że
wierzchołkiem jest commit Modułu 65 — jeśli nie, ktoś pracował po drodze.

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md`,
- `docs/plany-modulow/59-spojnosc-ui.md` (lista kontrolna, wiersz
  „Przypomnienia"),
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → „Stan po module Poczta",
- `HUB_SETUP.md` → „Moduł 65 — Poczta" i „Moduł Przypomnień".

---

## Weryfikacja — pułapki, na których traci się czas

- **Podgląd przeglądarki ma zamrożony `requestAnimationFrame`** (karta
  „hidden"): każde przenikanie `ViewSwitch`/`AnimatePresence` zostaje w połowie
  i ekran **wygląda na zepsuty przy poprawnym kodzie**. Rozstrzyga pomiar
  `document.visibilityState`, nie zrzut. Obejście: ustaw stan startowy
  (`localStorage`) i przeładuj, żeby oglądać RENDER POCZĄTKOWY.
- **Klikając z poziomu JS, wyklucz `nav`** — `querySelectorAll('button')`
  trafia najpierw w link paska bocznego i przenosi Cię na inny ekran.
- **PGlite kasuje się przy każdym przeładowaniu modułów serwera** — twórz dane
  testowe i mierz je w jednym ciągu.
- **`tsc` nie sprawdza SQL-a.** Nowa tabela albo nowe zapytanie wymaga
  URUCHOMIENIA (np. skryptem przez `npx tsx` na dev-bazie), bo żaden test tego
  nie dotknie.
- **Next 16 nie uruchomi drugiego serwera dev dla tego samego katalogu** —
  sprawdź `lsof -iTCP -sTCP:LISTEN -P | grep 3000` przed startem.
- Apka w symulatorze na lokalnym panelu: **backend `lokalny` to port 3000**,
  więc uruchom dev właśnie tam. `simctl launch` na już działającej apce NIE
  poda jej zmiennych środowiskowych — najpierw `simctl terminate`.

---

## Na koniec modułu

- Dopisz „Stan po module Przypomnienia" do `51-audyt-uiux-panel-i-apka.md` —
  **łącznie z tym, czego NIE zmieniłeś i dlaczego**.
- Wypełnij wiersz „Przypomnienia" w `59-spojnosc-ui.md`.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Następny moduł: **Notatnik** (`PROMPT-64-NOTATNIK.md`, gotowy).
- `rm -f .git/index.lock && git add -A && git commit && git push`.
