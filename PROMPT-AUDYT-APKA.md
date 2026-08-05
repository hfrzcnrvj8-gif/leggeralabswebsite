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

- `docs/natywna-aplikacja/39-brief-audyt-co-apka-wyrzuca.md` — brief tej roboty:
  metoda na trzy kroki, zmierzony zakres, kolejność, jedno gotowe znalezisko
  na start i lista rzeczy, których NIE robić
- `docs/natywna-aplikacja/38-wynik-apka-dogania-panel.md` — poprzednia sesja.
  **Przeczytaj zwłaszcza „Trzy usterki znalezione po drodze"**: to z nich
  wziął się ten audyt i to one pokazują, jak ta rodzina błędu wygląda
- `HANDOFF.md` — aktualny stan całości i lista rzeczy otwartych
- `CLAUDE.md` — zasady pracy w tym repo i pułapki środowiska
- README apki → „Apka dogoniła panel po dwóch planach zaplecza" (poprzedni
  moduł, w tym pułapka z parametrem zapytania) i „Apka przestaje kłamać
  pustymi ekranami" (ustalenie A1 — to ono tłumaczy, czemu ten błąd milczy)

## Punkt startu

- Panel: `325c27e` „Brief na audyt: co trasy oddają, a apka wyrzuca do kosza".
  `tsc` czysto, `npm test` 340/340, `npm run przejscie` **101 działa · 0 regresji**.
- Apka: `8870614` „Apka dogania panel: propozycje, sekcje Pulpitu, poziom
  windykacji, źródła dokumentów". Buduje się, `swift test` w `LeggeraHubCore`
  daje 9/9.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu.

## Problem jednym zdaniem

Trasy panelu oddają apce więcej, niż apka czyta — a pole, którego `APIClient`
nie zdekoduje, **znika bez żadnego objawu**: `tsc` przechodzi, build przechodzi,
ekran się rysuje, pusty stan nie wyskakuje (bo tablica jest pusta, a nie `nil`,
czyli wg ustalenia A1 znaczy „naprawdę pusto").

## Skąd wiadomo, że to nie jest wymyślony problem

Przy poprzedniej sesji znalazły się **cztery** takie pola — i to sprawdzając
DWIE trasy przy okazji, a nie szukając ich:

- `propozycje`, `projektyZagrozone`, `zapomnianeSzkiceUmow` w `/api/hub/today`
- `sections` i `contract` w `/api/offers/:id` — **przez to bloki treści oferty
  nie pokazywały się w apce NIGDY**, choć widok je rysował, a model miał na nie
  pole od pół roku

Piąte jest potwierdzone i czeka: **`expiredOffers`** z `/api/hub/today` —
oferty po terminie ważności. Panel liczy je do „wymaga działania dziś",
apka nie ma dla nich sekcji. **Zacznij od niego.**

W apce jest **48 wywołań `GET`** i **41 struktur dekodujących** odpowiedzi.

## Jak to robić (skrót; całość w briefie 39)

Trzy kroki na trasę:

1. **Co trasa NAPRAWDĘ oddaje** — `return NextResponse.json({ … })` w
   `app/api/.../route.ts`. Uwaga na rozwinięcia (`{ ...invoice, cośtam }`):
   pola z nich też się liczą, a nie widać ich w liście kluczy.
2. **Co apka dekoduje** — struktura `*Response` w `APIClient.swift` **ORAZ**
   `CodingKeys` modelu. Sprawdzaj OBA: `sections` było w modelu i w widoku,
   a nie było w strukturze odpowiedzi.
3. **Różnicę oceń, nie zgłoś** — pytanie brzmi „czy w apce istnieje ekran,
   na którym to pole miałoby co robić". Jeśli nie — wpis do wyniku z jednym
   zdaniem, żeby następny audyt nie liczył tego drugi raz.

**Tego nie da się zrobić `diff`em** — nazwy po obu stronach są różne
(`silenceDays` → `dniCiszy`), mapowanie siedzi w `CodingKeys`. Skrypt poda
najwyżej kandydatów.

Kolejność: `hub/today` → profile rekordów → listy → reszta. **Jeśli sesja ma
się skończyć w połowie, niech skończy się po profilach** — tam wyszły dwie
z czterech poprzednich luk.

## Czego NIE rób

- **Nie dokładaj pól „na zapas".** Pole bez ekranu, który je pokazuje, to
  martwy kod — ten sam dług, co `client_id`, którego przez pół roku nikt
  nie wołał.
- **Nie ruszaj panelu.** Jeśli trasa czegoś nie oddaje, a powinna — to osobna
  decyzja i osobna sesja. Powiedz mi wprost.
- **Nie przepisuj reguł do Swifta.** Gdy pole liczy serwer (`silenceDays`,
  `powod`, `opis`) — apka je POKAZUJE, nie liczy drugi raz.
- **Nie „naprawiaj" świadomych pominięć poziomu 3** (KSeF, korekty, edycja
  pozycji faktury). Sprawdź w README apki, zanim uznasz coś za lukę.

## Pułapki, które kosztowały czas ostatnio

- **Parametr zapytania doklejony do ścieżki daje 404.** `wyslij(_:)` idzie
  przez `appendingPathComponent`, które koduje znak zapytania. Objaw wygląda
  jak martwy przycisk, nie jak zły adres. Parametry składaj `URLComponents`-ami.
- **Dwa pola „ile dni" na jednej trasie.** `silenceDays` i `draftAgeDays` —
  wzięcie jednego zamiast drugiego dekoduje się bez błędu i pokazuje wszędzie
  „0 dni". Sprawdzaj, KTÓRA funkcja panelu liczy pole; nie zakładaj po nazwie
  sąsiada.
- **Logowanie w symulatorze:** `LEGGERA_DEV_HASLO` bywa przegrane w wyścigu
  z odzyskiwaniem sesji. Pewniej: wybij token `curl`em na `/api/admin/login`
  i podaj przez `LEGGERA_DEV_TOKEN`. **Logowanie tą samą nazwą urządzenia
  unieważnia poprzedni token** i wyrzuca działającą apkę do ekranu logowania —
  kolejnym przebiegom dawaj różne nazwy (`Sym-1`, `Sym-2`…).
- **Nowy plik `.swift` wymaga `xcodegen`**, a przed budowaniem idzie
  `Skrypty/stempel-wersji.sh`.
- **Dev-baza PGlite żyje w pamięci procesu `next dev`** — restart kasuje
  wszystko, a rekordu starszego niż dziś nie da się w niej zrobić.

## Sprawdzenie

Dla każdej naprawionej luki dowodem jest **zrzut z symulatora plus stan
w danych**, nie „pole jest zadeklarowane". Dane: `npm run dev` +
`npm run przejscie` w repo panelu.

## Na koniec

Wynik zapisz jako `docs/natywna-aplikacja/40-wynik-…` w repo panelu plus wpis
w README apki (jeśli wyjdzie z tego REGUŁA, a nie tylko lista poprawek).
Zaktualizuj `HANDOFF.md`. Podaj polecenia do commita i pusha **osobno dla obu
repozytoriów** i skasuj `PROMPT-AUDYT-APKA.md`.

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
