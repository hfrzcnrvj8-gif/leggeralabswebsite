# Krok 2: szablon mówi tylko to, co potwierdzają dane

Robimy **krok 2** z `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`. Przeczytaj go w całości —
jest krótki, a sekcje „Dlaczego znowu nie zaczynamy od listy poprawek" i „Trzy
rzeczy, które ustawiają cały plan" są ważniejsze niż sama lista zadań.

Poza tym przeczytaj:
- `CLAUDE.md` — zasady pracy i pułapki środowiska
- `docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`, sekcje **A4, A5, C2, C4, D3, D4** — to są
  te znaleziska, z dowodami (dokładne treści maili, które wyszły)

## Punkt startu

Ostatni commit `5f4e81c` „Krok 1: publiczny dokument zna swój stan". Repo czyste
i wypchnięte. `tsc` czysto, `npm test` **288/288**, `npm run przejscie`
**68 działa · 0 regresji · 0 pominiętych**.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu (równoległa sesja już raz wchłonęła cudze zmiany).

## Co jest do zrobienia

Sześć rzeczy, wszystkie o jednym: **szablony twierdzą rzeczy, których dane nie
potwierdzają, i nie używają danych, które panel ma.**

1. **Windykacja kłamie o historii korespondencji.** Pierwsza wysłana wiadomość
   ma temat „Druga prośba o płatność" i zdanie „to już druga wiadomość w tej
   sprawie". Wezwanie mówi „pomimo wcześniejszych przypomnień" — i to samo
   zdanie trafia na **formalny dokument** `WZ-…`. W obu przypadkach
   `reminder_level` wynosił 0, a panel wyświetlał „Jeszcze nic nie wysłano".
   Treść ma wynikać z `reminder_level`, nie z dni zwłoki.
2. **Wybór poziomu windykacji** (decyzja właściciela nr 4 w planie): przycisk
   staje się rozwijaczem „Łagodne / Stanowcze / Wezwanie". Podpowiadany zostaje
   ten z dni zwłoki; wybrać można niżej, ale **nie poniżej już wysłanego**.
   Bez tego punkt 1 jest połowiczny: dziś faktura sprzed dwóch miesięcy nie ma
   jak dostać łagodnego przypomnienia, bo nie ma czego wybrać.
3. **Daty w mailach idą surowe z bazy** — `2026-07-21` zamiast `21.07.2026`.
   Dokument wezwania robi to poprawnie, więc to defekt szablonów **mailowych**.
   Przejrzyj je wszystkie naraz, nie tylko windykacyjne — to rodzaj rozjazdu,
   który wraca.
4. **Maile nie znają ani klienta, ani nas.** Wszystkie zaczynają „Dzień dobry,"
   i kończą „Pozdrawiamy, Leggera Labs", choć panel zna `osoba_kontaktowa`
   (Karolina Bąk) i `osoba_podpisujaca` (Patryk Piecyk). Jednoosobowa firma
   pisze w liczbie mnogiej i bez nazwiska — także pod wezwaniem do zapłaty.
   To bezpośredni krewny **A1 z pierwszego przejścia** (`[Twoje imię]`).
5. **Mail z nową wersją oferty nie mówi, że coś zastępuje** i żaden mail
   z ofertą nie podaje daty ważności, choć panel ją zna.
6. **Wezwanie do zapłaty nie ma rubryki podpisu ani kontaktu do wierzyciela** —
   kończy się kwotą i numerem konta. Dłużnik nie ma z dokumentu do kogo
   napisać. Rubryka przez `PasekMarkiDokumentu` / `KwotaGradientem`
   z `app/[lang]/admin/DocGradient.tsx`, inaczej zniknie na wydruku.

## Jak pracować (to się sprawdziło w kroku 1)

- **Szukaj list dopisanych w połowie, nie brakujących warstw.** W kroku 1
  bramka akceptacji istniała i znała dwa stany z pięciu; `CLOSED_OFFER_STATUSES`
  leżało obok, gotowe, tylko nikt go tam nie zawołał. Tu prawdopodobnie
  zobaczysz to samo z poziomami windykacji.
- **Warunek pisz przez wyliczenie dozwolonego, nie wykluczanie zakazanego.**
  `status != 'Podpisana'` przepuszczało umowę odrzuconą; `status = 'Wysłana'`
  nie przepuszcza niczego, czego nie wymieniono.
- **Wspólna funkcja to za mało, jeśli strony dostają inne dane.** Serwer i widok
  wołały już tę samą funkcję, a i tak się rozjechały, bo publiczny GET filtruje
  pola białą listą (`lib/publicFields.ts`). Sprawdzaj dane, nie tylko logikę.
- **Dowodem jest treść, która wyszła**, a nie to, że kod wygląda dobrze. Maile
  w dev nie idą do nikogo — lądują w logu serwera (`preview_logs`, szukaj po
  numerze faktury). Otwieraj każdy i czytaj.
- **Dev-baza kasuje się przy każdym przeładowaniu modułów serwera** (PGlite żyje
  w procesie). Po edycji pliku w `lib/` albo `app/api/` scenariusz trzeba
  odtworzyć — miej to w skrypcie. Dane wystawcy też znikają, a bramka wysyłki
  bez nich blokuje.
- **`POST /api/offers` i `POST /api/contracts` nie zapisują wszystkich pól
  z body** (m.in. `klient_email`, `zakres_prac`) — dopisuj je osobnym `PATCH`,
  inaczej bramka wysyłki zatrzyma Cię na czymś, co „przecież ustawiłeś".
- **Hamulec publicznych dokumentów to 5 prób / 60 min na adres IP.** Testując
  publiczne trasy, podawaj różne `x-forwarded-for`, inaczej zablokujesz sobie
  też `npm run przejscie` (raz pominął z tego powodu 3 sprawdzenia).
- Po każdej paczce zmian: `npx tsc --noEmit -p tsconfig.json`, `npm test`,
  `npm run przejscie`. Ostatnie musi pokazać **0 regresji i 0 pominiętych** —
  „pominięte" znaczy, że akurat tej drogi przebieg nie sprawdził.

## Czego NIE robić

- Nie bierz się przy okazji za krok 3, 4 ani 5. Krok 2 to szablony i poziomy
  windykacji — nic więcej.
- Nie zmieniaj treści klauzul umownych ani wzoru wezwania poza tym, o co proszę
  (pkt 6). Dokumenty czekają na prawnika — `docs/DO-PRAWNIKA-I-TLUMACZA.md`.
- Nie dopisuj sprawdzeń do `przejscie.ts` na drogę porażki — to jest krok 5.

## Na koniec

Zaktualizuj tabelę w `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` (krok 2 → ✅ z numerem
commita) i dopisz sekcję „Co się okazało przy robocie", tak jak przy kroku 1 —
zwłaszcza to, co Cię zaskoczyło.

Podaj polecenia do commita i pusha oraz skasuj ten plik (`PROMPT-KROK-2.md`).

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
