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
- **Apka**: `KolorWydarzenia` — jedna recepta rysowania wydarzenia na
  wszystkich czterech poziomach kalendarza; ucięty podpis „08:00";
  wyrównanie miesięcy w widoku roku; nagłówek tygodnia „lipiec · tydz. 30";
  `PlakietkaSerii` przestała narzucać jasność; licznik „N do zrobienia"
  w Przypomnieniach.

Szczegóły i uzasadnienia: pamięć `kalendarz-slownik-koloru-parytet`.

## Część A — eksporty (główny zakres tego czatu)

### Co właściciel rozstrzygnął 2026-07-22

Pytany po obejrzeniu realnych plików z trzech istniejących tras:

| Pytanie | Odpowiedź |
|---|---|
| Czego brakuje w treści? | **czas pracy ze stopera**, **wiersz podsumowania**, **eksport klientów i projektów** |
| Eksport w apce? | **Nie.** Tylko panel — to praca przy biurku |
| CSV czy XLSX? | Zostaje **CSV**. Sprawdzone: format jest już zrobiony pod polski Excel (BOM UTF-8, średnik, przecinek dziesiętny) i nic się nie psuje. XLSX nie ma dziś uzasadnienia |
| Import? | nie pytane, nie robimy |

### Co istnieje dzisiaj

Trzy trasy + `lib/export.ts` (`toCsv`, `csvMoney`, `currentMonthRange`,
`exportFilename`) i wspólny `ExportCsvButton` w `app/[lang]/admin/components.tsx`
(pigułka z ikoną + Popover z zakresem dat, pobieranie zwykłym `<a href>`).

| Trasa | Zakres | Przycisk |
|---|---|---|
| `GET /api/leads/export` | cały rejestr, `?ids=` zawęża | `LeadsDashboard.tsx` |
| `GET /api/invoices/export?from&to` | bieżący miesiąc, pomija szkice | `InvoicesDashboard.tsx` |
| `GET /api/costs/export?from&to` | wg daty wydatku | `CostsDashboard.tsx` |

**Nowe trasy pisz w tym samym kształcie** — `isAuthed()` → `ensure*Schema()` →
`isPlausibleDateString()` na `from`/`to` → `toCsv` → `Content-Disposition`.

### A1. Eksport czasu pracy

**Tabela nazywa się `time_entries`, NIE `work_sessions`** — brief 37 podawał
złą nazwę. Schemat w `lib/db.ts` → `ensureTimeSchema()`:
`id, project_id, task_id, source, entry_date, started_at, ended_at,
minutes NUMERIC, note, created_at`.

Trzy rzeczy, które trzeba wiedzieć, zanim napiszesz SQL:

1. **`ended_at IS NULL` = stoper CHODZI.** Musi być odfiltrowany, tak samo jak
   robi to suma na profilu projektu w apce. Wliczenie działającego stopera
   dałoby fakturę na czas, który jeszcze trwa.
2. **`minutes` jest `NUMERIC`, nie `INTEGER`** — sesje poniżej minuty zapisują
   się z realnym ułamkiem. Do rozliczenia z klientem prawie na pewno chcesz
   drugą kolumnę „godziny" (`minutes / 60`), sformatowaną przez `csvMoney`.
3. **Klienta nie ma w `time_entries`** — idzie się do niego przez
   `projects.client_id`. Zapytaj właściciela, czy eksport ma być
   **per projekt** czy **per klient** (przy kilku projektach jednego klienta
   to dwa różne pliki i dwa różne rachunki).

Zakres dat: po `entry_date`, domyślnie bieżący miesiąc — jak Faktury i Koszty.

### A2. Wiersz podsumowania

Do rejestru **sprzedaży** i **zakupów**. Suma netto / VAT / brutto.

Pułapka: rejestr sprzedaży może mieć **kilka walut** (`invoices.waluta`).
Jeden wiersz „razem" zsumowałby złotówki z euro i byłby po prostu
nieprawdziwy. Albo sumuj per waluta (po wierszu na walutę), albo sumuj tylko
gdy w pliku jest jedna waluta — **zapytaj właściciela, nie zgaduj**.
W rejestrze zakupów tego problemu nie ma: **sprawdzone 2026-07-22 —
tabela `costs` nie ma kolumny waluty**, więc jest jednowalutowa i jeden
wiersz „razem" jest tam bezpieczny.

### A3. Eksport klientów i projektów

Dwie nowe trasy. Klienci to żywy rejestr bez naturalnego zakresu dat —
weź wzorzec z `leads/export` (wszystko na raz), nie z `invoices/export`.
Projekty mają daty, więc zakres ma sens; ustal z właścicielem, po której
dacie (start? termin? utworzenie?).

## Część B — reszta spójności (mniejszy zakres, można po eksportach)

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

Zrób eksporty, na które się zgodziłem: czas pracy ze stopera, wiersz
podsumowania w rejestrze sprzedaży i zakupów, oraz eksport klientów
i projektów. Wszystko w panelu, w apce nie. Zanim napiszesz SQL, zadaj mi
pytania, które brief każe zadać (per projekt czy per klient, waluty
w podsumowaniu, po której dacie zakres projektów).

Potem, jeśli zostanie czas, weź się za wspólne klocki w apce — odznakę,
stałą promienia i tokeny czcionek.

Sprawdzaj w kodzie, czy pozycje z briefu nadal są otwarte, i czytaj
komentarze nad kodem, zanim uznasz coś za dług. Poprzedni czat zgłosił
pięć rzeczy, z czego cztery okazały się świadomymi decyzjami.
```
