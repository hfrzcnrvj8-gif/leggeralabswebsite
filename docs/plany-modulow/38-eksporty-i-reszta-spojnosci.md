# Brief: eksporty CSV + reszta spójności wizualnej

> Brief wdrożeniowy pod **jeden osobny czat**. Domyka Moduł 37
> (`37-standard-branzowy-i-excel.md`), który został wykonany tylko w połowie.
> Dotyczy **panelu i aplikacji natywnej**. Repo apki:
> `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
>
> Powstał 2026-07-22 na koniec sesji, w której zrobiono część A Modułu 37
> (rozjazdy apka↔panel) i zadano właścicielowi pytania o eksport. **Odpowiedzi
> są niżej — nie zadawaj ich drugi raz.**

## Stan zastany — co JUŻ zrobiono (2026-07-22, commity `ffb9b5f`→`2d0693e`)

Nie zaczynaj od tego, to jest zamknięte:

- **Panel**: dziewięć rodzajów wpisu w kalendarzu zeszło do rodzin palety
  marki (znikły `orange-500`, `red-500`, `indigo-500`, `#4ea7fc`); trzy
  znaczniki „dziś", z czego dwa na surowej czerwieni, ujednolicone na biały;
  `brand.red` + `brand.red-soft` w `tailwind.config.ts`.
- **Panel**: **Przypomnienia weszły do kalendarza** jako dziesiąty
  `DeadlineKind` (wcześniej ich tam NIE BYŁO — przypomnienie zaplanowane na
  telefonie znikało przy biurku), z **odhaczaniem wprost z listy dnia**.
  Kamień milowy przeszedł z różu do rodziny fioletu, email zszedł na
  neutralną szarość, róż jest teraz przypomnieniem — tak jak w apce.
- **Apka**: `KolorWydarzenia` — jedna recepta rysowania wydarzenia na
  wszystkich czterech poziomach kalendarza; ucięty podpis „08:00";
  wyrównanie miesięcy w widoku roku; nagłówek tygodnia „lipiec · tydz. 30";
  `PlakietkaSerii` przestała narzucać jasność; licznik „N do zrobienia"
  w Przypomnieniach; formularz wydarzenia przestał obiecywać kolor
  po powiązaniu, którego apka nie rysuje (zdanie przyszło z panelu).

Szczegóły i uzasadnienia: `HUB_SETUP.md` → „Kalendarz: jeden słownik koloru
z apką + przypomnienia" oraz pamięć `kalendarz-slownik-koloru-parytet`.

**Świadoma różnica, której NIE naprawiaj:** panel rozróżnia dziesięć rodzajów
wpisu kolorem, apka zwija osiem „terminów" w jedną złotą kropkę. Decyzja
właściciela — duży ekran unosi dziesięć kolorów, telefon nie.

## Część A — eksporty ✅ WYKONANE 2026-07-22

Wszystkie trzy zamówione eksporty stoją i są zweryfikowane pobraniem pliku.
Pełny opis: `HUB_SETUP.md` → „Eksporty CSV — komplet". **Nie rób tego drugi
raz** — poniższa sekcja zostaje jako zapis decyzji, nie jako zadanie.

Zrobione: wiersz podsumowania (sprzedaż per waluta, zakupy jednym wierszem),
`/api/time/export` (linia = sesja, sumy per projekt, chodzący stoper wypada),
`/api/clients/export` i `/api/projects/export` (całe rejestry, bez zakresu dat).

**Zostaje otwarta tylko Część B.**

### Kontekst decyzji (zapis, nie zadanie)

### Co właściciel rozstrzygnął 2026-07-22

Pytany po obejrzeniu realnych plików z trzech istniejących tras:

| Pytanie | Odpowiedź |
|---|---|
| Czego brakuje w treści? | **czas pracy ze stopera**, **wiersz podsumowania**, **eksport klientów i projektów** |
| Eksport w apce? | **Nie.** Tylko panel — to praca przy biurku |
| CSV czy XLSX? | Zostaje **CSV**. Sprawdzone: format jest już zrobiony pod polski Excel (BOM UTF-8, średnik, przecinek dziesiętny) i nic się nie psuje. XLSX nie ma dziś uzasadnienia |
| Import? | nie pytane, nie robimy |

### Jak zostało rozstrzygnięte (dla kontekstu)

- **Czas pracy: ani per projekt, ani per klient.** Linie (jedna sesja = jeden
  wiersz), klient i projekt jako dwie osobne kolumny, sumy per projekt na dole.
  Z linii zrobi się sumę w dowolnym przekroju; z sumy nie odzyska się szczegółu.
- **Podsumowanie sprzedaży: per waluta.** `costs` nie ma kolumny waluty, więc
  zakupy sumują się jednym wierszem.
- **Klienci i projekty: bez zakresu dat.** `projects.start` ORAZ
  `projects.termin` są opcjonalne, więc filtr po dacie gubiłby wiersze po cichu.

Dwie rzeczy, na których brief się mylił, a które zweryfikowano w kodzie:
tabela czasu nazywa się `time_entries` (nie `work_sessions`), a `projects`
**ma** kolumnę `start` — doszła późniejszą migracją, więc nie widać jej
w `CREATE TABLE`.

## Część B — wspólne klocki ✅ WYKONANE 2026-07-22

Zrobione w trzech paczkach (`406c71b`, `0b8652f`, `f2b6aa6`): `Promien`,
`RozmiarIkony`, `Odznaka(tekst:)`, `WierszeProfilu.swift`. Opis i lekcje:
`HUB_SETUP.md` → „Wspólne klocki apki".

**Moduł 38 jest zamknięty w całości.** Poniższe zostaje jako zapis stanu
sprzed wykonania — nie jako lista zadań.

### Stan sprzed wykonania (archiwum)

### Co jest realnie otwarte — zweryfikowane gretem 2026-07-22

| Pozycja | Stan |
|---|---|
| Odznaka-kapsułka od zera | **34 użycia `Capsule()` w 17 plikach** poza `Marka.swift`; `StatusPillTekst` używany tylko w części modułów. Wspólnej `Odznaka(tekst:)` nadal nie ma |
| `.font(.system(size:))` | **26** wystąpień. Rosło: audyt 20.07 mówił 11, brief 37 mówił 22 |
| Promienie kart | 8 / 12 / 16 / 20 / 22 — **żaden nie jest nazwaną stałą** |
| `WierszDanych` dwa razy | `KontaktWiersz`/`PoleWiersz` (`LeadDetailView:328`,`:358`) vs `WierszKontaktu`/`WierszPola` (`KlientDetailView:291`,`:315`) — odwrócone nazwy, grep po nazwie ich nie zestawi |
| Log aktywności ×2 | `LogWiersz` (`LeadDetailView:376`) vs `ListaZmian` (`KlientDetailView:241`) |
| Style przycisku | 3 oficjalne (`Marka.swift:56/75/113`) + `PrzyciskStoperaKapsula`, `PrzyciskWyboruZadania` (`StoperPasek.swift:95`,`:198`) |
| Status uczestnika zaproszenia | goły `Text` z kolorem zamiast `StatusPillTekst` (`ZaproszeniNaSpotkanie.swift:119`) — trzeci język plakietki |

**Dług A1 (jedno pole błędu) jest ZROBIONY** od 2026-07-21 (`Komunikaty.swift`,
enum `Zasob`). Nie zaczynaj od niego.

### Czego NIE „naprawiaj" — to są świadome decyzje z uzasadnieniem w kodzie

Poprzedni czat zgłosił pięć „odstępstw", z czego **cztery były fałszywe**.
Sprawdź komentarz nad kodem, zanim uznasz coś za dług:

1. **`.tint(.brandCyan)` przy wyborze daty** — 17 pól w 7 plikach. Konwencja.
2. **Widok roku bez kropek z danymi** — komentarz w `KalendarzView.swift`
   uzasadnia: 12 żądań na jedno machnięcie, nieczytelne w tej skali, Apple
   robi tak samo.
3. **Tydzień bez siatki godzinowej** — „godziny na szerokości telefonu to
   widok, który wypchnął PWA".
4. **„Pokaż ukończone" w Przypomnieniach** — jest, w menu „…" paska.
5. **Lokalne `PustyStan` / `StanZaproszen`** — duplikacja realna, ale
   **świadomie odłożona**: wspólny pusty stan to zakres modułu A1
   (`21-brief-a1-komunikaty.md`, 16 ekranów), którego nie wolno przesądzać
   jednym przypadkiem. Oba mają teraz zgodne 28 pt i tyle wystarczy.

**Zasada: policz, ile miejsc robi to samo, i przeczytaj komentarz pod spodem.
Zrzut pokazuje objaw, nie intencję.** Odwrotny przypadek też się zdarzył —
komentarz przy nagłówku tygodnia obiecywał „miesiąc + numer", a kod zwracał
sam numer; tam dopiero zrzut miał rację.

## Kontekst techniczny, który oszczędzi czasu

- **Podgląd symulatora (`mcp__Claude_Code_iOS_Simulator__*`) DZIAŁA**, razem
  z dotykiem — naprawione 2026-07-22. Przyczyna, gdyby wróciło: brakowało
  `/var/db/xcode_select_link`, czyli **zapisanego** wyboru Xcode.
  `xcode-select -p` odpowiadał poprawną ścieżką **z domyślki**, więc wyglądało
  na fałszywy alarm — nim nie było. Lekarstwo to dokładnie komenda
  z komunikatu błędu (`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`),
  wymaga hasła właściciela. **Nie odrzucaj tego błędu jako fałszywego na
  podstawie samego `xcode-select -p`** — sprawdź, czy ten plik istnieje.
- Furtki `LEGGERA_DEV_*` (spis w README apki) nadal są najszybszą drogą do
  konkretnego ekranu, nawet gdy dotyk działa.
- **Build apki ma bramkę stempla wersji.** Po każdej zmianie plików uruchom
  `Skrypty/stempel-wersji.sh`, inaczej `xcodebuild` kończy się błędem
  „Stempel mówi: niezapisane zmiany = NO, a realnie jest YES".
- Panel: `npx tsc --noEmit -p tsconfig.json` to jedyna realna weryfikacja
  (pełny `next build` failuje z EPERM w sandboxie).
- Serwer dev panelu bywa już uruchomiony na `:3000` przez inny czat —
  `preview_start` odmówi startu drugiego. To nie błąd, po prostu go użyj.

## Jak pracować

- **Sprawdź gretem, zanim uwierzysz temu plikowi.** Ten sam nawyk uratował
  poprzednią sesję dwa razy (zła nazwa tabeli, cztery fałszywe „odstępstwa").
- Część A zacznij od `lib/export.ts` i `app/api/costs/export/route.ts` jako
  wzorca — nowe trasy mają wyglądać jak tamte, nie wymyślaj drugiego kształtu.
- **Zielony build nie jest dowodem** — uruchom i obejrzyj. W panelu
  przeglądarką, w apce zrzutem z symulatora.
- Część B to praca mechaniczna (podmiana na tokeny) — nadaje się hurtem, ale
  **po każdej paczce build i zrzut**.

## Prompt otwierający kolejny czat

```
Przeczytaj docs/plany-modulow/38-eksporty-i-reszta-spojnosci.md, potem
CLAUDE.md i docs/natywna-aplikacja/00-plan.md.

Część A (eksporty) jest zrobiona — nie ruszaj jej. Weź się za Część B:
wspólne klocki w apce, czyli Odznaka(tekst:), nazwana stała promienia karty
i tokeny czcionek zamiast .font(.system(size:)). Rób paczkami, po każdej
build i zrzut z symulatora.

Czytaj komentarze nad kodem, zanim uznasz coś za dług — brief ma listę pięciu
rzeczy, które poprzedni czat zgłosił jako odstępstwa, a cztery z nich okazały
się świadomymi decyzjami.
```
