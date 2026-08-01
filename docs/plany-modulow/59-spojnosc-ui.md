# Moduł 59 — Przegląd spójności (panel + iPhone + iPad)

> Czytaj razem z `CLAUDE.md` (zasady projektu), `51-audyt-uiux-panel-i-apka.md`
> (skąd wziął się audyt modułowy) i `HUB_SETUP.md` (wzorce już ustalone).

## Po co to powstało

Zgłoszenie właściciela (2026-07-28): *„chodzimy do przodu i cofamy się do
zeszłych modułów; chcę spójności w wyglądzie i nawigacji, żeby nauczyć się
jednego schematu, a nie żeby wszędzie były własne reguły"*.

Powód rozjazdów jest metodyczny, nie przypadkowy: **wzorzec poprawiany był
w module, nad którym akurat trwała praca**, a nie od razu we wszystkich.
Ostatni przykład z tego samego dnia: wiersz listy na iPadzie był klikalny na
całej szerokości w Ofertach, a w Klientach, Leadach i Projektach tylko na
tekście — ta sama lista, ten sam gest, trzy zachowania. Właściciel odbierał to
jako „martwy przycisk, raz działa, raz nie".

**Ten dokument jest SYSTEMEM, nie jednorazową listą.** Powstaje raz, a potem
powiela się go przy każdym module i przy każdej nowej funkcji.

## Jak używać

1. Przejdź listę kontrolną **modułami**, nie punktami — jeden moduł na raz,
   wszystkie trzy platformy naraz (panel, iPhone, iPad).
2. Znalezioną niespójność napraw **od razu we WSZYSTKICH modułach**, nie
   w tym, który akurat sprawdzasz. Jedna poprawka → cztery panele.
3. Każdy wzorzec, który uznasz za obowiązujący, dopisz do `HUB_SETUP.md`
   z jednym zdaniem UZASADNIENIA — bez powodu wzorzec nie przeżyje pierwszego
   „a może inaczej".
4. Wynik notuj w tabeli na dole (moduł × kategoria: ✅ / ⚠️ / ❌).

**Weryfikuj POMIAREM, nie oglądaniem.** Zrzut ekranu wygląda wiarygodnie
nawet wtedy, gdy jest źle — ta lekcja wraca w tym projekcie regularnie
(kontrast płyt, rytm wierszy, kolor pigułki, ucięta kolumna drzewka). Panel:
`getComputedStyle` w przeglądarce. Apka: zrzut z symulatora + pomiar w kodzie.
Trasy: sonda `curl` po każdym uchwycie HTTP osobno.

---

## Lista kontrolna

### 1. Kolor — czy niesie ZNACZENIE, i zawsze to samo

- [ ] **Jeden kolor = jedno znaczenie** w całym produkcie. Status dokumentu,
      status relacji i status projektu to trzy różne osie — nie mogą używać
      tej samej barwy do różnych rzeczy (audyt słownika koloru znalazł
      w panelu trzy sprzeczne mapy naraz).
- [ ] **Paleta marki zamiast generycznych kolorów**: `brand.purple`,
      `brand.pink`, `brand.gold`, `brand.cyan` (panel: `tailwind.config.ts`,
      apka: `Theme.swift`).
- [ ] **Gradient marki = akcent, nie chrome.** Jeden akcent gradientowy na
      ekran (znak LL, ikona akcji głównej, podkreślenie aktywnej zakładki).
      Chrome (filtry, menu, szukanie) zostaje neutralne.
      Jedno źródło: `Color.gradientMarki` / `IkonyMarki.symbol`.
- [ ] **Czerwień wyłącznie dla błędu i akcji niszczącej.** Dokument odrzucony
      to zamknięta sprawa, nie awaria — kolor neutralny.
- [ ] **Zamknięte/nieaktualne przygasa** (opacity ~60%), zamiast krzyczeć
      kolorem.
- [ ] **Ten sam status ma ten sam kolor na panelu i w apce.** Rozstrzygnięte:
      wygrywa paleta apki.
- [ ] Kontrast zmierzony, nie oceniony na oko (płyta vs karta, tekst vs tło).

### 2. Klikalność — czy da się dotknąć tego, co wygląda na klikalne

- [ ] **Cały wiersz listy jest klikalny**, nie tylko tekst
      (`contentShape(Rectangle())` w apce, cały `<tr>` w panelu).
- [ ] **Każdy rekord ma własny adres** (panel: `/admin/<moduł>/<id>`) — do
      wklejenia w zakładki i w rozmowę.
- [ ] **Każde powiązanie prowadzi do rekordu.** Nazwa klienta, numer
      dokumentu, tytuł projektu — jeśli widać, ma być klikalne.
- [ ] **Nie ma martwych afordancji**: kursor/podświetlenie tylko tam, gdzie
      naprawdę coś się dzieje.
- [ ] Pole tylko do odczytu MUSI powiedzieć DLACZEGO i dokąd iść zamiast tego
      (reguła z 2026-07-28: wyszarzone pole bez wyjaśnienia udaje usterkę).

### 3. Gesty i menu — te same skróty do tych samych rzeczy

- [ ] **Panel: prawy przycisk myszy** na każdej liście i na każdym elemencie,
      który ma więcej niż jedną akcję (`useContextMenu` + `ContextMenu`).
      Menu jest SKRÓTEM — wszystko z niego musi dać się zrobić też widocznym
      przyciskiem.
- [ ] **Apka: przytrzymanie = to samo menu** co prawy przycisk w panelu.
- [ ] **Swipe w prawo = ruch DO PRZODU albo POMYŚLNE domknięcie** (zadzwoń,
      wyślij, przypomnij, obsłużone, opłacony, wdrożone), **swipe w lewo =
      wyłącznie to, co idzie „od siebie"** (odrzuć, zablokuj, archiwum, usuń).
      Ta sama strona dla tego samego znaczenia we wszystkich modułach.
      Doprecyzowane 2026-07-31 (paczka G): pierwsza wersja mówiła po prostu
      „w lewo = zamknięcie sprawy", a to czyta się w dwie strony — „obsłużone"
      przecież też zamyka. Ta dwuznaczność JEST powodem, dla którego jedno
      słowo miało w apce dwa kierunki. Test rozstrzygający: czy po tej akcji
      sprawa skończyła się dobrze, czy odpadła? Powód wyboru (pełne
      przeciągnięcie odpala pierwszy przycisk krawędzi): `HUB_SETUP.md`.
- [ ] **Pozycje niedostępne są wyszarzone, nie ukryte** — menu, które zmienia
      kształt przy każdym wierszu, nie da się zapamiętać.
- [ ] Drag & drop tam, gdzie istnieje kolejność (kamienie, zadania, pozycje).

### 4. Klawiatura (panel + iPad)

- [ ] Paleta poleceń `Cmd/Ctrl+K` zna każdy moduł i jego „+ Dodaj X".
- [ ] `/` — szukanie na liście. `j`/`k` — kursor. `Enter` — otwórz.
- [ ] Chordy `g <litera>` — skok do modułu (panel).
- [ ] iPad: `⌘1–5` (moduły), `⌘F` (szukaj), `⌘N` (nowy).
- [ ] `Esc` zamyka modal/panel wszędzie tak samo.

### 5. Nawigacja i układ

- [ ] **Kolejność modułów identyczna** na panelu, iPhonie i iPadzie
      (`lib/process.ts` → lejek sprzedaży).
- [ ] **Profil rekordu = wyśrodkowany modal** (panel), z osobną podstroną pod
      tym samym adresem. Apka: pełny ekran albo arkusz — konsekwentnie.
- [ ] **Zakładki profilu nazwane tak samo** i w tej samej kolejności na
      wszystkich platformach.
- [ ] Moduł z gęstą tabelą jest na PEŁNĄ szerokość (`PELNA_SZEROKOSC`).
- [ ] „+" zawsze w tym samym rogu (**ostatnia kontrolka paska modułu, przy
      prawej krawędzi OKNA — nie wyśrodkowanej kolumny**); szukanie zawsze
      w tym samym miejscu. „+" dodaje REKORD modułu, nigdy pojemnik.
- [ ] Powrót zachowuje pozycję listy i wybrany filtr.

### 6. Puste stany, ładowanie, błędy

- [ ] **Pusty stan mówi, czego brakuje i CO TO ZMIENIA** (ustalenie A1), nie
      „brak danych".
- [ ] Rozróżnia trzy sytuacje: *pusto naprawdę* / *nic nie pasuje do filtra* /
      *nie udało się wczytać* — trzy różne komunikaty.
- [ ] Ładowanie: szkielet o kształcie treści, nie spinner na środku.
- [ ] Błąd zapisu widoczny w interfejsie (toast/pasek), nigdy tylko w konsoli.
- [ ] **Nigdy `window.confirm/alert/prompt`** — wyłącznie `useUI()`.

### 7. Treść i formaty

- [ ] **Dokument nazywany numerem, nie słowem** — jeśli ścieżka mówi
      „UM-2026-F57862", rejestr obok nie może mówić samo „Umowa".
- [ ] Daty przez `formatPlDate` / `Daty.poPolsku`; nigdy surowy ISO,
      nigdy `new Date()` na znaczniku z Postgresa.
- [ ] Kwoty zawsze z walutą dokumentu; panel nie przelicza kursów i mówi
      o tym wprost.
- [ ] Etykieta pola po lewej, wartość po prawej; puste pole pokazuje `—`,
      a nie znika.
- [ ] Placeholder nie zastępuje etykiety (znika, gdy pole ma treść).
- [ ] Jeden ton komunikatów: krótko, po polsku, bez żargonu, z powodem.

### 8. Ruch i haptyka

- [ ] Jedno źródło płynności: `lib/motion.ts` (`SPRING`, `EASE_LIQUID`) /
      `Ruch.swift`. Żadnych liczb z palca, żadnego `transition` bez `ease`.
- [ ] Haptyka przy GARDŁACH (zapis, wysyłka, podpis), nie przy każdym dotknięciu.

### 9. Integralność — reguła musi stać w trasie

- [ ] Każda trasa zaczyna się od `isAuthed()` — sprawdzane per UCHWYT HTTP,
      nie per plik.
- [ ] Wartości ze słownika (statusy, typy) walidowane po stronie serwera.
- [ ] **Co da się usunąć, da się dodać z powrotem** — świadoma reguła
      z 2026-07-28.
- [ ] Idempotencja ma WIDOCZNY ślad („NDA już istnieje", „Zaliczka już jest").
- [ ] Blokada dokumentu ma drogę wyjścia (korekta / nowa wersja / aneks).

### 10. Dostępność i dotyk

- [ ] Cel dotknięcia ≥ 44 pt; odstęp między celami ≥ 8 pt.
- [ ] Etykiety dla VoiceOver na ikonach bez tekstu.
- [ ] Skalowanie czcionki nie łamie układu — i **nie zmniejsza pisma tylko
      w części elementów** (to była przyczyna „źle sformatowanej pastylki":
      pięć zakładek na iPhonie skalowało „Wizytówkę", a „Logi" zostawiały
      w pełnym rozmiarze).

---

## Tabela wyniku (wypełniać w trakcie)

Legenda: ✅ zgodne · ⚠️ drobny rozjazd · ❌ wymaga poprawki · — nie dotyczy

### ETAP 1 — inwentarz wypełniony 2026-07-28

Stan: panel `318f24d`, apka `acb1c54` (wydanie 166). Metoda: `getComputedStyle`
w dev-panelu (PGlite), zrzut z symulatora iPada, sonda `curl` po uchwytach HTTP,
oraz zliczanie po kodzie obu repozytoriów. Kolumna = kategoria z listy wyżej.

| Moduł | Kolor | Klikalność | Gesty/menu | Klawiatura | Nawigacja | Stany | Treść | Ruch | Integralność | Dotyk |
|---|---|---|---|---|---|---|---|---|---|---|
| Pulpit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leady | ✅³ | ✅³ | ✅ | ✅³ | ✅³ | ✅³ | ✅ | ✅ | ✅³ | ✅¹ |
| Klienci | ✅ | ✅³ | ✅ | ✅ | ✅³ | ✅ | ✅ | ✅ | ✅³ | ✅ |
| Oferty | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Umowy | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Projekty | ✅¹ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅¹ |
| Faktury | ✅² | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Katalog | ✅⁴ | ✅⁴ | ✅⁴ | ✅⁴ | ✅⁴ | ✅⁴ | ✅⁴ | ✅ | ✅⁴ | ✅ |
| Kalkulator | ✅ | — | — | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| Koszty | ✅⁵ | ✅⁵ | ✅⁵ | ✅⁵ | ✅⁵ | ✅ | ✅ | ✅ | ✅⁵ | ✅ |
| Poczta | ✅ | ✅ | ✅ | ✅⁶ | ✅ | ✅⁶ | ✅ | ✅ | ✅⁶ | ✅ |
| Kalendarz | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notatnik | ✅ | ✅⁸ | ✅⁸ | ✅⁸ | ✅⁸ | ✅⁸ | ✅⁸ | ✅ | ✅⁸ | ✅ |
| Przypomnienia | ✅ | ✅⁷ | ✅⁷ | ✅⁷ | ✅⁷ | ✅⁷ | ✅ | ✅ | ✅⁷ | ✅ |
| Statystyki | ✅ | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

³ **Wiersze Leadów i Klientów ZMIERZONE PONOWNIE 2026-08-01** (na początku
Modułu 62). Nie zmieniono w nich ani linijki kodu — pokazywały siedem ❌/⚠️,
z których **żadne już nie obowiązywało**. Oba moduły przeszły własne audyty
(25 i 26 lipca), a potem paczki A–G Modułu 59 objęły wszystkie moduły naraz;
wiersza nikt nie zaktualizował. To był trzeci raz z rzędu, kiedy tabela myliła
się na niekorzyść. Co dokładnie zmierzono:

- **Kolor** (Leady): pigułki statusu stoją na wspólnej skali i mają realne tło
  (`getComputedStyle` na klonie, kompozycja rgba na tle panelu `#08090A`):
  „Do kontaktu" 7,13 · „Napisano" 8,08 · „Pilotaż" 8,18 · „Zamknięte - sukces"
  7,42 · „Odrzucone" 5,01 — całość powyżej progu AA 4,5.
- **Klikalność**: `<tr>` ma `onClick` i `cursor: pointer` na całej szerokości,
  każdy rekord ma adres (`/pl/admin/leads/<id>`, `/pl/admin/clients/<id>`),
  a w tabeli stoi ikona „otwórz" honorująca ⌘-klik. Kanban Klientów: karta
  z `onClick` + `onContextMenu`.
- **Klawiatura**: „/" ustawia fokus w polu szukania, `j`/`k` przesuwają
  `[data-kursor]`, ⌘K otwiera paletę, `Esc` zamyka — sprawdzone dyspozycją
  zdarzeń w obu modułach.
- **Stany**: oba dashboardy używają `StanListy` + `StanBledu` (trzy warianty
  pustego stanu), nie własnych napisów.
- **Integralność**: sonda `curl` z `DEV_ADMIN_BYPASS=0`, **45 uchwytów HTTP**
  po jednym (25 leadów + 20 klientów) — wszystkie 401 oprócz `POST /api/leads`,
  który jest **świadomie publiczny** (formularz na stronie, hamulec
  `HAMULEC_FORMULARZ`, wyjątek dla zalogowanego). Grep po pliku dałby tu
  fałszywy alarm — dokładnie ta pułapka, o której mówi lista kontrolna.
- **Dotyk** (Leady): wiersz tabeli 73 px. „⚠️" z 28.07 dotyczyło celów poniżej
  44 px, których panel ma wszędzie tyle samo — patrz przypis ¹ przy Projektach.

⁶ **Poczta przeszła pełną listę 2026-08-01** (Moduł 65) — wynik i pomiary
w `51-audyt-uiux-panel-i-apka.md` → „Stan po module Poczta". **Klawiatura ⚠️
była nieaktualna** (paczka C podpięła `useSkrotyListy`, do tabeli nikt tego nie
wpisał — piąty raz z rzędu). **Stany ⚠️ obowiązywały i to nie kosmetycznie**:
pusty stan przy włączonej kategorii pisał „Nic — wszystko obsłużone", czyli
twierdził, że skrzynka jest czysta, gdy sześć wiadomości czekało odsianych
filtrem — i nie dawał drogi powrotnej. Cała ta informacja stała na
`text-muted opacity-60`, zmierzone **2,84:1** (po zmianie 5,94 opis / 18,15
tytuł). **Integralność** zmierzona sondą: 22/22 uchwytów z realną bramką 401,
walidacja wejścia bez zarzutu — ale wysyłka dała się **wykonać dwa razy**
zerwanym żądaniem (patrz `lib/mailGuard.ts`).

⁷ **Przypomnienia przeszły pełną listę 2026-08-01** (Moduł 66) — wynik
i pomiary w `51-audyt-uiux-panel-i-apka.md` → „Stan po module Przypomnienia".
**Pierwszy raz od sześciu modułów tabela myliła się w OBIE strony**, a nie
tylko na niekorzyść:

- **Klawiatura ❌ — NIEAKTUALNE** (szósty raz z rzędu). `/` ustawia fokus
  w polu szukania, `j`/`k` przesuwają `[data-kursor]` — sprawdzone dyspozycją
  zdarzeń, nie odczytem importów. Sprzątnęła to paczka C, wiersza nikt nie
  poprawił.
- **Nawigacja ⚠️ — NIEAKTUALNE.** Adres rekordu (`/pl/admin/reminders/<id>`)
  dołożyła paczka E, razem z odrębną obsługą 404 („Nie ma takiego
  przypomnienia" ≠ „nie udało się wczytać").
- **Stany ❌ — OBOWIĄZYWAŁO**, i to tą samą usterką, co Poczta tydzień
  wcześniej: jedne słowa obsługiwały dwa różne powody pustki, więc szukanie
  frazy bez trafień odpowiadało **„Przypomnienia są, ale żadne nie należy do
  wybranej listy"** — zdaniem fałszywym, gdy żadna lista nie jest wybrana.
  Pusty stan z błędnym powodem wysyła po złe wyjście.
- **Klikalność ⚠️ — OBOWIĄZYWAŁO.** Zmierzone `getBoundingClientRect`: kółko
  odhaczenia **18×18 px**, trzy ikony wiersza (flaga, otwórz, usuń) po
  **15×15 px**, przy progu 24×24 z WCAG 2.5.8 — i to na przycisku, który w tym
  module naciska się najczęściej ze wszystkich. Po zmianie **26×26** (padding
  cofnięty ujemnym marginesem: rośnie trafienie, nie rysunek). **Ten sam wzorzec
  15 px stoi też w Katalogu** (`CatalogDashboard.tsx`) — zapisane, NIE zmienione
  w tej sesji, bo to zakres poza modułem.
- **Gesty/menu ⚠️ — OBOWIĄZYWAŁO.** Jedenaście modułów ma menu pod prawym
  przyciskiem (`onContextMenu`), Przypomnienia były — obok Notatnika
  i Kalendarza — jednym z trzech miejsc bez niego. Dołożone wspólnym
  `useContextMenu`.
- **Integralność ⚠️ — OBOWIĄZYWAŁO**, i to najciężej z całej tabeli. Sonda:
  **9/9 uchwytów z realną bramką 401**, ale walidacja miała cztery dziury,
  w tym `{"termin": 20260901}` (liczba zamiast tekstu), która **KASOWAŁA
  termin** i odpowiadała `{"ok":true}`. Szczegóły w `51-…`.

⁸ **Notatnik przeszedł pełną listę 2026-08-02** — wynik i pomiary
w `51-audyt-uiux-panel-i-apka.md` → „Stan po module Notatnik". **Siódmy raz
z rzędu inwentarz mylił się w obie strony**, tym razem najmocniej ze
wszystkich: z pięciu wpisów **dwa były nieaktualne, trzy obowiązywały**.

- **Klawiatura ❌ — NIEAKTUALNE.** Paczka C podpięła `useSkrotyListy`, do tabeli
  nikt tego nie wpisał (szósty raz). Zmierzone dyspozycją zdarzeń: `/` ustawia
  fokus w szukaniu, `j`/`k`/`↓` przesuwają kursor po kartach (0→1→0), `Enter`
  otwiera profil — modal był w DOM z pełną treścią, tylko niewidoczny przez
  zamrożony `requestAnimationFrame` podglądu (0 klatek, `visibilityState:
  hidden`), więc rozstrzygnął odczyt DOM, nie zrzut.
- **Nawigacja ⚠️ — NIEAKTUALNE.** `/pl/admin/notes/<id>` działa, a nieistniejące
  id dostaje własny ekran („Nie ma takiej notatki" + „← Wróć do notatnika"),
  inny niż awaria.
- **Stany ❌ — OBOWIĄZYWAŁO, i to na DWA sposoby.** `StanListy` i `StanBledu` są
  zaimportowane od paczki E — i to właśnie usypiało czujność. (1) Pusty stan
  **kłamał o powodzie**: archiwum z wpisem + fraza bez trafień pisało „Archiwum
  jest puste — nic jeszcze nie schowałeś z biurka". Trzeci raz ten sam błąd po
  Poczcie i Przypomnieniach, więc słowa dobiera dziś PRZYCZYNA, a o pustym
  archiwum wolno mówić tylko wtedy, gdy archiwum jest jedynym zawężeniem.
  (2) **Profil notatki wisiał na wiecznym szkielecie** przy awarii trasy:
  `if (!res.ok) return;` zostawiało `note === null` bez żadnej drogi wyjścia.
  Paczka E naprawiła to na LIŚCIE, ale nie w `NoteDetailPanel` — zmierzone
  podmianą `fetch` na 500.
- **Treść ⚠️ — OBOWIĄZYWAŁO.** Karta notatki nie miała sufitu wysokości:
  pole rosło do pełnej treści, więc notatka przy dopuszczalnym maksimum dawała
  kartę **2340 px** (pomiar kontrolowany przy szerokości karty 380 px), czyli
  jeden rekord wypychał resztę siatki poza ekran. Dziś karta tnie na 240 px
  i przewija się wewnątrz; w profilu limitu nie ma, bo tam czyta się jedną rzecz.
- **Integralność ⚠️ — OBOWIĄZYWAŁO.** Sonda: **13/13 uchwytów HTTP z realną
  bramką 401**, ale walidacja miała siedem dziur — w tym `{"tresc": 12345}`,
  które **KASOWAŁO treść notatki** i odpowiadało `{"ok":true}`. Szczegóły w `51-…`.
- **Dwie pozycje fałszywie zielone**, dokładnie jak przy Przypomnieniach:
  **Klikalność** (pinezka i archiwum po 14×14 px, „⤢" aż **6×17 px** przy progu
  24×24 z WCAG 2.5.8 — dziś 26×26 i 24×24) oraz **Gesty/menu** (`useContextMenu`
  miał zero trafień; po tej sesji bez menu pod prawym przyciskiem został już
  tylko Kalendarz).

⁵ **Koszty przeszły pełną listę 2026-08-01** (Moduł 63) — wynik i pomiary
w `51-audyt-uiux-panel-i-apka.md` → „Stan po module Koszty". Jedyne ❌
(Klawiatura) było NIEAKTUALNE, a wszystkie trzy ⚠️ też — sprzątnęły je paczki
C, E i G, których nikt do tabeli nie wpisał. **Czwarty raz z rzędu inwentarz
mylił się w obie strony**: 4 z 4 pozycji nieaktualne, a realną pracą było
znowu coś spoza tabeli — brak WALUTY, brak TERMINU PŁATNOŚCI i sześć cichych
podmian w trasach, z których jedna miała skutek podatkowy.

⁴ **Katalog przeszedł pełną listę 2026-08-01** (Moduł 62) — wynik i pomiary
w `51-audyt-uiux-panel-i-apka.md` → „Stan po module Katalog". Z czterech ❌
trzy były NIEAKTUALNE (Klawiatura, Stany, Klikalność — paczki C i E),
obowiązywało jedno: **Gesty/menu**. Realną pracą było znowu coś spoza tabeli:
katalog nie miał WALUTY, a jego trasy przyjmowały każdy śmieć i odpowiadały
`{"ok":true}`.

² **Faktury przeszły pełną listę 2026-07-31** (Moduł 61) — wynik i pomiary
w `51-audyt-uiux-panel-i-apka.md` → „Stan po module Faktury". Dwa z trzech ❌
w tym wierszu były NIEAKTUALNE, zanim ktokolwiek je tknął: statusy stały na
wspólnej skali od paczek A–G, a `isInvoiceStatus` pilnował PATCH-a. Inwentarz
z 28.07 był hipotezą, nie wynikiem — realną pracą okazało się coś, czego w nim
nie było wcale (patrz niżej).

- **Kolor** ✅ po odebraniu barwy osi KSeF. Faktura niesie trzy osie naraz
  (płatność, KSeF, termin), a kolorem mogą mówić najwyżej dwie — `przyjeto`
  brało tę samą zieleń, co „Opłacona", i obie pigułki stały w JEDNYM wierszu.
  Ta sama kolizja siedziała w apce i została zamknięta tym samym ruchem.
- **Integralność** ✅ po zamknięciu czterech cichych podmian i bramki waluty.
  Sonda `curl` per uchwyt HTTP: 23/23 uchwytów oddaje 401 bez sesji.

¹ **Projekty przeszły pełną listę 2026-07-31** (Moduł 60, sesja 2) — wszystkie
dziesięć kategorii na trzech platformach, wynik i pomiary w
`51-audyt-uiux-panel-i-apka.md` → „Stan po module Projekty — sesja 2".
Dwa przypisy, żeby ✅ nie znaczyło więcej, niż znaczy:

- **Kolor** ✅ dotyczy statusu, zdrowia i priorytetu, które zostały rozdzielone
  i sprowadzone do jednego słownika. Otwarta zostaje JEDNA rzecz spoza tego
  modułu: `STAN_DOT` (panel) i `Stan.kolor` (apka) malują „u nich"
  `brand.purple #7C3AED`, który ma na tle panelu kontrast **3,5** przy reszcie
  skali 6,1–11,0. Tam, gdzie kolor niesie się sam (pasmo osi czasu), obie
  platformy biorą już jasny `#C4A5FF` (9,65). Czy kropka przy słowie też ma
  pojaśnieć, to decyzja dla CAŁEGO produktu — nie dla Projektów.
- **Dotyk** ✅ znaczy „zgodnie z resztą panelu", nie „≥ 44 px". Zmierzone:
  profil projektu ma 59 celów poniżej 44 px, profil leada 53, w obu najmniejszy
  ma 13 px. Reguła 44 pt jest DOTYKOWA i obowiązuje apkę; panel jest sterowany
  myszą i trzyma jeden rozmiar wszędzie. Podniesienie go byłoby zmianą
  w piętnastu modułach naraz i osobną decyzją właściciela — inwentarz z 28.07
  dawał tu Leadom ⚠️, a Projektom ✅ za tę samą wartość.

**Czyste w całym produkcie (nie wymagają ruchu):** integralność `isAuthed`
(260 uchwytów HTTP sprawdzonych po jednym — 20 bez bramki, wszystkie
świadomie publiczne: tokeny, cron, logowanie), haptyka (45 wywołań `odczuj?`
w `AppStore`, wyłącznie przy gardłach), brak `window.confirm/alert/prompt`
(0 trafień), kolejność modułów panel = iPad = iPhone (zweryfikowana pozycja
po pozycji).

## STAN NA 2026-07-28, koniec dnia

Panel `318f24d..42ee3d0` (7 commitów), apka `acb1c54..b34baae` (5 commitów,
wydanie 171). Wszystko wypchnięte, panel na Vercelu, apka zainstalowana na
iPhonie i iPadzie.

### Zrobione

| paczka | zakres | commit |
|---|---|---|
| A | walidacja statusu (Leady, Faktury) · numer dokumentu w apce · `parsePgTimestamp` · `TWEEN_EXIT` | `49ed97a` / `b3df16d` |
| B | cały wiersz listy otwiera profil (Leady, Klienci — tabela i karta telefonu) | `077aa3a` |
| D | **słownik koloru — jedno źródło dla panelu i apki** | `012532d` / `f91ccd2` |
| D+ | kolor robi jedną rzecz; rodzaj przeniesiony na ikonę; kalendarz z 9 barw na 3 | `cefe15a` / `fffe91c` |
| — | szerokość domyślnie pełna · gradient zaznaczenia usunięty · `--zaznaczenie` · płyty kolumn kanbanu | `42ee3d0` |
| — | widok roczny mieści się na iPhonie · kropki zgodne z legendą | `b34baae` |
| — | dane pokazowe słownika koloru w bazie dev (blok `[próbka]`) | `7f5d7bf` |

### Zostało z pierwotnego planu

| paczka | zakres | skala |
|---|---|---|
| ~~**Pulpit**~~ | ~~sekcje bez płyt~~ — **ZROBIONE 28.07**, patrz „Paczka Pulpit" niżej | — |
| ~~**F**~~ | ~~etykietowane wiersze profilu~~ — **ZROBIONE 28.07**, patrz „Paczka F" niżej | — |
| ~~**F+**~~ | ~~to samo w formularzach~~ — **ZROBIONE 29.07** na prośbę właściciela | — |
| ~~**E**~~ | ~~puste stany · nazwy zakładek · adresy rekordów~~ — **ZROBIONE 29.07** | — |
| ~~**C**~~ | ~~klawiatura~~ — **ZROBIONE 29.07**, patrz „Paczka C" na dole | — |
| ~~**G**~~ | ~~kierunek swipe'a w apce · miejsce „+" w panelu~~ — **ZROBIONE 31.07**, patrz „Paczka G" na dole | — |

### Rozstrzygnięte przez właściciela

- **Gradient aktywnej pozycji w sidebarze ZOSTAJE** (`.admin-nav-active`,
  potwierdzone 2026-07-28). Formalnie łamie Regułę 4 („gradient niesie markę,
  nigdy znaczenie"), ale sidebar to chrome tożsamości produktu, a nie widok
  rekordu. To jedyny świadomy wyjątek od tej reguły w całym panelu — nie
  „naprawiaj" go przy kolejnym przeglądzie.

### Korekty do inwentarza z Etapu 1

Dwie rzeczy w tabeli wyżej były NIEPRAWDZIWE i zostały poprawione dopiero
w trakcie prac — warto wiedzieć, że pomiar też bywa zły:

1. **„Panel nie ma chordów `g <litera>`"** — ma. `GO_CHORDS` w `AppShell.tsx:129`
   obsługuje 12 modułów. Grep był wrażliwy na wielkość liter.
2. **„Odcienie kalendarza się zlewają"** — nie zlewały się. Zmierzone ΔE: tylko
   jedna para poniżej 25. System był dobry, kolidował wyłącznie znaczeniem.

## Gdzie mieszkają wzorce (jedno źródło każdego)

| Rzecz | Panel | Apka |
|---|---|---|
| Kolory marki | `tailwind.config.ts` | `Theme.swift` |
| Gradient marki | `.text-liquid`, `DocGradient.tsx` | `Color.gradientMarki`, `IkonyMarki` |
| Mapy status → kolor | `lib/<moduł>.ts` | `*View.swift` (kolorStatusu…) |
| Menu kontekstowe | `admin/Menu.tsx` (`useContextMenu`) | `.contextMenu` |
| Płyty i sekcje profilu | `.card-paper`, `.card-inset`, `ProfileSection.tsx` | `List(.insetGrouped)` |
| Zakładki | `ViewTabs` | `PigulkaZakladek.swift` |
| Ruch | `lib/motion.ts` | `Ruch.swift` |
| Okna dialogowe | `useUI()` | `.alert` / `.confirmationDialog` |
| Ścieżka dokumentów | `SciezkaDokumentow.tsx`, `MiniSciezka.tsx` | `DrzewkoSciezki.swift` |
| Puste stany | wzorzec A1 | `ContentUnavailableView` |

## Zasady pracy przy tym przeglądzie

1. **Nie „przy okazji".** Poprawka wzorca idzie przez wszystkie moduły w tym
   samym commicie albo nie idzie wcale.
2. **Najpierw inwentarz, potem naprawy.** Cała tabela wypełniona, dopiero
   potem kod — inaczej pierwszy moduł zje cały czas.
3. **Nowy wzorzec = wpis w `HUB_SETUP.md`** z powodem.
4. **Zmiana globalna wymaga pomiaru przed i po** (kontrast, rytm, szerokość).
5. Po każdej paczce: `npx tsc --noEmit`, `npm test`, `xcodebuild`, zrzuty
   z symulatora, dopiero potem commit i wgranie na urządzenia.

---

## Paczka „Pulpit" — wykonana 2026-07-28

**Definicja „gotowe" ustalona PRZED kodem** (żeby nie dało się jej naciągnąć
po fakcie): każda sekcja ma widoczną płytę · kontrast zmierzony
`getComputedStyle` + wzór WCAG, płyta ≥ 1,10 wobec podłoża · wartości w JEDNYM
miejscu w `globals.css` · kafle KPI, pasy alarmowe i sekcje czytają się jako
trzy warstwy, nie szachownica · zero regresji poza Pulpitem, sprawdzone
pomiarem na drugim module · `tsc` i `npm test` czyste.

### Pomiar przed → po

| element | przed | po | próg |
|---|---|---|---|
| płyta sekcji wobec tła panelu | **1,032** | **1,25** | ≥ 1,10 |
| krawędź płyty wobec płyty | 1,186 | 1,359 | ≥ 1,35 (płyta wypukła) |
| krawędź zagnieżdżona (przycisk, pigułka) wobec podłoża | **1,022** (znikała) | 1,359 | ≥ 1,35 |
| wgłębienie szkicu wobec płyty | brak tła | 1,25 | ≥ 1,10 |
| tekst `--fg-muted` wobec płyty | 5,94 | 4,91 | ≥ 4,5 (WCAG AA) |

Zmiana: `--plyta` / `--plyta-krawedz` w `.admin-linear` + klasa
`.plyta-sekcji`; `.card-inset` przeszedł na te same zmienne **bez zmiany
wartości** (zweryfikowane na profilu leada: `rgb(30,34,42)` / `rgb(51,56,68)`
przed i po). 21 kafli i sekcji Pulpitu. Kanban bez zmian (kolumna 1,10,
krawędź 1,695, karta 1,136 wobec kolumny). Szczegóły wzorca i **dwa różne
progi krawędzi** (wypukła vs zagłębienie): `HUB_SETUP.md` → „trzy warstwy
powierzchni".

### Co wyszło przy okazji i zostało naprawione w tej samej paczce

- **Szkielet ładowania** miał jasność obramowania, nie płyty — po wczytaniu
  treść skakała o 20 punktów jasności w górę.
- **`items-start` na siatce sekcji** — bez tego pusta sekcja rozciągała się do
  wysokości sąsiada, czyli rozmiar płyty niósł znaczenie, którego nie ma.

### ZNALEZIONE POZA ZAKRESEM — do backlogu, NIE naprawiane tutaj

1. **`.card-inset` nie nadpisuje `--hairline`** — dokładnie ta sama pułapka,
   którą Pulpit właśnie zamknął, tylko w profilach. Zmierzone na profilu
   leada: **14 krawędzi wewnątrz płyt ma kontrast 1,022**, czyli jest
   niewidocznych. To nie są drobiazgi — wśród nich są **linie rozdzielające
   wiersze pól** („Email", „WWW", „LinkedIn", „Kod / Miasto", „Kraj"), czyli
   to, co ma robić rytm listy `insetGrouped`. Poprawka to jedna linia
   (`--hairline: var(--plyta-krawedz)` w `.card-inset`), ale dotyka profilu
   leada, klienta, oferty i umowy naraz — **idzie razem z paczką F**, nie
   osobno (zasada 1: poprawka wzorca przez wszystkie moduły w jednym commicie).

2. **Pasy alarmowe Pulpitu (kopie zapasowe, automaty) zostały na starej
   warstwie** — `bg-brand-gold/10` + `border hairline` na tle panelu.
   ŚWIADOMIE: to nie jest sekcja treści, tylko alarm, i ma się różnić od płyt.
   Zapisane, żeby przy paczce F ktoś tego nie „ujednolicił".

### Poza przeglądem spójności — złapane przy starcie

**Panel się nie budował.** Commit `68f26a7` („Gradient w sidebarze zostaje")
zostawił w `app/globals.css` **niedomknięty komentarz**: jedno `*/` w środku
akapitu, cztery linie sierocego tekstu i drugie `*/` na końcu. Turbopack
zwracał `Parsing CSS source code failed`, cała strona szła na 500 — panel
i strona publiczna, lokalnie i na Vercelu. Naprawione w tej paczce.

**Lekcja: commit z samym komentarzem też trzeba uruchomić.** Zmiana była
w 100 % opisowa — ani jednej deklaracji CSS — więc nikt jej nie sprawdził,
a `npx tsc --noEmit` (jedyna weryfikacja, jaką ten projekt ma w sandboksie)
**nie widzi CSS-a w ogóle**. Po każdej zmianie w `globals.css`, choćby
kosmetycznej, załaduj `/pl/admin` w podglądzie.

---

## Paczka „F" — etykietowane wiersze profilu, wykonana 2026-07-28

**Definicja „gotowe" ustalona PRZED kodem:** każdy profil rekordu pokazuje pola
przez `SekcjaProfilu`/`WierszPola` · zero lokalnych kopii wiersza „etykieta —
wartość" w panelu · kreski wewnątrz płyt zmierzone ≥ 1,35 wobec płyty ·
rytm wierszy bez skoków (rozrzut wysokości < 10 px) · granica „profil vs
formularz" zapisana w `HUB_SETUP.md` z powodem · zero regresji w Leadach,
Klientach, Ofertach i Umowach, sprawdzone pomiarem · `tsc` i `npm test` czyste.

### Co zostało zamienione

Sześć własnych wersji tego samego wiersza, każda z innego modułu:

| moduł | plik | co było |
|---|---|---|
| Projekty | `ProjectDetailPanel.tsx` | `MetaRow` — ikona + nazwa, płasko na karcie, bez płyty i bez kresek |
| Faktury | `InvoiceEditor.tsx` | `Field` (96 px, bez ikony) + trzy karty `card-paper` z własnym `h3` |
| Koszty | `CostEditor.tsx` | siatka dwukolumnowa, etykieta NAD polem |
| Przypomnienia | `ReminderDetail.tsx` | `Pole` — etykieta kapitalikami NAD wartością |
| Notatnik | `NoteDetailPanel.tsx` | siatka 2×1, etykieta NAD wartością |
| Ustawienia sprzedawcy | `CompanySettingsPanel.tsx` | `SField` — etykieta NAD polem |

`MetaRow` i `Pole` **usunięte**. `Field` i `SField` zostały jako cienkie aliasy
`WierszPola` — mają po kilkanaście wywołań, a zmiana nazwy dodałaby dyf bez
wartości. `POLE_PROFILU` w `icons.tsx` urosło z 14 do 60 pozycji (klucz = etykieta
z ekranu; pole spoza mapy renderuje się bez ikony, nie pusto).

### Pomiar przed → po

| element | przed | po | próg |
|---|---|---|---|
| kreski między wierszami pól (profil leada, 14 krawędzi) | **1,022** | **1,359** | ≥ 1,35 |
| płyta sekcji wobec karty profilu | 1,21 | 1,21 (bez zmian) | ≥ 1,10 |
| rozrzut wysokości wierszy (profil kosztu) | — | 38–43 px | < 10 px |

Zmiana krawędzi to **jedna linia** — `--hairline: var(--plyta-krawedz)`
w `.card-inset` — czyli dokładnie ta poprawka, którą Paczka Pulpit odłożyła do
backlogu (punkt 1). Wartości samej płyty NIE ruszone: `rgb(30,34,42)` /
`rgb(51,56,68)` przed i po.

### Granica „profil vs formularz" — postawiona i ZNIESIONA tego samego dnia

Backlog mówił „11 modułów bez wierszy". Po obejrzeniu każdego okazało się, że
lista miesza dwie różne rzeczy, i **pięć z nich to nie są profile**:

- **formularze TWORZENIA z „Anuluj / Zapisz"** — nowy komponent katalogu, nowe
  i edytowane polowanie łowcy, `AddEventForm` kalendarza,
- **kalkulator** (wprowadzanie danych do wyliczenia, nie rekord),
- **Poczta** — `MailDetailPanel` to czytnik wiadomości w układzie Apple Mail,
  a nie lista atrybutów.

Powód nie jest kosmetyczny: formularze mają podpowiedzi pod polami, `autoFocus`,
pary pól w jednym rzędzie i walidację przed zapisem — czyli wszystko, czego
wiersz o stałej wysokości nie mieści. Apka rozdziela to tak samo (`List` dla
profilu, `Form` dla arkusza „nowy"). Reguła i test rozstrzygający („czy zapis
idzie na blur, czy dopiero po kliknięciu Zapisz?") są w `HUB_SETUP.md` →
„Moduł 59, paczka F". **Jeśli właściciel uzna, że formularze też mają wyglądać
jak profil — to jest osobna decyzja i osobna paczka, nie przeoczenie.**

### Co wyszło przy okazji i zostało naprawione w tej samej paczce

- **Podpowiedź terminu projektu** („za 3 dni") stała drugą linijką pod polem dat
  i rozdymała wiersz — przeszła na `sufiks`.
- **Skróty terminu płatności faktury** (7/14/30 dni) miały wcięcie 104 px pod
  starą, węższą etykietę — po ujednoliceniu wisiałyby w połowie nazwy. Teraz
  129 px (118 etykiety + 8 odstępu) i zawijają się całymi przyciskami.
- **Pasy ostrzegawcze w Kosztach** (Biała Lista MF, próg amortyzacji) stały pod
  polem — teraz są własnym wierszem sekcji, bez etykiety.

### Wciąż otwarte z pierwotnego planu

| paczka | zakres | skala |
|---|---|---|
| ~~**E**~~ | ~~puste stany · nazwy zakładek · adresy rekordów~~ — **ZROBIONE 29.07**, patrz „Paczka E" niżej | — |
| ~~**C**~~ | ~~klawiatura~~ — **ZROBIONE 29.07**, patrz „Paczka C" na dole | — |
| ~~**G**~~ | ~~kierunek swipe'a w apce · miejsce „+" w panelu~~ — **ZROBIONE 31.07**, patrz „Paczka G" na dole | — |

**Apka nie była w zakresie tej paczki** — jej ekrany profili od początku stoją
na `List(.insetGrouped)`, czyli na wzorcu, do którego panel się właśnie
dociągnął. To była różnica panel→apka, nie apka→panel.

---

## Paczka „F+" — formularze dostają ten sam wiersz (2026-07-29)

Bezpośrednia decyzja właściciela po obejrzeniu paczki F: *„chcę, żeby wyglądały
jak te moduły, które już poszerzaliśmy, ma być spójne"*. Granica „profil vs
formularz" z paczki F **przestała obowiązywać** — powód i lekcja wyżej.

### Przerobione (11 miejsc, jeden commit)

| moduł | miejsce | co było |
|---|---|---|
| Leady | okno „Nowy lead" | etykieta nad polem; kategoria źródła jako rozsypane pigułki |
| Klienci | okno „Nowy klient" | jw. + siatka 2-kolumnowa |
| Klienci | formularz osoby kontaktowej | **żadnych etykiet** — tylko placeholdery |
| Katalog | nowy/edytowany komponent | etykieta nad polem, hinty pod polem |
| Kalkulator | cała ankieta (10 pól) | własne `Sekcja` + `Pole` |
| Kalendarz | `AddEventForm` | **żadnych etykiet** — znaczenie tylko w tooltipie |
| Łowca | nowe polowanie + edycja | etykieta nad polem, trójkolumnowa siatka |
| Łowca | wyszukiwarka firm (`DiscoverPanel`) | pasek trzech kontrolek |
| Faktury | szablony cykliczne | własny `TField` (96 px, bez kreski) |
| Koszty | szablony cykliczne | jw. |
| Oferty | szablony ofert | jw. |

Kategoria źródła w „Nowym leadzie" i „Nowym kliencie" to teraz ten sam
`PillPicker`, co pole „Skąd przyszedł" w profilu — wcześniej **to samo pole
miało dwie różne kontrolki** zależnie od tego, czy rekord się tworzyło, czy
poprawiało.

### Co wyszło przy okazji

- **Formularz osoby kontaktowej nazywał pola wyłącznie placeholderem** — nazwa
  pola znikała w chwili, gdy coś w nim wpisano (łamie punkt 7 listy kontrolnej,
  „placeholder nie zastępuje etykiety"). To nie był problem estetyczny: przy
  wypełnionym formularzu nie dało się sprawdzić, co jest czym.
- **`AddEventForm` kalendarza nie miał ANI JEDNEJ etykiety** — „godzina", „czas
  trwania", „wielodniowe" tłumaczyły się tylko po najechaniu myszą. Na iPadzie
  z palcem tooltipa nie ma.
- **`CyklPicker` mówił „Powtarzaj:" własną etykietą** — w wierszu o etykiecie
  „Powtarzanie" to samo słowo padało dwa razy obok siebie. Stąd
  `wlasnaEtykieta={false}`.
- **`WierszUwaga` wylądował we wspólnym pliku** — w paczce F napisałem tę samą
  rzecz lokalnie dwa razy w jeden wieczór (Przypomnienia, Koszty), czyli
  powtórzyłem błąd, który ten moduł sprząta.

### Pomiar

Etykiety mierzone `scrollWidth > clientWidth` na każdej przerobionej stronie —
dwie za długie na kolumnę 118 px („Szczyt równoczesnych", „Tryb pracy /
krytyczność”) skrócone, pełne znaczenie zeszło do `title`. Rytm wierszy po
zmianie: **38–43 px** na wszystkich sprawdzonych formularzach (próg: rozrzut
< 10 px). `tsc` i `npm test` (141) czyste.

### Kompozytor poczty — wersja pośrednia (domknięte 29.07)

Zapytany „ujednolicić czy zostawić", policzyłem najpierw szerokości — i **mój
własny argument okazał się nieprawdziwy**: okno pisania ma `max-w-4xl` (~830 px
treści), więc kolumna 118 px to 14 %, a nie „zabranie miejsca adresom".
Prawdziwy powód jest inny i on się broni: **pole odbiorcy rośnie w pionie**
(adresy to pigułki, które zawijają się na kolejne linijki), a `WierszPola` ma
z definicji stałą wysokość.

Stąd wersja pośrednia: pola „Do", „DW", „UDW", „Temat" **nie** idą przez
`WierszPola`, ale biorą jego geometrię — kolumna 118 px, pismo 11,5 px, ikona
z `POLE_PROFILU` (`Do`→wysyłka, `DW`→ludzie, `UDW`→kłódka, `Temat`→wiadomość).
Dwukropki zniknęły: kolumna i ikona niosą teraz to, co niósł dwukropek.

Zmierzone po zmianie: wszystkie cztery etykiety mają **118 px** i **11,5 px**
pisma, kolumna wartości zaczyna się w tym samym miejscu (363 px), żadna
etykieta się nie ucina. Okno wygląda jak reszta panelu, a zachowuje zawijanie
adresów, którego wiersz profilu by nie udźwignął.

**Lekcja: argument „nie ma miejsca" trzeba zmierzyć, zanim się go użyje.**
Ten sam błąd co przy granicy „profil vs formularz" — uzasadnienie brzmiało
sensownie i było nieprawdziwe.

---

## Paczka „E" — puste stany, adresy rekordów, nazwy zakładek (2026-07-29)

**Definicja „gotowe" ustalona PRZED kodem:** każdy ekran listy rozróżnia trzy
sytuacje (pusto naprawdę / nic nie pasuje do filtra / nie udało się wczytać) ·
żaden szkielet ładowania nie pulsuje w nieskończoność po awarii · cztery moduły
bez adresu rekordu (Koszty, Przypomnienia, Katalog, Kalendarz) dostają
`/<moduł>/<id>` i podstrona renderuje TEN SAM komponent, co modal · zakładki
profilu nazwane jak w apce · kontrasty zmierzone, nie ocenione · `tsc` i
`npm test` czyste · każdy ekran obejrzany w awarii, nie tylko w kodzie.

### E1 — trzeci wariant pustego stanu (13 modułów)

Panel nie miał go **nigdzie**. Wzorzec `fetch → if 401 reload → res.json()`
bez `catch` powtarzał się w każdym dashboardzie, więc zerwana sieć albo 500
dawały jeden z dwóch fałszywych ekranów:

| moduł | co pokazywał przy awarii | co pokazuje teraz |
|---|---|---|
| Leady, Klienci | „Brak leadów/klientów pasujących do filtrów" — **przy zerowej bazie i zerowych filtrach też** | trzy osobne komunikaty |
| Koszty, Projekty, Notatnik, Klienci, Leady, Oferty, Umowy, Faktury, Poczta | szkielet pulsujący bez końca | `StanBledu` z „Spróbuj ponownie" |
| Katalog | „Wczytuję…" bez końca | jw. |
| Kalendarz | **pusty miesiąc** — czyli „nic nie zaplanowano" | `PasekBledu` nad siatką, siatka zostaje użyteczna |
| Poczta | tylko toast (znika po chwili), potem pusty folder | `PasekBledu` nad listą |
| Statystyki | goły czerwony akapit, bez drogi wyjścia | `StanBledu` |
| Pulpit | własna forma tego samego komunikatu | `StanBledu` (jedna forma w całym panelu) |

Nowe wspólne części: `admin/dane.ts` (`pobierzJSON`, `komunikatBledu`,
`BladPanelu`, `SesjaWygasla`) i `admin/StanPusty.tsx` (`StanPusty`,
`StanListy`, `StanBledu`, `PasekBledu`). Reguła i uzasadnienie:
`HUB_SETUP.md` → „Moduł 59, paczka E".

**Czerwień świadomie NIE użyta na awarii wczytania** (kat. 1 listy kontrolnej:
czerwień = błąd i akcja niszcząca). Nieudane wczytanie niczego nie niszczy —
dostaje neutralną ikonę wtyczki i przycisk powtórzenia. Statystyki miały tu
czerwony akapit; zabrany.

### E2 — adresy rekordów (4 moduły)

| moduł | adres | nowy uchwyt HTTP |
|---|---|---|
| Koszty | `/admin/costs/<id>` | — (`GET` już był) |
| Przypomnienia | `/admin/reminders/<id>` | `GET /api/reminders/:id` |
| Katalog | `/admin/catalog/<id>` | `GET /api/catalog/:id` |
| Kalendarz | `/admin/calendar/<id>` | `GET /api/events/:id` |

Trzy pułapki, na które warto uważać przy następnym takim module:

1. **Wydarzenie serii nie ma prostego id.** `GET /api/events/:id` musi
   przyjąć `<id-wzorca>~<data>` i zwrócić wzorzec **z datą tego wystąpienia** —
   inaczej link do „spotkania w środę" otwiera pierwszy termin serii sprzed
   pół roku. W linku `encodeURIComponent`.
2. **404 to czwarty komunikat, nie trzeci.** Usunięty rekord nie naprawi się
   przyciskiem „Spróbuj ponownie" — stąd osobne „Nie ma takiego…". Odróżnia je
   `BladPanelu.status`.
3. **Podzadania.** Lista przypomnień pokazuje je z wcięciem pod rodzicem, więc
   podstrona rodzica musi je pokazać też — inaczej ten sam rekord ma dwa różne
   zestawy treści zależnie od drogi wejścia.

Katalog był jedynym modułem, w którym rekord **nie miał profilu w ogóle** —
istniał jako wiersz listy i formularz edycji. Widok czytania idzie przez
`SekcjaProfilu`/`WierszPola` (paczka F), a edycję otwiera dokładnie ten sam
formularz, co lista.

### E3 — nazwy zakładek

Panel: „Historia kontaktu" / „Logi zmian" / „Powiązane" → **„Historia" /
„Logi" / „Dokumenty"**, w kolejności apki. Szczegóły i powód (dlaczego brak
„Wizytówki" i „Akcji" w panelu NIE jest rozjazdem): `HUB_SETUP.md`.

### Pomiar

| element | zmierzone | próg |
|---|---|---|
| tytuł pustego stanu wobec karty | **18,15** | ≥ 4,5 (WCAG AA) |
| opis pustego stanu (12,5 px, `text-muted`) | **5,94** | ≥ 4,5 |
| `PasekBledu` wobec tła panelu | 1,077 → **1,169** | ≥ 1,10 |
| tekst na pasku | **16,0** | ≥ 4,5 |

### Jak zweryfikowano

Podmiana `window.fetch` w podglądzie na odrzucającą żądania danego modułu, po
jednym module — czyli **prawdziwa ścieżka awarii**, nie ustawienie stanu
z palca. Obejrzane w awarii: Klienci (zrzut), Przypomnienia (zrzut), Kalendarz
(zrzut + pomiar kontrastu paska). Wariant „nic nie pasuje do filtra"
sprawdzony na Leadach frazą bez trafień (zrzut). Wszystkie 13 modułów
przeklikane po kolei z podpiętym `window.onerror` i `unhandledrejection` —
**zero błędów wykonania**. Nowe trasy `GET` sprawdzone `curl`-em po jednym
uchwycie, razem z odpowiedzią 404. Podstrony obejrzane zrzutem: Katalog,
Kalendarz, Koszty, Przypomnienia (w tym z podzadaniem) i wariant „nie ma
takiego rekordu".

**Złapane przy okazji: `tsc` nie widzi tego, co widzi Turbopack.** Pierwsza
wersja pustego stanu Kanbanu w Leadach miała ternary zagnieżdżony w gałęzi
innego ternary — `npx tsc --noEmit` przeszedł **czysto**, a SWC odrzucił plik
(`Not a pattern`) i cały moduł szedł na 500. Wyszło to dopiero po załadowaniu
strony w podglądzie. Ta sama lekcja, co przy niedomkniętym komentarzu w
`globals.css` (paczka Pulpit): **jedyna weryfikacja tego środowiska nie jest
pełna — po każdej paczce załaduj ekran, którego dotknąłeś.**

---

## Paczka „C" — klawiatura, wykonana 2026-07-29

**Definicja „gotowe" ustalona PRZED kodem:** jeden hook obsługuje `/`, `j/k`,
`Enter` i `Esc` w KAŻDYM module z listą · zero lokalnych kopii tej obsługi ·
kursor przewija się do widoku · kursor i zaznaczenie do akcji zbiorczej
wyglądają RÓŻNIE · cztery moduły bez pola szukania je dostają · pole stoi w tym
samym miejscu we wszystkich modułach · każdy skrót sprawdzony na żywo
(zdarzenie klawiatury → stan DOM), nie tylko w kodzie · `tsc`, `npm test`
i załadowanie każdego dotkniętego ekranu czyste.

### Co zastąpiono

| moduł | co było |
|---|---|
| Leady, Klienci | `/` + `j/k` + `Enter`, kursor rysowany **tłem** — tym samym, co zaznaczenie checkboxem |
| Oferty, Umowy | to samo, ale z własnym rozpoznawaniem „czy piszę w polu" i z Esc czyszczącym frazę |
| Poczta | `j/k` + `Enter` + własne przewijanie po `data-idx`, obrys w 40 % zamiast 60 % |
| Projekty | tylko cyfry statusu przy otwartym profilu — ani `/`, ani `j/k` |
| Faktury, Koszty, Katalog, Przypomnienia | **nic** — i żadnego pola szukania |
| Notatnik | pole szukania było, klawiatury nie |
| Kalendarz | nic (świadomie zostaje bez `/` i `j/k` — patrz `HUB_SETUP.md`) |

Nowe wspólne części: `admin/klawiatura.ts` (`useSkrotyListy`, `KLASA_KURSORA`)
i `admin/PoleSzukania.tsx`. Reguła, kontrakt klawiszy i uzasadnienie miejsca
pola: `HUB_SETUP.md` → „Moduł 59, paczka C".

### Co wyszło przy okazji i zostało naprawione w tej samej paczce

1. **86 klas Tailwinda w panelu nie generowało ŻADNEJ reguły** — każda postać
   `…-[var(--token)]/krycie`. Wśród nich podświetlenie wiersza pod myszą
   w każdej tabeli, tło zaznaczonego wiersza i obrys kursora, który spadał na
   domyślny błękit Tailwinda. Pełny opis, pomiar i reguła na przyszłość:
   `HUB_SETUP.md` → „klasa z kryciem na zmiennej CSS NIE ISTNIEJE".
2. **Cyfra statusu w Leadach i Klientach trafiała w pierwszy wiersz listy**,
   choć nikt go nie wskazał — kursor był „na zerze" od wejścia na ekran.
   Teraz cyfra działa tylko przy widocznym kursorze.
3. **Pole szukania rejestru leadów stało widoczne w zakładce „Kandydaci"**,
   gdzie nie zawężało niczego (martwa afordancja, kategoria 2). Schowane.
4. **Krzyżyk czyszczący frazę** miała jedna Poczta — teraz ma go każdy moduł,
   bo `Esc` to jedyne wyjście dla kogoś, kto zna skrót.

### Apka — ⌘F/⌘N na siedmiu brakujących ekranach

| ekran | co dostał |
|---|---|
| Oferty (iPhone) | pole szukania (tytuł, klient) + ⌘F |
| Oferty (iPad, `OfertyPanelIpad`) | ⌘F — pole stało tam od Fazy 9, ale skrót do niego nie prowadził; jedyny z czterech paneli iPada bez tego podpięcia |
| Umowy | pole szukania (strona, zakres prac) + ⌘F |
| Faktury | pole szukania (numer, klient) + ⌘F |
| Koszty | pole szukania (dostawca, opis, projekt) + ⌘F, ⌘N = aparat („nowy koszt" na telefonie znaczy „zrób zdjęcie paragonu") |
| Katalog | pole szukania (nazwa, opis, dostawca) + ⌘F + ⌘N |
| Przypomnienia | pole szukania (tytuł, notatka, także w podzadaniach) + ⌘F + ⌘N (kursor w polu „Co masz zrobić?") |

Oferty, Umowy i Faktury świadomie **bez ⌘N**: te dokumenty zakłada się przy
biurku (poziom 3 z planu apki) — skrót otwierałby coś, czego na telefonie nie
ma. Kalendarz bez pola szukania, tak samo jak w panelu.

Przy okazji: **Koszty pokazywały sztywno 30 ostatnich pozycji** i nie dało się
w nich niczego znaleźć — a „czy już to wpisałem?" jest jedynym powodem, dla
którego patrzy się na tę listę. Przy wpisanej frazie sufit znika. Koszty
i Przypomnienia dostały też **czwarty wariant pustego stanu** („nic nie pasuje
do frazy") — bez niego fraza bez trafień dawała pusty ekran bez słowa, czyli
to samo kłamstwo, które paczka E naprawiała w panelu.

**Apka zweryfikowana kompilacją i zgodnością ze wzorcem, nie zrzutem.**
`xcodebuild` przechodzi, a wszystkie siedem ekranów używa dokładnie tych samych
`skrotSzukaj`/`skrotSzukajINowy`, co siedem ekranów, na których skrót już
działa. Zrzutu z symulatora NIE ma, bo build Debug apki rozmawia z produkcją
i wchodzi przez ekran logowania hasłem właściciela — nie mam go i nie powinienem
go mieć. To jedyna część tej paczki bez dowodu na żywo; **właściciel powinien
sprawdzić te siedem ekranów na urządzeniu**.

### Korekta do inwentarza z Etapu 1

**„⌘N/⌘F w apce — dziś tylko Poczta" było nieprawdą.** Skróty miały już
Pulpit, Poczta, Leady (iPhone i iPad), Klienci (iPad), Projekty (iPhone
i iPad) i Notatnik — siedem ekranów, nie jeden. Brakowało ich w Ofertach,
Umowach, Fakturach, Kosztach, Katalogu, Przypomnieniach i Kalendarzu, czyli
dokładnie tam, gdzie w apce nie ma też pola szukania.

### Jak zweryfikowano

Każdy skrót wywołany jako prawdziwe zdarzenie klawiatury w podglądzie i
sprawdzony po stanie DOM, nie po zrzucie: `/` → który element ma fokus;
wpisana fraza → ile wierszy zostało; `Esc` → czy fraza pusta i czy fokus
wrócił; `j`/`k` → który wiersz ma `data-kursor`; `Enter` → czy otworzył się
modal. Przeklikane po kolei wszystkie 11 modułów z podpiętym `window.onerror`
i `unhandledrejection` — **zero błędów wykonania**, każdy ma pole szukania
(Kalendarz świadomie nie).

**Uwaga na artefakt narzędzia:** karta podglądu jest `document.hidden`, więc
`requestAnimationFrame` nie tyka i **przejścia CSS nigdy się nie kończą** —
`getComputedStyle` na elemencie z `transition-colors` zwraca wartość
POCZĄTKOWĄ. Przez to poprawnie działające tło zaznaczenia mierzyło się jako
`rgba(0,0,0,0)`. Rozstrzyga klon elementu (`cloneNode`) albo świeżo wstawiona
próbka — na nich żadne przejście nie trwa.

---

## Paczka „G" — kierunek gestu w apce, miejsce „+" w panelu (2026-07-31)

Ostatnia paczka z planu. **Definicja „gotowe" ustalona PRZED kodem:** żadna
akcja pozytywna nie zostaje po stronie usuwania · to samo słowo znaczy tę samą
stronę we WSZYSTKICH modułach, nie tylko w czterech z zakresu · „+" stoi w tym
samym rogu w każdym module, także w tych, które go nie miały · żaden „+" nie
otwiera czegoś, czego na danym ekranie nie ma · `tsc`, `npm test`, `xcodebuild`
i załadowanie każdego dotkniętego ekranu czyste.

### Rozjazd był większy niż zakres z planu

Plan mówił „Oferty, Umowy, Faktury, Koszty". Po przejrzeniu **wszystkich 40
gestów w apce** okazało się, że problem nie kończy się na dokumentach:

- **„Obsłużone" miało dwie strony naraz** — gest w prawo w Poczcie, gest
  w lewo w Leadach, Klientach i na Pulpicie (6 miejsc). Lista kontrolna
  (kat. 3) mówiła „w prawo" od pierwszego dnia; kod robił odwrotnie w 11 z 13
  miejsc.
- **Wysyłka dokumentu i przypomnienie o płatności** stały po stronie
  odrzucania i usuwania (Oferty ×2, Umowy, Faktury, Pulpit ×3).
- **Koszty** — „Opłacony" po stronie kasowania.

Zasada 1 tego dokumentu („poprawka idzie przez wszystkie moduły w jednym
commicie") kazała ruszyć wszystko naraz: **9 plików apki**.

### Decyzja właściciela (2026-07-31)

Zapytany wprost, wybrał wariant zgodny z listą kontrolną: **w prawo = ruch do
przodu ALBO pomyślne domknięcie, w lewo = wyłącznie „od siebie"** — świadomie
kosztem codziennego odruchu w Leadach i na Pulpicie. Rozstrzygający argument:
pełne przeciągnięcie odpala pierwszy przycisk krawędzi, więc dopóki
„Obsłużone" sąsiadowało z „Usuń", ten sam odruch znaczył co innego w każdym
module. Reguła, tabela stron i powód: `HUB_SETUP.md` → „Moduł 59, paczka G".

### „+" w panelu

| moduł | co było | skala |
|---|---|---|
| Notatnik, Kalendarz | **brak „+" w ogóle** — dodawanie tylko przez zauważenie pola w treści | 2 pliki |
| Przypomnienia | „+" w rogu dodawał **listę**, nie przypomnienie — jedyne takie miejsce w panelu | 1 plik |
| Katalog | „+" w rogu wyśrodkowanej kolumny, nie okna | 1 plik |

Katalog i Przypomnienia dostały przy okazji ten sam pasek 44 px, co reszta
panelu — więc i ich pole szukania stoi tam, gdzie każe paczka C.

### Co wyszło przy okazji i zostało naprawione w tej samej paczce

1. **`Cmd+K → „+ Nowe wydarzenie" nie robiło NIC** poza widokiem dnia — pole
   istnieje wyłącznie tam, więc `newTitleRef.current?.focus()` cicho milczał
   w miesiącu, tygodniu i roku. Martwa pozycja palety, kategoria 2.
2. **Faktura miała gest wykluczający się sam z sobą** — „Przypomnij" i „Oznacz
   opłaconą" siedziały w jednym `if/else`, więc jedno chowało drugie i na
   fakturze po terminie nie dało się odhaczyć płatności gestem. Gest zmieniał
   kształt przy każdym wierszu (łamał kat. 3: „niedostępne wyszarzone, nie
   ukryte"). Rozdzielone po zgłoszeniu właściciela z urządzenia („faktury tylko
   w prawo Przypomnij").
3. **Katalog i Przypomnienia przewijały cały ekran razem z nagłówkiem**, więc
   ich „+" znikał po pierwszym obrocie kółka — „w tym samym rogu" obowiązywało
   tylko na pozycji zerowej.

### Znalezione na urządzeniu — dwa kafle obok siebie

Test na iPhonie (31.07, build wgrany kablem) wyłapał usterkę, **której ta
paczka sama nie dotknęła, a jednak ją stworzyła**: odkąd „Zadzwoń" i
„Obsłużone" stoją po tej samej stronie, są to dwa prawie identyczne zielone
kafle — bo obie akcje są pozytywne, a `sukces` i `zrobione` to celowo ta sama
zieleń (ujednolicone 2026-07-20).

Rozwiązanie właściciela — jego pomysł, lepszy niż moja pierwsza propozycja
(„dołóżmy ikonę"): **kolor zostaje w słowniku, różnicę niesie hierarchia** —
pierwszy plan wypełniony, drugi przygaszony i z ikoną konturową. Mówi to nie
tylko ŻE akcje są różne, ale i KTÓRA jest ważniejsza. Reguła, tabela planów
i kiedy jej NIE stosować: `HUB_SETUP.md` → „Dwa kafle na jednej krawędzi".

Przy okazji wyszło, że **wypełniony kafel nie był tym, co odpala pełne
przeciągnięcie** — SwiftUI uruchamia pierwszy przycisk krawędzi, a „Zadzwoń"
stał w kodzie pierwszy, czyli wygląd kłamał o zachowaniu. Kolejność
zamieniona: pełny gest w prawo na leadzie i kliencie oznacza teraz
„Obsłużone" (decyzja właściciela 2026-07-31).

### Trzy zgłoszenia z urządzenia, które NIE były usterkami kodu

Właściciel przeszedł listę na iPhonie i iPadzie i zgłosił trzy braki. Po
sprawdzeniu **własnym palcem na symulatorze** (patrz niżej) okazało się, że
kod działa we wszystkich trzech, a różnica siedziała w danych albo w wersji
buildu:

| zgłoszenie | co jest naprawdę |
|---|---|
| „na Pulpicie nie da się wykonać tego gestu w ogóle" | działa — gest odhaczył wiersz, licznik zjechał 18 → 17. Gestu nie mają: pas „Nadzór", kafel licznika i „Ostatnie notatki"; „Dziś w kalendarzu" ma tylko w lewo |
| „Umowy tylko w prawo" | „Nie podpisali" pokazuje się **wyłącznie** dla umowy nie-podpisanej i nie-odrzuconej (`umowaStatusPozwala`) — zachowanie sprzed paczki |
| „na iPadzie w Leadach i Klientach nie ma gestu" | działa; po ponownym wgraniu buildu właściciel potwierdził. U Klientów wychodzi sam „Zadzwoń", gdy klient nie wymaga działania |

**Lekcja: kompilacja i grep nie widzą SĄSIEDZTWA.** Obie usterki były
niewidoczne w kodzie i w statycznym przeglądzie — powstały z układu, który
istnieje dopiero na ekranie, pod palcem.

### Pomiar

| element | zmierzone | próg |
|---|---|---|
| prawa krawędź „+" — Oferty (wzorzec) | **1416 px** | — |
| jw. — Katalog po zmianie | **1416 px** (przed: 1405, w kolumnie) | = wzorzec |
| jw. — Przypomnienia, Notatnik | **1416 px** | = wzorzec |
| jw. — Kalendarz | **1416 px**, `top` 70 zamiast 36 (pasek zawija się na dwa rzędy — świadomie) | = wzorzec w poziomie |
| akcje pozytywne po stronie usuwania (apka) | **12 → 0** | 0 |

### Jak zweryfikowano

Panel: każdy dotknięty ekran załadowany w podglądzie i sprawdzony po stanie
DOM, nie po zrzucie — „+" wywołany `click()`, po nim odczytany `activeElement`
(Notatnik → pole notatki, Przypomnienia → „Co masz zrobić?", Kalendarz → pole
wydarzenia). Menu pod „+" w Przypomnieniach rozwinięte i przeczytane po
treści pozycji. Skróty paczki C przetestowane po przeniesieniu pasków: `/`
ustawia kursor w polu, `j`/`k` przesuwają `data-kursor` w obie strony.
Wszystkie 12 modułów pobrane osobno — 200, zero śladów `__next_error__`.
Konsola bez błędów.

Apka: `xcodebuild` przechodzi, a **pełny grep po wszystkich 40 wywołaniach
`swipeActions`** pokazuje, że po stronie `trailing` nie została ani jedna
akcja pozytywna. **Sprawdzone też NA URZĄDZENIU** (31.07): build wgrany kablem
na iPhone'a i iPada, ekran podglądany przez lustro QuickTime, gesty wykonane
palcem przez właściciela. Tą drogą wyszły dwie usterki, których nie widać
w kodzie — patrz „Znalezione na urządzeniu" wyżej.

**Droga, której wcześniej nie używaliśmy — symulator na LOKALNYM panelu.**
Build Debug domyślnie gada z produkcją i zatrzymuje się na ekranie logowania,
dlatego paczka C zapisała „apka bez zrzutu". Obejście: `LEGGERA_DEV_BACKEND=lokalny`
(PGlite z danymi testowymi) plus token wydany curl-em z `POST /api/admin/login`
(body **musi** mieć pole `device`, inaczej trasa nie wydaje tokenu) podany jako
`SIMCTL_CHILD_LEGGERA_DEV_TOKEN`. W symulatorze narzędzia potrafią wykonać
PRAWDZIWY gest, więc swipe da się sprawdzić **bez palca właściciela** — i to
tam wyszło rozdzielenie gestu faktury. Fizyczne urządzenie zostaje do rzeczy,
których symulator nie odda: Face ID, Wyspa, aparat, prawdziwa skrzynka.

**Jak to ustawić następnym razem:** `xcrun xctrace list devices` po UDID (nie
`devicectl` — tam jest inny identyfikator), build z `-allowProvisioningUpdates`,
`devicectl device install app`, potem `process launch -e '{"LEGGERA_DEV_TAB":"leady"}'`.
Podgląd: QuickTime → Nowe nagranie filmowe → strzałka przy nagrywaniu → sekcja
**Ekran**. Lustro jest JEDNOKIERUNKOWE — kliknięcia przez nie nie przechodzą,
więc sam gest musi zrobić właściciel; wgranie, prowadzenie apki po ekranach
i odczyt wyniku idą bez niego.

### Artefakt narzędzia, na który warto uważać

Karta podglądu jest `document.hidden`, więc `requestAnimationFrame` **nie tyka
w ogóle** — zmierzone: **0 klatek w 600 ms**. Konsekwencja mocniejsza niż
zapisana w paczce C: `AnimatePresence mode="wait"` nigdy nie kończy wyjścia,
więc **przełączenie widoku Kalendarza jest w podglądzie nietestowalne**.
Ścieżkę „+ → widok dnia → kursor" sprawdzono, ustawiając na chwilę widok
startowy na „dzień" (zmiana cofnięta), a samą implementację przepisano tak,
żeby nie zależała od czasu przejścia.

### Stan planu

**Wszystkie paczki z Modułu 59 są zamknięte** (Pulpit, A, B, C, D, D+, E, F,
F+, G). Lista kontrolna na górze tego dokumentu zostaje jako narzędzie do
POWIELANIA przy każdym nowym module — nie jako zamknięte zadanie.
