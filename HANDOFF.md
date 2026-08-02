# Handoff — stan na 2026-08-02, po Fazie 4 planu zaplecza

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- Panel: dwa ostatnie commity to „Faza 4: co nieodwracalne — pyta, co
  odwracalne — nie pyta" i ten handoff.
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

## Gdzie jesteśmy w planie

Plan: `docs/PLAN-ZAPLECZE.md`, powstał po ręcznym przejściu opisanym
w `docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`. Trzydzieści kilka znalezisk to nie
trzydzieści kilka usterek, tylko **cztery brakujące mechanizmy** — każdy
objawiający się w kilku modułach naraz. Wszystkie cztery są już zbudowane.

| faza | co dowozi | stan |
|---|---|---|
| 0a | całą drogę klienta przechodzi jedno polecenie | ✅ |
| 0b | kontrola spójności jako ekran *Zdrowie* | ✅ |
| 1 | jedno przepisanie danych klienta (`lib/przepisanie.ts`) | ✅ |
| 2 | jedna bramka „czy to wolno wysłać" (`lib/bramkaWysylki.ts`) | ✅ |
| 3 | komplet skutków zdarzenia jako propozycje (`lib/propozycje.ts`) | ✅ |
| 4 | lista działań nieodwracalnych (`lib/nieodwracalne.ts`) | ✅ |
| **5** | **wygląd — zebrane usterki wizualne** | **← teraz, OSTATNIA** |

## Co zamknęła Faza 4 — żeby nie robić tego drugi raz

- **`lib/nieodwracalne.ts`** — jawna lista 22 działań i reguła działająca
  w obie strony: **co nieodwracalne — pyta, co odwracalne — nie pyta.**
  Dwa poziomy: *zwykłe* („Na pewno?") i *mocne* (przepisanie frazy — tylko
  wystawienie faktury, KSeF, usunięcie klienta i projektu, masowe usunięcie
  klientów).
- **Bariery pilnuje TRASA**, nie przycisk. Bez nagłówka `x-potwierdzenie`
  trasa oddaje **428** z opisem, a panel dopiero z tej odpowiedzi buduje okno.
  Panel FIZYCZNIE nie wie, co jest nieodwracalne — więc lista nie może
  rozjechać się na dwie kopie.
- **Wymagana fraza nie jedzie w odpowiedzi** — tylko jej etykieta. Wartość do
  pokazania podaje panel, **porównuje serwer** z danych w bazie.
- **`useUI().zadanie(url, opcje)`** — jedno wejście dla całego panelu, okno
  renderowane raz w `AdminUIProvider`. Nie owijaj go `confirm()`-em.
- **D3**: okno blokowało mysz, ale nie klawiaturę (44 elementy tła osiągalne
  tabulatorem). Naprawione `inert`-em na treści panelu — działa niezależnie od
  z-indeksów, a menu panelu siedzą wyżej niż te okna.
- **D4**: „Dane firmy" mają Zapisz i Anuluj; zamknięcie z niezapisanymi pyta.
- **Przy okazji**: `lib/shareLinks.ts` czytał nieistniejące kolumny — „skopiuj
  link do formularza opinii" kończyło się 500. Naprawione.

Szczegóły i lekcje: `HUB_SETUP.md` → „Faza 4 zaplecza", `docs/PLAN-ZAPLECZE.md`.

**Dług, który ta faza świadomie zostawiła:** apka iOS nie potwierdza tych
działań, więc wystawienie faktury, wysyłka dokumentu i usunięcie rekordu
**z telefonu wracają dziś z 428 i nie robią nic**. To wybór właściciela
(„szczelnie od razu", bez furtki dla apki), nie przeoczenie. Brief gotowy:
`docs/natywna-aplikacja/35-brief-potwierdzenia.md`.

---

# Faza 5 — wygląd

**Ostatnia faza planu.** Zgodnie z ustaleniem wygląd idzie na koniec — dopiero
gdy zaplecze działa w całości. Teraz działa: przejście na zielono, ekran
*Zdrowie* bez naruszeń, lista luk pusta.

## Co jest do zrobienia (zebrane, żeby nie zginęły)

| nr | co |
|---|---|
| **E1** | `.glass` traci `backdrop-filter` w **zbudowanym** CSS (zostaje tylko `-webkit-`) → chrome bez rozmycia. Przyczyna leży w buildzie, nie w źródle — `app/globals.css:105` deklaruje obie właściwości |
| **E2** | okna `useUI().confirm/prompt` renderują się poza `.admin-linear` i są **jasne** w ciemnym panelu |
| **E3** | wiersz „Daty" wychodzi poza kartę projektu (`x` 1030–1113 wobec karty do 1102) |
| **E4** | nazwa kamienia milowego ucięta w pół słowa, bez wielokropka |
| **D2** | nowy lead ląduje poza ekranem: trafia na 10. pozycję z 11 (sortowanie po „ostatni kontakt", nowy nie ma żadnego), lista się nie przewija, nic go nie podświetla. **Przeniesione tu z Fazy 4 decyzją właściciela** — to zachowanie listy, nie bariera |
| **F** | otwarty próg 24×24 w Katalogu (`CatalogDashboard.tsx`) — trzeci moduł z rzędu to odnotowuje |

## Uwagi, które mają realny wpływ na kształt pracy

- **Podgląd w przeglądarce ma zamrożony rAF** (karta „hidden"): animacje
  framer-motion nie kończą się, więc element usunięty ze stanu potrafi zostać
  w DOM, a `opacity` bywa 0. Rozstrzyga przeładowanie strony albo pomiar
  liczby klatek rAF, **nie zrzut ekranu**.
- **Świeżo otwarta karta podglądu bywa 0×0** (`innerWidth: 0`) i wtedy każdy
  pomiar geometrii kłamie — `h-6 w-6` mierzy się jako 17×24 i wygląda jak
  usterka klikalności, którą nie jest. Otwórz NOWĄ kartę (`tabs_create`)
  i sprawdź `innerWidth`, zanim cokolwiek zmierzysz.
- **E2 dotyka teraz także okna potwierdzenia** z Fazy 4 — renderuje się w tym
  samym miejscu co confirm/prompt. Poprawiając E2, sprawdź wszystkie cztery
  okna `AdminUIProvider`, nie trzy.
- **Kontrast mierz, nie zgaduj** (`getComputedStyle`), i pamiętaj, że pierwszy
  `<span>` bywa opakowaniem `display: contents` — mierz najgłębszy węzeł.
- **Tailwind nie generuje reguł dla `bg-[var(--x)]/40`** — krycie na zmiennej
  CSS cicho nie działa (86 martwych klas znalezionych wcześniej). Rozstrzyga
  `getComputedStyle`, nie wygląd w kodzie.

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

## Otwarte poza planem zaplecza (nie ruszać przy okazji)

- **Potwierdzenia w apce iOS** — patrz wyżej, brief gotowy. To jedyny dług
  zostawiony przez Fazę 4 i jedyna rzecz, która dziś DZIAŁA GORZEJ niż przed
  nią (z telefonu).
- **Rejestracja firmy** — `PO_REJESTRACJI.md`, osiemnaście punktów. Blokuje
  KSeF test → produkcja, prawdziwe dane w nocie prawnej, plan Vercel Pro
  (Hobby zabrania użytku komercyjnego), przeprowadzkę na NAS. **To nie są
  braki do naprawienia przed rejestracją.**
- **A5 z przejścia** — „ZLECENIODAWCA / WYKONAWCA" w jednej rubryce na wydruku
  umowy. Treść dokumentu prawnego, nie reguła wysyłki; świadomie poza Fazą 2.
- **Moduł 54, ostatni krok** (pliki klienta na NAS) — czeka na Moduł 55, ten na
  rejestrację.
- **`CEIDG_TOKEN` w Vercelu** — bez niego Łowca leadów nie ma skąd brać
  kandydatów. Ruch właściciela.
- **Włączenie 2FA na produkcji** — silnik gotowy od Modułu 41. Drogi powrotu:
  papierowe kody zapasowe + ten sam sekret na drugim urządzeniu (NIE
  „wyłącznik w Vercelu").
- **Propozycje w apce iOS** — świadomie poza Fazą 3. Trasa
  `/api/hub/propozycje` gotowa; brakuje wyłącznie ekranu w SwiftUI.

## Czego NIE zaczynać bez wyraźnej prośby

- **Orchestrator propozycji AI** („Skrzynka propozycji AI") — odłożony na
  koniec. Propozycje z Fazy 3 to co innego: deterministyczne reguły, bez modelu.
- **Nowy punkt użycia lokalnego LLM** poza pięcioma zbudowanymi.
- **Zamiana istniejących automatów na propozycje** — granica jest ustalona
  i zapisana w `CLAUDE.md`.
- **Dokładanie potwierdzeń do działań odwracalnych** — reguła Fazy 4 działa
  w obie strony i jest zapisana w `CLAUDE.md`. Drobiazgi są poza listą
  świadomie.
- **Moduł 16 — wsparcie posprzedażowe.** Do pierwszego klienta.
- **Przeprowadzka na NAS** poza etapem 1.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Uczciwa etykieta stanu

**Kompletny funkcjonalnie, przeaudytowany, nieużywany produkcyjnie.** Dwa
narzędzia, które sprawdzają DANE, a nie kod — przejście „na sucho" i kontrola
spójności na ekranie *Zdrowie* — po Fazie 4 dalej pokazują zero. Zaplecze jest
domknięte; zostaje wygląd. Czego dalej nie ma: ani jednego prawdziwego
klienta, ani jednej faktury wystawionej naprawdę. Następny krok, który realnie
zmienia stan, jest nietechniczny: rejestracja działalności.
