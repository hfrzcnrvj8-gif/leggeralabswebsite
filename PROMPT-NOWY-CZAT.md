# Do wklejenia w nowym czacie

Zaczynamy pracę nad aplikacją iOS, nie nad panelem.

* Czat jest otwarty w repo panelu — tu leżą briefy, `CLAUDE.md`
  i dokumentacja, i tego się trzymamy.
* Kod apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios` (osobne repo
  gita, własny `origin`). Apka nie ma własnego `CLAUDE.md` — zasady projektu
  czytasz z panelu, a szczegóły budowania, wgrywania, furtek DEBUG i słownik
  koloru z jej `README.md` (duży plik — szukaj w nim, nie czytaj w całości).
* Panel w tej sesji tylko czytamy. Jeśli okaże się, że trzeba go zmienić —
  powiedz mi to wprost, zanim cokolwiek ruszysz.
* Commit i push idą OSOBNO dla każdego repo. Sprawdź `git log` w obu przed
  `git add` — równoległa sesja już raz wchłonęła cudze zmiany.

## Na start przeczytaj, w tej kolejności

* `docs/natywna-aplikacja/41-brief-audyt-co-apka-wysyla.md` — brief tej roboty.
  **Przeczytaj go w całości, zanim cokolwiek sprawdzisz** — zawiera listę
  czterech miejsc już sprawdzonych (nie rób ich drugi raz) i wyraźne
  ostrzeżenie, że ta robota może wyjść krótka.
* `docs/natywna-aplikacja/40-wynik-audyt-co-apka-wyrzuca.md` — poprzednia
  sesja: druga strona tej samej monety (odczyt). Przeczytaj zwłaszcza „Trzy
  rzeczy, które ten audyt pokazał o samym szukaniu luk".
* `HANDOFF.md` — aktualny stan całości i lista rzeczy otwartych.
* `CLAUDE.md` — zasady pracy w tym repo i pułapki środowiska.
* README apki → „Bramka wysyłki — apka uczy się »mimo to« od serwera"
  (poprzedni moduł) i „Apka przestaje kłamać pustymi ekranami" (ustalenie A1 —
  to ono tłumaczy, czemu ta rodzina błędu milczy).

## Punkt startu

* Panel: `d2655b0` „Wynik audytu: sześć pól, które apka wyrzucała do kosza".
  `tsc` czysto, `npm test` 340/340, `npm run przejscie` 101 działa · 0 regresji.
* Apka: `d5c40c6` „Apka czyta to, co serwer oddaje: bramka wysyłki, wygasłe
  oferty, rodzina umowy, szukanie po treści". Buduje się, `swift test`
  w `LeggeraHubCore` daje 9/9.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu.

## Problem jednym zdaniem

Apka wysyła w `POST`/`PATCH` pole, którego trasa nie czyta — właściciel dostaje
`{"ok":true}`, widzi swoją zmianę na ekranie (bo apka zaktualizowała stan
lokalnie), a w bazie nie zmieniło się nic.

To druga strona monety z poprzedniej sesji. Przy odczycie znika informacja;
tutaj znika **zapis**.

## Ważne: to prawdopodobnie będzie krótkie

Przy pisaniu briefu sprawdziłem cztery najbardziej ryzykowne miejsca — te,
w których klucze idą słownikiem, więc kompilator ich nie pilnuje. **Wszystkie
cztery czyste** (`clients/:id`, `costs/:id`, `projects/:id`, `events/:id`).

Zacznij od tego, czego NIE sprawdziłem (lista w briefie). **Gdy dwie–trzy rundy
wyjdą puste — przestań i tak napisz wynik.** Pusty wynik jest wynikiem;
grzebanie na siłę kończy się dokładaniem pól „bo pasują".

Zmierzony zakres: 54 `POST`, 21 `PATCH`, 43 inline `struct Body` i 16 ładunków
słownikowych. **Słowniki najpierw** — `struct Body` ma nazwy w jednym miejscu
i widać je gołym okiem, słownika nie sprawdza nic.

## Jak to robić (skrót; całość w briefie 41)

1. **Co apka WYSYŁA** — klucze z `struct Body`/słownika PLUS miejsce wywołania
   (słowniki bywają budowane w widoku, nie w `APIClient.swift`).
2. **Co trasa CZYTA** — odczyt z ciała żądania (`"pole" in body`, `body.pole`,
   albo funkcja-bramka typu `czytajPolaKosztu`). **Nie `grep` po nazwie
   kolumny** — plik wspomina ją też w `SELECT` i w komentarzach.
3. **Różnicę oceń, nie zgłoś** — pytanie brzmi „czy istnieje ekran, na którym
   właściciel może to pole zmienić i zobaczyć »zapisano«".

Poza samymi kluczami szukaj też: klucza czytanego, ale z **wartością cicho
podmienianą** (rodzina znalezisk z audytów Katalogu i Kosztów), `PATCH`-a,
który nadpisuje nieprzysłane pola, i rozjazdu typów (string kontra liczba →
`NaN` → zapisane `0`, bez błędu).

## Czego NIE rób

* Nie ruszaj panelu. Jeśli trasa czegoś nie czyta, a powinna — to osobna
  decyzja i osobna sesja. Powiedz mi wprost.
* Nie usuwaj pól z apki „bo trasa ich nie czyta", zanim nie sprawdzisz kroku 3.
  Komplet pól bywa świadomy: przy koszcie i wydarzeniu nowy wybór powiązania
  CZYŚCI pozostałe i to jest cel, nie nadmiar.
* Nie przepisuj walidacji do Swifta — ostatnie słowo ma serwer.
* Nie „naprawiaj" świadomych pominięć poziomu 3 (KSeF, korekty, edycja pozycji
  faktury). Sprawdź w README apki, zanim uznasz coś za lukę.

## Pułapki, które kosztowały czas ostatnio

* **`xcrun simctl install` na działającą apkę wyrzuca ją do ekranu logowania.**
  Po każdej instalacji: `terminate`, chwila, `launch`.
* Lokalnie wystarczy `LEGGERA_DEV_TOKEN=dev` z `LEGGERA_DEV_BACKEND=lokalny`
  (dev-bypass panelu przepuszcza dowolny token). `curl` na `/api/admin/login`
  potrzebny dopiero przy produkcji. Zmienne przez prefiks `SIMCTL_CHILD_`.
* Parametr zapytania doklejony do ścieżki daje 404 — `appendingPathComponent`
  koduje znak zapytania. Parametry składaj `URLComponents`-ami.
* Nowy plik `.swift` w `LeggeraHub/` wymaga `xcodegen`; w `LeggeraHubCore/`
  **nie**. Przed budowaniem `Skrypty/stempel-wersji.sh`.
* Dev-baza PGlite żyje w pamięci procesu `next dev` — restart kasuje wszystko,
  a rekordu starszego niż dziś nie da się w niej zrobić.

## Sprawdzenie

Dowodem luki jest **stan w danych po zapisie z apki**, nie „klucz się nie
zgadza". Dane: `npm run dev` + `npm run przejscie` w repo panelu, potem zapis
z symulatora i `curl` po rekord. Jeśli pola nie da się zmienić z ekranu, dowodem
może być `curl` powtarzający dokładnie to ciało, które wysyła apka — ale wtedy
napisz wprost, że to sonda, a nie przebieg przez apkę.

## Jeśli wyjdzie pusto

Napisz to wprost i **zapytaj mnie**, zanim ruszysz dalej. Brief 41 proponuje
w takim wypadku „drugi rok obrotowy" (numeracja faktur przez zmianę roku,
retencja, faktury cykliczne przez 31 grudnia) — ale to robota po stronie
PANELU, więc bez mojej zgody nie przełączaj repozytorium.

## Na koniec

Wynik zapisz jako `docs/natywna-aplikacja/42-wynik-…` w repo panelu — **także
gdy jest pusty**, bo „sprawdzone, czysto" jest informacją, którą następny audyt
musi dostać. Wpis w README apki tylko jeśli wyjdzie z tego REGUŁA, a nie lista
poprawek. Zaktualizuj `HANDOFF.md`. Podaj polecenia do commita i pusha osobno
dla obu repozytoriów i skasuj `PROMPT-NOWY-CZAT.md`.

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
