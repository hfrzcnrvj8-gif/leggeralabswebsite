# Wynik: Faza 14 — gesty w bok, menu przytrzymania, przebudowa Kalendarza

> Wykonane 2026-07-22 wg `18-brief-menu-przytrzymania.md` + `24-brief-gesty-w-bok.md`,
> potem znacznie rozszerzone na żywo w tej samej sesji (prośby właściciela
> po testach na telefonie). Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Panel: `/Volumes/OWC_SN850X/projekty_ai/poltechnickx-website` (ten sam
> katalog co ten plik).
>
> Stan wyjściowy: apka wydanie 48 (`a0a6721`). Stan końcowy: apka `14c9d5c`
> (build 67), panel `3d0e6be`.

## Co zrobiono — gesty (Faza 14, briefy 18+24)

Swipe (jedna, najczęstsza akcja) + `.contextMenu`/`.onLongPressGesture`
(komplet akcji) na wszystkich głównych listach: Leady, Klienci, Poczta,
Projekty, Faktury, Oferty, Umowy, Koszty, Notatnik, Kalendarz. Faktury/
Oferty/Umowy/Koszty dostały pierwszy gest w ogóle (wcześniej TYLKO wejście
w profil). Szczegóły — patrz commit `813e440` i tabela w `24-brief...`.

**Wycięte po decyzji właściciela** (nie dopisywać bez pytania):
- „Przejdź do projektów klienta" (menu Klienta) — `ProjektyListView` nie ma
  filtra po kliencie, to nowy, osobny kawałek funkcji, nie dokładka gestów.
- „Kod QR przelewu" (menu Kosztu) — apka świadomie NIE pokazuje numerów kont
  (`Client.swift`), QR wymagałby właśnie takich danych.

## Błędy złapane i naprawione PO WDROŻENIU (testy właściciela na telefonie)

Ten moduł jest dobrym materiałem dowodowym na to, że „zbudowane" ≠
„sprawdzone" — cztery kolejne rundy poprawek, każda po realnym teście:

1. **Puste menu w Ofertach/Umowach/Fakturach.** Jedyna pozycja menu/swipe'a
   była UKRYTA (`if warunek { Button ... }`) zamiast wyszarzona — przy braku
   maila klienta całe menu znikało, długie przytrzymanie nie robiło NIC.
   Naprawa: przycisk zawsze widoczny, `.disabled(...)` zamiast ukrywania.
   Status (np. umowa już podpisana) nadal LEGALNIE chowa akcję — to inny
   przypadek niż brak danych.
2. **Menu przytrzymania w Kalendarzu (wydarzenie) w ogóle niewidoczne.**
   Przyczyna: `NavigationLink` WEWNĄTRZ `.contextMenu` — udokumentowany,
   niedziałający wzorzec SwiftUI. Naprawa: `Button` + prezentacja jako
   `.sheet(item:)` przez wspólny enum `MenuAkcja` (żeby nie przekroczyć
   dwóch `.sheet` na jednym widoku — patrz pułapka niżej).
3. **Szarpane zamykanie okienka po wyborze z menu.** Ustawienie stanu
   prezentującego (sheet/dialog) WPROST w akcji przycisku menu nakłada dwie
   animacje na siebie (zamykanie karty menu + otwieranie kolejnej
   prezentacji). Naprawa: `Ruch.poMenu(_:)` w `Ruch.swift` — `Task { @MainActor
   in }` z 0.35 s opóźnieniem, jedno źródło dla całej apki (NIE
   `DispatchQueue.main.asyncAfter` — wymaga `@Sendable`, a domknięcia tu
   niemal zawsze łapią `@State`, więc Swift 6 ostrzegał przy każdym użyciu).
4. **Zły kolor „W trakcie" w Projektach** (fiolet w pigułce listy, cyjan
   w profilu). `kolorStatusuProjektu` (`ProjektyListView.swift`) miał
   WŁASNE, błędne kolory — `ProjektStatus.kolor` (`Theme.swift`) jest jedynym
   źródłem prawdy w apce, 1:1 z panelem (`PROJECT_STATUS_CLASS`). Poprawiono
   `kolorStatusuProjektu`, nie odwrotnie.

## Przebudowa Kalendarza w stylu Apple Kalendarz (na wyraźną prośbę, zrzut jako wzorzec)

- Spójne czarne tło (`.insetGrouped` → `.plain` + wyczyszczone tło wierszy —
  `.insetGrouped` malował sekcje na jaśniejszej karcie, stąd „szare tło").
- Większe odstępy, duża pogrubiona nazwa miesiąca, numery tygodnia w roku
  z lewej strony każdego wiersza siatki.
- **Wydarzenia PRAWDZIWIE wielodniowe** (`dataKoniec > data`) rysują się jako
  ciągły kolorowy pasek przez komórki dni (przydział „torów" GLOBALNY dla
  całego miesiąca — ten sam pasek nie skacze między torami w kolejnych
  tygodniach, które przecina). Jednodniowe zostają kropką, świadomie (cały
  tytuł w każdej komórce zrobiłby z wąskiego telefonu tęczę).
- Długie przytrzymanie PUSTEJ komórki dnia → od razu „Dodaj wydarzenie” na
  TEN dzień (zamiast „wybierz dzień, potem stuknij +”).

### Nowe pola wydarzenia (dane, nie tylko wygląd)

| Pole | Baza | Apka | Uwaga |
|---|---|---|---|
| `lokalizacja` | `events.lokalizacja TEXT` (`ba7f569`) | pole + `Kontakty.nawigacja(_:)` → link do Map | Autouzupełnianie: `MKLocalSearchCompleter` (`LokalizacjaWyszukiwarka.swift`) |
| `alert_minut_przed` | `events.alert_minut_przed INTEGER` (`3d0e6be`) | picker (Brak/0/5/15/30/60/1440 min) | Lokalne powiadomienie (`WydarzenieAlerty.swift`, `UNUserNotificationCenter`, ta sama maszyneria co `StoperPrzypomnienia.swift`, ŻADEN nowy delegat — jest już jeden na apkę) |
| Wielodniowe + godzina początku/końca | już istniały (`data_koniec`, `czas_trwania_min`) | **formularz nigdy nie miał do nich pól** — świadomy skrót „poziom 2” sprzed tej sesji, teraz dokończony | Wielodniowe i konkretna godzina WYKLUCZAJĄ SIĘ (serwer ogranicza `czas_trwania_min` do 1440 min) |

**Panel (desktop) nie ma pola do edycji lokalizacji/alertu w UI** — dane
płyną przez API (PATCH z apki działa), ale widok kalendarza w panelu ich nie
pokazuje. Świadomie odłożone — nikt o to nie prosił dla panelu.

## Błąd, który kosztował najwięcej czasu: długie przytrzymanie DNIA dodawało ZAWSZE zły dzień

Zgłoszenie właściciela: „wybranie dnia innego niż dzisiaj po dłuższym
przytrzymaniu nie powoduje że dodaje termin innego dnia niż dzisiaj” —
i faktycznie, potem jeszcze dokładniej: zawsze WYCHODZIŁ pierwszy dzień
widocznego miesiąca, nie dzień, który realnie przytrzymano.

**Zreprodukowane bezpośrednio na symulatorze** (nie na słowo) — dopisanie
dnia WPROST do etykiety pozycji menu (`Label("Dodaj wydarzenie (\(dzien))")`)
pokazało błędną wartość PRZED jakimkolwiek tapem, więc to nie był problem
timingu ani `Ruch.poMenu`.

Kolejność hipotez i dlaczego odpadły:
1. Dwa osobne stany (`wybranyDzien` + `nowePokazane`) sterujące jednym
   arkuszem — klasyczna pułapka `.sheet(isPresented:)` z zewnętrznym stanem.
   Naprawione (`b0009f8`, jeden wspólny `menuAkcja` enum) — **nie
   wystarczyło**, ten sam objaw dalej.
2. „Stare domknięcie z pętli ForEach" — wydzielenie komórki dnia do
   osobnego structu (`KomorkaDniaPrzycisk`) z `dzien` jako właściwością
   PRZECHOWYWANĄ, nie zmienną domknięcia — **nie wystarczyło**.
3. Jawne `.id(dzien)` (wymusza tożsamość po wartości, nie po pozycji) —
   **nie wystarczyło**.

**Prawdziwa przyczyna**: `.contextMenu` w gęstej siatce (wiele komórek
w jednym `HStack`, każda z WŁASNYM `.contextMenu`) ma głębszy problem
integracji z UIKit-em — konsekwentnie łapało dzień z INNEJ komórki
(zawsze tej samej — pierwszej w miesiącu), niezależnie które fizycznie
przytrzymano. `.onTapGesture` na TEJ SAMEJ komórce ZAWSZE poprawnie łapało
`dzien` (zaznaczenie zawsze trafne — dowód, że to nie ogólny błąd apki).

**Naprawa (`14c9d5c`)**: zamiana `.contextMenu` na `.onLongPressGesture` —
ten sam, prosty mechanizm gestów co `.onTapGesture` (nie osobna integracja
UIKit-owa jak menu kontekstowe). Jedna akcja na dzień i tak nie potrzebowała
pełnego menu — przytrzymanie otwiera „Nowe wydarzenie” WPROST, bez
pośredniego popupu. Zweryfikowane bezpośrednio: dwa czyste testy (dzień 9,
dzień 17) po poprawce — oba poprawne.

**Lekcja do zapamiętania na przyszłość**: `.contextMenu` na wielu blisko
siebie ułożonych komórkach w jednym kontenerze (nie w wierszach `List`,
gdzie działa bez problemu w całej reszcie apki — Leady, Klienci, Faktury
itd.) jest podejrzany. Jeśli menu ma tylko JEDNĄ pozycję, `.onLongPressGesture`
jest prostsze i bezpieczniejsze. Jeśli potrzeba prawdziwego menu z kilkoma
pozycjami w takim układzie, dowieść działania NA EKRANIE (etykieta z wartością
w treści), zanim uzna się temat za zamknięty — sam build/kompilacja nic tu
nie mówi.

## Jak zweryfikowano

- **Wizualnie**: symulator + `SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny` +
  `SIMCTL_CHILD_LEGGERA_DEV_TOKEN=dev` (panel lokalny, `npm run dev`,
  `DEV_ADMIN_BYPASS=1` już w `.env.local`) + `computer-use` (mysz: przytrzymanie
  ~1 s = long-press, potwierdzone wielokrotnie w tej sesji).
- **Na telefonie właściciela**: build wgrywany kablem (`devicectl`), testy
  między rundami poprawek.
- **Pułapka zauważona przy okazji**: przytrzymanie myszą w symulatorze bywa
  FLAKY (czasem menu/gest się nie uruchamia, mimo identycznych współrzędnych)
  — to ograniczenie syntetycznego wejścia myszą, nie dowód błędu w kodzie.
  Jeśli test nie reaguje, powtórz z krótkim zwykłym kliknięciem tuż przed
  (`left_click` → 0.3 s → `left_mouse_down/up`) — działało dużo pewniej.

## Czego świadomie NIE zrobiono w tej sesji (osobne wątki)

- **Moduł Przypomnień (Apple Reminders-style)** — właściciel poprosił, ale
  to CAŁKOWICIE NOWA funkcja (nie istnieje dziś nigdzie: ani w apce, ani
  w panelu — sprawdzone grepem). Wymaga nowej tabeli w bazie. Brief:
  `26-brief-przypomnienia-i-dalsze.md`.
- **Czas podróży („time to leave")** — integracja z Mapami do liczenia ETA +
  reguła alertu na tej podstawie. Osobny temat.
- **Załączniki do wydarzenia** — nowa infrastruktura plików (jak
  w Kosztach/Poczcie), nie prosta kolumna.
- **Przełącznik widoku rok/lista** w Kalendarzu (jak w oryginalnym Apple
  Kalendarz) — apka ma świadomie tylko widok miesiąc+dzień.
- **Kolejki Poczty poza główną listą** (Screener, „Bez odpowiedzi") nie
  dostały menu przytrzymania — tylko główny folder. Jeśli to też ma sens,
  to mały, osobny dorobek (wzorzec już jest, tylko powielić).
