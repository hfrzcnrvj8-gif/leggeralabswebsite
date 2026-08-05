Pracujemy nad PANELEM (`poltechnickx-website`). Apki iOS w tej sesji nie
ruszamy — jeśli okaże się, że trzeba, powiedz mi to wprost, zanim cokolwiek
zmienisz w tamtym repozytorium.

To jest **etap 1 z pięciu** z `docs/PLAN-DOMKNIECIA.md`. Panel i apka są
funkcjonalnie kompletne i przeaudytowane; domykamy trzy rzeczy, których nikt
nie sprawdził: przewodnik dla mnie, przyrost tras od audytu bezpieczeństwa
i wygląd oglądany prawdziwymi oczami.

Na start przeczytaj, w tej kolejności

* `docs/ETAP-1-PRZEWODNIK-BRIEF.md` — brief tej roboty. **Przeczytaj go
  w całości, zanim cokolwiek napiszesz.** Zakres jest WĘŻSZY, niż brzmi:
  rekonesans pokazał, że przewodnik w dużej części już istnieje w panelu
  (ekran *Instrukcje*, `lib/instrukcje.ts`, 272 wpisy, 14 modułów). Brief mówi,
  czego naprawdę brakuje i od czego zacząć.
* `docs/PLAN-DOMKNIECIA.md` — całość planu, żeby wiedzieć, co jest po tym
  etapie i czego do niego NIE wciągać.
* `HANDOFF.md` — stan całości i lista rzeczy otwartych.
* `CLAUDE.md` — zasady pracy i pułapki środowiska.
* `lib/instrukcje.ts` — duży plik, szukaj w nim, nie czytaj w całości.
  Zacznij od `WSTEP` (linia ~50) i od listy `MODULY`.

Punkt startu

* Panel: `3e3906b` „Plan domknięcia…". `tsc` czysto, `npm test` **349/349**,
  `npm run przejscie` **111 działa · 0 regresji** (trzy przebiegi pod rząd
  dają to samo).
* Apka: `255dc84` — nie dotykamy.

Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu.

Co ma powstać

1. **Weryfikacja instrukcji — czy nadal mówią prawdę.** To jest najważniejsza
   część i od niej zacznij. Lista podejrzanych miejsc jest w briefie (faktury
   cykliczne zmieniły się 2026-08-05, doszła kontrola nadpłaty, są nowe
   potwierdzenia i bramka wysyłki).
2. **`docs/CO-MAM.md`** — krótkie podsumowanie dla MNIE, nie dla programisty:
   co mam, co dzieje się samo i o której, czego panel świadomie nie robi,
   i skąd wiadomo, że to działa (z uczciwym „czego te liczby nie obejmują").
   Dwie–trzy strony, nie trzydzieści.
3. **Trzy ścieżki dnia** — tylko jeśli po punkcie 1 widać, że ich brakuje.

Czego NIE robić

* Nie przepisuj instrukcji z panelu do markdownu — duplikat rozjedzie się
  z oryginałem w tydzień.
* Nie pisz specyfikacji na 30 stron. Nie jestem programistą.
* Nie zmieniaj zachowania panelu przy okazji — znalezione usterki zapisz
  i zgłoś mi, poprawki idą etapem 5.
* Nie ruszaj apki.

Pułapki, które kosztowały czas ostatnio

* `rm -f .git/index.lock` PRZED `git add`.
* **Trasy `/api/*` potrafią oddawać 404 po restarcie `next dev`** — także
  nietykane, przy czystym `tsc` i pliku obecnym w gicie. To uszkodzony cache
  Turbopacka: `rm -rf .next` i start od nowa. Zdarzyło się dwa razy jednego
  dnia; nie szukaj wtedy usterki u siebie.
* Podgląd renderuje w ukrytej karcie 0×0 — sprawdzaj przez `innerText`
  i `getComputedStyle`, nie przez zrzut ekranu.
* `npx tsc --noEmit -p tsconfig.json` to jedyna realna weryfikacja typów
  (pełny `next build` failuje w sandboxie z EPERM).
* Dokumentacja tego projektu **regularnie kłamie** — 2026-08-05 złapano to
  trzy razy w jeden dzień. Sprawdzaj zdania przeciwko kodowi, nie kiwaj głową.

Na koniec

`docs/CO-MAM.md`, lista znalezisk z weryfikacji do `docs/ETAP-1-WYNIK.md`
(także gdy pusta), aktualizacja `HANDOFF.md` i odhaczenie etapu 1
w `docs/PLAN-DOMKNIECIA.md`. Podaj polecenia do commita i pusha (tylko panel)
i skasuj `PROMPT-NOWY-CZAT.md`.

Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
