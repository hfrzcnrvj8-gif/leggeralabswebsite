# Prompt do wklejenia w nowym czacie — FAKTURY (etapy 11–12 lejka)

> Powstał 2026-07-31, po domknięciu Projektów (Moduł 60, obie sesje).

---

## ZACZNIJ OD TEGO — trzy konkrety z rekonesansu (2026-07-31)

Sprawdzone gretem i sondą przy pisaniu tego promptu, nie założone. **Pierwszy
jest najważniejszą rzeczą w całym module i nie jest usterką UI.**

### 1. ✅ Rabat w sumach — ZROBIONE 2026-07-31, nie rób drugi raz

Znalezione przy pisaniu tego promptu i **naprawione od razu** (decyzja
właściciela): `SUM(ilosc * cena_netto)` bez `(1 - rabat_procent / 100)`
w czterech plikach, pięciu miejscach — Pulpit (netto+VAT+brutto), Statystyki,
poranny mail i ścieżka dokumentów ×3. Po poprawce **zero wystąpień** tej sumy
bez rabatu w całym repo (`grep -rn "ilosc \* cena_netto" app lib | grep -v rabat_procent`).

Dowody na żywo, do powtórzenia, gdyby coś tu wróciło:

| trasa | jak zmierzone | wynik |
|---|---|---|
| `hub/today` (Pulpit) | `revenueThisMonth` przy rabacie 50 % vs 0 % | **19 065 vs 19 680** — różnica dokładnie 615 zł |
| `sciezka` ×3 | kwota węzła faktury | **500 vs 1000** |
| `leads/notify` | treść wezwania w logu serwera | **1230,00 zł** (2 × 615), bez rabatu byłoby 2460 |
| `stats` | brak różnicy — patrz niżej | ⚠️ |

**Znalezisko poboczne, ZOSTAWIONE:** w `app/api/stats/route.ts` kolumna
`brutto` jest liczona w zapytaniu i **nigdzie nieużywana** (`grep "\.brutto"`
= jedno trafienie, sama definicja). Poprawka rabatu jest tam poprawna, ale bez
efektu, bo pole jest martwe. Nie usuwałem go przy okazji — usunięcie martwej
kolumny to zmiana w module Statystyk i należy do jego audytu. **Sprawdź, czy
`stats` nie miało pokazywać przychodu, którego nie pokazuje.**

Metoda, która to wykryła i którą warto powtórzyć na innych sumach:
**test różnicowy** — ustaw rabat 50 %, zmierz, ustaw 0 %, zmierz, porównaj
całe odpowiedzi JSON. Zero różnic znaczy albo „rabat nie wchodzi", albo
„to pole nikogo nie obchodzi"; jedno i drugie warto wiedzieć.

Pułapki, na których straciłem czas — omiń je:
- `POST /api/invoices/:id/items` **nie przyjmuje `rabat_procent`** (zapisuje 0),
  rabat ustawia się dopiero `PATCH`-em.
- Faktura bez `data_wystawienia` **nie wchodzi do KPI Pulpitu** w ogóle, więc
  test różnicowy pokazuje 0 różnic z zupełnie innego powodu.
- Przypomnienie o zaległej fakturze wymaga `klient_email != ''` — bez tego
  `invoiceReminders: 0` i nie ma czego czytać w logu.
- **Baza PGlite kasuje się przy restarcie serwera** — w środku tej sondy
  straciłem komplet identyfikatorów i wyglądało to jak zepsuta trasa.

### 2. Inwentarz KŁAMIE na Fakturach — dwa ❌ są już nieaktualne

Tabela w `59-spojnosc-ui.md` jest z 28.07 i **poza wierszem „Projekty" nikt jej
nie aktualizował**, a paczki A–G objęły wszystkie moduły naraz:

| kategoria | inwentarz | jak jest naprawdę |
|---|---|---|
| **Kolor** | ❌ | Faktury są **już na wspólnej skali** — `INVOICE_STAN` + `mapaStanow` (`lib/invoices.ts:114`). „Po terminie" świadomie przestało być czerwone (to `mojRuch`, a pilność liczy się z DATY). Sprawdź, czy nie ma DRUGIEJ formy tego samego statusu — dokładnie tak wróciły Projekty |
| **Integralność** | ❌ | `isInvoiceStatus` **jest** i stoi w `PATCH` (`app/api/invoices/[id]/route.ts:148`). Sprawdź, czy przycina wsad **przed** sprawdzeniem słownika — w Projektach jedna spacja omijała twardą bramkę |

**Nie zaczynaj od naprawiania tych dwóch. Zacznij od zmierzenia, co jest.**
Inwentarz jest hipotezą, nie wynikiem.

### 3. KSeF to druga oś koloru i dzieli barwy ze statusem płatności

`KSEF_STATUS_CLASS` (`lib/ksef.ts:41`) jest wpisany **z palca, poza skalą**:
`przyjeto` bierze `emerald` — tę samą zieleń, co status **„Opłacona"**,
a `odrzucono` czerwień `red-500` (generyczną, nie z palety marki). Obie pigułki
stoją na jednym wierszu listy faktur. To ta sama kolizja, którą Projekty
rozwiązały przy zdrowiu i priorytecie: **trzy osie na jednej karcie mogą mówić
kolorem najwyżej dwiema** (`HUB_SETUP.md` → „Moduł 60, sesja 2"). Faktura
niesie status płatności, status KSeF i termin.

---

## Co zastajesz po Projektach (Moduł 60, sesja 2 — 2026-07-31)

- **Słownik koloru ma cztery formy zamiast czterech map**: `mapaStanow`,
  `mapaKropek`, `mapaTekstow`, `mapaHexow` w `lib/kolorStanu.ts` (+ `STAN_TEXT`,
  `STAN_HEX`, `PILNOSC_HEX`), w apce `Stan.kolorSamodzielny`. **Dokładając
  jakąkolwiek formę koloru, wyliczaj ją — nie przepisuj ręcznie.**
- **`lib/instrukcje.ts` ma szósty moduł (Projekty)** i poprawione kierunki
  gestów w czterech pozostałych — paczka G zmieniła kod i nie tknęła tekstu.
  **Zmiana gestu, skrótu albo miejsca kontrolki = poprawka tam, w tym samym
  commicie.**
- Profil projektu ma sekcję „Dokumenty" z kwotą brutto liczoną **z rabatem** —
  wzorzec do powielenia, gdy będziesz pokazywał kwoty gdziekolwiek indziej.
- Zakładki profilu wzięły słownictwo apki (Wdrożenie / Opinia klienta /
  Dziennik).

**Dwa pytania z tamtej sesji, na które właściciel jeszcze nie odpowiedział** —
zapytaj, jeśli dotkniesz tych miejsc:

1. Czerwień na przycisku **„stop" stopera** — zostawiona świadomie jako
   ikonografia nagrywania, nie stan rekordu. Ma iść za słownikiem czy zostać?
2. Sekcja **„Dokumenty" w apce** — panel ma ją od sesji 1, apka nie. Podgląd
   umowy i faktur mieści się w poziomie 1, ale to nowa sekcja.

**Zanim ruszysz kod:** sprawdź `git log`, czy zmiany z 31.07 są w repo (obie
sesje Projektów kończyły się poleceniem dla właściciela, nie commitem Claude'a).
Jeśli w apce zobaczysz „Stempel wskazuje rewizję X, a repozytorium stoi na Y" —
uruchom `Skrypty/stempel-wersji.sh` i buduj ponownie.

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin, repo
bieżące) oraz apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`). **Pulpit, Leady, Klienci,
Oferty, Umowy i Projekty są zrobione.** Faktury to etapy 11–12: wystawienie
i pilnowanie płatności.

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md` — zasady projektu, w tym design system.
- `docs/plany-modulow/59-spojnosc-ui.md` — **lista kontrolna z 10 kategorii do
  POWIELENIA.** To narzędzie audytu, nie zamknięte zadanie. Wypełnij wiersz
  „Faktury" w tabeli na dole.
- `HUB_SETUP.md` → wpisy „Moduł 59" i **„Moduł 60, sesja 2"** (cztery formy
  jednego słownika koloru, trzy osie na jednej karcie, kafel gestu, pułapki
  układu, instrukcja się rozjeżdża).
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` — sekcje „Stan po module…".

---

## Dlaczego akurat ten moduł jest ryzykowny

Nie dlatego, że ma najgorszy wiersz w inwentarzu — ma, ale dwa z trzech ❌ są
już nieaktualne (rekonesans #2), więc ta liczba nic nie znaczy.

Ryzykowny jest dlatego, że **jako jedyny moduł dotyka pieniędzy i urzędu**:
KSeF, korekty, zaliczki, waluty, odsetki, wezwania. **Błąd w liczbie nie
wygląda tu na błąd** — rabat gubiony w pięciu trasach (#1) nie zapalił ani
jednej lampki przez cały czas swojego istnienia, a siedział na Pulpicie.
Wszystkie dotychczasowe audyty znajdowały takie rzeczy **sondą, nie
czytaniem** — i tu będzie tak samo.

## Zakres

### A. Integralność — sonda `curl` PER UCHWYT HTTP

Nie przegląd kodu. Metoda, która działa (opisana w `HUB_SETUP.md` → „Audyt
Modułu 60 — sesja 1"): **sonda autoryzacji wymaga wyłączenia dev-bypassu**,
inaczej `curl` dostaje 200 wszędzie i nie dowodzi niczego.

```bash
DEV_ADMIN_BYPASS=0 npx next dev -p 3111   # sonda 401
npx next dev -p 3111                       # sonda biznesowa
```

Co sprawdzić poza `isAuthed()`: walidacja słowników statusu i typu dokumentu
**z `trim()` przed sprawdzeniem** (przy Projektach jedna spacja omijała twardą
bramkę — patrz sesja 1), hamulce na trasach publicznych, blokada dokumentu po
wysyłce i **droga wyjścia z blokady** (korekta), idempotencja z widocznym
śladem.

**Suma pozycji zawsze z rabatem** — sprawdzone i naprawione 31.07 (#1), ale
reguła zostaje: KAŻDE nowe miejsce, które sumuje pozycje, musi mieć
`(1 - rabat_procent / 100)`. `tsc` tego nie złapie, UI nie pokaże błędu,
a liczba będzie wyglądała wiarygodnie.

### B. Trzy pola ❌ i dwa ⚠️ z inwentarza

| kategoria | co znaczy ❌/⚠️ |
|---|---|
| **Kolor** ❌ → sprawdź | statusy są JUŻ na skali (patrz rekonesans #2); otwarte zostaje **KSeF jako druga oś** (#3) i pytanie, czy nie ma drugiej formy tego samego statusu |
| **Treść** ❌ | dokument nazywany NUMEREM, nie słowem; kwoty zawsze z walutą dokumentu; daty przez `formatPlDate`; `—` zamiast znikającego pola. **Tu spodziewaj się realnej pracy** — to jedyne ❌, którego nie tknęła żadna paczka |
| **Integralność** ❌ → sprawdź | walidacja statusu JEST (#2); otwarte: `trim()` przed słownikiem, hamulce tras publicznych, droga wyjścia z blokady, **rabat w sumach (#1)** |
| **Klawiatura** ❌, **Nawigacja** ⚠️, **Stany** ⚠️, **Gesty** ⚠️ | paczki C, E i G dały Fakturom sporo bez osobnego audytu — **zweryfikuj, że działa, i idź dalej**, nie rób drugi raz |

Rozstrzygaj **pomiarem**: `getComputedStyle` + wzór WCAG, progi w `HUB_SETUP.md`
→ „trzy warstwy powierzchni".

### C. Cała lista kontrolna, trzy platformy

Szczególnie w tym module:
- **Kwota i waluta** w każdym miejscu, gdzie liczba jest widoczna — lista,
  profil, apka, eksport, wezwanie. Panel nie przelicza kursów i mówi o tym.
- **Numer dokumentu** — `OF-NaN` na Safari było prawdziwą usterką w Ofertach.
- **Powiązania klikalne**: klient, projekt, oferta, umowa, korekta ↔ oryginał.
- **Gesty**: po paczce G faktura ma „Przypomnij" i „Oznacz opłaconą" po prawej,
  rozdzielone (wcześniej `if/else` chował jedno pod drugim). Sprawdź palcem
  w symulatorze, nie tylko w kodzie — **sąsiedztwo tworzy usterki, których nie
  widać w kodzie**.

### D. Ruch i haptyka

Panel: `lib/motion.ts` (`SPRING`, `EASE_LIQUID`), żadnych liczb z palca,
żadnego `transition` bez `ease`. Apka: `Ruch.swift`, haptyka przy GARDŁACH
(wystawienie, wysyłka, oznaczenie opłaty), nie przy każdym dotknięciu.

---

## Świadome decyzje — NIE cofaj bez pytania

- **Panel nie ma generowania PDF** — jest wydruk przeglądarki i publiczny link.
- **Dokument do druku: nic, co niesie TREŚĆ, nie może stać na TLE** — gradienty
  przez `PasekMarkiDokumentu`/`KwotaGradientem` (`DocGradient.tsx`), pasek
  ekranowy oznaczony `data-chrome="ekran"`. Nowy wydruk = te komponenty.
- **KSeF stoi na środowisku TESTOWYM** do rejestracji firmy (`PO_REJESTRACJI.md`).
- **Eksporty świadomie BEZ sufitu** — obcięty plik kłamie gorzej niż wolny.
- **Poziom apki**: podgląd, wysyłka, oznaczenie opłaty tak; zakładanie faktury
  i edycja pozycji to biurko. Zapytaj, zanim dołożysz.

## Czego NIE ruszać

- `PO_REJESTRACJI.md` — firma nie jest zarejestrowana.
- Przeprowadzka na NAS (Moduł 55) — czeka na rejestrację.
- Reguła „model tylko proponuje" — nowy punkt użycia lokalnego LLM wymaga
  wyraźnej prośby właściciela.

---

## Weryfikacja — działające procedury

**Panel lokalnie** (PGlite + dev-login, bez hasła i bez deploya):
`npm run dev`, potem narzędzia przeglądarki. Dwie pułapki podglądu:
- karta jest `document.hidden`, więc `requestAnimationFrame` **nie tyka**
  (zmierzone: 0 klatek). `AnimatePresence mode="wait"` nigdy nie kończy wyjścia
  — przełączenie widoku kliknięciem zostawia pusty ekran. Obejście: ustaw widok
  w `localStorage` i przeładuj. To artefakt narzędzia, **nie usterka**.
- `getComputedStyle` na elemencie z `transition` zwraca wartość POCZĄTKOWĄ;
  rozstrzyga klon (`cloneNode`).
- `npx tsc --noEmit` **nie widzi CSS-a ani SQL-a**. Po każdej paczce **załaduj
  dotknięty ekran**.

**Apka w symulatorze na LOKALNYM panelu** — gesty sprawdzasz SAM:

```bash
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'content-type: application/json' \
  -d '{"password":"<z .env.local>","device":"Symulator"}'   # ciało MUSI mieć `device`

SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny \
SIMCTL_CHILD_LEGGERA_DEV_TOKEN=<token> \
SIMCTL_CHILD_LEGGERA_DEV_TAB=faktury \
SIMCTL_CHILD_LEGGERA_DEV_ZGODA_CICHA=1 \
  xcrun simctl launch <udid> pl.leggeralabs.hub
```

Build: `Skrypty/stempel-wersji.sh` **przed** `xcodebuild`, inaczej build padnie
na kontroli stempla. Uwaga: **przestrzeń dotyku symulatora ≠ piksele zrzutu**
(iPad: zrzut 1378 px ↔ 834 pt, skala 1,65) — nieudany `tap` to najczęściej zła
skala, nie zepsuty przycisk. Pełne przeciągnięcie odpala akcję od razu; na
krótkim geście zobaczysz kafle.

**Fizyczne urządzenie** zostaje do rzeczy, których symulator nie odda: Face ID,
Wyspa, aparat, prawdziwa skrzynka. Lustro QuickTime jest jednokierunkowe.

---

## Lekcje warte sprawdzenia akurat u Faktur

0. **Inwentarz z 28.07 jest hipotezą, nie wynikiem** — paczki A–G objęły
   wszystkie moduły naraz i nikt tabeli nie aktualizował. Zmierz, zanim
   zaczniesz naprawiać; dwa z trzech ❌ Faktur już nie obowiązują.
1. **Ręczne przepisanie map koloru do jednej wartości nie naprawia rozjazdu —
   odracza go do najbliższej zmiany.** W Projektach ten sam rozjazd wrócił po
   raz DRUGI, po ośmiu dniach. Wiąże je dopiero wspólny słownik: moduł pisze
   `Record<string, Stan>`, formy wyliczają się same (`mapaStanow`/`mapaKropek`/
   `mapaTekstow`/`mapaHexow`). Faktury mają w inwentarzu ❌ na kolorze — licz
   mapy, zanim uznasz którąś za obowiązującą.
2. **Trzy osie na jednej karcie mogą mówić kolorem najwyżej dwiema.** Faktura
   niesie status płatności, status KSeF i termin — sprawdź, czy nie dzielą barw.
3. **Zmiana gestu lub skrótu = poprawka w `lib/instrukcje.ts` w tym samym
   commicie.** Paczka G zostawiła cztery moduły z instrukcją uczącą odwrotnego
   odruchu; wyszło to dopiero przy Projektach.
4. **Komentarz SQL `--` wewnątrz `sql\`…\`` wycina resztę zapytania** — trasa
   oddaje pustą odpowiedź bez błędu w UI, `tsc` tego nie widzi.
5. **Baza PGlite kasuje się przy restarcie `npm run dev`** — `PATCH` na
   nieistniejący wiersz zwraca **200 i nic nie robi**. Wygląda jak zepsuta
   blokada.
6. **`*PanelIpad` we wspólnej mapie ekranów** daje pusty ekran z żółtym
   trójkątem na iPhonie, bez crasha.

---

## Na koniec modułu

- Dopisz „Stan po module Faktury" do `51-audyt-uiux-panel-i-apka.md`.
- **Wypełnij wiersz „Faktury"** w tabeli wyniku w `59-spojnosc-ui.md`.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Przygotuj prompt do następnego modułu w kolejce: **Koszty** albo **Katalog**
  (oba mają po kilka ❌ w inwentarzu; Katalog więcej).
- `rm -f .git/index.lock && git add -A && git commit && git push`.
