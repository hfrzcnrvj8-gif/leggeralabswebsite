# Brief: Dynamic Island / Live Activity dla stopera (Faza 12)

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od `00-plan.md`,
> potem ten plik. Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Źródło ustaleń: `08-wynik-audytu-apki.md`, sekcje B1 i B2.

## Dlaczego teraz

Właściciel pytał o to dwa razy przy okazji poprawek stopera (2026-07-20).
Dziś chodzący stoper widać **wyłącznie przy otwartej apce** — pasek w chrome
i sekcja na Pulpicie. Live Activity pokazuje tykający czas na ekranie
zablokowanym i w Dynamic Island, bez otwierania apki wcale.

Audyt Fazy 11½ sprawdził wszystkie trzy obawy, które blokowały decyzję, i
**żadna się nie potwierdziła** (szczegóły niżej). To jest funkcja tania i
gotowa do wpięcia — dlatego idzie jako pierwsza z trójki po audycie.

## Decyzje właściciela — ROZSTRZYGNIĘTE, nie otwierać ponownie

1. **Live Activity dla stopera: TAK, budujemy.**
2. **Rozwinięta Wyspa ma DODATKOWO pokazywać drugą linią liczbę spraw
   czekających na Pulpicie** (`doZrobienia` z `PulpitDzis`). Właściciel wybrał
   to świadomie, akceptując, że widać to tylko wtedy, gdy stoper chodzi.
3. **Osobna, stale wisząca Live Activity dla samego Pulpitu: ODRZUCONA.**
   iOS ubija Live Activity po ~8 godzinach — to narzędzie do rzeczy o
   skończonym czasie, nie powierzchnia na stały wskaźnik. Rolę stałego
   licznika pełni **istniejący widżet ekranu głównego** (`Widzet.swift:44-66`,
   odświeżanie co 30 min z `GET /api/hub/today`). Nie proponować tego znowu.

## Co audyt już ustalił — NIE sprawdzaj tego drugi raz

- **Osobny target NIE jest potrzebny.** `Widzet` jest już typu
  `com.apple.widgetkit-extension` (`project.yml:44-73`) — dokładnie ten, w
  którym mieszka `ActivityConfiguration`. Trzeba zamienić `@main Widget` na
  `WidgetBundle` — ~6 linii w `Widzet/Widzet.swift:146`.
- **Płatne konto Apple NIE jest wymagane.** Lokalne Live Activity
  (`Activity.request()` / `.update()` z wnętrza apki) nie ma żadnego
  entitlementu. Wymagany jest tylko klucz **`NSSupportsLiveActivities`**
  w Info.plist **głównej apki** — dziś go brak, idzie przez
  `project.yml:31-38`. Płatne konto dotyczy wyłącznie zdalnej aktualizacji
  push-tokenem, której stoper nie potrzebuje.
- **Cykliczne `.update()` niepotrzebne.** `Text(timerInterval:)` tyka sam po
  stronie systemu z jednej daty startu, a `AktywnyStoper.poczatek`
  (`Models/Czas.swift:87`) już ją daje. Aktualizacja przyda się tylko przy
  zmianie licznika spraw z Pulpitu.
- **Punkt wpięcia jest gotowy.** `AppStore` używa wstrzykiwanych domknięć
  `zaplanujPrzypomnienia` / `skasujPrzypomnienia`
  (`AppStore.swift:1200-1201`), wołanych w **trzech** miejscach:
  `AppStore.swift:1215`, `:1244`, `:1262`. `uruchomWyspe` / `zakonczWyspe`
  wchodzą **tym samym wzorcem, w te same trzy punkty**. Zero przebudowy.
- **Bonus za darmo**: `odswiezStoper()` już obsługuje przypadek „stoper
  wystartował z panelu webowego" — Wyspa odziedziczy to bez dodatkowej pracy.

## Zakres

1. `WidgetBundle` w `Widzet/Widzet.swift` + `ActivityConfiguration` dla
   stopera (`ActivityAttributes`: nazwa projektu/zadania; stan dynamiczny:
   data startu + liczba spraw z Pulpitu).
2. `NSSupportsLiveActivities` w `project.yml:31-38` (Info.plist głównej apki).
3. Trzy stany wizualne: ekran blokady, Wyspa zwinięta (ikona + czas), Wyspa
   rozwinięta (nazwa projektu + tykający czas + **druga linia: „N spraw na
   dziś"**).
4. Wstrzyknięte domknięcia `uruchomWyspe` / `zakonczWyspe` w te same trzy
   punkty co przypomnienia.
5. Przycisk „Stop" prosto z Wyspy — przez `AppIntent` (iOS 17+, dostępne).

Poza zakresem: cokolwiek push-owego, osobna Live Activity Pulpitu (odrzucona),
przenoszenie stopera na inne powierzchnie.

## Ryzyka

- **Dynamic Island jest tylko na iPhone 14 Pro i nowszych.** Na starszych
  Live Activity działa, ale wyłącznie na ekranie blokady. To nie błąd.
- **Wariant `project-telefon.yml` buduje bez rozszerzeń** — tam Wyspy nie
  będzie. Znane ograniczenie, dokładnie jak dziś z widżetem.
- **Widżet nie widzi `Theme.swift`** z rdzenia apki — precedens rozwiązania
  jest w kodzie: `Color.brandZlotyWidzet` (`Widzet.swift:141`). Kolory
  duplikować tym wzorcem, nie próbować importować motywu.
- **Liczba spraw z Pulpitu zamarza**, gdy apka jest zamknięta (brak push).
  Pokazuje stan z momentu startu stopera / ostatniego wejścia do apki —
  właściciel to zaakceptował, ale niech treść nie sugeruje danych na żywo.
- Symulator pokaże Wyspę, ale zachowanie po długim czasie i przy braku apki w
  pamięci warto potwierdzić na prawdziwym telefonie.

## Szacunek pracy

**Jedna sesja, ~150-200 linii** (Wyspa + wpięcie). Druga linia z licznikiem
spraw to dodatkowe ~30 min w ramach tej samej sesji.

## Jak pracować

Te same zasady, co przy każdym module tego projektu (`00-plan.md` → „Jak
pracujemy"):

- **Zielony build nie jest dowodem.** Uruchom w symulatorze, zrób zrzut Wyspy
  zwiniętej i rozwiniętej, obejrzyj.
- **Sprawdzaj, czy coś WOŁA kod, nie czy kod istnieje** — udokumentowany
  wzorzec błędów tego projektu (Moduły 30/31). Domknięcie zdefiniowane, ale
  niewstrzyknięte w `AppStore`, da zielony build i martwą funkcję.
- Decyzje nietechniczne (np. dokładna treść drugiej linii) — pytaj wprost,
  po polsku.

## Wynik

Działająca Live Activity stopera: ekran blokady + Wyspa zwinięta + rozwinięta
z licznikiem spraw, przycisk „Stop", start/stop spięty z trzema istniejącymi
punktami w `AppStore`. Plus zrzuty i krótka notka w `00-plan.md`, czego NIE
zweryfikowano dotykiem (co najmniej: zachowanie po 8 h i na urządzeniu
starszym niż 14 Pro).

## Prompt otwierający kolejny czat

```
Kontynuujemy aplikację natywną Leggera Hub. Przeczytaj
docs/natywna-aplikacja/00-plan.md, potem
docs/natywna-aplikacja/09-brief-dynamic-island-stoper.md (a jeśli
potrzebujesz kontekstu ustaleń — 08-wynik-audytu-apki.md sekcje B1/B2),
i zbuduj Live Activity / Dynamic Island dla stopera. Decyzje właściciela
są już podjęte i opisane w briefie — nie otwieraj ich ponownie.
Repo apki: /Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios.
```
