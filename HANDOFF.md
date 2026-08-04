# Handoff — stan na 2026-08-05, po ZAMKNIĘCIU planu z drugiego przejścia

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- Na wierzchu **`f2c48e8`** „Plan: krok 5 zamknięty, plan po drugim przejściu
  domknięty", pod nim **`3a42f75`** „Krok 5: drobiazgi i harness na drogę
  porażki (A3, C1, D1, D2, D5, D6)".
- Repozytorium czyste i wypchnięte. `tsc` czysto, `npm test` **340/340**.
- `npm run przejscie`: **101 działa · 0 znanych luk · 0 regresji · 0 obejść ·
  0 pominiętych**. Od kroku 5 wynik jest **powtarzalny** — dwa i trzy biegi pod
  rząd dają to samo (wcześniej drugi bieg tracił drogę klienta na godzinę, bo
  udane żądania też zjadały hamulec). Sufit: łączny limit hamulca (60/60 min)
  ogranicza to do ~5 przebiegów na godzinę; po `npm run dev` od nowa wraca
  komplet.

Jeśli `git log` pokazuje co innego — ktoś pracował po drodze, sprawdź co
(`git log` PRZED `git add`; równoległa sesja już raz wchłonęła cudze zmiany).

**Obie listy znanych luk są puste** (pierwsze i drugie przejście). Każde nowe
`⚠ ZNANA LUKA` w przejściu jest czymś, co dopiero co dołożyliśmy — a każda
`✗ REGRESJA` psuje build.

## Oba plany są ZAMKNIĘTE

| plan | powstał po | fazy / kroki | stan |
|---|---|---|---|
| `docs/PLAN-ZAPLECZE.md` | pierwsze przejście „na sucho" (droga, która się UDAJE) | 0a–5 | ✅ 2026-08-02 |
| `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` | drugie przejście (droga, która się NIE udaje) | 1–5 | ✅ 2026-08-05 |

Każdy z nich ma na końcu pliku **podsumowanie całości** — lekcje, które przeżyją
plan, i pełną listę tego, czego świadomie nie zrobił. Drugi plan ma tam też
propozycję, czym powinno być **trzecie przejście**.

W skrócie: 22 znaleziska drugiego przejścia to były **cztery brakujące
mechanizmy** — publiczny dokument zna swój stan, szablon mówi tylko to, co
potwierdzają dane, „warunki obowiązujące" jako jedno miejsce, porażka jest
zdarzeniem jak każde inne. Plus sześć drobiazgów kroku 5, nowa powierzchnia dla
klienta (odrzucenie oferty ze swojej strony) i jedna zmiana w hamulcu.

## Co jest następnym krokiem

**1. Apka iOS — jedna spójna paczka roboty.** To jest najbardziej gotowa rzecz
do zrobienia i jedyna, która urosła przez cztery kroki z rzędu. **Trasy oddają
komplet, brakuje wyłącznie ekranów w SwiftUI.** Zebrane:

| skąd | czego brakuje w apce | co serwer już oddaje |
|---|---|---|
| Faza 3 zaplecza | ekran „Propozycje" | `/api/hub/propozycje` |
| krok 2 | rozwijacz poziomu windykacji | `/api/invoices/:id/remind` przyjmuje `poziom` |
| krok 3 | propozycja o rozjeździe z aneksem, rubryka „WYNIKA Z" z aneksem | `faktura-wg-obowiazujacych-warunkow` |
| krok 4 | druga akcja propozycji, dwie sekcje Pulpitu | `akcjaAlt`, `decyzja: "zrob-alt"`, `projektyZagrozone`, `zapomnianeSzkiceUmow` |
| krok 5 | odrzucenie oferty przez klienta, karta „Odpowiedź na wersję N" | `POST /api/offers/public/:token/reject`, `poprzednia` w `GET /api/offers/:id` |

Brief na sam pierwszy wiersz jest gotowy od 2026-08-02
(`docs/natywna-aplikacja/36-brief-propozycje.md`, do wklejenia:
`PROMPT-APKA-PROPOZYCJE.md` w korzeniu — **sprawdź najpierw w repozytorium apki,
czy nie został już zużyty**, plik nie został skasowany). Reszta tabeli briefu
nie ma. **Rozsądny ruch: napisać JEDEN brief na całą paczkę**, zamiast pięciu
osobnych czatów — to ten sam obszar kodu i te same wzorce.

Najważniejsze z gotowego briefu, żeby nie zginęło: `/api/hub/today` **już**
zwraca pole `propozycje`, a apka je wyrzuca, bo `PulpitDzis` go nie dekoduje —
dla Pulpitu nie trzeba ani jednego nowego żądania. `PulpitDzis` ma ręczny
`init(from:)`, więc nowe pole = trzy miejsca (patrz pamięć: „Swift: opcjonalny
var zawsze nil").

**2. Trzecie przejście „na sucho"** — jeśli wolisz iść dalej sprawdzaniem niż
budowaniem. Propozycja zakresu stoi na końcu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`:
(a) oczami klienta w PRAWDZIWEJ przeglądarce, na telefonie i desktopie, po
polsku i po niemiecku; (b) drugi rok obrotowy (numeracja, retencja, faktury
cykliczne przez zmianę roku); (c) awarie i brzegi. **Czego robić NIE musi:
przechodzić ręcznie tego, co robi `npm run przejscie`.**

**3. Rejestracja firmy** — odłożona decyzją właściciela do odwołania. To jest
jedyny krok, który realnie zmienia stan projektu, i jest nietechniczny.

## Jak pracować w tym repo (skrót, reszta w CLAUDE.md)

- `npm run dev` w jednym oknie, `npm run przejscie` w drugim. Dev-baza to
  PGlite w pamięci procesu — **restart serwera = czysta baza** (i nowe id
  rekordów, więc stare linki przestają działać).
- `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
  `next build` failuje w sandboxie z EPERM). **`tsc` nie wie nic o więzach
  bazy** ani o SQL-u w szablonach.
- `npm test` — 340 testów nad czystymi funkcjami z `lib/`.
- **Każda nowa trasa w `app/api` jest domyślnie OTWARTA** —
  `if (!(await isAuthed()))` sprawdzaj per uchwyt HTTP, nie per plik.
- **Podgląd w środowisku Claude to karta ukryta 0×0**: `requestAnimationFrame`
  daje zero klatek, `read_page` zwraca pustą stronę, menu i modale mają
  `opacity: 0`, choć są otwarte i klikalne. Sprawdzaj przez `innerText` /
  `aria-*` / `getComputedStyle`, nie przez zrzut ekranu.
- Kończąc: `rm -f .git/index.lock && git add -A && git commit && git push`.

---

## Co jest otwarte (nie ruszać przy okazji)

- **Rejestracja firmy** — `PO_REJESTRACJI.md`, osiemnaście punktów. Blokuje KSeF
  test → produkcja, prawdziwe dane w nocie prawnej, plan Vercel Pro (Hobby
  zabrania użytku komercyjnego), przeprowadzkę na NAS. **To nie są braki do
  naprawienia przed rejestracją.**
- **Warstwa wizualna obu przejść** — żadne z nich jej nie sprawdzało, bo w tym
  środowisku pomiary byłyby zgadywaniem. Wymaga prawdziwej przeglądarki.
  Konkretnie zostały z tego trzy rzeczy z sekcji F pierwszego przejścia:
  (1) czy Escape przy otwartym kole daty zostawia profil otwarty; (2) czy menu
  „Wstaw z szablonu" naprawdę zostaje otwarte; (3) czy lista kanałów
  zasłaniająca checkbox faktycznie przeszkadza.
- **A5 z pierwszego przejścia** — „ZLECENIODAWCA / WYKONAWCA" w jednej rubryce
  na wydruku umowy, a role są dwie. Treść dokumentu prawnego, nie reguła
  wysyłki.
- **Kafel „Przychód (ten miesiąc)"** pokazuje brutto. Decyzja produktowa do
  rozstrzygnięcia, nie usterka.
- **Czy porzucenie świeżo zeskanowanego paragonu ma pytać** — `koszt-usun` jest
  na liście nieodwracalnych, więc „Anuluj" w skanerze prosi o potwierdzenie
  usunięcia szkicu. Trasa nie odróżnia szkicu sprzed minuty od kosztu sprzed
  miesiąca. Decyzja po stronie panelu, do rozstrzygnięcia.
- **Jeden przebieg kontrolny potwierdzeń na PRODUKCJI** (atrapa klienta →
  usunięcie tą samą drogą) — nie da się go wykonać stąd, bo apka w DEBUG celuje
  w produkcję, a wejście wymaga hasła wpisanego na urządzeniu. Ruch właściciela.
- **Moduł 54, ostatni krok** (pliki klienta na NAS) — czeka na Moduł 55, ten na
  rejestrację.
- **`CEIDG_TOKEN` w Vercelu** — bez niego Łowca leadów nie ma skąd brać
  kandydatów. Ruch właściciela.
- **Włączenie 2FA na produkcji** — silnik gotowy od Modułu 41. Drogi powrotu:
  papierowe kody zapasowe + ten sam sekret na drugim urządzeniu (NIE
  „wyłącznik w Vercelu").
- **Osierocony katalog `.claude/worktrees/fervent-ishizaka-7aec37/`** po
  porzuconej sesji — ma starą kopię `lib/offers.ts` i myli `grep`. Git go
  ignoruje. Do skasowania przy okazji.

## Czego NIE zaczynać bez wyraźnej prośby

- **Orchestrator propozycji AI** („Skrzynka propozycji AI") — odłożony na
  koniec. Propozycje z Fazy 3 to co innego: deterministyczne reguły, bez modelu.
- **Nowy punkt użycia lokalnego LLM** poza pięcioma zbudowanymi.
- **Zamiana istniejących automatów na propozycje** — granica jest ustalona
  i zapisana w `CLAUDE.md`.
- **Dokładanie potwierdzeń do działań odwracalnych** — reguła Fazy 4 działa
  w obie strony i jest zapisana w `CLAUDE.md`.
- **Rozpychanie `OFFER_STATUSES`** (np. o „Zastąpiona") — rozstrzygnięte
  2026-08-05 na „nie": fakt zastąpienia niesie `superseded_at`, a nowa wartość
  dotknęłaby mapy koloru, filtra, wagi w pipelinie i bliźniaczej mapy w apce.
- **Rozluźnianie hamulca publicznych dokumentów „bo przeszkadza w sondzie"** —
  próg 5/60 min jest decyzją z Audytu 1. Krok 5 zmienił WYŁĄCZNIE to, co się
  liczy (pomyłki zamiast wszystkiego) i że sukces zeruje licznik.
- **Zmiana sortowania list, żeby nowe rekordy szły na górę** — rozstrzygnięte
  w Fazie 5 na „nie" (przewijamy i podświetlamy).
- **Moduł 16 — wsparcie posprzedażowe.** Do pierwszego klienta.
- **Przeprowadzka na NAS** poza etapem 1.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Uczciwa etykieta stanu

**Kompletny funkcjonalnie, przeaudytowany, nieużywany produkcyjnie.** Trzy
narzędzia, które sprawdzają DANE, a nie kod — przejście „na sucho" (101 zdań,
obie drogi), kontrola spójności na ekranie *Zdrowie* i `error_log` — pokazują
zero. Zaplecze domknięte na obu drogach, wygląd zrobiony na desktopie.

Czego dalej nie ma: ani jednego prawdziwego klienta, ani jednej faktury
wystawionej naprawdę, ani jednego sprawdzenia wyglądu w prawdziwej przeglądarce.
Następny krok, który zmienia stan projektu, jest nietechniczny: rejestracja
działalności.
