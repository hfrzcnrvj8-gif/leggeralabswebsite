# Prompt do wklejenia w nowym czacie — „Propozycje" w apce iOS

**Plik tymczasowy.** Wklej treść poniżej (od linii `---` w dół) jako pierwszą
wiadomość w nowym czacie, po czym skasuj ten plik przy najbliższym commicie.

**Czat otwierasz w repo PANELU** (`poltechnickx-website`) — tak jak wszystkie
poprzednie sesje nad apką. Briefy, dokumentacja i `CLAUDE.md` mieszkają tutaj,
a kod apki jest wskazywany ścieżką bezwzględną.

---

Zaczynamy pracę nad **aplikacją iOS**, nie nad panelem.

- Czat jest otwarty w repo **panelu** — tu leżą briefy, `CLAUDE.md`
  i dokumentacja, i tego się trzymamy.
- Kod apki: **`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`** (osobne repo
  gita, własny `origin`). Apka **nie ma** własnego `CLAUDE.md` — zasady projektu
  czytasz z panelu, a szczegóły budowania, wgrywania, furtek DEBUG i słownik
  koloru z jej `README.md` (duży plik — szukaj w nim, nie czytaj w całości).
- Panel w tej sesji **tylko czytamy** (`lib/propozycje.ts`,
  `app/api/hub/propozycje/route.ts`, `app/[lang]/admin/Propozycje.tsx`). Jeśli
  okaże się, że trzeba go zmienić — powiedz mi to wprost, zanim cokolwiek
  ruszysz.
- **Commit i push idą OSOBNO dla każdego repo.** Sprawdź `git log` w obu przed
  `git add` — równoległa sesja już raz wchłonęła cudze zmiany.

Na start przeczytaj, w tej kolejności:
- `HANDOFF.md` — aktualny stan całości i lista rzeczy otwartych
- `docs/natywna-aplikacja/36-brief-propozycje.md` — pełny brief tej roboty,
  z kontraktem trasy i czterema pytaniami, które masz mi zadać
- `CLAUDE.md` — zasady pracy w tym repo i pułapki środowiska
- README apki → „Potwierdzanie działań nieodwracalnych" (poprzedni moduł, ten
  sam wzorzec „rdzeń nie zna reguł, zna je serwer") i „Słownik koloru"

## Punkt startu

Panel: ostatni commit **merytoryczny** to `1eb9446` „Faza 5: wygląd…", nad nim
stoją wyłącznie commity porządkowe (handoffy, dokumentacja, briefy) — jeśli
widzisz ich kilka, to w porządku.
Apka: ostatni commit to `07b0e56` „Potwierdzanie działań nieodwracalnych…",
wydanie **183**. Oba repozytoria czyste i wypchnięte, panel: `tsc` czysto,
`npm test` 281/281.

## Co robimy

Faza 3 planu zaplecza zbudowała **„panel proponuje, właściciel zatwierdza"** —
trzy deterministyczne reguły SQL (`lib/propozycje.ts`), trwałe „nie teraz"
w bazie i cofanie decyzji. Panel to pokazuje. **Apka nie ma tego wcale.**

Nic nie jest zepsute — brakuje widoku funkcji, która działa. Cały brief jest
w pliku wyżej; nie streszczam go tutaj.

## Jedna rzecz, którą warto wiedzieć od razu

`GET /api/hub/today` **już zwraca pole `propozycje`**, a apka tę trasę woła przy
każdym wejściu na Pulpit — i to pole wyrzuca, bo `PulpitDzis` go nie dekoduje.
Dla Pulpitu nie trzeba więc ani jednego nowego żądania.

Uwaga: `PulpitDzis` ma **ręczny `init(from:)`**. Pole dodane tylko jako `var`
i do `CodingKeys` skompiluje się i zawsze będzie puste, bez żadnego objawu.
Nowe pole = trzy miejsca.

## Zanim zaczniesz pisać kod, zadaj mi cztery pytania z briefu

Krótko: **gdzie to mieszka** (sam Pulpit czy też Leady/Projekty/Klienci),
**jak wygląda „Nie teraz"** (jest trwałe na zawsze — jaki gest), **jaki kolor**
(panel bierze cyjan, a w słowniku apki cyjan znaczy „w toku" — realna kolizja)
i **co z iPadem**. Pokaż mi wariant, zanim rozjedziesz go po ekranach.

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
Dowodem nie jest to, że się kompiluje ani że sekcja się rysuje — brief mówi,
jakie trzy pomiary są dowodem.

Na koniec podaj mi polecenia do commita i pusha **osobno dla repo apki**
(`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`) i osobno dla panelu.
Skasuj też ten plik promptu (`PROMPT-APKA-PROPOZYCJE.md`) z repo panelu, tak
jak robiliśmy z poprzednimi.
