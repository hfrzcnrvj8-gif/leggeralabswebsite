# Brief: Faza 13.3 #1 — postęp OCR (paragon i wizytówka) na Dynamic Island

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Repo panelu: `/Volumes/OWC_SN850X/projekty_ai/poltechnickx-website`.
> Jeden moduł na czat. To pierwszy element Fazy 13.3 z
> `13-brief-domkniecie-apki.md` — reszta (wysyłka maila z kolejki, logowanie
> rozmowy) to OSOBNE czaty, nie wciągaj ich tutaj.

## Zanim cokolwiek napiszesz

1. Przeczytaj `CLAUDE.md` i `README.md` apki.
2. Przeczytaj `13-brief-domkniecie-apki.md` → sekcja **„Faza 13.3"** (to źródło
   zakresu) i `12-brief-stoper-do-poprawki.md` (tam zbadane SUFITY platformy dla
   Live Activity — **nie walcz z nimi**).
3. Obejrzyj DZIAŁAJĄCĄ już infrastrukturę Live Activity, na której to stoi:
   - `Widzet/StoperWyspa.swift` — `ActivityAttributes` + widok Wyspy stopera,
   - `LeggeraHub/Views/StoperWyspaSterowanie.swift` — start/stop/aktualizacja
     aktywności z poziomu apki,
   - target `Widzet` w `project.yml` (+ `Widzet/Widzet.entitlements`,
     `Widzet/Info.plist`) — jak jest wpięty extension.
   Nowa aktywność OCR ma być **drugim typem `ActivityAttributes`** obok stopera,
   a nie przeróbką istniejącego — stoper musi działać dalej bez zmian.
4. Obejrzyj to, co domykasz — skaner, który właśnie powstał:
   - `LeggeraHub/Views/KosztZParagonuView.swift` (etap `.czytanie` = dziś pusty
     spinner „Czytam paragon…"),
   - `LeggeraHub/Views/SkanerWizytowkiView.swift` (etap `.czytanie` = „Czytam
     wizytówkę…"),
   - wywołania OCR: `AppStore.paragonNaKoszt` / `AppStore.skanujWizytowke`
     → `APIClient.odczytajParagon` / `APIClient.skanujWizytowke` (JEDNO żądanie
     HTTP, timeout 110 s).

## Co budujemy (zakres tego czatu)

Kiedy właściciel zrobi zdjęcie paragonu LUB wizytówki i model zaczyna czytać,
na Dynamic Island / ekranie blokady pojawia się Live Activity „Czytam
paragon/wizytówkę…", żeby właściciel mógł **wyjść z apki** (zablokować telefon,
przełączyć się) i nadal widzieć, że coś się dzieje — a po zakończeniu dostać
sygnał. Dziś odczyt to kilkadziesiąt sekund gapienia się w spinner.

## NAJPIERW zbadaj wykonalność (to nie jest formalność)

Wartość tej funkcji zależy od tego, czy **żądanie OCR przeżyje zejście apki w
tło**. Dziś to zwykłe `URLSession.shared`/`session.data(for:)` — iOS zawiesi je
po ~30 s w tle. Zanim zbudujesz UI, rozstrzygnij:

- Czy da się przenieść to jedno żądanie na **background `URLSession`**
  (`URLSessionConfiguration.background`), żeby dokończyło się, gdy apka jest w
  tle, i obudziło apkę wynikiem? To jest sedno — bez tego Wyspa pokaże „Czytam…"
  i zamrozi się, gdy iOS uśpi żądanie.
- Sprawdź na DARMOWYM koncie Apple (to samo ograniczenie co wszędzie — patrz
  `wgrywanie-na-telefon` w pamięci): background URLSession NIE wymaga płatnego
  konta ani push/APNs, więc powinno być dostępne — ale ZWERYFIKUJ, nie zakładaj.
- **Jeśli backgroundowanie okaże się niewykonalne/zawodne**: fallback to Live
  Activity działająca tylko dopóki apka żyje na pierwszym planie (i tak lepsze
  niż pusty spinner), a decyzję UDOKUMENTUJ w wyniku — nie udawaj, że działa
  w tle, jeśli nie działa (patrz `nieudane-proby-to-nie-dowod` w pamięci).

Rozstrzygnij to eksperymentem, a nie założeniem, i dopiero potem buduj resztę.

## Sufity platformy (zbadane, NIE walcz)

Z `live-activity-sufit-platformy` (pamięć) i `12-brief-stoper-do-poprawki.md`:
setnych sekundy nie pokażesz, ekran blokady gubi aktualizacje po ~kilku
minutach, iOS ubija aktywność po godzinach. OCR trwa kilkadziesiąt sekund, więc
te sufity akurat nie przeszkadzają — ale nie próbuj pokazywać płynnego licznika
co 10 ms ani trzymać aktywności „na zapas".

## Zasada przewodnia (właściciel)

Cztery filary: maksymalna automatyka, przypomnienia (nic nie ginie po cichu),
monitoring na żywo, wszystko związane z klientem/leadem trafia do historii
konta. Ta funkcja realizuje „monitoring na żywo" — właściciel widzi stan bez
wchodzenia w moduł. Model zawsze tylko PROPONUJE (OCR nic nie zapisuje sam);
Wyspa to sam podgląd postępu, nie akcja.

## Twarde ograniczenia tego środowiska

- **Telefon gada z PRODUKCJĄ.** Testując na telefonie: nic nie wysyłaj ani nie
  kasuj na prawdziwych danych. OCR na produkcji DZIAŁA (Vercel ma env Ollamy),
  więc realny odczyt sprawdzisz właśnie tam.
- **Symulator nie udowodni pełnej pętli.** `Aparat` na symulatorze spada na
  bibliotekę zdjęć i po wyborze zwija arkusz (artefakt, nie bug — patrz
  `apka-aparat-symulator-zwija-arkusz` w pamięci), a lokalnie nie ma Ollamy
  (dev zwraca 503). Live Activity na symulatorze DA się obejrzeć osobno
  (Dynamic Island renderuje się w symulatorze), ale połączenia „OCR → Wyspa"
  na żywo dowiedziesz dopiero na telefonie.
- **Nowy plik `LeggeraHub/Views/*.swift` czy w `Widzet/` NIE trafia do buildu
  bez `xcodegen generate`.** Info.plist jest GENEROWANY z `info:` w
  `project.yml` — nie edytuj Info.plist ręcznie.
- **Weryfikacja typów panelu**: `npx tsc --noEmit -p tsconfig.json` (pełny
  `next build` failuje EPERM w sandboxie). Build apki: `xcodebuild ... build`.
- Czytaj `route.ts` / realny kod, nie komentarze ani ten brief — jeśli coś się
  nie zgadza z kodem, wierz kodowi.

## Czego NIE ruszać

- Live Activity stopera (`StoperWyspa.swift`) — działa, dodajesz obok, nie
  przerabiasz.
- Pozostałych pozycji 13.3 (wysyłka maila z kolejki na Wyspie; „rozmowa z leadem
  → zaloguj") — osobne czaty.
- Poziomu 3 (faktury/KSeF/umowy) i całej reszty poza tym jednym elementem.

## Weryfikacja przed oddaniem

1. Build apki + `tsc` panelu czyste.
2. Live Activity OCR renderuje się (symulator: obejrzyj kompaktową i rozwiniętą
   Wyspę + ekran blokady; stan „czytam" i „gotowe/błąd").
3. Na telefonie (produkcja): zrób zdjęcie paragonu, ZEJDŹ z apki w tło, sprawdź
   czy Wyspa żyje i czy po zakończeniu OCR pokazuje wynik i wraca do formularza.
4. Stoper Live Activity nadal działa (regresja).
5. Podaj właścicielowi komendy `git commit && git push` (poprzedzone
   `rm -f .git/index.lock`) — osobno dla apki, osobno dla panelu, jeśli dotknąłeś
   obu.

## Po tym module

Zostają: 13.2 (CallerID, odpowiedź z powiadomienia, gesty — część zablokowana
darmowym kontem/brakiem push), reszta 13.3, potem **13.4 (audyt apki, dług A1 =
wspólne pole błędu)** i osobno `docs/AUDYTY-KONCOWE.md` (7 audytów całości,
obserwowalność pierwsza: ~90 `console.error`, zero testów).
