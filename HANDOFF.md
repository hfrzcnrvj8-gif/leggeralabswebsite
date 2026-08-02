# Handoff — stan na 2026-08-02, po Fazie 3 planu zaplecza

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- Panel: dwa ostatnie commity to „Faza 3: panel proponuje skutek zdarzenia,
  właściciel zatwierdza" i ten handoff.
- Repozytorium czyste i wypchnięte. `tsc` czysto, `npm test` **262/262**.
- `npm run przejscie`: **59 działa · 0 znanych luk · 0 regresji · 0 obejść ·
  0 pominiętych** — przy serwerze świeżo po restarcie. Kilka przebiegów pod
  rząd wyczerpuje hamulec publicznych linków (5/60 min) i wtedy wynik to
  58 działa · 3 pominięte: obie publiczne drogi (akceptacja oferty i opinia)
  idą wtedy przez panel. To zamierzone zachowanie hamulca, nie regresja —
  po `npm run dev` od nowa wraca 59.

Jeśli `git log` pokazuje co innego — ktoś pracował po drodze, sprawdź co
(`git log` PRZED `git add`; równoległa sesja już raz wchłonęła cudze zmiany).

**Lista znanych luk z pierwszego przejścia jest pusta.** Wszystkie A, B i C
zamknięte (poza A5, patrz „Otwarte poza planem"). To znaczy, że każde nowe
`⚠ ZNANA LUKA` w przejściu jest czymś, co dopiero co dołożyliśmy — a każda
`✗ REGRESJA` psuje build.

## Gdzie jesteśmy w planie

Plan: `docs/PLAN-ZAPLECZE.md`, powstał po ręcznym przejściu opisanym
w `docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`. Kolejność zatwierdzona przez
właściciela. Trzydzieści kilka znalezisk to nie trzydzieści kilka usterek,
tylko **cztery brakujące mechanizmy** — każdy objawiający się w kilku modułach
naraz.

| faza | co dowozi | stan |
|---|---|---|
| 0a | całą drogę klienta przechodzi jedno polecenie | ✅ |
| 0b | kontrola spójności jako ekran *Zdrowie* | ✅ |
| 1 | jedno przepisanie danych klienta (`lib/przepisanie.ts`) | ✅ |
| 2 | jedna bramka „czy to wolno wysłać" (`lib/bramkaWysylki.ts`) | ✅ |
| 3 | komplet skutków zdarzenia jako propozycje (`lib/propozycje.ts`) | ✅ |
| **4** | **lista działań nieodwracalnych i potwierdzenia** | **← teraz** |
| 5 | wygląd (zebrane usterki wizualne) | ⏳ |

## Co zamknęła Faza 3 — żeby nie robić tego drugi raz

- **`lib/propozycje.ts`** — trzy deterministyczne reguły (`opinia-zamyka-
  projekt`, `wygrany-lead-bez-przypomnienia`, `oplacony-klient-aktywny`).
  Reguła to **zapytanie o stan bazy**, nie wpis robiony w trasie przy
  zdarzeniu. Dzięki temu obie drogi opinii (publiczny formularz i wpis ręczny)
  rodzą tę samą propozycję, reguły działają wstecz, a „jedna na rekord"
  wychodzi z samego SQL-a.
- **W bazie tylko odrzucenia** (`propozycje_decyzje`, klucz główny na parze
  reguła+rekord). „Nie teraz" jest trwałe i na zawsze — z drogą powrotu
  („Odłożone (N) — przywróć").
- **Interfejs**: `app/[lang]/admin/Propozycje.tsx`, jedna sekcja w czterech
  ekranach — Pulpit (wszystkie) plus Leady/Klienci/Projekty (swoje).
  **Dokładając regułę, nie ruszasz ani trasy, ani interfejsu.**
- **`lib/skutkiProjektu.ts`** — komplet skutków wejścia w „Wdrożone" (oś
  klienta + dwa kontakty kontrolne). Wcześniej siedział wewnątrz `PATCH
  /api/projects/:id`, więc każda inna droga robiła połowę roboty w ciszy.
- **Granica automat/propozycja** (decyzja właściciela, teraz w `CLAUDE.md`):
  skutek wywołany Twoim kliknięciem i oczywisty → automat; skutek z zewnątrz
  albo nieoczywisty → propozycja. Akceptacja oferty dalej sama zamyka leada.
- **Ekran *Zdrowie* milczy na świadomie odłożonych** propozycjach, ale nadal
  mówi o czekających.

Szczegóły i lekcje: `HUB_SETUP.md` → „Faza 3 zaplecza", `docs/PLAN-ZAPLECZE.md`.

---

# Faza 4 — nieodwracalność i potwierdzenia

**Zamyka:** D1 (faktura bez potwierdzenia), D3 (modal nie blokuje tła),
D4 (brak „Zapisz" w Danych firmy). D2 (nowy lead ląduje poza ekranem) plan
przypisuje Fazie 5 — potwierdź to przy starcie, bo to graniczny przypadek.

Powstaje **jawna lista działań nieodwracalnych** i reguła: każde z nich pyta,
każde nie-nieodwracalne nie pyta. Dziś jest odwrotnie w najgorszym miejscu —
wystawienie faktury nadaje trwały numer w serii bez pytania, a „oznacz umowę
jako podpisaną" pyta.

Na liście na pewno: wystawienie faktury, wysłanie dokumentu do klienta,
unieważnienie linku, usunięcie czegokolwiek, wysyłka do KSeF.

## Trzy luki, które to zamyka

| nr | co się dzieje dziś |
|---|---|
| **D1** | „Wystaw fakturę" nadaje trwały numer (`FV 93/2026`) i jest nieodwracalne — zero potwierdzenia. Dla porównania „Oznacz jako podpisaną" na umowie potwierdzenia wymaga. **Mocniejsze działanie ma słabszą barierę.** |
| **D3** | Przy otwartym oknie „Nazwa kamienia milowego" da się kliknąć pigułkę *Status* pod spodem — dwie warstwy interakcji naraz |
| **D4** | „Dane firmy" mają jeden przycisk: *Zamknij*. Zapisują pole po polu, przy opuszczeniu pola — a wygląda jak formularz z OK/Anuluj |

## Co rozstrzygnąć z właścicielem NA STARCIE

Nie zgaduj — to decyzje produktowe:

1. **Co dokładnie trafia na listę nieodwracalnych?** Pięć pozycji wyżej to
   propozycja z planu, nie ustalenie.
2. **Jak wygląda potwierdzenie rzeczy naprawdę nieodwracalnej** — zwykłe
   „Na pewno?", czy mocniejsze (przepisanie numeru, wpisanie słowa)?
3. **Czy potwierdzenie da się wyłączyć** dla działań powtarzanych codziennie
   (np. wysyłka dokumentu), czy pyta zawsze.
4. **Czy „Dane firmy" dostają przycisk Zapisz** (zmiana modelu na
   OK/Anuluj), czy zostają przy zapisie pole-po-polu z wyraźnym komunikatem.

## Sprawdzenie fazy

Ta faza jest głównie o interfejsie, więc `npm run przejscie` sprawdzi mniej niż
zwykle — ale sondę da się zrobić i tu: **trasa nieodwracalnego działania nie
może wykonać go bez jawnego potwierdzenia w żądaniu.** Inaczej „potwierdzenie"
jest ozdobą interfejsu, dokładnie tak jak przed Fazą 2 bramka wysyłki mieszkała
w przyciskach zamiast w trasach.

## Jak pracować w tym repo (skrót, reszta w CLAUDE.md)

- `npm run dev` w jednym oknie, `npm run przejscie` w drugim. Dev-baza to
  PGlite w pamięci procesu — **restart serwera = czysta baza**.
- `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
  `next build` failuje w sandboxie z EPERM). **`tsc` nie wie nic o więzach
  bazy** — `NOT NULL` wychodzi dopiero z przejścia (Faza 3, `next_action`).
- `npm test` — 262 testy nad czystymi funkcjami z `lib/`.
- **Każda nowa trasa w `app/api` jest domyślnie OTWARTA** —
  `if (!(await isAuthed()))` sprawdzaj per uchwyt HTTP, nie per plik.
- Migracje w `lib/db.ts`, między `schemaUpToDate()` a `markSchemaApplied()`.
  **Zapytanie nie-DDL w migracji MUSI iść przez `inMigration()`**, inaczej
  w dev zakleszcza seeder i wszystkie `/api/*` wiszą kilkadziesiąt sekund.
- Podgląd w przeglądarce ma **zamrożony rAF** (karta „hidden"): animacje
  framer-motion nie kończą się, więc element usunięty ze stanu potrafi zostać
  w DOM. To artefakt narzędzia — rozstrzyga przeładowanie strony albo pomiar
  liczby klatek rAF, nie zrzut ekranu.
- Kończąc: `rm -f .git/index.lock && git add -A && git commit && git push`.

---

## Otwarte poza planem zaplecza (nie ruszać przy okazji)

- **Rejestracja firmy** — `PO_REJESTRACJI.md`, osiemnaście punktów. Blokuje
  KSeF test → produkcja, prawdziwe dane w nocie prawnej, plan Vercel Pro
  (Hobby zabrania użytku komercyjnego), przeprowadzkę na NAS. **To nie są
  braki do naprawienia przed rejestracją.**
- **Próg 24×24 w Katalogu** (`CatalogDashboard.tsx`) — trzeci moduł z rzędu to
  odnotowuje. Plan wciąga to do Fazy 5; nie rób przy okazji czegoś innego.
- **A5 z przejścia** — „ZLECENIODAWCA / WYKONAWCA" w jednej rubryce na wydruku
  umowy. Treść dokumentu prawnego, nie reguła wysyłki; świadomie poza Fazą 2.
- **Moduł 54, ostatni krok** (pliki klienta na NAS) — czeka na Moduł 55, ten na
  rejestrację.
- **`CEIDG_TOKEN` w Vercelu** — bez niego Łowca leadów nie ma skąd brać
  kandydatów. Ruch właściciela.
- **Włączenie 2FA na produkcji** — silnik gotowy od Modułu 41. Drogi powrotu:
  papierowe kody zapasowe + ten sam sekret na drugim urządzeniu (NIE
  „wyłącznik w Vercelu").
- **Propozycje w apce iOS** — świadomie poza Fazą 3 (decyzja właściciela).
  Trasa `/api/hub/propozycje` jest gotowa do zawołania bez zmian po stronie
  serwera; brakuje wyłącznie ekranu w SwiftUI.

## Czego NIE zaczynać bez wyraźnej prośby

- **Orchestrator propozycji AI** („Skrzynka propozycji AI") — odłożony na
  koniec. Propozycje z Fazy 3 to co innego: deterministyczne reguły, bez modelu.
- **Nowy punkt użycia lokalnego LLM** poza pięcioma zbudowanymi.
- **Zamiana istniejących automatów na propozycje** — granica jest ustalona
  i zapisana w `CLAUDE.md`.
- **Moduł 16 — wsparcie posprzedażowe.** Do pierwszego klienta.
- **Przeprowadzka na NAS** poza etapem 1.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Uczciwa etykieta stanu

**Kompletny funkcjonalnie, przeaudytowany, nieużywany produkcyjnie.** Od
2 sierpnia doszły dwa narzędzia, które sprawdzają DANE, a nie kod — przejście
„na sucho" i kontrola spójności na ekranie *Zdrowie* — i po Fazie 3 oba
pokazują zero. Czego dalej nie ma: ani jednego prawdziwego klienta, ani jednej
faktury wystawionej naprawdę. Następny krok, który realnie zmienia stan, jest
nietechniczny: rejestracja działalności.
