# Brief: trzecie przejście — drugi rok obrotowy

**Powstał:** 2026-08-05, po audycie „apka wysyła, trasa nie czyta"
(`docs/natywna-aplikacja/42-…`, wynik pusty).
**Zatwierdzone przez właściciela** jako następna robota.
**Dotyczy PANELU** (`poltechnickx-website`). Apki nie ruszamy — jeśli okaże
się, że trzeba, powiedz właścicielowi wprost przed zmianą repozytorium.

---

## Po co to

Dwa przejścia „na sucho" szły drogą sprzedaży: pierwsze tą, która się udaje,
drugie tą, która się nie udaje. Oba trwały dziesięć minut zegarowych i oba
obstawione są dziś harnessem (`npm run przejscie`, 101 zdań).

**Czego żaden z nich nie mógł zobaczyć: upływu czasu.** Numeracja faktur
resetuje się z rokiem, retencja kasuje dane po 24 miesiącach, faktury i koszty
cykliczne generują się co miesiąc — i wszystkie te mechanizmy przechodzą przez
31 grudnia. Panel nigdy nie przeżył tej daty, bo powstał w lipcu 2026.

To jest punkt (b) trzeciego przejścia z `PLAN-PO-DRUGIM-PRZEJSCIU.md`. Punkty
(a) „oczami klienta w prawdziwej przeglądarce" i (c) „awarie i brzegi" **zostają
poza zakresem** — (a) wymaga przeglądarki, której to środowisko nie ma.

---

## Jak w ogóle przesunąć czas (to jest sedno wykonalności)

**Sprawdzone przed napisaniem briefu: w kodzie NIE MA wstrzykiwania daty.**
Żadnego `FAKE_NOW`, `LEGGERA_TERAZ` ani niczego podobnego — `new Date()` woła
się wprost w kilkunastu miejscach `lib/`. Zegara nie przesuniesz.

**Droga, która działa: postarzaj DANE, nie zegar.** Retencja jest liczona
SQL-em po stronie bazy (`accepted_at < now() - '24 months'::interval`,
`lib/leadRetention.ts`), a faktury cykliczne wyzwala warunek
`next_run <= today` — więc rekord z datą sprzed dwóch lat albo `next_run`
w przeszłości zachowuje się dokładnie tak, jakby czas minął.

**Czego to NIE obejmie:** numeracji faktur, bo ta bierze rok z zegara serwera
(patrz A1 niżej) — tam trzeba będzie albo sondy na samej funkcji, albo
rozstrzygnięcia, czy zegar w ogóle powinien o tym decydować.

Dev-baza PGlite żyje w pamięci `next dev` i **nie zniesie rekordu starszego niż
dziś przez UI** — ale przyjmuje `INSERT`/`UPDATE` z dowolną datą, i to jest
narzędzie tej roboty.

---

## Cztery podejrzenia z dowodem w kodzie

Znalezione przy pisaniu briefu, **żadne nie potwierdzone przebiegiem** —
sprawdź je, zanim uznasz za usterki. Briefy w tym projekcie myliły się już
w obie strony (patrz `apka-faza13-paczka2`, `audyt-modul-57`).

### A1. Rok w numerze faktury bierze się z ZEGARA, nie z daty wystawienia

`app/api/invoices/[id]/issue/route.ts:123-124` — `const year = new
Date().getFullYear()`, a numer składa się z `computeNextNumer(sql, inv, year)`
(linia 41: `numer LIKE 'FV %/' + year`). Tymczasem `data_wystawienia` linijkę
niżej bierze się **z dokumentu**, jeśli właściciel ją ustawił.

**Scenariusz:** szkic z datą wystawienia 31.12.2026, kliknięty „Wystaw" 2 stycznia
2027 → dokument z datą grudniową i numerem `FV 1/2027`. Numeracja i data
dokumentu rozjeżdżają się o rok.

**Czego NIE przesądzam:** czy to usterka, czy zachowanie zamierzone. Wystawienie
faktury z datą wsteczną jest dopuszczalne (do 15. dnia następnego miesiąca), więc
pytanie „numer wg czego" ma odpowiedź księgową, nie programistyczną. **To jest
pytanie do właściciela, nie do rozstrzygnięcia w kodzie.**

### A2. `nextRunAfter` przepełnia się na 31. dniu miesiąca

`lib/recurring.ts:50-58` — `d.setMonth(d.getMonth() + months)`. Dla 31 stycznia
daje **3 marca** (JavaScript przelewa dzień, którego w lutym nie ma).

Dokładnie ta rodzina błędu została raz naprawiona w Kalendarzu (powtarzanie
wydarzeń — „wystąpienia licz od kotwicy, nie od poprzedniego"), ale **faktury
i koszty cykliczne jej nie dostały**. Dotyczy `recurring_invoices`
i `recurring_costs` — obu, bo dzielą tę funkcję.

### A3. `next_run` liczy się od DNIA URUCHOMIENIA crona, nie od kotwicy

`app/api/leads/notify/route.ts:254` —
`nextRunAfter(r.next_run <= today ? today : r.next_run, r.cykl)`.

Gdy cron nie zadziała w terminie (Vercel Hobby, awaria, `CRON_SECRET` nieustawiony),
kolejny przebieg policzy następny termin **od dnia nadrobienia**. Faktura „co
miesiąc 1." przesunie się na stałe. Razem z A2 daje to dryf, który po roku może
przesunąć fakturę o kilka dni — i nikt tego nie zauważy, bo każdy pojedynczy
szkic wygląda poprawnie.

### A4. Retencja — nigdy nie przeszła przez rzeczywisty upływ okna

`lib/leadRetention.ts` liczy trzy różne okna: leady 24 mies., oferty przegrane
24 mies., dowód e-podpisu 6 lat (plus poczta 24 mies.). Kod wygląda poprawnie
i ma testy jednostkowe, ale **żaden przebieg nie sprawdził, co się dzieje
z rekordem, który faktycznie wpadł w okno** — zwłaszcza czy kasowanie leada
nie zabiera ze sobą czegoś, co ma własną, dłuższą retencję (faktury: 5 lat).
Audyt 2 zapisał: „brak FK = kaskada nie sprząta" — to jest ta sama okolica.

---

## Jak to robić

1. **Najpierw harness, potem poprawki.** `npm run przejscie`
   (`scripts/przejscie/przejscie.ts`, 1681 linii) umie budować scenariusze
   i wypisywać zdania „działa / ZNANA LUKA / REGRESJA". Dołóż do niego sekcję
   drugiego roku — zdania mają zostać, gdy sesja się skończy. Dziś jest ich 101.
2. **Sprawdzenie = stan w danych**, nie „kod wygląda źle". Postarz rekord,
   uruchom trasę, przeczytaj bazę.
3. **A1 to pytanie do właściciela** — zadaj je, zanim cokolwiek zmienisz
   w numeracji. Numer faktury jest dokumentem fiskalnym.
4. **Nie dokładaj wstrzykiwania czasu do kodu produkcyjnego** tylko po to, żeby
   dało się to przetestować. Jeśli okaże się nieuniknione — to osobna decyzja,
   nie skutek uboczny.

---

## Czego NIE robić

- **Nie ruszaj apki** — to inne repozytorium i osobna decyzja.
- **Nie zmieniaj progów retencji** (24 mies. / 6 lat / 5 lat). Zapadły w Audycie
  2 i mają uzasadnienie prawne, nie techniczne.
- **Nie „naprawiaj" numeracji przed odpowiedzią właściciela na A1.**
- **Nie rozluźniaj hamulca** (60 żądań/60 min) „bo przeszkadza w sondzie" —
  rozstrzygnięte, patrz `HANDOFF.md`.

---

## Sprawdzenie i wynik

`npx tsc --noEmit -p tsconfig.json` + `npm test` + `npm run przejscie` (dziś
101 działa · 0 regresji). Wynik zapisz jako `docs/TRZECIE-PRZEJSCIE-DRUGI-ROK.md`,
zaktualizuj `HANDOFF.md`. Commit i push tylko dla panelu — apka zostaje.
