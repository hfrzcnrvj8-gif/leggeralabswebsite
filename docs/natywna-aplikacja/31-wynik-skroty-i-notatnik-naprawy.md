# iPad — wynik: skróty klawiaturowe (partia 1) + naprawy Notatnika/Pencila. Stan i przekazanie

> Sesja 2026-07-24, kontynuacja `30-wynik-poczta-apple-mail-i-apple-pencil.md`.
> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`. Ta sesja NIE
> dotknęła panelu webowego (`poltechnickx-website`) — same zmiany w apce.

## Co zrobiono

### Partia 1 — skróty klawiaturowe (iPad z klawiaturą)

Nowy plik `LeggeraHub/Views/SkrotyKlawiszowe.swift`:

- **⌘1–5** — przełącza `Nawigacja.zakladka` (Pulpit/Poczta/Leady/Projekty/
  Więcej). Działa jednakowo na iPhonie (belka) i iPadzie (sidebar
  `PanelBoczny`, zsynchronizowany przez `.onChange(of: nawigacja.zakladka)`).
- **⌘F** — skupia pole szukania na AKTUALNIE widocznym ekranie (Leady,
  Projekty, Klienci, Notatnik, Poczta — tylko tryb folderu). Mechanizm:
  liczniki w `Nawigacja` (`skupSzukanie`), nie flagi `Bool` — to samo
  naciśnięcie drugi raz z rzędu nie zmieniłoby wartości `Bool`, więc
  `.onChange` by nie odpalił. Każdy ekran pilnuje własnej widoczności
  (`onAppear`/`onDisappear` → lokalny `ekranAktywny`), inaczej ekran w tle
  (żyjący dalej w `TabView`/`NavigationStack`) kradłby focus.
- **⌘N** — „nowy element" tam, gdzie ma sens: Leady, Klienci, Notatnik,
  Poczta (nowa wiadomość). ŚWIADOMIE pominięte: Projekty (zakłada się
  w panelu/przez przekucie notatki) i Kalendarz (wymaga wybranego dnia —
  osobna, większa decyzja niż mechaniczny skrót).
- **⌘K** — „Szukaj wszędzie" (`SzukajView`, ekran „Więcej") — jedyny skrót
  działający identycznie z KAŻDEGO miejsca w apce, bez pilnowania
  widoczności ekranu (`Nawigacja.ZadanieWiecej.szukaj`, ten sam kanał co
  szybkie akcje z ikony).
- **Dyskretna legenda** — `WykrywanieKlawiatury` (obserwuje `GCKeyboard`) +
  ikona „⌨" w stopce panelu bocznego iPada, widoczna WYŁĄCZNIE przy
  podłączonej klawiaturze sprzętowej. Otwiera arkusz z pełną listą skrótów.
  Powód: przytrzymanie ⌘ na klawiaturze właściciela NIE pokazuje systemowej
  nakładki skrótów (nie zawsze działa na każdym sprzęcie/iPadOS) — nie
  dało się polegać na niej jako jedynej legendzie.

### Naprawa: ⌘5 „nie przenosił nigdzie dalej" na iPadzie

`PanelBoczny.zsynchronizuj` przy przełączeniu na `.wiecej` bez konkretnego
celu (szybka akcja) ZOSTAWIAŁ bieżącą pozycję panelu bez zmian — sensowne,
gdy właściciel już przegląda jakiś moduł „Więcej", ale gdy panel stał na
Pulpicie/Poczcie/Leadach/Projektach, to w praktyce ZERO reakcji. Naprawione:
domyślne lądowanie na Klientach (pierwsza pozycja listy „Więcej" na
iPhonie), plus osobny `.onChange(of: nawigacja.zadanieWiecej)` — bo
`.onChange(of: nawigacja.zakladka)` nie odpala się, gdy zakładka JUŻ była
`.wiecej` (wartość się nie zmieniła), a to dokładnie przypadek, w którym
druga z rzędu szybka akcja/⌘K by nic nie zrobiła.

### Notatnik/Pencil — dokończenie porzuconej równoległej sesji + poprawki

**Ważna lekcja tej sesji**: właściciel miał równolegle uruchomioną (i już
zamkniętą, ale niescommitowaną) sesję pracującą nad DOKŁADNIE tym samym
tematem („pastylka" w Notatniku). Zanim zacząłem cokolwiek zmieniać w
plikach, które akurat wisiały zmodyfikowane w drzewie roboczym bez mojego
udziału, ZAPYTAŁEM właściciela, czy równolegle coś jeszcze działa — patrz
`rownolegle-sesje-git-kolizja` w pamięci. Zanim ruszysz Notatnik/Pencil w
kolejnej sesji, sprawdź `git status`/`git diff` — jeśli coś tam wisi
niescommitowane, dopytaj, zanim to nadpiszesz albo zaczniesz poprawiać.

Zgłoszenia właściciela i naprawy (wszystkie w `LeggeraHub/Views/NotatnikView.swift`,
`PanelBoczny.swift`, `PulpitView.swift`, `Rysowanie.swift`,
`LeggeraHubCore/.../AppStore.swift`, commit `a83e43b`):

1. **„Notatki się nie otwierają"** — `PanelBoczny` na iPadzie nie dawał
   `NotatnikView`/`RejestrView` zewnętrznego `NavigationStack`
   (`WiecejView.Cel.wymagaZewnetrznegoStosu` miał je w złej gałęzi) — obie
   robią `NavigationLink(value:)` wprost na swojej liście, bez własnego
   stosu, więc dotknięcie wiersza nie miało dokąd wypchnąć profilu.
   **Ogólna zasada na przyszłość**: każdy nowy ekran „Więcej" MUSI mieć
   jawnie ustalone, czy sam niesie `NavigationStack`, czy polega na
   zewnętrznym — domyślne założenie „to `*View`, więc na pewno ma własny
   stos" jest fałszywe (Notatnik/Rejestr to `*View` bez własnego stosu).
2. **Pulpit „Ostatnie notatki" nic nie robiło** — sekcja nigdy nie miała
   `NavigationLink` (stary błąd, ujawniony dopiero teraz). Naprawione.
3. **Rysunek czarny/niewidoczny** — `UIGraphicsImageRenderer` domyślnie
   bywa nieopaque; przezroczyste tło renderowało się jako czerń na ciemnym
   motywie apki/panelu. Naprawione: `format.opaque = true` na sztywno.
4. **„Nie mogę ponownie edytować rysunku"** — „Rysuj dalej" zawsze
   startowało z pustej kartki (nikt nie przekazywał `tloObrazek`). Teraz
   ładuje dotychczasowy PNG jako tło — to DOKŁADANIE nowych kresek na
   gotowym obrazku, NIE edycja pojedynczych wcześniejszych kresek (rysunek
   trzymamy jako spłaszczony PNG, nie surowe dane PencilKit — świadomy,
   tańszy kompromis, zmiana wymagałaby osobnego przechowywania
   `PKDrawing`).
5. **„Kanwa zablokowana w przybliżeniu, nie da się oddalić"** — wczytywanie
   PNG przez `UIImage(contentsOfFile:)` dawało `scale = 1`, a plik jest
   zapisany w pikselach `UIScreen.main.scale` (np. 2× na iPadzie) →
   `.size` zgłaszany DWA RAZY za duży. Naprawione: `wczytajRysunekZDysku()`
   (`Rysowanie.swift`) wczytuje z jawną, tą samą skalą co przy zapisie.
   **Pułapka do zapamiętania**: `UIImage(contentsOfFile:)` NIGDY nie
   zgaduje skali z rozmiaru pliku — każdy kolejny PNG zapisywany z
   `format.scale` musi być odczytywany przez `UIImage(data:scale:)` z tą
   samą wartością, inaczej ten sam błąd wraca przy innej gęstości ekranu.
6. **„Nie ma jak wyłączyć malowania, żeby się tylko przesunąć"** —
   `drawingPolicy = .anyInput` łapie KAŻDY dotyk jako kreskę. Dodany
   przełącznik „Przesuwaj"/„Rysuj" w pasku (`trybPrzesuwania`), który gasi
   `widok.isUserInteractionEnabled` na kanwie — dotyk trafia wtedy do
   `ScrollView` pod spodem.
7. **„Nie ma możliwości TYLKO podejrzenia rysunku"** — dodany
   `PodgladRysunkuView` (pełny ekran, `MagnificationGesture`+`DragGesture`
   na czystym `Image`, BEZ PencilKit — zero ryzyka przypadkowej kreski).
   Otwiera się stuknięciem w miniaturę w profilu notatki.
8. **„Cofnij" kasował cały rysunek** — był to w istocie przycisk
   „Wyczyść" (`rysunek = PKDrawing()`). Zamieniony na prawdziwe Cofnij/
   Ponów podpięte pod `PKCanvasView.undoManager` (kanwa oddaje referencję
   do siebie przez `KanwaPencilKit.naGotowoscKanwy`, wołane z
   `didMoveToWindow()` — dopiero wtedy `undoManager` istnieje).
9. **Pastylka zamiast rozwijanego „+"** — FAB Notatnika na iPadzie
   (`PastylkaDodawaniaNotatki`) to teraz TA SAMA kapsuła+szkło co dolny
   pasek Poczty (`PasekAkcjiMaila`), zawsze widoczna z trzema ikonami:
   Powiąż / Nowa notatka / Nowy rysunek. Poprzednie próby (rozwijane
   `Menu` pod okrągłym FAB-em) chowały funkcje za dodatkowym stuknięciem —
   to był powód powtarzających się nieudanych prób wcześniej. „Powiąż"
   otwiera `PowiazaniePicker`, tworzy PUSTĄ notatkę już powiązaną
   (`store.utworzNotatkeZTytulem` + `store.powiazNotatke`) i przenosi do
   jej profilu przez osobny typ nawigacji (`SwiezaNotatka`, żeby nie
   kolidować z istniejącym `.navigationDestination(for: String.self)` na
   tym samym stosie — wzorzec z `WiecejView`: `Cel` obok `SzczegolyCel`).

### Świadomie NIE zrobione (odłożone, nie zapomniane)

- **Zoom podczas samego rysowania** (w edytorze „Rysuj dalej"/„Nowy
  rysunek") — `PodgladRysunkuView` (czyste SwiftUI) rozwiązuje potrzebę
  OGLĄDANIA, ale sama kanwa PencilKit nadal nie ma przybliżania. `PKCanvasView`
  technicznie DZIEDZICZY po `UIScrollView` (ma własne `minimumZoomScale`/
  `maximumZoomScale`), więc teoretycznie dałoby się to podłączyć — ale
  apka dokłada WŁASNY, zewnętrzny SwiftUI `ScrollView` NAD kanwą, a tło
  (obrazek dokumentu) to OSOBNA warstwa w `ZStack`, nie subview kanwy —
  zoom przez wbudowany mechanizm `PKCanvasView` przesunąłby rysunek
  względem tła. Właściwa naprawa wymaga przeprojektowania układu
  (tło jako subview kanwy albo świadome zrezygnowanie z tła przy zoomie) —
  osobna, przemyślana porcja, nie łatka.
- **Surowe dane PencilKit zamiast spłaszczonego PNG** — pozwoliłoby na
  prawdziwe, nieniszczące cofanie między sesjami edycji. Większa zmiana
  (nowa kolumna w bazie na `PKDrawing`, migracja).

Świadoma decyzja właściciela 2026-07-24: zostawiamy jak jest, temat Apple
Pencil zamknięty na tym poziomie.

## Mapa plików (zmienione/dodane tej sesji)

- `LeggeraHub/Views/SkrotyKlawiszowe.swift` — **nowy**: `SkrotyKlawiszowe`
  (Commands), `WykrywanieKlawiatury`, `PrzyciskSkrotow`, helpery
  `skrotSzukaj`/`skrotSzukajINowy`.
- `LeggeraHub/LeggeraHubApp.swift` — `.commands { SkrotyKlawiszowe(...) }`.
- `LeggeraHub/Views/Nawigacja.swift` — `skupSzukanie`/`utworzNowy` (liczniki),
  `ZadanieWiecej.szukaj`.
- `LeggeraHub/Views/LeadsListView.swift`, `LeadyPanelIpad.swift`,
  `ProjektyListView.swift`, `ProjektyPanelIpad.swift`, `KlienciPanelIpad.swift`,
  `PulpitView.swift` (`KlienciListaTresc`), `NotatnikView.swift`,
  `PocztaListView.swift` — wpięcie `skrotSzukaj(INowy)`.
- `LeggeraHub/Views/PanelBoczny.swift` — `.notatnik`/`.rejestr` do
  `wymagaZewnetrznegoStosu`; domyślne lądowanie „Więcej" (Klienci); osobny
  `.onChange(of: nawigacja.zadanieWiecej)`.
- `LeggeraHub/Views/NotatnikView.swift` — `PastylkaDodawaniaNotatki`,
  `SwiezaNotatka`, flow „Powiąż", podgląd rysunku, „Rysuj dalej" z tłem.
- `LeggeraHub/Views/Rysowanie.swift` — `format.opaque`, `wczytajRysunekZDysku`,
  `czyRysowanieAktywne`/tryb przesuwania, `naGotowoscKanwy`, Cofnij/Ponów,
  `PodgladRysunkuView`.
- `LeggeraHubCore/.../Store/AppStore.swift` — `utworzNotatkeZRysunku`.

Wszystko w JEDNYM commicie (`a83e43b`) — apka jest jedną spójną zmianą
funkcjonalną tej sesji, nie kilkoma niezależnymi.

## Następne partie (renumerowane, macOS świadomie na koniec)

**Bierzemy: partia 2 — siatki wielokolumnowe** (Pulpit/Statystyki — dziś
jedna rozciągnięta kolumna na całej szerokości iPada, mimo dużo miejsca
w poziomie). To następna w kolejce po zamknięciu partii 1.

Reszta kolejki, bez zmian:
3. Drag & drop.
4. Drobiazgi: pole szukania w liście za bardzo w prawo; FAB w wąskim
   wariancie iPada jest w pasku (toolbar), nie jako FAB.

Osobno, poza kolejką: tłumaczenie maili (Ollama) — osobny brief
backendowy, świadomie odłożone.

Zacznij od potwierdzenia z właścicielem, że bierzemy partię 2, i pracuj
metodą tego projektu: mała paczka → build → weryfikacja (backend przez
`curl`, UI na fizycznym urządzeniu) → wgranie na oba urządzenia → ocena
właściciela → commit+push. **Sprawdź `git status`/`git log` PRZED
rozpoczęciem pracy** — jeśli coś wisi niescommitowane bez Twojego udziału,
dopytaj o równoległą sesję (patrz `rownolegle-sesje-git-kolizja`), zanim
to poprawisz albo nadpiszesz.
