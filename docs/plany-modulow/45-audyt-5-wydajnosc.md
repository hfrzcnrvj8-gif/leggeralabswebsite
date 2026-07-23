# Brief: Audyt 5 — Wydajność i koszty

> Brief wdrożeniowy pod **jeden osobny czat**. To nie jest nowy plan — to
> **wykonanie Audytu 5** z `docs/AUDYTY-KONCOWE.md`. Tamten dokument jest
> zakresem, ten mówi, jak go przejechać i co już wiadomo (zmierzone gretem
> 2026-07-23, nie przepisane z pamięci — **zweryfikuj ponownie**).
>
> Powstał 2026-07-23, po domknięciu Audytu 6 (poprawność kodu).

## Dlaczego ten audyt jest teraz

Kolejność w `AUDYTY-KONCOWE.md` jest wg ryzyka: **4 → 1 → 3 → 2 → 6 → 5 → 7**.
Pięć domknięte (obserwowalność, bezpieczeństwo, niezawodność, RODO, kod).
Audyt 5 jest przedostatni, bo dotyczy nie „czy działa" i „czy bezpieczne", ale
**czy da się to utrzymać finansowo i czasowo, gdy przyjdzie prawdziwy ruch** —
pytanie, które staje się realne dopiero, gdy reszta jest pewna.

**Pytanie audytu, słowami właściciela:** „ile to kosztuje miesięcznie, zanim
przyjdzie pierwszy rachunek" i „czy coś zbliża się do limitu, zanim się o niego
uderzy".

## Stan zastany — zmierzony gretem 2026-07-23 (zweryfikuj, nie ufaj na słowo)

| Co | Stan na 2026-07-23 |
|---|---|
| **Crony** | **2 / 2** — limit planu Hobby wyczerpany (`vercel.json`: dzienny raport 6:00, kolejka wysyłki 8:00). Nadzór doczepiony do istniejących, nie ma własnego (Audyt 4, ust. 5) |
| **Zapytania na Pulpicie** (`/api/hub/today`) | **9 `ensure*Schema()` + 13 zapytań SQL** na wejście. Bramka migracji (2026-07-15) miała to ściąć — **sprawdź, czy nie odrosło** |
| **Zapytania w dziennym cronie** (`/api/leads/notify`) | **11 `ensure*Schema()` + 23 zapytania SQL** |
| **`neon()`** | **1 żądanie HTTP na zapytanie** — to główny mnożnik czasu i kosztu przy zimnym starcie |
| **`maxDuration`** | ustawia **15 tras**: 11× 60 s, **2× 120 s, 1× 90 s**, 1× 30 s. **Uwaga-trop:** plan Hobby tnie funkcje do **60 s** — deklaracje 120/90 s mogą być **po cichu nieegzekwowane**, a funkcja przekraczać limit bez objawu (podejrzani: sync IMAP, załączniki, KSeF, OCR) |
| **Rozmiar bazy / rachunki** | **poza zasięgiem Claude** — baza produkcyjna, panele Neon/Vercel/Resend/Apple są u właściciela. Ta część audytu to **pomiary właściciela + zebranie liczb**, nie grep |

## Zakres — co ma powstać (za `AUDYTY-KONCOWE.md` → „Audyt 5")

To **audyt**, nie moduł: większość wyniku to **pomiary, liczby i decyzje**,
minimum kodu.

1. **Zapytania do bazy na zimny start.** Zmierz, ile realnie zapytań idzie na
   Pulpit i listę Poczty (bramka migracji miała to ściąć do ~1 na schemat).
   Sprawdź, **czy nie odrosło** — grep po `ensure*Schema()` i `await sql` w
   najcięższych trasach, najlepiej z realnym pomiarem czasu (dev-serwer + log).
2. **Czas funkcji wobec limitu.** Zmierz najwolniejsze trasy (sync IMAP,
   pobieranie załączników). **Rozstrzygnij trop `maxDuration` 120/90 s na
   Hobby** — czy Vercel je honoruje, czy tnie do 60 s (dokumentacja + realny
   przebieg). Jeśli tnie, to cichy limit do udokumentowania przed Pro.
3. **Rozmiar bazy wobec progów Neona** — i co się stanie po przekroczeniu
   darmowego planu. **Liczbę poda właściciel** (panel Neon).
4. **Rachunek całości.** Vercel Pro (po rejestracji), Neon, Resend, Apple
   Developer. **Właściciel ma znać sumę miesięczną, zanim przyjdzie pierwszy
   rachunek** — zbierz pozycje i widełki. To główny produkt „ludzki" audytu.
5. **Apka natywna:** zużycie baterii i transferu przy odpytywaniu (polling).
   Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios` (jak w Audycie 6).
6. **`docs/AUDYT-5-WYNIKI.md`** — główny produkt, wzorem `AUDYT-1/2/3/4/6-WYNIKI.md`:
   ustalenia wg ryzyka, „sprawdzone i jest dobrze", „jak zweryfikowano", co
   otwarte, czego audyt NIE obejmował.

## Co ROZSTRZYGNĄĆ z właścicielem (nie decyduj sam)

Właściciel nie programuje — pytaj wprost, po polsku, bez żargonu.

1. **Liczby, których Claude nie zmierzy stąd:** rozmiar bazy (panel Neon),
   bieżące zużycie planów, ceny, które widzi w swoich panelach. Poproś o nie
   wprost — to nie jest coś, co da się zgrepować.
2. **Próg przejścia na Vercel Pro.** Już zapadło „z czasem przejdę"
   (`PO_REJESTRACJI.md` pkt 13). Audyt ma dać **konkretny sygnał**: co dokładnie
   wymusi Pro (limit cronów? czas funkcji 60→300 s? komercyjny użytek?) i przy
   jakim ruchu.
3. **Czy optymalizować cokolwiek TERAZ.** Jeśli przy jednym użytkowniku i zerze
   klientów nic nie jest wolne ani drogie, **odpowiedzią może być „nic nie rób,
   tylko wiedz, gdzie są progi"** — to jest poprawny wynik audytu, nie porażka.

## Weryfikacja — pomiar, nie założenie (zasada z pięciu audytów)

„Zielony build nie jest dowodem". Tu dodatkowo: **liczba zapytań i czas to rzeczy
do ZMIERZENIA, nie do oszacowania z kodu.**

1. **Zapytania licz uruchomieniem** — dev-serwer (PGlite) + log zapytań albo
   licznik, nie „naliczyłem z grepa 13".
2. **`maxDuration` na Hobby — sprawdź w dokumentacji Vercela ORAZ realnym
   przebiegiem**, nie z samej wartości w kodzie (deklaracja ≠ egzekwowanie).
3. **Koszty — z prawdziwych cenników i paneli właściciela**, nie z pamięci
   modelu (ceny się zmieniają; pamięć modelu ma datę graniczną).
4. `npx tsc --noEmit` po każdej paczce kodu (jeśli w ogóle jakiś powstanie).
   Jest też `npm test` (Audyt 6) — jeśli ruszasz regułę, dopisz/uruchom test.

## Zasady prowadzenia (nie powtarzaj cudzej roboty)

- **Przeczytaj najpierw ustalenia poprzednich audytów** (`AUDYT-1/2/3/4/6-WYNIKI.md`)
  i pamięć projektu. Bramka migracji, limit 2 cronów, `neon()` = 1 HTTP/zapytanie
  — to **już opisane**, nie odkrywaj drugi raz.
- **Weryfikuj pomiarem, nie pamięcią.** Ceny i limity planów zmieniają się;
  liczba zapytań to pomiar, nie szacunek.
- **Nie optymalizuj na zapas.** Przy jednym użytkowniku „za wolno" może w ogóle
  nie istnieć. Pytanie brzmi „gdzie są progi i kiedy w nie uderzymy", nie „jak
  by to przyspieszyć".
- **Nie odkrywaj na nowo świadomych decyzji** (`CLAUDE.md` → „Świadome decyzje").
- **Produkcyjna baza, panele Neon/Vercel/Resend/Apple i NAS — poza zasięgiem
  Claude.** Co ich dotyka, oznacz „⏳ do wykonania przez właściciela".
- **Jeden audyt = jeden czat.** Nie wchodź w Audyt 7.

## Środowisko

`npm run dev`, logowanie pominięte (`DEV_ADMIN_BYPASS` w `.env.local`), dane
z PGlite (`lib/dev-db.ts`). `npm test` dostępne (Audyt 6). Panel `/admin` jest
jednomotywowy — ciemny. Apka: repo `leggera-hub-ios`.

## Po zakończeniu

Zaktualizuj `docs/AUDYTY-KONCOWE.md` (odhacz Audyt 5, wskaż następny — **Audyt 7:
czy to nadal jest ten produkt**), odhacz w `docs/plany-modulow/README.md`, zapisz
istotne decyzje w pamięci i podaj właścicielowi komendę do commita. Pozycje
finansowe/porejestracyjne → `PO_REJESTRACJI.md`.
