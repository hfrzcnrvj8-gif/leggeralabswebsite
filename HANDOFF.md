# Handoff — stan na 2026-08-02, po ZAMKNIĘCIU planu zaplecza

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- Panel: na wierzchu ten handoff, pod nim **`1eb9446`** „Faza 5: wygląd — sześć
  usterek zmierzonych i zamkniętych, plan zaplecza domknięty", a pod nim
  `18d693a`.
- Repozytorium czyste i wypchnięte. `tsc` czysto, `npm test` **281/281**.
- `npm run przejscie`: **68 działa · 0 znanych luk · 0 regresji · 0 obejść ·
  0 pominiętych** — przy serwerze świeżo po restarcie. Kilka przebiegów pod
  rząd wyczerpuje hamulec publicznych linków (5/60 min) i wtedy obie publiczne
  drogi (akceptacja oferty i opinia) idą przez panel. To zamierzone zachowanie
  hamulca, nie regresja — po `npm run dev` od nowa wraca komplet.

Jeśli `git log` pokazuje co innego — ktoś pracował po drodze, sprawdź co
(`git log` PRZED `git add`; równoległa sesja już raz wchłonęła cudze zmiany).

**Lista znanych luk z pierwszego przejścia jest pusta.** Każde nowe
`⚠ ZNANA LUKA` w przejściu jest czymś, co dopiero co dołożyliśmy — a każda
`✗ REGRESJA` psuje build.

## Plan zaplecza jest ZAMKNIĘTY

Powstał po ręcznym przejściu opisanym w `docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`.
Trzydzieści kilka znalezisk okazało się **czterema brakującymi mechanizmami**
plus jedną fazą wyglądu. Wszystko zbudowane.

| faza | co dowozi | stan |
|---|---|---|
| 0a | całą drogę klienta przechodzi jedno polecenie (`npm run przejscie`) | ✅ |
| 0b | kontrola spójności jako ekran *Zdrowie* | ✅ |
| 1 | jedno przepisanie danych klienta (`lib/przepisanie.ts`) | ✅ |
| 2 | jedna bramka „czy to wolno wysłać" (`lib/bramkaWysylki.ts`) | ✅ |
| 3 | komplet skutków zdarzenia jako propozycje (`lib/propozycje.ts`) | ✅ |
| 4 | lista działań nieodwracalnych (`lib/nieodwracalne.ts`) | ✅ |
| 5 | wygląd — sześć zebranych usterek | ✅ |

**Podsumowanie całości: `docs/PLAN-ZAPLECZE.md`, sekcja na końcu pliku.**
Tam są cztery lekcje, które przeżyją ten plan, i pełna lista tego, czego
świadomie nie zrobił.

## Co zamknęła Faza 5 — żeby nie robić tego drugi raz

Sześć usterek wyglądu, każda zamknięta POMIAREM (`getComputedStyle`,
`getBoundingClientRect`), nie zrzutem ekranu. Szczegóły i liczby:
`HUB_SETUP.md` → „Faza 5 zaplecza".

- **E1** — `.glass` nie rozmywał, bo pipeline CSS zostawia z grupy prefiksów
  **ostatnią** deklarację, a nieprefiksowana stała pierwsza. **Dokładając regułę
  z prefiksem: prefiks pierwszy, standard ostatni.** Odwrotna kolejność nie daje
  żadnego objawu ani w kodzie, ani w `tsc`.
- **E2** — cztery okna `useUI()` i toasty renderują się poza `.admin-linear`.
  Potrzebne są **obie** klasy: `admin-linear` (zmienne) i `text-[var(--fg)]`
  (kolor tekstu). Sama pierwsza dała ciemne tło z czarnym tekstem, kontrast
  ~1:1 — gorzej niż przed poprawką.
- **E3** — kolumna właściwości projektu 320 → 360 px, plus `flex-wrap`
  w `WierszPola` jako siatka bezpieczeństwa na każde okno i każdy moduł.
- **E4** — `<input>` tnie tekst `clip`-em; `truncate` daje wielokropek w polu
  nieaktywnym.
- **D2** — `app/[lang]/admin/nowyRekord.tsx`: po dodaniu lista przewija się do
  nowego rekordu i podświetla go. **Sortowanie NIETKNIĘTE** — decyzja
  właściciela, nowe rekordy nie wskakują na górę. Wpięte w Leady, Klientów,
  Projekty, Faktury i Oferty. Dwie pułapki środowiska złapane po drodze:
  `requestAnimationFrame` nie tyka w karcie w tle, a `scrollIntoView({behavior:
  "smooth"})` nie rusza z miejsca — stąd `setTimeout` i `behavior: "auto"`.
- **F** — próg dotykowy **24×24 px rozstrzygnięty raz na cały panel** i wpisany
  do `CLAUDE.md` jako DOMYŚLNY, z jawną listą wyjątków. W Katalogu było 186
  celów poniżej progu, jest 0.

**Runda domykająca (ten sam dzień)** — dwie rzeczy złapane przy sprawdzaniu,
czy coś zostało. Obie naprawione i zmierzone:

- **Czerwone przyciski działań nieodwracalnych** miały 4,47:1 w spoczynku
  i **3,76:1 na hover** — czyli stan aktywny był gorszy od spoczynku — przy
  progu 4,5:1. `bg-red-600/90` + `hover:bg-red-600` daje 5,67:1 / 4,83:1.
- **`bg-*` nie działa na `.card-paper` ani `.card-inset`.** `globals.css` ma
  `.admin-linear .card-paper` — selektor POTOMKA, więc bije klasę-utility.
  Trzy zastane miejsca żyły z martwą klasą (zaznaczenie karty leada, karty
  klienta, alarmowy `SummaryCard`). **Dokładając tło do karty w panelu:
  `!bg-…`.** Bez wykrzyknika klasa jest martwa i nic tego nie zgłasza.

## Następny krok

Potwierdzenia w apce są **zrobione** (2026-08-02) — to była ostatnia rzecz,
która po planie zaplecza działała gorzej niż przed nim. `PROMPT-APKA-
POTWIERDZENIA.md` skasowany, bo zużyty.

**Wybrany następny moduł: „Propozycje" w apce iOS.** Brief gotowy —
`docs/natywna-aplikacja/36-brief-propozycje.md`. Do wklejenia w nowym czacie:
**`PROMPT-APKA-PROPOZYCJE.md`** w korzeniu repo (skasuj plik przy najbliższym
commicie). Dotyczy repozytorium apki, nie tego.

Najważniejsze z briefu, żeby nie zginęło: **`/api/hub/today` już zwraca pole
`propozycje`, a apka je wyrzuca**, bo `PulpitDzis` go nie dekoduje — dla
Pulpitu nie trzeba ani jednego nowego żądania. `PulpitDzis` ma ręczny
`init(from:)`, więc nowe pole = trzy miejsca.

**Sekcja F pierwszego przejścia jest zamknięta** (2026-08-04) — patrz niżej;
zostały z niej trzy rzeczy do obejrzenia w prawdziwej przeglądarce.

Dalsi kandydaci:

1. **Drugie przejście na sucho — INNĄ ścieżką.** Pierwsze sprawdziło wyłącznie
   drogę, która się udaje. Nikt nigdy nie przeszedł palcem ścieżki, w której
   klient odrzuca ofertę, projekt się sypie, faktura nie zostaje zapłacona
   (wezwanie) albo umowa idzie na aneks. Kod to ma; nikt tego nie przeszedł.
   Pierwsze przejście dało trzydzieści kilka znalezisk i cały plan zaplecza.
2. **Rejestracja firmy** — nietechniczne, ale jako jedyne realnie zmienia stan
   projektu (`PO_REJESTRACJI.md`). Odłożone decyzją właściciela do odwołania.

## Jak pracować w tym repo (skrót, reszta w CLAUDE.md)

- `npm run dev` w jednym oknie, `npm run przejscie` w drugim. Dev-baza to
  PGlite w pamięci procesu — **restart serwera = czysta baza** (i nowe id
  rekordów, więc stare linki przestają działać).
- `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
  `next build` failuje w sandboxie z EPERM). **`tsc` nie wie nic o więzach
  bazy** ani o SQL-u w szablonach.
- `npm test` — 281 testów nad czystymi funkcjami z `lib/`.
- **Każda nowa trasa w `app/api` jest domyślnie OTWARTA** —
  `if (!(await isAuthed()))` sprawdzaj per uchwyt HTTP, nie per plik.
- Kończąc: `rm -f .git/index.lock && git add -A && git commit && git push`.

---

## Co jest otwarte (nie ruszać przy okazji)

- **Rejestracja firmy** — `PO_REJESTRACJI.md`, osiemnaście punktów. **To jest
  następny krok, który realnie zmienia stan projektu, i jest nietechniczny.**
  Blokuje KSeF test → produkcja, prawdziwe dane w nocie prawnej, plan Vercel Pro
  (Hobby zabrania użytku komercyjnego), przeprowadzkę na NAS. **To nie są braki
  do naprawienia przed rejestracją.**
- ~~**Potwierdzenia w apce iOS**~~ — **ZROBIONE 2026-08-02** (repo
  `../leggera-hub-ios`). Apka uczy się bariery od serwera: 428 → arkusz →
  powtórka z nagłówkami, w jednym miejscu (`APIClient.wyslijNaURL`). Zmierzone
  parami na tym samym rekordzie, oba poziomy. **Zostaje do zrobienia przez
  właściciela: jeden przebieg kontrolny na PRODUKCJI** (atrapa klienta →
  usunięcie tą samą drogą) — nie dało się go wykonać stąd, bo apka w DEBUG
  celuje w produkcję, a wejście wymaga hasła wpisanego na urządzeniu.
  Szczegóły i pułapki: README apki → „Potwierdzanie działań nieodwracalnych".
  Przy okazji wyszło, że brief mylił się w obie strony — patrz nagłówek
  `docs/natywna-aplikacja/35-brief-potwierdzenia.md`.
- **Czy porzucenie świeżo zeskanowanego paragonu ma pytać** — `koszt-usun` jest
  na liście nieodwracalnych, więc „Anuluj" w skanerze paragonu prosi teraz
  o potwierdzenie usunięcia szkicu. Trasa nie odróżnia szkicu sprzed minuty od
  kosztu sprzed miesiąca. **Decyzja po stronie panelu**, nie apki; do
  rozstrzygnięcia, nie usterka.
- **Propozycje z Fazy 3 w apce iOS** — trasa `/api/hub/propozycje` gotowa,
  brakuje wyłącznie ekranu w SwiftUI.
- ~~**Drobiazgi z sekcji F pierwszego przejścia**~~ — **ZROBIONE 2026-08-04.**
  Sześć naprawionych (odświeżanie kolumn, reset formularza wpisu, skok chipów
  terminu, klikalne kroki mapy, dostępność wyzwalacza menu, Escape) plus
  **nowe „Umów spotkanie"** w profilu leada i klienta — rozmowa z godziną
  trafia wreszcie do Kalendarza, a nie do pola tekstowego. Tabela wyników:
  `docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md` → „F" → „Co z tego wyszło".
  **Zostały trzy rzeczy do sprawdzenia w PRAWDZIWEJ przeglądarce**, bo podgląd
  w środowisku Claude to karta ukryta 0×0 (renderuje wariant mobilny, a
  `window.innerHeight` wynosi 0, więc pozycjonowanie menu liczy się źle):
  (1) czy Escape przy otwartym kole daty faktycznie zostawia profil otwarty —
  poprawka jest jednolinijkowa i kopiuje wzorzec z `PropertyMenu`, ale nie
  została zmierzona; (2) czy menu „Wstaw z szablonu" naprawdę zostaje otwarte —
  w kodzie woła `close()` przed wstawieniem, więc zgłoszenie się nie
  reprodukuje; (3) czy lista kanałów zasłaniająca checkbox faktycznie
  przeszkadza — to normalne zachowanie listy rozwijanej i nie chciałem tego
  „naprawiać" na ślepo.
- **A5** — „ZLECENIODAWCA / WYKONAWCA" w jednej rubryce na wydruku umowy.
  Treść dokumentu prawnego, nie reguła wysyłki.
- **Kafel „Przychód (ten miesiąc)"** pokazuje brutto. Decyzja produktowa do
  rozstrzygnięcia, nie usterka.
- **Moduł 54, ostatni krok** (pliki klienta na NAS) — czeka na Moduł 55, ten na
  rejestrację.
- **`CEIDG_TOKEN` w Vercelu** — bez niego Łowca leadów nie ma skąd brać
  kandydatów. Ruch właściciela.
- **Włączenie 2FA na produkcji** — silnik gotowy od Modułu 41. Drogi powrotu:
  papierowe kody zapasowe + ten sam sekret na drugim urządzeniu (NIE
  „wyłącznik w Vercelu").

## Czego NIE zaczynać bez wyraźnej prośby

- **Orchestrator propozycji AI** („Skrzynka propozycji AI") — odłożony na
  koniec. Propozycje z Fazy 3 to co innego: deterministyczne reguły, bez modelu.
- **Nowy punkt użycia lokalnego LLM** poza pięcioma zbudowanymi.
- **Zamiana istniejących automatów na propozycje** — granica jest ustalona
  i zapisana w `CLAUDE.md`.
- **Dokładanie potwierdzeń do działań odwracalnych** — reguła Fazy 4 działa
  w obie strony i jest zapisana w `CLAUDE.md`. Drobiazgi są poza listą
  świadomie.
- **Zmiana sortowania list, żeby nowe rekordy szły na górę** — rozstrzygnięte
  w Fazie 5 na „nie" (przewijamy i podświetlamy).
- **Moduł 16 — wsparcie posprzedażowe.** Do pierwszego klienta.
- **Przeprowadzka na NAS** poza etapem 1.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Uczciwa etykieta stanu

**Kompletny funkcjonalnie, przeaudytowany, nieużywany produkcyjnie.** Dwa
narzędzia, które sprawdzają DANE, a nie kod — przejście „na sucho" i kontrola
spójności na ekranie *Zdrowie* — pokazują zero. Zaplecze domknięte, wygląd
zrobiony. Czego dalej nie ma: ani jednego prawdziwego klienta, ani jednej
faktury wystawionej naprawdę. Następny krok jest nietechniczny: rejestracja
działalności.
