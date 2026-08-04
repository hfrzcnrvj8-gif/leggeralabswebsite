# Krok 3: „warunki obowiązujące" jako jedno miejsce

Robimy **krok 3** z `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`. Przeczytaj go w całości —
jest krótki, a sekcje „Dlaczego znowu nie zaczynamy od listy poprawek" i „Trzy
rzeczy, które ustawiają cały plan" są ważniejsze niż sama lista zadań. Przeczytaj
też **obie sekcje „Co się okazało przy robocie"** (krok 1 i krok 2) — to są
pułapki, które już raz kosztowały czas.

Poza tym:
- `CLAUDE.md` — zasady pracy i pułapki środowiska
- `docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`, sekcje **A6, A7, A8, C3** — znaleziska
  z dowodami (konkretne daty i kwoty z trzech rozjechanych dokumentów)

## Punkt startu

Ostatni commit `c6b6cab` „Plan: krok 2 zamknięty". Repo czyste i wypchnięte.
`tsc` czysto, `npm test` **306/306**, `npm run przejscie`
**68 działa · 0 regresji · 0 pominiętych**.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu (równoległa sesja już raz wchłonęła cudze zmiany).

## Problem jednym zdaniem

Nic w panelu nie odpowiada na pytanie **„co dla tego zlecenia obowiązuje
DZISIAJ"**. Umowa zna swoje warunki, aneks swoje, projekt ma własny termin
z szablonu, faktura kwotę z oferty. W drugim przejściu dało to trzy dokumenty
z trzema różnymi terminami (25.08 / 15.09 / 22.09) i fakturę na 11 000 zł przy
podpisanym aneksie na 15 000 zł — i **nic tego nie oznaczyło jako problemu**.

## Co jest do zrobienia

1. **`lib/warunkiObowiazujace.ts` — jedna funkcja.** Dla zlecenia (umowa + jej
   aneksy w kolejności) zwraca aktualną cenę, zakres, termin **i numer
   dokumentu, z którego pochodzą**. Ten ostatni element zamyka A7. Uwaga:
   logika „bierz z ostatniego PODPISANEGO aneksu, nie z pierwotnej umowy" już
   istnieje — siedzi zaszyta w `app/api/contracts/[id]/aneks/route.ts` (zmienna
   `obowiazujace`). Wyciągnij ją stamtąd zamiast pisać drugą kopię.
2. **A7 — aneks powołuje się na dokument, w którym tej treści nie ma.** Przyczyna
   jest jednolinijkowa i już ją zlokalizowałem: w `aneks/route.ts` blok
   `poprzednie` bierze **wartości** z `obowiazujace` (ostatni podpisany aneks),
   ale `reference` z `src` (zawsze umowa-matka). Aneks nr 2 cytuje więc kwotę
   z aneksu nr 1, a w nagłówku powołuje się na umowę, w której tej kwoty nie ma.
   Kto zweryfikuje aneks przeciwko dokumentowi, który on sam wskazuje, znajdzie
   rozbieżność.
3. **A6 — projekt bierze termin przy podpisie.** To też **nie jest brak
   mechanizmu**: `projektPoPodpisieUmowy()` w `lib/przepisanie.ts` istnieje,
   jest wołany z obu tras podpisu i ustawia termin — ale **tylko gdy projekt go
   nie ma** (`const termin = tekst(p.termin) ? null : …`). Szablon projektu
   wstawia własny termin wcześniej, więc warunek nigdy nie jest spełniony.
   To jest decyzja do podjęcia, nie usterka do naprawienia — patrz „Do
   rozstrzygnięcia" niżej. Edytor oferty obiecuje to wprost („projekt weźmie ją
   przy podpisie"), więc albo dotrzymujemy obietnicy, albo usuwamy zdanie.
4. **A8 — propozycja przy rozjeździe faktury** (decyzja właściciela 2 z planu:
   PROPOZYCJA, nie automat). „Aneks nr 1 zmienił wynagrodzenie na 15 000 zł —
   poprawić szkic faktury?" na Pulpicie i przy samej fakturze, w tym samym
   kształcie co reszta `lib/propozycje.ts`. Dodatkowo rubryka „WYNIKA Z" na
   fakturze ma wymieniać **aneks**, a nie tylko ofertę i umowę.
5. **Dwie nowe reguły w *Zdrowiu*** (`lib/spojnosc.ts`): „termin projektu zgadza
   się z obowiązującą umową" i „kwota szkicu faktury zgadza się z obowiązującymi
   warunkami". Istniejąca reguła `projekt-z-podpisana-umowa-bez-terminu`
   przechodzi mimo rozjazdu, bo sprawdza `p.termin IS NULL` — czyli OBECNOŚĆ
   daty, nie jej zgodność.
6. **(Opcjonalnie) C3** — „Sporządź aneks" także na podpisanym aneksie. Po
   poprawieniu referencji (pkt 2) nie jest to już konieczne; do rozstrzygnięcia,
   czy warto.

## Do rozstrzygnięcia z właścicielem (zapytaj wprost, na starcie)

- **Co wygrywa przy podpisie umowy: termin z umowy czy termin z szablonu
  projektu?** Plan proponuje „termin z umowy wygrywa, kamienie milowe z szablonu
  skalują się do niego, a jeśli się nie mieszczą — projekt dostaje ostrzeżenie
  zamiast cichego rozjazdu". To jest propozycja, nie decyzja. Zapytaj, zanim
  zaczniesz — od odpowiedzi zależy kształt punktów 3 i 5.
- **Czy nadpisanie terminu projektu to automat, czy propozycja?** Granica
  z `CLAUDE.md`: skutek wywołany świadomym kliknięciem właściciela i oczywisty
  = automat. Podpis umowy jest kliknięciem właściciela, ale nadpisanie daty,
  którą wstawił szablon, oczywiste już nie jest.

## Jak pracować (to się sprawdziło w krokach 1 i 2)

- **Sprawdź, czy mechanizm naprawdę nie istnieje, zanim go napiszesz.** W kroku 3
  DWA z czterech znalezisk to nie brak mechanizmu, tylko warunek zawężony do
  jednego przypadku (`if (!p.termin)`) albo jedna linijka biorąca dane z innego
  źródła niż sąsiednie (`reference: contractReference(src)`). Napisanie nowej
  warstwy obok byłoby trzecią kopią tej samej reguły.
- **Warunek pisz przez wyliczenie dozwolonego, nie wykluczanie zakazanego.**
  `status != 'Podpisana'` przepuszczało umowę odrzuconą; `status = 'Wysłana'`
  nie przepuszcza niczego, czego nie wymieniono.
- **Wspólna funkcja to za mało, jeśli strony dostają inne dane.** Sprawdzone dwa
  razy pod rząd: publiczny GET filtruje pola białą listą (`lib/publicFields.ts`),
  więc wydruk u klienta liczy z innego zestawu pól niż panel. Wartość wyliczaną
  dokładaj w TRASIE — w obu trasach, tą samą funkcją — jako gotowe pole, zamiast
  liczyć ją w komponencie wydruku. Wzór: `poprzednie_wiadomosci` w
  `/api/invoices/[id]` i `/api/invoices/wezwanie/public/[token]`.
- **Dowodem jest to, co widać na dokumencie i w danych**, nie to, że kod wygląda
  dobrze. Wydruki są renderowane po stronie klienta, więc `curl` na HTML nic nie
  pokaże — otwórz stronę w podglądzie i czytaj `get_page_text`.
- **Dev-baza kasuje się przy każdym przeładowaniu modułów serwera** (PGlite żyje
  w procesie). Po edycji pliku w `lib/` albo `app/api/` scenariusz trzeba
  odtworzyć — miej to w skrypcie. Dane wystawcy też znikają, a bramka wysyłki
  bez nich blokuje.
- **`POST /api/offers` i `POST /api/contracts` nie zapisują wszystkich pól
  z body** (m.in. `klient_email`, `zakres_prac`) — dopisuj je osobnym `PATCH`.
- **Hamulec publicznych dokumentów to 5 prób / 60 min na adres IP.** Testując
  publiczne trasy, podawaj różne `x-forwarded-for`.
- **W tym podglądzie `requestAnimationFrame` daje 0 klatek** (karta jest
  `hidden`), więc menu i modale mają `opacity: 0`, choć są otwarte i klikalne.
  Sprawdzaj przez `innerText` / `aria-*`, nie przez zrzut ekranu. To artefakt
  środowiska, nie usterka — zmierzone w kroku 2.
- Po każdej paczce zmian: `npx tsc --noEmit -p tsconfig.json`, `npm test`,
  `npm run przejscie`. Ostatnie musi pokazać **0 regresji i 0 pominiętych**.

## Czego NIE robić

- Nie bierz się przy okazji za krok 4 ani 5. Krok 3 to warunki obowiązujące —
  nic więcej.
- Nie zamieniaj istniejących automatów na propozycje bez pytania (granica
  z `CLAUDE.md`, sekcja „Panel proponuje, właściciel zatwierdza").
- Nie zmieniaj treści klauzul umownych ani wzoru aneksu poza tym, o co proszę.
  Dokumenty czekają na prawnika — `docs/DO-PRAWNIKA-I-TLUMACZA.md`.
- Nie dopisuj sprawdzeń do `przejscie.ts` na drogę porażki — to jest krok 5.

## Na koniec

Zaktualizuj tabelę w `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` (krok 3 → ✅ z numerem
commita) i dopisz sekcję „Co się okazało przy robocie", tak jak przy krokach 1
i 2 — zwłaszcza to, co Cię zaskoczyło. Dopisz też sekcję do `HUB_SETUP.md`.

Podaj polecenia do commita i pusha oraz skasuj ten plik (`PROMPT-KROK-3.md`).

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
