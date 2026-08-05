Pracujemy nad PANELEM (`poltechnickx-website`). Apki iOS w tej sesji nie
ruszamy — jeśli okaże się, że trzeba, powiedz mi to wprost, zanim cokolwiek
zmienisz w tamtym repozytorium.

Na start przeczytaj, w tej kolejności

* `docs/TRZECIE-PRZEJSCIE-DRUGI-ROK-PLAN.md` — brief tej roboty. Przeczytaj
  w całości. Zawiera cztery podejrzenia z dowodem w kodzie (żadne nie
  potwierdzone przebiegiem) i — najważniejsze — ustalenie, JAK w tym
  środowisku przesunąć czas, skoro zegara przesunąć się nie da.
* `HANDOFF.md` — stan całości i lista rzeczy otwartych.
* `CLAUDE.md` — zasady pracy i pułapki środowiska.
* `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`, sekcja „Co powinno być TRZECIM
  przejściem" (koniec pliku) — skąd ten zakres się wziął.
* `scripts/przejscie/przejscie.ts` — harness, do którego dokładasz zdania.
  Duży plik (1681 linii), szukaj w nim, nie czytaj w całości.

Punkt startu

* Panel: `dde4608` „Audyt: apka nie wysyła niczego, czego trasa nie czyta".
  `tsc` czysto, `npm test` 340/340, `npm run przejscie` 101 działa · 0 regresji.
* Apka: `255dc84` — nie dotykamy.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu.

Problem jednym zdaniem

Panel powstał w lipcu 2026 i nigdy nie przeżył 31 grudnia — a przez tę datę
przechodzą: numeracja faktur (resetuje się z rokiem), retencja danych
(24 miesiące, 6 lat), faktury i koszty cykliczne. Dwa przejścia „na sucho"
trwały po dziesięć minut zegarowych, więc żadne nie mogło tego zobaczyć.

Sedno wykonalności — przeczytaj to, zanim zaczniesz

W kodzie NIE MA wstrzykiwania daty (sprawdzone: żadnego `FAKE_NOW` ani
podobnego, `new Date()` woła się wprost). Zegara nie przesuniesz.

Droga, która działa: **postarzaj DANE, nie zegar.** Retencja liczy się SQL-em
(`now() - '24 months'::interval`), a cykliczne wyzwala `next_run <= today` —
więc rekord z datą sprzed dwóch lat zachowuje się tak, jakby czas minął.
Nie obejmie to numeracji faktur, bo ta bierze rok z zegara serwera (to jest
podejrzenie A1 w briefie).

Jedna rzecz wymaga MOJEJ decyzji, nie Twojej

**A1: rok w numerze faktury.** Dziś bierze się z zegara w chwili kliknięcia
„Wystaw", a nie z `data_wystawienia` dokumentu — więc szkic z datą 31.12.2026
wystawiony 2 stycznia dostanie numer `FV 1/2027`. Numer faktury jest dokumentem
fiskalnym i to jest pytanie księgowe, nie programistyczne. **Zapytaj mnie,
zanim cokolwiek tam zmienisz.** Resztą (A2–A4) zajmij się normalnie.

Jak to robić

1. Najpierw harness, potem poprawki — zdania w `npm run przejscie` mają zostać
   po sesji. Dziś jest ich 101.
2. Dowodem jest stan w danych po przebiegu, nie „kod wygląda źle".
3. Nie dokładaj wstrzykiwania czasu do kodu produkcyjnego tylko po to, żeby dało
   się to przetestować. Gdyby wyszło, że inaczej nie można — to osobna decyzja,
   zapytaj.

Czego NIE robić

* Nie zmieniaj progów retencji (24 mies. / 6 lat / 5 lat) — zapadły w Audycie 2
  i mają uzasadnienie prawne.
* Nie rozluźniaj hamulca (60 żądań/60 min) „bo przeszkadza w sondzie".
* Nie ruszaj apki.

Pułapki, które kosztowały czas ostatnio

* `rm -f .git/index.lock` PRZED `git add`.
* Dev-baza PGlite żyje w pamięci `next dev` — restart kasuje wszystko. Ale
  przyjmuje `INSERT`/`UPDATE` z dowolną datą i to jest narzędzie tej roboty.
* `npx tsc --noEmit -p tsconfig.json` to jedyna realna weryfikacja typów
  (pełny `next build` failuje w sandboxie z EPERM). `tsc` nie wie nic o SQL-u.
* Komentarz `--` w `sql\`…\`` tnie zapytanie — nowe linie giną, nic tego nie zgłasza.
* Grep po nazwie pola kłamie: pole bywa czytane pętlą po tablicy nazw albo
  zagnieżdżone w warunku innego pola.

Na koniec

Wynik zapisz jako `docs/TRZECIE-PRZEJSCIE-DRUGI-ROK.md`, zaktualizuj
`HANDOFF.md`, podaj polecenia do commita i pusha (tylko panel) i skasuj
`PROMPT-NOWY-CZAT.md`.

Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
