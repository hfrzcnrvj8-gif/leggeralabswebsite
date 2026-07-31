# Prompt do wklejenia w nowym czacie — KATALOG (i Koszty w tle)

> Powstał 2026-07-31, po domknięciu Faktur (Moduł 61).

---

## ZACZNIJ OD TEGO — jak czytać inwentarz po dwóch modułach z rzędu

Tabela w `59-spojnosc-ui.md` **pomyliła się przy Fakturach w OBIE strony** i to
jest najważniejsza rzecz, którą wnosisz do tego modułu:

- **Dwa z trzech ❌ były nieaktualne**, zanim ktokolwiek je tknął — paczki A–G
  objęły wszystkie moduły naraz i nikt tabeli nie zaktualizował.
- **Realną pracą okazało się coś, czego w tabeli nie było wcale**: jeden `PATCH`
  ze złym kodem waluty wywalał **całą listę faktur** w error boundary. To nie
  mieści się w żadnej z dziesięciu kategorii, bo nie jest usterką UI.

Wniosek na ten moduł: **licz ❌ dopiero po pomiarze, a sondę puść nawet tam,
gdzie tabela pokazuje ✅.** Katalog ma w inwentarzu cztery ❌ (Klikalność,
Gesty/menu, Klawiatura, Stany) i dwa ⚠️ (Nawigacja, Integralność) — ale ta
liczba nic nie znaczy, dopóki jej nie sprawdzisz.

### Trzy konkrety z rekonesansu, sprawdzone gretem przy pisaniu tego promptu

**1. Bramka waluty NIE dotyczy Katalogu — i to jest podejrzane.**
Katalog nie ma kolumny `waluta` w ogóle (`cena_netto`, `cena_min`, `cena_max`,
`koszt_zakupu` — wszystko gołe liczby), a UI woła `formatMoney(c.cena_netto)`
bez drugiego argumentu, czyli twardo w złotówkach. Dla jednoosobowej firmy
fakturującej w PLN to może być poprawna, świadoma decyzja — ale **nigdzie nie
jest zapisana**, a Oferty, Umowy i Faktury walutę mają. Pozycja z katalogu
wstawiona do oferty w EUR weźmie cenę PLN jako liczbę EUR. **Sprawdź to
sondą i zapytaj właściciela, zanim cokolwiek dodasz** — dołożenie waluty do
katalogu to zmiana danych, nie kosmetyka.

**2. `zeSlownika()` istnieje od Modułu 61 i Katalog go nie używa.**
`lib/invoices.ts` ma teraz wspólnego strażnika pól ze słownikiem: przycina
wsad, sprawdza słownik, `null` → 400. Powstał, bo cztery pola Faktur cicho
podmieniały śmieć na wartość domyślną i odpowiadały `{"ok":true}`. **Sprawdź
per uchwyt HTTP, czy trasy Katalogu i Kosztów nie robią tego samego** — to
dokładnie ta rodzina błędu, która nie zapala żadnej lampki.

**3. Kolor: Katalog ma ✅, ale to ✅ znaczy „nie ma czego psuć".**
Katalog nie ma statusu ani cyklu życia, więc skala stanu go nie dotyczy. Za to
`CatalogDashboard.tsx` maluje marżę — sprawdź, **czy marża ujemna mówi
czerwienią to samo, co strata w rentowności projektu** (`Znaczenie.blad` /
`text-brand-red-soft`), czy własnym odcieniem. Po Fakturach wiadomo, że drugie
źródło koloru wraca; w Projektach wróciło DWA razy.

---

## Co zastajesz po Fakturach (Moduł 61)

- **`zeSlownika()`** (`lib/invoices.ts`) — wspólny strażnik pola ze słownikiem.
  Dokładając pole z zamkniętą listą wartości, użyj go i zwróć 400.
- **`formatMoney` nie wywraca się na złym kodzie waluty** — pokazuje liczbę
  i kod dosłownie. Bramki zapisu (`isInvoiceCurrency` i bliźniaki) stoją na
  czterech trasach; Oferty miały swoją od dawna.
- **`PILNOSC_CLASS`** — piąta forma słownika koloru (`lib/kolorStanu.ts`).
  **Dokładając kolor w nowym kształcie, dołóż FORMĘ do słownika**, nie wartość
  na miejscu; brakująca forma to zaproszenie do rozjazdu.
- **KSeF stracił kolor** na obu platformach — trzy osie na jednej karcie mogą
  mówić kolorem najwyżej dwiema. Rodzaj rzeczy nie dostaje koloru na ekranie
  modułu (pigułki „Proforma"/„Rozliczenie zaliczki" zneutralizowane).
- **`lib/instrukcje.ts` ma siódmy moduł (Faktury).** Zmiana gestu, skrótu albo
  miejsca kontrolki = poprawka tam, w tym samym commicie.
- Profil projektu ma sekcję „Dokumenty" **także w apce**.

- **Statystyki mają kafel „Zaległości (kwota)"** i `StatCard` z opcjonalnym
  `valueClass`. Domyślnie zostaje `text-liquid` (gradient marki = tożsamość bez
  znaczenia) — kolor niosący ZNACZENIE dostaje tylko kafel, na którym „jak
  bardzo" jest osobnym pytaniem. Nie rozlewaj tego na pozostałe kafle.
- **`odmienPl()`** (`lib/dates.ts`) — polska odmiana ma TRZY formy, z wyjątkiem
  12–14. Dwa kafle Statystyk pisały „3 faktur". Dokładając liczbę z rzeczownikiem,
  użyj go.

**Zanim ruszysz kod:** sprawdź `git log`, czy zmiany z 31.07 są w repo (sesje
audytowe kończą się poleceniem dla właściciela, nie commitem Claude'a).

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md` — zasady projektu, w tym design system.
- `docs/plany-modulow/59-spojnosc-ui.md` — lista kontrolna z 10 kategorii do
  POWIELENIA. Wypełnij wiersze „Katalog" i (jeśli zdążysz) „Koszty".
- `HUB_SETUP.md` → wpisy „Moduł 59", „Moduł 60, sesja 2" i **„Audyt Faktur
  (Moduł 61)"**.
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → „Stan po module Faktury".

---

## Dlaczego ten moduł jest inny niż poprzednie

Katalog **nie jest etapem lejka** — to magazyn części, z których składa się
oferty i faktury. Nie ma statusu, cyklu życia ani klienta. Za to jest
JEDYNYM miejscem, w którym mieszka koszt zakupu, czyli druga połowa każdej
marży w produkcie.

Ryzyko jest więc odwrotne niż przy Fakturach: nie „błąd w liczbie nie wygląda
na błąd", tylko **„zmiana tutaj cicho przestawia liczby w trzech innych
modułach"**. Zmiana ceny w katalogu nie może ruszyć dokumentów już wystawionych
— sprawdź sondą, czy nie rusza (pozycja oferty/faktury powinna być MIGAWKĄ, jak
dane nabywcy; patrz `blokada-dokumentow-i-migawka` w pamięci).

## Zakres

### A. Integralność — sonda `curl` PER UCHWYT HTTP

Nie przegląd kodu. Sonda autoryzacji wymaga wyłączenia dev-bypassu:

```bash
DEV_ADMIN_BYPASS=0 npx next dev -p 3111   # sonda 401
npx next dev -p 3111                       # sonda biznesowa
```

**Licz UCHWYTY, nie pliki, i nie ufaj grepowi w żadną stronę.** Przy Fakturach
dwa uchwyty nie miały `isAuthed()` we własnej linii (delegowały do funkcji,
która sprawdza pierwszą instrukcją) — czytanie kodu dałoby fałszywy alarm.
Przy Ofertach było odwrotnie: liczenie plików przegapiło uchwyty.

Poza `isAuthed()`: walidacja słowników przez `zeSlownika`, liczby ujemne
i absurdalne (cena, koszt, widełki `cena_min > cena_max`), **migawka pozycji
w dokumentach**, kaskada przy usuwaniu pozycji używanej w ofertach.

### B. Cztery ❌ i dwa ⚠️ z inwentarza

| kategoria | co znaczy ❌/⚠️ |
|---|---|
| **Klikalność** ❌ | nazwa pozycji nie prowadzi nigdzie? (podstrona `/admin/catalog/<id>` ISTNIEJE od paczki E — **zweryfikuj, czy to ❌ jeszcze obowiązuje**) |
| **Gesty/menu** ❌ | brak menu kontekstowego i gestów; apka ma CRUD katalogu (Moduł 47) |
| **Klawiatura** ❌ | paczka C dała Katalogowi pole szukania + ⌘F + ⌘N w APCE — sprawdź PANEL |
| **Stany** ❌ | „Wczytuję…" bez końca zamiast `StanBledu` — paczka E miała to objąć, **zmierz** |
| **Nawigacja** ⚠️, **Integralność** ⚠️ | patrz sonda wyżej |

Rozstrzygaj **pomiarem**: `getComputedStyle` na klonie + wzór WCAG.

### C. Cała lista kontrolna, trzy platformy

Szczególnie: **kwota i waluta** (patrz rekonesans #1), widełki cenowe
i marża jako liczby, które muszą mieć sens także puste (`—`, nie znikające
pole), oraz parytet z apką — Katalog ma tam pełny CRUD od Modułu 47, więc
rozjazd jest tu bardziej prawdopodobny niż gdzie indziej.

### D. Ruch i haptyka

Panel: `lib/motion.ts` (`SPRING`, `EASE_LIQUID`), żadnych liczb z palca,
żadnego `transition` bez `ease`. Apka: `Ruch.swift`, haptyka przy GARDŁACH.

---

## Świadome decyzje — NIE cofaj bez pytania

- **Koszt zakupu żyje TYLKO w katalogu** (Moduł 47) — nie kopiuj go do pozycji
  dokumentu.
- **Eksporty świadomie BEZ sufitu** — obcięty plik kłamie gorzej niż wolny.
- **Panel nie ma generowania PDF** — wydruk przeglądarki i publiczny link.
- **Poziom apki**: Katalog ma pełny CRUD świadomie (to jedyny moduł, w którym
  „dodaj z telefonu" ma sens — pozycję wymyśla się w drodze). Nie zawężaj.

## Czego NIE ruszać

- `PO_REJESTRACJI.md` — firma nie jest zarejestrowana.
- Przeprowadzka na NAS (Moduł 55) — czeka na rejestrację.
- Reguła „model tylko proponuje" — nowy punkt użycia lokalnego LLM wymaga
  wyraźnej prośby właściciela.

---

## Weryfikacja — działające procedury

**Panel lokalnie** (PGlite + dev-login): `npm run dev`, potem narzędzia
przeglądarki. Pułapki, na których traci się czas:

- **Zabity serwer dev z poprzedniej sesji** blokuje port — Next 16 odmawia
  drugiego serwera dla tego samego katalogu i mówi, który PID zabić.
- **Konsola przeglądarki oddaje HISTORIĘ, nie stan bieżący** — błąd kompilacji
  sprzed poprawki wygląda tam identycznie jak żywy. Rozstrzyga `get_page_text`
  albo `read_page`, nie kolejny odczyt konsoli.
- Karta jest `document.hidden`, więc `requestAnimationFrame` **nie tyka**;
  `AnimatePresence mode="wait"` nigdy nie kończy wyjścia. Obejście: ustaw widok
  w `localStorage` i przeładuj. Artefakt narzędzia, **nie usterka**.
- `getComputedStyle` na elemencie z `transition` zwraca wartość POCZĄTKOWĄ —
  rozstrzyga klon (`cloneNode`).
- `npx tsc --noEmit` **nie widzi CSS-a, SQL-a ani JSX-a, który odrzuci
  Turbopack**. Po każdej paczce **załaduj dotknięty ekran**.

**Apka w symulatorze na LOKALNYM panelu:**

```bash
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'content-type: application/json' \
  -d '{"password":"<z .env.local>","device":"Symulator"}'   # ciało MUSI mieć `device`

SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny \
SIMCTL_CHILD_LEGGERA_DEV_TOKEN=<token> \
SIMCTL_CHILD_LEGGERA_DEV_TAB=katalog \
SIMCTL_CHILD_LEGGERA_DEV_ZGODA_CICHA=1 \
  xcrun simctl launch <udid> pl.leggeralabs.hub
```

`Skrypty/stempel-wersji.sh` **przed** `xcodebuild`. Uwaga: **przestrzeń dotyku
symulatora ≠ piksele zrzutu** (iPhone 17 Pro: zrzut 919 px ↔ 402 pt, skala
2,29) — nieudany `tap` to najczęściej zła skala, nie zepsuty przycisk.
`SIMCTL_CHILD_LEGGERA_DEV_TAB` działa tylko dla zakładek głównej belki; moduły
spod „Więcej" trzeba doklikać.

---

## Lekcje warte sprawdzenia akurat u Katalogu

0. **Inwentarz myli się w OBIE strony.** Zmierz, zanim naprawisz — i puść sondę
   także tam, gdzie tabela pokazuje ✅.
1. **Jedna zła wartość w bazie może wywalić CAŁY ekran, nie wiersz.** Formatery
   (`Intl`) rzucają, a nie zwracają błąd. Sprawdź, co się stanie, gdy pole
   liczbowe katalogu dostanie `null` albo tekst.
2. **Bramka zapisu nie naprawia danych, które już są w bazie.** Jeśli dokładasz
   walidację, dołóż też odporność po stronie odczytu — do produkcyjnej bazy nie
   ma dostępu z panelu.
3. **`{"ok":true}` bywa kłamstwem.** Trasa, która podmienia śmieć na wartość
   domyślną, wygląda jak działająca. Test różnicowy: wyślij śmieć, przeczytaj,
   porównaj.
4. **Poprawka idzie przez wszystkie moduły naraz.** Audyt Ofert dodał
   `isOfferCurrency` i zostawił bliźniaczą dziurę w trzech innych modułach na
   miesiąc.
5. **Brakująca forma w słowniku koloru rodzi rozjazd** — kto potrzebuje
   kształtu, którego słownik nie ma, wpisze kolor z palca.
6. **Komentarz SQL `--` wewnątrz `sql\`…\`` wycina resztę zapytania** — trasa
   oddaje pustą odpowiedź bez błędu w UI, `tsc` tego nie widzi.
7. **Baza PGlite kasuje się przy restarcie `npm run dev`** — `PATCH` na
   nieistniejący wiersz zwraca **200 i nic nie robi**.
8. **Nowa droga nawigacji obnaża zastane dziury** — przy Fakturach sekcja
   „Dokumenty" w apce wyciągnęła trzy błędy z kodu, którego nie tknęła.

---

## Na koniec modułu

- Dopisz „Stan po module Katalog" do `51-audyt-uiux-panel-i-apka.md`.
- **Wypełnij wiersz „Katalog"** w tabeli wyniku w `59-spojnosc-ui.md`.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Przygotuj prompt do następnego modułu: **Koszty** (1 ❌, 3 ⚠️) albo
  **Kalkulator** (2 ❌).
- `rm -f .git/index.lock && git add -A && git commit && git push`.
