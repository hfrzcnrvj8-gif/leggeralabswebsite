# Prompt do wklejenia w nowym czacie — apka dogania panel

**Plik tymczasowy.** Wklej treść poniżej (od linii `---` w dół) jako pierwszą
wiadomość w nowym czacie, po czym skasuj ten plik przy najbliższym commicie.

**Czat otwierasz w repo PANELU** (`poltechnickx-website`) — tak jak wszystkie
poprzednie sesje nad apką. Briefy, dokumentacja i `CLAUDE.md` mieszkają tutaj,
a kod apki jest wskazywany ścieżką bezwzględną.

Ten prompt **zastępuje** `PROMPT-APKA-PROPOZYCJE.md` (ekran propozycji jest
w nim pierwszą z pięciu pozycji). Tamten plik można skasować.

---

Zaczynamy pracę nad **aplikacją iOS**, nie nad panelem.

- Czat jest otwarty w repo **panelu** — tu leżą briefy, `CLAUDE.md`
  i dokumentacja, i tego się trzymamy.
- Kod apki: **`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`** (osobne repo
  gita, własny `origin`). Apka **nie ma** własnego `CLAUDE.md` — zasady projektu
  czytasz z panelu, a szczegóły budowania, wgrywania, furtek DEBUG i słownik
  koloru z jej `README.md` (duży plik — szukaj w nim, nie czytaj w całości).
- Panel w tej sesji **tylko czytamy**. Jeśli okaże się, że trzeba go zmienić —
  powiedz mi to wprost, zanim cokolwiek ruszysz.
- **Commit i push idą OSOBNO dla każdego repo.** Sprawdź `git log` w obu przed
  `git add` — równoległa sesja już raz wchłonęła cudze zmiany.

Na start przeczytaj, w tej kolejności:

- `docs/natywna-aplikacja/37-brief-dogonic-panel.md` — brief tej roboty: pięć
  pozycji, kontrakty tras sprawdzone w kodzie i **lista trzech rzeczy, których
  NIE robić**, choć wcześniejsze notatki je sugerowały
- `docs/natywna-aplikacja/36-brief-propozycje.md` — pełny opis samego ekranu
  propozycji (pozycja nr 1). Powstał, gdy reguły były trzy; brief 37 wypisuje,
  co się od tego czasu zmieniło
- `HANDOFF.md` — aktualny stan całości i lista rzeczy otwartych
- `CLAUDE.md` — zasady pracy w tym repo i pułapki środowiska
- README apki → „Potwierdzanie działań nieodwracalnych" (poprzedni moduł, ten
  sam wzorzec „rdzeń nie zna reguł, zna je serwer") i „Słownik koloru"

## Punkt startu

- Panel: `a94e00a` „Handoff: stan po zamknięciu planu z drugiego przejścia".
  Oba plany zaplecza zamknięte. `tsc` czysto, `npm test` 340/340,
  `npm run przejscie` **101 działa · 0 regresji · 0 pominiętych**.
- Apka: `07b0e56` „Potwierdzanie działań nieodwracalnych". Od tamtej pory nic
  w niej nie ruszało.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu.

## Problem jednym zdaniem

Przez cztery kroki planu panel dostał sześć reguł propozycji, dwie nowe sekcje
Pulpitu, wybór poziomu windykacji i kartę „na co jest odpowiedzią ta wersja
oferty" — **apka nie zna żadnej z tych rzeczy, choć serwer oddaje na nie
komplet danych**. Nic nie jest zepsute; brakuje ekranów.

## Co jest do zrobienia

Pięć pozycji, kolejność = malejąca wartość. **Pierwsze dwie to 80% pożytku** —
jeśli sesja ma się skończyć w połowie, niech skończy się po nich.

1. **Ekran „Propozycje"** — jedyny duży kawałek. Sześć reguł, jedna z DWIEMA
   drogami wyjścia (`akcjaAlt` → `decyzja: "zrob-alt"`).
2. **Dwie nowe sekcje Pulpitu** (`projektyZagrozone`, `zapomnianeSzkiceUmow`) —
   dane przychodzą tą samą trasą co reszta Pulpitu, więc **zero nowych żądań**.
3. **Wybór poziomu windykacji** — dozwolone poziomy liczy się LOKALNIE z dwóch
   pól, które apka już ma. Nowa trasa niepotrzebna.
4. **Karta „Odpowiedź na wersję N"** na ofercie — serwer oddaje `poprzednia`.
5. **Rubryka „Wynika z" na fakturze** — najmniej pilna, do zrobienia tylko gdy
   cztery pierwsze są skończone.

## Trzy rzeczy, których NIE rób

Sprawdziłem je po kodzie apki 2026-08-05 i **odwołuję** — mimo że sugerowały je
moje wcześniejsze notatki:

- **Odrzucenie oferty przez klienta to nie funkcja apki.** Apka jest narzędziem
  właściciela; przycisk „Dziękuję, rezygnujemy" żyje na publicznej stronie
  oferty w przeglądarce klienta.
- **Nowy rodzaj powiadomienia `offer_rejected` nie wymaga niczego** — apka nie
  mapuje rodzajów na ikony, a oś czasu klienta zna go od dawna.
- **Hierarchia akcji na ofercie już jest poprawna** (`OfertyView.swift:575`) —
  apka robiła to dobrze, zanim panel się poprawił. Nie „wyrównuj" jej do panelu.

## Jak pracować (to się sprawdziło w poprzednich partiach)

- **Sprawdź, czy czegoś naprawdę nie ma, zanim to napiszesz.** W tej sesji
  dotyczy to zwłaszcza windykacji: apka **woła już** `/api/invoices/:id/remind`,
  tylko bez wyboru poziomu.
- **Nowe pole w `PulpitDzis` = TRZY miejsca** (właściwość, `CodingKeys`,
  przypisanie w ręcznym `init(from:)`). Pominięcie trzeciego kompiluje się
  i daje pole zawsze puste, bez żadnego objawu.
- **Nowy plik `.swift` wymaga `xcodegen`.**
- **DEBUG apki celuje w PRODUKCJĘ.** Windykacja WYSYŁA MAILA — nie testuj jej
  na prawdziwym kliencie.
- **Nie dokładaj własnych okien „na pewno?"** — apka uczy się bariery od
  serwera (428 → arkusz → powtórka z nagłówkami), mechanizm jest gotowy.
- **Zdanie, napis na przycisku i link przychodzą z serwera gotowe.** Nie
  zaszywaj listy reguł w apce; nowa reguła w panelu ma się pojawić bez zmian
  po stronie apki.
- Dowodem jest **zrzut z symulatora plus stan w danych**, nie „kod wygląda
  dobrze". Lista sprawdzeń jest na końcu briefu 37.

## Na koniec

Wynik zapisz jako `docs/natywna-aplikacja/38-wynik-…` w repo panelu (tak jak
przy poprzednich partiach) plus wpis w README apki. Zaktualizuj `HANDOFF.md` —
tabela „Apka iOS — jedna spójna paczka roboty" ma po tej sesji wyglądać inaczej.
Podaj polecenia do commita i pusha **osobno dla obu repozytoriów** i skasuj
`PROMPT-APKA-DOGONIC-PANEL.md` oraz `PROMPT-APKA-PROPOZYCJE.md`.

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
