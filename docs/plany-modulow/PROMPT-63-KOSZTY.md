# Prompt do wklejenia w nowym czacie — KOSZTY

> Powstał 2026-08-01, po domknięciu Katalogu (Moduł 62).

---

## ZACZNIJ OD TEGO — inwentarz mylił się TRZY razy z rzędu

Wiersz „Koszty" w `59-spojnosc-ui.md` pokazuje 1 ❌ (Klawiatura) i 3 ⚠️
(Klikalność, Gesty/menu, Nawigacja). **Ta liczba nic nie znaczy, dopóki jej nie
zmierzysz** — przy Projektach, Fakturach i Katalogu powtórzyło się dokładnie to
samo: większość ❌ była nieaktualna (sprzątnęły je paczki A–G, których nikt do
tabeli nie wpisał), a realną pracą okazywało się coś, czego w tabeli nie było
wcale.

Przy Katalogu było to brak WALUTY i cztery ciche podmiany w trasach. Przy
Fakturach — jeden `PATCH` wywalający cały ekran.

**Wniosek: sondę puść nawet tam, gdzie tabela pokazuje ✅.**

### Jedno ❌ jest już rozstrzygnięte — jako NIEAKTUALNE

**Klawiatura** ❌ nie obowiązuje: `CostsDashboard.tsx` ma `useSkrotyListy`,
`PoleSzukania` i `useContextMenu` (6 trafień gretem), a paczka C dała Kosztom
pole szukania po dostawcy, opisie i projekcie + ⌘F/⌘N także w apce (`59-…md`,
wiersz 689). Zweryfikuj to pomiarem w przeglądarce i popraw wiersz.

### Trzy konkrety z rekonesansu, sprawdzone gretem przy pisaniu tego promptu

**1. Koszty mają SZEŚĆ cichych podmian — dokładnie ta rodzina, którą zamknęły
Faktury i Katalog.** Żadna trasa kosztów nie używa `zeSlownika` (0 trafień
w 10 plikach). Zamiast tego, w `app/api/costs/route.ts` i `costs/[id]/route.ts`:

```
kategoria              → "Inne"  gdy śmieć
vat_stawka             → "23"    gdy śmieć
metoda_platnosci       → null    gdy śmieć
vat_odliczenie_procent → 100     gdy śmieć
```

Ostatnia jest **księgowa, nie kosmetyczna**: „100" znaczy „odliczam cały VAT".
Śmieć w tym polu po cichu zamienia się w najbardziej korzystną podatkowo
wartość i odpowiada `{"ok":true}`. **Zacznij od testu różnicowego**: wyślij
śmieć, przeczytaj, porównaj. Wzorzec poprawki gotowy — `czytajPolaKatalogu()`
w `lib/catalog.ts`.

**2. Koszty nie mają waluty — a katalog, oferty i faktury już mają.** Zero
trafień `waluta` w trasach kosztów. Faktura od zagranicznego dostawcy (chmura,
licencje, sprzęt z UE) to najbardziej naturalny koszt tej firmy. Po Module 62
istnieje `lib/waluty.ts` (jeden słownik + `isWaluta`) — dołożenie waluty jest
teraz małą zmianą, ale to ZMIANA DANYCH: zapytaj właściciela, zanim ruszysz
(przy katalogu wybrał kolumnę, nie „ustalmy, że zawsze PLN").
Uwaga: kwoty kosztów wchodzą do KPI i do analityki — sprawdź, czy sumowanie
nie zacznie dodawać euro do złotówek.

**3. Kolor: Koszty mają ✅, ale sprawdź, czy nadal.** `COST_STATUSES` to dwie
wartości i przy Module 59 dostały skalę stanu. Za to Koszty pokazują liczby
(brutto, VAT do odliczenia, sumy miesiąca) — a od Modułu 62 istnieje trzecia
rola czerwieni: `STRATA_TEXT`/`klasaStraty()` w `lib/kolorStanu.ts`,
`Znaczenie.strata` w apce. Sprawdź, czy jest w Kosztach liczba, która oznacza
stratę, i czy mówi to tym samym kolorem — **albo czy świadomie nie mówi nic**.

---

## Co zastajesz po Katalogu (Moduł 62)

- **`lib/waluty.ts`** — JEDEN słownik walut; `INVOICE_CURRENCIES` /
  `OFFER_CURRENCIES` są re-eksportami. Nie wypisuj listy czwarty raz.
- **`czytajPolaKatalogu()`** — wzorzec bramki zapisu: jedna funkcja dla `POST`
  i `PATCH`, słowniki przez `zeSlownika` → 400 z powodem, liczby z sufitem,
  **`PATCH` naprawdę częściowy** (brak klucza → pole zostaje nietknięte).
- **`normalizeCatalogRow()`** — odporność po stronie ODCZYTU, osobno od bramki
  zapisu. Bramka nie naprawia tego, co już siedzi w bazie.
- **`STRATA_TEXT` / `klasaStraty()` / `Znaczenie.strata`** — trzecia rola
  czerwieni (liczba oznaczająca stratę). Wąski zakres celowo.
- **`etykietaVat()`** (`lib/invoices.ts`) — „zw."/„np." zamiast „zw.%".
  Koszty rozpisują ten warunek u siebie z palca — sprawdź.
- **Kasowanie czeka na odpowiedź serwera** przed zniknięciem wiersza z ekranu;
  `DELETE` nieistniejącego rekordu oddaje 404, nie `{"ok":true}`.
- **Apka: `role: .destructive` NIE wystarczy** — każdy swipe kasujący
  potrzebuje jawnego `.tint(.ciemnaCzerwien)`, inaczej rysuje się BIAŁY.
- **`lib/instrukcje.ts` ma ósmy moduł (Katalog).** Zmiana gestu, skrótu albo
  miejsca kontrolki = poprawka tam, w tym samym commicie.

**Zanim ruszysz kod:** sprawdź `git log`, czy zmiany z 01.08 są w repo (sesje
audytowe kończą się poleceniem dla właściciela, nie commitem Claude'a).

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md` — zasady projektu, w tym design system.
- `docs/plany-modulow/59-spojnosc-ui.md` — lista kontrolna z 10 kategorii do
  POWIELENIA. Wypełnij wiersz „Koszty".
- `HUB_SETUP.md` → „Audyt Faktur (Moduł 61)" i **„Audyt Katalogu (Moduł 62)"**.
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → „Stan po module Katalog".

---

## Dlaczego ten moduł jest inny niż poprzednie

Koszty to **jedyny moduł, który patrzy w drugą stronę** — pieniądze wychodzące,
nie wchodzące. Ma przez to rzeczy, których nie ma nigdzie indziej:

- **załączniki** (paragony, faktury zakupowe) i **OCR** — czyli wejście danych,
  którego nie wpisuje człowiek;
- **koszty cykliczne** (`recurring-costs`) — osobna tabela i osobne trasy,
  które łatwo pominąć, licząc uchwyty tylko w `app/api/costs`;
- **import z KSeF** (`costs/import-ksef`);
- **VAT do odliczenia** — pole o konsekwencjach podatkowych.

Ryzyko jest więc księgowe: **zła liczba tutaj nie wygląda na złą**, a wychodzi
dopiero przy rozliczeniu. Traktuj `vat_odliczenie_procent` i `kwota_brutto`
z tą samą podejrzliwością, co kwoty na fakturze.

## Zakres

### A. Integralność — sonda `curl` PER UCHWYT HTTP

```bash
DEV_ADMIN_BYPASS=0 npx next dev -p 3111   # sonda 401
npx next dev -p 3111                       # sonda biznesowa
```

**Licz UCHWYTY, nie pliki.** W `app/api/costs` + `app/api/recurring-costs` jest
**17 uchwytów w 10 plikach** (policzone gretem po `export async function`) (GET/POST listy, GET/PATCH/DELETE pozycji,
załącznik GET/POST/DELETE, OCR, import KSeF, eksport, podpowiedzi, analityka,
cykliczne GET/POST/PATCH/DELETE). Sprawdź każdy osobno.

Poza `isAuthed()`: sześć podmian z rekonesansu #1, liczby ujemne i absurdalne,
`PATCH` częściowy czy zastępujący, kaskada przy usuwaniu kosztu z załącznikiem
(czy plik zostaje sierotą?), oraz co się dzieje, gdy koszt cykliczny wskazuje
na usunięty projekt.

### B. Jedno ❌ i trzy ⚠️ z inwentarza

| kategoria | co znaczy ❌/⚠️ |
|---|---|
| **Klawiatura** ❌ | **prawdopodobnie nieaktualne** — patrz wyżej, zmierz i popraw wiersz |
| **Klikalność** ⚠️ | podstrona `/admin/costs/<id>` istnieje od paczki E — czy wiersz do niej prowadzi? czy projekt przy koszcie jest klikalny? |
| **Gesty/menu** ⚠️ | menu kontekstowe JEST (`CostsDashboard.tsx`) — sprawdź, czy ma komplet akcji i czy apka ma to samo pod przytrzymaniem |
| **Nawigacja** ⚠️ | patrz sonda i pozycja „+" (paczka G objęła Koszty — zweryfikuj pomiarem) |

Rozstrzygaj **pomiarem**: `getComputedStyle` na klonie + wzór WCAG.

### C. Cała lista kontrolna, trzy platformy

Szczególnie: **kwoty i VAT**, załączniki (czy brak pliku mówi to samo, co brak
połączenia?), OCR (czy „model proponuje, właściciel zatwierdza" jest widoczne),
oraz parytet z apką — Koszty mają tam „⌘N = aparat" (nowy koszt na telefonie
znaczy „zrób zdjęcie paragonu"), co jest ŚWIADOMYM odstępstwem od panelu.

### D. Ruch i haptyka

Panel: `lib/motion.ts` (`SPRING`, `EASE_LIQUID`), żadnych liczb z palca.
Apka: `Ruch.swift`, haptyka przy GARDŁACH.

---

## Świadome decyzje — NIE cofaj bez pytania

- **Model tylko PROPONUJE** — OCR paragonu i podpowiedź kategorii (Moduły 8
  i 48) generują treść DO ZATWIERDZENIA. Nie skracaj tej drogi.
- **Eksporty świadomie BEZ sufitu** — obcięty plik kłamie gorzej niż wolny.
- **Załączniki na żądanie z IMAP** (`zalaczniki-na-zadanie-imap`) — w bazie
  metadane, treść dociągana przy kliknięciu. To decyzja kosztowa.
- **Koszt zakupu komponentu żyje TYLKO w katalogu** — nie mieszaj go z modułem
  Kosztów, to dwie różne rzeczy o podobnej nazwie.

## Czego NIE ruszać

- `PO_REJESTRACJI.md` — firma nie jest zarejestrowana.
- Przeprowadzka na NAS (Moduł 55) — czeka na rejestrację.
- Nowy punkt użycia lokalnego LLM wymaga wyraźnej prośby właściciela.

---

## Weryfikacja — działające procedury

**Panel lokalnie** (PGlite + dev-login): `npm run dev`, potem narzędzia
przeglądarki. Pułapki, na których traci się czas:

- **Next 16 nie uruchomi drugiego serwera dev dla tego samego katalogu** —
  sondę 401 na porcie 3111 robi się PO zatrzymaniu tamtego (`preview_stop`),
  nie obok.
- **Baza PGlite kasuje się przy KAŻDYM przeładowaniu modułów serwera** — nie
  tylko przy restarcie. Wiersz sondy dodany pięć minut temu może już nie
  istnieć; to nie jest błąd trasy. Twórz dane testowe i mierz je w jednym
  ciągu.
- **Konsola przeglądarki oddaje HISTORIĘ, nie stan bieżący.** Rozstrzyga
  `get_page_text` albo `read_page`.
- `getComputedStyle` na elemencie z `transition` zwraca wartość POCZĄTKOWĄ —
  rozstrzyga klon (`cloneNode`). Kontrast liczy się po KOMPOZYCJI rgba na
  nieprzezroczystym tle przodka, inaczej wychodzą bzdury (klon doczepiony do
  `body` mierzy tło strony publicznej, nie panelu).
- `npx tsc --noEmit` **nie widzi CSS-a, SQL-a ani JSX-a, który odrzuci
  Turbopack**. Po każdej paczce **załaduj dotknięty ekran**.
- `npm test` — 155 przypadków, w tym `test/katalog.test.ts` jako wzór testu
  bramki zapisu (czysta funkcja, bez bazy).

**Apka w symulatorze na LOKALNYM panelu:**

```bash
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'content-type: application/json' \
  -d '{"password":"<z .env.local>","device":"Symulator"}'   # ciało MUSI mieć `device`

SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny \
SIMCTL_CHILD_LEGGERA_DEV_TOKEN=<token> \
SIMCTL_CHILD_LEGGERA_DEV_ZGODA_CICHA=1 \
  xcrun simctl launch <udid> pl.leggeralabs.hub
```

`Skrypty/stempel-wersji.sh` **przed** `xcodebuild`. Uwaga: **`simctl install`
kasuje zapisany token** — po każdej reinstalacji weź NOWY z `/api/admin/login`
(stary zostaje przypisany do poprzedniego „urządzenia") i podaj go w `launch`,
inaczej apka wita ekranem logowania, a Twoje kliknięcia lecą w hasło.
Przestrzeń dotyku symulatora ≠ piksele zrzutu (iPhone 17 Pro: 919 px ↔ 402 pt).
`SIMCTL_CHILD_LEGGERA_DEV_TAB` działa tylko dla zakładek głównej belki —
Koszty siedzą pod „Więcej" i trzeba je doklikać.

---

## Lekcje warte sprawdzenia akurat u Kosztów

1. **`{"ok":true}` bywa kłamstwem** — sześć znanych miejsc, patrz rekonesans #1.
2. **`PATCH` bywa `PUT`-em w przebraniu.** Katalog po cichu kasował pola,
   których nie przysłano. Objawu nie było, bo wszyscy klienci wysyłali komplet.
   Test: wyślij `PATCH` z JEDNYM polem i przeczytaj resztę.
3. **Bramka zapisu nie naprawia bazy** — dokładając walidację, dołóż odporność
   po stronie odczytu.
4. **Poprawka idzie przez wszystkie moduły naraz.** Jeśli dokładasz walutę do
   kosztów, sprawdź, czy analityka i KPI nie sumują teraz jabłek z gruszkami.
5. **Kolor niesie JEDNO znaczenie na ekran.** Koszt ma status, termin
   płatności i kwotę — to trzy osie, a mówić kolorem mogą najwyżej dwie.
6. **Komentarz SQL `--` wewnątrz `sql\`…\`` wycina resztę zapytania.**
7. **Nowa droga nawigacji obnaża zastane dziury** — jeśli dokładasz wejście do
   kosztu z profilu projektu, sprawdź, skąd ten ekran bierze swój rekord.

---

## Na koniec modułu

- Dopisz „Stan po module Koszty" do `51-audyt-uiux-panel-i-apka.md`.
- **Wypełnij wiersz „Koszty"** w tabeli wyniku w `59-spojnosc-ui.md`.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Przygotuj prompt do następnego modułu: **Kalkulator** (2 ❌) albo
  **Notatnik** / **Przypomnienia** (po kilka ❌/⚠️).
- `rm -f .git/index.lock && git add -A && git commit && git push`.
