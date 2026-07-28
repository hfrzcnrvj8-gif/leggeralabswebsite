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
- [ ] **Swipe w prawo = akcja pozytywna/kontakt** (zadzwoń, obsłużone),
      **swipe w lewo = zamknięcie sprawy albo usunięcie.** Ta sama strona dla
      tego samego znaczenia we wszystkich modułach.
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
- [ ] „+" zawsze w tym samym rogu; szukanie zawsze w tym samym miejscu.
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

| Moduł | Kolor | Klikalność | Gesty/menu | Klawiatura | Nawigacja | Stany | Treść | Ruch | Integralność | Dotyk |
|---|---|---|---|---|---|---|---|---|---|---|
| Pulpit | | | | | | | | | | |
| Leady | | | | | | | | | | |
| Klienci | | | | | | | | | | |
| Oferty | | | | | | | | | | |
| Umowy | | | | | | | | | | |
| Projekty | | | | | | | | | | |
| Faktury | | | | | | | | | | |
| Katalog | | | | | | | | | | |
| Kalkulator | | | | | | | | | | |
| Koszty | | | | | | | | | | |
| Poczta | | | | | | | | | | |
| Kalendarz | | | | | | | | | | |
| Notatnik | | | | | | | | | | |
| Przypomnienia | | | | | | | | | | |
| Statystyki | | | | | | | | | | |

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
